# Sub-proyecto 5 — Monetización B2C: paywall + Stripe checkout

**Fecha:** 2026-05-03
**Estado:** Aprobado, pendiente de implementación
**Autor:** Sergio Paradela (con Claude)
**Predecesor:** Sub-proyecto 1 + 1.5 — Modelo de cuenta y workspace + migración (en prod desde 2026-05-03)
**Constitución:** Sub-proyecto 0 — Decisiones fundacionales (`docs/superpowers/specs/2026-05-01-sub-proyecto-0-decisiones-fundacionales-design.md`)
**Paralelo posible:** Sub-proyecto 2 — Permisos y scoping (orden acordado: `0 → 1 → 5 || (2 → 3 → 4) → 6 → 7`)

---

## 0. Por qué existe este spec

Convertir Pick&Coach de gratis-total a un modelo `free + Pro`. El sub-proyecto 0 fijó la decisión estratégica (free con quota mensual de IA, Pro ilimitado, suscripción per-workspace, Stripe Volume mode preparado para futuro B2B). Este spec aterriza esa decisión en arquitectura, código y operativa concreta para B2C.

V1 entrega:

- Gating de IA contra una quota mensual unificada (toda llamada a Gemini cuenta).
- Stripe Embedded Checkout para upgrade Free→Pro.
- Stripe Billing Portal hosted para gestión de suscripción.
- Webhook handler idempotente que sincroniza estado Stripe → Firestore.
- UX completa: counter visible para free, warning, modal del wall, banner de pago fallido.

Es el primer sub-proyecto que genera ingresos. Su infraestructura Stripe (Customer, Subscription, webhook) se reutiliza en sub-proyecto 6 (B2B per-seat) — esa es la razón explícita de B2C-first dentro del bloque de monetización (constitución, sección 1).

---

## 1. Decisiones de producto tomadas

| #   | Decisión              | Valor                                                                                                                                                               |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Scope de gating       | Quota unificada: cualquier llamada a Gemini cuenta (Pick + bracket parser + calendar AI + results AI + training generator). Sin contadores separados por tipo.      |
| 2   | Tamaño del cap free   | **50 AI requests/mes calendario (Europe/Madrid)**. Reset el día 1 a 00:00 hora local.                                                                               |
| 3   | Precio Pro            | **€4,99/mes** o **€49/año** (~17% descuento). Ambos en Stripe Volume mode con un solo tramo (constraint del sub-proyecto 0 sec. 9.3, aplicada también a B2C).       |
| 4   | Default state legacy  | Free directo para todos, sin trial automático ni Pro vitalicio. Base efectiva = el dev y su pareja; el resto son cuentas anónimas de prueba del dev.                |
| 5   | UX checkout / portal  | **Embedded Checkout** (cliente paga dentro de la app) + **Hosted Customer Portal** (cancelar/cambiar tarjeta/ver facturas via `billing.stripe.com`).                |
| 6   | Comportamiento al cap | **Hard wall** + counter siempre visible para free + warning sutil desde 80% (40/50) + modal al hit del 100%.                                                        |
| 7   | Dunning               | Stripe Smart Retries (3 intentos en 14 días, default) + banner in-app cuando `billing.status === 'past_due'` + downgrade automático cuando Stripe declara `unpaid`. |
| 8   | Tax & facturación     | **Stripe Tax** habilitado para Spain + **Stripe Invoicing** automático. Factura por email tras cada cobro. IVA 21% incluido en precio mostrado.                     |
| 9   | Pro fair-use          | Soft cap de 2.000 requests/mes para Pro. Por encima, log `PRO_FAIR_USE_EXCEEDED` pero **no bloquea**. Bloqueo duro se reserva para post-V1 si aparece abuso real.   |
| 10  | Multi-plan B2C        | Diferido. V1 lanza con un solo tier Pro. La constraint del sub-proyecto 0 (`plan` field como string libre) deja añadir `'max'` o `'enterprise'` sin cambio de tipo. |

---

## 2. Modelo de datos

### 2.1 Workspace doc (extiende schema existente)

```ts
artifacts/{appId}/workspaces/{wsId} {
  // ya existentes (no cambian)
  type, name, ownerId, createdAt, updatedAt,
  plan: 'free' | 'pro',           // ya inicializado a 'free' por la migración del sub-proyecto 1
  planUpdatedAt: Timestamp | null,

  // billing — nullable hasta el primer checkout
  billing: {
    stripeCustomerId: string,
    stripeSubscriptionId: string | null,
    status: 'active' | 'past_due' | 'unpaid' | 'canceled' | 'trialing' | null,
    cancelAtPeriodEnd: boolean,
    currentPeriodEnd: Timestamp | null,
    priceId: string | null,        // 'price_pro_monthly' o 'price_pro_annual'
    lastEventAt: Timestamp,
  } | null
}
```

El campo `billing` permanece `null` mientras el workspace nunca haya tocado Stripe. El primer `createCheckoutSession` lo inicializa con al menos `stripeCustomerId`. Si el usuario abandona el checkout antes de pagar, el customerId queda persistido (no se borra) — Stripe permite reutilizarlo.

### 2.2 Counter de uso — subdoc por mes

```ts
artifacts/{appId}/workspaces/{wsId}/usage/{YYYY-MM} {
  count: number,                  // increment atómico via FieldValue.increment(1)
  lastIncrementAt: Timestamp,
  monthId: string,                // 'YYYY-MM' redundante, útil para queries
}
```

- `YYYY-MM` calculado en zona `Europe/Madrid` server-side via `Intl.DateTimeFormat` (sin nuevas deps). El reset coincide con la medianoche local del día 1.
- Si el doc no existe en el primer increment del mes → se crea con `count: 1` dentro de la misma transacción.
- **No hay scheduled job de reset.** Cada mes nuevo simplemente abre un doc nuevo. El doc del mes anterior queda como histórico (consultable para analítica futura).
- Limpieza histórica: docs de usage > 12 meses se purgan via la Cloud Function `dataCleanup` ya existente (cleanup mensual). Coste de almacenamiento despreciable.

### 2.3 Idempotencia de webhooks

```ts
artifacts/{appId}/stripeEvents/{eventId} {
  type: string,                   // 'invoice.paid', 'customer.subscription.updated', etc.
  processedAt: Timestamp,
  wsId: string | null,            // si el evento es atribuible a un workspace
}
```

Antes de procesar un webhook, el handler hace `if ((await tx.get(eventRef)).exists) return` → no-op silencioso. Permite que Stripe reintente con seguridad.

TTL natural: estos docs se purgan a 90 días via `dataCleanup`.

### 2.4 Reglas Firestore añadidas

```firestore
match /artifacts/{appId}/workspaces/{wsId}/usage/{monthId} {
  allow read: if isSignedIn() && isWorkspaceMember(appId, wsId);
  allow write: if false;          // solo Admin SDK (Cloud Functions)
}

match /artifacts/{appId}/stripeEvents/{eventId} {
  allow read, write: if false;    // solo Admin SDK
}
```

El doc `workspaces/{wsId}` mantiene la regla actual (`update: isWorkspaceOwner`) — el cliente no puede escribir `plan` ni `billing` directamente. Los webhooks usan Admin SDK que bypasea reglas, sin necesidad de añadir cláusulas de service account.

`isWorkspaceMember` es el helper ya existente (sub-proyecto 1.5). Que cualquier miembro pueda leer el counter (no solo el owner) anticipa el caso multi-rol futuro: en B2B, los coaches del workspace verán el counter compartido del club.

### 2.5 Mapping Stripe ↔ workspace

- **Cliente → Stripe:** `stripeCustomerId` persiste en `workspaces/{wsId}.billing.stripeCustomerId`.
- **Stripe → cliente:** el Customer se crea con `metadata: { wsId, appId, uid }`. Los webhooks leen `event.data.object.metadata.wsId` para saber dónde escribir sin queries adicionales.

Ambas direcciones cubiertas. No hay tabla extra de mapping inverso.

---

## 3. Arquitectura backend

### 3.1 Cloud Functions nuevas

| Función                 | Tipo           | Qué hace                                                                                                                                                                                                                                                             |
| ----------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createCheckoutSession` | `onCall` v2    | Recibe `{ wsId, priceId }`. Valida `auth.uid === ws.ownerId`. Crea o recupera Stripe Customer (con metadata). Crea Checkout Session con `ui_mode: 'embedded'`, `mode: 'subscription'`, `line_items: [{ price: priceId, quantity: 1 }]`. Devuelve `{ clientSecret }`. |
| `createPortalSession`   | `onCall` v2    | Recibe `{ wsId, returnUrl }`. Valida owner. `stripe.billingPortal.sessions.create({ customer, return_url })` → devuelve `{ url }`.                                                                                                                                   |
| `stripeWebhook`         | `onRequest` v2 | HTTP endpoint. Valida signature con `STRIPE_WEBHOOK_SIGNING_SECRET`. Comprueba idempotencia (`stripeEvents/{event.id}`). Despacha al handler correspondiente por `event.type`.                                                                                       |

### 3.2 Funciones existentes modificadas

`functions/src/index.ts` exports a tocar:

- **`runAgent`** (callable v1 legacy, en `index.ts:141`)
- **`aiChat`** (callable v2 orchestrator, en `index.ts:290`)
- **`proactiveDailyBriefing`** (scheduled v2, en `index.ts:405`)

Cada una añade al inicio:

```ts
import { assertWithinQuota } from './billing/quota';
// ...
await assertWithinQuota({ wsId, appId });
// ... lógica existente ...
```

`proactiveDailyBriefing` itera workspaces; si uno está en cap free, el helper lanza `HttpsError` que el batch loop captura, logea `BRIEFING_SKIPPED_QUOTA` y continúa con el siguiente workspace. **No detiene el batch.**

### 3.3 Helper compartido `functions/src/billing/quota.ts`

```ts
const FREE_QUOTA = 50;
const PRO_FAIR_USE = 2000;

export async function assertWithinQuota({ wsId, appId }: { wsId: string; appId: string }) {
  const ws = await getWorkspaceDoc(wsId, appId);
  const monthId = currentMonthId(); // 'YYYY-MM' Europe/Madrid via Intl
  const usage = await incrementUsage(wsId, appId, monthId);

  if (ws.plan === 'pro') {
    if (usage.count > PRO_FAIR_USE) {
      logger.warn('PRO_FAIR_USE_EXCEEDED', { wsId, count: usage.count, monthId });
    }
    return usage;
  }

  if (usage.count > FREE_QUOTA) {
    throw new HttpsError('resource-exhausted', 'QUOTA_EXCEEDED', { count: usage.count, limit: FREE_QUOTA, monthId });
  }
  return usage;
}
```

`incrementUsage` corre en transacción Firestore:

```ts
async function incrementUsage(wsId, appId, monthId) {
  const ref = db.doc(`artifacts/${appId}/workspaces/${wsId}/usage/${monthId}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, { count: 1, lastIncrementAt: FieldValue.serverTimestamp(), monthId });
      return { count: 1 };
    }
    tx.update(ref, {
      count: FieldValue.increment(1),
      lastIncrementAt: FieldValue.serverTimestamp(),
    });
    return { count: snap.data()!.count + 1 };
  });
}

function currentMonthId(): string {
  const fmt = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  return `${year}-${month}`;
}
```

### 3.4 Decisión consciente: increment-before-execution

El helper incrementa el counter **antes** de ejecutar la AI call.

- **Ventaja:** resistente a abuse. Dos calls paralelas no pueden ambas leer counter < 50 y ambas pasar.
- **Trade-off:** si la AI call falla después (timeout Gemini, error de modelo), el counter consumió 1 sin que el usuario reciba respuesta.

Aceptado para V1. La alternativa (reservar y commit, o increment-after) introduce o race conditions o complejidad de rollback que no compensa para un fail rate < 1%. Revisable post-V1 si aparecen quejas reales.

### 3.5 Webhook handlers — uno por `event.type`

```
checkout.session.completed     → billing inicial completo, plan = 'pro', planUpdatedAt = now
customer.subscription.updated  → status, cancelAtPeriodEnd, currentPeriodEnd, priceId
customer.subscription.deleted  → plan = 'free', billing.status = 'canceled', planUpdatedAt = now
invoice.payment_succeeded      → reafirma plan = 'pro', billing.status = 'active' (idempotente)
invoice.payment_failed         → billing.status = 'past_due' (no toca plan; sigue 'pro' durante retries)
```

Cada handler hace `set(...)` con merge sobre `workspaces/{wsId}.billing` y/o `workspaces/{wsId}.plan`. Idempotente por construcción (writes de set/update con valores derivados del evento, no incrementos) + idempotencia adicional por `event.id`.

Si un webhook llega para un `wsId` que no existe (caso teórico: workspace borrado entre upgrade y webhook), el handler logea `WEBHOOK_ORPHAN_EVENT` y marca el evento como procesado para evitar retries infinitos.

### 3.6 Stripe configuration (Dashboard, no código)

- **Product** `Pick Pro` con dos **Prices**:
  - `price_pro_monthly` — €4,99/mes recurring, Volume mode con un solo tier.
  - `price_pro_annual` — €49/año recurring, Volume mode con un solo tier.
- **Stripe Tax** habilitado, jurisdicción Spain. Precio mostrado al usuario incluye IVA 21%.
- **Stripe Invoicing** automático — factura enviada por email tras cada cobro. Si el usuario aporta NIF en el checkout, la factura sale con NIF.
- **Smart Retries** — default (3 intentos en 14 días con email automático).
- **Webhook endpoint** — apunta a la URL del Cloud Function `stripeWebhook` desplegada. Eventos suscritos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
- **Promotion code** `DEV100` con 100% off oculto. Sin uso planificado. Plan B para casos puntuales (colaborador prueba Pro en prod).

### 3.7 Env vars añadidas

`functions/.env` (gitignored, ya existe con `PICK_APP_ID=uros-fbm-app`):

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SIGNING_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_pro_monthly_...
STRIPE_PRICE_ANNUAL=price_pro_annual_...
```

Confirmar presencia antes de cada deploy de functions, igual que la disciplina ya establecida con `PICK_APP_ID` en sub-proyecto 1. Sin estas vars, `createCheckoutSession`/`createPortalSession`/`stripeWebhook` deben fallar fast en seco al arrancar (log error, return) en lugar de degradar silenciosamente.

V1 usa solo prod credentials. Para staging (ver sección 7), un set paralelo `sk_test_*` en proyecto Firebase distinto.

---

## 4. Arquitectura frontend

### 4.1 Hooks nuevos en `src/billing/`

```ts
// useWorkspacePlan(wsId) — listener al doc del workspace, derivado simple
function useWorkspacePlan(wsId: string) {
  // suscribe a artifacts/{appId}/workspaces/{wsId}, devuelve:
  return {
    plan: 'free' | 'pro',
    billing: WorkspaceBilling | null,
    isPro: boolean,
    isPastDue: boolean, // billing?.status === 'past_due'
    cancelAtPeriodEnd: boolean,
    currentPeriodEnd: Date | null,
  };
}

// useWorkspaceUsage(wsId) — listener al doc usage del mes actual
function useWorkspaceUsage(wsId: string) {
  // calcula monthId Europe/Madrid client-side, suscribe a workspaces/{wsId}/usage/{monthId}
  return {
    count: number, // 0 si el doc aún no existe
    limit: 50, // FREE_QUOTA constante exportada (compartida con backend via constants)
    percentage: number, // count/limit, capped a 100
    isAtCap: boolean, // count >= 50
    isNearCap: boolean, // count >= 40 (80%)
    monthId: string,
  };
}
```

Ambos consumen el `wsId` activo del `WorkspaceContext` ya existente — cambiar de workspace = cambian counter y plan automáticamente.

`monthId` se calcula igual en cliente que en server (mismo algoritmo `Intl.DateTimeFormat` con `Europe/Madrid`). Pequeño desync posible si client y server están en fechas distintas (unos segundos cerca de medianoche del día 1) — se resuelve naturalmente al siguiente request.

### 4.2 Componentes nuevos en `src/billing/components/`

| Componente            | Dónde aparece                                           | Cuándo                                                                                                                                                   |
| --------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UsageCounter`        | Header del área privada                                 | Solo si `plan === 'free'`. Badge sutil "32/50 IA este mes". Tooltip con explicación si hover.                                                            |
| `QuotaWarningBanner`  | Top de `HomeScreen`                                     | Free + `isNearCap`. "Te quedan 10 acciones de IA este mes. Pasa a Pro para ilimitado." + CTA `/upgrade`.                                                 |
| `QuotaExceededModal`  | Triggered al recibir `HttpsError('resource-exhausted')` | "Has llegado a tu límite mensual. Pasa a Pro o vuelve el día 1." + CTA `/upgrade` + cerrar.                                                              |
| `PaymentFailedBanner` | Top del área privada                                    | `billing?.status === 'past_due'`. Persistente. "Tu pago ha fallado. Actualiza tu tarjeta." + CTA portal.                                                 |
| `UpgradePage`         | Nueva ruta `/upgrade`                                   | `<EmbeddedCheckoutProvider>` + `<EmbeddedCheckout>` con `clientSecret` de `createCheckoutSession`.                                                       |
| `UpgradeSuccessPage`  | Nueva ruta `/upgrade/success`                           | Espera hasta 8s polling el plan; si plan === 'pro' → redirect a home con toast de éxito; timeout → "Procesando tu pago, recibirás email" + link al home. |
| `BillingSection`      | Settings drawer en `HomeScreen`                         | Plan actual + "Gestionar suscripción" → redirect a Stripe Portal. Solo el `owner` lo ve.                                                                 |

### 4.3 Manejo de error 429 unificado

`src/services/aiClient.ts` (existente) gana un único catch:

```ts
async function callAI(...) {
  try {
    return await callable(...);
  } catch (err) {
    if (err.code === 'functions/resource-exhausted' && err.details?.limit) {
      eventBus.emit('quota-exceeded', err.details);   // QuotaExceededModal escucha
    }
    throw err;
  }
}
```

Toda llamada a IA del frontend (Pick chat, bracket parser, calendar AI, results, training generator) pasa por `aiClient` ya, así que un solo punto de manejo cubre todos los flujos sin tocar cada call site.

### 4.4 Routing

`AppRouter.jsx`:

```
+ /upgrade                   → UpgradePage (lazy + ModuleBoundary)
+ /upgrade/success           → UpgradeSuccessPage (handler de retorno post-checkout)
```

`HomeScreen` settings drawer:

```
+ Sección "Plan y suscripción" → BillingSection
```

### 4.5 Voz Pick (consistencia con PRODUCT.md)

Tutea, lenguaje del baloncesto. Copy concretas:

- Counter: "32/50 acciones IA este mes" — no "API requests" ni "tokens" ni "queries".
- Warning banner: "Te quedan 10 acciones de IA. Pasa a Pro para que Pick siga corriendo contigo."
- Modal del cap: "Has llegado a tu cap mensual. Pasa a Pro y Pick deja de mirar el reloj."
- Banner past_due: "Tu pago ha fallado. Actualiza tu tarjeta antes del [date] o el equipo se queda sin Pick."
- Botón principal: "Hazte Pro" — no "Subscribe" ni "Upgrade your account".

### 4.6 Performance

- Los listeners ya están abiertos para el workspace doc (lo hace `WorkspaceContext`). Añadir el listener al usage doc del mes = un suscriptor más, despreciable.
- `UpgradePage` lazy-loaded. El bundle de Stripe Embedded Checkout no carga hasta que el usuario hace clic en "Hazte Pro".
- `useWorkspaceUsage` debounce el cálculo del `monthId` por sesión — no recalcula en cada render.

---

## 5. Flujos end-to-end

### 5.1 Free user hace una AI request (camino normal)

```
1. Usuario clic "Enviar mensaje" en Pick chat.
2. Frontend → callable aiChat({ wsId, message }).
3. Server: assertWithinQuota({ wsId, appId }).
   - Lee ws.plan === 'free'.
   - Transaction: increment usage/{monthId}.count → 32.
   - 32 ≤ 50 → OK, continúa.
4. Server llama a Gemini, devuelve respuesta.
5. Frontend recibe respuesta, muestra en chat.
6. useWorkspaceUsage listener actualiza counter en header → "32/50".
```

### 5.2 Free user hits el cap

```
1. Usuario está en 50/50, intenta enviar mensaje 51.
2. Frontend → callable aiChat.
3. Server: increment usage → count = 51 → > 50.
4. Server throw HttpsError('resource-exhausted', 'QUOTA_EXCEEDED', { count: 51, limit: 50 }).
5. Frontend aiClient captura error, eventBus.emit('quota-exceeded', ...).
6. QuotaExceededModal aparece: "Has llegado a tu cap mensual. Pasa a Pro y Pick deja de mirar el reloj."
7. Click "Hazte Pro" → navigate('/upgrade').
```

Nota: el counter queda en 51 (increment-before). El usuario ve "51/50" un instante en el header. Glitch visual aceptado; ver sección 3.4.

### 5.3 Upgrade Free → Pro

```
1. Usuario en /upgrade.
2. Frontend → callable createCheckoutSession({ wsId, priceId: 'price_pro_monthly' }).
3. Server:
   - Valida wsId existe + caller.uid === ws.ownerId.
   - Si ws.billing?.stripeCustomerId no existe → crea Stripe Customer con metadata { wsId, appId, uid }.
   - Persiste customerId en ws.billing.stripeCustomerId.
   - stripe.checkout.sessions.create({
       ui_mode: 'embedded',
       customer,
       line_items: [{ price: priceId, quantity: 1 }],
       mode: 'subscription',
       return_url: '<app>/upgrade/success?session_id={CHECKOUT_SESSION_ID}'
     })
   - Devuelve { clientSecret }.
4. Frontend monta <EmbeddedCheckout clientSecret={clientSecret} />.
5. Usuario introduce tarjeta, NIF (opcional, para factura), confirma.
6. Stripe → Webhook checkout.session.completed → handler:
   - Lee event.data.object.metadata.wsId.
   - Idempotencia: si stripeEvents/{event.id} existe → return.
   - Escribe ws.billing = {
       stripeCustomerId, stripeSubscriptionId, status: 'active',
       currentPeriodEnd, priceId, cancelAtPeriodEnd: false, lastEventAt: now
     }.
   - Escribe ws.plan = 'pro', ws.planUpdatedAt = now.
   - Escribe stripeEvents/{event.id} = { type, processedAt, wsId }.
7. Stripe redirige al return_url.
8. UpgradeSuccessPage:
   - useWorkspacePlan listener; si ya plan === 'pro' → redirect a /area-privada/?upgraded=true con toast "¡Bienvenido a Pro!".
   - Si tras 8s sigue 'free' (race con webhook lento) → "Procesando tu pago, recibirás email de confirmación" + link al home.
```

### 5.4 Cancel Pro → Free (al final del periodo)

```
1. Pro user clic "Gestionar suscripción" en BillingSection.
2. Frontend → callable createPortalSession({ wsId, returnUrl: window.location.href }).
3. Server: valida owner, stripe.billingPortal.sessions.create({ customer, return_url }) → { url }.
4. Frontend redirect window.location = url.
5. En Stripe Portal, usuario clic "Cancel subscription".
6. Stripe sets subscription.cancel_at_period_end = true (default behavior, no immediate cancel).
7. Stripe → Webhook customer.subscription.updated → handler:
   - ws.billing.cancelAtPeriodEnd = true (ws.plan sigue siendo 'pro' hasta currentPeriodEnd).
8. Frontend BillingSection muestra "Pro hasta DD/MM/YYYY" en lugar del CTA cancelar.
9. Llega currentPeriodEnd → Stripe → Webhook customer.subscription.deleted:
   - ws.plan = 'free', ws.billing.status = 'canceled', ws.planUpdatedAt = now.
10. Frontend ve plan === 'free' → counter aparece, paywall activo de nuevo.
```

### 5.5 Payment failed (dunning)

```
1. Pro user, cobro de renovación falla (tarjeta caducada).
2. Stripe → Webhook invoice.payment_failed → handler:
   - ws.billing.status = 'past_due'.
   - ws.plan SIGUE siendo 'pro' (Stripe Smart Retries en marcha, gracia).
3. Frontend: PaymentFailedBanner aparece persistente "Tu pago ha fallado, actualiza tu tarjeta".
4. Stripe Smart Retries (3 intentos en 14 días):
   a. Si algún intento pasa → invoice.payment_succeeded → ws.billing.status = 'active', banner desaparece.
   b. Si todos fallan → Stripe lo declara unpaid → customer.subscription.deleted → ws.plan = 'free'.
5. Stripe envía email automático al usuario en cada retry y al cancel final.
```

### 5.6 Pro user hace AI request (camino normal)

```
1. Pro user envía mensaje a Pick.
2. Server: assertWithinQuota.
   - ws.plan === 'pro'.
   - Increment usage/{monthId} → count = 412 (no relevante para gating).
   - 412 < 2000 → OK.
3. Server llama a Gemini, devuelve respuesta.
4. Frontend muestra respuesta. Counter NO se muestra (Pro no lo ve).
```

### 5.7 Dev override (operativa interna)

```
Sergio en su workspace personal:
1. Firebase Console → workspaces/{wsId} → manual edit:
   plan: 'pro'
   planUpdatedAt: <now>
2. assertWithinQuota lee plan === 'pro' → no gating. Una sola ruta de código respetada.
3. Sin webhook, sin Stripe Customer. billing field permanece null.
4. Cuando termine el dogfood, manual edit → plan: 'free'.
```

---

## 6. Migración y lanzamiento

V1 no requiere migración pesada (a diferencia del sub-proyecto 1). El cutover es ligero y puede ejecutarse en horas off-peak sin ventana de mantenimiento.

### 6.1 Pre-deploy

1. **Crear assets en Stripe Dashboard:** Product "Pick Pro", dos Prices (mensual/anual en Volume mode), habilitar Stripe Tax + Invoicing, Smart Retries default, generar webhook signing secret, crear promotion code `DEV100`.
2. **Probar flujo completo en staging** (proyecto Firebase distinto, Stripe test keys, tarjetas `4242...`). Cuentas secundarias para free → upgrade → cancel → past_due → unpaid → downgrade. Smoke checklist documentada en `docs/runbooks/sub-proyecto-5-smoke.md`.

### 6.2 Deploy

3. PRs mergeados según sequencing de la sección 11 (preparación gateable hasta el último PR).
4. Reglas Firestore añaden los matchers para `usage` y `stripeEvents`. Reglas existentes no cambian.
5. `functions/.env` actualizado con las 4 nuevas vars Stripe. Confirmar presencia antes del deploy.
6. `firebase deploy --only hosting,functions,firestore:rules,firestore:indexes --project playoff-creator`.
7. Configurar webhook en Stripe Dashboard apuntando a la URL del Cloud Function `stripeWebhook` desplegada.

### 6.3 Post-deploy

8. `workspaces/{wsId}.plan` ya está a `'free'` para todos los users (lo plantó la migración del sub-proyecto 1). **Ningún backfill.**
9. **Override manual del dev:** Sergio edita su workspace personal vía Firebase Console → `plan: 'pro'`. Inmediato. Sin Stripe.
10. **Smoke en prod:** una cuenta secundaria del dev (no la principal) hace el flujo upgrade real con tarjeta de verdad. Verificar: webhook llega, plan transiciona, factura emitida, portal funciona, cancel funciona. Cancelar en los primeros 14 días para minimizar el coste irrecuperable.
11. **Sin banner de mantenimiento.** El deploy no rompe la app para nadie. Free users siguen usando todo igual hasta que hit el cap por primera vez.

### 6.4 Sin email de aviso a usuarios

Mismo argumento que sub-proyecto 1: la base efectiva son el dev y su pareja. Cualquier comunicación de cambio se hace cara a cara o por WhatsApp.

---

## 7. Operativa interna del dev

Decisión registrada para que la operativa quede explícita y no se olvide entre sesiones:

- **Cuenta personal de Sergio en prod:** `plan: 'pro'` puesto a mano en Firebase Console. La usa para entrenar a Uros sin trabas. Sin Stripe Customer, `billing` permanece `null`. El helper `assertWithinQuota` lo trata como cualquier otro Pro — una sola ruta de código.
- **Antes de cada release con cambios Stripe-related:** una vuelta por staging (proyecto Firebase distinto, Stripe test keys, tarjetas `4242 4242 4242 4242` y `4000 0000 0000 0341` para fail). Cuentas secundarias `serpa+test1@gmail.com`, etc. Smoke checklist completo: free → upgrade → cancel → past_due → unpaid → downgrade.
- **Promotion code `DEV100`** creado en Stripe Dashboard (gratis crear). Sin uso planificado. Plan B por si un colaborador quiere probar Pro en prod sin pagar.

Esta operativa **no debe convertirse en un mecanismo perpetuo de bypass.** Si en algún momento aparece la necesidad de varias cuentas de "comp" para colaboradores estables, escalarlo a una decisión de producto y registrar las cuentas formalmente en Stripe via promotion codes individuales — no añadir lógica de bypass al código.

---

## 8. Testing

### 8.1 Unit tests (Vitest, ya en uso)

- `functions/src/billing/quota.test.ts`:
  - `assertWithinQuota` con plan free, count justo en 50 → OK; count > 50 → throw `resource-exhausted`.
  - `assertWithinQuota` con plan pro, count > PRO_FAIR_USE → log warning pero no throw.
  - Primer mes (doc no existe) → crea con `count: 1`.
  - Incrementos paralelos (10 calls simultáneas) → counter exacto, sin doble-incremento.
  - `currentMonthId()` con dates en límite del mes (último día 23:59 Europe/Madrid vs primer día 00:00).

- `functions/src/billing/webhook.test.ts`:
  - Cada handler con un evento típico → escribe los campos esperados.
  - Event.id duplicado → no-op silencioso.
  - Signature inválida → 400.
  - Evento sin metadata.wsId → log `WEBHOOK_ORPHAN_EVENT`, marca procesado.

- `src/billing/useWorkspaceUsage.test.tsx`, `useWorkspacePlan.test.tsx` con `@testing-library/react`:
  - Hook devuelve count/limit/percentage/isAtCap correctos en cada estado del doc.
  - Cambio de wsId → cambian datos del listener.

### 8.2 Integration con Firestore Emulator

Reglas en `firestore.rules` con tests garantizan:

- Cliente NO puede escribir `workspaces/{wsId}/usage/{monthId}` (todos los métodos: create, update, delete).
- Cliente NO puede leer ni escribir `stripeEvents/{eventId}`.
- Owner sí puede leer su `usage/{monthId}`.
- Miembros no-owner pueden leer `usage` (anticipa multi-rol futuro).

`assertWithinQuota` end-to-end contra emulator: 50 incrementos secuenciales no rompen el doc, el 51 lanza error correcto con detalles esperados.

### 8.3 E2E manual sobre staging

Smoke checklist completa en `docs/runbooks/sub-proyecto-5-smoke.md`:

- [ ] Cuenta nueva → confirmar `plan: 'free'` y counter 0.
- [ ] 50 mensajes a Pick → modal aparece al 51 con el copy correcto y CTA funcional.
- [ ] Click "Hazte Pro" → checkout embedded carga sin error → tarjeta `4242 4242 4242 4242` → callback corre.
- [ ] Verificar webhook llegado en Stripe Dashboard, `workspaces/{wsId}.plan === 'pro'` en Firestore Console, banner de bienvenida en home.
- [ ] 60 mensajes a Pick estando en Pro → counter no aparece, AI sigue funcionando.
- [ ] Click "Gestionar suscripción" → portal Stripe abre → cancel → vuelta a app → counter aún no aparece (cancelAtPeriodEnd, plan sigue 'pro').
- [ ] Stripe Dashboard → forzar end of period → webhook llega → plan vuelve a 'free' → counter aparece de nuevo.
- [ ] Tarjeta que falla intencional `4000 0000 0000 0341` → invoice.payment_failed → banner past_due aparece in-app.
- [ ] Stripe Dashboard → forzar refund/cancel sub → plan a free.
- [ ] `proactiveDailyBriefing` con un workspace en cap free → log `BRIEFING_SKIPPED_QUOTA`, otros workspaces siguen procesándose.
- [ ] Reglas Firestore: intentar escribir `usage/{monthId}` desde cliente → permission denied.
- [ ] Idempotencia: simular reenvío del mismo webhook event.id → solo procesado una vez.

---

## 9. Out of V1

Declarado explícito para evitar scope creep. Cualquiera de estas piezas puede añadirse después sin refactor del core.

- **Pago one-shot pack** ("compra 50 más este mes") — descartado por canibalización del Pro.
- **Multi-plan B2C** (Pro vs Max con feature sets distintos) — heredado del sub-proyecto 0 sec. 7. V1 = un solo Pro.
- **Trial Pro 14/30 días** — descartado en respuestas de brainstorm. Todos arrancan free.
- **Email transaccional propio** — Stripe envía sus emails (factura, payment failed, cancel). No hay email custom desde el producto en V1.
- **Compensación de errores en counter** — increment-before-execution; si Gemini falla mid-call, el counter ya gastó 1. Aceptado V1.
- **Fair-use enforcement duro Pro** — V1 solo logea. Bloqueo real si aparece abuso real.
- **Quotas separadas por tipo de AI** — descartado a favor de quota unificada.
- **Internacionalización Stripe Tax** fuera de España — V1 solo Spain. Stripe Tax soporta el resto, basta con ampliar Dashboard config.
- **B2B / per-seat billing** — sub-proyecto 6.
- **Pricing page pública con comparativa B2C/B2B** — sub-proyecto 7.

---

## 10. Constraints transversales aplicados

Validación contra los 7 del sub-proyecto 0 sección 9, más uno específico de este sub-proyecto:

1. **Una sola ruta de código.** `assertWithinQuota` se invoca en todas las AI calls; no hay branches `if (context === 'personal') / else`. El gating opera contra `ws.plan` que es metadata del workspace.

2. **`plan` field como string libre.** El helper compara `ws.plan === 'pro'` por igualdad, no contra una lista cerrada. Añadir `'max'` mañana es cambiar comparaciones a `if (['pro', 'max'].includes(ws.plan))` o un capability check, sin cambio de tipo.

3. **Stripe Volume mode desde V1.** Ambos Prices (mensual y anual) en Volume mode con un solo tier. Aplicado también a B2C aunque no escale por seats — es coherencia y la opción no tiene coste.

4. **Workspace activo en context.** `useWorkspacePlan` y `useWorkspaceUsage` consumen `wsId` del `WorkspaceContext` ya existente; cambiar de workspace = cambia plan/counter en pantalla sin recargar.

5. **Nada de hardcoding del segmento.** El paywall no asume que el workspace es personal o club. La copy dice "tu workspace", no "tu cuenta personal". En sub-proyecto 6, los workspaces club reutilizarán los mismos hooks y componentes con copy distinta vía prop o context flag, no via fork del componente.

6. **Pick respeta el workspace activo.** El gating opera sobre `workspaces/{activeWsId}.plan`. Si Sergio cambia del personal (Pro) al club (Free), el counter aparece y el paywall aplica.

7. **Permisos cubren reglas Firestore + UI + Pick tools.** Las reglas bloquean writes a `usage`/`stripeEvents` desde cliente. La UI no muestra el botón "Hazte Pro" a no-owners. Los Pick tools (que corren server-side) pasan por el mismo `assertWithinQuota`.

8. **(Específico s5)** **Server-side enforcement obligatorio.** El frontend muestra counter y wall, pero la verdad vive en el backend. Saltarse el frontend (curl directo a la callable function) hit el mismo wall.

---

## 11. Sequencing de PRs

Cada PR mergeable y testeable por separado. Estado funcional preservado en cada paso intermedio.

| PR   | Contenido                                                                                                                                                                                                                                                                                                          | Tests                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| #N   | `functions/src/billing/quota.ts` + `currentMonthId.ts` + Firestore rules para `usage` + integración en `runAgent`/`aiChat`/`proactiveDailyBriefing`. **Sin Stripe todavía.** Como ningún workspace tiene `plan === 'pro'`, todos quedan free. Sergio se pone Pro manual antes del merge para no quedarse sin Pick. | Unit tests del helper + emulator tests de las reglas + E2E del gating en local.                          |
| #N+1 | Frontend: `useWorkspacePlan`, `useWorkspaceUsage`, `UsageCounter`, `QuotaWarningBanner`, `QuotaExceededModal`, error handling unificado en `aiClient`. Aún sin pantalla `/upgrade`.                                                                                                                                | Unit tests de hooks y componentes con `@testing-library/react`.                                          |
| #N+2 | `createCheckoutSession`, `createPortalSession`, `stripeWebhook` Cloud Functions. Reglas para `stripeEvents`. Schema completo de `billing` field en helper de tipos.                                                                                                                                                | Unit + emulator tests del webhook handler con event.id duplicado, signature inválida, eventos huérfanos. |
| #N+3 | Frontend: `UpgradePage` con Embedded Checkout, `UpgradeSuccessPage`, `BillingSection` con portal redirect, `PaymentFailedBanner`. Routing nuevo. Stripe SDK npm-installed.                                                                                                                                         | E2E manual contra staging — la smoke checklist real de la sección 8.3.                                   |
| #N+4 | Polish: copy en voz Pick, micro-animación en counter al incrementar, dark/light theme del paywall, `prefers-reduced-motion` respetado.                                                                                                                                                                             | Visual review + a11y check ligero (landmarks, aria-labels en botones-icono).                             |

PRs #N a #N+2 pueden mergearse sin que ningún usuario note nada (estado preparado, infra latente). **#N+3 es el momento del lanzamiento real** — desde ese deploy, los free users empiezan a ver counter y paywall.

---

## 12. Sucesores

- **Sub-proyecto 6 — Monetización B2B (per-seat).** Reutiliza directamente: `stripeWebhook`, `createCheckoutSession`, `createPortalSession`, `useWorkspacePlan`, `useWorkspaceUsage`, helper `assertWithinQuota`, schema `billing`, idempotencia por `stripeEvents`. Añade: lógica per-seat (suscripción con quantity dinámico, alta/baja de seats con prorrateo), panel del DT para gestionar seats, factura con CIF, gestión IVA B2B. Solo arranca cuando sub-proyecto 4 (vista DT) esté en producción.

- **Sub-proyecto 7 — Marketing público.** Pricing page pública con comparativa Pro B2C vs Pro Club B2B, funnel separado por segmento, página específica "para clubes". Depende de tener precio + producto sólido en ambos lados (5 + 6 cerrados).

- **Mejoras post-V1 ya identificadas** (registradas aquí para no perderlas):
  - Compensación de errores en counter si fail rate Gemini sube.
  - Fair-use cap Pro con bloqueo duro si aparece abuso.
  - Multi-plan B2C (Pro vs Max) cuando haya señal real.
  - Pack one-shot si la conversion rate Free→Pro es baja y el feedback indica fricción de precio.

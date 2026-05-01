# Sub-proyecto 0 — Decisiones fundacionales: cuentas, clubs y monetización

**Fecha:** 2026-05-01
**Estado:** Aprobado, sin implementación propia (es un spec de constitución)
**Autor:** Sergio Paradela (con Claude)
**Sucesor inmediato:** Sub-proyecto 1 — Modelo de cuenta y workspace + migración

---

## 0. Por qué existe este spec

El producto pasa de ser exclusivamente B2C (entrenador individual) a soportar también B2B (clubs con director técnico, coaches con licencia, multi-equipo) **sin perder el segmento B2C**. Esto cambia simultáneamente el modelo de identidad, el modelo de datos, los permisos, el motion comercial y el cobro. Es la transformación más profunda en la vida del proyecto.

Implementarla bien requiere ocho sub-proyectos coordinados. Antes de tocar código, hay que tomar seis decisiones fundacionales que actúan como constitución de todo lo que viene después: si una de estas decisiones se mueve más adelante, casi cualquier sub-proyecto posterior necesita reescritura.

Este documento registra esas seis decisiones, su razón, lo que queda explícitamente fuera de V1, y lo que se difiere a sub-proyectos posteriores. **No tiene plan de implementación propio** — su salida es la constitución sobre la que se diseñan los siguientes.

---

## 1. Decomposition: los ocho sub-proyectos

| #   | Sub-proyecto                                 | Output                                                                                      |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 0   | **Decisiones fundacionales** _(este spec)_   | Constitución del producto. Sin código.                                                      |
| 1   | **Modelo de cuenta y workspace + migración** | Schema nuevo, migración del actual, workspaces personales para todos los usuarios actuales. |
| 2   | **Permisos y scoping**                       | Roles, matriz de accesos, reglas Firestore reescritas.                                      |
| 3   | **Invitaciones y licencias**                 | Flujo DT-invita-coach, asignación a equipos, revocación.                                    |
| 4   | **Vista de Director Técnico**                | Dashboard club-wide, calendario cruzado, materiales compartidos.                            |
| 5   | **Monetización B2C**                         | Paywall de Pick, Stripe checkout, customer portal, gestión de suscripción individual.       |
| 6   | **Monetización B2B**                         | Bundles per-seat, billing del club, panel del DT.                                           |
| 7   | **Marketing público**                        | Pricing page, página _para clubes_, separación del funnel B2C/B2B.                          |

### Dependencias

- **1** bloquea **2, 3, 4, 6**. Sin modelo de cuenta no hay clubs.
- **2** bloquea **3, 4**. Sin permisos no hay invitaciones útiles ni vista DT segura.
- **5** puede salir antes de **2-4**. La infraestructura de Stripe/paywall se reusa para B2B.
- **6** depende de **1 + 5**. La infra de Stripe es la misma; B2B añade billing por seats.
- **7** depende de **5 + 6**. Hasta que no hay precio y producto que comunicar, la pricing page es vapor.

### Orden de implementación acordado (B2C-first)

```
0  Decisiones fundacionales            ← este spec
└─ 1  Modelo de cuenta + migración
    ├─ 5  Monetización B2C             ← ingresos primero, riesgo bajo
    └─ 2  Permisos y scoping
        └─ 3  Invitaciones y licencias
            └─ 4  Vista de Director Técnico
                └─ 6  Monetización B2B
                    └─ 7  Marketing público
```

**Razón de B2C-first dentro del bloque de monetización:** la infraestructura de Stripe (checkout, customer portal, webhooks, gating del paywall) se construye una vez y se reutiliza para B2B. Lanzarla primero a coaches individuales valida willingness-to-pay sobre la base de usuarios actuales, genera primer ingreso y descarga riesgo del lanzamiento B2B (que es operacionalmente más complejo: facturación con CIF, contratos, sales motion).

---

## 2. Identidad y workspaces

### Decisión

**Una cuenta de auth por persona, N memberships en workspaces. Estilo Microsoft 365 / Slack / GitHub.**

- El usuario tiene UNA identidad de Firebase Auth (email + Google OAuth).
- Esa identidad tiene un conjunto de memberships: uno en su workspace personal + N en workspaces de club.
- La UI muestra un context selector arriba: _"Mi cuenta · Uros de Rivas · Estudiantes Cantera"_.
- Mismo email funciona en todos los contextos; cada contexto tiene sus propias reglas y datos.

**Casos cubiertos:**

- Coach en dos clubs distintos.
- Coach con equipo personal + equipo en un club.
- DT que además entrena uno de los equipos del club.
- Migración limpia desde el modelo actual: cada usuario actual obtiene un workspace personal autogenerado en sub-proyecto 1.

**Caso bloqueado intencionadamente:**

- Coach que está en un club no puede crear equipos en el contexto del club. Si quiere equipos propios, los crea en su workspace personal.

### Modelo de datos: workspace como entidad real (A1)

**Todo dato del producto vive bajo `workspaces/{wsId}/...`.** No hay dualidad de schema entre personal y club.

- El workspace personal es un workspace con `type: 'personal'`, único miembro = `owner`.
- Un club es un workspace con `type: 'club'`, N miembros con roles diferenciados.
- Todas las queries, hooks, reglas Firestore y código de Pick operan sobre `workspaces/{activeWsId}/...` sin saber si el contexto es personal o club.

**Razón:** una sola ruta de código. Las features se diseñan una vez y funcionan en ambos contextos por construcción. Convertir un personal en mini-club a futuro es un cambio de metadata (`type: personal → club` + billing nuevo), no una migración de datos. La alternativa (personal en `users/{uid}/...` + clubs en `clubs/{clubId}/...`) duplicaría todo el código en perpetuidad y haría cualquier conversión personal→club una migración entera.

### Implicación para el código existente

`userDocRef(db, appId, uid, collection, docId)` y `userColRef(db, appId, uid, collection)` se reemplazan por `workspaceDocRef(db, appId, wsId, collection, docId)` y `workspaceColRef(db, appId, wsId, collection)` en sub-proyecto 1. El `wsId` activo viene del context selector.

---

## 3. Propiedad de datos

### Principios

1. **Datos del workspace = del workspace.**
   Teams, brackets, calendarSessions, cuaderno completo (jugadores, test-tiro, notas, pilares, normas, asistencia, informe jugadores), biblioteca de ejercicios, competiciones, plantillas de convocatoria, pabellones recurrentes — todo vive bajo `workspaces/{wsId}/...` y pertenece al workspace.

   **Consecuencia operativa:** cuando un coach pierde acceso (revocación o baja del club), todos esos datos se quedan exactamente donde están. El siguiente coach asignado al equipo hereda el cuaderno completo.

2. **Datos del usuario = del usuario, viajan con él.**
   Bajo `users/{uid}/...`: preferencias de UI (theme, idioma), configuración de notificaciones, favoritos personales (ejercicios marcados, vistas guardadas). Estos siguen al usuario aunque cambie de workspace o sea revocado.

3. **Pick history per-user-per-workspace.**
   Conversaciones de Pick viven bajo `users/{uid}/pickHistory/{wsId}/conversations/...`. Pertenecen al usuario (es su historial) pero están scopeadas al workspace porque hablan de datos del workspace. Si el coach pierde acceso al club, su historial de Pick en ese contexto deja de cargarse — el dato queda inerte en su cuenta, sin UI que lo muestre.

4. **Roles aditivos, no exclusivos.**
   Un membership en un workspace tiene un rol de workspace + asignaciones de team:

   ```ts
   {
     role: 'owner' | 'admin-billing' | 'dt' | 'coach',
     assignedTeamIds: string[]
   }
   ```

   Un DT puede tener `assignedTeamIds = ['t1']` y además entrenar t1 — caso real frecuente. Roles concretos y matriz de permisos quedan para sub-proyecto 2.

5. **Auditoría sobrevive a la revocación.**
   Cada documento creado/editado guarda `createdBy: uid`, `createdAt`, `updatedBy`, `updatedAt`. Cuando un coach es revocado, su acceso se corta inmediatamente, pero los registros que escribió siguen ahí con su uid. El display name resuelve desde `users/{uid}` global. El DT verá _"Última nota: Coach X (ya no es miembro)"_.

6. **Billing controla acceso, no propiedad.**
   Si la suscripción del club lapsa, el club pierde acceso al workspace según las reglas de gracia que definamos en sub-proyecto 6. Pero el dato sigue siendo del workspace; restaurando billing se vuelve a abrir.

### Casos límite cubiertos por estos principios

- **Coach asignado a 2 equipos pierde acceso a 1**: la `assignedTeamIds` del membership se reduce. Acceso al otro equipo intacto. Historial de Pick referido al equipo perdido queda inerte.
- **DT se va del club**: el club queda sin DT — el `owner` del workspace tiene que reasignar el rol a otra persona. Si el DT ERA el owner, hay que designar un nuevo owner antes de poder revocar (flujo concreto: sub-proyecto 2).
- **Coach hace una edición y al día siguiente lo revocan**: la edición sobrevive, queda atribuida a su uid, próximo coach la ve en el cuaderno como dato heredado.
- **Coach está en dos clubs distintos**: dos memberships separados, dos historiales de Pick aislados, datos del workspace A invisibles desde el contexto B.

---

## 4. Monetización B2C: free + Pro

### Decisión: F2 — free con quota mensual, Pro ilimitado

- **Free**: todo lo de la app (cuaderno, calendario, brackets manuales, biblioteca, convocatorias con plantilla manual, exports, ayuda) **+ una quota mensual de IA**. Cifras concretas en sub-proyecto 5; orden de magnitud orientativo: ~50 mensajes a Pick + ~3 bracket parses + ~10 sugerencias de calendario AI. Reset el día 1 de cada mes.
- **Pro**: todo ilimitado, con fair-use cap altísimo (orientativo: ~5.000 msgs/mes — más que cualquier humano usaría).

### Razón

Tu apuesta estratégica declarada es Pick. Si los free users **nunca experimentan Pick**, la conversión depende 100% de marketing externo. Si lo experimentan con quota, la conversión depende del producto — el usuario hit el quota habiendo ya valorado la herramienta. Mayor conversion rate esperada.

El coste de tokens en free tier (~€0.50–€1.50/free-user activo/mes) es asumible y se compensa por el efecto de conversion. Cae conceptualmente en el presupuesto de marketing-disfrazado-de-producto.

### Suscripción per-workspace, no per-user

- En el espacio personal: el usuario paga su propia suscripción Pro (B2C).
- En un workspace de club: el club paga la suscripción del workspace entero (B2B, sub-proyecto 6).
- Un coach que es Pro en su personal pero está en un club Free **no tiene Pick** en el contexto del club. Y al revés.
- Permite combinaciones reales tipo _"usuario con Pro personal y Max via club"_ sin colisión.
- Encaja con quién consume los tokens y quién debería pagarlos.

### Schema de plan

```ts
workspaces/{wsId} {
  plan: 'free' | 'pro' | 'max' | ...,    // string para futuros tiers
  ...
}
```

`plan` es string libre por diseño. V1 solo usa `'free'` y `'pro'`; añadir `'max'` o `'enterprise'` más adelante es agregar valores válidos, no cambio de tipo.

### Decisiones diferidas

- Quotas concretas (¿50 msgs Pick? ¿100? ¿3 bracket parses o 5?): sub-proyecto 5.
- Precio €X/mes de Pro: sub-proyecto 5.
- Estrategia exacta de gating en código (un check por feature, helper centralizado, etc.): sub-proyecto 5.
- Multi-plan B2C (Pro vs Max con feature sets distintos): pospuesto hasta haber señal real.

---

## 5. Monetización B2B: per-seat

### Decisión: B1 — per-seat puro, todos los seats pagan, sin mínimo

- €X / seat activo / mes. Club con 12 coaches activos paga 12×€X.
- **Seat activo = todo miembro del workspace**, incluyendo DT, admin-billing y coach. No hay seats free por rol.
- El DT añade/quita seats cuando quiera; Stripe prorratea automáticamente.
- Sin mínimo de seats. Un club de 1 coach + 1 DT (2 seats) puede entrar a B2B si quiere la funcionalidad de DT view aunque sea minúsculo.

### Razón

- Escala lineal, sin techos frustrantes.
- Patrón estándar B2B SaaS (Slack, Notion, Linear); los compradores lo entienden sin explicación.
- Evita gaming (alguien crea un club fake con un seat para acceder gratis a feature B2B).
- Si hace falta gesto comercial, mejor un descuento del primer mes que un seat gratis perpetuo.

### Constraint crítica: Volume mode preparado

- **Stripe Price en modo Volume** desde V1, con un solo tramo de precio.
- Añadir tramos adicionales más adelante (e.g., `1-10: €X`, `11-30: €0,85·X`, `31+: €0,70·X`) es un cambio de configuración del Price en Stripe, **no un cambio de código de la app**.
- El campo del workspace que registra el plan permite múltiples nombres de plan (string libre).
- Ningún componente de la app codifica un precio o un rango.

### Decisiones diferidas

- Precio €/seat concreto: sub-proyecto 6.
- Umbrales de descuento por volumen y cuándo activarlos: post-V1, cuando aparezca el primer cliente >15 seats que lo pida.
- Múltiples tiers B2B (Plus / Business / Enterprise con feature sets distintos): pospuesto hasta haber señal real. V1 = un solo tier B2B _Pro Club_.
- Manejo de IVA / CIF / facturas españolas: sub-proyecto 6.

---

## 6. Migración

### Estrategia: M1 + D1

**M1 — Big-bang en ventana de mantenimiento.**

1. Backup completo de Firestore (export) antes de migrar.
2. Domingo de madrugada (~04:00 hora España): deploy con app en read-only banner.
3. Script de migración idempotente itera todos los usuarios actuales, copia `artifacts/{appId}/users/{uid}/...` a `artifacts/{appId}/workspaces/{newWsId}/...` (con `newWsId` = id autogenerado, `type: 'personal'`, único miembro = uid con `role: 'owner'`).
4. Verificación automática: para cada usuario, contar docs en old path vs new path; debe coincidir.
5. Smoke tests sobre 3-5 cuentas reales: login, ver teams, ver cuaderno, abrir Pick.
6. Deploy de cutover: lectura desde new paths, banner removido.

**D1 — Datos antiguos retenidos 30 días.**

- Tras cutover, los datos en `users/{uid}/teams/...` quedan inertes pero presentes.
- 30 días después, una Cloud Function de cleanup los borra.
- Es la red de seguridad si aparece un bug en la nueva ruta. Coste de almacenamiento despreciable.

### Mitigaciones obligatorias

- Backup pre-migración (Firestore export a Cloud Storage).
- Script idempotente: re-ejecutarlo sobre datos ya migrados es no-op.
- Dry-run en proyecto Firebase de staging con copia de datos producción.
- Smoke tests sobre cuentas reales tras cutover, antes de quitar el banner.
- Plan de rollback documentado: si algo falla, los datos antiguos siguen ahí intactos por 30 días.

### Sin comunicación email

Base de usuarios actual = el dev y conocidos. No se manda email de aviso ni nota pública.

### Usuarios nuevos durante el deploy de sub-proyecto 1

- Al firmarse, el flujo de onboarding crea `workspaces/{newWsId}` (type personal, owner = uid) automáticamente.
- El usuario no nota nada distinto: aterriza en su workspace personal y empieza a usar la app.

### Sequencing

- **Sub-proyecto 1** deploya solo el cambio de modelo + creación de workspace personal para todos los usuarios actuales.
- Los **clubs no están disponibles aún** tras sub-proyecto 1. Aparecen cuando sub-proyecto 4 (vista DT) está en producción.
- Reglas Firestore reescritas en el mismo deploy de cutover de sub-proyecto 1, con tests sobre Firestore Emulator garantizando que las reglas nuevas otorgan exactamente los accesos esperados.

---

## 7. Out of V1 (declarado explícitamente)

Lo siguiente NO entra en V1 de la transformación. Cualquiera de estas piezas se puede añadir más adelante como feature aditiva sobre el modelo nuevo, sin refactor del core.

- **Mover/copiar datos entre workspaces** (donar team personal a club, exportar biblioteca, mover bracket entre workspaces).
- **Contenido privado del coach dentro de un team del club** (e.g., una nota que solo ve quien la escribe). Por defecto: si tienes acceso al team, ves todo el cuaderno del team.
- **Multi-plan B2C** (Pro vs Max con feature sets distintos). V1 lanza con un solo plan Pro.
- **Múltiples tiers B2B** (Plus / Business / Enterprise con feature sets distintos). V1 = un solo tier B2B.
- **Descuentos por volumen B2B**. Estructura preparada (Stripe Volume mode), activación pospuesta.
- **Anonimización de auditoría tras cancelación de cuenta del usuario**. Territorio GDPR; se aborda cuando legalmente aplique.
- **Comunicación email de la migración**. Base de usuarios no lo justifica.

---

## 8. Decisiones diferidas a sub-proyectos posteriores

| Decisión                                                                      | Sub-proyecto que la cierra |
| ----------------------------------------------------------------------------- | -------------------------- |
| Esquema concreto de `workspaces/{wsId}` (campos, subcolecciones, índices)     | 1                          |
| Path migration concreto (cómo se mueve cada subcolección, helper functions)   | 1                          |
| Estructura del context selector en la UI                                      | 1                          |
| Matriz exacta de permisos por rol (qué puede leer/escribir cada uno)          | 2                          |
| Reglas Firestore detalladas                                                   | 2 (preliminares en 1)      |
| Pick gating por rol (qué tools puede invocar cada rol)                        | 2                          |
| Flujo de invitaciones (email link, token, expiración, claim, error states)    | 3                          |
| Layout de la vista DT (qué se ve, qué se gestiona, KPIs club-wide)            | 4                          |
| Materiales compartidos club-wide (biblioteca de ejercicios shared, playbooks) | 4                          |
| Quotas concretas Pick / bracket parser / calendar AI / etc.                   | 5                          |
| Precio €/mes B2C Pro                                                          | 5                          |
| Stripe checkout flow, customer portal, webhooks, gating en código             | 5                          |
| IVA / facturas / cumplimiento Spain B2C                                       | 5                          |
| Precio €/seat B2B y umbrales de volumen futuros                               | 6                          |
| Stripe billing per-seat, panel del DT, alta/baja de seats                     | 6                          |
| IVA / CIF / facturas Spain B2B                                                | 6                          |
| Pricing page pública, tono comparativo, casos B2B                             | 7                          |
| Funnel separado B2C vs B2B en la landing                                      | 7                          |

---

## 9. Constraints transversales

Estas reglas aplican a todos los sub-proyectos siguientes y deben respetarse al diseñar cada uno.

1. **Una sola ruta de código.** Nada de `if (context === 'personal') { ... } else { ... }` repetido por toda la app. La diferencia entre personal y club vive en metadatos del workspace y en la matriz de permisos, no en branches de código.

2. **Plan field como string libre.** Ningún componente codifica una lista cerrada de planes. Comparaciones siempre por igualdad o por capability check ("¿este plan permite X?"), nunca por enum hardcodeado.

3. **Stripe Volume mode desde V1.** El Stripe Price para B2B se crea en modo Volume aunque solo tenga un tramo. Añadir tramos es config en Stripe, no código.

4. **Workspace activo en context.** El `wsId` activo se inyecta una vez al top de la app (FirebaseProvider o similar) y todas las queries/hooks lo leen de ahí. Cambiar de workspace = cambiar el context value, no recargar la app.

5. **Nada de hardcoding del segmento.** No hay strings tipo `"Equipo personal"` ni `"Club"` regados por la UI. El display de un workspace viene del campo `name` del workspace (`"Mi cuenta"` para personal, `"Uros de Rivas"` para club).

6. **Pick respeta el workspace activo.** Pick siempre opera sobre `workspaces/{activeWsId}/...` para leer y escribir datos del producto. Nunca puede acceder a datos de otro workspace, ni siquiera del personal del usuario, salvo navegación explícita por el context selector. Excepción explícita: el historial de la conversación bajo `users/{uid}/pickHistory/{wsId}/...` es metadata del usuario, no dato del workspace, y se rige por la regla de "datos del usuario viajan con él".

7. **Permisos cubren reglas Firestore + UI + Pick tools.** Los tres canales aplican la misma matriz. Una operación denegada por reglas Firestore también está oculta en la UI y bloqueada en los tools de Pick.

---

## 10. Sucesores

El siguiente paso es brainstormear **sub-proyecto 1 — Modelo de cuenta y workspace + migración**. Ese spec definirá:

- Schema concreto de `workspaces/{wsId}` con todos los campos y subcolecciones.
- Helpers de path (`workspaceDocRef`, `workspaceColRef`).
- Estructura del context selector en la UI.
- Algoritmo de migración paso a paso, idempotente.
- Reglas Firestore preliminares (las definitivas vienen en sub-proyecto 2).
- Estrategia de testing: unit, integration con Firestore Emulator, smoke manual.
- Orden de PRs dentro del sub-proyecto.

Entre este spec y el de sub-proyecto 1: brainstorming dedicado, no salto directo a writing-plans.

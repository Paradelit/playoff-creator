# Sub-proyecto 5 — Smoke checklist B2C paywall

Ejecutar antes de cualquier cambio Stripe-related en prod. Stripe está configurado en **Test Mode** durante el periodo de validación (PR #3 deploy 2026-05-03), así que las pruebas se hacen en prod con tarjetas de test sin gasto real. Cuando el producto esté validado y se rote a Live Mode (cambio de los 4 secrets en Secret Manager + 3 GitHub repo secrets), este runbook se vuelve "operación en caliente" y conviene desplegar primero a staging.

Tarjetas de test relevantes:

- `4242 4242 4242 4242` — pago exitoso
- `4000 0000 0000 0341` — succeeds en checkout, falla en renovación → `invoice.payment_failed`
- `4000 0025 0000 3155` — requiere 3DS

Promo code disponible en Test Mode: **`DEV100`** (100% off, forever).

---

## Camino feliz: Free → Pro → Cancel

- [ ] **Cuenta nueva** (`serpa+test1@gmail.com` o similar) → registrar, confirmar `plan: 'free'` y counter `0/50` visible en home (`UsageCounter` en header).
- [ ] **50 mensajes a Pick** rapid-fire → counter avanza 0→50, sin errores.
- [ ] **Banner amarillo** aparece desde 40/50 con CTA "Hazte Pro" (`QuotaWarningBanner`).
- [ ] **Mensaje 51** → modal `QuotaExceededModal` aparece: copy "Has llegado a tu cap mensual" + botones "Vuelvo el día 1" / "Hazte Pro".
- [ ] **Click "Hazte Pro"** → `/upgrade` carga, embedded checkout aparece tras spinner.
- [ ] **Toggle mensual/anual** funciona, embedded checkout se rehidrata con el price correcto.
- [ ] **Tarjeta `4242 4242 4242 4242`**, fecha futura, CVC `123`, NIF opcional → confirmar.
- [ ] **Redirect a `/upgrade/success`** → spinner → redirect a `/area-privada?upgraded=true`.
- [ ] **Verificar en Firestore Console**: `artifacts/uros-fbm-app/workspaces/<wsId>.plan === 'pro'` y `billing.status === 'active'`, `billing.stripeCustomerId` y `billing.stripeSubscriptionId` poblados.
- [ ] **Verificar en Stripe Dashboard**: subscription activa, customer creado con metadata `{wsId, appId, uid}`, factura emitida (con IVA 21% si Stripe Tax está activo).
- [ ] **60 mensajes a Pick estando Pro** → counter no aparece, sin gating.
- [ ] **Ajustes → "Plan y suscripción" → "Gestionar suscripción"** → portal Stripe abre en la misma pestaña, vuelve al ajustes al cerrar.
- [ ] **Cancel subscription** en portal → vuelta a app → `BillingSection` muestra "Pro · activo hasta DD/MM/YYYY".
- [ ] **Stripe Dashboard → forzar end of period** (Customer → subscription → cancel immediately) → verificar webhook → `plan` vuelve a `'free'` → counter aparece de nuevo.

## Caminos de error

- [ ] **Tarjeta `4000 0000 0000 0341`** → checkout completa, primer pago OK, en renovación falla → webhook `invoice.payment_failed` → banner rojo `PaymentFailedBanner` aparece arriba en todas las pantallas privadas.
- [ ] **Banner muestra botón "Actualizar tarjeta" solo al owner** del workspace.
- [ ] **Click "Actualizar tarjeta"** → portal Stripe abre.
- [ ] **Stripe Dashboard → cancel subscription manualmente** → plan vuelve a free, banner desaparece.
- [ ] **Webhook duplicado** (Stripe Dashboard → Resend webhook event) → `artifacts/uros-fbm-app/stripeEvents/<eventId>` solo se crea una vez, handler no corre dos veces (verificar via logs).

## Reglas Firestore

- [ ] **Cliente intenta escribir `usage/2026-05`** → permission denied (verificar via Firestore rules emulator o devtools network tab).
- [ ] **Cliente intenta leer `stripeEvents/...`** → permission denied.
- [ ] **Owner puede leer su `workspaces/<wsId>`** → OK.

## Proactive engine

- [ ] **Workspace en cap free** → `proactiveDailyBriefing` no genera notif para esa cuenta, log `BRIEFING_SKIPPED_QUOTA`.
- [ ] **Otros workspaces** siguen procesándose en el mismo run.

## Promo code

- [ ] **Aplicar `DEV100`** en checkout → total €0,00 → checkout completa sin tarjeta real (Stripe pide tarjeta igualmente para suscripción de €0).
- [ ] **Comprobar que `subscription_data.metadata` viaja correctamente** (wsId/appId visibles en webhook).

## Switch a Live Mode

Cuando se decida lanzar de verdad:

1. En Stripe Dashboard → switch a Live Mode → crear producto + 2 prices Live.
2. En Stripe Dashboard Live → Webhooks → crear endpoint `https://europe-west1-playoff-creator.cloudfunctions.net/stripeWebhook` con los 5 events (checkout.session.completed, customer.subscription.updated/deleted, invoice.payment_succeeded/failed).
3. Rotar secrets backend:
   ```bash
   firebase functions:secrets:set STRIPE_SECRET_KEY
   firebase functions:secrets:set STRIPE_WEBHOOK_SIGNING_SECRET
   firebase functions:secrets:set STRIPE_PRICE_MONTHLY
   firebase functions:secrets:set STRIPE_PRICE_ANNUAL
   firebase deploy --only functions
   ```
4. Rotar GitHub repo secrets:
   ```bash
   gh secret set VITE_STRIPE_PUBLISHABLE_KEY --repo Paradelit/playoff-creator
   gh secret set VITE_STRIPE_PRICE_MONTHLY --repo Paradelit/playoff-creator
   gh secret set VITE_STRIPE_PRICE_ANNUAL --repo Paradelit/playoff-creator
   git push origin main  # trigger CI build with new VITE_STRIPE_*
   ```
5. Re-ejecutar este runbook entero con tarjeta real en una cuenta secundaria; cancelar antes de 14 días.

## Rollback plan

Si aparece bug crítico tras lanzar:

1. Comentar el gating en el header del `aiChat` y `runAgent` (cambiar `await assertWithinQuota(...)` a `// await assertWithinQuota(...)`).
2. Redeploy functions: `firebase deploy --only functions:aiChat,functions:runAgent`.
3. Investigar offline. Los datos de `usage` siguen ahí intactos para retomarlo.
4. Para rollback total del paywall: revertir merge del PR de sub-proyecto 5 y redeploy hosting + functions.

# Sub-proyecto 5 — Monetización B2C: paywall + Stripe checkout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar paywall B2C de Pick&Coach — gating unificado de IA contra quota mensual (50/mes free, ilimitado Pro), Stripe Embedded Checkout para Free→Pro, Hosted Customer Portal para gestión, webhook idempotente, UX completa con counter visible, modal del wall, banner de pago fallido.

**Architecture:** Backend añade helper `assertWithinQuota` invocado al inicio de cada AI call (`runAgent`, `aiChat`, `proactiveEngine`). Counter en subdoc `workspaces/{wsId}/usage/{YYYY-MM}` con increment atómico vía transacción. Tres Cloud Functions Stripe (`createCheckoutSession`, `createPortalSession`, `stripeWebhook`) con idempotencia por event.id. Frontend hooks (`useWorkspacePlan`, `useWorkspaceUsage`) suscriben listeners Firestore; componentes Pick-voice montan en HomeScreen y AppRouter. Embedded Checkout en `/upgrade`, Billing Portal vía redirect.

**Tech Stack:** Firebase Functions v2 (TypeScript), Firebase Firestore, Stripe SDK (`stripe` Node + `@stripe/stripe-js` + `@stripe/react-stripe-js` para Embedded Checkout), React 19 + Vite, Vitest, `@firebase/rules-unit-testing` para reglas.

**Spec:** `docs/superpowers/specs/2026-05-03-sub-proyecto-5-monetizacion-b2c-design.md`

---

## File Structure

### Nuevos archivos backend

```
functions/src/billing/
├── constants.ts                          # FREE_QUOTA, PRO_FAIR_USE
├── currentMonthId.ts                     # Intl.DateTimeFormat helper para 'YYYY-MM' Europe/Madrid
├── currentMonthId.test.ts
├── types.ts                              # WorkspaceBilling, UsageData, QuotaResult, StripeEventDoc
├── usage.ts                              # incrementUsage transaction
├── usage.test.ts
├── quota.ts                              # assertWithinQuota
├── quota.test.ts
├── stripeClient.ts                       # Stripe SDK init from env vars
├── createCheckoutSession.ts              # onCall handler
├── createCheckoutSession.test.ts
├── createPortalSession.ts                # onCall handler
├── createPortalSession.test.ts
├── webhook.ts                            # onRequest dispatcher + signature + idempotency
├── webhook.test.ts
└── handlers/
    ├── checkoutCompleted.ts
    ├── checkoutCompleted.test.ts
    ├── subscriptionUpdated.ts
    ├── subscriptionUpdated.test.ts
    ├── subscriptionDeleted.ts
    ├── subscriptionDeleted.test.ts
    ├── invoicePaymentSucceeded.ts
    ├── invoicePaymentSucceeded.test.ts
    ├── invoicePaymentFailed.ts
    └── invoicePaymentFailed.test.ts
```

### Backend modificado

- `functions/src/index.ts` — añadir 3 exports (`createCheckoutSession`, `createPortalSession`, `stripeWebhook`); inyectar `assertWithinQuota` en `runAgent` y `aiChat`.
- `functions/src/proactiveEngine.ts` — invocar `assertWithinQuota` por workspace, contabilizar `BRIEFING_SKIPPED_QUOTA` en el resultado.
- `functions/.env` — añadir `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SIGNING_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`.
- `functions/package.json` — añadir dep `stripe`.
- `firestore.rules` — añadir matchers para `workspaces/{wsId}/usage/{monthId}` y `stripeEvents/{eventId}`, excluir `usage` del wildcard de subcolecciones.
- `firestore.rules.test.ts` — añadir tests para los nuevos matchers.

### Nuevos archivos frontend

```
src/billing/
├── constants.ts                          # mirror del backend (FREE_QUOTA = 50)
├── types.ts                              # mirror tipos
├── currentMonthId.ts                     # mirror del backend, mismo algoritmo
├── currentMonthId.test.ts
├── eventBus.ts                           # bus simple para 'quota-exceeded' (si no existe)
├── useWorkspacePlan.ts
├── useWorkspacePlan.test.tsx
├── useWorkspaceUsage.ts
├── useWorkspaceUsage.test.tsx
└── components/
    ├── UsageCounter.jsx
    ├── UsageCounter.test.jsx
    ├── QuotaWarningBanner.jsx
    ├── QuotaExceededModal.jsx
    ├── PaymentFailedBanner.jsx
    ├── UpgradePage.jsx
    ├── UpgradeSuccessPage.jsx
    └── BillingSection.jsx
```

### Frontend modificado

- `src/services/aiClient.ts` — interceptar `HttpsError('resource-exhausted')` y emitir `quota-exceeded` en eventBus.
- `src/AppRouter.jsx` — añadir rutas `/upgrade` y `/upgrade/success`.
- `src/shell/AppShell.jsx` — montar `PaymentFailedBanner` y `QuotaExceededModal` global.
- `src/screens/HomeScreen.jsx` (o equivalente) — `UsageCounter` en header, `QuotaWarningBanner` en top, `BillingSection` en settings drawer.
- `package.json` — añadir deps `@stripe/stripe-js` y `@stripe/react-stripe-js`.

### Nuevas docs

- `docs/runbooks/sub-proyecto-5-smoke.md` — smoke checklist E2E manual.

---

## Setup

### Task 0: Crear rama de trabajo

**Files:** ninguno tocado, solo git.

- [ ] **Step 1: Crear rama `feat/sub-proyecto-5-paywall` desde main actualizado**

```bash
git checkout main
git pull origin main      # asegurar up to date
git checkout -b feat/sub-proyecto-5-paywall
```

Expected: branch creada, working tree clean.

- [ ] **Step 2: Verificar que main mergeado contiene workspaces foundation**

```bash
grep -q "isWorkspaceMember" firestore.rules && echo "OK rules" || echo "FAIL"
test -f src/contexts/WorkspaceContext.jsx && echo "OK WorkspaceContext" || echo "FAIL"
test -f functions/src/auth/onUserCreate.ts && echo "OK onUserCreate" || echo "FAIL"
```

Expected: tres "OK". Si alguna falla, parar — la base no es correcta.

---

## PR #1 — Backend gating (sin Stripe)

Tras este PR, ningún workspace tiene `plan === 'pro'` aún (excepto el de Sergio puesto a mano). Free users hit el cap a las 50 acciones; runAgent/aiChat/proactiveEngine devuelven `resource-exhausted`. UI no muestra nada todavía (eso es PR #2) — los users ven solo el error genérico hasta que PR #2 mergee.

### Task 1: Constants y tipos compartidos backend

**Files:**

- Create: `functions/src/billing/constants.ts`
- Create: `functions/src/billing/types.ts`

- [ ] **Step 1: Crear constants**

```ts
// functions/src/billing/constants.ts
/**
 * Cuotas mensuales del modelo de monetización B2C.
 * Mismo valor en backend y frontend (frontend tiene mirror en src/billing/constants.ts).
 */
export const FREE_QUOTA = 50;
export const PRO_FAIR_USE = 2000;
```

- [ ] **Step 2: Crear tipos**

```ts
// functions/src/billing/types.ts
import type { Timestamp } from 'firebase-admin/firestore';

export type WorkspacePlan = 'free' | 'pro';

export type SubscriptionStatus = 'active' | 'past_due' | 'unpaid' | 'canceled' | 'trialing';

export interface WorkspaceBilling {
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Timestamp | null;
  priceId: string | null;
  lastEventAt: Timestamp;
}

export interface UsageData {
  count: number;
  lastIncrementAt: Timestamp;
  monthId: string;
}

export interface QuotaResult {
  count: number;
  monthId: string;
}

export interface StripeEventDoc {
  type: string;
  processedAt: Timestamp;
  wsId: string | null;
}
```

- [ ] **Step 3: Commit**

```bash
git add functions/src/billing/constants.ts functions/src/billing/types.ts
git commit -m "feat(billing): add quota constants and types"
```

---

### Task 2: currentMonthId helper con tests

**Files:**

- Create: `functions/src/billing/currentMonthId.ts`
- Create: `functions/src/billing/currentMonthId.test.ts`

- [ ] **Step 1: Escribir tests primero (failing)**

```ts
// functions/src/billing/currentMonthId.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { currentMonthId } from './currentMonthId';

describe('currentMonthId', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'YYYY-MM' format", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    expect(currentMonthId()).toBe('2026-05');
  });

  it('uses Europe/Madrid timezone — last second of month UTC is still that month in Madrid (+1h CEST)', () => {
    vi.useFakeTimers();
    // 2026-05-31T23:30:00Z → 2026-06-01T01:30 Madrid (CEST = UTC+2 in summer)
    vi.setSystemTime(new Date('2026-05-31T23:30:00Z'));
    expect(currentMonthId()).toBe('2026-06');
  });

  it('rolls over correctly at Madrid midnight on day 1', () => {
    vi.useFakeTimers();
    // 2026-04-30T22:30:00Z → 2026-05-01T00:30 Madrid
    vi.setSystemTime(new Date('2026-04-30T22:30:00Z'));
    expect(currentMonthId()).toBe('2026-05');
  });

  it('pads single-digit months with zero', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    expect(currentMonthId()).toBe('2026-01');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd functions && npx vitest run src/billing/currentMonthId.test.ts
```

Expected: FAIL with "Cannot find module './currentMonthId'".

- [ ] **Step 3: Implementar**

```ts
// functions/src/billing/currentMonthId.ts
/**
 * Returns the current month id in 'YYYY-MM' format,
 * computed in Europe/Madrid timezone so monthly quotas reset at local midnight.
 *
 * Used by both the increment logic and the client to compute the same id.
 */
export function currentMonthId(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  return `${year}-${month}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd functions && npx vitest run src/billing/currentMonthId.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add functions/src/billing/currentMonthId.ts functions/src/billing/currentMonthId.test.ts
git commit -m "feat(billing): currentMonthId helper in Europe/Madrid"
```

---

### Task 3: incrementUsage transaction con tests

**Files:**

- Create: `functions/src/billing/usage.ts`
- Create: `functions/src/billing/usage.test.ts`

- [ ] **Step 1: Escribir tests primero**

```ts
// functions/src/billing/usage.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { incrementUsage } from './usage';

let testEnv: RulesTestEnvironment;
const APP_ID = 'test-app';
const WS_ID = 'ws-1';
const MONTH_ID = '2026-05';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'test-project',
    firestore: { host: 'localhost', port: 8080 },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('incrementUsage', () => {
  it('creates the doc with count=1 on first call', async () => {
    const ctx = testEnv.unauthenticatedContext();
    // unauthenticatedContext bypasses rules for setup; we simulate Admin SDK
    const db = ctx.firestore();
    const result = await incrementUsage(db as any, APP_ID, WS_ID, MONTH_ID);
    expect(result.count).toBe(1);

    const snap = await db.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/usage/${MONTH_ID}`).get();
    expect(snap.data()?.count).toBe(1);
    expect(snap.data()?.monthId).toBe(MONTH_ID);
  });

  it('increments existing doc atomically', async () => {
    const ctx = testEnv.unauthenticatedContext();
    const db = ctx.firestore();
    await incrementUsage(db as any, APP_ID, WS_ID, MONTH_ID);
    await incrementUsage(db as any, APP_ID, WS_ID, MONTH_ID);
    const result = await incrementUsage(db as any, APP_ID, WS_ID, MONTH_ID);
    expect(result.count).toBe(3);
  });

  it('uses different docs for different months', async () => {
    const ctx = testEnv.unauthenticatedContext();
    const db = ctx.firestore();
    await incrementUsage(db as any, APP_ID, WS_ID, '2026-04');
    const result = await incrementUsage(db as any, APP_ID, WS_ID, '2026-05');
    expect(result.count).toBe(1);

    const aprilSnap = await db.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/usage/2026-04`).get();
    expect(aprilSnap.data()?.count).toBe(1);
  });
});
```

Crear `vitest.firestore.config.ts` en `functions/` si no existe:

```ts
// functions/vitest.firestore.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/billing/usage.test.ts'],
    testTimeout: 30000,
  },
});
```

Y un script en `functions/package.json`:

```json
"test:firestore": "firebase emulators:exec --only firestore 'vitest run --config vitest.firestore.config.ts'"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd functions && npm run test:firestore
```

Expected: FAIL with "Cannot find module './usage'".

- [ ] **Step 3: Implementar**

```ts
// functions/src/billing/usage.ts
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import type { QuotaResult } from './types';

/**
 * Atomically increment the usage counter for a workspace in a given month.
 * Creates the doc with `count: 1` if it doesn't exist; otherwise increments.
 *
 * Runs inside a Firestore transaction to avoid race conditions when
 * multiple AI calls fire concurrently for the same workspace.
 */
export async function incrementUsage(
  db: Firestore,
  appId: string,
  wsId: string,
  monthId: string,
): Promise<QuotaResult> {
  const ref = db.doc(`artifacts/${appId}/workspaces/${wsId}/usage/${monthId}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, {
        count: 1,
        lastIncrementAt: FieldValue.serverTimestamp(),
        monthId,
      });
      return { count: 1, monthId };
    }
    const next = (snap.data()?.count ?? 0) + 1;
    tx.update(ref, {
      count: FieldValue.increment(1),
      lastIncrementAt: FieldValue.serverTimestamp(),
    });
    return { count: next, monthId };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd functions && npm run test:firestore
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add functions/src/billing/usage.ts functions/src/billing/usage.test.ts functions/vitest.firestore.config.ts functions/package.json
git commit -m "feat(billing): incrementUsage transaction"
```

---

### Task 4: assertWithinQuota helper con tests

**Files:**

- Create: `functions/src/billing/quota.ts`
- Create: `functions/src/billing/quota.test.ts`

- [ ] **Step 1: Escribir tests primero**

```ts
// functions/src/billing/quota.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { assertWithinQuota } from './quota';
import { HttpsError } from 'firebase-functions/v2/https';

let testEnv: RulesTestEnvironment;
const APP_ID = 'test-app';
const WS_ID = 'ws-1';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'test-project',
    firestore: { host: 'localhost', port: 8080 },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
});

async function setupWorkspace(plan: 'free' | 'pro') {
  const db = testEnv.unauthenticatedContext().firestore();
  await db.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}`).set({
    plan,
    ownerId: 'uid-1',
    type: 'personal',
    name: 'Mi cuenta',
  });
  return db;
}

describe('assertWithinQuota', () => {
  it('free plan: passes when count under FREE_QUOTA', async () => {
    const db = await setupWorkspace('free');
    const result = await assertWithinQuota(db as any, { wsId: WS_ID, appId: APP_ID });
    expect(result.count).toBe(1);
  });

  it('free plan: throws resource-exhausted when count exceeds FREE_QUOTA', async () => {
    const db = await setupWorkspace('free');
    // Pre-fill counter to 50 (limit)
    for (let i = 0; i < 50; i++) {
      await assertWithinQuota(db as any, { wsId: WS_ID, appId: APP_ID });
    }
    // 51st call should throw
    await expect(assertWithinQuota(db as any, { wsId: WS_ID, appId: APP_ID })).rejects.toThrow(HttpsError);
  });

  it('free plan: error has details with count, limit, monthId', async () => {
    const db = await setupWorkspace('free');
    for (let i = 0; i < 50; i++) {
      await assertWithinQuota(db as any, { wsId: WS_ID, appId: APP_ID });
    }
    try {
      await assertWithinQuota(db as any, { wsId: WS_ID, appId: APP_ID });
      throw new Error('should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('resource-exhausted');
      expect(err.details).toEqual({
        count: 51,
        limit: 50,
        monthId: '2026-05',
      });
    }
  });

  it('pro plan: never throws even past PRO_FAIR_USE', async () => {
    const db = await setupWorkspace('pro');
    // Simulate counter at 2000 by pre-incrementing the doc directly
    await db
      .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/usage/2026-05`)
      .set({ count: 2000, monthId: '2026-05', lastIncrementAt: new Date() });
    // 2001st call must not throw
    const result = await assertWithinQuota(db as any, { wsId: WS_ID, appId: APP_ID });
    expect(result.count).toBe(2001);
  });

  it('throws not-found when workspace doc does not exist', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await expect(assertWithinQuota(db as any, { wsId: 'missing', appId: APP_ID })).rejects.toThrow(
      /workspace not found/i,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd functions && npm run test:firestore -- src/billing/quota.test.ts
```

Expected: FAIL with "Cannot find module './quota'".

- [ ] **Step 3: Implementar**

```ts
// functions/src/billing/quota.ts
import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { FREE_QUOTA, PRO_FAIR_USE } from './constants';
import { incrementUsage } from './usage';
import { currentMonthId } from './currentMonthId';
import type { QuotaResult, WorkspacePlan } from './types';

interface AssertWithinQuotaArgs {
  wsId: string;
  appId: string;
}

/**
 * Asserts the workspace has remaining quota for an AI call.
 * Always increments the counter (increment-before-execution semantics — see spec sec. 3.4).
 *
 * - Pro plans: never throws, but logs PRO_FAIR_USE_EXCEEDED past the soft cap.
 * - Free plans: throws HttpsError('resource-exhausted', 'QUOTA_EXCEEDED') when count > FREE_QUOTA.
 */
export async function assertWithinQuota(db: Firestore, { wsId, appId }: AssertWithinQuotaArgs): Promise<QuotaResult> {
  const wsSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}`).get();
  if (!wsSnap.exists) {
    throw new HttpsError('not-found', `workspace not found: ${wsId}`);
  }
  const plan = (wsSnap.data()?.plan as WorkspacePlan | undefined) ?? 'free';
  const monthId = currentMonthId();
  const usage = await incrementUsage(db, appId, wsId, monthId);

  if (plan === 'pro') {
    if (usage.count > PRO_FAIR_USE) {
      logger.warn('PRO_FAIR_USE_EXCEEDED', {
        wsId,
        appId,
        count: usage.count,
        monthId,
      });
    }
    return usage;
  }

  if (usage.count > FREE_QUOTA) {
    throw new HttpsError('resource-exhausted', 'QUOTA_EXCEEDED', {
      count: usage.count,
      limit: FREE_QUOTA,
      monthId,
    });
  }
  return usage;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd functions && npm run test:firestore -- src/billing/quota.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add functions/src/billing/quota.ts functions/src/billing/quota.test.ts
git commit -m "feat(billing): assertWithinQuota helper"
```

---

### Task 5: Firestore rules para usage subcolección

**Files:**

- Modify: `firestore.rules` — añadir match específico para `usage` y excluirla del wildcard
- Modify: `firestore.rules.test.ts` — añadir tests del matcher

- [ ] **Step 1: Tests primero (failing)**

Añadir al archivo `firestore.rules.test.ts` (al final, dentro del `describe` principal):

```ts
describe('workspaces/{wsId}/usage/{monthId}', () => {
  it('members can read usage', async () => {
    const aliceContext = testEnv.authenticatedContext('alice');
    // setup: alice is member of ws-1
    await setupWorkspaceWithMember('ws-1', 'alice', 'owner');
    // setup: usage doc exists (write via Admin SDK in setup)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc('artifacts/test-app/workspaces/ws-1/usage/2026-05')
        .set({ count: 5, monthId: '2026-05' });
    });
    // alice can read
    const ref = aliceContext.firestore().doc('artifacts/test-app/workspaces/ws-1/usage/2026-05');
    await assertSucceeds(ref.get());
  });

  it('non-members cannot read usage', async () => {
    const bobContext = testEnv.authenticatedContext('bob');
    await setupWorkspaceWithMember('ws-1', 'alice', 'owner');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc('artifacts/test-app/workspaces/ws-1/usage/2026-05')
        .set({ count: 5, monthId: '2026-05' });
    });
    const ref = bobContext.firestore().doc('artifacts/test-app/workspaces/ws-1/usage/2026-05');
    await assertFails(ref.get());
  });

  it('nobody (not even owner) can write usage from client', async () => {
    const aliceContext = testEnv.authenticatedContext('alice');
    await setupWorkspaceWithMember('ws-1', 'alice', 'owner');
    const ref = aliceContext.firestore().doc('artifacts/test-app/workspaces/ws-1/usage/2026-05');
    await assertFails(ref.set({ count: 1, monthId: '2026-05' }));
    await assertFails(ref.update({ count: 2 }));
    await assertFails(ref.delete());
  });
});
```

(Si el archivo `firestore.rules.test.ts` no expone `setupWorkspaceWithMember`, leer su contenido y reusar el helper existente que cree workspace + members.)

- [ ] **Step 2: Run rules tests to verify failing**

```bash
npx vitest --config vitest.rules.config.js run
```

Expected: 3 fails — el wildcard actual permite write a usage también.

- [ ] **Step 3: Modificar firestore.rules**

Editar el match del workspace (línea ~56-74) para añadir matcher específico de `usage` y excluirla del wildcard:

```firestore
match /artifacts/{appId}/workspaces/{wsId} {
  allow read:   if isSignedIn() && isWorkspaceMember(appId, wsId);
  allow create: if isSignedIn() && request.resource.data.ownerId == request.auth.uid;
  allow update: if isWorkspaceOwner(appId, wsId);
  allow delete: if isWorkspaceOwner(appId, wsId);

  match /members/{memberUid} {
    allow read:                   if isSignedIn() && isWorkspaceMember(appId, wsId);
    allow create, update, delete: if isWorkspaceOwner(appId, wsId);
  }

  // Usage counter — read only for members, writes only via Admin SDK (Cloud Functions).
  match /usage/{monthId} {
    allow read:  if isSignedIn() && isWorkspaceMember(appId, wsId);
    allow write: if false;
  }

  // Wildcard for product subcollections (teams, brackets, calendarSessions, etc.).
  // Excludes `members/` and `usage/` so the more restrictive rules above are not
  // overridden by Firestore's match-OR semantics.
  match /{collection}/{docId=**} {
    allow read, write: if isSignedIn() && isWorkspaceMember(appId, wsId)
      && collection != 'members'
      && collection != 'usage';
  }
}
```

- [ ] **Step 4: Run rules tests to verify they pass**

```bash
npx vitest --config vitest.rules.config.js run
```

Expected: all rules tests pass (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add firestore.rules firestore.rules.test.ts
git commit -m "feat(rules): usage subcoleccion read-only for members"
```

---

### Task 6: Integrar assertWithinQuota en aiChat

**Files:**

- Modify: `functions/src/index.ts` (función `aiChat`, líneas ~172-273)

- [ ] **Step 1: Leer el callsite actual**

```bash
sed -n '172,200p' functions/src/index.ts
```

Identificar el punto exacto de inserción: justo después del check de `auth` y `wsId` válidos, antes de cualquier llamada al sistema.

- [ ] **Step 2: Añadir el import al top de index.ts**

Editar `functions/src/index.ts`, añadir tras la línea `import { getFirestore } from "firebase-admin/firestore";` (~línea 5):

```ts
import { assertWithinQuota } from './billing/quota';
```

- [ ] **Step 3: Añadir el check en aiChat**

Localizar dentro del handler de `aiChat` la línea que extrae `appId`:

```ts
const { message, screenContext, conversationHistory, appId, clientDate, conversationId } = request.data || {};
if (!message) throw new HttpsError('invalid-argument', 'Missing message');
if (!appId) throw new HttpsError('invalid-argument', 'Missing appId');
```

`aiChat` también necesita `wsId`. Verificar si `screenContext` lo incluye o si viene como campo top-level. Leer `aiChat` invocations en frontend (`src/services/aiClient.ts` o `src/hooks/usePick.ts`) para confirmar.

Asumiendo que el cliente envía `wsId` en `request.data.wsId` (post sub-proyecto 1.5 — verificar en código real):

```ts
const { message, screenContext, conversationHistory, appId, wsId, clientDate, conversationId } = request.data || {};
if (!message) throw new HttpsError('invalid-argument', 'Missing message');
if (!appId) throw new HttpsError('invalid-argument', 'Missing appId');
if (!wsId) throw new HttpsError('invalid-argument', 'Missing wsId');

const db = getFirestore();
const userId = request.auth.uid;

// Quota gate — increments counter atomically; throws resource-exhausted when free + over.
await assertWithinQuota(db, { wsId, appId });

// ... resto del handler igual ...
```

(Mover el `getFirestore()` arriba si era de más abajo, para reutilizarlo.)

- [ ] **Step 4: Build verifica typescript**

```bash
cd functions && npm run build
```

Expected: clean compile, sin errores TS.

- [ ] **Step 5: Commit**

```bash
git add functions/src/index.ts
git commit -m "feat(billing): gate aiChat with assertWithinQuota"
```

---

### Task 7: Integrar assertWithinQuota en runAgent

**Files:**

- Modify: `functions/src/index.ts` (función `runAgent`, líneas ~139-169)

- [ ] **Step 1: Modificar runAgent**

Localizar el handler de `runAgent`. El extracto de data actual es:

```ts
const { agent, input, sessionId } = request.data;
```

`runAgent` actualmente no recibe `wsId`/`appId` explícitos en su signature legacy. Al ser legacy, necesitamos añadirlos — pero solo si el cliente los envía. Estrategia: aceptar opcionales y, si no vienen, derivar `appId` por default y `wsId` desde `users/{uid}/memberships` (caso degenerado: si el user no tiene wsId activo, fallar fast).

Cambio mínimo:

```ts
const { agent, input, sessionId, appId, wsId } = request.data;
if (!agent || !input) throw new HttpsError("invalid-argument", "Missing agent or input");
if (!appId) throw new HttpsError("invalid-argument", "Missing appId");
if (!wsId) throw new HttpsError("invalid-argument", "Missing wsId");

const db = getFirestore();

// Quota gate
await assertWithinQuota(db, { wsId, appId });

const system = getSystem();
try {
  return await system.router.routeExplicit(agent, input, { userId: request.auth.uid, sessionId });
}
// ... resto igual ...
```

Si `runAgent` está deprecado y no se llama desde frontend tras sub-proyecto 1.5, este cambio puede ser no-op operativo pero deja el gating en su sitio si vuelve a usarse.

- [ ] **Step 2: Verificar build**

```bash
cd functions && npm run build
```

Expected: clean compile.

- [ ] **Step 3: Verificar grep que aiClient.ts envía wsId**

```bash
grep -n "wsId" src/services/aiClient.ts || echo "MISSING — frontend doesn't send wsId yet"
```

Si dice MISSING: añadir nota en el plan para que la Task 18 (PR #2) garantice que aiClient envíe wsId. Pero no rompemos nada aquí — el gating fallará con `invalid-argument` si no llega, lo cual es loud and clear.

- [ ] **Step 4: Commit**

```bash
git add functions/src/index.ts
git commit -m "feat(billing): gate runAgent with assertWithinQuota"
```

---

### Task 8: Integrar assertWithinQuota en proactiveEngine

**Files:**

- Modify: `functions/src/proactiveEngine.ts`

- [ ] **Step 1: Leer la sección de iteración por workspace**

```bash
grep -n "for.*workspace\|wsId" functions/src/proactiveEngine.ts | head -20
```

(Tras el merge de feat/workspaces-foundation, el engine itera workspaces no users — verificar el patrón exacto.)

- [ ] **Step 2: Modificar el loop por workspace**

Buscar el loop principal (similar a `for (const wsId of activeWsIds)` o equivalente). Antes de la llamada al LLM, insertar:

```ts
import { assertWithinQuota } from './billing/quota';
import { HttpsError } from 'firebase-functions/v2/https';
// ... otros imports ...

// Dentro del loop, antes de `llm.generate`:
try {
  await assertWithinQuota(db, { wsId, appId });
} catch (err) {
  if (err instanceof HttpsError && err.code === 'resource-exhausted') {
    console.warn('[proactiveEngine] BRIEFING_SKIPPED_QUOTA', { wsId, appId });
    skipped++;
    continue;
  }
  throw err;
}
```

`skipped` es un contador ya existente en el `BriefingResult`.

- [ ] **Step 3: Actualizar tests (proactiveEngine.test.ts)**

Si existe `proactiveEngine.test.ts` (sí, viene del merge), añadir test:

```ts
it('skips workspaces over quota and counts them as skipped', async () => {
  // setup: workspace plan=free with usage already at 50
  // setup: workspace has a relevant session
  // expect: result.skipped >= 1, result.notifications == 0 for that ws
});
```

(Detalle del setup depende del helper de test existente — adaptarlo.)

- [ ] **Step 4: Build + tests**

```bash
cd functions && npm run build && npm test
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add functions/src/proactiveEngine.ts functions/src/proactiveEngine.test.ts
git commit -m "feat(billing): proactiveEngine skips workspaces over quota"
```

---

### Task 9: Operativa — Sergio Pro manual antes del deploy

**Files:** ninguno tocado.

- [ ] **Step 1: Identificar el wsId personal de Sergio**

En Firebase Console del proyecto `playoff-creator`:

- Firestore Database → `artifacts/uros-fbm-app/workspaces/`
- Buscar el doc con `ownerId === "<uid de Sergio>"` y `type === "personal"`. Según memoria sub-proyecto 1.5: `lkGym1tHPTgscTBtHySQ`.

- [ ] **Step 2: Editar manualmente el doc**

Desde Firebase Console:

- Doc `workspaces/lkGym1tHPTgscTBtHySQ`
- Field `plan`: `"pro"` (era `"free"`)
- Field `planUpdatedAt`: timestamp actual
- Save

- [ ] **Step 3: Verificar**

Refrescar el doc en Console, confirmar que `plan === "pro"`. Esto es la operativa interna del dev — sin Stripe Customer, sin webhook, sin billing.

(Sin commit. Operativa de Console.)

---

### Task 10: Deploy PR #1

**Files:** ninguno tocado en local.

- [ ] **Step 1: Push branch + PR**

```bash
git push -u origin feat/sub-proyecto-5-paywall
gh pr create --title "feat(billing): backend gating sin Stripe (sub-proyecto 5 PR #1)" --body "$(cat <<'EOF'
## Summary
- assertWithinQuota helper invocado al inicio de aiChat, runAgent y proactiveEngine.
- Counter en `workspaces/{wsId}/usage/{YYYY-MM}` con increment atómico.
- Reglas Firestore: usage subcolección read-only para miembros, write solo Admin SDK.
- Sin integración Stripe todavía (PR #3).

## Test plan
- [ ] Vitest backend pasa: quota.test.ts, usage.test.ts, currentMonthId.test.ts, proactiveEngine.test.ts
- [ ] Vitest reglas pasa: firestore.rules.test.ts (3 tests nuevos)
- [ ] En staging, simular 50 calls a aiChat con cuenta free → 51ª devuelve `resource-exhausted`
- [ ] Workspace con plan="pro" no recibe gating

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Tras merge, deploy**

```bash
firebase deploy --only functions,firestore:rules --project playoff-creator
```

Expected: 7+ functions desplegadas, rules updated. La función deplegada `aiChat` y `runAgent` ahora gatean. `proactiveEngine` también.

- [ ] **Step 3: Smoke en prod (cuenta secundaria)**

- Login con `serpa+test1@gmail.com`.
- Hacer 50 mensajes a Pick (rapid-fire).
- 51º mensaje: server devuelve error `resource-exhausted` (en consola del navegador, error `code: functions/resource-exhausted`).
- Verificar Firestore Console: `artifacts/uros-fbm-app/workspaces/<ws>/usage/2026-05` tiene `count: 51`.

Si todo OK, PR #1 cerrado y desplegado. PR #2 puede arrancar.

---

## PR #2 — Frontend gating UX

Tras este PR, la UI muestra counter, warning, modal del wall, y aiClient enruta el error a la modal. Aún sin pantalla `/upgrade` ni Stripe (PR #3 + #4).

### Task 11: Setup módulo billing frontend

**Files:**

- Create: `src/billing/constants.ts`
- Create: `src/billing/types.ts`
- Create: `src/billing/currentMonthId.ts`
- Create: `src/billing/currentMonthId.test.ts`
- Create: `src/billing/eventBus.ts` (si no existe ya un bus reutilizable)

- [ ] **Step 1: Constants mirror del backend**

```ts
// src/billing/constants.ts
export const FREE_QUOTA = 50;
export const PRO_FAIR_USE = 2000;
export const FREE_QUOTA_WARNING_THRESHOLD = 0.8; // 80% → warning
```

- [ ] **Step 2: Types mirror**

```ts
// src/billing/types.ts
import type { Timestamp } from 'firebase/firestore';

export type WorkspacePlan = 'free' | 'pro';

export type SubscriptionStatus = 'active' | 'past_due' | 'unpaid' | 'canceled' | 'trialing';

export interface WorkspaceBilling {
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Timestamp | null;
  priceId: string | null;
  lastEventAt: Timestamp;
}

export interface UsageData {
  count: number;
  lastIncrementAt: Timestamp;
  monthId: string;
}
```

- [ ] **Step 3: currentMonthId test (failing)**

```ts
// src/billing/currentMonthId.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { currentMonthId } from './currentMonthId';

describe('currentMonthId (frontend)', () => {
  afterEach(() => vi.useRealTimers());

  it("returns 'YYYY-MM' format in Europe/Madrid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    expect(currentMonthId()).toBe('2026-05');
  });

  it('rolls over at Madrid midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-30T22:30:00Z'));
    expect(currentMonthId()).toBe('2026-05');
  });
});
```

- [ ] **Step 4: Implementación (igual al backend)**

```ts
// src/billing/currentMonthId.ts
export function currentMonthId(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  return `${year}-${month}`;
}
```

- [ ] **Step 5: eventBus simple (skip si ya existe)**

Antes de crear, buscar:

```bash
grep -rn "eventBus\|EventEmitter\|emit(" src/ | head -10
```

Si no existe, crear:

```ts
// src/billing/eventBus.ts
type Listener<T = unknown> = (payload: T) => void;

const listeners = new Map<string, Set<Listener>>();

export const eventBus = {
  on<T>(event: string, listener: Listener<T>): () => void {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(listener as Listener);
    return () => listeners.get(event)?.delete(listener as Listener);
  },
  emit<T>(event: string, payload: T): void {
    listeners.get(event)?.forEach((l) => l(payload));
  },
};
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run src/billing/currentMonthId.test.ts
```

Expected: 2 passed.

- [ ] **Step 7: Commit**

```bash
git add src/billing/
git commit -m "feat(billing): frontend constants, types, monthId, eventBus"
```

---

### Task 12: useWorkspacePlan hook con tests

**Files:**

- Create: `src/billing/useWorkspacePlan.ts`
- Create: `src/billing/useWorkspacePlan.test.tsx`

- [ ] **Step 1: Tests primero**

```tsx
// src/billing/useWorkspacePlan.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWorkspacePlan } from './useWorkspacePlan';

// Mock Firestore listener
const mockSubscribe = vi.fn();
vi.mock('../contexts/FirebaseContext', () => ({
  useFirebase: () => ({
    db: {
      /* mocked */
    },
    appId: 'test-app',
  }),
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'mock-ref'),
  onSnapshot: (ref: any, cb: any) => mockSubscribe(ref, cb),
}));

describe('useWorkspacePlan', () => {
  it("returns plan='free' and isPro=false when doc is free", async () => {
    mockSubscribe.mockImplementation((_ref, cb) => {
      cb({ exists: () => true, data: () => ({ plan: 'free', billing: null }) });
      return () => {};
    });
    const { result } = renderHook(() => useWorkspacePlan('ws-1'));
    await waitFor(() => expect(result.current.plan).toBe('free'));
    expect(result.current.isPro).toBe(false);
    expect(result.current.isPastDue).toBe(false);
    expect(result.current.billing).toBeNull();
  });

  it("returns plan='pro' and isPro=true when doc is pro", async () => {
    mockSubscribe.mockImplementation((_ref, cb) => {
      cb({
        exists: () => true,
        data: () => ({
          plan: 'pro',
          billing: { status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: null },
        }),
      });
      return () => {};
    });
    const { result } = renderHook(() => useWorkspacePlan('ws-1'));
    await waitFor(() => expect(result.current.isPro).toBe(true));
  });

  it('returns isPastDue=true when billing.status is past_due', async () => {
    mockSubscribe.mockImplementation((_ref, cb) => {
      cb({
        exists: () => true,
        data: () => ({
          plan: 'pro',
          billing: { status: 'past_due' },
        }),
      });
      return () => {};
    });
    const { result } = renderHook(() => useWorkspacePlan('ws-1'));
    await waitFor(() => expect(result.current.isPastDue).toBe(true));
  });
});
```

- [ ] **Step 2: Run test (failing)**

```bash
npx vitest run src/billing/useWorkspacePlan.test.tsx
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implementar**

```ts
// src/billing/useWorkspacePlan.ts
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '../contexts/FirebaseContext';
import type { WorkspaceBilling, WorkspacePlan } from './types';

export interface UseWorkspacePlanResult {
  plan: WorkspacePlan;
  billing: WorkspaceBilling | null;
  isPro: boolean;
  isPastDue: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  loading: boolean;
}

export function useWorkspacePlan(wsId: string | null): UseWorkspacePlanResult {
  const { db, appId } = useFirebase();
  const [data, setData] = useState<{ plan: WorkspacePlan; billing: WorkspaceBilling | null }>({
    plan: 'free',
    billing: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId || !db || !appId) {
      setLoading(false);
      return;
    }
    const ref = doc(db, 'artifacts', appId, 'workspaces', wsId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setData({ plan: 'free', billing: null });
      } else {
        const d = snap.data();
        setData({
          plan: (d.plan as WorkspacePlan) ?? 'free',
          billing: (d.billing as WorkspaceBilling) ?? null,
        });
      }
      setLoading(false);
    });
    return unsub;
  }, [db, appId, wsId]);

  return {
    plan: data.plan,
    billing: data.billing,
    isPro: data.plan === 'pro',
    isPastDue: data.billing?.status === 'past_due',
    cancelAtPeriodEnd: data.billing?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: data.billing?.currentPeriodEnd?.toDate() ?? null,
    loading,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/billing/useWorkspacePlan.test.tsx
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/billing/useWorkspacePlan.ts src/billing/useWorkspacePlan.test.tsx
git commit -m "feat(billing): useWorkspacePlan hook"
```

---

### Task 13: useWorkspaceUsage hook con tests

**Files:**

- Create: `src/billing/useWorkspaceUsage.ts`
- Create: `src/billing/useWorkspaceUsage.test.tsx`

- [ ] **Step 1: Tests primero**

```tsx
// src/billing/useWorkspaceUsage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWorkspaceUsage } from './useWorkspaceUsage';

const mockSubscribe = vi.fn();
vi.mock('../contexts/FirebaseContext', () => ({
  useFirebase: () => ({ db: {}, appId: 'test-app' }),
}));
vi.mock('./currentMonthId', () => ({
  currentMonthId: () => '2026-05',
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'mock-ref'),
  onSnapshot: (_ref: any, cb: any) => mockSubscribe(_ref, cb),
}));

describe('useWorkspaceUsage', () => {
  it('returns count=0 when doc does not exist', async () => {
    mockSubscribe.mockImplementation((_ref, cb) => {
      cb({ exists: () => false });
      return () => {};
    });
    const { result } = renderHook(() => useWorkspaceUsage('ws-1'));
    await waitFor(() => expect(result.current.count).toBe(0));
    expect(result.current.limit).toBe(50);
    expect(result.current.percentage).toBe(0);
    expect(result.current.isAtCap).toBe(false);
    expect(result.current.isNearCap).toBe(false);
  });

  it('returns count=32 percentage=64 isNearCap=false', async () => {
    mockSubscribe.mockImplementation((_ref, cb) => {
      cb({ exists: () => true, data: () => ({ count: 32, monthId: '2026-05' }) });
      return () => {};
    });
    const { result } = renderHook(() => useWorkspaceUsage('ws-1'));
    await waitFor(() => expect(result.current.count).toBe(32));
    expect(result.current.percentage).toBe(64);
    expect(result.current.isNearCap).toBe(false);
  });

  it('returns isNearCap=true when count >= 40 (80% of 50)', async () => {
    mockSubscribe.mockImplementation((_ref, cb) => {
      cb({ exists: () => true, data: () => ({ count: 40, monthId: '2026-05' }) });
      return () => {};
    });
    const { result } = renderHook(() => useWorkspaceUsage('ws-1'));
    await waitFor(() => expect(result.current.isNearCap).toBe(true));
    expect(result.current.isAtCap).toBe(false);
  });

  it('returns isAtCap=true when count >= 50', async () => {
    mockSubscribe.mockImplementation((_ref, cb) => {
      cb({ exists: () => true, data: () => ({ count: 50, monthId: '2026-05' }) });
      return () => {};
    });
    const { result } = renderHook(() => useWorkspaceUsage('ws-1'));
    await waitFor(() => expect(result.current.isAtCap).toBe(true));
  });

  it('caps percentage at 100 when count > limit', async () => {
    mockSubscribe.mockImplementation((_ref, cb) => {
      cb({ exists: () => true, data: () => ({ count: 75, monthId: '2026-05' }) });
      return () => {};
    });
    const { result } = renderHook(() => useWorkspaceUsage('ws-1'));
    await waitFor(() => expect(result.current.percentage).toBe(100));
  });
});
```

- [ ] **Step 2: Run test (failing)**

```bash
npx vitest run src/billing/useWorkspaceUsage.test.tsx
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implementar**

```ts
// src/billing/useWorkspaceUsage.ts
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '../contexts/FirebaseContext';
import { FREE_QUOTA, FREE_QUOTA_WARNING_THRESHOLD } from './constants';
import { currentMonthId } from './currentMonthId';

export interface UseWorkspaceUsageResult {
  count: number;
  limit: number;
  percentage: number; // capped at 100
  isAtCap: boolean;
  isNearCap: boolean;
  monthId: string;
  loading: boolean;
}

export function useWorkspaceUsage(wsId: string | null): UseWorkspaceUsageResult {
  const { db, appId } = useFirebase();
  const monthId = currentMonthId();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId || !db || !appId) {
      setLoading(false);
      return;
    }
    const ref = doc(db, 'artifacts', appId, 'workspaces', wsId, 'usage', monthId);
    const unsub = onSnapshot(ref, (snap) => {
      setCount(snap.exists() ? (snap.data().count ?? 0) : 0);
      setLoading(false);
    });
    return unsub;
  }, [db, appId, wsId, monthId]);

  const percentage = Math.min(100, Math.round((count / FREE_QUOTA) * 100));
  const isNearCap = count >= FREE_QUOTA * FREE_QUOTA_WARNING_THRESHOLD;
  const isAtCap = count >= FREE_QUOTA;

  return {
    count,
    limit: FREE_QUOTA,
    percentage,
    isAtCap,
    isNearCap,
    monthId,
    loading,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/billing/useWorkspaceUsage.test.tsx
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/billing/useWorkspaceUsage.ts src/billing/useWorkspaceUsage.test.tsx
git commit -m "feat(billing): useWorkspaceUsage hook"
```

---

### Task 14: UsageCounter component

**Files:**

- Create: `src/billing/components/UsageCounter.jsx`

- [ ] **Step 1: Implementar**

```jsx
// src/billing/components/UsageCounter.jsx
import { useWorkspacePlan } from '../useWorkspacePlan';
import { useWorkspaceUsage } from '../useWorkspaceUsage';
import { useWorkspace } from '../../contexts/WorkspaceContext';

/**
 * Counter visible en el header del área privada.
 * Solo se renderiza para usuarios free.
 */
export function UsageCounter() {
  const { activeWsId } = useWorkspace();
  const { isPro, loading: planLoading } = useWorkspacePlan(activeWsId);
  const { count, limit, isNearCap, isAtCap, loading: usageLoading } = useWorkspaceUsage(activeWsId);

  if (planLoading || usageLoading || isPro) return null;

  const tone = isAtCap ? 'text-red-600' : isNearCap ? 'text-amber-600' : 'text-zinc-500';
  return (
    <span
      className={`inline-flex items-center text-xs font-medium ${tone}`}
      aria-label={`Llevas ${count} de ${limit} acciones de IA este mes`}
      title="Acciones de IA este mes"
    >
      {count}/{limit} IA
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/billing/components/UsageCounter.jsx
git commit -m "feat(billing): UsageCounter component"
```

---

### Task 15: QuotaWarningBanner component

**Files:**

- Create: `src/billing/components/QuotaWarningBanner.jsx`

- [ ] **Step 1: Implementar**

```jsx
// src/billing/components/QuotaWarningBanner.jsx
import { Link } from 'react-router-dom';
import { useWorkspacePlan } from '../useWorkspacePlan';
import { useWorkspaceUsage } from '../useWorkspaceUsage';
import { useWorkspace } from '../../contexts/WorkspaceContext';

/**
 * Banner sutil que aparece cuando free user está al 80%+ del cap.
 * Voz Pick: tutea, baloncesto-nativo.
 */
export function QuotaWarningBanner() {
  const { activeWsId } = useWorkspace();
  const { isPro } = useWorkspacePlan(activeWsId);
  const { count, limit, isNearCap, isAtCap } = useWorkspaceUsage(activeWsId);

  if (isPro || !isNearCap || isAtCap) return null;

  const remaining = limit - count;
  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 p-3 text-sm flex items-center justify-between">
      <span className="text-amber-900">
        Te quedan <strong>{remaining}</strong> acciones de IA este mes. Pasa a Pro para que Pick no mire el reloj.
      </span>
      <Link
        to="/upgrade"
        className="ml-4 px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 text-xs font-medium"
      >
        Hazte Pro
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/billing/components/QuotaWarningBanner.jsx
git commit -m "feat(billing): QuotaWarningBanner"
```

---

### Task 16: QuotaExceededModal component

**Files:**

- Create: `src/billing/components/QuotaExceededModal.jsx`

- [ ] **Step 1: Implementar**

```jsx
// src/billing/components/QuotaExceededModal.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventBus } from '../eventBus';

/**
 * Modal que aparece cuando aiClient recibe HttpsError('resource-exhausted').
 * Se monta una vez en AppShell (singleton) y escucha el eventBus.
 */
export function QuotaExceededModal() {
  const [details, setDetails] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    return eventBus.on('quota-exceeded', (d) => setDetails(d));
  }, []);

  if (!details) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quota-exceeded-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 id="quota-exceeded-title" className="text-lg font-semibold mb-2">
          Has llegado a tu cap mensual
        </h2>
        <p className="text-sm text-zinc-600 mb-4">
          Llevas <strong>{details.count}</strong> de {details.limit} acciones de IA este mes. Pasa a Pro y Pick deja de
          mirar el reloj. O vuelve el día 1.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDetails(null)}
            className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900"
          >
            Vuelvo el día 1
          </button>
          <button
            type="button"
            onClick={() => {
              setDetails(null);
              navigate('/upgrade');
            }}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
          >
            Hazte Pro
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/billing/components/QuotaExceededModal.jsx
git commit -m "feat(billing): QuotaExceededModal"
```

---

### Task 17: aiClient catch resource-exhausted

**Files:**

- Modify: `src/services/aiClient.ts`

- [ ] **Step 1: Leer el archivo**

```bash
cat src/services/aiClient.ts
```

Identificar la función que llama a `httpsCallable` (probablemente `runAgent`, `aiChat`, o un wrapper genérico).

- [ ] **Step 2: Añadir el catch unificado**

Editar el wrapper de error. Si el archivo tiene una función `callFunction` o similar que envuelve `httpsCallable`:

```ts
// src/services/aiClient.ts
import { eventBus } from '../billing/eventBus';

// ... resto del archivo ...

async function callFunction(name: string, payload: unknown) {
  try {
    return await httpsCallable(getFunctions(), name)(payload);
  } catch (err: any) {
    // Quota exceeded → emit event for QuotaExceededModal to pick up
    if (err.code === 'functions/resource-exhausted' && err.details?.limit !== undefined) {
      eventBus.emit('quota-exceeded', {
        count: err.details.count,
        limit: err.details.limit,
        monthId: err.details.monthId,
      });
    }
    throw err;
  }
}
```

(Adaptar a la estructura real del archivo. Si las llamadas se hacen directamente sin wrapper, añadir el wrapper.)

- [ ] **Step 3: Verificar que aiClient envía wsId al backend**

```bash
grep -n "wsId" src/services/aiClient.ts
```

Confirmar que las llamadas a `aiChat` y `runAgent` incluyen `wsId` en el payload, leyéndolo del `WorkspaceContext`. Si no, añadirlo.

- [ ] **Step 4: Commit**

```bash
git add src/services/aiClient.ts
git commit -m "feat(billing): aiClient enruta resource-exhausted a eventBus"
```

---

### Task 18: Wire UsageCounter, QuotaWarningBanner, QuotaExceededModal

**Files:**

- Modify: `src/screens/HomeScreen.jsx` (o el archivo que contenga el header)
- Modify: `src/shell/AppShell.jsx`

- [ ] **Step 1: Localizar el header**

```bash
grep -n "header\|Header\|<nav" src/shell/AppShell.jsx src/shell/CoachesNav.jsx | head -10
```

Insertar `<UsageCounter />` en el lugar visualmente consistente (junto al avatar/menú del usuario).

- [ ] **Step 2: Editar AppShell.jsx**

Añadir imports + montar componentes globales:

```jsx
import { QuotaExceededModal } from '../billing/components/QuotaExceededModal';
// ... resto ...

export function AppShell({ children }) {
  return (
    <>
      {/* ... existing layout ... */}
      <QuotaExceededModal />
      {children}
    </>
  );
}
```

- [ ] **Step 3: Editar HomeScreen.jsx**

Insertar `QuotaWarningBanner` y `UsageCounter`:

```jsx
import { QuotaWarningBanner } from '../billing/components/QuotaWarningBanner';
import { UsageCounter } from '../billing/components/UsageCounter';

// En el header:
<header className="flex items-center justify-between p-4 border-b">
  <h1>...</h1>
  <div className="flex items-center gap-4">
    <UsageCounter />
    {/* ...resto del header existente... */}
  </div>
</header>;

{
  /* Bajo el header, en el área principal: */
}
<QuotaWarningBanner />;
```

- [ ] **Step 4: Verificar visual en dev**

```bash
npm run dev
```

Login con cuenta free, contar las acciones IA acumuladas. Counter visible en header. Forzar `count = 40` directo en Firestore Console → ver el banner. Forzar `count = 50` → ver el modal al intentar enviar otro msg a Pick.

- [ ] **Step 5: Commit**

```bash
git add src/shell/AppShell.jsx src/screens/HomeScreen.jsx
git commit -m "feat(billing): wire UsageCounter, banner, modal in shell"
```

---

### Task 19: Deploy PR #2

- [ ] **Step 1: Push branch (mismo branch del PR #1 mergeado, o nuevo)**

Si el PR #1 está mergeado a main, crear branch nueva desde main:

```bash
git checkout main && git pull origin main
git checkout -b feat/sub-proyecto-5-paywall-frontend-gating
# (los commits de Tasks 11-18 ya hechos en feat/sub-proyecto-5-paywall — cherry-pick o continuar)
```

Si los commits están aún en `feat/sub-proyecto-5-paywall`, hacer `git rebase main` antes del push.

```bash
git push -u origin feat/sub-proyecto-5-paywall-frontend-gating
gh pr create --title "feat(billing): frontend gating UX (sub-proyecto 5 PR #2)" --body "$(cat <<'EOF'
## Summary
- Hooks useWorkspacePlan + useWorkspaceUsage suscriben listener al workspace doc y al usage del mes actual.
- UsageCounter visible solo para free, en header.
- QuotaWarningBanner desde 80% del cap.
- QuotaExceededModal global montado en AppShell, escucha eventBus.
- aiClient ruta HttpsError('resource-exhausted') al eventBus.

## Test plan
- [ ] Vitest pasa: useWorkspacePlan.test, useWorkspaceUsage.test, currentMonthId.test
- [ ] En staging con cuenta free: counter visible, contado correctamente
- [ ] Counter sube en tiempo real al enviar msg a Pick
- [ ] Banner aparece a 40/50; modal aparece al 51º msg

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Tras merge, deploy**

```bash
firebase deploy --only hosting --project playoff-creator
```

- [ ] **Step 3: Smoke en prod**

Login con `serpa+test1@gmail.com`, verificar:

- Counter visible "0/50 IA" en header
- Después de 40 acciones, banner aparece
- 51ª acción, modal aparece con CTA "Hazte Pro"

---

## PR #3 — Backend Stripe

Tras este PR, el flow Stripe está cableado pero la UI de upgrade (PR #4) aún no existe — los users no tienen forma de invocar `createCheckoutSession`. Esto permite testar el backend Stripe sin exponerlo.

### Task 20: Install Stripe SDK + secrets backend

**Files:**

- Modify: `functions/package.json`
- Modify: `functions/.env`

- [ ] **Step 1: Install stripe**

```bash
cd functions && npm install stripe@^17
```

Expected: `stripe` añadido a `dependencies` en `functions/package.json`.

- [ ] **Step 2: Añadir env vars (operativa, no commitear los valores reales)**

Editar `functions/.env` localmente — añadir 4 vars vacías para que `defineSecret` funcione en build:

```
PICK_APP_ID=uros-fbm-app
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SIGNING_SECRET=
STRIPE_PRICE_MONTHLY=
STRIPE_PRICE_ANNUAL=
```

Los valores reales se inyectan en deploy via Firebase Functions secrets. Para staging/local emulator: usar test keys de Stripe.

- [ ] **Step 3: Configurar secrets en Firebase**

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY --project playoff-creator
# (paste sk_live_... when prompted)
firebase functions:secrets:set STRIPE_WEBHOOK_SIGNING_SECRET --project playoff-creator
firebase functions:secrets:set STRIPE_PRICE_MONTHLY --project playoff-creator
firebase functions:secrets:set STRIPE_PRICE_ANNUAL --project playoff-creator
```

(Hacer `firebase functions:secrets:get` para verificar.)

- [ ] **Step 4: Commit**

```bash
git add functions/package.json functions/package-lock.json
# (.env queda gitignored — no commitear)
git commit -m "chore(billing): install Stripe SDK"
```

---

### Task 21: stripeClient factory

**Files:**

- Create: `functions/src/billing/stripeClient.ts`

- [ ] **Step 1: Implementar**

```ts
// functions/src/billing/stripeClient.ts
import Stripe from 'stripe';
import { defineSecret } from 'firebase-functions/params';

export const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
export const stripeWebhookSigningSecret = defineSecret('STRIPE_WEBHOOK_SIGNING_SECRET');
export const stripePriceMonthly = defineSecret('STRIPE_PRICE_MONTHLY');
export const stripePriceAnnual = defineSecret('STRIPE_PRICE_ANNUAL');

let cached: Stripe | null = null;

/**
 * Returns a singleton Stripe client. Initialized on first use.
 * Fails fast if STRIPE_SECRET_KEY is missing — this prevents silent
 * degradation where webhooks/checkout return success without contacting Stripe.
 */
export function getStripe(): Stripe {
  if (cached) return cached;
  const key = stripeSecretKey.value();
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is required but missing');
  }
  cached = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
  return cached;
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/src/billing/stripeClient.ts
git commit -m "feat(billing): stripeClient factory"
```

---

### Task 22: createCheckoutSession callable

**Files:**

- Create: `functions/src/billing/createCheckoutSession.ts`
- Create: `functions/src/billing/createCheckoutSession.test.ts`

- [ ] **Step 1: Tests primero**

```ts
// functions/src/billing/createCheckoutSession.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCreateCheckoutSession } from './createCheckoutSession';

const mockStripeCreate = vi.fn();
const mockCustomerCreate = vi.fn();

vi.mock('./stripeClient', () => ({
  getStripe: () => ({
    customers: { create: mockCustomerCreate },
    checkout: { sessions: { create: mockStripeCreate } },
  }),
  stripePriceMonthly: { value: () => 'price_monthly_test' },
  stripePriceAnnual: { value: () => 'price_annual_test' },
}));

describe('handleCreateCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStripeCreate.mockResolvedValue({ client_secret: 'cs_test_xyz' });
    mockCustomerCreate.mockResolvedValue({ id: 'cus_new_xyz' });
  });

  it('creates customer when none exists, returns clientSecret', async () => {
    const db = mockDbWithWorkspace({ ownerId: 'uid-1', billing: null });
    const result = await handleCreateCheckoutSession({
      db,
      auth: { uid: 'uid-1' },
      data: { wsId: 'ws-1', appId: 'app-1', priceId: 'price_monthly_test' },
    });
    expect(result).toEqual({ clientSecret: 'cs_test_xyz' });
    expect(mockCustomerCreate).toHaveBeenCalledWith({
      metadata: { wsId: 'ws-1', appId: 'app-1', uid: 'uid-1' },
    });
  });

  it('reuses existing customer when billing.stripeCustomerId is set', async () => {
    const db = mockDbWithWorkspace({
      ownerId: 'uid-1',
      billing: { stripeCustomerId: 'cus_existing', status: null },
    });
    await handleCreateCheckoutSession({
      db,
      auth: { uid: 'uid-1' },
      data: { wsId: 'ws-1', appId: 'app-1', priceId: 'price_monthly_test' },
    });
    expect(mockCustomerCreate).not.toHaveBeenCalled();
    expect(mockStripeCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_existing' }));
  });

  it('throws permission-denied when caller is not owner', async () => {
    const db = mockDbWithWorkspace({ ownerId: 'uid-1', billing: null });
    await expect(
      handleCreateCheckoutSession({
        db,
        auth: { uid: 'uid-2' }, // not the owner
        data: { wsId: 'ws-1', appId: 'app-1', priceId: 'price_monthly_test' },
      }),
    ).rejects.toThrow(/permission/i);
  });

  it("throws not-found when workspace doesn't exist", async () => {
    const db = mockDbWithWorkspace(null);
    await expect(
      handleCreateCheckoutSession({
        db,
        auth: { uid: 'uid-1' },
        data: { wsId: 'missing', appId: 'app-1', priceId: 'price_monthly_test' },
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('throws invalid-argument when priceId is not in allowlist', async () => {
    const db = mockDbWithWorkspace({ ownerId: 'uid-1', billing: null });
    await expect(
      handleCreateCheckoutSession({
        db,
        auth: { uid: 'uid-1' },
        data: { wsId: 'ws-1', appId: 'app-1', priceId: 'price_evil' },
      }),
    ).rejects.toThrow(/invalid.*price/i);
  });
});

// Helper
function mockDbWithWorkspace(workspaceData: unknown) {
  const docMock = {
    get: vi.fn().mockResolvedValue({
      exists: workspaceData !== null,
      data: () => workspaceData,
    }),
    update: vi.fn().mockResolvedValue(undefined),
  };
  return {
    doc: vi.fn().mockReturnValue(docMock),
  } as any;
}
```

- [ ] **Step 2: Run test (failing)**

```bash
cd functions && npx vitest run src/billing/createCheckoutSession.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implementar**

```ts
// functions/src/billing/createCheckoutSession.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { getStripe, stripeSecretKey, stripePriceMonthly, stripePriceAnnual } from './stripeClient';

interface HandlerArgs {
  db: Firestore;
  auth: { uid: string };
  data: { wsId: string; appId: string; priceId: string };
}

/**
 * Pure handler — extracted for testability.
 * The onCall wrapper below is the deployment surface.
 */
export async function handleCreateCheckoutSession({ db, auth, data }: HandlerArgs) {
  const { wsId, appId, priceId } = data;
  if (!wsId || !appId || !priceId) {
    throw new HttpsError('invalid-argument', 'Missing wsId, appId or priceId');
  }
  const allowedPrices = [stripePriceMonthly.value(), stripePriceAnnual.value()].filter(Boolean);
  if (!allowedPrices.includes(priceId)) {
    throw new HttpsError('invalid-argument', `Invalid priceId: ${priceId}`);
  }

  const wsRef = db.doc(`artifacts/${appId}/workspaces/${wsId}`);
  const wsSnap = await wsRef.get();
  if (!wsSnap.exists) {
    throw new HttpsError('not-found', `workspace not found: ${wsId}`);
  }
  const ws = wsSnap.data()!;
  if (ws.ownerId !== auth.uid) {
    throw new HttpsError('permission-denied', 'Only the workspace owner can manage billing');
  }

  const stripe = getStripe();
  let customerId: string = ws.billing?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { wsId, appId, uid: auth.uid },
    });
    customerId = customer.id;
    await wsRef.update({
      'billing.stripeCustomerId': customerId,
      'billing.lastEventAt': FieldValue.serverTimestamp(),
    });
  }

  const session = await stripe.checkout.sessions.create({
    ui_mode: 'embedded',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    return_url: `${process.env.APP_BASE_URL ?? 'https://playoff-creator.web.app'}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
  });

  return { clientSecret: session.client_secret };
}

export const createCheckoutSession = onCall(
  {
    secrets: [stripeSecretKey, stripePriceMonthly, stripePriceAnnual],
    region: 'europe-west1',
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
    return handleCreateCheckoutSession({
      db: getFirestore(),
      auth: { uid: request.auth.uid },
      data: request.data,
    });
  },
);
```

- [ ] **Step 4: Run tests**

```bash
cd functions && npx vitest run src/billing/createCheckoutSession.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add functions/src/billing/createCheckoutSession.ts functions/src/billing/createCheckoutSession.test.ts
git commit -m "feat(billing): createCheckoutSession callable"
```

---

### Task 23: createPortalSession callable

**Files:**

- Create: `functions/src/billing/createPortalSession.ts`
- Create: `functions/src/billing/createPortalSession.test.ts`

- [ ] **Step 1: Tests primero**

```ts
// functions/src/billing/createPortalSession.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCreatePortalSession } from './createPortalSession';

const mockPortalCreate = vi.fn();
vi.mock('./stripeClient', () => ({
  getStripe: () => ({ billingPortal: { sessions: { create: mockPortalCreate } } }),
  stripeSecretKey: {},
}));

describe('handleCreatePortalSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPortalCreate.mockResolvedValue({ url: 'https://billing.stripe.com/p/session/abc' });
  });

  it('creates portal session for owner with existing customer', async () => {
    const db = mockDbWithWorkspace({
      ownerId: 'uid-1',
      billing: { stripeCustomerId: 'cus_xyz' },
    });
    const result = await handleCreatePortalSession({
      db,
      auth: { uid: 'uid-1' },
      data: { wsId: 'ws-1', appId: 'app-1', returnUrl: 'https://app/home' },
    });
    expect(result).toEqual({ url: 'https://billing.stripe.com/p/session/abc' });
    expect(mockPortalCreate).toHaveBeenCalledWith({
      customer: 'cus_xyz',
      return_url: 'https://app/home',
    });
  });

  it('throws failed-precondition when no Stripe customer', async () => {
    const db = mockDbWithWorkspace({ ownerId: 'uid-1', billing: null });
    await expect(
      handleCreatePortalSession({
        db,
        auth: { uid: 'uid-1' },
        data: { wsId: 'ws-1', appId: 'app-1', returnUrl: 'https://app/home' },
      }),
    ).rejects.toThrow(/no.*customer/i);
  });

  it('throws permission-denied when caller is not owner', async () => {
    const db = mockDbWithWorkspace({
      ownerId: 'uid-1',
      billing: { stripeCustomerId: 'cus_xyz' },
    });
    await expect(
      handleCreatePortalSession({
        db,
        auth: { uid: 'uid-2' },
        data: { wsId: 'ws-1', appId: 'app-1', returnUrl: 'https://app/home' },
      }),
    ).rejects.toThrow(/permission/i);
  });
});

function mockDbWithWorkspace(data: unknown) {
  return {
    doc: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({ exists: true, data: () => data }),
    }),
  } as any;
}
```

- [ ] **Step 2: Run test (failing)**

```bash
cd functions && npx vitest run src/billing/createPortalSession.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// functions/src/billing/createPortalSession.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { getStripe, stripeSecretKey } from './stripeClient';

interface HandlerArgs {
  db: Firestore;
  auth: { uid: string };
  data: { wsId: string; appId: string; returnUrl: string };
}

export async function handleCreatePortalSession({ db, auth, data }: HandlerArgs) {
  const { wsId, appId, returnUrl } = data;
  if (!wsId || !appId || !returnUrl) {
    throw new HttpsError('invalid-argument', 'Missing wsId, appId or returnUrl');
  }

  const wsSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}`).get();
  if (!wsSnap.exists) {
    throw new HttpsError('not-found', 'workspace not found');
  }
  const ws = wsSnap.data()!;
  if (ws.ownerId !== auth.uid) {
    throw new HttpsError('permission-denied', 'Only the workspace owner can manage billing');
  }
  const customerId = ws.billing?.stripeCustomerId;
  if (!customerId) {
    throw new HttpsError('failed-precondition', 'no Stripe customer for this workspace');
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return { url: session.url };
}

export const createPortalSession = onCall({ secrets: [stripeSecretKey], region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  return handleCreatePortalSession({
    db: getFirestore(),
    auth: { uid: request.auth.uid },
    data: request.data,
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd functions && npx vitest run src/billing/createPortalSession.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add functions/src/billing/createPortalSession.ts functions/src/billing/createPortalSession.test.ts
git commit -m "feat(billing): createPortalSession callable"
```

---

### Task 24: Webhook handlers — checkoutCompleted

**Files:**

- Create: `functions/src/billing/handlers/checkoutCompleted.ts`
- Create: `functions/src/billing/handlers/checkoutCompleted.test.ts`

- [ ] **Step 1: Tests primero**

```ts
// functions/src/billing/handlers/checkoutCompleted.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleCheckoutCompleted } from './checkoutCompleted';

describe('handleCheckoutCompleted', () => {
  it('sets plan=pro and writes billing fields', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { wsId: 'ws-1', appId: 'app-1' },
          customer: 'cus_xyz',
          subscription: 'sub_xyz',
        },
      },
    } as any;

    await handleCheckoutCompleted(db, event);

    expect(db.doc).toHaveBeenCalledWith('artifacts/app-1/workspaces/ws-1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'pro',
        'billing.stripeCustomerId': 'cus_xyz',
        'billing.stripeSubscriptionId': 'sub_xyz',
      }),
    );
  });

  it('logs WEBHOOK_ORPHAN_EVENT when metadata.wsId is missing', async () => {
    const db = { doc: vi.fn() } as any;
    const event = {
      type: 'checkout.session.completed',
      data: { object: { metadata: {}, customer: 'cus_xyz' } },
    } as any;
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await handleCheckoutCompleted(db, event);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('WEBHOOK_ORPHAN_EVENT'), expect.anything());
    expect(db.doc).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test (failing)**

```bash
cd functions && npx vitest run src/billing/handlers/checkoutCompleted.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// functions/src/billing/handlers/checkoutCompleted.ts
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import type Stripe from 'stripe';

export async function handleCheckoutCompleted(
  db: Firestore,
  event: Stripe.CheckoutSessionCompletedEvent,
): Promise<void> {
  const session = event.data.object;
  const wsId = session.metadata?.wsId;
  const appId = session.metadata?.appId;
  if (!wsId || !appId) {
    console.warn('WEBHOOK_ORPHAN_EVENT', { type: event.type, eventId: event.id });
    return;
  }
  await db.doc(`artifacts/${appId}/workspaces/${wsId}`).update({
    plan: 'pro',
    planUpdatedAt: FieldValue.serverTimestamp(),
    'billing.stripeCustomerId': session.customer,
    'billing.stripeSubscriptionId': session.subscription,
    'billing.status': 'active',
    'billing.cancelAtPeriodEnd': false,
    'billing.lastEventAt': FieldValue.serverTimestamp(),
  });
}
```

- [ ] **Step 4: Run tests**

```bash
cd functions && npx vitest run src/billing/handlers/checkoutCompleted.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add functions/src/billing/handlers/checkoutCompleted.ts functions/src/billing/handlers/checkoutCompleted.test.ts
git commit -m "feat(billing): webhook handler checkoutCompleted"
```

---

### Task 25: Webhook handler — subscriptionUpdated

**Files:**

- Create: `functions/src/billing/handlers/subscriptionUpdated.ts`
- Create: `functions/src/billing/handlers/subscriptionUpdated.test.ts`

- [ ] **Step 1: Test**

```ts
// functions/src/billing/handlers/subscriptionUpdated.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleSubscriptionUpdated } from './subscriptionUpdated';

describe('handleSubscriptionUpdated', () => {
  it('updates billing.status, cancelAtPeriodEnd, currentPeriodEnd, priceId', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: 'customer.subscription.updated',
      data: {
        object: {
          metadata: { wsId: 'ws-1', appId: 'app-1' },
          status: 'active',
          cancel_at_period_end: true,
          current_period_end: 1735689600, // 2025-01-01 epoch
          items: { data: [{ price: { id: 'price_pro_annual_xxx' } }] },
        },
      },
    } as any;

    await handleSubscriptionUpdated(db, event);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        'billing.status': 'active',
        'billing.cancelAtPeriodEnd': true,
        'billing.priceId': 'price_pro_annual_xxx',
      }),
    );
  });
});
```

- [ ] **Step 2-4: Run failing → implement → run passing**

```ts
// functions/src/billing/handlers/subscriptionUpdated.ts
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type Stripe from 'stripe';

export async function handleSubscriptionUpdated(
  db: Firestore,
  event: Stripe.CustomerSubscriptionUpdatedEvent,
): Promise<void> {
  const sub = event.data.object;
  const wsId = sub.metadata?.wsId;
  const appId = sub.metadata?.appId;
  if (!wsId || !appId) {
    console.warn('WEBHOOK_ORPHAN_EVENT', { type: event.type, eventId: event.id });
    return;
  }
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  await db.doc(`artifacts/${appId}/workspaces/${wsId}`).update({
    'billing.status': sub.status,
    'billing.cancelAtPeriodEnd': sub.cancel_at_period_end ?? false,
    'billing.currentPeriodEnd': sub.current_period_end ? Timestamp.fromMillis(sub.current_period_end * 1000) : null,
    'billing.priceId': priceId,
    'billing.lastEventAt': FieldValue.serverTimestamp(),
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add functions/src/billing/handlers/subscriptionUpdated.ts functions/src/billing/handlers/subscriptionUpdated.test.ts
git commit -m "feat(billing): webhook handler subscriptionUpdated"
```

---

### Task 26: Webhook handler — subscriptionDeleted

**Files:**

- Create: `functions/src/billing/handlers/subscriptionDeleted.ts`
- Create: `functions/src/billing/handlers/subscriptionDeleted.test.ts`

- [ ] **Step 1: Test**

```ts
// functions/src/billing/handlers/subscriptionDeleted.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleSubscriptionDeleted } from './subscriptionDeleted';

describe('handleSubscriptionDeleted', () => {
  it('downgrades plan to free and marks billing.status=canceled', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: 'customer.subscription.deleted',
      data: {
        object: {
          metadata: { wsId: 'ws-1', appId: 'app-1' },
        },
      },
    } as any;
    await handleSubscriptionDeleted(db, event);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'free',
        'billing.status': 'canceled',
      }),
    );
  });
});
```

- [ ] **Step 2-4: Implementar**

```ts
// functions/src/billing/handlers/subscriptionDeleted.ts
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import type Stripe from 'stripe';

export async function handleSubscriptionDeleted(
  db: Firestore,
  event: Stripe.CustomerSubscriptionDeletedEvent,
): Promise<void> {
  const sub = event.data.object;
  const wsId = sub.metadata?.wsId;
  const appId = sub.metadata?.appId;
  if (!wsId || !appId) {
    console.warn('WEBHOOK_ORPHAN_EVENT', { type: event.type, eventId: event.id });
    return;
  }
  await db.doc(`artifacts/${appId}/workspaces/${wsId}`).update({
    plan: 'free',
    planUpdatedAt: FieldValue.serverTimestamp(),
    'billing.status': 'canceled',
    'billing.cancelAtPeriodEnd': false,
    'billing.lastEventAt': FieldValue.serverTimestamp(),
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add functions/src/billing/handlers/subscriptionDeleted.ts functions/src/billing/handlers/subscriptionDeleted.test.ts
git commit -m "feat(billing): webhook handler subscriptionDeleted"
```

---

### Task 27: Webhook handler — invoicePaymentSucceeded

**Files:**

- Create: `functions/src/billing/handlers/invoicePaymentSucceeded.ts`
- Create: `functions/src/billing/handlers/invoicePaymentSucceeded.test.ts`

- [ ] **Step 1: Test**

```ts
// functions/src/billing/handlers/invoicePaymentSucceeded.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleInvoicePaymentSucceeded } from './invoicePaymentSucceeded';

describe('handleInvoicePaymentSucceeded', () => {
  it('reaffirms plan=pro and billing.status=active', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          metadata: { wsId: 'ws-1', appId: 'app-1' },
        },
      },
    } as any;
    await handleInvoicePaymentSucceeded(db, event);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'pro',
        'billing.status': 'active',
      }),
    );
  });
});
```

- [ ] **Step 2-4: Implementar**

```ts
// functions/src/billing/handlers/invoicePaymentSucceeded.ts
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import type Stripe from 'stripe';

export async function handleInvoicePaymentSucceeded(
  db: Firestore,
  event: Stripe.InvoicePaymentSucceededEvent,
): Promise<void> {
  const invoice = event.data.object;
  const wsId = invoice.metadata?.wsId ?? (invoice as any).subscription_details?.metadata?.wsId;
  const appId = invoice.metadata?.appId ?? (invoice as any).subscription_details?.metadata?.appId;
  if (!wsId || !appId) {
    console.warn('WEBHOOK_ORPHAN_EVENT', { type: event.type, eventId: event.id });
    return;
  }
  await db.doc(`artifacts/${appId}/workspaces/${wsId}`).update({
    plan: 'pro',
    'billing.status': 'active',
    'billing.lastEventAt': FieldValue.serverTimestamp(),
  });
}
```

(Nota: `invoice.metadata` puede no estar disponible — Stripe pasa la metadata de la subscription. Probar en staging y ajustar el path si hace falta.)

- [ ] **Step 5: Commit**

```bash
git add functions/src/billing/handlers/invoicePaymentSucceeded.ts functions/src/billing/handlers/invoicePaymentSucceeded.test.ts
git commit -m "feat(billing): webhook handler invoicePaymentSucceeded"
```

---

### Task 28: Webhook handler — invoicePaymentFailed

**Files:**

- Create: `functions/src/billing/handlers/invoicePaymentFailed.ts`
- Create: `functions/src/billing/handlers/invoicePaymentFailed.test.ts`

- [ ] **Step 1-5: Mismo patrón que Task 27**

```ts
// functions/src/billing/handlers/invoicePaymentFailed.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleInvoicePaymentFailed } from './invoicePaymentFailed';

describe('handleInvoicePaymentFailed', () => {
  it('sets billing.status=past_due but keeps plan=pro', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: 'invoice.payment_failed',
      data: { object: { metadata: { wsId: 'ws-1', appId: 'app-1' } } },
    } as any;
    await handleInvoicePaymentFailed(db, event);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ 'billing.status': 'past_due' }));
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ plan: 'free' }));
  });
});
```

```ts
// functions/src/billing/handlers/invoicePaymentFailed.ts
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import type Stripe from 'stripe';

export async function handleInvoicePaymentFailed(
  db: Firestore,
  event: Stripe.InvoicePaymentFailedEvent,
): Promise<void> {
  const invoice = event.data.object;
  const wsId = invoice.metadata?.wsId ?? (invoice as any).subscription_details?.metadata?.wsId;
  const appId = invoice.metadata?.appId ?? (invoice as any).subscription_details?.metadata?.appId;
  if (!wsId || !appId) {
    console.warn('WEBHOOK_ORPHAN_EVENT', { type: event.type, eventId: event.id });
    return;
  }
  await db.doc(`artifacts/${appId}/workspaces/${wsId}`).update({
    'billing.status': 'past_due',
    'billing.lastEventAt': FieldValue.serverTimestamp(),
  });
}
```

```bash
git add functions/src/billing/handlers/invoicePaymentFailed.ts functions/src/billing/handlers/invoicePaymentFailed.test.ts
git commit -m "feat(billing): webhook handler invoicePaymentFailed"
```

---

### Task 29: stripeWebhook dispatcher con idempotencia

**Files:**

- Create: `functions/src/billing/webhook.ts`
- Create: `functions/src/billing/webhook.test.ts`

- [ ] **Step 1: Tests primero**

```ts
// functions/src/billing/webhook.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchWebhook } from './webhook';

const mockExists = vi.fn();
const mockSet = vi.fn().mockResolvedValue(undefined);

const dbMock = {
  doc: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue({ exists: mockExists() }),
    set: mockSet,
  }),
} as any;

const handlerCalls: string[] = [];
const handlers = {
  'checkout.session.completed': async () => {
    handlerCalls.push('checkoutCompleted');
  },
  'customer.subscription.updated': async () => {
    handlerCalls.push('subscriptionUpdated');
  },
};

describe('dispatchWebhook', () => {
  beforeEach(() => {
    handlerCalls.length = 0;
    mockExists.mockReturnValue(false);
    mockSet.mockClear();
  });

  it('dispatches event to correct handler when not seen before', async () => {
    const event = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { metadata: { wsId: 'ws-1' } } },
    } as any;
    await dispatchWebhook(dbMock, 'app-1', event, handlers);
    expect(handlerCalls).toEqual(['checkoutCompleted']);
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ type: 'checkout.session.completed', wsId: 'ws-1' }));
  });

  it('skips processing when event already in stripeEvents collection', async () => {
    mockExists.mockReturnValue(true);
    const event = { id: 'evt_1', type: 'checkout.session.completed', data: { object: { metadata: {} } } } as any;
    await dispatchWebhook(dbMock, 'app-1', event, handlers);
    expect(handlerCalls).toEqual([]);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('ignores unknown event types but still records them as processed', async () => {
    const event = { id: 'evt_2', type: 'ping.unknown', data: { object: { metadata: {} } } } as any;
    await dispatchWebhook(dbMock, 'app-1', event, handlers);
    expect(handlerCalls).toEqual([]);
    expect(mockSet).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2-4: Implementar**

```ts
// functions/src/billing/webhook.ts
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { getStripe, stripeSecretKey, stripeWebhookSigningSecret } from './stripeClient';
import { handleCheckoutCompleted } from './handlers/checkoutCompleted';
import { handleSubscriptionUpdated } from './handlers/subscriptionUpdated';
import { handleSubscriptionDeleted } from './handlers/subscriptionDeleted';
import { handleInvoicePaymentSucceeded } from './handlers/invoicePaymentSucceeded';
import { handleInvoicePaymentFailed } from './handlers/invoicePaymentFailed';

type WebhookHandler = (db: Firestore, event: Stripe.Event) => Promise<void>;

export async function dispatchWebhook(
  db: Firestore,
  appId: string,
  event: Stripe.Event,
  handlers: Record<string, WebhookHandler>,
): Promise<void> {
  const eventRef = db.doc(`artifacts/${appId}/stripeEvents/${event.id}`);
  const existing = await eventRef.get();
  if (existing.exists) {
    console.log('[stripeWebhook] duplicate event, skipping', event.id);
    return;
  }

  const wsId = (event.data.object as any).metadata?.wsId ?? null;
  const handler = handlers[event.type];
  if (handler) {
    try {
      await handler(db, event);
    } catch (err) {
      console.error('[stripeWebhook] handler failed', { eventId: event.id, type: event.type, err });
      throw err; // let Stripe retry
    }
  }

  await eventRef.set({
    type: event.type,
    processedAt: FieldValue.serverTimestamp(),
    wsId,
  });
}

const HANDLERS: Record<string, WebhookHandler> = {
  'checkout.session.completed': handleCheckoutCompleted as WebhookHandler,
  'customer.subscription.updated': handleSubscriptionUpdated as WebhookHandler,
  'customer.subscription.deleted': handleSubscriptionDeleted as WebhookHandler,
  'invoice.payment_succeeded': handleInvoicePaymentSucceeded as WebhookHandler,
  'invoice.payment_failed': handleInvoicePaymentFailed as WebhookHandler,
};

export const stripeWebhook = onRequest(
  {
    secrets: [stripeSecretKey, stripeWebhookSigningSecret],
    region: 'europe-west1',
  },
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string | undefined;
    if (!sig) {
      res.status(400).send('Missing stripe-signature header');
      return;
    }

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(req.rawBody, sig, stripeWebhookSigningSecret.value());
    } catch (err) {
      console.error('[stripeWebhook] signature verification failed', err);
      res.status(400).send(`Webhook signature error: ${(err as Error).message}`);
      return;
    }

    const appId = process.env.PICK_APP_ID || 'uros-fbm-app';
    try {
      await dispatchWebhook(getFirestore(), appId, event, HANDLERS);
      res.status(200).send('ok');
    } catch (err) {
      res.status(500).send(`Handler error: ${(err as Error).message}`);
    }
  },
);
```

- [ ] **Step 5: Run tests + commit**

```bash
cd functions && npx vitest run src/billing/webhook.test.ts
git add functions/src/billing/webhook.ts functions/src/billing/webhook.test.ts
git commit -m "feat(billing): stripeWebhook dispatcher with idempotency"
```

---

### Task 30: Firestore rules para stripeEvents

**Files:**

- Modify: `firestore.rules`
- Modify: `firestore.rules.test.ts`

- [ ] **Step 1: Test (failing)**

Añadir al test file:

```ts
describe('stripeEvents/{eventId}', () => {
  it('nobody can read or write from client', async () => {
    const aliceContext = testEnv.authenticatedContext('alice');
    const ref = aliceContext.firestore().doc('artifacts/test-app/stripeEvents/evt_xyz');
    await assertFails(ref.get());
    await assertFails(ref.set({ type: 'test' }));
  });
});
```

- [ ] **Step 2: Run rules test (failing)**

```bash
npx vitest --config vitest.rules.config.js run
```

Expected: 2 fails (no rule yet, default permitting reads).

- [ ] **Step 3: Modificar rules**

Añadir antes del `match /artifacts/{appId}/users/...`:

```firestore
match /artifacts/{appId}/stripeEvents/{eventId} {
  allow read, write: if false;  // Solo Admin SDK (Cloud Functions)
}
```

- [ ] **Step 4: Run rules tests**

```bash
npx vitest --config vitest.rules.config.js run
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules firestore.rules.test.ts
git commit -m "feat(rules): stripeEvents read-only via Admin SDK"
```

---

### Task 31: Exportar 3 nuevas funciones en index.ts

**Files:**

- Modify: `functions/src/index.ts`

- [ ] **Step 1: Añadir re-exports al final del archivo**

```ts
// Al final de functions/src/index.ts, después del último export existente
export { createCheckoutSession } from './billing/createCheckoutSession';
export { createPortalSession } from './billing/createPortalSession';
export { stripeWebhook } from './billing/webhook';
```

- [ ] **Step 2: Build**

```bash
cd functions && npm run build
```

Expected: clean compile.

- [ ] **Step 3: Commit**

```bash
git add functions/src/index.ts
git commit -m "feat(billing): export Stripe Cloud Functions"
```

---

### Task 32: Configure Stripe Dashboard (operativa)

**Files:** ninguno tocado.

- [ ] **Step 1: Crear Product + Prices**

Stripe Dashboard → Products → Create:

- Name: `Pick Pro`
- Description: `Acciones de IA ilimitadas en Pick&Coach. Pasa a Pro y Pick deja de mirar el reloj.`
- Pricing → Add price:
  - **Mensual**: €4,99 EUR · Recurring monthly · **Volume** mode con un solo tier
  - **Anual**: €49,00 EUR · Recurring yearly · **Volume** mode con un solo tier
- Copiar los Price IDs (`price_...`).

- [ ] **Step 2: Habilitar Stripe Tax**

Dashboard → Settings → Tax → Activate. Jurisdicción: Spain.

- [ ] **Step 3: Habilitar Stripe Invoicing**

Settings → Billing → Customer emails → Invoice emails: ON.

- [ ] **Step 4: Configurar webhook endpoint**

Developers → Webhooks → Add endpoint:

- Endpoint URL: `https://europe-west1-playoff-creator.cloudfunctions.net/stripeWebhook`
- Events to send:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- Copiar el signing secret (`whsec_...`).

- [ ] **Step 5: Crear promotion code DEV100**

Dashboard → Products → Coupons → Create:

- Type: 100% off · Forever
- Coupon code: `DEV100`
- Active: ON

- [ ] **Step 6: Inyectar todos los secrets en Firebase**

```bash
echo "<sk_live_...>" | firebase functions:secrets:set STRIPE_SECRET_KEY --project playoff-creator --data-file=-
echo "<whsec_...>" | firebase functions:secrets:set STRIPE_WEBHOOK_SIGNING_SECRET --project playoff-creator --data-file=-
echo "<price_monthly_id>" | firebase functions:secrets:set STRIPE_PRICE_MONTHLY --project playoff-creator --data-file=-
echo "<price_annual_id>" | firebase functions:secrets:set STRIPE_PRICE_ANNUAL --project playoff-creator --data-file=-
```

(Operativa, sin commit.)

---

### Task 33: Deploy PR #3

- [ ] **Step 1: Push branch + PR + merge**

```bash
git push -u origin feat/sub-proyecto-5-paywall-stripe-backend
gh pr create --title "feat(billing): backend Stripe (sub-proyecto 5 PR #3)" --body "$(cat <<'EOF'
## Summary
- 3 Cloud Functions nuevas: createCheckoutSession, createPortalSession, stripeWebhook (con signature validation + idempotency).
- 5 webhook handlers: checkoutCompleted, subscriptionUpdated, subscriptionDeleted, invoicePaymentSucceeded, invoicePaymentFailed.
- Reglas Firestore añaden stripeEvents read-only via Admin SDK.
- Stripe SDK 17.x + secrets (sk_live, whsec, price IDs) inyectados via Firebase Functions secrets.

## Test plan
- [ ] Vitest backend pasa: createCheckoutSession.test, createPortalSession.test, webhook.test, handlers/*.test
- [ ] Stripe CLI: \`stripe trigger checkout.session.completed\` → stripeEvents/{eventId} se crea en Firestore
- [ ] Stripe Dashboard webhook endpoint recibe 200 OK en cada evento

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Deploy**

```bash
firebase deploy --only functions,firestore:rules --project playoff-creator
```

Expected: 3 nuevas functions visibles (`createCheckoutSession`, `createPortalSession`, `stripeWebhook`).

- [ ] **Step 3: Smoke con Stripe CLI**

Instalar Stripe CLI y enviar evento de prueba:

```bash
stripe listen --forward-to https://europe-west1-playoff-creator.cloudfunctions.net/stripeWebhook
stripe trigger checkout.session.completed
```

Verificar en Firestore Console que `artifacts/uros-fbm-app/stripeEvents/<eventId>` se creó.

(El user no puede aún hacer upgrade real porque la pantalla `/upgrade` no existe — eso es PR #4.)

---

## PR #4 — Frontend Stripe + lanzamiento

Tras este PR, los users free pueden hacer upgrade real. Es el momento del **launch**.

### Task 34: Install Stripe.js + react-stripe-js

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install @stripe/stripe-js@^4 @stripe/react-stripe-js@^3
```

- [ ] **Step 2: Verify**

```bash
grep -E '"@stripe/(stripe-js|react-stripe-js)"' package.json
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(billing): install @stripe/stripe-js and react-stripe-js"
```

---

### Task 35: UpgradePage component con Embedded Checkout

**Files:**

- Create: `src/billing/components/UpgradePage.jsx`

- [ ] **Step 1: Implementar**

```jsx
// src/billing/components/UpgradePage.jsx
import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { httpsCallable } from 'firebase/functions';
import { useFirebase } from '../../contexts/FirebaseContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

const PRICE_MONTHLY = import.meta.env.VITE_STRIPE_PRICE_MONTHLY;
const PRICE_ANNUAL = import.meta.env.VITE_STRIPE_PRICE_ANNUAL;

export function UpgradePage() {
  const { functions, appId } = useFirebase();
  const { activeWsId } = useWorkspace();
  const [billingPeriod, setBillingPeriod] = useState('monthly'); // 'monthly' | 'annual'
  const [clientSecret, setClientSecret] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!activeWsId || !functions || !appId) return;
    const priceId = billingPeriod === 'annual' ? PRICE_ANNUAL : PRICE_MONTHLY;
    const fn = httpsCallable(functions, 'createCheckoutSession');
    fn({ wsId: activeWsId, appId, priceId })
      .then(({ data }) => setClientSecret(data.clientSecret))
      .catch((err) => setError(err.message));
  }, [functions, appId, activeWsId, billingPeriod]);

  if (error) {
    return <div className="p-8 text-red-600">No se pudo iniciar el checkout: {error}</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Hazte Pro</h1>
      <p className="text-zinc-600 mb-6">Pick deja de mirar el reloj. Acciones de IA ilimitadas en tu workspace.</p>

      <div className="flex gap-4 mb-6">
        <button
          type="button"
          onClick={() => setBillingPeriod('monthly')}
          className={`px-4 py-2 rounded ${billingPeriod === 'monthly' ? 'bg-blue-600 text-white' : 'bg-zinc-100'}`}
        >
          €4,99/mes
        </button>
        <button
          type="button"
          onClick={() => setBillingPeriod('annual')}
          className={`px-4 py-2 rounded ${billingPeriod === 'annual' ? 'bg-blue-600 text-white' : 'bg-zinc-100'}`}
        >
          €49/año <span className="text-xs">(2 meses gratis)</span>
        </button>
      </div>

      {clientSecret && stripePromise ? (
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      ) : (
        <div className="p-8 text-center text-zinc-500">Cargando checkout…</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Añadir env vars frontend**

Añadir a `.env.local` (no commitear) y `.env.example`:

```
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_STRIPE_PRICE_MONTHLY=price_...
VITE_STRIPE_PRICE_ANNUAL=price_...
```

- [ ] **Step 3: Commit**

```bash
git add src/billing/components/UpgradePage.jsx .env.example
git commit -m "feat(billing): UpgradePage with Embedded Checkout"
```

---

### Task 36: UpgradeSuccessPage con polling

**Files:**

- Create: `src/billing/components/UpgradeSuccessPage.jsx`

- [ ] **Step 1: Implementar**

```jsx
// src/billing/components/UpgradeSuccessPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspacePlan } from '../useWorkspacePlan';
import { useWorkspace } from '../../contexts/WorkspaceContext';

const TIMEOUT_MS = 8000;

export function UpgradeSuccessPage() {
  const navigate = useNavigate();
  const { activeWsId } = useWorkspace();
  const { isPro, loading } = useWorkspacePlan(activeWsId);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loading && isPro) {
      navigate('/area-privada/?upgraded=true');
    }
  }, [loading, isPro, navigate]);

  if (timedOut && !isPro) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <h1 className="text-xl font-semibold mb-2">Procesando tu pago…</h1>
        <p className="text-zinc-600 mb-4">
          Recibirás un email de confirmación en breves. Tu Pro estará activo cuando el banner desaparezca de tu home.
        </p>
        <button
          type="button"
          onClick={() => navigate('/area-privada/')}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Volver al home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-8 text-center">
      <h1 className="text-xl font-semibold mb-2">Activando tu Pro…</h1>
      <p className="text-zinc-600">Un momento.</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/billing/components/UpgradeSuccessPage.jsx
git commit -m "feat(billing): UpgradeSuccessPage with polling fallback"
```

---

### Task 37: BillingSection en settings

**Files:**

- Create: `src/billing/components/BillingSection.jsx`

- [ ] **Step 1: Implementar**

```jsx
// src/billing/components/BillingSection.jsx
import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useFirebase } from '../../contexts/FirebaseContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useWorkspacePlan } from '../useWorkspacePlan';

export function BillingSection() {
  const { functions, appId } = useFirebase();
  const { activeWsId, isOwner } = useWorkspace();
  const { plan, billing, cancelAtPeriodEnd, currentPeriodEnd } = useWorkspacePlan(activeWsId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOwner) return null; // Solo el owner ve este panel

  const openPortal = async () => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, 'createPortalSession');
      const { data } = await fn({
        wsId: activeWsId,
        appId,
        returnUrl: window.location.href,
      });
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <section className="p-4 border-t">
      <h3 className="text-sm font-semibold mb-3">Plan y suscripción</h3>
      {plan === 'free' ? (
        <div>
          <p className="text-sm text-zinc-600 mb-3">Estás en plan Free.</p>
          <a href="/upgrade" className="inline-block px-4 py-2 bg-blue-600 text-white rounded text-sm">
            Hazte Pro
          </a>
        </div>
      ) : (
        <div>
          <p className="text-sm text-zinc-700 mb-1">
            <strong>Pro</strong>
            {cancelAtPeriodEnd && currentPeriodEnd
              ? ` hasta ${currentPeriodEnd.toLocaleDateString('es-ES')}`
              : ' · activo'}
          </p>
          {billing?.status === 'past_due' && (
            <p className="text-amber-700 text-xs mb-2">⚠ Tu pago ha fallado. Actualiza tu tarjeta abajo.</p>
          )}
          <button
            type="button"
            onClick={openPortal}
            disabled={loading}
            className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded text-sm"
          >
            {loading ? 'Abriendo…' : 'Gestionar suscripción'}
          </button>
          {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/billing/components/BillingSection.jsx
git commit -m "feat(billing): BillingSection in settings drawer"
```

---

### Task 38: PaymentFailedBanner

**Files:**

- Create: `src/billing/components/PaymentFailedBanner.jsx`

- [ ] **Step 1: Implementar**

```jsx
// src/billing/components/PaymentFailedBanner.jsx
import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useFirebase } from '../../contexts/FirebaseContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useWorkspacePlan } from '../useWorkspacePlan';

export function PaymentFailedBanner() {
  const { functions, appId } = useFirebase();
  const { activeWsId, isOwner } = useWorkspace();
  const { isPastDue, isPro } = useWorkspacePlan(activeWsId);
  const [loading, setLoading] = useState(false);

  if (!isPro || !isPastDue) return null;

  const openPortal = async () => {
    setLoading(true);
    try {
      const fn = httpsCallable(functions, 'createPortalSession');
      const { data } = await fn({
        wsId: activeWsId,
        appId,
        returnUrl: window.location.href,
      });
      window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-3 flex items-center justify-between text-sm">
      <span className="text-red-900">Tu pago ha fallado. Actualiza tu tarjeta o el equipo se queda sin Pick.</span>
      {isOwner && (
        <button
          type="button"
          onClick={openPortal}
          disabled={loading}
          className="ml-4 px-3 py-1 bg-red-600 text-white rounded text-xs"
        >
          {loading ? 'Abriendo…' : 'Actualizar tarjeta'}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/billing/components/PaymentFailedBanner.jsx
git commit -m "feat(billing): PaymentFailedBanner persistent"
```

---

### Task 39: AppRouter rutas + AppShell wires

**Files:**

- Modify: `src/AppRouter.jsx`
- Modify: `src/shell/AppShell.jsx`
- Modify: `src/screens/HomeScreen.jsx` (settings drawer)

- [ ] **Step 1: AppRouter rutas**

```jsx
// src/AppRouter.jsx — añadir imports + rutas lazy
const UpgradePage = lazy(() => import("./billing/components/UpgradePage").then(m => ({ default: m.UpgradePage })));
const UpgradeSuccessPage = lazy(() => import("./billing/components/UpgradeSuccessPage").then(m => ({ default: m.UpgradeSuccessPage })));

// En el <Routes>:
<Route path="/upgrade" element={<ModuleBoundary><UpgradePage /></ModuleBoundary>} />
<Route path="/upgrade/success" element={<ModuleBoundary><UpgradeSuccessPage /></ModuleBoundary>} />
```

- [ ] **Step 2: AppShell mount PaymentFailedBanner**

```jsx
// src/shell/AppShell.jsx
import { PaymentFailedBanner } from '../billing/components/PaymentFailedBanner';

// Top of layout:
<PaymentFailedBanner />;
```

- [ ] **Step 3: HomeScreen settings drawer**

```jsx
// src/screens/HomeScreen.jsx
import { BillingSection } from '../billing/components/BillingSection';

// Dentro del drawer/menú de ajustes:
<BillingSection />;
```

- [ ] **Step 4: Verificar visual en dev**

```bash
npm run dev
```

Login con cuenta free, navegar a `/upgrade`, ver el embedded checkout cargar. Settings drawer → ver "Hazte Pro" CTA.

- [ ] **Step 5: Commit**

```bash
git add src/AppRouter.jsx src/shell/AppShell.jsx src/screens/HomeScreen.jsx
git commit -m "feat(billing): wire upgrade routes, banner, billing section"
```

---

### Task 40: Smoke checklist runbook

**Files:**

- Create: `docs/runbooks/sub-proyecto-5-smoke.md`

- [ ] **Step 1: Crear**

```markdown
# Sub-proyecto 5 — Smoke checklist B2C paywall

Ejecutar contra **staging** (proyecto Firebase distinto, Stripe test keys, tarjetas test) antes de cada cambio Stripe-related en prod.

Cuentas necesarias en staging: `serpa+test1@gmail.com`, `serpa+test2@gmail.com`, `serpa+test3@gmail.com`.

## Camino feliz: Free → Pro → Cancel

- [ ] **Cuenta nueva** → registrar, confirmar `plan: 'free'` y counter `0/50` visible.
- [ ] **50 mensajes a Pick** rapid-fire → counter avanza, sin errores.
- [ ] **Banner amarillo aparece** desde 40/50 con CTA "Hazte Pro".
- [ ] **Mensaje 51** → modal aparece con copy correcto y botones "Hazte Pro" / "Vuelvo el día 1".
- [ ] **Click "Hazte Pro"** → `/upgrade` carga, embedded checkout aparece.
- [ ] **Tarjeta `4242 4242 4242 4242`**, fecha futura, CVC `123`, NIF opcional → confirmar.
- [ ] **Redirect a `/upgrade/success`** → spinner → redirect a `/area-privada/?upgraded=true` con toast.
- [ ] **Verificar en Firestore Console**: `workspaces/<ws>.plan === 'pro'` y `billing.status === 'active'`.
- [ ] **Verificar en Stripe Dashboard**: subscription activa, factura emitida con IVA 21%.
- [ ] **60 mensajes a Pick estando Pro** → counter no aparece, sin gating.
- [ ] **Settings → "Gestionar suscripción"** → portal Stripe abre.
- [ ] **Cancel subscription** en portal → vuelta a app → `BillingSection` muestra "Pro hasta DD/MM/YYYY".
- [ ] **Stripe Dashboard → forzar end of period** → verificar webhook → `plan` vuelve a `'free'` → counter aparece.

## Caminos de error

- [ ] **Tarjeta `4000 0000 0000 0341`** (decline at renewal) → invoice.payment_failed → banner rojo `PaymentFailedBanner` aparece.
- [ ] **Stripe Dashboard → cancel subscription manualmente** → plan vuelve a free.
- [ ] **Webhook duplicado** (Stripe Dashboard → Resend webhook event) → `stripeEvents/<eventId>` solo se crea una vez, handler no corre dos veces.

## Reglas Firestore

- [ ] **Cliente intenta escribir `usage/2026-05`** → permission denied (verificar via Console o devtools network tab).
- [ ] **Cliente intenta leer `stripeEvents/...`** → permission denied.
- [ ] **Owner puede leer su `usage/2026-05`** → OK.

## Proactive engine

- [ ] **Workspace en cap free** → `proactiveDailyBriefing` no genera notif para esa cuenta, log `BRIEFING_SKIPPED_QUOTA`.
- [ ] **Otros workspaces** siguen procesándose en el mismo run.

## Rollback plan

Si aparece bug crítico tras lanzar:

1. Quitar el spec del header del `aiChat` (cambiar `await assertWithinQuota(...)` a `// await assertWithinQuota(...)`).
2. Redeploy functions.
3. Investigar offline. Los datos de `usage` siguen ahí intactos para retomarlo.
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/sub-proyecto-5-smoke.md
git commit -m "docs(runbooks): sub-proyecto 5 smoke checklist"
```

---

### Task 41: E2E manual sobre staging

**Files:** ninguno tocado.

- [ ] **Step 1: Configurar staging**

(Si no existe ya un proyecto Firebase de staging, crear `playoff-creator-staging`.)

- Usar Stripe test keys (`sk_test_...`, `pk_test_...`).
- Configurar webhook endpoint en Stripe → URL del staging Cloud Function.
- Deploy del PR completo a staging.

- [ ] **Step 2: Ejecutar smoke checklist**

Ir punto por punto del runbook recién creado. Marcar cada checkbox.

- [ ] **Step 3: Si todos pasan, mergeable a prod**

Si algo falla, abrir issue, fix, repetir.

(Sin commit. Operativa.)

---

### Task 42: Deploy PR #4 — el lanzamiento

- [ ] **Step 1: Push branch + PR + merge**

```bash
git push -u origin feat/sub-proyecto-5-paywall-stripe-frontend
gh pr create --title "feat(billing): frontend Stripe + lanzamiento (sub-proyecto 5 PR #4)" --body "$(cat <<'EOF'
## Summary
- UpgradePage con Embedded Checkout + selector mensual/anual.
- UpgradeSuccessPage con polling al workspace doc + fallback a 8s.
- BillingSection en settings drawer (solo owner): plan actual + redirect al Customer Portal hosted.
- PaymentFailedBanner persistente cuando billing.status === 'past_due'.
- Rutas `/upgrade` y `/upgrade/success` lazy-loaded en AppRouter.
- Smoke runbook documentado en docs/runbooks/sub-proyecto-5-smoke.md.

## Test plan
- [ ] Smoke checklist completa pasada en staging (todas las cuentas test)
- [ ] Smoke en prod con cuenta secundaria (cancelar antes de 14 días)
- [ ] Verificar VITE_STRIPE_* env vars cargan en build de prod

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Inyectar publishable key + price IDs como build env vars**

Las `VITE_STRIPE_*` se inyectan en tiempo de build (Vite las bundlea en el JS del cliente; los Price IDs y la publishable key son públicos por diseño de Stripe). Crear `.env.production` en el root del repo (gitignored, NO commitear):

```
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxx
VITE_STRIPE_PRICE_MONTHLY=price_pro_monthly_real_id
VITE_STRIPE_PRICE_ANNUAL=price_pro_annual_real_id
```

`npm run build` recoge automáticamente este archivo. Si el deploy se hace desde CI (GitHub Actions), inyectar las tres como secrets del CI y exportarlas al entorno antes del build.

(Estos son ENV de build, no secrets de Functions. Los secrets de backend `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SIGNING_SECRET` ya viven en Firebase Functions secrets desde Task 32.)

- [ ] **Step 3: Deploy**

```bash
firebase deploy --only hosting --project playoff-creator
```

- [ ] **Step 4: Smoke en prod (cuenta secundaria)**

Cuenta `serpa+test1@gmail.com` en prod:

- Hacer upgrade real con tarjeta de verdad (€4,99). Asumir el coste como validación.
- Verificar webhook llega, plan transiciona, factura llega por email.
- Cancelar antes de los 14 días para minimizar coste irrecuperable.

- [ ] **Step 5: Anunciar a la base actual (WhatsApp a tu pareja, no email masivo)**

"Si entras al área privada y haces más de 50 acciones de IA al mes, ahora hay un Pro a €4,99/mes. Mensaje de Pick si llegas al cap."

---

## PR #5 — Polish

### Task 43: Copy review en voz Pick

**Files:**

- Modify: todos los componentes de `src/billing/components/`

- [ ] **Step 1: Pasada de copy**

Revisar cada string user-facing y validar contra PRODUCT.md voz Pick:

- Tutea (no usted)
- Lenguaje del baloncesto cuando aplique
- "Pick deja de mirar el reloj" en lugar de "AI requests unlimited"
- "Acciones de IA" no "tokens" ni "API calls"

Editar inline. Si algún copy se siente forzado, dejarlo como está pero anotarlo en un follow-up.

- [ ] **Step 2: Commit**

```bash
git add src/billing/components/
git commit -m "polish(billing): copy review in voz Pick"
```

---

### Task 44: Micro-anim del counter al incrementar

**Files:**

- Modify: `src/billing/components/UsageCounter.jsx`

- [ ] **Step 1: Añadir transición**

```jsx
// Añadir useState + useEffect para detectar cambio en count
import { useEffect, useState } from 'react';

export function UsageCounter() {
  // ... state existente ...
  const [bump, setBump] = useState(false);
  useEffect(() => {
    if (count > 0) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 300);
      return () => clearTimeout(t);
    }
  }, [count]);

  return (
    <span
      className={`inline-flex items-center text-xs font-medium transition-transform ${tone} ${bump ? 'scale-110' : ''}`}
      // ... resto ...
    >
      {count}/{limit} IA
    </span>
  );
}
```

- [ ] **Step 2: Respetar prefers-reduced-motion**

```jsx
const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Solo aplicar bump si !prefersReducedMotion
```

- [ ] **Step 3: Commit**

```bash
git add src/billing/components/UsageCounter.jsx
git commit -m "polish(billing): micro-anim counter, respeta reduced-motion"
```

---

### Task 45: a11y check + final commit

**Files:**

- Modify: cualquier componente con problemas de a11y detectados.

- [ ] **Step 1: Run axe-core scan**

```bash
npm run dev
# En otro terminal o devtools:
# Abrir /upgrade, /area-privada con free user al cap, etc.
# Run axe-core extension or programmatic scan
```

- [ ] **Step 2: Fix issues**

- Asegurar `aria-label` en todos los buttons-icono
- Asegurar landmark `role="dialog"` + `aria-modal="true"` + `aria-labelledby` en modal
- Asegurar contraste text/bg en banners

- [ ] **Step 3: Commit + push + merge PR #5**

```bash
git add src/billing/components/
git commit -m "polish(billing): a11y improvements (landmarks, aria-labels, contrast)"
git push
gh pr create --title "polish(billing): copy review + micro-anim + a11y (sub-proyecto 5 PR #5)" --body "$(cat <<'EOF'
## Summary
- Pasada de copy en todos los componentes de billing alineado con voz Pick (PRODUCT.md).
- Micro-animación al incrementar el counter, respetando prefers-reduced-motion.
- A11y: aria-label en botones-icono, role="dialog" + aria-modal en QuotaExceededModal, contraste verificado.

## Test plan
- [ ] Visual review en light + dark theme
- [ ] axe-core scan limpio en /upgrade, /area-privada con free user al cap, settings drawer
- [ ] Lectura de pantalla (VoiceOver/NVDA) anuncia counter y modal correctamente
- [ ] Toggle prefers-reduced-motion en system → counter no anima

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Cierre del sub-proyecto

Una vez PR #5 mergeado:

- [ ] **Actualizar memoria** `project_subproyecto_1_status.md` añadiendo "Sub-proyecto 5 desplegado YYYY-MM-DD, MMR comenzando".
- [ ] **Crear nueva memoria** `project_subproyecto_5_status.md` con: estado prod, MMR observado primer mes, conversion rate Free→Pro, lessons learned.
- [ ] **Limpiar `MEMORY.md`** entry stale y añadir la nueva.
- [ ] **Borrar branches feature** mergeadas:

```bash
git push origin --delete feat/sub-proyecto-5-paywall
git push origin --delete feat/sub-proyecto-5-paywall-frontend-gating
git push origin --delete feat/sub-proyecto-5-paywall-stripe-backend
git push origin --delete feat/sub-proyecto-5-paywall-stripe-frontend
```

Sub-proyecto 5 cerrado. Sucesor: sub-proyecto 6 (B2B per-seat) reutilizando la infraestructura Stripe creada aquí.

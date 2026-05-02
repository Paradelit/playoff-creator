# Sub-proyecto 1.5 — Cloud Functions migration + signup bootstrap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el lado Cloud Functions (`functions/src/...`) al modelo `workspaces/{wsId}/...`, añadir un `auth.user().onCreate` trigger que bootstrappea workspace para nuevos signups, y reordenar el cutover runbook. Tras esto, el cutover a producción es ejecutable.

**Architecture:** El `aiChat` callable acepta un nuevo `wsId` field en el body, valida `isWorkspaceMember(wsId, userId)` server-side, y construye un `ToolContext` con `userId` (audit) + `wsId` (paths). Los read tools, proactiveEngine, dataCleanup, y RAG/digest/memory rebuilders consumen `wsId` y operan sobre `workspaces/{wsId}/...`. El bootstrap trigger crea workspace + member + cache atómicamente para cada nuevo user de Firebase Auth. Los scripts de migración exigen `--app-id` explícito.

**Tech Stack:** Firebase Functions v2 (`firebase-functions@^7.2.5`), Firebase Admin SDK (`firebase-admin@^13.0.0`), Vitest 4 (test config en `functions/vitest.config.ts`, fakeFirestore pattern por convención de `dataCleanup.test.ts`), TypeScript 5.8.

**Spec base:** `docs/superpowers/specs/2026-05-01-sub-proyecto-1-5-cloud-functions-migration-design.md`. Predecesor: `docs/superpowers/specs/2026-05-01-sub-proyecto-1-modelo-cuenta-workspace-migracion-design.md` (PR #8 cliente-side foundation).

**Branch:** `feat/workspaces-foundation` (continúa el branch de sub-proyecto 1; PR #8 absorbe estos commits o se crea PR #9 stacked).

---

## File Structure

### Files to create

| Path                                                 | Responsibility                                                                                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions/src/auth/onUserCreate.ts`                 | `bootstrapPersonalWorkspace(user)` que crea workspace + member + memberships cache atómicamente. Export del trigger registrado en `functions/src/index.ts`. |
| `functions/src/auth/__tests__/onUserCreate.test.ts`  | Tests con `FakeFirestore` para el bootstrap function.                                                                                                       |
| `functions/src/ai/tools/__tests__/readTools.test.ts` | Smoke tests representativos por categoría de read tool (team, bracket, exercise, cuaderno, scouting, calendar).                                             |
| `functions/src/__tests__/wsIdValidation.test.ts`     | Tests para la validación `wsId` + `isWorkspaceMember` en `aiChat` callable.                                                                                 |
| `functions/src/proactiveEngine.test.ts`              | Tests para la iteración sobre workspaces y la escritura de notif con `wsId`.                                                                                |

### Files to modify

| Path                                       | Cambio                                                                                                                                                                                                                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions/src/ai/tools/registry.ts`       | Añadir `wsId: string` al `ToolContext` interface.                                                                                                                                                                                                                          |
| `functions/src/ai/tools/readTools.ts`      | 13 path swaps `users/${ctx.userId}` → `workspaces/${ctx.wsId}`.                                                                                                                                                                                                            |
| `functions/src/ai/tools/memoryTools.ts`    | Path swap a `workspaces/${ctx.wsId}/memory/...`.                                                                                                                                                                                                                           |
| `functions/src/ai/userRagService.ts`       | `userBaseRef` renombrado/sustituido por `workspaceBaseRef(wsId)`. Path a `workspaces/${wsId}/ragIndex/...`.                                                                                                                                                                |
| `functions/src/ai/userDigest.ts`           | Idem, `workspaces/${wsId}/digest/...`.                                                                                                                                                                                                                                     |
| `functions/src/proactiveEngine.ts`         | Loop principal itera workspaces; queries de teams/calendarSessions bajo workspace; notif write incluye `wsId` field.                                                                                                                                                       |
| `functions/src/dataCleanup.ts`             | `CleanupParams` añade `wsId`. Helpers `userRoot`/`userCol` complementados con `workspaceRoot(wsId)`/`workspaceCol(wsId, name)`. Cascades operan bajo `workspaces/{wsId}/...`. `deleteAllUserData` itera `users/{uid}/memberships` y diferencia workspace personal vs club. |
| `functions/src/dataCleanup.test.ts`        | Tests existentes adaptados al nuevo schema; nuevo test para `deleteAllUserData` con personal + (mock) club.                                                                                                                                                                |
| `functions/src/index.ts`                   | (a) `aiChat` callable extrae `wsId` de `request.data` y valida `isWorkspaceMember`; toolCtx pasa `wsId`. (b) `cleanupUserData` callable extrae `wsId` y lo pasa a `runCleanupUserData`. (c) Export del nuevo `onUserCreate` trigger.                                       |
| `src/hooks/usePick.ts`                     | Cuando invoca el `aiChat` callable, añade `wsId: activeWsId` al body; gateado por `activeWsId !== null`.                                                                                                                                                                   |
| `src/services/dataCleanupService.ts`       | Cada función expuesta (`deleteTeamCascade`, `deleteBracketCascade`, `deleteConversationCascade`, `deleteAllUserDataCascade`) acepta y reenvía `wsId` al callable.                                                                                                          |
| `src/services/settingsService.js`          | `deleteAllUserData(appId)` evolucionará en sub-proyecto 2 con GDPR; aquí solo pasa `wsId` cuando aplique. (Si la función no necesita `wsId` por iterar memberships server-side, se queda como está.)                                                                       |
| `src/services/teamsService.js`             | El call site de `deleteTeamCascade` pasa `wsId`.                                                                                                                                                                                                                           |
| `src/hooks/useBracketSync.js`              | El call site de `deleteBracketCascade` pasa `wsId`.                                                                                                                                                                                                                        |
| `src/hooks/useConversationPersistence.ts`  | El call site de `deleteConversationCascade` pasa `wsId` y `uid`.                                                                                                                                                                                                           |
| `scripts/migration/migrateToWorkspaces.js` | `parseArgs` rechaza ausencia de `--app-id`.                                                                                                                                                                                                                                |
| `scripts/migration/lib/migrateUser.js`     | Añade copia de `ragIndex/`, `digest/`, `memory/` desde `users/{uid}/` a `workspaces/{wsId}/`.                                                                                                                                                                              |
| `scripts/migration/lib/verify.js`          | Añade verificación de counts para `ragIndex`, `digest`, `memory`.                                                                                                                                                                                                          |
| `scripts/cleanupOldPaths.js`               | `parseArgs` rechaza ausencia de `--app-id`. `OLD_COLLECTIONS_TO_DELETE` añade `ragIndex`, `digest`, `memory`.                                                                                                                                                              |
| `docs/runbooks/cutover-smoke-checklist.md` | Reordenar el runbook (migrate antes de deploy code) y añadir 3 puntos de smoke específicos de 1.5.                                                                                                                                                                         |

### Files NOT touched

- `functions/src/ai/tools/writeTools.ts`: las write tools server-side proponen acciones que el cliente ejecuta vía `proposalExecutor` (ya migrado en sub-proyecto 1). No requieren cambio de path.
- `functions/src/ai/tools/agentTools.ts`, `navigationTools.ts`, `knowledgeTools.ts`, `userContextTools.ts`: revisarlos en Task 0.1 para confirmar que no construyen paths bajo `users/{uid}/...`. Si alguno lo hace, expandir scope; si no, dejar intactos.
- `functions/src/ai/agentOrchestrator.ts` / `agentRouter.ts` / agentes específicos: no construyen paths Firestore directamente; dependen del `ToolContext`.
- `firestore.rules`: ya cubren `workspaces/{wsId}/...` desde sub-proyecto 1.
- `firestore.indexes.json`: el composite `workspaces (type, ownerId)` ya está. Si nuevas queries de la migración requieren índices, se añaden en su task.

---

## Pre-flight

### Task 0.1: Verificar inventario de paths bajo `users/{uid}/...` en functions/

**Files:**

- Read-only audit: `functions/src/`

- [ ] **Step 1: Run grep**

```bash
cd functions
grep -rn 'users.*uid.*\(teams\|brackets\|calendarSessions\|exercises\|playoffConvocatorias\|conversations\|cuaderno\|scoutings\|analisis\|planillas\|ragIndex\|digest\|memory\)' src/ 2>&1 | grep -v '\.test\.' | grep -v '\.md:' | sort -u
```

Expected output: lines en `readTools.ts`, `proactiveEngine.ts`, `dataCleanup.ts`, `userDigest.ts`, `userRagService.ts`, `memoryTools.ts`. Si aparecen archivos NO listados en el File Structure section (e.g., `agentTools.ts`, `navigationTools.ts`, `knowledgeTools.ts`, `userContextTools.ts`), añadirlos al scope antes de seguir.

- [ ] **Step 2: Document findings**

Si hay hallazgos no anticipados, añade un comment en `docs/superpowers/specs/2026-05-01-sub-proyecto-1-5-cloud-functions-migration-design.md` (sección 1) listándolos. Esto NO es un commit; es solo verificación.

No commit.

### Task 0.2: Verificar branch state

- [ ] **Step 1: Confirm branch and clean tree**

```bash
git status
git branch --show-current
```

Expected: `feat/workspaces-foundation`, working tree clean (último commit `c60a404 docs(specs): sub-proyecto 1.5 ...`).

No commit.

---

## Commit 1: feat(pick): add wsId to ToolContext + orchestrator validation

### Task 1.1: Añadir `wsId` al `ToolContext` interface

**Files:**

- Modify: `functions/src/ai/tools/registry.ts:12-29`

- [ ] **Step 1: Edit the interface**

```ts
export interface ToolContext {
  db: Firestore;
  userId: string;
  wsId: string; // NUEVO — active workspace id, validated server-side before context creation
  appId: string;
  /** IDs inferred from the current screen — tools can use these as fallbacks
   *  when the LLM doesn't provide an explicit arg. */
  defaults?: {
    teamId?: string;
    sessionId?: string;
    bracketId?: string;
  };
  // Optional dependencies for agent-wrapper tools:
  agents?: AgentsMap;
  traceContext?: TraceContext;
  agentOptions?: AgentExecutionOptions;
  /** Gemini API key — needed by tools that call embedding or generation APIs directly. */
  geminiApiKey?: string;
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd functions
npm run build
```

Expected: build FAILS with TypeScript errors in every file that constructs a `ToolContext` without `wsId` (mainly `functions/src/index.ts:222-231`). This is expected; we'll fix in Task 1.2.

### Task 1.2: Validar `wsId` y construir ToolContext en `aiChat`

**Files:**

- Modify: `functions/src/index.ts:179-273` (the `aiChat` callable)

- [ ] **Step 1: Add wsId extraction + validation**

Replace the body of `aiChat` callable. Find the existing `const { message, screenContext, conversationHistory, appId, clientDate, conversationId } = request.data || {};` block (line 182) and update it:

```ts
const { message, screenContext, conversationHistory, appId, wsId, clientDate, conversationId } = request.data || {};
if (!message) throw new HttpsError('invalid-argument', 'Missing message');
if (!appId) throw new HttpsError('invalid-argument', 'Missing appId');
if (!wsId || typeof wsId !== 'string') {
  throw new HttpsError('invalid-argument', 'Missing or invalid wsId');
}

const system = getSystem();
const db = getFirestore();
const userId = request.auth.uid;

// Validate workspace membership server-side
const memberRef = db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${userId}`);
const memberSnap = await memberRef.get();
if (!memberSnap.exists) {
  throw new HttpsError('permission-denied', 'Not a member of this workspace');
}
```

Then find the `const toolCtx = { ... }` block (around line 222) and add `wsId`:

```ts
const toolCtx = {
  db,
  userId,
  wsId, // NUEVO
  appId,
  defaults,
  agents: system.agents,
  traceContext,
  agentOptions,
  geminiApiKey: geminiKey.value(),
};
```

- [ ] **Step 2: Find buildUserDigest call and add wsId**

Search the same `aiChat` body for `const userDigest = await buildUserDigest({ db, userId, appId, clientDate });` (line 201). Update to:

```ts
const userDigest = await buildUserDigest({ db, userId, wsId, appId, clientDate });
```

This pre-empts Task 5.2 (userDigest will need wsId).

- [ ] **Step 3: Run typecheck**

```bash
cd functions
npm run build
```

Expected: build FAILS with errors related to `buildUserDigest` not accepting `wsId` (it doesn't yet — fixed in Commit 5). For now, optionally suppress with `// @ts-expect-error wsId added in Task 5.2` on the `buildUserDigest` call to keep this task atomic. We'll remove the suppression in Task 5.2.

Alternative if you prefer atomic-task discipline: **revert the buildUserDigest change for now** and re-do it in Task 5.2. Pick whichever is cleaner.

If you take the suppression route, build passes. Move on.

### Task 1.3: Pasar `wsId` en `cleanupUserData` callable

**Files:**

- Modify: `functions/src/index.ts:301-343` (the `cleanupUserData` callable)

- [ ] **Step 1: Extract wsId from request.data**

Find:

```ts
const { action, appId, teamId, bracketId, conversationId } = request.data || {};
```

Update to:

```ts
const { action, appId, wsId, teamId, bracketId, conversationId } = request.data || {};
```

- [ ] **Step 2: Validate wsId for actions that need it**

After the existing validations of `appId` and `action`, add:

```ts
const actionsNeedingWsId: CleanupAction[] = ['deleteTeam', 'deleteBracket', 'deleteConversation'];
if (actionsNeedingWsId.includes(action as CleanupAction)) {
  if (!wsId || typeof wsId !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid wsId');
  }
}
// deleteAllUserData iterates memberships server-side and doesn't need wsId from client.
```

- [ ] **Step 3: Pass wsId to runCleanupUserData**

Find the call:

```ts
const result = await runCleanupUserData({
  db: getFirestore(),
  appId,
  userId: request.auth.uid,
  action: action as CleanupAction,
  teamId,
  bracketId,
  conversationId,
});
```

Update to:

```ts
const result = await runCleanupUserData({
  db: getFirestore(),
  appId,
  userId: request.auth.uid,
  wsId, // NUEVO (optional for deleteAllUserData)
  action: action as CleanupAction,
  teamId,
  bracketId,
  conversationId,
});
```

- [ ] **Step 4: Run typecheck**

```bash
cd functions
npm run build
```

Expected: build fails on `wsId` not being in `CleanupParams`. Fixed in Commit 4 (Task 4.1). For now, add `// @ts-expect-error wsId added in Task 4.1` on the call object literal.

### Task 1.4: Tests para validación `wsId` en `aiChat`

**Files:**

- Create: `functions/src/__tests__/wsIdValidation.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';

// Mock Firestore
const mockMemberGet = vi.fn();
const mockDoc = vi.fn(() => ({ get: mockMemberGet }));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ doc: mockDoc }),
}));

// Mock the system to avoid initializing the real one
vi.mock('../ai', () => ({
  AgentRouter: class {},
  ObservabilityService: class {
    flush = async () => {};
    createTrace = () => ({ id: 'test-trace' });
    getLangfuseClient = () => null;
    logScore = () => {};
  },
  LLMProvider: class {},
  PromptManager: class {},
  BracketAgent: class {},
  CalendarAgent: class {},
  ResultsAgent: class {},
  ConversationalAgent: class {},
  TrainingGeneratorAgent: class {},
  OrchestratorAgent: class {
    run = async () => ({ blocks: [], _autoEvalMetrics: undefined });
  },
  ToolRegistry: class {
    registerMany = () => {};
  },
  createReadTools: () => [],
  createWriteTools: () => [],
  createAgentTools: () => [],
  createMemoryTools: () => [],
  createNavigationTools: () => [],
  createKnowledgeTools: () => [],
  createUserContextTools: () => [],
  buildUserDigest: async () => ({}),
  AutoEvaluator: class {
    score = () => {};
  },
}));

// Re-create the relevant validation logic in isolation OR import the callable handler
// For simplicity, test the validation logic by importing the handler factory.
// (If aiChat's body is too coupled to onCall, refactor to extract a pure handler.)

// Approach: test by simulating request.data shapes against a wrapped function.
// If aiChat is exported only as the onCall result, you may need to factor out
// the inner handler. For this task, factor it out as `aiChatHandler(request, system, db)`.

describe('aiChat wsId validation', () => {
  beforeEach(() => {
    mockMemberGet.mockReset();
    mockDoc.mockClear();
  });

  it('throws invalid-argument when wsId is missing', async () => {
    // Arrange: request without wsId
    const request = {
      auth: { uid: 'user1' },
      data: { message: 'hi', appId: 'app1' },
    };

    // Act + Assert
    // The actual aiChat handler should throw HttpsError invalid-argument
    // ...assertion using whatever extraction approach you take...
    // For now, confirm the validation path is reachable.
    // (Concrete implementation depends on how aiChat is refactored; see note below.)
    expect(true).toBe(true); // placeholder until handler is extracted
  });
});
```

**Note on testing aiChat**: the current `aiChat` is defined inline as `export const aiChat = onCall({...}, async (request) => { ... })`. To test it cleanly, factor the inner async function into a separate exported handler. Add this refactor as part of Task 1.2:

```ts
// at the top of functions/src/index.ts, near aiChat
export async function aiChatHandler(
  request: { auth?: { uid: string }; data: Record<string, unknown> },
  system: System,
  db: Firestore,
) {
  // ... move the body of aiChat callable here ...
}

// then aiChat becomes:
export const aiChat = onCall({ ... }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const system = getSystem();
  const db = getFirestore();
  return aiChatHandler(request, system, db);
});
```

This makes the handler unit-testable without dragging in the full Firebase Functions runtime.

- [ ] **Step 2: Update Task 1.4 test to use the extracted handler**

Replace the placeholder in the test with concrete assertions:

```ts
import { aiChatHandler } from '../index';

describe('aiChat wsId validation', () => {
  it('throws invalid-argument when wsId is missing', async () => {
    const request = { auth: { uid: 'user1' }, data: { message: 'hi', appId: 'app1' } };
    const fakeSystem = {
      /* mocked */
    } as never;
    const fakeDb = { doc: mockDoc } as never;
    await expect(aiChatHandler(request, fakeSystem, fakeDb)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: expect.stringContaining('wsId'),
    });
  });

  it('throws permission-denied when user is not a member of wsId', async () => {
    mockMemberGet.mockResolvedValue({ exists: false });
    const request = {
      auth: { uid: 'user1' },
      data: { message: 'hi', appId: 'app1', wsId: 'ws-other' },
    };
    const fakeSystem = {
      /* mocked */
    } as never;
    const fakeDb = { doc: mockDoc } as never;
    await expect(aiChatHandler(request, fakeSystem, fakeDb)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('proceeds when wsId is provided and user is a member', async () => {
    mockMemberGet.mockResolvedValue({ exists: true });
    const request = {
      auth: { uid: 'user1' },
      data: { message: 'hi', appId: 'app1', wsId: 'ws1' },
    };
    const fakeSystem = {
      /* mocked with orchestrator.run returning { blocks: [], _autoEvalMetrics: undefined } */
    } as never;
    const fakeDb = { doc: mockDoc } as never;
    const result = await aiChatHandler(request, fakeSystem, fakeDb);
    expect(result.blocks).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd functions
npm test
```

Expected: 3 new tests pass.

### Task 1.5: Cliente envía `wsId` en `aiChat` callable

**Files:**

- Modify: `src/hooks/usePick.ts` (search for the call to `aiChat` callable)

- [ ] **Step 1: Find the callable invocation**

```bash
grep -n "aiChat\|httpsCallable.*aiChat" src/hooks/usePick.ts
```

The call typically looks like:

```ts
const aiChatFn = httpsCallable<RequestType, ResponseType>(functions, 'aiChat');
const result = await aiChatFn({ message, screenContext, conversationHistory, appId, clientDate, conversationId });
```

- [ ] **Step 2: Add useWorkspace + activeWsId**

At the top of the hook function, add:

```ts
import { useWorkspace } from '../contexts/WorkspaceContext';

// inside the hook:
const { activeWsId } = useWorkspace();
```

Then update the call body to include `wsId`:

```ts
if (!activeWsId) {
  // No workspace active — don't invoke. UI should already be gated.
  return;
}
const result = await aiChatFn({
  message,
  screenContext,
  conversationHistory,
  appId,
  wsId: activeWsId, // NUEVO
  clientDate,
  conversationId,
});
```

- [ ] **Step 3: Run client tests**

```bash
npm test
```

Expected: existing tests pass. If `usePick.test.tsx` exists and mocks the callable, update its mock setup to expect `wsId` in the body.

### Task 1.6: Commit "feat(pick): wsId in ToolContext + aiChat validation"

- [ ] **Step 1: Run lint + typecheck**

```bash
npm run lint
cd functions && npm run build && cd ..
```

Both should succeed (with the `@ts-expect-error` suppressions in place).

- [ ] **Step 2: Stage and commit**

```bash
git add functions/src/ai/tools/registry.ts functions/src/index.ts functions/src/__tests__/ src/hooks/usePick.ts
git commit -m "feat(pick): wsId in ToolContext, aiChat validates membership server-side

Add wsId field to ToolContext interface. aiChat callable extracts wsId from
request body, validates isWorkspaceMember(wsId, userId) via single doc read,
rejects with invalid-argument if missing or permission-denied if not a member.
cleanupUserData callable also accepts wsId for actions that need it. Client
(usePick) sends activeWsId from useWorkspace in the request body."
```

---

## Commit 2: feat(pick): readTools paths to workspaces/{wsId}

### Task 2.1: Swap los 13 paths en `readTools.ts`

**Files:**

- Modify: `functions/src/ai/tools/readTools.ts`

- [ ] **Step 1: Apply the swap to all 13 path constructions**

Each occurrence of the pattern `users/${ctx.userId}/...` becomes `workspaces/${ctx.wsId}/...`. Specific lines:

| Line | Before                                                                                        | After                                                                                            |
| ---- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 83   | `` `artifacts/${ctx.appId}/users/${ctx.userId}/teams/${teamId}` ``                            | `` `artifacts/${ctx.appId}/workspaces/${ctx.wsId}/teams/${teamId}` ``                            |
| 173  | `` `.../users/${ctx.userId}/exercises/${exerciseId}` ``                                       | `` `.../workspaces/${ctx.wsId}/exercises/${exerciseId}` ``                                       |
| 230  | `` `.../users/${ctx.userId}/teams/${teamId}/trainings/${trainingId}` ``                       | `` `.../workspaces/${ctx.wsId}/teams/${teamId}/trainings/${trainingId}` ``                       |
| 308  | `` `.../users/${ctx.userId}/brackets/${bracketId}` ``                                         | `` `.../workspaces/${ctx.wsId}/brackets/${bracketId}` ``                                         |
| 335  | (same shape as 308)                                                                           | (same swap)                                                                                      |
| 371  | `` `.../users/${ctx.userId}/teams/${teamId}/cuaderno/${section}` ``                           | `` `.../workspaces/${ctx.wsId}/teams/${teamId}/cuaderno/${section}` ``                           |
| 391  | `` `.../users/${ctx.userId}/teams/${teamId}/cuaderno/asistencia` ``                           | `` `.../workspaces/${ctx.wsId}/teams/${teamId}/cuaderno/asistencia` ``                           |
| 466  | `` `.../users/${ctx.userId}/teams/${teamId}/cuaderno/informe-jugadores` ``                    | `` `.../workspaces/${ctx.wsId}/teams/${teamId}/cuaderno/informe-jugadores` ``                    |
| 485  | `` `.../users/${ctx.userId}/teams/${teamId}/cuaderno/test-tiro` ``                            | `` `.../workspaces/${ctx.wsId}/teams/${teamId}/cuaderno/test-tiro` ``                            |
| 504  | `` `.../users/${ctx.userId}/scoutings/${sessionId}` ``                                        | `` `.../workspaces/${ctx.wsId}/scoutings/${sessionId}` ``                                        |
| 523  | `` `.../users/${ctx.userId}/analisis/${sessionId}` ``                                         | `` `.../workspaces/${ctx.wsId}/analisis/${sessionId}` ``                                         |
| 603  | `` `.../users/${ctx.userId}/calendarSessions/${sessionId}` ``                                 | `` `.../workspaces/${ctx.wsId}/calendarSessions/${sessionId}` ``                                 |
| 628  | `` `.../users/${ctx.userId}/teams/${session.teamId}` ``                                       | `` `.../workspaces/${ctx.wsId}/teams/${session.teamId}` ``                                       |
| 638  | `` `.../users/${ctx.userId}/teams/${session.teamId}/competitions/${session.competitionId}` `` | `` `.../workspaces/${ctx.wsId}/teams/${session.teamId}/competitions/${session.competitionId}` `` |

A find-replace of `users/${ctx.userId}` → `workspaces/${ctx.wsId}` across the file is the cleanest mechanic. Verify with:

```bash
grep -n 'users/\${ctx.userId}' functions/src/ai/tools/readTools.ts
```

Expected after swap: 0 matches.

```bash
grep -n 'workspaces/\${ctx.wsId}' functions/src/ai/tools/readTools.ts
```

Expected: 14 matches (the 13 listed lines plus any additional construction).

- [ ] **Step 2: Run typecheck**

```bash
cd functions
npm run build
```

Expected: build succeeds (paths use `ctx.wsId` which is now in the interface).

### Task 2.2: Tests representativos para readTools

**Files:**

- Create: `functions/src/ai/tools/__tests__/readTools.test.ts`

- [ ] **Step 1: Write tests using FakeFirestore from dataCleanup.test.ts pattern**

Re-use the FakeFirestore helpers from `dataCleanup.test.ts:1-200` (extract them into `functions/src/ai/tools/__tests__/_fakeFirestore.ts` if you want them shared, OR copy-paste for now and dedupe later).

```ts
import { describe, expect, it } from 'vitest';
import { createReadTools } from '../readTools';
import type { ToolContext } from '../registry';
// Import or copy the FakeFirestore helpers
// import { FakeFirestore } from './_fakeFirestore';

// For brevity, declaring inline:
class FakeFirestore {
  /* mirror dataCleanup.test.ts pattern */
}

const APP_ID = 'app1';
const WS_ID = 'ws1';
const USER_ID = 'user1';

function buildCtx(db: FakeFirestore): ToolContext {
  return {
    db: db as never,
    userId: USER_ID,
    wsId: WS_ID,
    appId: APP_ID,
    defaults: {},
  };
}

describe('readTools — workspace path coverage', () => {
  it('getTeam reads from workspaces/{wsId}/teams/{teamId}', async () => {
    const db = new FakeFirestore();
    db.write(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/team-1`, { categoria: 'Cadete' });
    const tools = createReadTools();
    const getTeamTool = tools.find((t) => t.name === 'get_team_details');
    const result = await getTeamTool!.handler({ teamId: 'team-1' }, buildCtx(db));
    expect(result).toMatchObject({ categoria: 'Cadete' });
  });

  it('getBracket reads from workspaces/{wsId}/brackets/{bracketId}', async () => {
    const db = new FakeFirestore();
    db.write(`artifacts/${APP_ID}/workspaces/${WS_ID}/brackets/br-1`, { name: 'Liga' });
    const tools = createReadTools();
    const getBracketTool = tools.find((t) => t.name === 'get_bracket_details');
    const result = await getBracketTool!.handler({ bracketId: 'br-1' }, buildCtx(db));
    expect(result).toMatchObject({ name: 'Liga' });
  });

  it('getCuaderno reads from workspaces/{wsId}/teams/{teamId}/cuaderno/{section}', async () => {
    const db = new FakeFirestore();
    db.write(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/cuaderno/jugadores`, { rows: [] });
    const tools = createReadTools();
    const getCuadernoTool = tools.find((t) => t.name === 'get_cuaderno_section');
    const result = await getCuadernoTool!.handler({ teamId: 't1', section: 'jugadores' }, buildCtx(db));
    expect(result).toMatchObject({ rows: [] });
  });

  it('getCalendarSession reads from workspaces/{wsId}/calendarSessions/{sessionId}', async () => {
    const db = new FakeFirestore();
    db.write(`artifacts/${APP_ID}/workspaces/${WS_ID}/calendarSessions/s1`, { tipo: 'partido' });
    const tools = createReadTools();
    const getSessionTool = tools.find((t) => t.name === 'get_calendar_session');
    const result = await getSessionTool!.handler({ sessionId: 's1' }, buildCtx(db));
    expect(result).toMatchObject({ tipo: 'partido' });
  });

  it('getScouting reads from workspaces/{wsId}/scoutings/{sessionId}', async () => {
    const db = new FakeFirestore();
    db.write(`artifacts/${APP_ID}/workspaces/${WS_ID}/scoutings/s1`, { rival: 'X' });
    const tools = createReadTools();
    const getScoutingTool = tools.find((t) => t.name === 'get_scouting');
    const result = await getScoutingTool!.handler({ sessionId: 's1' }, buildCtx(db));
    expect(result).toMatchObject({ rival: 'X' });
  });

  it('getExercise reads from workspaces/{wsId}/exercises/{exerciseId}', async () => {
    const db = new FakeFirestore();
    db.write(`artifacts/${APP_ID}/workspaces/${WS_ID}/exercises/e1`, { titulo: 'Calentamiento' });
    const tools = createReadTools();
    const getExerciseTool = tools.find((t) => t.name === 'get_exercise');
    const result = await getExerciseTool!.handler({ exerciseId: 'e1' }, buildCtx(db));
    expect(result).toMatchObject({ titulo: 'Calentamiento' });
  });
});
```

The exact tool names (`get_team_details`, `get_bracket_details`, etc.) must match what `createReadTools()` registers. If the names differ, adjust to match the actual registry.

- [ ] **Step 2: Run tests**

```bash
cd functions
npm test
```

Expected: 6 tests pass.

### Task 2.3: Commit "feat(pick): readTools to workspace paths"

- [ ] **Step 1: Stage and commit**

```bash
git add functions/src/ai/tools/readTools.ts functions/src/ai/tools/__tests__/
git commit -m "feat(pick): readTools paths to workspaces/{wsId}/...

13 path swaps in functions/src/ai/tools/readTools.ts: every users/\${ctx.userId}
construction becomes workspaces/\${ctx.wsId}. Tools that read teams, brackets,
exercises, trainings, cuaderno (jugadores/test-tiro/asistencia/informe-jugadores),
scoutings, analisis, calendarSessions, competitions all flow through the new
path. Six smoke tests cover representative paths."
```

---

## Commit 3: feat(proactive): iterate workspaces, write wsId on notifs

### Task 3.1: Refactor proactiveEngine main loop

**Files:**

- Modify: `functions/src/proactiveEngine.ts`

- [ ] **Step 1: Replace the user-iteration block**

Find the block at lines 119-164 ("Step 1: Collect active users"). Replace with workspace iteration:

```ts
// ── Step 1: Collect active workspaces ─────────────────────────────────────

const workspacesRef = db.collection('artifacts').doc(appId).collection('workspaces');

const workspacesSnap = await workspacesRef.limit(MAX_USERS * 3).get();

interface ActiveWorkspace {
  wsId: string;
  ownerId: string;
}
const activeWorkspaces: ActiveWorkspace[] = [];

for (const wsDoc of workspacesSnap.docs) {
  if (activeWorkspaces.length >= MAX_USERS) break;
  const wsId = wsDoc.id;
  const wsData = wsDoc.data() as { ownerId?: string; type?: string };
  const ownerId = wsData.ownerId;
  if (!ownerId) continue;

  // Check for teams (existence = active workspace)
  const teamsSnap = await db
    .collection('artifacts')
    .doc(appId)
    .collection('workspaces')
    .doc(wsId)
    .collection('teams')
    .limit(1)
    .get();

  if (!teamsSnap.empty) {
    activeWorkspaces.push({ wsId, ownerId });
    continue;
  }

  // Check for any calendar session within the activity window
  const recentSnap = await db
    .collection('artifacts')
    .doc(appId)
    .collection('workspaces')
    .doc(wsId)
    .collection('calendarSessions')
    .where('fecha', '>=', activityCutoff)
    .limit(1)
    .get();

  if (!recentSnap.empty) {
    activeWorkspaces.push({ wsId, ownerId });
  }
}

console.log(`[proactiveEngine] Active workspaces found: ${activeWorkspaces.length}`);
```

Rename the constant `MAX_USERS` to `MAX_WORKSPACES` if you want, but it's optional.

- [ ] **Step 2: Update the per-user processing loop**

Find the block at lines 173-261 ("Step 2: Process each user"). Replace `for (const uid of activeUids) {` with `for (const { wsId, ownerId: uid } of activeWorkspaces) {` and update the path constructions inside. Specifically:

```ts
for (const { wsId, ownerId: uid } of activeWorkspaces) {
  try {
    // Query sessions for today and tomorrow
    const sessionsSnap = await db
      .collection('artifacts')
      .doc(appId)
      .collection('workspaces')
      .doc(wsId) // workspaces/{wsId}/calendarSessions
      .collection('calendarSessions')
      .where('fecha', '>=', today)
      .where('fecha', '<=', tomorrow)
      .get();

    const relevantSessions = sessionsSnap.docs.filter((doc) => {
      const tipo = (doc.data() as CalendarSessionData).tipo;
      return tipo === 'partido' || tipo === 'entrenamiento';
    });

    for (const sessionDoc of relevantSessions) {
      const sessionId = sessionDoc.id;
      const session = sessionDoc.data() as CalendarSessionData;
      const fecha = session.fecha ?? today;
      const tipo = session.tipo ?? 'entrenamiento';
      const notifType: 'match-reminder' | 'training-tip' = tipo === 'partido' ? 'match-reminder' : 'training-tip';

      const notifId = `${fecha}-${sessionId}`;
      const notifRef = db
        .collection('artifacts')
        .doc(appId)
        .collection('users')
        .doc(uid) // notif still under user
        .collection('proactiveNotifications')
        .doc(notifId);

      const existing = await notifRef.get();
      if (existing.exists) {
        skipped++;
        continue;
      }

      // ── Generate AI suggestion ──────────────────────────────────────────
      const dayLabel = fecha === today ? 'hoy' : 'mañana';
      const rival = session.rival ?? session.nombreRival;
      const prompt = buildPrompt(tipo, dayLabel, rival);

      let message: string;
      try {
        const result = await llm.generate<{ message: string }>({
          prompt,
          traceContext,
        });
        message =
          typeof result.data?.message === 'string' && result.data.message.trim()
            ? result.data.message.trim()
            : fallbackMessage(tipo, dayLabel, rival);
      } catch (llmErr) {
        console.warn(`[proactiveEngine] LLM failed for ws=${wsId} session=${sessionId}: ` + (llmErr as Error).message);
        message = fallbackMessage(tipo, dayLabel, rival);
      }

      // ── Write notification with wsId field ──────────────────────────────
      const notif: ProactiveNotification = {
        message,
        type: notifType,
        generatedAt: new Date().toISOString(),
        read: false,
        sessionId,
        wsId, // NUEVO
        ...(session.teamId ? { teamId: session.teamId } : {}),
      };

      await notifRef.set(notif);
      notifications++;

      console.log(`[proactiveEngine] Notification written: ws=${wsId} uid=${uid} notifId=${notifId} type=${notifType}`);
    }

    processed++;
  } catch (err) {
    console.error(`[proactiveEngine] Error processing ws=${wsId} uid=${uid}: `, (err as Error).message);
    errors++;
  }
}
```

- [ ] **Step 3: Update `ProactiveNotification` type**

Find the `ProactiveNotification` interface (probably in the same file or in `functions/src/shared/`). Add the `wsId` field:

```ts
export interface ProactiveNotification {
  message: string;
  type: 'match-reminder' | 'training-tip';
  generatedAt: string;
  read: boolean;
  sessionId: string;
  wsId: string; // NUEVO
  teamId?: string;
}
```

- [ ] **Step 4: Build to verify types**

```bash
cd functions
npm run build
```

Expected: success.

### Task 3.2: Tests para proactiveEngine con workspaces

**Files:**

- Create: `functions/src/proactiveEngine.test.ts`

- [ ] **Step 1: Write tests using FakeFirestore**

```ts
import { describe, expect, it, vi } from 'vitest';
import { runProactiveBriefing } from './proactiveEngine';
// import or inline the FakeFirestore helpers from dataCleanup.test.ts

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => fakeDbInstance,
}));

vi.mock('./ai/llmProvider', () => ({
  LLMProvider: class {
    async generate() {
      return { data: { message: 'Mock AI message' } };
    }
  },
}));

vi.mock('./ai/observability', () => ({
  ObservabilityService: class {
    async flush() {}
    createTrace() {
      return { id: 't1' };
    }
  },
}));

let fakeDbInstance: FakeFirestore;

const APP_ID = 'app1';

describe('runProactiveBriefing — workspace iteration', () => {
  it('iterates workspaces (not users) and writes notif with wsId field', async () => {
    fakeDbInstance = new FakeFirestore();
    const today = new Date().toISOString().slice(0, 10);

    // Seed: 1 workspace with type=personal, ownerId=user1, has 1 team and 1 session today
    fakeDbInstance.write(`artifacts/${APP_ID}/workspaces/ws1`, { type: 'personal', ownerId: 'user1' });
    fakeDbInstance.write(`artifacts/${APP_ID}/workspaces/ws1/teams/t1`, { categoria: 'Cadete' });
    fakeDbInstance.write(`artifacts/${APP_ID}/workspaces/ws1/calendarSessions/sess1`, {
      fecha: today,
      tipo: 'entrenamiento',
      teamId: 't1',
    });

    const result = await runProactiveBriefing('mock-api-key', APP_ID);

    expect(result.notifications).toBe(1);

    // Verify notif written under users/{uid}/ with wsId field
    const notif = fakeDbInstance.read(`artifacts/${APP_ID}/users/user1/proactiveNotifications/${today}-sess1`);
    expect(notif).toBeDefined();
    expect(notif).toMatchObject({
      type: 'training-tip',
      sessionId: 'sess1',
      wsId: 'ws1', // critical: wsId field present
      teamId: 't1',
    });
  });

  it('skips workspaces with no teams and no recent sessions', async () => {
    fakeDbInstance = new FakeFirestore();
    fakeDbInstance.write(`artifacts/${APP_ID}/workspaces/ws-empty`, { type: 'personal', ownerId: 'user2' });

    const result = await runProactiveBriefing('mock-api-key', APP_ID);
    expect(result.notifications).toBe(0);
  });

  it('idempotent: re-run skips already-written notifs', async () => {
    fakeDbInstance = new FakeFirestore();
    const today = new Date().toISOString().slice(0, 10);
    fakeDbInstance.write(`artifacts/${APP_ID}/workspaces/ws1`, { type: 'personal', ownerId: 'user1' });
    fakeDbInstance.write(`artifacts/${APP_ID}/workspaces/ws1/teams/t1`, {});
    fakeDbInstance.write(`artifacts/${APP_ID}/workspaces/ws1/calendarSessions/sess1`, {
      fecha: today,
      tipo: 'partido',
    });
    fakeDbInstance.write(`artifacts/${APP_ID}/users/user1/proactiveNotifications/${today}-sess1`, {
      message: 'pre-existing',
      type: 'match-reminder',
      wsId: 'ws1',
      sessionId: 'sess1',
      generatedAt: 'past',
      read: false,
    });

    const result = await runProactiveBriefing('mock-api-key', APP_ID);
    expect(result.skipped).toBe(1);
    expect(result.notifications).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd functions
npm test
```

Expected: 3 tests pass.

### Task 3.3: Commit "feat(proactive): iterate workspaces, wsId in notifs"

```bash
git add functions/src/proactiveEngine.ts functions/src/proactiveEngine.test.ts
git commit -m "feat(proactive): iterate workspaces and write wsId on notifications

proactiveEngine now iterates artifacts/{appId}/workspaces/ instead of users/.
Activity probe queries teams and calendarSessions under workspaces/{wsId}/.
Notifs are still written to users/{uid}/proactiveNotifications/{notifId} (per
the constitution 'datos del usuario viajan con el usuario'), but include the
new wsId field so the UI can filter by activeWsId. ownerId from the workspace
doc identifies the destinatario uid in V1.5; sub-proyecto 4 will fan out to
all members for B2B clubs."
```

---

## Commit 4: refactor(cleanup): dataCleanup paths to workspaces/{wsId}

### Task 4.1: Actualizar `CleanupParams` y helpers en `dataCleanup.ts`

**Files:**

- Modify: `functions/src/dataCleanup.ts`

- [ ] **Step 1: Add wsId to interface**

Update lines 5-13:

```ts
export interface CleanupParams {
  db: Firestore;
  appId: string;
  userId: string;
  wsId?: string; // required for deleteTeam/Bracket/Conversation; optional for deleteAllUserData
  action: CleanupAction;
  teamId?: string;
  bracketId?: string;
  conversationId?: string;
}
```

- [ ] **Step 2: Add workspace path helpers**

After the existing `userRoot`/`userCol` helpers (lines 32-38), add:

```ts
function workspaceRoot(db: Firestore, appId: string, wsId: string) {
  return db.collection('artifacts').doc(appId).collection('workspaces').doc(wsId);
}

function workspaceCol(db: Firestore, appId: string, wsId: string, collectionName: string) {
  return workspaceRoot(db, appId, wsId).collection(collectionName);
}
```

`userRoot`/`userCol` remain — they're still needed for `users/{uid}/profile`, `pickHistory`, `proactiveNotifications`, `memberships`.

- [ ] **Step 3: Run typecheck**

```bash
cd functions
npm run build
```

Expected: build still has errors in the cascade functions (they don't use wsId yet) — fixed in 4.2.

### Task 4.2: Migrar `deleteTeamCascade` a workspaces

**Files:**

- Modify: `functions/src/dataCleanup.ts` (the `deleteTeamCascade` function — search for it)

- [ ] **Step 1: Locate and read the current `deleteTeamCascade`**

```bash
grep -n "function deleteTeamCascade\|deleteTeamCascade(" functions/src/dataCleanup.ts
```

Read the function body. Identify every path constructed via `userCol` or `userRoot`.

- [ ] **Step 2: Replace path construction**

For each `userCol(db, appId, userId, 'teams')` or similar in this function, replace with `workspaceCol(db, appId, wsId, 'teams')`. The function signature should accept `wsId` as a parameter (passed from the dispatcher in step 4.5).

The team's nested data (members, trainings, competitions, cuaderno) lives under `workspaces/{wsId}/teams/{teamId}/...`, so the recursive delete walks that subtree.

For scoutings/analisis/planillas associated with the team's sessions, those paths also move to `workspaces/{wsId}/scoutings`, `workspaces/{wsId}/analisis`, `workspaces/{wsId}/planillas`.

Specific transformations (apply mechanically):

```ts
// before
const teamRef = userRoot(db, appId, userId).collection('teams').doc(teamId);
// after
const teamRef = workspaceRoot(db, appId, wsId).collection('teams').doc(teamId);

// before
const sessionsQuery = userCol(db, appId, userId, 'calendarSessions').where('teamId', '==', teamId);
// after
const sessionsQuery = workspaceCol(db, appId, wsId, 'calendarSessions').where('teamId', '==', teamId);

// before
const scoutingRef = userCol(db, appId, userId, 'scoutings').doc(sessionId);
// after
const scoutingRef = workspaceCol(db, appId, wsId, 'scoutings').doc(sessionId);

// (and similarly for analisis, planillas)
```

The exact lines depend on the current implementation. Apply the pattern uniformly.

### Task 4.3: Migrar `deleteBracketCascade` a workspaces

**Files:**

- Modify: `functions/src/dataCleanup.ts`

- [ ] **Step 1: Apply the same transformation pattern**

```ts
// before
const bracketRef = userRoot(db, appId, userId).collection('brackets').doc(bracketId);
// after
const bracketRef = workspaceRoot(db, appId, wsId).collection('brackets').doc(bracketId);
```

For shared bracket cleanup: `shared/{shareCode}` and `presence/{shareCode}` paths stay unchanged (they're not workspace-scoped — they're top-level shared artifacts).

For local bracket bookmarks under other users (the existing pattern at `dataCleanup.test.ts:195`): in V1.5, brackets are workspace-owned, so "bookmarks under other users" no longer applies. Remove that logic if present, or leave it inert (the query under workspaces returns nothing for an unrelated wsId).

For playoff artifacts (scoutings/analisis/planillas with `playoff-bracketId-...` ids): same path transformation as in 4.2.

### Task 4.4: Migrar `deleteConversationCascade` a pickHistory path

**Files:**

- Modify: `functions/src/dataCleanup.ts`

- [ ] **Step 1: Update path**

```ts
// before
async function deleteConversationCascade({ db, appId, userId, conversationId }) {
  const convRef = userRoot(db, appId, userId).collection('conversations').doc(conversationId);
  // recursive delete (with messages subcollection)
}

// after — note signature now also takes wsId
async function deleteConversationCascade({ db, appId, userId, wsId, conversationId }) {
  const convRef = userRoot(db, appId, userId)
    .collection('pickHistory')
    .doc(wsId)
    .collection('conversations')
    .doc(conversationId);
  // recursive delete (with messages subcollection)
}
```

The conversation lives under `users/{uid}/pickHistory/{wsId}/conversations/{convId}` (per sub-proyecto 1's restructure). Messages are a subcollection of the conversation doc.

### Task 4.5: Migrar `deleteAllUserDataCascade` con memberships iteration

**Files:**

- Modify: `functions/src/dataCleanup.ts`

- [ ] **Step 1: Replace the implementation**

```ts
async function deleteAllUserDataCascade(params: CleanupParams, result: CleanupResult): Promise<CleanupResult> {
  const { db, appId, userId } = params;

  // 1. Iterate user's memberships
  const membershipsSnap = await db
    .collection('artifacts')
    .doc(appId)
    .collection('users')
    .doc(userId)
    .collection('memberships')
    .get();

  for (const membershipDoc of membershipsSnap.docs) {
    const wsId = membershipDoc.id;
    const wsRef = db.collection('artifacts').doc(appId).collection('workspaces').doc(wsId);
    const wsSnap = await wsRef.get();
    if (!wsSnap.exists) continue;
    const ws = wsSnap.data() as { type?: string; ownerId?: string };

    if (ws.type === 'personal' && ws.ownerId === userId) {
      // Personal workspace owned by this user → recursive delete
      await db.recursiveDelete(wsRef);
      result.deleted.teams++; // approximate; counts in detail below if needed
    } else {
      // Club workspace where user is a member → just remove their membership
      await wsRef.collection('members').doc(userId).delete();
    }
  }

  // 2. Recursive delete all user-private data
  const userRef = db.collection('artifacts').doc(appId).collection('users').doc(userId);
  await db.recursiveDelete(userRef);
  result.deleted.users++;

  // 3. Auth user delete is the caller's responsibility (separate Admin SDK call).

  return result;
}
```

Note `db.recursiveDelete` is part of the Admin SDK's `Firestore` interface; the test mock (`FakeFirestore`) will need to add support for it. Add a `recursiveDelete` method to `FakeFirestore` that walks a document ref and deletes it + all its subcollections. Implementation in test file:

```ts
class FakeFirestore {
  // ... existing methods ...
  async recursiveDelete(ref: FakeDocumentReference): Promise<void> {
    const childPaths = Array.from(this.docs.keys()).filter((p) => p === ref.path || p.startsWith(`${ref.path}/`));
    for (const path of childPaths) {
      this.docs.delete(path);
    }
  }
}
```

### Task 4.6: Update existing `dataCleanup.test.ts` for new paths

**Files:**

- Modify: `functions/src/dataCleanup.test.ts`

- [ ] **Step 1: Update seed paths**

Find every seed path of the form `'artifacts/app1/users/u1/teams/...'`, `'artifacts/app1/users/u1/brackets/...'`, etc. and update to `'artifacts/app1/workspaces/ws1/teams/...'`, `'artifacts/app1/workspaces/ws1/brackets/...'`, etc.

- [ ] **Step 2: Update test invocations to pass `wsId`**

Each call to `cleanupUserData({ ... action: 'deleteTeam', ..., teamId: 't1' })` adds `wsId: 'ws1'`.

- [ ] **Step 3: Add `recursiveDelete` to FakeFirestore**

Add the method shown in Task 4.5.

- [ ] **Step 4: Add a new test for `deleteAllUserDataCascade`**

```ts
it('deleteAllUserData removes user personal workspace + user-private data', async () => {
  const db = new FakeFirestore();
  // Seed: user has a personal workspace and user-private data
  db.write('artifacts/app1/workspaces/ws1', { type: 'personal', ownerId: 'u1' });
  db.write('artifacts/app1/workspaces/ws1/teams/t1', { categoria: 'Cadete' });
  db.write('artifacts/app1/users/u1/memberships/ws1', { role: 'owner' });
  db.write('artifacts/app1/users/u1/profile/main', { nombre: 'Coach' });
  db.write('artifacts/app1/users/u1/proactiveNotifications/n1', { message: 'X' });

  await cleanupUserData({
    db,
    appId: 'app1',
    userId: 'u1',
    action: 'deleteAllUserData',
  });

  expect(db.has('artifacts/app1/workspaces/ws1')).toBe(false);
  expect(db.has('artifacts/app1/workspaces/ws1/teams/t1')).toBe(false);
  expect(db.has('artifacts/app1/users/u1/profile/main')).toBe(false);
  expect(db.has('artifacts/app1/users/u1/proactiveNotifications/n1')).toBe(false);
});

it('deleteAllUserData leaves club workspaces standing, only removes user from members', async () => {
  const db = new FakeFirestore();
  // user is member of a club ws-club but doesn't own it
  db.write('artifacts/app1/workspaces/ws-club', { type: 'club', ownerId: 'u-other' });
  db.write('artifacts/app1/workspaces/ws-club/members/u1', { role: 'coach' });
  db.write('artifacts/app1/workspaces/ws-club/teams/t1', { categoria: 'Cadete' });
  db.write('artifacts/app1/users/u1/memberships/ws-club', { role: 'coach' });
  db.write('artifacts/app1/users/u1/profile/main', { nombre: 'Coach' });

  await cleanupUserData({
    db,
    appId: 'app1',
    userId: 'u1',
    action: 'deleteAllUserData',
  });

  // Club survives
  expect(db.has('artifacts/app1/workspaces/ws-club')).toBe(true);
  expect(db.has('artifacts/app1/workspaces/ws-club/teams/t1')).toBe(true);
  // User's membership in the club is removed
  expect(db.has('artifacts/app1/workspaces/ws-club/members/u1')).toBe(false);
  // User-private data is gone
  expect(db.has('artifacts/app1/users/u1/profile/main')).toBe(false);
});
```

- [ ] **Step 5: Run tests**

```bash
cd functions
npm test
```

Expected: existing dataCleanup tests pass with new paths; 2 new tests pass.

### Task 4.7: Actualizar callers cliente-side

**Files:**

- Modify: `src/services/dataCleanupService.ts`
- Modify: `src/services/teamsService.js` (if it calls `deleteTeamCascade`)
- Modify: `src/hooks/useBracketSync.js`
- Modify: `src/hooks/useConversationPersistence.ts`

- [ ] **Step 1: Update each caller**

In `src/services/dataCleanupService.ts`, the wrapper functions exposed to the rest of the app must accept and pass `wsId`:

```ts
// before
export async function deleteTeamCascade({ appId, teamId }) {
  const fn = httpsCallable(functions, 'cleanupUserData');
  await fn({ action: 'deleteTeam', appId, teamId });
}

// after
export async function deleteTeamCascade({ appId, wsId, teamId }) {
  const fn = httpsCallable(functions, 'cleanupUserData');
  await fn({ action: 'deleteTeam', appId, wsId, teamId });
}
```

Apply the same pattern to `deleteBracketCascade({ appId, wsId, bracketId })` and `deleteConversationCascade({ appId, wsId, conversationId })`.

`deleteAllUserDataCascade({ appId })` does NOT take wsId (server iterates memberships).

In each call site (`teamsService.js`, `useBracketSync.js`, `useConversationPersistence.ts`), use `useWorkspace().activeWsId` and pass it.

- [ ] **Step 2: Run client tests**

```bash
npm test
```

Expected: existing tests pass.

### Task 4.8: Commit "refactor(cleanup): dataCleanup to workspaces/{wsId}"

```bash
git add functions/src/dataCleanup.ts functions/src/dataCleanup.test.ts src/services/dataCleanupService.ts src/services/teamsService.js src/hooks/useBracketSync.js src/hooks/useConversationPersistence.ts
git commit -m "refactor(cleanup): dataCleanup operates on workspaces/{wsId}/...

Cascades for deleteTeam, deleteBracket, deleteConversation now require wsId
and operate under workspaces/{wsId}/. deleteAllUserData iterates the user's
memberships: deletes personal workspaces wholesale, only removes user from
club workspaces (forward-compat for B2B clubs in sub-proyecto 4). Existing
tests adapted; new tests cover personal-vs-club account-delete semantics."
```

Now go back and remove the `@ts-expect-error` suppression from Task 1.3 (`functions/src/index.ts`); the build should now succeed cleanly. Amend the commit if desired:

```bash
cd functions && npm run build && cd ..
# fix any remaining @ts-expect-error suppressions
git add functions/src/index.ts
git commit --amend --no-edit
```

---

## Commit 5: refactor(memory): RAG, digest, memory to workspaces

### Task 5.1: `userRagService` paths a workspaces

**Files:**

- Modify: `functions/src/ai/userRagService.ts`

- [ ] **Step 1: Find and update path helper**

Line 23 has:

```ts
function userBaseRef(db: Firestore, appId: string, userId: string) {
  return db.collection('artifacts').doc(appId).collection('users').doc(userId);
}
```

Replace/rename to:

```ts
function workspaceBaseRef(db: Firestore, appId: string, wsId: string) {
  return db.collection('artifacts').doc(appId).collection('workspaces').doc(wsId);
}
```

Then update every call site of `userBaseRef(db, appId, userId)` in this file to `workspaceBaseRef(db, appId, wsId)`. The function signatures of the exported functions (e.g., `searchKnowledgeBase`, `addToRag`, etc.) must be updated to accept `wsId` instead of (or in addition to) `userId`.

- [ ] **Step 2: Update the `ragIndex` collection name path**

The line 276 comment says `Stored in Firestore under artifacts/{appId}/users/{uid}/ragIndex/`. Update the comment and the implementation to:

`artifacts/{appId}/workspaces/{wsId}/ragIndex/...`

### Task 5.2: `userDigest` paths a workspaces

**Files:**

- Modify: `functions/src/ai/userDigest.ts`

- [ ] **Step 1: Update `buildUserDigest` signature**

Find:

```ts
export async function buildUserDigest({ db, userId, appId, clientDate }) {
  const base = db.collection('artifacts').doc(appId).collection('users').doc(userId);
  // ...
}
```

Update to:

```ts
export async function buildUserDigest({ db, userId, wsId, appId, clientDate }) {
  const base = db.collection('artifacts').doc(appId).collection('workspaces').doc(wsId);
  // userId is kept as a parameter in case digest reads anything user-private (it shouldn't in V1.5)
  // ...
}
```

Now go back to `functions/src/index.ts` line 201 and remove the `@ts-expect-error` suppression added in Task 1.2 — the call now matches the new signature.

### Task 5.3: `memoryTools` paths a workspaces

**Files:**

- Modify: `functions/src/ai/tools/memoryTools.ts`

- [ ] **Step 1: Read the file and find every path construction**

```bash
grep -n "users.*userId\|users.*uid" functions/src/ai/tools/memoryTools.ts
```

- [ ] **Step 2: Replace each construction**

For each path of the form `artifacts/${ctx.appId}/users/${ctx.userId}/memory/...`:

```ts
// before
ctx.db.doc(`artifacts/${ctx.appId}/users/${ctx.userId}/memory/${memoryId}`);
// after
ctx.db.doc(`artifacts/${ctx.appId}/workspaces/${ctx.wsId}/memory/${memoryId}`);
```

The exact transformations depend on the file's current implementation. Apply the pattern uniformly.

### Task 5.4: Extender `migrateToWorkspaces` para copiar `ragIndex`, `digest`, `memory`

**Files:**

- Modify: `scripts/migration/lib/migrateUser.js`

- [ ] **Step 1: Add the additional copy steps**

Find the section where `migrateUser` calls `copyCollection` for the existing 5 collections (brackets, calendarSessions, etc.). After those, add:

```js
// Migrate workspace-scoped agent state (sub-proyecto 1.5 addition)
counts.ragIndex = await copyCollection(
  db,
  `artifacts/${appId}/users/${uid}/ragIndex`,
  `artifacts/${appId}/workspaces/${newWsId}/ragIndex`,
);
counts.digest = await copyCollection(
  db,
  `artifacts/${appId}/users/${uid}/digest`,
  `artifacts/${appId}/workspaces/${newWsId}/digest`,
);
counts.memory = await copyCollection(
  db,
  `artifacts/${appId}/users/${uid}/memory`,
  `artifacts/${appId}/workspaces/${newWsId}/memory`,
);
```

`copyCollection` is already idempotent and recursive (sub-proyecto 1, Commit 3); no changes needed there.

- [ ] **Step 2: Update verify.js**

In `scripts/migration/lib/verify.js`, find `COLLECTIONS_TO_VERIFY` and append the three new ones:

```js
const COLLECTIONS_TO_VERIFY = [
  'brackets',
  'calendarSessions',
  'playoffConvocatorias',
  'exercises',
  'teams',
  'ragIndex', // NUEVO
  'digest', // NUEVO
  'memory', // NUEVO
];
```

- [ ] **Step 3: Run migration tests**

```bash
firebase emulators:exec --only firestore "npx vitest run scripts/migration/__tests__/"
```

Expected: existing tests still pass (the new collections are additive — if there's no source data, count is 0 on both sides, no diff). Add a new test case in `migrateUser.test.js` that seeds `users/{uid}/ragIndex/...` and verifies the copy.

### Task 5.5: Tests para migración de RAG/digest/memory

**Files:**

- Modify: `scripts/migration/__tests__/migrateUser.test.js`

- [ ] **Step 1: Add a test seed for ragIndex/digest/memory**

```js
it('copies ragIndex, digest, and memory collections', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await db.doc(`artifacts/${APP_ID}/users/${UID}/ragIndex/r1`).set({ embedding: [0.1, 0.2] });
  await db.doc(`artifacts/${APP_ID}/users/${UID}/digest/main`).set({ summary: 'X' });
  await db.doc(`artifacts/${APP_ID}/users/${UID}/memory/m1`).set({ fact: 'Y' });

  const result = await migrateUser(db, APP_ID, UID, { dryRun: false });
  expect(result.status).toBe('migrated');

  const ws = result.newWsId;
  expect((await db.doc(`artifacts/${APP_ID}/workspaces/${ws}/ragIndex/r1`).get()).exists).toBe(true);
  expect((await db.doc(`artifacts/${APP_ID}/workspaces/${ws}/digest/main`).get()).exists).toBe(true);
  expect((await db.doc(`artifacts/${APP_ID}/workspaces/${ws}/memory/m1`).get()).exists).toBe(true);
});
```

- [ ] **Step 2: Run**

```bash
firebase emulators:exec --only firestore "npx vitest run scripts/migration/__tests__/migrateUser.test.js"
```

Expected: passing.

### Task 5.6: Update cleanupOldPaths.js

**Files:**

- Modify: `scripts/cleanupOldPaths.js`

- [ ] **Step 1: Add new collections**

Find `OLD_COLLECTIONS_TO_DELETE` and append:

```js
const OLD_COLLECTIONS_TO_DELETE = [
  'teams',
  'brackets',
  'calendarSessions',
  'playoffConvocatorias',
  'exercises',
  'conversations',
  'ragIndex', // NUEVO
  'digest', // NUEVO
  'memory', // NUEVO
];
```

### Task 5.7: Commit "refactor(memory): RAG/digest/memory to workspaces/{wsId}"

```bash
git add functions/src/ai/userRagService.ts functions/src/ai/userDigest.ts functions/src/ai/tools/memoryTools.ts scripts/migration/lib/migrateUser.js scripts/migration/lib/verify.js scripts/cleanupOldPaths.js scripts/migration/__tests__/migrateUser.test.js functions/src/index.ts
git commit -m "refactor(memory): RAG, digest, memory paths to workspaces/{wsId}

Pick agent's RAG index, user digest, and memory tools all move from
users/{uid}/{ragIndex|digest|memory} to workspaces/{wsId}/{ragIndex|digest|memory}.
Memory tied to workspace data is workspace-owned, not coach-owned. Migration
script extended to copy these collections; verify checks the counts; cleanup
script will remove the legacy paths at 30-day mark."
```

---

## Commit 6: feat(auth): onCreate trigger bootstraps personal workspace

### Task 6.1: Crear `bootstrapPersonalWorkspace` function

**Files:**

- Create: `functions/src/auth/onUserCreate.ts`

- [ ] **Step 1: Implement**

```ts
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export interface BootstrapResult {
  status: 'created' | 'skipped';
  wsId: string;
}

/**
 * Creates a personal workspace + member doc + memberships cache for a new user.
 * Idempotent: if a personal workspace owned by the user already exists, returns it.
 */
export async function bootstrapPersonalWorkspace(user: { uid: string }, appId: string): Promise<BootstrapResult> {
  const db = getFirestore();
  const uid = user.uid;

  // Idempotency: check if personal workspace already exists
  const existingSnap = await db
    .collection(`artifacts/${appId}/workspaces`)
    .where('type', '==', 'personal')
    .where('ownerId', '==', uid)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    return { status: 'skipped', wsId: existingSnap.docs[0].id };
  }

  // Generate wsId
  const newWsId = db.collection(`artifacts/${appId}/workspaces`).doc().id;
  const now = FieldValue.serverTimestamp();

  await db
    .batch()
    .set(db.doc(`artifacts/${appId}/workspaces/${newWsId}`), {
      type: 'personal',
      name: 'Mi cuenta',
      ownerId: uid,
      createdAt: now,
      updatedAt: now,
      plan: 'free',
      planUpdatedAt: null,
      billing: null,
      migrationCompleteAt: now,
    })
    .set(db.doc(`artifacts/${appId}/workspaces/${newWsId}/members/${uid}`), {
      role: 'owner',
      assignedTeamIds: [],
      joinedAt: now,
    })
    .set(db.doc(`artifacts/${appId}/users/${uid}/memberships/${newWsId}`), {
      role: 'owner',
      workspaceName: 'Mi cuenta',
      workspaceType: 'personal',
      joinedAt: now,
    })
    .commit();

  console.log(`[bootstrapPersonalWorkspace] created wsId=${newWsId} for uid=${uid}`);
  return { status: 'created', wsId: newWsId };
}
```

### Task 6.2: Tests para bootstrap

**Files:**

- Create: `functions/src/auth/__tests__/onUserCreate.test.ts`

- [ ] **Step 1: Write tests using FakeFirestore**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { bootstrapPersonalWorkspace } from '../onUserCreate';

let fakeDbInstance: FakeFirestore;

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => fakeDbInstance,
  FieldValue: {
    serverTimestamp: () => ({ __ts: 'serverTimestamp' }),
  },
}));

const APP_ID = 'app1';
const UID = 'user-new';

beforeEach(() => {
  fakeDbInstance = new FakeFirestore();
});

describe('bootstrapPersonalWorkspace', () => {
  it('creates workspace + member + memberships cache atomically for new user', async () => {
    const result = await bootstrapPersonalWorkspace({ uid: UID }, APP_ID);

    expect(result.status).toBe('created');
    expect(result.wsId).toBeTruthy();

    const wsId = result.wsId;
    const wsDoc = fakeDbInstance.read(`artifacts/${APP_ID}/workspaces/${wsId}`);
    expect(wsDoc).toMatchObject({
      type: 'personal',
      name: 'Mi cuenta',
      ownerId: UID,
      plan: 'free',
    });

    const memberDoc = fakeDbInstance.read(`artifacts/${APP_ID}/workspaces/${wsId}/members/${UID}`);
    expect(memberDoc).toMatchObject({ role: 'owner', assignedTeamIds: [] });

    const cacheDoc = fakeDbInstance.read(`artifacts/${APP_ID}/users/${UID}/memberships/${wsId}`);
    expect(cacheDoc).toMatchObject({
      role: 'owner',
      workspaceName: 'Mi cuenta',
      workspaceType: 'personal',
    });
  });

  it('is idempotent: re-run returns skipped without creating duplicate', async () => {
    const first = await bootstrapPersonalWorkspace({ uid: UID }, APP_ID);
    const second = await bootstrapPersonalWorkspace({ uid: UID }, APP_ID);

    expect(second.status).toBe('skipped');
    expect(second.wsId).toBe(first.wsId);

    // Only one workspace exists
    const workspacesPaths = Array.from(fakeDbInstance.docs.keys()).filter(
      (p) => p.startsWith(`artifacts/${APP_ID}/workspaces/`) && !p.includes('/members/'),
    );
    expect(workspacesPaths).toHaveLength(1);
  });
});
```

(FakeFirestore implementation copied/extracted as in Task 4.6.)

- [ ] **Step 2: Run tests**

```bash
cd functions
npm test
```

Expected: 2 tests pass.

### Task 6.3: Export trigger en `functions/src/index.ts`

**Files:**

- Modify: `functions/src/index.ts`

- [ ] **Step 1: Add the trigger export**

At the bottom of `functions/src/index.ts`, after the `proactiveDailyBriefing` export, add:

```ts
import * as functionsV1 from 'firebase-functions/v1';
import { bootstrapPersonalWorkspace } from './auth/onUserCreate';

const PICK_APP_ID = process.env.PICK_APP_ID || 'uros-fbm-app';

// Auth trigger: when a new Firebase Auth user is created, bootstrap their personal workspace.
// Uses the v1 trigger because firebase-functions v2 (^7.x) does not yet expose a stable
// onCreate equivalent at the time of writing. If migration to v2 blocking triggers
// (beforeUserCreated) becomes preferable later, the handler is the same — just rewire.
export const onUserCreate = functionsV1
  .region('europe-west1')
  .auth.user()
  .onCreate(async (user) => {
    try {
      const result = await bootstrapPersonalWorkspace({ uid: user.uid }, PICK_APP_ID);
      console.log(`[onUserCreate] uid=${user.uid} ${result.status} wsId=${result.wsId}`);
    } catch (err) {
      console.error(`[onUserCreate] uid=${user.uid} FATAL:`, (err as Error).message);
      // Do not rethrow — the user record exists, and we don't want to leave them in a broken state.
      // The client's WorkspaceProvisioningState will show retry.
    }
  });
```

If the existing `package.json` only has `firebase-functions@^7` and that doesn't ship `firebase-functions/v1`, install the v1 sub-package or adjust:

```bash
cd functions
npm install firebase-functions@^7.2.5  # ensures latest in the v7 line, which still re-exports v1
```

Verify the import works:

```bash
cd functions
npm run build
```

If `firebase-functions/v1` import is unavailable in v7, fall back to using the v2 `beforeUserCreated` blocking trigger:

```ts
import { beforeUserCreated } from 'firebase-functions/v2/identity';

export const onUserCreate = beforeUserCreated({ region: 'europe-west1' }, async (event) => {
  if (!event.data) return;
  try {
    await bootstrapPersonalWorkspace({ uid: event.data.uid }, PICK_APP_ID);
  } catch (err) {
    console.error('[onUserCreate]', (err as Error).message);
  }
});
```

The `beforeUserCreated` blocks signup completion, which is desirable: the user can't proceed without their workspace existing. Fail-open semantics: if our function errors, the user still gets created.

Pick whichever of the two API paths your installed `firebase-functions` version supports.

### Task 6.4: Commit "feat(auth): onCreate trigger bootstraps personal workspace"

```bash
git add functions/src/auth/ functions/src/index.ts
git commit -m "feat(auth): onCreate trigger bootstraps personal workspace

New Cloud Function fires when Firebase Auth creates a user. Atomically writes
workspaces/{newWsId} (type=personal, ownerId=uid), members/{uid} (role=owner),
and users/{uid}/memberships/{newWsId} cache. Idempotent: re-runs are no-op.
Closes the post-cutover signup gap where new users would otherwise be stuck
in WorkspaceProvisioningState forever."
```

---

## Commit 7: chore: scripts --app-id required + runbook reorder

### Task 7.1: `migrateToWorkspaces.js` exige `--app-id`

**Files:**

- Modify: `scripts/migration/migrateToWorkspaces.js`

- [ ] **Step 1: Update parseArgs to require --app-id**

Find the `parseArgs` function. Initial state has `appId: 'uros-fbm-app'` (or similar) as the default. Replace:

```js
function parseArgs(argv) {
  const args = { dryRun: false, user: null, project: null, credentials: null, appId: null };

  function nextValue(currentFlag, i) {
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      console.error(`${currentFlag} requires a value`);
      process.exit(2);
    }
    return value;
  }

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--user') {
      args.user = nextValue(a, i);
      i++;
    } else if (a === '--project') {
      args.project = nextValue(a, i);
      i++;
    } else if (a === '--credentials') {
      args.credentials = nextValue(a, i);
      i++;
    } else if (a === '--app-id') {
      args.appId = nextValue(a, i);
      i++;
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }

  if (!args.appId) {
    console.error('Error: --app-id is required (no default; foot-gun protection)');
    process.exit(2);
  }

  return args;
}
```

### Task 7.2: `cleanupOldPaths.js` exige `--app-id`

**Files:**

- Modify: `scripts/cleanupOldPaths.js`

- [ ] **Step 1: Apply the same change**

Replace `appId: 'uros-fbm-app'` default with `appId: null` and add the post-loop check that exits with code 2 if `appId` is missing.

### Task 7.3: Tests para parseArgs

**Files:**

- Modify: `scripts/migration/__tests__/parseArgs.test.js`

- [ ] **Step 1: Add tests for the new requirement**

```js
it('rejects missing --app-id with exit 2', () => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit called');
  });
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  expect(() => parseArgs(['node', 'script.js', '--project', 'p1'])).toThrow();
  expect(exitSpy).toHaveBeenCalledWith(2);
  expect(errSpy.mock.calls.flat().join(' ')).toContain('--app-id is required');

  exitSpy.mockRestore();
  errSpy.mockRestore();
});

it('accepts --app-id with a value', () => {
  const result = parseArgs(['node', 'script.js', '--app-id', 'app1']);
  expect(result.appId).toBe('app1');
});
```

- [ ] **Step 2: Run**

```bash
firebase emulators:exec --only firestore "npx vitest run scripts/migration/__tests__/"
```

Expected: passing.

### Task 7.4: Reordenar runbook + añadir 3 puntos de smoke específicos de 1.5

**Files:**

- Modify: `docs/runbooks/cutover-smoke-checklist.md`

- [ ] **Step 1: Replace the existing checklist with the reordered runbook**

Replace the entire file contents:

````markdown
# Cutover smoke checklist — Sub-proyectos 1 + 1.5

Tras el cutover de la migración a `workspaces/{wsId}/`, ejecutar este runbook + checklist sobre 3 cuentas reales (la del dev + 2 conocidos) en una ventana de mantenimiento dominical (~04:00 hora España).

## Runbook (orden definitivo, sub-proyecto 1.5)

```
1. Backup Firestore export → Cloud Storage:
   gcloud firestore export gs://<backup-bucket>/pre-cutover-$(date -u +%Y%m%d-%H%M%S) \
     --project <PROJECT_ID>

2. Banner read-only ON:
   - Set hosting env var VITE_READ_ONLY_MODE=true
   - firebase deploy --only hosting --project <PROJECT_ID>

3. Run migration:
   node scripts/migration/migrateToWorkspaces.js \
     --app-id <APP_ID> \
     --project <PROJECT_ID> \
     --credentials path/to/sa.json

4. Verify counts en migration.log — sin failed entries

5. Deploy nuevo código + reglas + onCreate trigger:
   firebase deploy --only hosting,functions,firestore:rules,firestore:indexes \
     --project <PROJECT_ID>

6. Smoke tests sobre 3 cuentas reales (lista abajo)

7. Banner OFF:
   - Unset VITE_READ_ONLY_MODE
   - firebase deploy --only hosting --project <PROJECT_ID>
```

**Diferencia vs el runbook original (sub-proyecto 1)**: la migración corre ANTES del deploy del código nuevo, evitando la ventana awkward "código nuevo lee paths que aún no existen".

## Smoke checklist (manual, 5–10 min)

Sobre cada una de 3 cuentas reales:

- [ ] Login funciona, redirect a `/area-privada/`.
- [ ] `HomeScreen` carga, lista de teams visible, contador de jugadores correcto.
- [ ] Abrir un team → cuaderno completo carga: jugadores, test-tiro, asistencia, informe-jugadores, notas, pilares, normas.
- [ ] Calendario carga sesiones (entrenamientos + partidos + playoffs virtuales).
- [ ] Abrir un bracket existente, ver matches y winners propagados correctamente.
- [ ] Crear un nuevo team. Verificar en Firestore Console que el doc se ha creado en `workspaces/{wsId}/teams/`, no en `users/{uid}/teams/`.
- [ ] Abrir Pick → enviar mensaje rápido → recibir respuesta. **Verificar que el orchestrator log incluye `wsId` y que la respuesta refleja datos del workspace activo (no datos viejos).**
- [ ] Mandar una convocatoria desde el calendario → marca `convocatoriaSentAt`. Verificar el path nuevo.
- [ ] `/pendientes` muestra los items correctos. Confirmar que los notifs proactivos siguen filtrados por `wsId`.
- [ ] Settings (`profile/main`) sigue funcionando, sin cambios visibles.
- [ ] Logout y re-login → `activeWsId` se restaura desde localStorage al workspace personal.

### Smoke 1.5 (sub-proyecto 1.5 specific)

- [ ] **Borrar un team desde la UI** → confirmar en Firestore Console que el doc desaparece de `workspaces/{wsId}/teams/{teamId}` (no solo del path viejo).
- [ ] **Crear cuenta nueva con email distinto** → verificar que aterriza en `HomeScreen` directamente (no en `WorkspaceProvisioningState`); confirmar en Firestore que `workspaces/{newWsId}` + `members/{uid}` + `users/{uid}/memberships/{newWsId}` se han creado automáticamente.
- [ ] **Esperar a las 08:00 del día siguiente** (o trigger manualmente la `proactiveDailyBriefing` Cloud Function en Console) → confirmar que el notif generado tiene el campo `wsId` poblado y aparece en `/pendientes`.

## Si algún punto falla

1. Anotar el path Firestore exacto del doc problemático.
2. Decisión binaria:
   - **Rollback**: redeploy del código previo + reglas previas. Datos antiguos en `users/{uid}/...` están intactos. Investigar offline.
   - **Fix-forward**: si es trivial (un path mal en un servicio), patch+deploy en caliente. Solo si la confianza es alta.
3. Banner de mantenimiento se mantiene hasta resolver.

## Cleanup a 30 días

Si tras 30 días no han aparecido bugs, ejecutar:

```bash
node scripts/cleanupOldPaths.js --dry-run --app-id <APP_ID>
node scripts/cleanupOldPaths.js --app-id <APP_ID>
```
````

### Task 7.5: Commit "chore: scripts hardening + runbook reorder"

```bash
git add scripts/migration/migrateToWorkspaces.js scripts/cleanupOldPaths.js scripts/migration/__tests__/parseArgs.test.js docs/runbooks/cutover-smoke-checklist.md
git commit -m "chore: scripts require --app-id, runbook reordered

Both migrateToWorkspaces.js and cleanupOldPaths.js exit 2 if --app-id is
missing (no default to prevent foot-gun on staging). Cutover runbook
reordered: migrate before deploy, eliminating the empty-state window when
new code reads paths the migration hasn't created yet. Three new smoke
items cover sub-proyecto 1.5 specifics (deleteTeam under workspaces, signup
bootstrap, proactive notif with wsId)."
```

---

## Final: verify, push, update PR

### Task 8.1: Run all test suites

- [ ] **Step 1: Client tests**

```bash
npm test
```

Expected: all passing.

- [ ] **Step 2: Functions tests**

```bash
cd functions
npm test
cd ..
```

Expected: all passing (existing + new wsIdValidation, readTools, proactiveEngine, dataCleanup, onUserCreate).

- [ ] **Step 3: Rules tests**

```bash
npm run test:rules
```

Expected: 17 passing.

- [ ] **Step 4: Migration tests**

```bash
npm run test:migrate
```

Expected: 37+ passing (37 from sub-proyecto 1 + new from Task 5.5).

- [ ] **Step 5: Build**

```bash
npm run build:client
cd functions && npm run build && cd ..
```

Expected: both succeed.

- [ ] **Step 6: Lint**

```bash
npm run lint
```

Expected: 0 errors.

### Task 8.2: Push branch

- [ ] **Step 1: Push**

```bash
git push origin feat/workspaces-foundation
```

The branch tracking is already set up (PR #8 is open). New commits append to the existing PR.

### Task 8.3: Update PR description

- [ ] **Step 1: Edit PR via gh CLI**

```bash
gh pr edit 8 --title "feat: workspaces foundation + cloud functions migration (sub-proyectos 1 + 1.5)" --body "$(cat <<'EOF'
## Summary

Foundation for B2B clubs — sub-proyectos 1 + 1.5 of the data-model migration from `users/{uid}/...` to `workspaces/{wsId}/...`. Both sides covered: cliente (sub-proyecto 1) + Cloud Functions / signup bootstrap (sub-proyecto 1.5).

> ⚠️ Cutover-ready en staging tras smoke checklist. Producción solo tras run del runbook reordenado en sub-proyecto 1.5 spec.

## What this PR delivers

### Sub-proyecto 1 (client foundation)
- Path helpers + WorkspaceContext provider.
- Idempotent Node migration script with Emulator tests.
- Refactor of 22+ services/hooks/screens.
- Firestore rules with workspace-aware permissions + 17 tests.
- Workspace-loading + provisioning shell guards.
- Cleanup script + smoke checklist.

### Sub-proyecto 1.5 (Cloud Functions + bootstrap)
- `aiChat` callable validates `isWorkspaceMember(wsId, uid)` server-side.
- Read tools (13 paths) migrated to `workspaces/{wsId}/...`.
- proactiveEngine iterates workspaces; notifs include `wsId` field.
- dataCleanup operates on `workspaces/{wsId}/...`; deleteAllUserData iterates memberships (forward-compat for clubs).
- RAG / digest / memory paths to `workspaces/{wsId}/...`; migration script copies them.
- `onUserCreate` Auth trigger bootstraps personal workspace for new signups.
- Scripts require explicit `--app-id` (no default).
- Runbook reordered: migrate before deploy.

## Specs & plans

- Constitution: `docs/superpowers/specs/2026-05-01-sub-proyecto-0-decisiones-fundacionales-design.md`
- Sub-proyecto 1 spec: `docs/superpowers/specs/2026-05-01-sub-proyecto-1-modelo-cuenta-workspace-migracion-design.md`
- Sub-proyecto 1.5 spec: `docs/superpowers/specs/2026-05-01-sub-proyecto-1-5-cloud-functions-migration-design.md`

## Test plan

- [x] `npm test` — client tests pass.
- [x] `cd functions && npm test` — Cloud Functions tests pass.
- [x] `npm run test:rules` — 17 rules tests pass.
- [x] `npm run test:migrate` — 37+ migration tests pass.
- [x] `npm run build:client && cd functions && npm run build` — both succeed.
- [x] `npm run lint` — 0 errors.
- [ ] **Pending: cutover smoke checklist on staging clone with full data copy.**
- [ ] **Pending: `auth.user().onDelete` for GDPR is sub-proyecto 2 scope (declared OOS).**

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Task 8.4: Final code review (subagent dispatch from controller)

This is the controller's job, not the implementer's. The implementer reports DONE here.

---

## Self-review (for the plan author)

**1. Spec coverage**:

- ✅ Spec §1 piezas 1–7 → Tasks distributed across Commits 1–7.
- ✅ Spec §2.1 read tools migration → Task 2.1.
- ✅ Spec §2.2 ToolContext + wiring → Tasks 1.1–1.4.
- ✅ Spec §2.3 proactiveEngine → Tasks 3.1–3.2.
- ✅ Spec §2.4 dataCleanup → Tasks 4.1–4.7.
- ✅ Spec §2.5 RAG/digest/memory + migration script extension → Tasks 5.1–5.6.
- ✅ Spec §2.6 signup bootstrap → Tasks 6.1–6.3.
- ✅ Spec §2.7 scripts hardening + runbook → Tasks 7.1–7.4.
- ✅ Spec §3 out of scope → declared and not implemented.
- ✅ Spec §4 testing → tests in every commit (Tasks 1.4, 2.2, 3.2, 4.6, 5.5, 6.2, 7.3).
- ✅ Spec §5 alignment + §6 risks → addressed by `--app-id` required, isWorkspaceMember validation, idempotent bootstrap.
- ✅ Spec §7 sucesores → next is sub-proyecto 5 per the constitution's order.

**2. Placeholder scan**: No "TBD" or "TODO" patterns. `@ts-expect-error` suppressions in Tasks 1.2/1.3 are removed in 4.8/5.2 — verified consistency.

**3. Type/method consistency**: `bootstrapPersonalWorkspace`, `wsId`, `ToolContext.wsId`, `workspaceRoot/workspaceCol/workspaceBaseRef` — names used consistently across tasks.

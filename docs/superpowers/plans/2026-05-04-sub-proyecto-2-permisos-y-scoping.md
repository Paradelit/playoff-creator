# Sub-proyecto 2 — Permisos y scoping (implementation plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescribir `firestore.rules` para encoded la matriz de roles + scoping del spec §3, con migración previa de datos existentes y tests de cobertura sobre Firestore Emulator.

**Architecture:** Tres PRs en serie. PR #1 ships a one-shot Cloud Function que backfilea `role`/`assignedTeamIds` en memberships y `createdBy` en docs huérfanos. Tras run + verify counts a 0, PR #2 reescribe las rules y los tests. PR #3 (cleanup, 1-2 semanas después) elimina la Cloud Function de migración.

**Tech Stack:** Firestore rules · `@firebase/rules-unit-testing` para tests · Firebase Functions v2 (TypeScript) para la migración · Vitest para unit tests de la migración.

**Spec base:** `docs/superpowers/specs/2026-05-04-sub-proyecto-2-permisos-y-scoping-design.md`

---

## File structure

| Acción | Path                                                      | Responsabilidad                                                                                                                   |
| ------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Create | `functions/src/migrations/migrateToSubproyecto2.ts`       | One-shot HTTP callable que backfilea memberships + docs sin `createdBy`. Idempotente. Admin-gated.                                |
| Create | `functions/src/migrations/verifySubproyecto2Migration.ts` | HTTP callable que cuenta memberships sin `role`/`assignedTeamIds` y docs sin `createdBy`. Devuelve 0 cuando la migración terminó. |
| Create | `functions/src/migrations/migrateToSubproyecto2.test.ts`  | Unit tests con `firebase-functions-test` y mocks de Firestore.                                                                    |
| Modify | `functions/src/index.ts`                                  | Exportar los dos callables nuevos. PR #3 los elimina.                                                                             |
| Modify | `firestore.rules`                                         | Rewrite con 9 helpers + 5 categorías de matches.                                                                                  |
| Modify | `firestore.rules.test.ts`                                 | Rewrite con ~28 casos cubriendo la matriz completa.                                                                               |

---

## PR #1 — Migration tooling

### Task 1: Branch + scaffold del callable de migración

**Files:**

- Create: `functions/src/migrations/migrateToSubproyecto2.ts`

- [ ] **Step 1: Crear branch**

```bash
git checkout main && git pull
git checkout -b feat/sub-proyecto-2-migration
```

- [ ] **Step 2: Crear el archivo con scaffold mínimo**

```ts
// functions/src/migrations/migrateToSubproyecto2.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

interface MigrationResult {
  workspacesProcessed: number;
  membershipsBackfilled: number;
  docsBackfilled: number;
  durationMs: number;
}

// uid del super-admin autorizado para correr la migración. Reemplazar por el
// uid real antes de deploy. Si necesitas rotar, redeploy con valor nuevo.
const SUPERADMIN_UID = 'REPLACE_WITH_SERPA_UID';

export const migrateToSubproyecto2 = onCall<unknown, Promise<MigrationResult>>(
  { region: 'europe-west1', timeoutSeconds: 540, memory: '1GiB' },
  async (req) => {
    if (!req.auth || req.auth.uid !== SUPERADMIN_UID) {
      throw new HttpsError('permission-denied', 'Solo super-admin puede ejecutar la migración');
    }
    logger.info('[sub2-migration] start', { uid: req.auth.uid });
    const start = Date.now();
    // TODO en tasks siguientes
    return {
      workspacesProcessed: 0,
      membershipsBackfilled: 0,
      docsBackfilled: 0,
      durationMs: Date.now() - start,
    };
  },
);
```

- [ ] **Step 3: Commit**

```bash
git add functions/src/migrations/migrateToSubproyecto2.ts
git commit -m "feat(migrations): scaffold sub-proyecto 2 migration callable"
```

---

### Task 2: Reemplazar SUPERADMIN_UID con el uid real

**Files:**

- Modify: `functions/src/migrations/migrateToSubproyecto2.ts`

- [ ] **Step 1: Buscar el uid del usuario super-admin**

```bash
# El uid lo tienes en Firebase Console → Authentication → Users → tu cuenta
# O extraerlo del Firestore: artifacts/{appId}/users/{tu-uid}/profile
```

- [ ] **Step 2: Editar el constante**

Reemplazar `REPLACE_WITH_SERPA_UID` por el uid real (string, hardcoded). Comentar que es Sergio Paradela (`serpa2003@gmail.com`) para audit posterior.

- [ ] **Step 3: Commit**

```bash
git add functions/src/migrations/migrateToSubproyecto2.ts
git commit -m "chore(migrations): wire superadmin uid for sub-2 migration"
```

---

### Task 3: Iterar workspaces e identificar las memberships a backfilear

**Files:**

- Modify: `functions/src/migrations/migrateToSubproyecto2.ts`

- [ ] **Step 1: Implementar la iteración**

Reemplazar el `// TODO en tasks siguientes` por:

```ts
const db = admin.firestore();
const APP_ID = 'uros-fbm-app'; // único appId en prod

const workspacesSnap = await db.collection(`artifacts/${APP_ID}/workspaces`).get();

let workspacesProcessed = 0;
let membershipsBackfilled = 0;
let docsBackfilled = 0;

for (const wsDoc of workspacesSnap.docs) {
  const ws = wsDoc.data();
  const wsId = wsDoc.id;
  const ownerId = ws.ownerId as string | undefined;
  if (!ownerId) {
    logger.warn('[sub2-migration] workspace sin ownerId, skip', { wsId });
    continue;
  }

  // Listar todos los teamIds del workspace para el assignedTeamIds default
  const teamsSnap = await db.collection(`artifacts/${APP_ID}/workspaces/${wsId}/teams`).get();
  const allTeamIds = teamsSnap.docs.map((d) => d.id);

  // Ver tasks 4 y 5 abajo para el cuerpo del bucle
  workspacesProcessed += 1;
}

return {
  workspacesProcessed,
  membershipsBackfilled,
  docsBackfilled,
  durationMs: Date.now() - start,
};
```

- [ ] **Step 2: Commit**

```bash
git add functions/src/migrations/migrateToSubproyecto2.ts
git commit -m "feat(migrations): iterate workspaces in sub-2 migration"
```

---

### Task 4: Backfill memberships (`role`, `assignedTeamIds`)

**Files:**

- Modify: `functions/src/migrations/migrateToSubproyecto2.ts`

- [ ] **Step 1: Añadir el bucle de memberships dentro del workspace loop**

Justo después de `const allTeamIds = teamsSnap.docs.map((d) => d.id);`:

```ts
const membersSnap = await db.collection(`artifacts/${APP_ID}/workspaces/${wsId}/members`).get();

for (const memberDoc of membersSnap.docs) {
  const m = memberDoc.data();
  const updates: Record<string, unknown> = {};
  if (m.role === undefined) {
    // Por diseño, todas las memberships pre-sub-2 son de personal workspaces
    // donde el user es DT. Los workspaces club post-sub-3 ya nacerán con role.
    updates.role = 'dt';
  }
  if (m.assignedTeamIds === undefined) {
    updates.assignedTeamIds = allTeamIds;
  }
  if (Object.keys(updates).length > 0) {
    await memberDoc.ref.update(updates);
    membershipsBackfilled += 1;
    logger.info('[sub2-migration] membership backfilled', {
      wsId,
      uid: memberDoc.id,
      updates,
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/src/migrations/migrateToSubproyecto2.ts
git commit -m "feat(migrations): backfill role + assignedTeamIds on memberships"
```

---

### Task 5: Backfill `createdBy` en docs huérfanos

**Files:**

- Modify: `functions/src/migrations/migrateToSubproyecto2.ts`

Las colecciones a iterar (per spec §1 migración): `exercises`, `brackets`, `calendarSessions`, `teams/*/trainings`, `teams/*/cuaderno/{collectionType}/*`. Las nested bajo teams requieren un loop adicional.

- [ ] **Step 1: Añadir helper para backfilear una colección plana**

Justo encima del `export const migrateToSubproyecto2 = ...`:

```ts
async function backfillCreatedByInCollection(
  db: admin.firestore.Firestore,
  collectionPath: string,
  ownerId: string,
): Promise<number> {
  const snap = await db.collection(collectionPath).get();
  let backfilled = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.createdBy === undefined) {
      await doc.ref.update({ createdBy: ownerId });
      backfilled += 1;
    }
  }
  return backfilled;
}
```

- [ ] **Step 2: Llamar al helper para colecciones planas dentro del workspace loop**

Justo después del bucle de memberships:

```ts
docsBackfilled += await backfillCreatedByInCollection(db, `artifacts/${APP_ID}/workspaces/${wsId}/exercises`, ownerId);
docsBackfilled += await backfillCreatedByInCollection(db, `artifacts/${APP_ID}/workspaces/${wsId}/brackets`, ownerId);
docsBackfilled += await backfillCreatedByInCollection(
  db,
  `artifacts/${APP_ID}/workspaces/${wsId}/calendarSessions`,
  ownerId,
);
```

- [ ] **Step 3: Iterar teams y sus subcolecciones**

Justo después del bloque anterior:

```ts
for (const teamDoc of teamsSnap.docs) {
  const teamId = teamDoc.id;
  const teamPath = `artifacts/${APP_ID}/workspaces/${wsId}/teams/${teamId}`;

  docsBackfilled += await backfillCreatedByInCollection(db, `${teamPath}/trainings`, ownerId);

  // cuaderno tiene subcolecciones por collectionType (notas, pilares, normas,
  // jugadores, test-tiro, asistencia, informeJugadores). Cada subcolección
  // contiene los docs reales.
  const cuadernoCollectionTypes = [
    'notas',
    'pilares',
    'normas',
    'jugadores',
    'test-tiro',
    'asistencia',
    'informeJugadores',
  ];
  for (const ct of cuadernoCollectionTypes) {
    docsBackfilled += await backfillCreatedByInCollection(db, `${teamPath}/cuaderno/${ct}`, ownerId);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add functions/src/migrations/migrateToSubproyecto2.ts
git commit -m "feat(migrations): backfill createdBy on legacy docs"
```

---

### Task 6: Verification callable (read-only)

**Files:**

- Create: `functions/src/migrations/verifySubproyecto2Migration.ts`

- [ ] **Step 1: Crear el archivo**

```ts
// functions/src/migrations/verifySubproyecto2Migration.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

interface VerifyResult {
  membershipsMissingRole: number;
  membershipsMissingAssignedTeamIds: number;
  docsMissingCreatedBy: number;
  ok: boolean;
}

const SUPERADMIN_UID = 'REPLACE_WITH_SERPA_UID'; // mismo que migrateToSubproyecto2
const APP_ID = 'uros-fbm-app';

const COLLECTIONS_PLAIN = ['exercises', 'brackets', 'calendarSessions'] as const;
const CUADERNO_TYPES = [
  'notas',
  'pilares',
  'normas',
  'jugadores',
  'test-tiro',
  'asistencia',
  'informeJugadores',
] as const;

async function countMissing(db: admin.firestore.Firestore, collectionPath: string, field: string): Promise<number> {
  const snap = await db.collection(collectionPath).get();
  return snap.docs.filter((d) => d.data()[field] === undefined).length;
}

export const verifySubproyecto2Migration = onCall<unknown, Promise<VerifyResult>>(
  { region: 'europe-west1', timeoutSeconds: 540, memory: '1GiB' },
  async (req) => {
    if (!req.auth || req.auth.uid !== SUPERADMIN_UID) {
      throw new HttpsError('permission-denied', 'Solo super-admin');
    }
    const db = admin.firestore();
    let membershipsMissingRole = 0;
    let membershipsMissingAssignedTeamIds = 0;
    let docsMissingCreatedBy = 0;

    const workspacesSnap = await db.collection(`artifacts/${APP_ID}/workspaces`).get();
    for (const wsDoc of workspacesSnap.docs) {
      const wsId = wsDoc.id;

      const membersSnap = await db.collection(`artifacts/${APP_ID}/workspaces/${wsId}/members`).get();
      for (const m of membersSnap.docs) {
        if (m.data().role === undefined) membershipsMissingRole += 1;
        if (m.data().assignedTeamIds === undefined) membershipsMissingAssignedTeamIds += 1;
      }

      for (const c of COLLECTIONS_PLAIN) {
        docsMissingCreatedBy += await countMissing(db, `artifacts/${APP_ID}/workspaces/${wsId}/${c}`, 'createdBy');
      }

      const teamsSnap = await db.collection(`artifacts/${APP_ID}/workspaces/${wsId}/teams`).get();
      for (const t of teamsSnap.docs) {
        const teamPath = `artifacts/${APP_ID}/workspaces/${wsId}/teams/${t.id}`;
        docsMissingCreatedBy += await countMissing(db, `${teamPath}/trainings`, 'createdBy');
        for (const ct of CUADERNO_TYPES) {
          docsMissingCreatedBy += await countMissing(db, `${teamPath}/cuaderno/${ct}`, 'createdBy');
        }
      }
    }

    return {
      membershipsMissingRole,
      membershipsMissingAssignedTeamIds,
      docsMissingCreatedBy,
      ok: membershipsMissingRole === 0 && membershipsMissingAssignedTeamIds === 0 && docsMissingCreatedBy === 0,
    };
  },
);
```

- [ ] **Step 2: Reemplazar `REPLACE_WITH_SERPA_UID`** con el mismo uid del Task 2.

- [ ] **Step 3: Commit**

```bash
git add functions/src/migrations/verifySubproyecto2Migration.ts
git commit -m "feat(migrations): verifySubproyecto2Migration read-only callable"
```

---

### Task 7: Wire exports en `functions/src/index.ts`

**Files:**

- Modify: `functions/src/index.ts`

- [ ] **Step 1: Añadir al final del archivo**

```ts
export { migrateToSubproyecto2 } from './migrations/migrateToSubproyecto2';
export { verifySubproyecto2Migration } from './migrations/verifySubproyecto2Migration';
```

- [ ] **Step 2: Build local**

```bash
cd functions && npm run build && cd ..
```

Expected: tsc completes without errors.

- [ ] **Step 3: Commit**

```bash
git add functions/src/index.ts
git commit -m "feat(migrations): export sub-2 migration callables"
```

---

### Task 8: Unit test de la migración con mocks

**Files:**

- Create: `functions/src/migrations/migrateToSubproyecto2.test.ts`

- [ ] **Step 1: Escribir el test**

```ts
// functions/src/migrations/migrateToSubproyecto2.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase-admin', () => {
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockDoc = (data: Record<string, unknown>, id: string) => ({
    id,
    ref: { update: mockUpdate },
    data: () => data,
  });
  const mockGet = vi.fn();
  const mockCollection = vi.fn(() => ({ get: mockGet }));
  return {
    firestore: () => ({ collection: mockCollection }),
    __mockUpdate: mockUpdate,
    __mockGet: mockGet,
    __mockDoc: mockDoc,
  };
});

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: unknown, handler: unknown) => handler,
  HttpsError: class HttpsError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

vi.mock('firebase-functions/v2', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('migrateToSubproyecto2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza si auth uid no es el super-admin', async () => {
    const { migrateToSubproyecto2 } = await import('./migrateToSubproyecto2');
    await expect((migrateToSubproyecto2 as any)({ auth: { uid: 'intruder' } })).rejects.toThrow(/super-admin/i);
  });

  it('backfilea memberships sin role/assignedTeamIds', async () => {
    const admin = (await import('firebase-admin')) as any;
    const wsDoc = admin.__mockDoc({ ownerId: 'owner-uid' }, 'ws1');
    const teamDoc1 = admin.__mockDoc({}, 't1');
    const memberDocLegacy = admin.__mockDoc({}, 'owner-uid');

    admin.__mockGet
      .mockResolvedValueOnce({ docs: [wsDoc] }) // workspaces
      .mockResolvedValueOnce({ docs: [teamDoc1] }) // teams (for allTeamIds)
      .mockResolvedValueOnce({ docs: [memberDocLegacy] }) // members
      .mockResolvedValue({ docs: [] }); // todas las colecciones planas y cuaderno

    const { migrateToSubproyecto2 } = await import('./migrateToSubproyecto2');
    const result = await (migrateToSubproyecto2 as any)({
      auth: { uid: 'REPLACE_WITH_SERPA_UID' },
    });

    expect(admin.__mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'dt',
        assignedTeamIds: ['t1'],
      }),
    );
    expect(result.workspacesProcessed).toBe(1);
    expect(result.membershipsBackfilled).toBe(1);
  });

  it('es idempotente: no toca memberships con role ya presente', async () => {
    const admin = (await import('firebase-admin')) as any;
    const wsDoc = admin.__mockDoc({ ownerId: 'owner-uid' }, 'ws1');
    const memberAlreadyMigrated = admin.__mockDoc({ role: 'dt', assignedTeamIds: ['t1'] }, 'owner-uid');

    admin.__mockGet
      .mockResolvedValueOnce({ docs: [wsDoc] })
      .mockResolvedValueOnce({ docs: [] }) // teams
      .mockResolvedValueOnce({ docs: [memberAlreadyMigrated] })
      .mockResolvedValue({ docs: [] });

    const { migrateToSubproyecto2 } = await import('./migrateToSubproyecto2');
    const result = await (migrateToSubproyecto2 as any)({
      auth: { uid: 'REPLACE_WITH_SERPA_UID' },
    });

    expect(admin.__mockUpdate).not.toHaveBeenCalled();
    expect(result.membershipsBackfilled).toBe(0);
  });
});
```

> **Nota**: ajustar `REPLACE_WITH_SERPA_UID` al valor hardcoded del Task 2.

- [ ] **Step 2: Run test**

```bash
cd functions && npx vitest run src/migrations/migrateToSubproyecto2.test.ts && cd ..
```

Expected: 3/3 PASS.

- [ ] **Step 3: Commit**

```bash
git add functions/src/migrations/migrateToSubproyecto2.test.ts
git commit -m "test(migrations): unit tests for sub-2 migration callable"
```

---

### Task 9: Push branch + abrir PR + CI verde + merge

**Files:** ninguno tocado.

- [ ] **Step 1: Push**

```bash
git push -u origin feat/sub-proyecto-2-migration
```

- [ ] **Step 2: Crear PR**

```bash
gh pr create --title "feat(migrations): sub-proyecto 2 backfill callable + verify (PR #1)" --body "$(cat <<'EOF'
## Summary

Sub-proyecto 2 PR #1 — migration tooling. Backfilea data existente para
preparar el deploy de las nuevas reglas (PR #2).

- \`migrateToSubproyecto2\`: HTTP callable admin-gated. Idempotente.
  Backfilea \`role: 'dt'\` + \`assignedTeamIds: [...all teams]\` en memberships
  legacy. Backfilea \`createdBy: workspace.ownerId\` en docs sin createdBy
  (exercises, brackets, calendarSessions, trainings, cuaderno/{X}).
- \`verifySubproyecto2Migration\`: read-only callable, devuelve \`{ ok: true }\`
  cuando los counts están a 0.
- Unit tests con mocks de firebase-admin.

## Test plan

- [ ] CI verde
- [ ] Tras merge: invocar \`migrateToSubproyecto2\` desde Cloud Console
- [ ] Verificar \`verifySubproyecto2Migration\` devuelve \`ok: true\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Esperar CI verde**

```bash
gh pr checks <PR_NUMBER> --watch
```

- [ ] **Step 4: Merge**

```bash
gh pr merge <PR_NUMBER> --squash --delete-branch
```

- [ ] **Step 5: Verificar deploy hosting + functions**

```bash
gh run list --branch main --limit 1 --json databaseId,status,conclusion
```

Expected: success.

---

### Task 10: Run migration en prod + verify

**Files:** ninguno tocado.

- [ ] **Step 1: Invocar `migrateToSubproyecto2` desde Cloud Console**

Firebase Console → Functions → migrateToSubproyecto2 → Test → autenticado con tu uid de super-admin.

Alternativa CLI con curl + Firebase Auth token:

```bash
TOKEN=$(firebase auth:print-access-token)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{}}' \
  https://europe-west1-playoff-creator.cloudfunctions.net/migrateToSubproyecto2
```

Expected response shape:

```json
{
  "result": {
    "workspacesProcessed": N,
    "membershipsBackfilled": M,
    "docsBackfilled": K,
    "durationMs": 12345
  }
}
```

Anotar los counts en `docs/runbooks/sub-proyecto-2-migration.md` (crear el archivo si no existe).

- [ ] **Step 2: Invocar `verifySubproyecto2Migration`**

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{}}' \
  https://europe-west1-playoff-creator.cloudfunctions.net/verifySubproyecto2Migration
```

Expected: `{ "result": { "ok": true, "membershipsMissingRole": 0, "membershipsMissingAssignedTeamIds": 0, "docsMissingCreatedBy": 0 } }`.

Si `ok: false`, **DETENER**: investigar logs de la función, re-run migration. **No proceder a PR #2 hasta `ok: true`**.

- [ ] **Step 3: Re-run hasta ok**

La migración es idempotente, se puede invocar las veces que haga falta. Si tras 3 reruns sigue habiendo diffs, abrir issue para diagnóstico manual.

(Sin commit, operación en prod.)

---

## PR #2 — firestore.rules + tests

### Task 11: Branch + helpers nuevos en `firestore.rules`

**Files:**

- Modify: `firestore.rules`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b feat/sub-proyecto-2-rules
```

- [ ] **Step 2: Reemplazar el archivo `firestore.rules` entero**

Sobrescribir `firestore.rules` con (es un rewrite total, manteniendo solo el match de `shared/{*}` y `users/{uid}/{**}` legacy):

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ============ HELPERS — IDENTIDAD ============

    function isSignedIn() { return request.auth != null; }

    function workspaceData(appId, wsId) {
      return get(/databases/$(database)/documents/
        artifacts/$(appId)/workspaces/$(wsId)).data;
    }

    function membershipData(appId, wsId) {
      return get(/databases/$(database)/documents/
        artifacts/$(appId)/workspaces/$(wsId)/members/$(request.auth.uid)).data;
    }

    function isWorkspaceMember(appId, wsId) {
      return isSignedIn() && exists(/databases/$(database)/documents/
        artifacts/$(appId)/workspaces/$(wsId)/members/$(request.auth.uid));
    }

    function isWorkspaceMemberUid(appId, wsId, uid) {
      return exists(/databases/$(database)/documents/
        artifacts/$(appId)/workspaces/$(wsId)/members/$(uid));
    }

    function isWorkspaceOwner(appId, wsId) {
      return isSignedIn() && workspaceData(appId, wsId).ownerId == request.auth.uid;
    }

    function isPersonalWorkspaceOwner(appId, wsId) {
      return isWorkspaceOwner(appId, wsId)
          && workspaceData(appId, wsId).workspaceType == 'personal';
    }

    function isDT(appId, wsId) {
      return isWorkspaceMember(appId, wsId)
          && membershipData(appId, wsId).role == 'dt';
    }

    // ============ HELPERS — SCOPING ============

    function isAssignedToTeam(appId, wsId, teamId) {
      return isWorkspaceMember(appId, wsId)
          && teamId in membershipData(appId, wsId).assignedTeamIds;
    }

    function hasGrantOn(appId, wsId, teamId, collectionType) {
      return isWorkspaceMember(appId, wsId) && exists(
        /databases/$(database)/documents/
          artifacts/$(appId)/workspaces/$(wsId)/teams/$(teamId)
          /grants/$(collectionType)/$(request.auth.uid));
    }

    // ============ HELPERS — COMPOSICIÓN ============

    function isCreator(data) { return data.createdBy == request.auth.uid; }

    function workspaceMetaProtected(diff) {
      return diff.affectedKeys().hasAny(['ownerId', 'plan', 'billing']) == false;
    }

    function sharedPath(appId, shareCode) {
      return /databases/$(database)/documents/artifacts/$(appId)/shared/$(shareCode);
    }

    function sharedConfig(data) {
      return data.shareConfig != null ? data.shareConfig : {};
    }

    function sharedInvites(data) {
      return sharedConfig(data).invites != null ? sharedConfig(data).invites : {};
    }

    function invitePermission(data) {
      return request.auth.token.email != null ? sharedInvites(data)[request.auth.token.email] : null;
    }

    function canReadSharedData(data) {
      return isSignedIn() && (
        sharedConfig(data).ownerId == request.auth.uid ||
        sharedConfig(data).linkAccess == 'view' ||
        sharedConfig(data).linkAccess == 'edit' ||
        invitePermission(data) != null
      );
    }

    function canEditSharedData(data) {
      return isSignedIn() && (
        sharedConfig(data).ownerId == request.auth.uid ||
        sharedConfig(data).linkAccess == 'edit' ||
        invitePermission(data) == 'edit'
      );
    }

    function canReadSharedDoc(appId, shareCode) {
      return exists(sharedPath(appId, shareCode))
          && canReadSharedData(get(sharedPath(appId, shareCode)).data);
    }

    // ============ MATCHES — placeholder, fillable en tasks 12-21 ============

    // Cat A — workspace meta (Task 12)
    // Cat B — DT-curated workspace-wide (Task 14)
    // Cat C — team-scoped strict (Tasks 16-21)
    // Cat E — sistema (sub-5)
    match /artifacts/{appId}/workspaces/{wsId}/usage/{monthId} {
      allow read:  if isWorkspaceMember(appId, wsId);
      allow write: if false;
    }
    match /artifacts/{appId}/stripeEvents/{eventId} {
      allow read, write: if false;
    }

    // Cat D — user-scoped (sin cambios)
    match /artifacts/{appId}/users/{uid}/{document=**} {
      allow read, write: if isSignedIn() && request.auth.uid == uid;
    }

    // Shared legacy (sin cambios)
    match /artifacts/{appId}/shared/{shareCode} {
      allow read:   if canReadSharedData(resource.data);
      allow create: if isSignedIn() && sharedConfig(request.resource.data).ownerId == request.auth.uid;
      allow update: if canEditSharedData(resource.data)
        && sharedConfig(request.resource.data).ownerId == sharedConfig(resource.data).ownerId;
      allow delete: if isSignedIn() && sharedConfig(resource.data).ownerId == request.auth.uid;
    }

    match /artifacts/{appId}/presence/{shareCode}/{document=**} {
      allow read, write: if canReadSharedDoc(appId, shareCode);
    }

    match /artifacts/{appId}/shared-exercises/{shareCode} {
      allow read:  if true;
      allow write: if isSignedIn();
    }
  }
}
```

> **Importante**: este commit deja la regla de `workspaces/{wsId}` y subcolecciones SIN match block. Eso significa **deny por defecto** en cualquier lectura/escritura del workspace. Los tests fallarán hasta tasks 12-21. Si quieres validación intermedia, deploya el archivo solo tras Task 21.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "refactor(rules): scaffold sub-2 helpers + retain shared/users/system matches"
```

---

### Task 12: Cat A — match `workspaces/{wsId}` + `members/{uid}`

**Files:**

- Modify: `firestore.rules`

- [ ] **Step 1: Insertar el match block antes de la línea `// Cat E — sistema`**

```js
// ============ Cat A — workspace meta ============

match /artifacts/{appId}/workspaces/{wsId} {
  allow read: if isWorkspaceMember(appId, wsId);

  allow create: if isSignedIn()
    && request.resource.data.ownerId == request.auth.uid;

  allow update: if isWorkspaceOwner(appId, wsId)
    && (
      request.resource.data.ownerId == resource.data.ownerId
      || isWorkspaceMemberUid(appId, wsId, request.resource.data.ownerId)
    );
  allow update: if isDT(appId, wsId)
    && workspaceMetaProtected(request.resource.data.diff(resource.data));

  allow delete: if isWorkspaceOwner(appId, wsId);

  match /members/{memberUid} {
    allow read: if isWorkspaceMember(appId, wsId);

    allow create: if (isDT(appId, wsId) || isWorkspaceOwner(appId, wsId));

    allow update: if (isDT(appId, wsId) || isWorkspaceOwner(appId, wsId))
                     && memberUid != workspaceData(appId, wsId).ownerId;
    allow update: if isWorkspaceOwner(appId, wsId)
                     && memberUid == request.auth.uid;

    allow delete: if (isDT(appId, wsId) || isWorkspaceOwner(appId, wsId))
                     && memberUid != workspaceData(appId, wsId).ownerId;
  }
}
```

- [ ] **Step 2: Validate la sintaxis con emulator**

```bash
firebase emulators:start --only firestore --project demo-test
# en otro terminal: ctrl-c una vez arranca, comprueba que no hay parser error
```

Si hay un error de sintaxis, arreglarlo antes de seguir.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): Cat A workspace meta + members directory"
```

---

### Task 13: Tests Cat A en `firestore.rules.test.ts`

**Files:**

- Modify: `firestore.rules.test.ts`

- [ ] **Step 1: Mirar el archivo actual y entender la setup**

```bash
head -50 firestore.rules.test.ts
```

Hay un `testEnv` ya inicializado. Reusar.

- [ ] **Step 2: Añadir un nuevo `describe` block al final del archivo**

```ts
describe('sub-proyecto 2 — Cat A workspace meta', () => {
  const APP_ID = 'test-app';
  const WS_ID = 'ws1';
  const OWNER_UID = 'owner-uid';
  const DT_UID = 'dt-uid';
  const COACH_UID = 'coach-uid';
  const NON_MEMBER_UID = 'stranger-uid';

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}`)
        .set({ ownerId: OWNER_UID, workspaceType: 'club', plan: 'pro' });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/members/${OWNER_UID}`)
        .set({ role: 'dt', assignedTeamIds: [] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/members/${DT_UID}`)
        .set({ role: 'dt', assignedTeamIds: [] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/members/${COACH_UID}`)
        .set({ role: 'coach', assignedTeamIds: ['t1'] });
    });
  });

  it('owner puede editar settings del workspace', async () => {
    const owner = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      owner.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}`).update({
        displayName: 'New name',
      }),
    );
  });

  it('DT NO puede cambiar ownerId/plan/billing del workspace', async () => {
    const dt = testEnv.authenticatedContext(DT_UID).firestore();
    await assertFails(
      dt.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}`).update({
        plan: 'max',
      }),
    );
  });

  it('coach denegado para editar workspace doc', async () => {
    const coach = testEnv.authenticatedContext(COACH_UID).firestore();
    await assertFails(
      coach.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}`).update({
        displayName: 'Coach edit',
      }),
    );
  });

  it('non-member denegado para leer workspace doc', async () => {
    const stranger = testEnv.authenticatedContext(NON_MEMBER_UID).firestore();
    await assertFails(stranger.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}`).get());
  });

  it('DT puede crear nueva membership', async () => {
    const dt = testEnv.authenticatedContext(DT_UID).firestore();
    await assertSucceeds(
      dt.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/members/new-uid`).set({
        role: 'coach',
        assignedTeamIds: [],
      }),
    );
  });

  it('DT NO puede tocar la membership del owner', async () => {
    const dt = testEnv.authenticatedContext(DT_UID).firestore();
    await assertFails(dt.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/members/${OWNER_UID}`).update({ role: 'coach' }));
  });

  it('owner puede editar su propia membership', async () => {
    const owner = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      owner
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/members/${OWNER_UID}`)
        .update({ assignedTeamIds: ['t1', 't2'] }),
    );
  });

  it('transfer ownership requiere que el nuevo owner sea member', async () => {
    const owner = testEnv.authenticatedContext(OWNER_UID).firestore();
    // DT_UID YA es member
    await assertSucceeds(
      owner.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}`).update({
        ownerId: DT_UID,
      }),
    );
    // Reset to OWNER_UID for siguiente test (afterEach)
  });

  it('transfer ownership a uid no-member es denegado', async () => {
    const owner = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(
      owner.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}`).update({
        ownerId: NON_MEMBER_UID,
      }),
    );
  });
});
```

- [ ] **Step 3: Run tests**

```bash
firebase emulators:exec --only firestore "npx vitest run firestore.rules.test.ts"
```

Expected: 9/9 PASS para el nuevo describe.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules.test.ts
git commit -m "test(rules): Cat A workspace meta coverage (9 cases)"
```

---

### Task 14: Cat B — match `exercises` + `cuadernoTemplate`

**Files:**

- Modify: `firestore.rules`

- [ ] **Step 1: Insertar el match block dentro del `match /artifacts/{appId}/workspaces/{wsId}` ya existente, después del bloque de `members`**

```js
// ============ Cat B — workspace-wide DT-curated ============

match /exercises/{exerciseId} {
  allow read: if isWorkspaceMember(appId, wsId);
  allow create: if (isDT(appId, wsId) || isWorkspaceOwner(appId, wsId))
                   && isCreator(request.resource.data);
  allow update: if (isDT(appId, wsId) || isWorkspaceOwner(appId, wsId))
                   && isCreator(resource.data)
                   && request.resource.data.createdBy == resource.data.createdBy;
  allow delete: if (isDT(appId, wsId) || isWorkspaceOwner(appId, wsId))
                   && isCreator(resource.data);
}

match /cuadernoTemplate/{sectionId} {
  allow read: if isWorkspaceMember(appId, wsId);
  allow write: if isDT(appId, wsId) || isWorkspaceOwner(appId, wsId);
}
```

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): Cat B workspace-wide DT-curated (exercises, cuadernoTemplate)"
```

---

### Task 15: Tests Cat B

**Files:**

- Modify: `firestore.rules.test.ts`

- [ ] **Step 1: Añadir nuevo `describe` block**

```ts
describe('sub-proyecto 2 — Cat B workspace-wide DT-curated', () => {
  const APP_ID = 'test-app';
  const WS_ID = 'ws1';
  const DT_UID = 'dt-uid';
  const COACH_UID = 'coach-uid';

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}`).set({ ownerId: DT_UID, workspaceType: 'club' });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/members/${DT_UID}`)
        .set({ role: 'dt', assignedTeamIds: [] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/members/${COACH_UID}`)
        .set({ role: 'coach', assignedTeamIds: ['t1'] });
      // Seed: ejercicio creado por DT
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/exercises/ex-dt`)
        .set({ name: 'Batería defensiva', createdBy: DT_UID });
    });
  });

  it('DT crea ejercicio en biblioteca club', async () => {
    const dt = testEnv.authenticatedContext(DT_UID).firestore();
    await assertSucceeds(
      dt.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/exercises/ex-new`).set({ name: 'X', createdBy: DT_UID }),
    );
  });

  it('coach lee biblioteca club pero NO escribe', async () => {
    const coach = testEnv.authenticatedContext(COACH_UID).firestore();
    await assertSucceeds(coach.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/exercises/ex-dt`).get());
    await assertFails(
      coach.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/exercises/ex-coach`).set({ name: 'Y', createdBy: COACH_UID }),
    );
  });

  it('coach NO edita ejercicio creado por DT', async () => {
    const coach = testEnv.authenticatedContext(COACH_UID).firestore();
    await assertFails(coach.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/exercises/ex-dt`).update({ name: 'Renamed' }));
  });

  it('DT edita su propia creación pero no puede cambiar createdBy', async () => {
    const dt = testEnv.authenticatedContext(DT_UID).firestore();
    await assertSucceeds(
      dt.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/exercises/ex-dt`).update({ name: 'Renamed by DT' }),
    );
    await assertFails(
      dt.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/exercises/ex-dt`).update({ createdBy: 'ghost-uid' }),
    );
  });

  it('DT escribe en cuadernoTemplate; coach lee pero no escribe', async () => {
    const dt = testEnv.authenticatedContext(DT_UID).firestore();
    const coach = testEnv.authenticatedContext(COACH_UID).firestore();
    await assertSucceeds(
      dt
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/cuadernoTemplate/main`)
        .set({ clubLogoUrl: '...', clubName: 'Test club' }),
    );
    await assertSucceeds(coach.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/cuadernoTemplate/main`).get());
    await assertFails(
      coach.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/cuadernoTemplate/main`).set({ clubName: 'Coach takeover' }),
    );
  });
});
```

- [ ] **Step 2: Run tests**

```bash
firebase emulators:exec --only firestore "npx vitest run firestore.rules.test.ts"
```

Expected: 5/5 PASS para el nuevo describe.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules.test.ts
git commit -m "test(rules): Cat B workspace-wide DT-curated coverage"
```

---

### Task 16: Cat C — match `teams/{teamId}` (el doc en sí)

**Files:**

- Modify: `firestore.rules`

- [ ] **Step 1: Añadir match dentro del workspace match, después de `cuadernoTemplate`**

```js
// ============ Cat C — team-scoped strict ============

match /teams/{teamId} {
  // El team doc en sí es member-readable (todos saben qué equipos existen).
  allow read: if isWorkspaceMember(appId, wsId);

  allow create: if isDT(appId, wsId) || isWorkspaceOwner(appId, wsId);

  allow update: if isDT(appId, wsId)
                   || isWorkspaceOwner(appId, wsId)
                   || isAssignedToTeam(appId, wsId, teamId);

  allow delete: if isDT(appId, wsId) || isWorkspaceOwner(appId, wsId);

  // Las subcolecciones se definen en tasks 17-21 (members, trainings, cuaderno, grants).
}
```

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): Cat C team doc (member-read, DT-write, coach-update if assigned)"
```

---

### Task 17: Cat C — match `teams/{teamId}/trainings/{*}` y `teams/{teamId}/members/{*}`

**Files:**

- Modify: `firestore.rules`

- [ ] **Step 1: Añadir matches DENTRO del match `teams/{teamId}`**

```js
match /trainings/{trainingId} {
  allow read: if isPersonalWorkspaceOwner(appId, wsId)
                 || isAssignedToTeam(appId, wsId, teamId)
                 || (resource != null && isCreator(resource.data));

  allow create: if isPersonalWorkspaceOwner(appId, wsId)
                   || (
                     (isAssignedToTeam(appId, wsId, teamId) || isDT(appId, wsId))
                     && isCreator(request.resource.data)
                   );

  allow update: if (
                     isPersonalWorkspaceOwner(appId, wsId)
                     || isAssignedToTeam(appId, wsId, teamId)
                     || (resource != null && isCreator(resource.data))
                   )
                   && request.resource.data.createdBy == resource.data.createdBy;

  allow delete: if isPersonalWorkspaceOwner(appId, wsId)
                   || isAssignedToTeam(appId, wsId, teamId)
                   || (resource != null && isCreator(resource.data));
}

match /members/{teamMemberDocId} {
  allow read: if isPersonalWorkspaceOwner(appId, wsId)
                 || isAssignedToTeam(appId, wsId, teamId)
                 || (resource != null && isCreator(resource.data));

  allow create: if isPersonalWorkspaceOwner(appId, wsId)
                   || (
                     (isAssignedToTeam(appId, wsId, teamId) || isDT(appId, wsId))
                     && isCreator(request.resource.data)
                   );

  allow update: if (
                     isPersonalWorkspaceOwner(appId, wsId)
                     || isAssignedToTeam(appId, wsId, teamId)
                     || (resource != null && isCreator(resource.data))
                   )
                   && request.resource.data.createdBy == resource.data.createdBy;

  allow delete: if isPersonalWorkspaceOwner(appId, wsId)
                   || isAssignedToTeam(appId, wsId, teamId)
                   || (resource != null && isCreator(resource.data));
}
```

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): Cat C team-scoped trainings + jugadores"
```

---

### Task 18: Cat C — match `teams/{teamId}/cuaderno/{collectionType}/{*}` con grants

**Files:**

- Modify: `firestore.rules`

- [ ] **Step 1: Añadir match DENTRO del match `teams/{teamId}`**

```js
match /cuaderno/{collectionType}/{docId} {
  allow read: if isPersonalWorkspaceOwner(appId, wsId)
                 || isAssignedToTeam(appId, wsId, teamId)
                 || (resource != null && isCreator(resource.data))
                 || (
                   (collectionType == 'asistencia' || collectionType == 'informeJugadores')
                   && hasGrantOn(appId, wsId, teamId, collectionType)
                 );

  allow create: if isPersonalWorkspaceOwner(appId, wsId)
                   || (
                     (isAssignedToTeam(appId, wsId, teamId) || isDT(appId, wsId))
                     && isCreator(request.resource.data)
                   );

  allow update: if (
                     isPersonalWorkspaceOwner(appId, wsId)
                     || isAssignedToTeam(appId, wsId, teamId)
                     || (resource != null && isCreator(resource.data))
                   )
                   && request.resource.data.createdBy == resource.data.createdBy;

  allow delete: if isPersonalWorkspaceOwner(appId, wsId)
                   || isAssignedToTeam(appId, wsId, teamId)
                   || (resource != null && isCreator(resource.data));
}
```

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): Cat C cuaderno wildcard with grant clause for asistencia/informe"
```

---

### Task 19: Cat C — match `brackets/{*}` y `calendarSessions/{*}`

**Files:**

- Modify: `firestore.rules`

- [ ] **Step 1: Añadir matches DENTRO del match del workspace (al mismo nivel que teams, exercises, cuadernoTemplate)**

```js
match /brackets/{bracketId} {
  allow read: if isPersonalWorkspaceOwner(appId, wsId)
                 || isAssignedToTeam(appId, wsId, resource.data.teamId)
                 || isCreator(resource.data);

  allow create: if isPersonalWorkspaceOwner(appId, wsId)
                   || (
                     (isAssignedToTeam(appId, wsId, request.resource.data.teamId)
                       || isDT(appId, wsId))
                     && isCreator(request.resource.data)
                   );

  allow update: if (
                     isPersonalWorkspaceOwner(appId, wsId)
                     || (
                       isAssignedToTeam(appId, wsId, resource.data.teamId)
                       && isAssignedToTeam(appId, wsId, request.resource.data.teamId)
                     )
                     || isCreator(resource.data)
                   )
                   && request.resource.data.createdBy == resource.data.createdBy;

  allow delete: if isPersonalWorkspaceOwner(appId, wsId)
                   || isAssignedToTeam(appId, wsId, resource.data.teamId)
                   || isCreator(resource.data);
}

match /calendarSessions/{sessionId} {
  allow read: if isPersonalWorkspaceOwner(appId, wsId)
                 || isAssignedToTeam(appId, wsId, resource.data.teamId)
                 || isCreator(resource.data);

  allow create: if isPersonalWorkspaceOwner(appId, wsId)
                   || (
                     (isAssignedToTeam(appId, wsId, request.resource.data.teamId)
                       || isDT(appId, wsId))
                     && isCreator(request.resource.data)
                   );

  allow update: if (
                     isPersonalWorkspaceOwner(appId, wsId)
                     || (
                       isAssignedToTeam(appId, wsId, resource.data.teamId)
                       && isAssignedToTeam(appId, wsId, request.resource.data.teamId)
                     )
                     || isCreator(resource.data)
                   )
                   && request.resource.data.createdBy == resource.data.createdBy;

  allow delete: if isPersonalWorkspaceOwner(appId, wsId)
                   || isAssignedToTeam(appId, wsId, resource.data.teamId)
                   || isCreator(resource.data);
}
```

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): Cat C brackets + calendarSessions with double-teamId update check"
```

---

### Task 20: Cat C — match `teams/{teamId}/grants/{collectionType}/{grantedToUid}`

**Files:**

- Modify: `firestore.rules`

- [ ] **Step 1: Añadir match DENTRO del match `teams/{teamId}`**

```js
match /grants/{collectionType}/{grantedToUid} {
  allow read: if isWorkspaceMember(appId, wsId);

  allow create: if isAssignedToTeam(appId, wsId, teamId)
                   && request.resource.data.grantedBy == request.auth.uid
                   && request.resource.data.collectionType == collectionType
                   && request.resource.data.grantedTo == grantedToUid;

  allow update: if false;

  allow delete: if (
    isAssignedToTeam(appId, wsId, teamId)
    && resource.data.grantedBy == request.auth.uid
  ) || isDT(appId, wsId) || isWorkspaceOwner(appId, wsId);
}
```

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): Cat C grants subcollection (collection-level sharing)"
```

---

### Task 21: Tests Cat C completo (~14 casos)

**Files:**

- Modify: `firestore.rules.test.ts`

- [ ] **Step 1: Añadir nuevo `describe` block**

```ts
describe('sub-proyecto 2 — Cat C team-scoped strict', () => {
  const APP_ID = 'test-app';
  const WS_ID = 'ws1';
  const OWNER_UID = 'owner-uid';
  const DT_UID = 'dt-uid';
  const COACH_T1_UID = 'coach-t1-uid';
  const COACH_T2_UID = 'coach-t2-uid';

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}`).set({ ownerId: OWNER_UID, workspaceType: 'club' });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/members/${OWNER_UID}`)
        .set({ role: 'dt', assignedTeamIds: [] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/members/${DT_UID}`)
        .set({ role: 'dt', assignedTeamIds: [] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/members/${COACH_T1_UID}`)
        .set({ role: 'coach', assignedTeamIds: ['t1'] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/members/${COACH_T2_UID}`)
        .set({ role: 'coach', assignedTeamIds: ['t2'] });
      await db.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1`).set({ name: 'T1' });
      await db.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t2`).set({ name: 'T2' });
      // Seed cuaderno notes en t1, autoría coach-t1
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/cuaderno/notas/n1`)
        .set({ text: 'nota t1', createdBy: COACH_T1_UID });
      // Seed bracket en t1, autoría coach-t1
      await db.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/brackets/b1`).set({
        teamId: 't1',
        createdBy: COACH_T1_UID,
      });
    });
  });

  it('coach-t1 R/W en cuaderno/notas de t1', async () => {
    const c = testEnv.authenticatedContext(COACH_T1_UID).firestore();
    await assertSucceeds(c.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/cuaderno/notas/n1`).get());
    await assertSucceeds(
      c
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/cuaderno/notas/n2`)
        .set({ text: 'new', createdBy: COACH_T1_UID }),
    );
  });

  it('coach-t1 denegado para leer cuaderno/notas de t2', async () => {
    const c = testEnv.authenticatedContext(COACH_T1_UID).firestore();
    await assertFails(c.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t2/cuaderno/notas/x`).get());
  });

  it('DT denegado leer notas creadas por coach (sin asignación, sin grant)', async () => {
    const dt = testEnv.authenticatedContext(DT_UID).firestore();
    await assertFails(dt.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/cuaderno/notas/n1`).get());
  });

  it('DT puede CREATE cuaderno entry en t1 aunque no esté asignado', async () => {
    const dt = testEnv.authenticatedContext(DT_UID).firestore();
    await assertSucceeds(
      dt
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/cuaderno/notas/n-dt`)
        .set({ text: 'from DT', createdBy: DT_UID }),
    );
  });

  it('DT mantiene R/W de su propia creación vía createdBy', async () => {
    const dt = testEnv.authenticatedContext(DT_UID).firestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/cuaderno/notas/n-dt`)
        .set({ text: 'from DT', createdBy: DT_UID });
    });
    await assertSucceeds(dt.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/cuaderno/notas/n-dt`).get());
  });

  it('non-member denegado lectura cuaderno', async () => {
    const stranger = testEnv.authenticatedContext('stranger').firestore();
    await assertFails(stranger.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/cuaderno/notas/n1`).get());
  });

  it('coach-t1 grants asistencia a DT; DT puede leer asistencia', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/cuaderno/asistencia/a1`)
        .set({ date: '2026-04-15', createdBy: COACH_T1_UID });
    });
    const c = testEnv.authenticatedContext(COACH_T1_UID).firestore();
    await assertSucceeds(
      c.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/grants/asistencia/${DT_UID}`).set({
        grantedBy: COACH_T1_UID,
        grantedTo: DT_UID,
        collectionType: 'asistencia',
        grantedAt: new Date(),
      }),
    );
    const dt = testEnv.authenticatedContext(DT_UID).firestore();
    await assertSucceeds(dt.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/cuaderno/asistencia/a1`).get());
  });

  it('DT sin grant denegado para asistencia', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/cuaderno/asistencia/a1`)
        .set({ date: '2026-04-15', createdBy: COACH_T1_UID });
    });
    const dt = testEnv.authenticatedContext(DT_UID).firestore();
    await assertFails(dt.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/cuaderno/asistencia/a1`).get());
  });

  it('revoke de grant: coach borra el grant; DT vuelve a estar denegado', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/cuaderno/asistencia/a1`)
        .set({ date: '2026-04-15', createdBy: COACH_T1_UID });
      await db.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/grants/asistencia/${DT_UID}`).set({
        grantedBy: COACH_T1_UID,
        grantedTo: DT_UID,
        collectionType: 'asistencia',
      });
    });
    const c = testEnv.authenticatedContext(COACH_T1_UID).firestore();
    await assertSucceeds(
      c.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/grants/asistencia/${DT_UID}`).delete(),
    );
    const dt = testEnv.authenticatedContext(DT_UID).firestore();
    await assertFails(dt.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/cuaderno/asistencia/a1`).get());
  });

  it('update de grant prohibido', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/grants/asistencia/${DT_UID}`).set({
        grantedBy: COACH_T1_UID,
        grantedTo: DT_UID,
        collectionType: 'asistencia',
      });
    });
    const c = testEnv.authenticatedContext(COACH_T1_UID).firestore();
    await assertFails(
      c
        .doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/grants/asistencia/${DT_UID}`)
        .update({ grantedAt: new Date() }),
    );
  });

  it('coach-t1 R/W en bracket de t1', async () => {
    const c = testEnv.authenticatedContext(COACH_T1_UID).firestore();
    await assertSucceeds(c.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/brackets/b1`).get());
    await assertSucceeds(c.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/brackets/b1`).update({ name: 'Updated' }));
  });

  it('coach-t1 NO puede reparentear bracket de t1 a t2', async () => {
    const c = testEnv.authenticatedContext(COACH_T1_UID).firestore();
    await assertFails(c.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/brackets/b1`).update({ teamId: 't2' }));
  });

  it('DT crea bracket en cualquier team aunque no esté asignado', async () => {
    const dt = testEnv.authenticatedContext(DT_UID).firestore();
    await assertSucceeds(
      dt.doc(`artifacts/${APP_ID}/workspaces/${WS_ID}/brackets/b-new`).set({
        teamId: 't2',
        createdBy: DT_UID,
      }),
    );
  });
});
```

- [ ] **Step 2: Run tests**

```bash
firebase emulators:exec --only firestore "npx vitest run firestore.rules.test.ts"
```

Expected: 14/14 PASS para el nuevo describe.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules.test.ts
git commit -m "test(rules): Cat C team-scoped + sharing primitive coverage (14 cases)"
```

---

### Task 22: Run full test suite + lint + format + build

**Files:** ninguno tocado.

- [ ] **Step 1: Lint + format check**

```bash
npm run lint
npm run format:check
```

Expected: 0 errors.

- [ ] **Step 2: Tests completos**

```bash
firebase emulators:exec --only firestore "npm test"
```

Expected: TODOS los tests pasan (~28 nuevos en firestore.rules.test + los previos).

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: clean.

- [ ] **Step 4: Si todo verde, commit (vacío si no hay cambios)**

```bash
git status
```

Si hay archivos sin commit, commit. Si no, seguir.

---

### Task 23: Push + PR + CI + merge + deploy + soak

**Files:** ninguno tocado.

- [ ] **Step 1: Push**

```bash
git push -u origin feat/sub-proyecto-2-rules
```

- [ ] **Step 2: PR**

```bash
gh pr create --title "feat(rules): sub-proyecto 2 permisos y scoping (PR #2)" --body "$(cat <<'EOF'
## Summary

Sub-proyecto 2 PR #2 — reescribe \`firestore.rules\` para implementar la
matriz de permisos del spec \`docs/superpowers/specs/2026-05-04-sub-proyecto-2-permisos-y-scoping-design.md\`.

- 9 helpers nuevos: \`isWorkspaceMember\`, \`isWorkspaceOwner\`,
  \`isPersonalWorkspaceOwner\`, \`isDT\`, \`isAssignedToTeam\`,
  \`hasGrantOn\`, \`isCreator\`, \`workspaceMetaProtected\`,
  \`isWorkspaceMemberUid\`.
- 5 categorías de matches: workspace meta (Cat A), DT-curated workspace-wide
  (Cat B), team-scoped strict (Cat C: trainings, jugadores, cuaderno con
  grants para asistencia/informe, brackets, calendarSessions, grants
  subcollection), user-scoped (Cat D, sin cambios), sistema (Cat E, sub-5).
- ~28 tests nuevos en \`firestore.rules.test.ts\` cubriendo cada categoría.
- Mantiene rules legacy de \`shared/{*}\` y \`shared-exercises/{*}\` sin tocar.

**Pre-requisito**: PR #1 ya merged y \`migrateToSubproyecto2\` ejecutado en
prod, con \`verifySubproyecto2Migration\` devolviendo \`ok: true\`.

## Test plan

- [ ] CI verde
- [ ] Tras merge: smoke test en prod
  - [ ] Coach asignado a t1 ve cuaderno de t1, NO ve t2
  - [ ] DT puede crear training en cualquier team
  - [ ] Coach comparte asistencia con DT vía grant doc; DT puede leer
  - [ ] Owner edita workspace settings (display name); intento de cambiar plan falla

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI**

```bash
gh pr checks <PR_NUMBER> --watch
```

- [ ] **Step 4: Merge si verde**

```bash
gh pr merge <PR_NUMBER> --squash --delete-branch
```

- [ ] **Step 5: Verify deploy**

```bash
gh run list --branch main --limit 1 --json status,conclusion
```

- [ ] **Step 6: Soak monitoring (1-2 semanas)**

Anotar en `docs/runbooks/sub-proyecto-2-migration.md` la fecha de deploy. Monitorizar:

- Errores PERMISSION_DENIED en Cloud Logging por encima de baseline → posible regresión
- Reportes manuales de "no veo cosas que veía antes"
- Tests de smoke quincenales

Si después de 2 semanas no hay reportes, pasar a Task 24 (PR #3 cleanup).

(Sin commit, operativa.)

---

## PR #3 — Cleanup migration tooling (1-2 semanas tras PR #2)

### Task 24: Eliminar callables de migración

**Files:**

- Delete: `functions/src/migrations/migrateToSubproyecto2.ts`
- Delete: `functions/src/migrations/verifySubproyecto2Migration.ts`
- Delete: `functions/src/migrations/migrateToSubproyecto2.test.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b chore/sub-proyecto-2-cleanup
```

- [ ] **Step 2: Borrar archivos + exports**

```bash
git rm functions/src/migrations/migrateToSubproyecto2.ts
git rm functions/src/migrations/verifySubproyecto2Migration.ts
git rm functions/src/migrations/migrateToSubproyecto2.test.ts
```

Editar `functions/src/index.ts` y eliminar las dos líneas de `export { migrateToSubproyecto2 } from ...` y `export { verifySubproyecto2Migration } from ...`.

- [ ] **Step 3: Build**

```bash
cd functions && npm run build && cd ..
```

Expected: clean.

- [ ] **Step 4: Commit + push + PR + merge**

```bash
git add -A
git commit -m "chore(migrations): cleanup sub-proyecto 2 migration callables"
git push -u origin chore/sub-proyecto-2-cleanup

gh pr create --title "chore(migrations): cleanup sub-proyecto 2 migration tooling (PR #3)" --body "Sub-proyecto 2 PR #3 — cleanup. Tras 1-2 semanas de soak sin regresiones, eliminar la Cloud Function one-shot de migración y su test. Cero impacto funcional."

gh pr checks <PR_NUMBER> --watch
gh pr merge <PR_NUMBER> --squash --delete-branch
```

- [ ] **Step 5: Verify deploy**

Cloud Functions Console → confirmar que `migrateToSubproyecto2` y `verifySubproyecto2Migration` ya no aparecen.

(Sin commit adicional, fin.)

---

## Cierre del sub-proyecto

Sub-proyecto 2 cierra cuando PR #3 está deployed. Sucesor inmediato: **sub-proyecto 3 — Invitaciones y licencias**, que construye:

- UI para gestionar memberships (invitar, cambiar role, asignar a teams, transfer ownership)
- Cloud Function trigger que limpia outstanding grants on member delete
- Cloud Function trigger que sincroniza `assignedTeamIds` en personal workspaces cuando se crea un team
- Flujo "designa nuevo owner antes de demoter tu propio rol"

Memoria actualizable en `project_subproyecto_2_status.md` con fechas de cada PR + counts de migración como audit.

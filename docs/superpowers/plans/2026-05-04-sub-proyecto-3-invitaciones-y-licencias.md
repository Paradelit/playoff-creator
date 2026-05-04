# Sub-proyecto 3 — Invitaciones y licencias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el flujo "DT invita coach → coach claim → DT gestiona membership" sobre los rails de roles+scoping+grants que dejó sub-2, con feature-flag de creación de club para super-admin + 1-2 testers.

**Architecture:** 13 Cloud Functions en `functions/src/sub3/` (8 callables write, 1 callable read-only allowlist, 3 triggers Firestore, 1 scheduled cleanup), refuerzo de `firestore.rules` (writes directos a `members/*` y `workspaces.ownerId` cerrados, nuevo bloque `invites/*` write-false), y 4 pantallas/componentes nuevos en `src/` (WorkspaceSelector + CrearClubModal en shell, MembersScreen + TransferOwnershipScreen bajo `/area-privada/settings/`, InviteLandingScreen pública en `/invite/:wsId/:inviteId`).

**Tech Stack:** Firebase Functions v2 (TS) + Admin SDK + vitest unit con mock Firestore; Firestore rules con `@firebase/rules-unit-testing` (emulator); React 19 + Vite + Tailwind + React Router v7 + Vitest + RTL.

**Source spec:** `docs/superpowers/specs/2026-05-04-sub-proyecto-3-invitaciones-y-licencias-design.md` (commit `9570c74`).

**Predecesor live:** sub-2 (PR #1 migration + PR #2 rules deployed 2026-05-04, soak en curso). Sub-3 NO depende del cleanup de sub-2 (PR #3 cleanup) — los `members/*` ya tienen el shape correcto.

---

## File structure

### Backend (PR #1)

| Archivo                                            | Responsabilidad                                                                                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `functions/src/sub3/clubAllowlist.ts`              | Constante `CLUB_CREATION_ALLOWLIST: string[]` + helper `isInClubAllowlist(uid)`. Allowlist de uids autorizados a crear workspace club. |
| `functions/src/sub3/types.ts`                      | Tipos compartidos (`InviteDoc`, `MemberDoc`, `MembershipDoc`, `ClubRole`).                                                             |
| `functions/src/sub3/createClub.ts`                 | Pure handler `handleCreateClub({ db, auth, data })` + `createClub = onCall(...)`.                                                      |
| `functions/src/sub3/createClub.test.ts`            | 4 tests vitest mock Firestore.                                                                                                         |
| `functions/src/sub3/inviteMember.ts`               | Pure handler + `onCall` wrapper.                                                                                                       |
| `functions/src/sub3/inviteMember.test.ts`          | 5 tests.                                                                                                                               |
| `functions/src/sub3/acceptInvite.ts`               | Pure handler + `onCall` wrapper.                                                                                                       |
| `functions/src/sub3/acceptInvite.test.ts`          | 6 tests.                                                                                                                               |
| `functions/src/sub3/revokeInvite.ts`               | Pure handler + `onCall` wrapper.                                                                                                       |
| `functions/src/sub3/revokeInvite.test.ts`          | 2 tests.                                                                                                                               |
| `functions/src/sub3/revokeMember.ts`               | Pure handler + `onCall` wrapper.                                                                                                       |
| `functions/src/sub3/revokeMember.test.ts`          | 3 tests.                                                                                                                               |
| `functions/src/sub3/setMemberTeams.ts`             | Pure handler + `onCall` wrapper.                                                                                                       |
| `functions/src/sub3/setMemberTeams.test.ts`        | 3 tests.                                                                                                                               |
| `functions/src/sub3/setMemberRole.ts`              | Pure handler + `onCall` wrapper.                                                                                                       |
| `functions/src/sub3/setMemberRole.test.ts`         | 3 tests.                                                                                                                               |
| `functions/src/sub3/transferOwnership.ts`          | Pure handler + `onCall` wrapper.                                                                                                       |
| `functions/src/sub3/transferOwnership.test.ts`     | 4 tests.                                                                                                                               |
| `functions/src/sub3/getClubAllowlistStatus.ts`     | Read-only callable: `{ allowed: boolean }` para que el shell decida si pintar el botón "+ Crear club".                                 |
| `functions/src/sub3/onMemberDelete.ts`             | Trigger Firestore: cleanup de grants e invites del uid.                                                                                |
| `functions/src/sub3/onMemberDelete.test.ts`        | 2 tests.                                                                                                                               |
| `functions/src/sub3/onTeamCreate.ts`               | Trigger Firestore: sync `assignedTeamIds` en personal workspace.                                                                       |
| `functions/src/sub3/onTeamCreate.test.ts`          | 2 tests.                                                                                                                               |
| `functions/src/sub3/onTeamDelete.ts`               | Trigger Firestore: borra grants + arrayRemove en assignedTeamIds de members.                                                           |
| `functions/src/sub3/onTeamDelete.test.ts`          | 2 tests.                                                                                                                               |
| `functions/src/sub3/cleanupExpiredInvites.ts`      | Scheduled diario: borra invites con `expiresAt < now`.                                                                                 |
| `functions/src/sub3/cleanupExpiredInvites.test.ts` | 1 test.                                                                                                                                |
| `functions/src/index.ts`                           | Modificar: `export {...}` de los 13 nuevos handlers.                                                                                   |

### Rules (PR #2)

| Archivo                   | Responsabilidad                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `firestore.rules`         | Modificar: añadir bloque `invites/{inviteId}`. Refuerzos `members/{memberUid}` y `workspaces` ownerId. |
| `firestore.rules.test.ts` | Modificar: añadir ~10 tests nuevos (5 invites + 3 members + 2 ownerId).                                |

### Cliente UI (PR #3)

| Archivo                                                 | Responsabilidad                                                                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/services/membersService.js`                        | Wrappers que llaman los 9 callables vía `httpsCallable(functions, 'xxx')`.                                            |
| `src/services/membersService.test.js`                   | 4 tests sanity con `vi.mock('firebase/functions')`.                                                                   |
| `src/hooks/useClubAllowlist.js`                         | Llama `getClubAllowlistStatus` 1× por mount. Devuelve `{ allowed, loading }`.                                         |
| `src/hooks/useInvites.js`                               | onSnapshot sobre `workspaces/{wsId}/invites`. Devuelve `{ invites, loading }`.                                        |
| `src/hooks/useMembers.js`                               | onSnapshot sobre `workspaces/{wsId}/members`. Devuelve `{ members, loading }`.                                        |
| `src/hooks/useAcceptInvite.js`                          | Maneja flow de claim: estados loading/success/error/notFound/expired/alreadyMember.                                   |
| `src/shell/WorkspaceSelector.jsx`                       | Dropdown en header. Lista memberships, botón "+ Crear club" si allowlist.                                             |
| `src/shell/WorkspaceSelector.test.jsx`                  | 4 tests RTL.                                                                                                          |
| `src/shell/CrearClubModal.jsx`                          | Modal con input `name`, llama `createClub`. Toast + redirect.                                                         |
| `src/shell/CrearClubModal.test.jsx`                     | 3 tests RTL.                                                                                                          |
| `src/screens/settings/MembersScreen.jsx`                | Pantalla principal de gestión. Subdividir si crece >300 LOC.                                                          |
| `src/screens/settings/MembersScreen.test.jsx`           | 8 tests RTL.                                                                                                          |
| `src/screens/settings/InviteMemberModal.jsx`            | Modal "Crear invitación".                                                                                             |
| `src/screens/settings/InviteSuccessModal.jsx`           | Modal post-creación con link copiable.                                                                                |
| `src/screens/settings/MemberActionMenu.jsx`             | Menú [⋮] por miembro: cambiar rol / editar teams / revocar.                                                           |
| `src/screens/settings/TransferOwnershipScreen.jsx`      | Pantalla aparte con typing-confirm.                                                                                   |
| `src/screens/settings/TransferOwnershipScreen.test.jsx` | 3 tests RTL.                                                                                                          |
| `src/screens/InviteLandingScreen.jsx`                   | Ruta pública `/invite/:wsId/:inviteId`. Orquesta los 7 estados.                                                       |
| `src/screens/InviteLandingScreen.test.jsx`              | 6 tests RTL.                                                                                                          |
| `src/shell/AppRouter.jsx`                               | Modificar: añadir 3 rutas (`/area-privada/settings/miembros`, `.../transferir-propiedad`, `/invite/:wsId/:inviteId`). |
| `src/shell/AppShell.jsx`                                | Modificar: montar `<WorkspaceSelector />` en el header (desktop + mobile).                                            |

### Smoke / observability (PR #4)

| Archivo                                         | Responsabilidad                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| `docs/runbooks/sub-proyecto-3-dogfood.md`       | Checklist E2E + bugs encontrados + decisión hot-fix vs deferred. |
| `docs/runbooks/sub-proyecto-3-cloud-logging.md` | Queries de Cloud Logging por callable + dashboard URLs.          |

---

## PR #1 — Cloud Functions (backend foundation)

**Branch:** `sub3-pr1-callables`. Crear desde `main` antes de Task 1.

### Task 1: Scaffold sub3 directory + allowlist + types

**Files:**

- Create: `functions/src/sub3/clubAllowlist.ts`
- Create: `functions/src/sub3/types.ts`

- [ ] **Step 1: Create `functions/src/sub3/clubAllowlist.ts`**

```ts
// Allowlist hardcodeada de uids autorizados a crear workspaces de tipo 'club'.
// Patrón mirror del SUPERADMIN_UID en migrations sub-2: redeploy para cambios.
// Si crece (>10 uids) o cambia frecuentemente, migrar a Firestore en sub-4.
export const CLUB_CREATION_ALLOWLIST: ReadonlyArray<string> = [
  'y6vqlMynjRQeRpAKUnYmQdUiMen1', // serpa2003@gmail.com (super-admin)
];

export function isInClubAllowlist(uid: string): boolean {
  return CLUB_CREATION_ALLOWLIST.includes(uid);
}
```

- [ ] **Step 2: Create `functions/src/sub3/types.ts`**

```ts
import type { Timestamp } from 'firebase-admin/firestore';

export type ClubRole = 'dt' | 'coach';

// workspaces/{wsId}/invites/{inviteId}
export interface InviteDoc {
  inviteId: string;
  workspaceId: string;
  invitedBy: string;
  inviteEmail: string | null;
  inviteName: string | null;
  role: ClubRole;
  assignedTeamIds: string[];
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

// workspaces/{wsId}/members/{uid} en clubs (en personal el role es 'owner').
export interface ClubMemberDoc {
  role: ClubRole;
  assignedTeamIds: string[];
  displayName: string;
  email: string;
  joinedAt: Timestamp;
  invitedBy: string | null;
  mismatchedEmailHint?: true;
}

// users/{uid}/memberships/{wsId}
export interface MembershipDoc {
  workspaceType: 'personal' | 'club';
  workspaceName: string;
  role: 'owner' | ClubRole;
  joinedAt: Timestamp;
}

export const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
```

- [ ] **Step 3: Commit**

```powershell
git checkout -b sub3-pr1-callables
git add functions/src/sub3/clubAllowlist.ts functions/src/sub3/types.ts
git commit -m "feat(sub3): scaffold allowlist + shared types"
```

---

### Task 2: createClub callable (TDD)

**Files:**

- Create: `functions/src/sub3/createClub.test.ts`
- Create: `functions/src/sub3/createClub.ts`

Patrón: pure handler exportado + `onCall` wrapper que sólo extrae auth/appId/data y delega (mirror de `functions/src/billing/createCheckoutSession.ts:80-93`).

- [ ] **Step 1: Write failing tests**

```ts
// functions/src/sub3/createClub.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCreateClub } from './createClub';

vi.mock('./clubAllowlist', () => ({
  isInClubAllowlist: (uid: string) => uid === 'uid-allowed',
}));

const APP_ID = 'app-test';

function makeDb() {
  const writes: Array<{ path: string; data: Record<string, unknown> }> = [];
  let n = 0;
  const batch = {
    set: vi.fn((ref: { path: string }, data: Record<string, unknown>) => {
      writes.push({ path: ref.path, data });
      return batch;
    }),
    commit: vi.fn().mockResolvedValue(undefined),
  };
  const db = {
    batch: () => batch,
    collection: (path: string) => ({
      doc: () => {
        n++;
        return { id: `gen-${n}`, path: `${path}/gen-${n}` };
      },
    }),
    doc: (path: string) => ({ path }),
  };
  return { db: db as unknown as Parameters<typeof handleCreateClub>[0]['db'], writes, batch };
}

describe('handleCreateClub', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects uid not in allowlist', async () => {
    const { db } = makeDb();
    await expect(
      handleCreateClub({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-stranger', displayName: 'X', email: 'x@x.com' },
        data: { name: 'Mi Club' },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects empty name', async () => {
    const { db } = makeDb();
    await expect(
      handleCreateClub({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-allowed', displayName: 'S', email: 's@s.com' },
        data: { name: '   ' },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects name >80 chars', async () => {
    const { db } = makeDb();
    await expect(
      handleCreateClub({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-allowed', displayName: 'S', email: 's@s.com' },
        data: { name: 'x'.repeat(81) },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('happy path writes 3 docs atomically and returns wsId', async () => {
    const { db, writes, batch } = makeDb();
    const result = await handleCreateClub({
      db,
      appId: APP_ID,
      auth: { uid: 'uid-allowed', displayName: 'Sergio', email: 's@s.com' },
      data: { name: 'Uros de Rivas' },
    });
    expect(result.wsId).toBe('gen-1');
    expect(batch.commit).toHaveBeenCalledOnce();
    expect(writes).toHaveLength(3);
    const ws = writes.find((w) => w.path.endsWith('/workspaces/gen-1'))!;
    expect(ws.data).toMatchObject({ type: 'club', ownerId: 'uid-allowed', name: 'Uros de Rivas', plan: 'free' });
    const member = writes.find((w) => w.path.endsWith('/members/uid-allowed'))!;
    expect(member.data).toMatchObject({
      role: 'dt',
      assignedTeamIds: [],
      displayName: 'Sergio',
      email: 's@s.com',
      invitedBy: null,
    });
    const membership = writes.find((w) => w.path.endsWith('/memberships/gen-1'))!;
    expect(membership.data).toMatchObject({
      workspaceType: 'club',
      workspaceName: 'Uros de Rivas',
      role: 'dt',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd functions; npx vitest run src/sub3/createClub.test.ts
```

Expected: FAIL — `Cannot find module './createClub'`.

- [ ] **Step 3: Implement `functions/src/sub3/createClub.ts`**

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { isInClubAllowlist } from './clubAllowlist';

interface HandlerArgs {
  db: Firestore;
  appId: string;
  auth: { uid: string; displayName: string | null; email: string | null };
  data: { name: string };
}

export async function handleCreateClub({ db, appId, auth, data }: HandlerArgs): Promise<{ wsId: string }> {
  if (!isInClubAllowlist(auth.uid)) {
    throw new HttpsError('permission-denied', 'Workspace de club no disponible para esta cuenta.');
  }
  const name = (data?.name ?? '').trim();
  if (!name) throw new HttpsError('invalid-argument', 'Nombre obligatorio.');
  if (name.length > 80) throw new HttpsError('invalid-argument', 'Nombre máx. 80 caracteres.');

  const newWsId = db.collection(`artifacts/${appId}/workspaces`).doc().id;
  const now = FieldValue.serverTimestamp();
  const displayName = auth.displayName ?? '';
  const email = auth.email ?? '';

  await db
    .batch()
    .set(db.doc(`artifacts/${appId}/workspaces/${newWsId}`), {
      type: 'club',
      ownerId: auth.uid,
      name,
      plan: 'free',
      planUpdatedAt: null,
      billing: null,
      createdAt: now,
      updatedAt: now,
    })
    .set(db.doc(`artifacts/${appId}/workspaces/${newWsId}/members/${auth.uid}`), {
      role: 'dt',
      assignedTeamIds: [],
      displayName,
      email,
      joinedAt: now,
      invitedBy: null,
    })
    .set(db.doc(`artifacts/${appId}/users/${auth.uid}/memberships/${newWsId}`), {
      workspaceType: 'club',
      workspaceName: name,
      role: 'dt',
      joinedAt: now,
    })
    .commit();

  return { wsId: newWsId };
}

export const createClub = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const appId = process.env.PICK_APP_ID;
  if (!appId) throw new HttpsError('failed-precondition', 'PICK_APP_ID missing');
  return handleCreateClub({
    db: getFirestore(),
    appId,
    auth: {
      uid: request.auth.uid,
      displayName: (request.auth.token?.name as string) ?? null,
      email: (request.auth.token?.email as string) ?? null,
    },
    data: request.data,
  });
});
```

- [ ] **Step 4: Run tests**

```powershell
npx vitest run src/sub3/createClub.test.ts
```

Expected: PASS — 4/4.

- [ ] **Step 5: Commit**

```powershell
git add functions/src/sub3/createClub.ts functions/src/sub3/createClub.test.ts
git commit -m "feat(sub3): createClub callable (TDD, 4 tests)"
```

---

### Task 3: inviteMember callable (TDD, 5 tests)

**Files:**

- Create: `functions/src/sub3/inviteMember.test.ts`
- Create: `functions/src/sub3/inviteMember.ts`

- [ ] **Step 1: Write failing tests `functions/src/sub3/inviteMember.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleInviteMember } from './inviteMember';

const APP_ID = 'app-test';
const WS_ID = 'ws-1';

function makeDb(
  opts: { callerRole?: 'dt' | 'coach' | null; callerIsOwner?: boolean; existingTeamIds?: string[] } = {},
) {
  const writes: Array<{ path: string; data: Record<string, unknown> }> = [];
  const teamIds = new Set(opts.existingTeamIds ?? ['team-A', 'team-B']);
  const wsDoc = { exists: true, data: () => ({ ownerId: opts.callerIsOwner ? 'uid-caller' : 'uid-other' }) };
  const memberDoc = opts.callerRole
    ? { exists: true, data: () => ({ role: opts.callerRole }) }
    : { exists: false, data: () => undefined };
  const db = {
    doc: (path: string) => ({
      path,
      get: async () => {
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}`) return wsDoc;
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-caller`) return memberDoc;
        if (path.includes('/teams/')) {
          const id = path.split('/').pop()!;
          return { exists: teamIds.has(id), data: () => undefined };
        }
        return { exists: false, data: () => undefined };
      },
      set: async (data: Record<string, unknown>) => {
        writes.push({ path, data });
      },
    }),
    collection: (path: string) => ({ doc: () => ({ id: 'inv-generated', path: `${path}/inv-generated` }) }),
  };
  return { db: db as unknown as Parameters<typeof handleInviteMember>[0]['db'], writes };
}

describe('handleInviteMember', () => {
  beforeEach(() => vi.clearAllMocks());

  it('DT can create invite, returns inviteId + link', async () => {
    const { db, writes } = makeDb({ callerRole: 'dt' });
    const result = await handleInviteMember({
      db,
      appId: APP_ID,
      auth: { uid: 'uid-caller' },
      appBaseUrl: 'https://app.com',
      data: { wsId: WS_ID, role: 'coach', assignedTeamIds: ['team-A'], email: 'p@x.com', name: 'Pepe' },
    });
    expect(result.inviteId).toBe('inv-generated');
    expect(result.link).toBe(`https://app.com/invite/${WS_ID}/inv-generated`);
    expect(writes[0].data).toMatchObject({
      role: 'coach',
      assignedTeamIds: ['team-A'],
      inviteEmail: 'p@x.com',
      inviteName: 'Pepe',
      invitedBy: 'uid-caller',
      workspaceId: WS_ID,
    });
  });

  it('coach (non-DT, non-owner) is denied', async () => {
    const { db } = makeDb({ callerRole: 'coach' });
    await expect(
      handleInviteMember({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-caller' },
        appBaseUrl: 'https://app.com',
        data: { wsId: WS_ID, role: 'coach', assignedTeamIds: ['team-A'] },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects invalid role', async () => {
    const { db } = makeDb({ callerRole: 'dt' });
    await expect(
      handleInviteMember({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-caller' },
        appBaseUrl: 'https://app.com',
        data: { wsId: WS_ID, role: 'admin' as never, assignedTeamIds: ['team-A'] },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects nonexistent teamId', async () => {
    const { db } = makeDb({ callerRole: 'dt', existingTeamIds: ['team-A'] });
    await expect(
      handleInviteMember({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-caller' },
        appBaseUrl: 'https://app.com',
        data: { wsId: WS_ID, role: 'coach', assignedTeamIds: ['team-ghost'] },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects malformed email', async () => {
    const { db } = makeDb({ callerRole: 'dt' });
    await expect(
      handleInviteMember({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-caller' },
        appBaseUrl: 'https://app.com',
        data: { wsId: WS_ID, role: 'coach', assignedTeamIds: ['team-A'], email: 'not-an-email' },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});
```

- [ ] **Step 2: Run; expect FAIL (module missing).**

```powershell
npx vitest run src/sub3/inviteMember.test.ts
```

- [ ] **Step 3: Implement `functions/src/sub3/inviteMember.ts`**

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { INVITE_LIFETIME_MS, type ClubRole } from './types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface HandlerArgs {
  db: Firestore;
  appId: string;
  auth: { uid: string };
  appBaseUrl: string;
  data: { wsId: string; role: ClubRole; assignedTeamIds: string[]; email?: string | null; name?: string | null };
}

export async function handleInviteMember({ db, appId, auth, appBaseUrl, data }: HandlerArgs) {
  const { wsId, role, assignedTeamIds, email, name } = data ?? ({} as HandlerArgs['data']);
  if (!wsId) throw new HttpsError('invalid-argument', 'wsId requerido');
  if (role !== 'dt' && role !== 'coach') throw new HttpsError('invalid-argument', 'role inválido');
  if (!Array.isArray(assignedTeamIds)) throw new HttpsError('invalid-argument', 'assignedTeamIds requerido');
  if (role === 'coach' && assignedTeamIds.length === 0) {
    throw new HttpsError('invalid-argument', 'Coach requiere al menos un equipo.');
  }
  if (email != null && email !== '' && !EMAIL_RE.test(email)) {
    throw new HttpsError('invalid-argument', 'Email mal formado.');
  }

  const wsSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}`).get();
  if (!wsSnap.exists) throw new HttpsError('not-found', 'workspace no existe');
  const ws = wsSnap.data()!;

  const memberSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${auth.uid}`).get();
  const isOwner = ws.ownerId === auth.uid;
  const isDt = memberSnap.exists && memberSnap.data()?.role === 'dt';
  if (!isOwner && !isDt) throw new HttpsError('permission-denied', 'Solo DT/owner pueden invitar.');

  for (const teamId of assignedTeamIds) {
    const t = await db.doc(`artifacts/${appId}/workspaces/${wsId}/teams/${teamId}`).get();
    if (!t.exists) throw new HttpsError('invalid-argument', `team ${teamId} no existe`);
  }

  const inviteRef = db.collection(`artifacts/${appId}/workspaces/${wsId}/invites`).doc();
  const inviteId = inviteRef.id;
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + INVITE_LIFETIME_MS);

  await db.doc(`artifacts/${appId}/workspaces/${wsId}/invites/${inviteId}`).set({
    inviteId,
    workspaceId: wsId,
    invitedBy: auth.uid,
    inviteEmail: email ?? null,
    inviteName: name ?? null,
    role,
    assignedTeamIds,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
  });

  return { inviteId, link: `${appBaseUrl}/invite/${wsId}/${inviteId}` };
}

export const inviteMember = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const appId = process.env.PICK_APP_ID;
  if (!appId) throw new HttpsError('failed-precondition', 'PICK_APP_ID missing');
  const appBaseUrl = process.env.APP_BASE_URL ?? 'https://playoff-creator.web.app';
  return handleInviteMember({
    db: getFirestore(),
    appId,
    auth: { uid: request.auth.uid },
    appBaseUrl,
    data: request.data,
  });
});
```

- [ ] **Step 4: Run tests; expect PASS 5/5.**
- [ ] **Step 5: Commit**

```powershell
git add functions/src/sub3/inviteMember.ts functions/src/sub3/inviteMember.test.ts
git commit -m "feat(sub3): inviteMember callable (TDD, 5 tests)"
```

---

### Task 4: acceptInvite callable (TDD, 6 tests)

**Files:**

- Create: `functions/src/sub3/acceptInvite.test.ts`
- Create: `functions/src/sub3/acceptInvite.ts`

Esta callable corre en transacción (lee invite + member + workspace, valida no-expirado, no-already-member, escribe member + membership, marca mismatchedEmailHint si email difería, borra invite). Mock `db.runTransaction(fn)` ejecutando `fn` con un objeto tx que registra get/set/delete.

- [ ] **Step 1: Write failing tests `functions/src/sub3/acceptInvite.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { handleAcceptInvite } from './acceptInvite';

const APP_ID = 'app-test';
const WS_ID = 'ws-1';
const INVITE_ID = 'inv-1';

function tsFromMs(ms: number) {
  return { toMillis: () => ms } as unknown as Timestamp;
}

function makeDb(state: {
  invite?: Record<string, unknown> | null;
  workspace?: Record<string, unknown> | null;
  existingMember?: boolean;
}) {
  const ops: Array<{ kind: 'set' | 'delete'; path: string; data?: Record<string, unknown> }> = [];
  const docs: Record<string, { exists: boolean; data: () => Record<string, unknown> | undefined }> = {
    [`artifacts/${APP_ID}/workspaces/${WS_ID}/invites/${INVITE_ID}`]: state.invite
      ? { exists: true, data: () => state.invite! }
      : { exists: false, data: () => undefined },
    [`artifacts/${APP_ID}/workspaces/${WS_ID}`]: state.workspace
      ? { exists: true, data: () => state.workspace! }
      : { exists: false, data: () => undefined },
    [`artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-claimer`]: state.existingMember
      ? { exists: true, data: () => ({}) }
      : { exists: false, data: () => undefined },
  };
  const tx = {
    get: async (ref: { path: string }) => docs[ref.path] ?? { exists: false, data: () => undefined },
    set: (ref: { path: string }, data: Record<string, unknown>) => ops.push({ kind: 'set', path: ref.path, data }),
    delete: (ref: { path: string }) => ops.push({ kind: 'delete', path: ref.path }),
  };
  const db = {
    doc: (path: string) => ({ path }),
    runTransaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
  return { db: db as unknown as Parameters<typeof handleAcceptInvite>[0]['db'], ops };
}

const NOW_MS = 1_700_000_000_000;
beforeEach(() => vi.useFakeTimers().setSystemTime(NOW_MS));

describe('handleAcceptInvite', () => {
  it('not-found when invite missing', async () => {
    const { db } = makeDb({ invite: null, workspace: { name: 'Club', type: 'club' } });
    await expect(
      handleAcceptInvite({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-claimer', displayName: 'Juan', email: 'j@x.com' },
        data: { wsId: WS_ID, inviteId: INVITE_ID },
      }),
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  it('expired → throws failed-precondition AND deletes invite oportunistically', async () => {
    const { db, ops } = makeDb({
      invite: {
        role: 'coach',
        assignedTeamIds: ['team-A'],
        invitedBy: 'uid-dt',
        inviteEmail: null,
        expiresAt: tsFromMs(NOW_MS - 1000),
      },
      workspace: { name: 'Club', type: 'club' },
    });
    await expect(
      handleAcceptInvite({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-claimer', displayName: 'Juan', email: 'j@x.com' },
        data: { wsId: WS_ID, inviteId: INVITE_ID },
      }),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(ops.find((o) => o.kind === 'delete' && o.path.endsWith(INVITE_ID))).toBeTruthy();
  });

  it('already-member when claimer already has membership', async () => {
    const { db } = makeDb({
      invite: {
        role: 'coach',
        assignedTeamIds: ['team-A'],
        invitedBy: 'uid-dt',
        inviteEmail: null,
        expiresAt: tsFromMs(NOW_MS + 60_000),
      },
      workspace: { name: 'Club', type: 'club' },
      existingMember: true,
    });
    await expect(
      handleAcceptInvite({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-claimer', displayName: 'Juan', email: 'j@x.com' },
        data: { wsId: WS_ID, inviteId: INVITE_ID },
      }),
    ).rejects.toMatchObject({ code: 'already-exists' });
  });

  it('happy path: writes member + membership, deletes invite', async () => {
    const { db, ops } = makeDb({
      invite: {
        role: 'coach',
        assignedTeamIds: ['team-A'],
        invitedBy: 'uid-dt',
        inviteEmail: 'j@x.com',
        expiresAt: tsFromMs(NOW_MS + 60_000),
      },
      workspace: { name: 'Club', type: 'club' },
    });
    const result = await handleAcceptInvite({
      db,
      appId: APP_ID,
      auth: { uid: 'uid-claimer', displayName: 'Juan', email: 'j@x.com' },
      data: { wsId: WS_ID, inviteId: INVITE_ID },
    });
    expect(result).toEqual({ ok: true, wsId: WS_ID });
    expect(ops.filter((o) => o.kind === 'set')).toHaveLength(2);
    expect(ops.find((o) => o.kind === 'delete' && o.path.endsWith(INVITE_ID))).toBeTruthy();
    const member = ops.find((o) => o.path.endsWith('/members/uid-claimer'))!;
    expect(member.data).toMatchObject({
      role: 'coach',
      assignedTeamIds: ['team-A'],
      displayName: 'Juan',
      email: 'j@x.com',
      invitedBy: 'uid-dt',
    });
    expect(member.data!.mismatchedEmailHint).toBeUndefined();
  });

  it('email mismatch sets mismatchedEmailHint flag', async () => {
    const { db, ops } = makeDb({
      invite: {
        role: 'coach',
        assignedTeamIds: ['team-A'],
        invitedBy: 'uid-dt',
        inviteEmail: 'pepe@x.com',
        expiresAt: tsFromMs(NOW_MS + 60_000),
      },
      workspace: { name: 'Club', type: 'club' },
    });
    await handleAcceptInvite({
      db,
      appId: APP_ID,
      auth: { uid: 'uid-claimer', displayName: 'Juan', email: 'juan@x.com' },
      data: { wsId: WS_ID, inviteId: INVITE_ID },
    });
    const member = ops.find((o) => o.path.endsWith('/members/uid-claimer'))!;
    expect(member.data!.mismatchedEmailHint).toBe(true);
  });

  it('transaction atomicity: tx.set + tx.delete are queued, no direct writes', async () => {
    const { db, ops } = makeDb({
      invite: {
        role: 'dt',
        assignedTeamIds: [],
        invitedBy: 'uid-dt',
        inviteEmail: null,
        expiresAt: tsFromMs(NOW_MS + 60_000),
      },
      workspace: { name: 'Club', type: 'club' },
    });
    await handleAcceptInvite({
      db,
      appId: APP_ID,
      auth: { uid: 'uid-claimer', displayName: 'Juan', email: 'j@x.com' },
      data: { wsId: WS_ID, inviteId: INVITE_ID },
    });
    // 2 sets (member + membership) + 1 delete (invite). All via tx.
    expect(ops).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement `functions/src/sub3/acceptInvite.ts`**

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

interface HandlerArgs {
  db: Firestore;
  appId: string;
  auth: { uid: string; displayName: string | null; email: string | null };
  data: { wsId: string; inviteId: string };
}

export async function handleAcceptInvite({ db, appId, auth, data }: HandlerArgs) {
  const { wsId, inviteId } = data ?? ({} as HandlerArgs['data']);
  if (!wsId || !inviteId) throw new HttpsError('invalid-argument', 'wsId+inviteId requeridos');

  const inviteRef = db.doc(`artifacts/${appId}/workspaces/${wsId}/invites/${inviteId}`);
  const memberRef = db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${auth.uid}`);
  const wsRef = db.doc(`artifacts/${appId}/workspaces/${wsId}`);
  const membershipRef = db.doc(`artifacts/${appId}/users/${auth.uid}/memberships/${wsId}`);

  type ExpiredFlag = { expired: true };
  const result = await db.runTransaction(async (tx) => {
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists) throw new HttpsError('not-found', 'Invitación no encontrada o ya usada.');
    const invite = inviteSnap.data()!;

    const expiresAt = invite.expiresAt as Timestamp;
    if (expiresAt && expiresAt.toMillis() < Date.now()) {
      tx.delete(inviteRef);
      return { expired: true } satisfies ExpiredFlag;
    }

    const memberSnap = await tx.get(memberRef);
    if (memberSnap.exists) throw new HttpsError('already-exists', 'Ya eres miembro de este workspace.');

    const wsSnap = await tx.get(wsRef);
    if (!wsSnap.exists) throw new HttpsError('not-found', 'Workspace no encontrado.');
    const ws = wsSnap.data()!;

    const displayName = auth.displayName ?? '';
    const email = auth.email ?? '';
    const mismatchedEmailHint =
      invite.inviteEmail && invite.inviteEmail !== email ? { mismatchedEmailHint: true as const } : {};

    tx.set(memberRef, {
      role: invite.role,
      assignedTeamIds: invite.assignedTeamIds ?? [],
      displayName,
      email,
      joinedAt: FieldValue.serverTimestamp(),
      invitedBy: invite.invitedBy ?? null,
      ...mismatchedEmailHint,
    });
    tx.set(membershipRef, {
      workspaceType: ws.type === 'club' ? 'club' : 'personal',
      workspaceName: ws.name ?? '',
      role: invite.role,
      joinedAt: FieldValue.serverTimestamp(),
    });
    tx.delete(inviteRef);
    return { expired: false };
  });

  if ((result as ExpiredFlag).expired) {
    throw new HttpsError('failed-precondition', 'Invitación caducada. Pide una nueva.');
  }
  return { ok: true, wsId };
}

export const acceptInvite = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const appId = process.env.PICK_APP_ID;
  if (!appId) throw new HttpsError('failed-precondition', 'PICK_APP_ID missing');
  return handleAcceptInvite({
    db: getFirestore(),
    appId,
    auth: {
      uid: request.auth.uid,
      displayName: (request.auth.token?.name as string) ?? null,
      email: (request.auth.token?.email as string) ?? null,
    },
    data: request.data,
  });
});
```

- [ ] **Step 4: Run; expect PASS 6/6.**
- [ ] **Step 5: Commit**

```powershell
git add functions/src/sub3/acceptInvite.ts functions/src/sub3/acceptInvite.test.ts
git commit -m "feat(sub3): acceptInvite callable transactional (TDD, 6 tests)"
```

---

### Task 5: revokeInvite callable (TDD, 2 tests)

**Files:**

- Create: `functions/src/sub3/revokeInvite.test.ts`
- Create: `functions/src/sub3/revokeInvite.ts`

- [ ] **Step 1: Write failing tests**

```ts
// functions/src/sub3/revokeInvite.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRevokeInvite } from './revokeInvite';

const APP_ID = 'app-test';
const WS_ID = 'ws-1';
const INVITE_ID = 'inv-1';

function makeDb(callerRole: 'dt' | 'coach' | null) {
  const deletes: string[] = [];
  const db = {
    doc: (path: string) => ({
      path,
      get: async () => {
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}`)
          return { exists: true, data: () => ({ ownerId: 'uid-other' }) };
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-caller`) {
          return callerRole
            ? { exists: true, data: () => ({ role: callerRole }) }
            : { exists: false, data: () => undefined };
        }
        return { exists: false, data: () => undefined };
      },
      delete: async () => {
        deletes.push(path);
      },
    }),
  };
  return { db: db as unknown as Parameters<typeof handleRevokeInvite>[0]['db'], deletes };
}

describe('handleRevokeInvite', () => {
  beforeEach(() => vi.clearAllMocks());

  it('DT can revoke', async () => {
    const { db, deletes } = makeDb('dt');
    const result = await handleRevokeInvite({
      db,
      appId: APP_ID,
      auth: { uid: 'uid-caller' },
      data: { wsId: WS_ID, inviteId: INVITE_ID },
    });
    expect(result).toEqual({ ok: true });
    expect(deletes).toContain(`artifacts/${APP_ID}/workspaces/${WS_ID}/invites/${INVITE_ID}`);
  });

  it('coach denied', async () => {
    const { db } = makeDb('coach');
    await expect(
      handleRevokeInvite({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-caller' },
        data: { wsId: WS_ID, inviteId: INVITE_ID },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
```

- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement `functions/src/sub3/revokeInvite.ts`**

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

interface HandlerArgs {
  db: Firestore;
  appId: string;
  auth: { uid: string };
  data: { wsId: string; inviteId: string };
}

export async function handleRevokeInvite({ db, appId, auth, data }: HandlerArgs) {
  const { wsId, inviteId } = data ?? ({} as HandlerArgs['data']);
  if (!wsId || !inviteId) throw new HttpsError('invalid-argument', 'wsId+inviteId requeridos');

  const wsSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}`).get();
  if (!wsSnap.exists) throw new HttpsError('not-found', 'workspace no existe');
  const isOwner = wsSnap.data()!.ownerId === auth.uid;

  const memberSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${auth.uid}`).get();
  const isDt = memberSnap.exists && memberSnap.data()?.role === 'dt';

  if (!isOwner && !isDt) throw new HttpsError('permission-denied', 'Solo DT/owner pueden revocar.');

  await db.doc(`artifacts/${appId}/workspaces/${wsId}/invites/${inviteId}`).delete();
  return { ok: true };
}

export const revokeInvite = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const appId = process.env.PICK_APP_ID;
  if (!appId) throw new HttpsError('failed-precondition', 'PICK_APP_ID missing');
  return handleRevokeInvite({
    db: getFirestore(),
    appId,
    auth: { uid: request.auth.uid },
    data: request.data,
  });
});
```

- [ ] **Step 4: Run; PASS 2/2.**
- [ ] **Step 5: Commit**

```powershell
git add functions/src/sub3/revokeInvite.ts functions/src/sub3/revokeInvite.test.ts
git commit -m "feat(sub3): revokeInvite callable (TDD, 2 tests)"
```

---

### Task 6: revokeMember callable (TDD, 3 tests)

**Files:**

- Create: `functions/src/sub3/revokeMember.test.ts`
- Create: `functions/src/sub3/revokeMember.ts`

Similar a Task 5 pero borrado atómico de `members/{uid}` y `users/{uid}/memberships/{wsId}` en transacción + bloqueo si target = ownerId.

- [ ] **Step 1: Write failing tests**

```ts
// functions/src/sub3/revokeMember.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRevokeMember } from './revokeMember';

const APP_ID = 'app-test';
const WS_ID = 'ws-1';

function makeDb(opts: { callerRole?: 'dt' | 'coach' | null; ownerId?: string }) {
  const ops: Array<{ kind: 'delete'; path: string }> = [];
  const tx = {
    get: async (ref: { path: string }) => {
      if (ref.path === `artifacts/${APP_ID}/workspaces/${WS_ID}`) {
        return { exists: true, data: () => ({ ownerId: opts.ownerId ?? 'uid-owner' }) };
      }
      if (ref.path === `artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-caller`) {
        return opts.callerRole
          ? { exists: true, data: () => ({ role: opts.callerRole }) }
          : { exists: false, data: () => undefined };
      }
      return { exists: false, data: () => undefined };
    },
    delete: (ref: { path: string }) => ops.push({ kind: 'delete', path: ref.path }),
  };
  const db = {
    doc: (path: string) => ({ path }),
    runTransaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
  return { db: db as unknown as Parameters<typeof handleRevokeMember>[0]['db'], ops };
}

describe('handleRevokeMember', () => {
  beforeEach(() => vi.clearAllMocks());

  it('DT revokes coach atomically (member + membership)', async () => {
    const { db, ops } = makeDb({ callerRole: 'dt', ownerId: 'uid-owner' });
    const result = await handleRevokeMember({
      db,
      appId: APP_ID,
      auth: { uid: 'uid-caller' },
      data: { wsId: WS_ID, memberUid: 'uid-coach' },
    });
    expect(result).toEqual({ ok: true });
    expect(ops).toHaveLength(2);
    expect(ops.map((o) => o.path)).toEqual(
      expect.arrayContaining([
        `artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-coach`,
        `artifacts/${APP_ID}/users/uid-coach/memberships/${WS_ID}`,
      ]),
    );
  });

  it('rejects revoking the owner', async () => {
    const { db } = makeDb({ callerRole: 'dt', ownerId: 'uid-owner' });
    await expect(
      handleRevokeMember({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-caller' },
        data: { wsId: WS_ID, memberUid: 'uid-owner' },
      }),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('coach (non-DT, non-owner) denied', async () => {
    const { db } = makeDb({ callerRole: 'coach', ownerId: 'uid-owner' });
    await expect(
      handleRevokeMember({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-caller' },
        data: { wsId: WS_ID, memberUid: 'uid-coach' },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
```

- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement `functions/src/sub3/revokeMember.ts`**

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

interface HandlerArgs {
  db: Firestore;
  appId: string;
  auth: { uid: string };
  data: { wsId: string; memberUid: string };
}

export async function handleRevokeMember({ db, appId, auth, data }: HandlerArgs) {
  const { wsId, memberUid } = data ?? ({} as HandlerArgs['data']);
  if (!wsId || !memberUid) throw new HttpsError('invalid-argument', 'wsId+memberUid requeridos');

  await db.runTransaction(async (tx) => {
    const wsSnap = await tx.get(db.doc(`artifacts/${appId}/workspaces/${wsId}`));
    if (!wsSnap.exists) throw new HttpsError('not-found', 'workspace no existe');
    const ownerId = wsSnap.data()!.ownerId;
    if (memberUid === ownerId) {
      throw new HttpsError('failed-precondition', 'No puedes expulsar al propietario. Transfiere la propiedad antes.');
    }

    const callerSnap = await tx.get(db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${auth.uid}`));
    const isOwner = ownerId === auth.uid;
    const isDt = callerSnap.exists && callerSnap.data()?.role === 'dt';
    if (!isOwner && !isDt) throw new HttpsError('permission-denied', 'Solo DT/owner pueden revocar.');

    tx.delete(db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${memberUid}`));
    tx.delete(db.doc(`artifacts/${appId}/users/${memberUid}/memberships/${wsId}`));
  });

  return { ok: true };
}

export const revokeMember = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const appId = process.env.PICK_APP_ID;
  if (!appId) throw new HttpsError('failed-precondition', 'PICK_APP_ID missing');
  return handleRevokeMember({
    db: getFirestore(),
    appId,
    auth: { uid: request.auth.uid },
    data: request.data,
  });
});
```

- [ ] **Step 4: Run; PASS 3/3.**
- [ ] **Step 5: Commit**

```powershell
git add functions/src/sub3/revokeMember.ts functions/src/sub3/revokeMember.test.ts
git commit -m "feat(sub3): revokeMember callable transactional (TDD, 3 tests)"
```

---

### Task 7: setMemberTeams callable (TDD, 3 tests)

**Files:**

- Create: `functions/src/sub3/setMemberTeams.test.ts`
- Create: `functions/src/sub3/setMemberTeams.ts`

- [ ] **Step 1: Write failing tests**

```ts
// functions/src/sub3/setMemberTeams.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSetMemberTeams } from './setMemberTeams';

const APP_ID = 'app-test';
const WS_ID = 'ws-1';

function makeDb(opts: {
  callerRole?: 'dt' | 'coach' | null;
  callerIsOwner?: boolean;
  existingTeamIds?: string[];
  ownerId?: string;
}) {
  const updates: Array<{ path: string; data: Record<string, unknown> }> = [];
  const teamIds = new Set(opts.existingTeamIds ?? ['team-A', 'team-B']);
  const db = {
    doc: (path: string) => ({
      path,
      get: async () => {
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}`) {
          return {
            exists: true,
            data: () => ({ ownerId: opts.ownerId ?? (opts.callerIsOwner ? 'uid-caller' : 'uid-other') }),
          };
        }
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-caller`) {
          return opts.callerRole
            ? { exists: true, data: () => ({ role: opts.callerRole }) }
            : { exists: false, data: () => undefined };
        }
        if (path.includes('/teams/')) {
          const id = path.split('/').pop()!;
          return { exists: teamIds.has(id), data: () => undefined };
        }
        return { exists: false, data: () => undefined };
      },
      update: async (data: Record<string, unknown>) => {
        updates.push({ path, data });
      },
    }),
  };
  return { db: db as unknown as Parameters<typeof handleSetMemberTeams>[0]['db'], updates };
}

describe('handleSetMemberTeams', () => {
  beforeEach(() => vi.clearAllMocks());

  it("DT updates a coach's teams", async () => {
    const { db, updates } = makeDb({ callerRole: 'dt', ownerId: 'uid-owner' });
    const r = await handleSetMemberTeams({
      db,
      appId: APP_ID,
      auth: { uid: 'uid-caller' },
      data: { wsId: WS_ID, memberUid: 'uid-coach', assignedTeamIds: ['team-A', 'team-B'] },
    });
    expect(r).toEqual({ ok: true });
    expect(updates[0]).toMatchObject({
      path: `artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-coach`,
      data: { assignedTeamIds: ['team-A', 'team-B'] },
    });
  });

  it('rejects invalid teamId', async () => {
    const { db } = makeDb({ callerRole: 'dt', existingTeamIds: ['team-A'], ownerId: 'uid-owner' });
    await expect(
      handleSetMemberTeams({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-caller' },
        data: { wsId: WS_ID, memberUid: 'uid-coach', assignedTeamIds: ['team-ghost'] },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it("DT non-owner cannot edit owner's assignment", async () => {
    const { db } = makeDb({ callerRole: 'dt', ownerId: 'uid-owner' });
    await expect(
      handleSetMemberTeams({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-caller' },
        data: { wsId: WS_ID, memberUid: 'uid-owner', assignedTeamIds: ['team-A'] },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
```

- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement `functions/src/sub3/setMemberTeams.ts`**

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

interface HandlerArgs {
  db: Firestore;
  appId: string;
  auth: { uid: string };
  data: { wsId: string; memberUid: string; assignedTeamIds: string[] };
}

export async function handleSetMemberTeams({ db, appId, auth, data }: HandlerArgs) {
  const { wsId, memberUid, assignedTeamIds } = data ?? ({} as HandlerArgs['data']);
  if (!wsId || !memberUid) throw new HttpsError('invalid-argument', 'wsId+memberUid requeridos');
  if (!Array.isArray(assignedTeamIds)) throw new HttpsError('invalid-argument', 'assignedTeamIds requerido');

  const wsSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}`).get();
  if (!wsSnap.exists) throw new HttpsError('not-found', 'workspace no existe');
  const ownerId = wsSnap.data()!.ownerId;
  const callerIsOwner = ownerId === auth.uid;

  const callerSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${auth.uid}`).get();
  const isDt = callerSnap.exists && callerSnap.data()?.role === 'dt';
  if (!callerIsOwner && !isDt) throw new HttpsError('permission-denied', 'Solo DT/owner pueden editar equipos.');

  // DT no-owner no puede tocar al owner. Owner sí puede tocar a cualquiera (incluido sí mismo).
  if (!callerIsOwner && memberUid === ownerId) {
    throw new HttpsError('permission-denied', 'Solo el propietario puede editar sus propios equipos.');
  }

  for (const teamId of assignedTeamIds) {
    const t = await db.doc(`artifacts/${appId}/workspaces/${wsId}/teams/${teamId}`).get();
    if (!t.exists) throw new HttpsError('invalid-argument', `team ${teamId} no existe`);
  }

  await db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${memberUid}`).update({ assignedTeamIds });
  return { ok: true };
}

export const setMemberTeams = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const appId = process.env.PICK_APP_ID;
  if (!appId) throw new HttpsError('failed-precondition', 'PICK_APP_ID missing');
  return handleSetMemberTeams({
    db: getFirestore(),
    appId,
    auth: { uid: request.auth.uid },
    data: request.data,
  });
});
```

- [ ] **Step 4: Run; PASS 3/3.**
- [ ] **Step 5: Commit**

```powershell
git add functions/src/sub3/setMemberTeams.ts functions/src/sub3/setMemberTeams.test.ts
git commit -m "feat(sub3): setMemberTeams callable (TDD, 3 tests)"
```

---

### Task 8: setMemberRole callable (TDD, 3 tests)

**Files:**

- Create: `functions/src/sub3/setMemberRole.test.ts`
- Create: `functions/src/sub3/setMemberRole.ts`

- [ ] **Step 1: Write failing tests**

```ts
// functions/src/sub3/setMemberRole.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSetMemberRole } from './setMemberRole';

const APP_ID = 'app-test';
const WS_ID = 'ws-1';

function makeDb(opts: { callerRole?: 'dt' | 'coach' | null; ownerId?: string }) {
  const updates: Array<{ path: string; data: Record<string, unknown> }> = [];
  const db = {
    doc: (path: string) => ({
      path,
      get: async () => {
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}`) {
          return { exists: true, data: () => ({ ownerId: opts.ownerId ?? 'uid-owner' }) };
        }
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-caller`) {
          return opts.callerRole
            ? { exists: true, data: () => ({ role: opts.callerRole }) }
            : { exists: false, data: () => undefined };
        }
        return { exists: false, data: () => undefined };
      },
      update: async (data: Record<string, unknown>) => {
        updates.push({ path, data });
      },
    }),
  };
  return { db: db as unknown as Parameters<typeof handleSetMemberRole>[0]['db'], updates };
}

describe('handleSetMemberRole', () => {
  beforeEach(() => vi.clearAllMocks());

  it('promotes coach to DT', async () => {
    const { db, updates } = makeDb({ callerRole: 'dt' });
    await handleSetMemberRole({
      db,
      appId: APP_ID,
      auth: { uid: 'uid-caller' },
      data: { wsId: WS_ID, memberUid: 'uid-coach', role: 'dt' },
    });
    expect(updates[0]).toMatchObject({
      path: `artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-coach`,
      data: { role: 'dt' },
    });
  });

  it('rejects invalid role', async () => {
    const { db } = makeDb({ callerRole: 'dt' });
    await expect(
      handleSetMemberRole({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-caller' },
        data: { wsId: WS_ID, memberUid: 'uid-coach', role: 'admin' as never },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects targeting the owner', async () => {
    const { db } = makeDb({ callerRole: 'dt' });
    await expect(
      handleSetMemberRole({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-caller' },
        data: { wsId: WS_ID, memberUid: 'uid-owner', role: 'coach' },
      }),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});
```

- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement `functions/src/sub3/setMemberRole.ts`**

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { ClubRole } from './types';

interface HandlerArgs {
  db: Firestore;
  appId: string;
  auth: { uid: string };
  data: { wsId: string; memberUid: string; role: ClubRole };
}

export async function handleSetMemberRole({ db, appId, auth, data }: HandlerArgs) {
  const { wsId, memberUid, role } = data ?? ({} as HandlerArgs['data']);
  if (!wsId || !memberUid) throw new HttpsError('invalid-argument', 'wsId+memberUid requeridos');
  if (role !== 'dt' && role !== 'coach') throw new HttpsError('invalid-argument', 'role inválido');

  const wsSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}`).get();
  if (!wsSnap.exists) throw new HttpsError('not-found', 'workspace no existe');
  const ownerId = wsSnap.data()!.ownerId;

  if (memberUid === ownerId) {
    throw new HttpsError('failed-precondition', 'El propietario es siempre DT. Transfiere la propiedad antes.');
  }

  const callerSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${auth.uid}`).get();
  const isOwner = ownerId === auth.uid;
  const isDt = callerSnap.exists && callerSnap.data()?.role === 'dt';
  if (!isOwner && !isDt) throw new HttpsError('permission-denied', 'Solo DT/owner pueden cambiar roles.');

  await db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${memberUid}`).update({ role });
  return { ok: true };
}

export const setMemberRole = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const appId = process.env.PICK_APP_ID;
  if (!appId) throw new HttpsError('failed-precondition', 'PICK_APP_ID missing');
  return handleSetMemberRole({
    db: getFirestore(),
    appId,
    auth: { uid: request.auth.uid },
    data: request.data,
  });
});
```

- [ ] **Step 4: Run; PASS 3/3.**
- [ ] **Step 5: Commit**

```powershell
git add functions/src/sub3/setMemberRole.ts functions/src/sub3/setMemberRole.test.ts
git commit -m "feat(sub3): setMemberRole callable (TDD, 3 tests)"
```

---

### Task 9: transferOwnership callable (TDD, 4 tests)

**Files:**

- Create: `functions/src/sub3/transferOwnership.test.ts`
- Create: `functions/src/sub3/transferOwnership.ts`

Atomic: cambia `workspace.ownerId` Y bumpea `members/{newOwner}.role` a `'dt'`. En transacción.

- [ ] **Step 1: Write failing tests**

```ts
// functions/src/sub3/transferOwnership.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleTransferOwnership } from './transferOwnership';

const APP_ID = 'app-test';
const WS_ID = 'ws-1';

function makeDb(opts: { ownerId?: string; newOwnerExistsAsMember?: boolean }) {
  const ops: Array<{ kind: 'update'; path: string; data: Record<string, unknown> }> = [];
  const tx = {
    get: async (ref: { path: string }) => {
      if (ref.path === `artifacts/${APP_ID}/workspaces/${WS_ID}`) {
        return { exists: true, data: () => ({ ownerId: opts.ownerId ?? 'uid-owner' }) };
      }
      if (ref.path.includes('/members/uid-newOwner')) {
        return opts.newOwnerExistsAsMember
          ? { exists: true, data: () => ({ role: 'coach' }) }
          : { exists: false, data: () => undefined };
      }
      return { exists: false, data: () => undefined };
    },
    update: (ref: { path: string }, data: Record<string, unknown>) =>
      ops.push({ kind: 'update', path: ref.path, data }),
  };
  const db = {
    doc: (path: string) => ({ path }),
    runTransaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
  return { db: db as unknown as Parameters<typeof handleTransferOwnership>[0]['db'], ops };
}

describe('handleTransferOwnership', () => {
  beforeEach(() => vi.clearAllMocks());

  it('owner transfers + new owner role bumped to dt', async () => {
    const { db, ops } = makeDb({ ownerId: 'uid-owner', newOwnerExistsAsMember: true });
    const r = await handleTransferOwnership({
      db,
      appId: APP_ID,
      auth: { uid: 'uid-owner' },
      data: { wsId: WS_ID, newOwnerUid: 'uid-newOwner' },
    });
    expect(r).toEqual({ ok: true });
    expect(
      ops.find((o) => o.path === `artifacts/${APP_ID}/workspaces/${WS_ID}` && o.data.ownerId === 'uid-newOwner'),
    ).toBeTruthy();
    expect(ops.find((o) => o.path.endsWith('/members/uid-newOwner') && o.data.role === 'dt')).toBeTruthy();
  });

  it('non-owner denied', async () => {
    const { db } = makeDb({ ownerId: 'uid-other', newOwnerExistsAsMember: true });
    await expect(
      handleTransferOwnership({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-owner' },
        data: { wsId: WS_ID, newOwnerUid: 'uid-newOwner' },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects newOwner === caller (no-op transfer)', async () => {
    const { db } = makeDb({ ownerId: 'uid-owner', newOwnerExistsAsMember: true });
    await expect(
      handleTransferOwnership({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-owner' },
        data: { wsId: WS_ID, newOwnerUid: 'uid-owner' },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects newOwner not member of workspace', async () => {
    const { db } = makeDb({ ownerId: 'uid-owner', newOwnerExistsAsMember: false });
    await expect(
      handleTransferOwnership({
        db,
        appId: APP_ID,
        auth: { uid: 'uid-owner' },
        data: { wsId: WS_ID, newOwnerUid: 'uid-newOwner' },
      }),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});
```

- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement `functions/src/sub3/transferOwnership.ts`**

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

interface HandlerArgs {
  db: Firestore;
  appId: string;
  auth: { uid: string };
  data: { wsId: string; newOwnerUid: string };
}

export async function handleTransferOwnership({ db, appId, auth, data }: HandlerArgs) {
  const { wsId, newOwnerUid } = data ?? ({} as HandlerArgs['data']);
  if (!wsId || !newOwnerUid) throw new HttpsError('invalid-argument', 'wsId+newOwnerUid requeridos');
  if (newOwnerUid === auth.uid) throw new HttpsError('invalid-argument', 'newOwnerUid debe ser distinto del actual.');

  await db.runTransaction(async (tx) => {
    const wsSnap = await tx.get(db.doc(`artifacts/${appId}/workspaces/${wsId}`));
    if (!wsSnap.exists) throw new HttpsError('not-found', 'workspace no existe');
    if (wsSnap.data()!.ownerId !== auth.uid) {
      throw new HttpsError('permission-denied', 'Solo el propietario actual puede transferir.');
    }

    const newOwnerSnap = await tx.get(db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${newOwnerUid}`));
    if (!newOwnerSnap.exists) {
      throw new HttpsError('failed-precondition', 'El nuevo propietario debe ser miembro previo del workspace.');
    }

    tx.update(db.doc(`artifacts/${appId}/workspaces/${wsId}`), { ownerId: newOwnerUid });
    tx.update(db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${newOwnerUid}`), { role: 'dt' });
  });

  return { ok: true };
}

export const transferOwnership = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const appId = process.env.PICK_APP_ID;
  if (!appId) throw new HttpsError('failed-precondition', 'PICK_APP_ID missing');
  return handleTransferOwnership({
    db: getFirestore(),
    appId,
    auth: { uid: request.auth.uid },
    data: request.data,
  });
});
```

- [ ] **Step 4: Run; PASS 4/4.**
- [ ] **Step 5: Commit**

```powershell
git add functions/src/sub3/transferOwnership.ts functions/src/sub3/transferOwnership.test.ts
git commit -m "feat(sub3): transferOwnership callable transactional (TDD, 4 tests)"
```

---

### Task 10: getClubAllowlistStatus read-only callable

**Files:**

- Create: `functions/src/sub3/getClubAllowlistStatus.ts`

No tiene test propio (la lógica es una llamada a `isInClubAllowlist`, ya cubierta por createClub tests). Si la regla de cobertura del proyecto lo exige, añadir 1 test trivial.

- [ ] **Step 1: Implement**

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { isInClubAllowlist } from './clubAllowlist';

export const getClubAllowlistStatus = onCall({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  return { allowed: isInClubAllowlist(request.auth.uid) };
});
```

- [ ] **Step 2: Commit**

```powershell
git add functions/src/sub3/getClubAllowlistStatus.ts
git commit -m "feat(sub3): getClubAllowlistStatus read-only callable"
```

---

### Task 11: onMemberDelete trigger (TDD, 2 tests)

**Files:**

- Create: `functions/src/sub3/onMemberDelete.test.ts`
- Create: `functions/src/sub3/onMemberDelete.ts`

Trigger Firestore document delete sobre `artifacts/{appId}/workspaces/{wsId}/members/{memberUid}`. Limpia: grants `grantedBy` y `grantedTo` por este uid en este workspace + invites `invitedBy` por este uid. Usa `collectionGroup('grantees')` y `collectionGroup('invites')` con `where('workspaceId', '==', wsId)`.

Patrón: extraer la función pura `cleanupAfterMemberDelete({ db, appId, wsId, memberUid })` para testabilidad. El export final es el wrapper v2 `onDocumentDeleted`.

- [ ] **Step 1: Write failing tests**

```ts
// functions/src/sub3/onMemberDelete.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanupAfterMemberDelete } from './onMemberDelete';

const APP_ID = 'app-test';
const WS_ID = 'ws-1';

function makeDb(state: {
  grantees?: Array<{ path: string; data: Record<string, unknown> }>;
  invites?: Array<{ path: string; data: Record<string, unknown> }>;
}) {
  const deletes: string[] = [];
  const collectionGroup = vi.fn((name: string) => ({
    where: vi.fn().mockImplementation(function chain(this: unknown) {
      // chain.where(...).where(...).get()
      return {
        where: chain.bind(this),
        get: async () => {
          if (name === 'grantees')
            return {
              docs: (state.grantees ?? []).map((d) => ({
                ref: {
                  path: d.path,
                  delete: async () => {
                    deletes.push(d.path);
                  },
                },
              })),
            };
          if (name === 'invites')
            return {
              docs: (state.invites ?? []).map((d) => ({
                ref: {
                  path: d.path,
                  delete: async () => {
                    deletes.push(d.path);
                  },
                },
              })),
            };
          return { docs: [] };
        },
      };
    }),
  }));
  const db = { collectionGroup } as unknown as Parameters<typeof cleanupAfterMemberDelete>[0]['db'];
  return { db, deletes };
}

describe('cleanupAfterMemberDelete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes grants (grantedBy + grantedTo) and invites of the deleted member', async () => {
    const { db, deletes } = makeDb({
      grantees: [
        {
          path: `artifacts/${APP_ID}/workspaces/${WS_ID}/teams/T/grants/asistencia/grantees/uid-deleted`,
          data: { workspaceId: WS_ID, grantedTo: 'uid-deleted', grantedBy: 'uid-other' },
        },
      ],
      invites: [
        {
          path: `artifacts/${APP_ID}/workspaces/${WS_ID}/invites/inv-1`,
          data: { workspaceId: WS_ID, invitedBy: 'uid-deleted' },
        },
      ],
    });
    await cleanupAfterMemberDelete({ db, appId: APP_ID, wsId: WS_ID, memberUid: 'uid-deleted' });
    expect(deletes.length).toBeGreaterThanOrEqual(2);
  });

  it('no-op when no grants/invites match', async () => {
    const { db, deletes } = makeDb({});
    await cleanupAfterMemberDelete({ db, appId: APP_ID, wsId: WS_ID, memberUid: 'uid-deleted' });
    expect(deletes).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement `functions/src/sub3/onMemberDelete.ts`**

```ts
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

interface CleanupArgs {
  db: Firestore;
  appId: string;
  wsId: string;
  memberUid: string;
}

export async function cleanupAfterMemberDelete({ db, appId, wsId, memberUid }: CleanupArgs) {
  // Delete grantees where this user was the recipient
  const granteesAsTo = await db
    .collectionGroup('grantees')
    .where('workspaceId', '==', wsId)
    .where('grantedTo', '==', memberUid)
    .get();
  // Delete grantees this user authored
  const granteesAsBy = await db
    .collectionGroup('grantees')
    .where('workspaceId', '==', wsId)
    .where('grantedBy', '==', memberUid)
    .get();
  // Delete pending invites this user issued
  const invites = await db
    .collectionGroup('invites')
    .where('workspaceId', '==', wsId)
    .where('invitedBy', '==', memberUid)
    .get();

  const all = [...granteesAsTo.docs, ...granteesAsBy.docs, ...invites.docs];
  await Promise.all(all.map((d) => d.ref.delete()));

  console.log(
    `[onMemberDelete] wsId=${wsId} uid=${memberUid} cleaned grantsTo=${granteesAsTo.docs.length} grantsBy=${granteesAsBy.docs.length} invites=${invites.docs.length}`,
  );
}

export const onMemberDelete = onDocumentDeleted(
  { region: 'europe-west1', document: 'artifacts/{appId}/workspaces/{wsId}/members/{memberUid}' },
  async (event) => {
    const { appId, wsId, memberUid } = event.params as { appId: string; wsId: string; memberUid: string };
    try {
      await cleanupAfterMemberDelete({ db: getFirestore(), appId, wsId, memberUid });
    } catch (err) {
      console.error(`[onMemberDelete] FATAL wsId=${wsId} uid=${memberUid}`, (err as Error).message);
    }
  },
);
```

- [ ] **Step 4: Run; PASS 2/2.**
- [ ] **Step 5: Commit**

```powershell
git add functions/src/sub3/onMemberDelete.ts functions/src/sub3/onMemberDelete.test.ts
git commit -m "feat(sub3): onMemberDelete trigger (TDD, 2 tests)"
```

---

### Task 12: onTeamCreate trigger (TDD, 2 tests)

**Files:**

- Create: `functions/src/sub3/onTeamCreate.test.ts`
- Create: `functions/src/sub3/onTeamCreate.ts`

Cuando se crea un team en un workspace `type === 'personal'`: union el teamId al `assignedTeamIds` del único member. En workspaces `type === 'club'`: no-op (los DT asignan manualmente desde la UI).

- [ ] **Step 1: Write failing tests**

```ts
// functions/src/sub3/onTeamCreate.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncOnTeamCreate } from './onTeamCreate';

const APP_ID = 'app-test';
const WS_ID = 'ws-1';
const TEAM_ID = 'team-new';

function makeDb(opts: { wsType: 'personal' | 'club'; ownerUid?: string }) {
  const updates: Array<{ path: string; data: Record<string, unknown> }> = [];
  const docs: Record<string, { exists: boolean; data: () => Record<string, unknown> }> = {
    [`artifacts/${APP_ID}/workspaces/${WS_ID}`]: {
      exists: true,
      data: () => ({ type: opts.wsType, ownerId: opts.ownerUid ?? 'uid-owner' }),
    },
  };
  const db = {
    doc: (path: string) => ({
      path,
      get: async () => docs[path] ?? { exists: false, data: () => ({}) },
      update: async (data: Record<string, unknown>) => {
        updates.push({ path, data });
      },
    }),
    collection: (path: string) => ({
      get: async () => {
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}/members`) {
          return {
            docs: [
              {
                id: opts.ownerUid ?? 'uid-owner',
                ref: {
                  path: `${path}/${opts.ownerUid ?? 'uid-owner'}`,
                  update: async (d: Record<string, unknown>) =>
                    updates.push({ path: `${path}/${opts.ownerUid ?? 'uid-owner'}`, data: d }),
                },
              },
            ],
          };
        }
        return { docs: [] };
      },
    }),
  };
  return { db: db as unknown as Parameters<typeof syncOnTeamCreate>[0]['db'], updates };
}

describe('syncOnTeamCreate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('personal workspace: arrayUnion teamId on the single member', async () => {
    const { db, updates } = makeDb({ wsType: 'personal' });
    await syncOnTeamCreate({ db, appId: APP_ID, wsId: WS_ID, teamId: TEAM_ID });
    expect(updates).toHaveLength(1);
    expect(updates[0].path).toBe(`artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-owner`);
    // assignedTeamIds is FieldValue.arrayUnion(...) — assert it's truthy / called
    expect(updates[0].data.assignedTeamIds).toBeTruthy();
  });

  it('club workspace: no-op', async () => {
    const { db, updates } = makeDb({ wsType: 'club' });
    await syncOnTeamCreate({ db, appId: APP_ID, wsId: WS_ID, teamId: TEAM_ID });
    expect(updates).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement `functions/src/sub3/onTeamCreate.ts`**

```ts
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

interface SyncArgs {
  db: Firestore;
  appId: string;
  wsId: string;
  teamId: string;
}

export async function syncOnTeamCreate({ db, appId, wsId, teamId }: SyncArgs) {
  const wsSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}`).get();
  if (!wsSnap.exists) return;
  if (wsSnap.data()!.type !== 'personal') return; // club: DTs asignan manualmente

  const members = await db.collection(`artifacts/${appId}/workspaces/${wsId}/members`).get();
  await Promise.all(members.docs.map((m) => m.ref.update({ assignedTeamIds: FieldValue.arrayUnion(teamId) })));
  console.log(`[onTeamCreate] personal sync wsId=${wsId} teamId=${teamId} members=${members.docs.length}`);
}

export const onTeamCreate = onDocumentCreated(
  { region: 'europe-west1', document: 'artifacts/{appId}/workspaces/{wsId}/teams/{teamId}' },
  async (event) => {
    const { appId, wsId, teamId } = event.params as { appId: string; wsId: string; teamId: string };
    try {
      await syncOnTeamCreate({ db: getFirestore(), appId, wsId, teamId });
    } catch (err) {
      console.error(`[onTeamCreate] FATAL wsId=${wsId} teamId=${teamId}`, (err as Error).message);
    }
  },
);
```

- [ ] **Step 4: Run; PASS 2/2.**
- [ ] **Step 5: Commit**

```powershell
git add functions/src/sub3/onTeamCreate.ts functions/src/sub3/onTeamCreate.test.ts
git commit -m "feat(sub3): onTeamCreate trigger personal-sync (TDD, 2 tests)"
```

---

### Task 13: onTeamDelete trigger (TDD, 2 tests)

**Files:**

- Create: `functions/src/sub3/onTeamDelete.test.ts`
- Create: `functions/src/sub3/onTeamDelete.ts`

Borra recursivamente subcolección `grants/*/grantees/*` del team y arrayRemove del teamId en `assignedTeamIds` de todos los members del workspace. NO toca brackets/calendarSessions/cuaderno (decisión sub-0).

- [ ] **Step 1: Write failing tests**

```ts
// functions/src/sub3/onTeamDelete.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanupAfterTeamDelete } from './onTeamDelete';

const APP_ID = 'app-test';
const WS_ID = 'ws-1';
const TEAM_ID = 'team-deleted';

function makeDb(opts: { granteePaths?: string[]; memberIds?: string[] } = {}) {
  const ops: Array<{ kind: 'delete' | 'update'; path: string; data?: Record<string, unknown> }> = [];
  const db = {
    collection: (path: string) => ({
      get: async () => {
        if (path.includes(`/teams/${TEAM_ID}/grants`)) {
          // listGrantTypes simulado: devolvemos 1 collectionType doc 'asistencia'
          return { docs: [{ id: 'asistencia', ref: { path: `${path}/asistencia` } }] };
        }
        if (path.includes('/grantees')) {
          return {
            docs: (opts.granteePaths ?? []).map((p) => ({
              ref: { path: p, delete: async () => ops.push({ kind: 'delete', path: p }) },
            })),
          };
        }
        if (path === `artifacts/${APP_ID}/workspaces/${WS_ID}/members`) {
          return {
            docs: (opts.memberIds ?? ['uid-A', 'uid-B']).map((id) => ({
              id,
              ref: {
                path: `${path}/${id}`,
                update: async (d: Record<string, unknown>) =>
                  ops.push({ kind: 'update', path: `${path}/${id}`, data: d }),
              },
            })),
          };
        }
        return { docs: [] };
      },
    }),
  };
  return { db: db as unknown as Parameters<typeof cleanupAfterTeamDelete>[0]['db'], ops };
}

describe('cleanupAfterTeamDelete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes grantees + arrayRemove on every member', async () => {
    const { db, ops } = makeDb({
      granteePaths: [`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/${TEAM_ID}/grants/asistencia/grantees/uid-X`],
      memberIds: ['uid-A', 'uid-B'],
    });
    await cleanupAfterTeamDelete({ db, appId: APP_ID, wsId: WS_ID, teamId: TEAM_ID });
    expect(ops.filter((o) => o.kind === 'delete')).toHaveLength(1);
    expect(ops.filter((o) => o.kind === 'update')).toHaveLength(2);
    for (const u of ops.filter((o) => o.kind === 'update')) {
      expect(u.data!.assignedTeamIds).toBeTruthy(); // FieldValue.arrayRemove(teamId)
    }
  });

  it('no grantees: still arrayRemoves from members', async () => {
    const { db, ops } = makeDb({ granteePaths: [], memberIds: ['uid-A'] });
    await cleanupAfterTeamDelete({ db, appId: APP_ID, wsId: WS_ID, teamId: TEAM_ID });
    expect(ops.filter((o) => o.kind === 'delete')).toHaveLength(0);
    expect(ops.filter((o) => o.kind === 'update')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement `functions/src/sub3/onTeamDelete.ts`**

```ts
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

interface CleanupArgs {
  db: Firestore;
  appId: string;
  wsId: string;
  teamId: string;
}

export async function cleanupAfterTeamDelete({ db, appId, wsId, teamId }: CleanupArgs) {
  // 1. Delete all grantees under each grant collectionType.
  const grantsCol = await db.collection(`artifacts/${appId}/workspaces/${wsId}/teams/${teamId}/grants`).get();
  for (const grantTypeDoc of grantsCol.docs) {
    const grantees = await db.collection(`${grantTypeDoc.ref.path}/grantees`).get();
    await Promise.all(grantees.docs.map((g) => g.ref.delete()));
  }

  // 2. arrayRemove teamId from every member's assignedTeamIds.
  const members = await db.collection(`artifacts/${appId}/workspaces/${wsId}/members`).get();
  await Promise.all(members.docs.map((m) => m.ref.update({ assignedTeamIds: FieldValue.arrayRemove(teamId) })));

  console.log(
    `[onTeamDelete] wsId=${wsId} teamId=${teamId} grantTypes=${grantsCol.docs.length} members=${members.docs.length}`,
  );
}

export const onTeamDelete = onDocumentDeleted(
  { region: 'europe-west1', document: 'artifacts/{appId}/workspaces/{wsId}/teams/{teamId}' },
  async (event) => {
    const { appId, wsId, teamId } = event.params as { appId: string; wsId: string; teamId: string };
    try {
      await cleanupAfterTeamDelete({ db: getFirestore(), appId, wsId, teamId });
    } catch (err) {
      console.error(`[onTeamDelete] FATAL wsId=${wsId} teamId=${teamId}`, (err as Error).message);
    }
  },
);
```

- [ ] **Step 4: Run; PASS 2/2.**
- [ ] **Step 5: Commit**

```powershell
git add functions/src/sub3/onTeamDelete.ts functions/src/sub3/onTeamDelete.test.ts
git commit -m "feat(sub3): onTeamDelete trigger (TDD, 2 tests)"
```

---

### Task 14: cleanupExpiredInvites scheduled (TDD, 1 test)

**Files:**

- Create: `functions/src/sub3/cleanupExpiredInvites.test.ts`
- Create: `functions/src/sub3/cleanupExpiredInvites.ts`

Job diario que borra invites cuyo `expiresAt < now` cross-workspace via `collectionGroup('invites')`.

- [ ] **Step 1: Write failing test**

```ts
// functions/src/sub3/cleanupExpiredInvites.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { runCleanupExpiredInvites } from './cleanupExpiredInvites';

function tsMs(ms: number) {
  return { toMillis: () => ms } as unknown as Timestamp;
}

const NOW_MS = 1_700_000_000_000;
beforeEach(() => vi.useFakeTimers().setSystemTime(NOW_MS));

describe('runCleanupExpiredInvites', () => {
  it('deletes only invites whose expiresAt < now', async () => {
    const deletes: string[] = [];
    const expired = {
      ref: {
        path: 'a/expired',
        delete: async () => {
          deletes.push('a/expired');
        },
      },
      data: () => ({ expiresAt: tsMs(NOW_MS - 1000) }),
    };
    const fresh = {
      ref: {
        path: 'b/fresh',
        delete: async () => {
          deletes.push('b/fresh');
        },
      },
      data: () => ({ expiresAt: tsMs(NOW_MS + 60_000) }),
    };
    const db = {
      collectionGroup: () => ({
        where: () => ({ get: async () => ({ docs: [expired] }) }), // server-side `<` filter only returns expired
      }),
    };
    const result = await runCleanupExpiredInvites({
      db: db as unknown as Parameters<typeof runCleanupExpiredInvites>[0]['db'],
    });
    expect(deletes).toEqual(['a/expired']);
    expect(result.deleted).toBe(1);
    expect(fresh.ref.path).toBe('b/fresh'); // sanity
  });
});
```

- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement `functions/src/sub3/cleanupExpiredInvites.ts`**

```ts
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

export async function runCleanupExpiredInvites({ db }: { db: Firestore }) {
  const now = Timestamp.now();
  const snap = await db.collectionGroup('invites').where('expiresAt', '<', now).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
  console.log(`[cleanupExpiredInvites] deleted=${snap.docs.length}`);
  return { deleted: snap.docs.length };
}

export const cleanupExpiredInvites = onSchedule(
  { region: 'europe-west1', schedule: 'every 24 hours', timeZone: 'Europe/Madrid' },
  async () => {
    try {
      await runCleanupExpiredInvites({ db: getFirestore() });
    } catch (err) {
      console.error('[cleanupExpiredInvites] FATAL', (err as Error).message);
    }
  },
);
```

- [ ] **Step 4: Run; PASS 1/1.**
- [ ] **Step 5: Commit**

```powershell
git add functions/src/sub3/cleanupExpiredInvites.ts functions/src/sub3/cleanupExpiredInvites.test.ts
git commit -m "feat(sub3): cleanupExpiredInvites scheduled (TDD, 1 test)"
```

---

### Task 15: Wire exports in index.ts + deploy + smoke

**Files:**

- Modify: `functions/src/index.ts`

- [ ] **Step 1: Add sub3 exports at end of `functions/src/index.ts`**

Append after the existing `// Sub-proyecto 2 migration` exports block (currently ends at line ~473):

```ts
// Sub-proyecto 3 — invitaciones y licencias.
export { createClub } from './sub3/createClub';
export { inviteMember } from './sub3/inviteMember';
export { acceptInvite } from './sub3/acceptInvite';
export { revokeInvite } from './sub3/revokeInvite';
export { revokeMember } from './sub3/revokeMember';
export { setMemberTeams } from './sub3/setMemberTeams';
export { setMemberRole } from './sub3/setMemberRole';
export { transferOwnership } from './sub3/transferOwnership';
export { getClubAllowlistStatus } from './sub3/getClubAllowlistStatus';
export { onMemberDelete } from './sub3/onMemberDelete';
export { onTeamCreate } from './sub3/onTeamCreate';
export { onTeamDelete } from './sub3/onTeamDelete';
export { cleanupExpiredInvites } from './sub3/cleanupExpiredInvites';
```

- [ ] **Step 2: Run full functions test suite + typecheck**

```powershell
cd functions; npx vitest run; npx tsc --noEmit
```

Expected: All tests pass (existing + sub3 new = ~37 added). No TS errors.

- [ ] **Step 3: Deploy functions to europe-west1 (only sub3 + read-only)**

```powershell
firebase deploy --only "functions:createClub,functions:inviteMember,functions:acceptInvite,functions:revokeInvite,functions:revokeMember,functions:setMemberTeams,functions:setMemberRole,functions:transferOwnership,functions:getClubAllowlistStatus,functions:onMemberDelete,functions:onTeamCreate,functions:onTeamDelete,functions:cleanupExpiredInvites"
```

- [ ] **Step 4: Smoke test allowlist callable from Cloud Logs**

Manual: invocar desde Firebase Console → Functions → `getClubAllowlistStatus` → "test function" with empty body, signed in as super-admin uid → expect `{ allowed: true }`. Otra cuenta → `{ allowed: false }`.

- [ ] **Step 5: Commit + push branch**

```powershell
git add functions/src/index.ts
git commit -m "feat(sub3): wire 13 exports + deploy backend"
git push -u origin sub3-pr1-callables
```

- [ ] **Step 6: Open PR #1**

```powershell
gh pr create --base main --title "sub-proyecto 3 (PR #1) — callables + triggers + scheduled" --body "$(cat <<'EOF'
## Summary
- 8 callables write (createClub, inviteMember, acceptInvite, revokeInvite, revokeMember, setMemberTeams, setMemberRole, transferOwnership)
- 1 callable read-only (getClubAllowlistStatus)
- 3 triggers (onMemberDelete, onTeamCreate, onTeamDelete)
- 1 scheduled (cleanupExpiredInvites)
- ~37 vitest unit tests with mock Firestore

Sub-3 spec: docs/superpowers/specs/2026-05-04-sub-proyecto-3-invitaciones-y-licencias-design.md

## Test plan
- [x] vitest passes locally
- [x] tsc --noEmit clean
- [x] deployed to europe-west1
- [x] getClubAllowlistStatus smoke test (allowed/denied) verified manually
- [ ] (Deferred to PR #2/#3) UI not yet wired; callables live but unused.
EOF
)"
```

---

## PR #2 — Reglas Firestore extendidas

**Branch:** `sub3-pr2-rules`. Crear desde `main` después de mergear PR #1.

Tres bloques de cambios sobre `firestore.rules`:

1. **Nuevo:** `match /invites/{inviteId}` → read members, write false.
2. **Refuerzo:** `match /members/{memberUid}` → write false (sub-2 permitía DT/owner directo; sub-3 fuerza canal callable).
3. **Refuerzo:** `match /workspaces/{wsId}` → bloquear cambio directo de `ownerId` (sub-2 lo permitía si nuevo owner era member; sub-3 fuerza canal `transferOwnership`).

### Task 16: Añadir bloque `invites` + tests rules (5 tests)

**Files:**

- Modify: `firestore.rules`
- Modify: `firestore.rules.test.ts`

- [ ] **Step 1: Edit `firestore.rules` — añadir bloque dentro de `match /artifacts/{appId}/workspaces/{wsId}` después del bloque `members`**

Localizar el cierre del bloque `members/{memberUid}` (línea ~139 actual, justo antes del comentario `// ============ Cat B`). Insertar:

```js
// Sub-3: invites son read-only desde cliente. Toda mutación va por callables
// (inviteMember/revokeInvite/acceptInvite) con validación server-side.
match /invites/{inviteId} {
  allow read: if isWorkspaceMember(appId, wsId);
  allow write: if false;
}
```

- [ ] **Step 2: Add 5 tests in `firestore.rules.test.ts`** (apéndice nuevo `describe('firestore.rules — invites (sub-3)')`)

```ts
describe('firestore.rules — invites (sub-3)', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      // Club con DT, coach, no-member
      await db.doc(`artifacts/${APP_ID}/workspaces/CLUB`).set({
        type: 'club',
        name: 'Club',
        ownerId: 'U_DT',
        plan: 'free',
        billing: null,
      });
      await db.doc(`artifacts/${APP_ID}/workspaces/CLUB/members/U_DT`).set({ role: 'dt', assignedTeamIds: [] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/CLUB/members/U_COACH`)
        .set({ role: 'coach', assignedTeamIds: ['t1'] });
      await db.doc(`artifacts/${APP_ID}/workspaces/CLUB/invites/inv-1`).set({
        inviteId: 'inv-1',
        workspaceId: 'CLUB',
        invitedBy: 'U_DT',
        inviteEmail: null,
        inviteName: null,
        role: 'coach',
        assignedTeamIds: ['t1'],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      });
    });
  });

  it('DT can read invites', async () => {
    const db = testEnv.authenticatedContext('U_DT').firestore();
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/workspaces/CLUB/invites/inv-1`).get());
  });

  it('coach can read invites (transparency)', async () => {
    const db = testEnv.authenticatedContext('U_COACH').firestore();
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/workspaces/CLUB/invites/inv-1`).get());
  });

  it('non-member denied read', async () => {
    const db = testEnv.authenticatedContext('U_OUT').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/CLUB/invites/inv-1`).get());
  });

  it('DT cannot CREATE invite directly (must use callable)', async () => {
    const db = testEnv.authenticatedContext('U_DT').firestore();
    await assertFails(
      db.doc(`artifacts/${APP_ID}/workspaces/CLUB/invites/inv-NEW`).set({
        inviteId: 'inv-NEW',
        workspaceId: 'CLUB',
        invitedBy: 'U_DT',
        role: 'coach',
        assignedTeamIds: ['t1'],
        inviteEmail: null,
        inviteName: null,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      }),
    );
  });

  it('DT cannot DELETE invite directly (must use callable)', async () => {
    const db = testEnv.authenticatedContext('U_DT').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/CLUB/invites/inv-1`).delete());
  });
});
```

- [ ] **Step 3: Run rules tests against emulator**

```powershell
firebase emulators:exec --only firestore "npx vitest run firestore.rules.test.ts"
```

Expected: PASS — 5 nuevos tests verdes + todos los previos siguen verdes.

- [ ] **Step 4: Commit**

```powershell
git checkout -b sub3-pr2-rules
git add firestore.rules firestore.rules.test.ts
git commit -m "feat(sub3-rules): bloquear invites a writes directos + 5 tests"
```

---

### Task 17: Refuerzo `members/{memberUid}` → write false + tests (3 tests)

**Files:**

- Modify: `firestore.rules`
- Modify: `firestore.rules.test.ts`

- [ ] **Step 1: Edit `firestore.rules` — reemplazar el bloque `match /members/{memberUid}` actual por la versión cerrada**

Localizar bloque actual (líneas ~124-139):

```js
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
```

Reemplazar por:

```js
// Sub-3: writes a members SOLO via callables (createClub, acceptInvite,
// revokeMember, setMemberTeams, setMemberRole, transferOwnership) que validan
// invariantes (teamId existe, no demote owner, atomic role bump) que las rules
// no pueden expresar fácilmente. Reads siguen abiertos a todos los members.
match /members/{memberUid} {
  allow read: if isWorkspaceMember(appId, wsId);
  allow write: if false;
}
```

- [ ] **Step 2: Add 3 tests dentro de un `describe('firestore.rules — members refuerzo (sub-3)')`**

```ts
describe('firestore.rules — members refuerzo (sub-3)', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc(`artifacts/${APP_ID}/workspaces/CLUB`).set({
        type: 'club',
        name: 'Club',
        ownerId: 'U_DT',
        plan: 'free',
        billing: null,
      });
      await db.doc(`artifacts/${APP_ID}/workspaces/CLUB/members/U_DT`).set({ role: 'dt', assignedTeamIds: [] });
      await db
        .doc(`artifacts/${APP_ID}/workspaces/CLUB/members/U_COACH`)
        .set({ role: 'coach', assignedTeamIds: ['t1'] });
    });
  });

  it('DT cannot update a coach role directly', async () => {
    const db = testEnv.authenticatedContext('U_DT').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/CLUB/members/U_COACH`).update({ role: 'dt' }));
  });

  it('DT cannot update assignedTeamIds directly', async () => {
    const db = testEnv.authenticatedContext('U_DT').firestore();
    await assertFails(
      db.doc(`artifacts/${APP_ID}/workspaces/CLUB/members/U_COACH`).update({ assignedTeamIds: ['t2'] }),
    );
  });

  it('owner cannot update own membership directly anymore', async () => {
    const db = testEnv.authenticatedContext('U_DT').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/CLUB/members/U_DT`).update({ assignedTeamIds: ['t1'] }));
  });
});
```

- [ ] **Step 3: Run rules tests**

```powershell
firebase emulators:exec --only firestore "npx vitest run firestore.rules.test.ts"
```

Expected: 3 nuevos tests pass. **Importante:** verificar que los tests previos de sub-2 que asumían DT podía editar members directos NO existen (sub-2 los modela vía callable test, no rules test) — si alguno falla, fix lazy y discutir con el usuario antes de seguir.

- [ ] **Step 4: Commit**

```powershell
git add firestore.rules firestore.rules.test.ts
git commit -m "feat(sub3-rules): cerrar writes directos a members + 3 tests"
```

---

### Task 18: Refuerzo `workspaces.ownerId` inmutable + tests (2 tests) + deploy

**Files:**

- Modify: `firestore.rules`
- Modify: `firestore.rules.test.ts`

- [ ] **Step 1: Edit `firestore.rules` — endurecer las dos `allow update` de `workspaces/{wsId}`**

Localizar líneas ~113-120:

```js
allow update: if isWorkspaceOwner(appId, wsId)
  && (
    request.resource.data.ownerId == resource.data.ownerId
    || isWorkspaceMemberUid(appId, wsId, request.resource.data.ownerId)
  );
allow update: if isDT(appId, wsId)
  && workspaceMetaProtected(request.resource.data.diff(resource.data));
```

Reemplazar por:

```js
// Sub-3: ownerId inmutable desde cliente — el cambio de propiedad va por
// callable transferOwnership que bumpea atómicamente members/{newOwner}.role.
allow update: if isWorkspaceOwner(appId, wsId)
  && request.resource.data.ownerId == resource.data.ownerId;
allow update: if isDT(appId, wsId)
  && workspaceMetaProtected(request.resource.data.diff(resource.data));
```

- [ ] **Step 2: Add 2 tests en describe `firestore.rules — workspaces.ownerId (sub-3)`**

```ts
describe('firestore.rules — workspaces.ownerId refuerzo (sub-3)', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.doc(`artifacts/${APP_ID}/workspaces/CLUB`).set({
        type: 'club',
        name: 'Club',
        ownerId: 'U_DT',
        plan: 'free',
        billing: null,
      });
      await db.doc(`artifacts/${APP_ID}/workspaces/CLUB/members/U_DT`).set({ role: 'dt', assignedTeamIds: [] });
      await db.doc(`artifacts/${APP_ID}/workspaces/CLUB/members/U_DT2`).set({ role: 'dt', assignedTeamIds: [] });
    });
  });

  it('owner cannot change ownerId directly anymore', async () => {
    const db = testEnv.authenticatedContext('U_DT').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/CLUB`).update({ ownerId: 'U_DT2' }));
  });

  it('non-owner DT also cannot change ownerId (re-confirm sub-2 invariant)', async () => {
    const db = testEnv.authenticatedContext('U_DT2').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/CLUB`).update({ ownerId: 'U_DT2' }));
  });
});
```

- [ ] **Step 3: Run full rules suite**

```powershell
firebase emulators:exec --only firestore "npx vitest run firestore.rules.test.ts"
```

Expected: ~60 tests pass total (50 previos + 10 nuevos). Si rompe algún test pre-existente que asumía owner pueda transferir desde cliente, escalar al usuario antes de modificar — el plan asume que sub-2 NO tiene tests rules sobre ese path concreto.

- [ ] **Step 4: Deploy reglas**

```powershell
firebase deploy --only firestore:rules
```

- [ ] **Step 5: Smoke en producción (lectura ok, write directo blocked)**

Manual: en Firebase Console → Firestore → intentar editar `workspaces/{cualquiera}/members/{algún uid}` desde la consola web (que se autentica como admin → bypass rules); luego probar el mismo write desde una consola del navegador autenticada como user normal vía SDK → debe rechazar. (Este smoke se documenta sin ejecutar en automatic; el usuario lo decide.)

- [ ] **Step 6: Commit + push + PR**

```powershell
git add firestore.rules firestore.rules.test.ts
git commit -m "feat(sub3-rules): ownerId inmutable desde cliente + 2 tests + deploy"
git push -u origin sub3-pr2-rules
gh pr create --base main --title "sub-proyecto 3 (PR #2) — rules: invites + members + ownerId" --body "$(cat <<'EOF'
## Summary
- Nuevo bloque `invites/{inviteId}` (read members, write false)
- Refuerzo `members/{memberUid}` → write false (canal callable obligatorio)
- Refuerzo `workspaces.ownerId` → inmutable desde cliente (canal `transferOwnership`)
- 10 tests nuevos en firestore.rules.test.ts (5 invites + 3 members + 2 ownerId), ~60 totales

## Test plan
- [x] firestore emulator suite verde local (10 nuevos + 50 previos)
- [x] firebase deploy --only firestore:rules ok
- [ ] Smoke manual desde consola navegador (documentado, owner ejecuta)
EOF
)"
```

---

## PR #3 — UI cliente (3 pantallas + WorkspaceSelector + modal crear club)

**Branch:** `sub3-pr3-ui`. Crear desde `main` después de mergear PR #2.

### Task 19: membersService client wrappers (TDD, 4 tests)

**Files:**

- Create: `src/services/membersService.js`
- Create: `src/services/membersService.test.js`

- [ ] **Step 1: Write failing tests `src/services/membersService.test.js`**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fns from 'firebase/functions';
import { createMembersService } from './membersService';

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => 'FN_REGION'),
  httpsCallable: vi.fn((_fn, name) => async (data) => ({ data: { _called: name, _payload: data } })),
}));

describe('membersService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('createClub calls callable with name', async () => {
    const svc = createMembersService({ app: {} });
    const r = await svc.createClub({ name: 'Uros' });
    expect(r._called).toBe('createClub');
    expect(r._payload).toEqual({ name: 'Uros' });
  });

  it('inviteMember passes wsId+role+teams+email+name', async () => {
    const svc = createMembersService({ app: {} });
    const r = await svc.inviteMember({
      wsId: 'ws1',
      role: 'coach',
      assignedTeamIds: ['t'],
      email: 'p@x.com',
      name: 'P',
    });
    expect(r._called).toBe('inviteMember');
    expect(r._payload).toMatchObject({
      wsId: 'ws1',
      role: 'coach',
      assignedTeamIds: ['t'],
      email: 'p@x.com',
      name: 'P',
    });
  });

  it('acceptInvite passes wsId+inviteId', async () => {
    const svc = createMembersService({ app: {} });
    const r = await svc.acceptInvite({ wsId: 'ws1', inviteId: 'inv' });
    expect(r._called).toBe('acceptInvite');
  });

  it('transferOwnership passes wsId+newOwnerUid', async () => {
    const svc = createMembersService({ app: {} });
    const r = await svc.transferOwnership({ wsId: 'ws1', newOwnerUid: 'u2' });
    expect(r._called).toBe('transferOwnership');
    expect(r._payload).toEqual({ wsId: 'ws1', newOwnerUid: 'u2' });
  });
});
```

- [ ] **Step 2: Run; expect FAIL.**

```powershell
npx vitest run src/services/membersService.test.js
```

- [ ] **Step 3: Implement `src/services/membersService.js`**

```js
import { getFunctions, httpsCallable } from 'firebase/functions';

const REGION = 'europe-west1';

export function createMembersService({ app }) {
  const fns = getFunctions(app, REGION);
  const wrap = (name) => async (payload) => {
    const cb = httpsCallable(fns, name);
    const res = await cb(payload);
    return res.data;
  };
  return {
    createClub: wrap('createClub'),
    inviteMember: wrap('inviteMember'),
    acceptInvite: wrap('acceptInvite'),
    revokeInvite: wrap('revokeInvite'),
    revokeMember: wrap('revokeMember'),
    setMemberTeams: wrap('setMemberTeams'),
    setMemberRole: wrap('setMemberRole'),
    transferOwnership: wrap('transferOwnership'),
    getClubAllowlistStatus: wrap('getClubAllowlistStatus'),
  };
}
```

- [ ] **Step 4: Run; PASS 4/4.**
- [ ] **Step 5: Commit**

```powershell
git checkout -b sub3-pr3-ui
git add src/services/membersService.js src/services/membersService.test.js
git commit -m "feat(sub3-ui): membersService callable wrappers (TDD, 4 tests)"
```

---

### Task 20: Hooks (useClubAllowlist, useMembers, useInvites, useAcceptInvite)

**Files:**

- Create: `src/hooks/useClubAllowlist.js`
- Create: `src/hooks/useMembers.js`
- Create: `src/hooks/useInvites.js`
- Create: `src/hooks/useAcceptInvite.js`

Sin tests dedicados de hooks (cobertura indirecta vía componentes que los usan en Tasks 21-25). Si el revisor los pide, añadir 1-2 tests con `@testing-library/react` `renderHook` por hook.

- [ ] **Step 1: Create `src/hooks/useClubAllowlist.js`**

```js
import { useEffect, useState } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { useAuth } from '../contexts/AuthContext';
import { createMembersService } from '../services/membersService';

export function useClubAllowlist() {
  const { app } = useFirebase();
  const { user } = useAuth();
  const [state, setState] = useState({ allowed: false, loading: true });

  useEffect(() => {
    if (!app || !user?.uid) {
      setState({ allowed: false, loading: false });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const svc = createMembersService({ app });
        const { allowed } = await svc.getClubAllowlistStatus();
        if (!cancelled) setState({ allowed: !!allowed, loading: false });
      } catch (err) {
        console.error('[useClubAllowlist]', err);
        if (!cancelled) setState({ allowed: false, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [app, user?.uid]);

  return state;
}
```

- [ ] **Step 2: Create `src/hooks/useMembers.js`**

```js
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '../contexts/FirebaseContext';

export function useMembers(wsId) {
  const { db, appId } = useFirebase();
  const [state, setState] = useState({ members: [], loading: true });

  useEffect(() => {
    if (!db || !appId || !wsId) {
      setState({ members: [], loading: false });
      return;
    }
    const ref = collection(db, 'artifacts', appId, 'workspaces', wsId, 'members');
    const unsub = onSnapshot(
      ref,
      (snap) => setState({ members: snap.docs.map((d) => ({ uid: d.id, ...d.data() })), loading: false }),
      (err) => {
        console.error('[useMembers]', err);
        setState({ members: [], loading: false });
      },
    );
    return unsub;
  }, [db, appId, wsId]);

  return state;
}
```

- [ ] **Step 3: Create `src/hooks/useInvites.js`**

```js
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '../contexts/FirebaseContext';

export function useInvites(wsId) {
  const { db, appId } = useFirebase();
  const [state, setState] = useState({ invites: [], loading: true });

  useEffect(() => {
    if (!db || !appId || !wsId) {
      setState({ invites: [], loading: false });
      return;
    }
    const ref = collection(db, 'artifacts', appId, 'workspaces', wsId, 'invites');
    const unsub = onSnapshot(
      ref,
      (snap) => setState({ invites: snap.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false }),
      (err) => {
        console.error('[useInvites]', err);
        setState({ invites: [], loading: false });
      },
    );
    return unsub;
  }, [db, appId, wsId]);

  return state;
}
```

- [ ] **Step 4: Create `src/hooks/useAcceptInvite.js`**

Maneja los 7 estados de InviteLandingScreen como una FSM:

```js
import { useEffect, useState } from 'react';
import { useFirebase } from '../contexts/FirebaseContext';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { createMembersService } from '../services/membersService';

// Estados: 'idle' | 'loading' | 'needsAuth' | 'success' | 'notFound' | 'expired' | 'alreadyMember' | 'error'
export function useAcceptInvite({ wsId, inviteId, autoAccept = true }) {
  const { app, db, appId } = useFirebase();
  const { user, authReady } = useAuth();
  const [state, setState] = useState({ status: 'loading', workspaceName: null, mismatched: false, error: null });

  useEffect(() => {
    if (!authReady || !db || !appId || !wsId || !inviteId) return;
    let cancelled = false;

    (async () => {
      try {
        // Read invite (member-readable). If not signed in, attempt fails — pivot to needsAuth.
        const inviteSnap = await getDoc(doc(db, 'artifacts', appId, 'workspaces', wsId, 'invites', inviteId));
        if (cancelled) return;

        if (!user) {
          setState({ status: 'needsAuth', workspaceName: null, mismatched: false, error: null });
          return;
        }
        if (!inviteSnap.exists()) {
          setState({ status: 'notFound', workspaceName: null, mismatched: false, error: null });
          return;
        }

        // Look up workspace name
        const wsSnap = await getDoc(doc(db, 'artifacts', appId, 'workspaces', wsId));
        const workspaceName = wsSnap.exists() ? wsSnap.data().name : null;
        if (cancelled) return;

        if (!autoAccept) {
          setState({ status: 'idle', workspaceName, mismatched: false, error: null });
          return;
        }

        const svc = createMembersService({ app });
        try {
          const r = await svc.acceptInvite({ wsId, inviteId });
          const inviteEmail = inviteSnap.data().inviteEmail;
          const mismatched = inviteEmail && inviteEmail !== (user.email || '');
          setState({ status: 'success', workspaceName, mismatched: !!mismatched, error: null, claimedWsId: r.wsId });
        } catch (err) {
          if (cancelled) return;
          const code = err?.code || '';
          if (code === 'functions/not-found')
            setState({ status: 'notFound', workspaceName, mismatched: false, error: null });
          else if (code === 'functions/failed-precondition')
            setState({ status: 'expired', workspaceName, mismatched: false, error: null });
          else if (code === 'functions/already-exists')
            setState({ status: 'alreadyMember', workspaceName, mismatched: false, error: null });
          else
            setState({ status: 'error', workspaceName, mismatched: false, error: err?.message || 'Error inesperado' });
        }
      } catch (err) {
        if (!cancelled)
          setState({
            status: 'error',
            workspaceName: null,
            mismatched: false,
            error: err?.message || 'Error inesperado',
          });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, app, db, appId, user, wsId, inviteId, autoAccept]);

  return state;
}
```

- [ ] **Step 5: Commit**

```powershell
git add src/hooks/useClubAllowlist.js src/hooks/useMembers.js src/hooks/useInvites.js src/hooks/useAcceptInvite.js
git commit -m "feat(sub3-ui): hooks (allowlist, members, invites, acceptInvite FSM)"
```

---

### Task 21: WorkspaceSelector dropdown (TDD, 4 tests)

**Files:**

- Create: `src/shell/WorkspaceSelector.jsx`
- Create: `src/shell/WorkspaceSelector.test.jsx`

- [ ] **Step 1: Write failing tests `src/shell/WorkspaceSelector.test.jsx`**

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceSelector } from './WorkspaceSelector';

vi.mock('../contexts/WorkspaceContext', () => ({
  useWorkspace: vi.fn(),
}));
vi.mock('../hooks/useClubAllowlist', () => ({
  useClubAllowlist: vi.fn(),
}));

import { useWorkspace } from '../contexts/WorkspaceContext';
import { useClubAllowlist } from '../hooks/useClubAllowlist';

describe('WorkspaceSelector', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders all memberships in dropdown', () => {
    useWorkspace.mockReturnValue({
      memberships: [
        { wsId: 'ws-personal', workspaceName: 'Mi cuenta', workspaceType: 'personal' },
        { wsId: 'ws-club', workspaceName: 'Uros de Rivas', workspaceType: 'club' },
      ],
      activeWsId: 'ws-personal',
      setActiveWorkspace: vi.fn(),
    });
    useClubAllowlist.mockReturnValue({ allowed: false, loading: false });
    render(<WorkspaceSelector />);
    fireEvent.click(screen.getByRole('button', { name: /mi cuenta/i }));
    expect(screen.getByText('Uros de Rivas')).toBeInTheDocument();
  });

  it('clicking another workspace calls setActiveWorkspace', () => {
    const setActive = vi.fn();
    useWorkspace.mockReturnValue({
      memberships: [
        { wsId: 'ws-personal', workspaceName: 'Mi cuenta', workspaceType: 'personal' },
        { wsId: 'ws-club', workspaceName: 'Uros', workspaceType: 'club' },
      ],
      activeWsId: 'ws-personal',
      setActiveWorkspace: setActive,
    });
    useClubAllowlist.mockReturnValue({ allowed: false, loading: false });
    render(<WorkspaceSelector />);
    fireEvent.click(screen.getByRole('button', { name: /mi cuenta/i }));
    fireEvent.click(screen.getByText('Uros'));
    expect(setActive).toHaveBeenCalledWith('ws-club');
  });

  it('shows "+ Crear workspace de club" when allowlisted', () => {
    useWorkspace.mockReturnValue({
      memberships: [{ wsId: 'ws-personal', workspaceName: 'Mi cuenta', workspaceType: 'personal' }],
      activeWsId: 'ws-personal',
      setActiveWorkspace: vi.fn(),
    });
    useClubAllowlist.mockReturnValue({ allowed: true, loading: false });
    render(<WorkspaceSelector />);
    fireEvent.click(screen.getByRole('button', { name: /mi cuenta/i }));
    expect(screen.getByText(/crear workspace de club/i)).toBeInTheDocument();
  });

  it('hides "+ Crear" when NOT allowlisted', () => {
    useWorkspace.mockReturnValue({
      memberships: [{ wsId: 'ws-personal', workspaceName: 'Mi cuenta', workspaceType: 'personal' }],
      activeWsId: 'ws-personal',
      setActiveWorkspace: vi.fn(),
    });
    useClubAllowlist.mockReturnValue({ allowed: false, loading: false });
    render(<WorkspaceSelector />);
    fireEvent.click(screen.getByRole('button', { name: /mi cuenta/i }));
    expect(screen.queryByText(/crear workspace de club/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement `src/shell/WorkspaceSelector.jsx`**

```jsx
import React, { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useClubAllowlist } from '../hooks/useClubAllowlist';
import { CrearClubModal } from './CrearClubModal';

export function WorkspaceSelector() {
  const { memberships, activeWsId, setActiveWorkspace } = useWorkspace();
  const { allowed } = useClubAllowlist();
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const active = memberships.find((m) => m.wsId === activeWsId);
  if (!active) return null;

  const onPick = (wsId) => {
    setActiveWorkspace(wsId);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 text-sm font-medium text-slate-700"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>{active.workspaceName}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-2"
        >
          {memberships.map((m) => (
            <button
              key={m.wsId}
              role="menuitem"
              type="button"
              onClick={() => onPick(m.wsId)}
              className={`w-full text-left px-3 py-2 hover:bg-slate-50 text-sm ${m.wsId === activeWsId ? 'font-semibold text-blue-700' : 'text-slate-700'}`}
            >
              <span className="block">{m.workspaceName}</span>
              <span className="block text-xs text-slate-400">{m.workspaceType === 'club' ? 'Club' : 'Personal'}</span>
            </button>
          ))}
          {allowed && (
            <>
              <div className="border-t border-slate-100 my-1" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setShowModal(true);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm text-blue-700 flex items-center gap-2"
              >
                <Plus size={14} aria-hidden="true" /> Crear workspace de club
              </button>
            </>
          )}
        </div>
      )}
      {showModal && <CrearClubModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
```

- [ ] **Step 4: Run; PASS 4/4.**
- [ ] **Step 5: Commit**

```powershell
git add src/shell/WorkspaceSelector.jsx src/shell/WorkspaceSelector.test.jsx
git commit -m "feat(sub3-ui): WorkspaceSelector dropdown (TDD, 4 tests)"
```

---

### Task 22: CrearClubModal (TDD, 3 tests)

**Files:**

- Create: `src/shell/CrearClubModal.jsx`
- Create: `src/shell/CrearClubModal.test.jsx`

- [ ] **Step 1: Write failing tests**

```jsx
// src/shell/CrearClubModal.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CrearClubModal } from './CrearClubModal';

const mockCreateClub = vi.fn();
vi.mock('../services/membersService', () => ({
  createMembersService: () => ({ createClub: (...a) => mockCreateClub(...a) }),
}));
vi.mock('../contexts/FirebaseContext', () => ({ useFirebase: () => ({ app: {} }) }));
vi.mock('../contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ setActiveWorkspace: vi.fn() }),
}));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}));

describe('CrearClubModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClub.mockResolvedValue({ wsId: 'ws-new' });
  });

  it('disables submit when name empty', () => {
    render(<CrearClubModal onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /crear/i })).toBeDisabled();
  });

  it('submits with trimmed name and closes', async () => {
    const onClose = vi.fn();
    render(<CrearClubModal onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: '  Uros de Rivas  ' } });
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    await waitFor(() => expect(mockCreateClub).toHaveBeenCalledWith({ name: 'Uros de Rivas' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows error message on permission-denied', async () => {
    mockCreateClub.mockRejectedValueOnce({ code: 'functions/permission-denied', message: 'no allowlist' });
    render(<CrearClubModal onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    await waitFor(() => expect(screen.getByText(/no.*disponible/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement `src/shell/CrearClubModal.jsx`**

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useToast } from '../contexts/ToastContext';
import { createMembersService } from '../services/membersService';

export function CrearClubModal({ onClose }) {
  const { app } = useFirebase();
  const { setActiveWorkspace } = useWorkspace();
  const { push } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const trimmed = name.trim();
  const disabled = submitting || trimmed.length === 0 || trimmed.length > 80;

  async function onSubmit(e) {
    e.preventDefault();
    if (disabled) return;
    setSubmitting(true);
    setError(null);
    try {
      const svc = createMembersService({ app });
      const { wsId } = await svc.createClub({ name: trimmed });
      setActiveWorkspace(wsId);
      push({ message: 'Workspace de club creado.', tone: 'success' });
      onClose();
      navigate('/area-privada');
    } catch (err) {
      const code = err?.code || '';
      if (code.endsWith('permission-denied')) setError('Workspace de club no disponible para esta cuenta.');
      else setError(err?.message || 'Error al crear el workspace.');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crear-club-title"
    >
      <form onSubmit={onSubmit} className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 id="crear-club-title" className="text-lg font-semibold text-slate-900">
            Crear workspace de club
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Un club agrupa varios entrenadores bajo una misma estructura. Tú serás el propietario y podrás invitar a tu
          staff después.
        </p>
        <label htmlFor="club-name" className="block text-sm font-medium text-slate-700 mb-1">
          Nombre
        </label>
        <input
          id="club-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Uros de Rivas"
          maxLength={80}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={disabled}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run; PASS 3/3.**
- [ ] **Step 5: Commit**

```powershell
git add src/shell/CrearClubModal.jsx src/shell/CrearClubModal.test.jsx
git commit -m "feat(sub3-ui): CrearClubModal (TDD, 3 tests)"
```

---

### Task 23: MembersScreen + sub-componentes (TDD, 8 tests)

**Files:**

- Create: `src/screens/settings/MembersScreen.jsx`
- Create: `src/screens/settings/MembersScreen.test.jsx`
- Create: `src/screens/settings/InviteMemberModal.jsx`
- Create: `src/screens/settings/InviteSuccessModal.jsx`
- Create: `src/screens/settings/MemberActionMenu.jsx`

Pantalla principal de gestión. La separamos en 4 archivos para que cada uno quede <150 LOC. La regla de access se aplica en `MembersScreen` (computa `callerRole` y pasa `canEdit` a sub-componentes).

- [ ] **Step 1: Write failing tests `src/screens/settings/MembersScreen.test.jsx`**

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MembersScreen } from './MembersScreen';

vi.mock('../../contexts/WorkspaceContext', () => ({ useWorkspace: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/FirebaseContext', () => ({ useFirebase: () => ({ app: {} }) }));
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('../../hooks/useMembers', () => ({ useMembers: vi.fn() }));
vi.mock('../../hooks/useInvites', () => ({ useInvites: vi.fn() }));
vi.mock('../../hooks/useTeams', () => ({
  useTeams: vi.fn(() => ({ teams: [{ id: 't1', name: 'Cadete A' }], loading: false })),
}));

const mockSvc = {
  inviteMember: vi.fn(),
  revokeInvite: vi.fn(),
  revokeMember: vi.fn(),
  setMemberTeams: vi.fn(),
  setMemberRole: vi.fn(),
};
vi.mock('../../services/membersService', () => ({ createMembersService: () => mockSvc }));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}));

import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMembers } from '../../hooks/useMembers';
import { useInvites } from '../../hooks/useInvites';

const CLUB_WS = { wsId: 'ws-club', type: 'club', name: 'Uros', ownerId: 'uid-owner' };

function setupAs(role) {
  const callerUid = role === 'owner' ? 'uid-owner' : role === 'dt' ? 'uid-dt' : 'uid-coach';
  useWorkspace.mockReturnValue({ activeWsId: 'ws-club', activeWorkspace: CLUB_WS });
  useAuth.mockReturnValue({ user: { uid: callerUid } });
  useMembers.mockReturnValue({
    members: [
      { uid: 'uid-owner', role: 'dt', displayName: 'Sergio', email: 's@x', assignedTeamIds: ['t1'] },
      { uid: 'uid-dt', role: 'dt', displayName: 'María', email: 'm@x', assignedTeamIds: ['t1'] },
      { uid: 'uid-coach', role: 'coach', displayName: 'Pepe', email: 'p@x', assignedTeamIds: ['t1'] },
    ],
    loading: false,
  });
  useInvites.mockReturnValue({
    invites: [
      {
        id: 'inv-1',
        inviteEmail: 'nuevo@x',
        inviteName: 'Nuevo',
        role: 'coach',
        assignedTeamIds: ['t1'],
        expiresAt: { toDate: () => new Date(Date.now() + 86_400_000 * 3) },
      },
    ],
    loading: false,
  });
}

describe('MembersScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders owner+DT+coach with badges', () => {
    setupAs('owner');
    render(<MembersScreen />);
    expect(screen.getByText('Sergio')).toBeInTheDocument();
    expect(screen.getByText('María')).toBeInTheDocument();
    expect(screen.getByText('Pepe')).toBeInTheDocument();
    expect(screen.getByText(/propietario/i)).toBeInTheDocument();
  });

  it('owner sees actions on every row except own', () => {
    setupAs('owner');
    render(<MembersScreen />);
    // Action menu buttons (one per editable member: María, Pepe). Owner row no menu.
    expect(screen.getAllByRole('button', { name: /acciones/i })).toHaveLength(2);
  });

  it('coach sees read-only (no action menus)', () => {
    setupAs('coach');
    render(<MembersScreen />);
    expect(screen.queryAllByRole('button', { name: /acciones/i })).toHaveLength(0);
  });

  it('opens invite modal and submits', async () => {
    setupAs('owner');
    mockSvc.inviteMember.mockResolvedValue({ inviteId: 'inv-X', link: 'https://app.com/invite/ws-club/inv-X' });
    render(<MembersScreen />);
    fireEvent.click(screen.getByRole('button', { name: /invitar/i }));
    fireEvent.click(screen.getByLabelText(/coach/i));
    fireEvent.click(screen.getByLabelText(/cadete a/i));
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));
    await waitFor(() =>
      expect(mockSvc.inviteMember).toHaveBeenCalledWith(
        expect.objectContaining({
          wsId: 'ws-club',
          role: 'coach',
          assignedTeamIds: ['t1'],
        }),
      ),
    );
    // Success modal with copy button
    expect(await screen.findByText(/copiar/i)).toBeInTheDocument();
  });

  it('cancels a pending invite', async () => {
    setupAs('owner');
    mockSvc.revokeInvite.mockResolvedValue({ ok: true });
    render(<MembersScreen />);
    fireEvent.click(screen.getByRole('button', { name: /cancelar.*invit/i }));
    await waitFor(() => expect(mockSvc.revokeInvite).toHaveBeenCalledWith({ wsId: 'ws-club', inviteId: 'inv-1' }));
  });

  it('revokes a member after confirm', async () => {
    setupAs('owner');
    mockSvc.revokeMember.mockResolvedValue({ ok: true });
    render(<MembersScreen />);
    // Open Pepe's menu (last)
    const menus = screen.getAllByRole('button', { name: /acciones/i });
    fireEvent.click(menus[menus.length - 1]);
    fireEvent.click(screen.getByText(/revocar acceso/i));
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() => expect(mockSvc.revokeMember).toHaveBeenCalledWith({ wsId: 'ws-club', memberUid: 'uid-coach' }));
  });

  it('edits assigned teams on a member', async () => {
    setupAs('owner');
    mockSvc.setMemberTeams.mockResolvedValue({ ok: true });
    render(<MembersScreen />);
    const menus = screen.getAllByRole('button', { name: /acciones/i });
    fireEvent.click(menus[menus.length - 1]);
    fireEvent.click(screen.getByText(/editar equipos/i));
    // Toggle team off
    fireEvent.click(screen.getByLabelText(/cadete a/i));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() =>
      expect(mockSvc.setMemberTeams).toHaveBeenCalledWith({
        wsId: 'ws-club',
        memberUid: 'uid-coach',
        assignedTeamIds: [],
      }),
    );
  });

  it('changes member role with confirmation', async () => {
    setupAs('owner');
    mockSvc.setMemberRole.mockResolvedValue({ ok: true });
    render(<MembersScreen />);
    const menus = screen.getAllByRole('button', { name: /acciones/i });
    fireEvent.click(menus[menus.length - 1]);
    fireEvent.click(screen.getByText(/cambiar rol/i));
    fireEvent.click(screen.getByLabelText(/dt/i));
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() =>
      expect(mockSvc.setMemberRole).toHaveBeenCalledWith({ wsId: 'ws-club', memberUid: 'uid-coach', role: 'dt' }),
    );
  });
});
```

- [ ] **Step 2: Run; expect FAIL.**

- [ ] **Step 3: Implement `src/screens/settings/InviteMemberModal.jsx`**

```jsx
import React, { useState } from 'react';
import { X } from 'lucide-react';

export function InviteMemberModal({ teams, onClose, onSubmit, submitting }) {
  const [role, setRole] = useState('coach');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState(null);

  const togglePick = (id) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const disabled = submitting || (role === 'coach' && picked.length === 0);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit({ role, email: email.trim() || null, name: name.trim() || null, assignedTeamIds: picked });
    } catch (err) {
      setError(err?.message || 'Error');
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <form onSubmit={submit} className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-semibold">Invitar al staff</h2>
          <button type="button" aria-label="Cerrar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <fieldset className="mb-3">
          <legend className="text-sm font-medium mb-1">Rol</legend>
          <label className="inline-flex items-center gap-2 mr-4">
            <input type="radio" name="role" checked={role === 'coach'} onChange={() => setRole('coach')} /> Coach
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="role" checked={role === 'dt'} onChange={() => setRole('dt')} /> DT
          </label>
        </fieldset>
        <label className="block text-sm mb-1">Email (opcional)</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 border rounded px-2 py-1"
        />
        <label className="block text-sm mb-1">Nombre (opcional)</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mb-3 border rounded px-2 py-1"
        />
        <fieldset className="mb-3">
          <legend className="text-sm font-medium mb-1">
            Equipos asignados {role === 'coach' && <span className="text-red-500">*</span>}
          </legend>
          {teams.map((t) => (
            <label key={t.id} className="flex items-center gap-2 py-1">
              <input type="checkbox" checked={picked.includes(t.id)} onChange={() => togglePick(t.id)} /> {t.name}
            </label>
          ))}
        </fieldset>
        {error && (
          <p className="text-red-600 text-sm" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={disabled}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-40"
          >
            {submitting ? 'Generando...' : 'Generar invitación'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Implement `src/screens/settings/InviteSuccessModal.jsx`**

```jsx
import React, { useState } from 'react';
import { Copy, Check, X } from 'lucide-react';

export function InviteSuccessModal({ link, onClose }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }
  return (
    <div
      className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between mb-3">
          <h2 className="text-lg font-semibold">Invitación creada</h2>
          <button type="button" aria-label="Cerrar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-3">Comparte este enlace por WhatsApp o email. Caduca en 7 días.</p>
        <div className="flex gap-2 items-center bg-slate-50 border border-slate-200 rounded p-2 mb-4">
          <code className="text-xs text-slate-700 truncate flex-1">{link}</code>
          <button
            type="button"
            onClick={copy}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded inline-flex items-center gap-1"
            aria-label="Copiar al portapapeles"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm bg-slate-100 rounded">
            Hecho
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement `src/screens/settings/MemberActionMenu.jsx`**

```jsx
import React, { useState } from 'react';
import { MoreVertical } from 'lucide-react';

export function MemberActionMenu({ member, teams, onChangeRole, onEditTeams, onRevoke }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(null); // 'role' | 'teams' | 'revoke' | null
  const [pickedTeams, setPickedTeams] = useState(member.assignedTeamIds);
  const [pickedRole, setPickedRole] = useState(member.role);

  return (
    <>
      <button
        type="button"
        aria-label="Acciones"
        onClick={() => setOpen((v) => !v)}
        className="p-1 hover:bg-slate-100 rounded"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div role="menu" className="absolute mt-1 w-48 bg-white border border-slate-200 rounded shadow-lg z-40">
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              setModal('role');
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
          >
            Cambiar rol
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              setModal('teams');
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
          >
            Editar equipos
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              setModal('revoke');
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-red-600"
          >
            Revocar acceso
          </button>
        </div>
      )}

      {modal === 'role' && (
        <ConfirmModal
          title="Cambiar rol"
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            await onChangeRole(pickedRole);
            setModal(null);
          }}
        >
          <p className="text-sm text-slate-600 mb-2">
            Si bajas a Coach, perderá acceso club-wide a la biblioteca de ejercicios.
          </p>
          <label className="block py-1">
            <input type="radio" name="role" checked={pickedRole === 'dt'} onChange={() => setPickedRole('dt')} /> DT
          </label>
          <label className="block py-1">
            <input type="radio" name="role" checked={pickedRole === 'coach'} onChange={() => setPickedRole('coach')} />{' '}
            Coach
          </label>
        </ConfirmModal>
      )}
      {modal === 'teams' && (
        <ConfirmModal
          title="Editar equipos asignados"
          confirmLabel="Guardar"
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            await onEditTeams(pickedTeams);
            setModal(null);
          }}
        >
          {teams.map((t) => (
            <label key={t.id} className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={pickedTeams.includes(t.id)}
                onChange={() =>
                  setPickedTeams((cur) => (cur.includes(t.id) ? cur.filter((x) => x !== t.id) : [...cur, t.id]))
                }
              />{' '}
              {t.name}
            </label>
          ))}
        </ConfirmModal>
      )}
      {modal === 'revoke' && (
        <ConfirmModal
          title="Revocar acceso"
          tone="danger"
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            await onRevoke();
            setModal(null);
          }}
        >
          <p className="text-sm text-slate-600">
            Sus contribuciones se mantienen pero firmadas con su nombre. Acción irreversible.
          </p>
        </ConfirmModal>
      )}
    </>
  );
}

function ConfirmModal({ title, children, onCancel, onConfirm, tone, confirmLabel = 'Confirmar' }) {
  const [loading, setLoading] = useState(false);
  async function submit() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }
  return (
    <div
      className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
        <h3 className="text-base font-semibold mb-2">{title}</h3>
        {children}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onCancel} className="px-3 py-1 text-sm">
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className={`px-3 py-1 text-sm rounded text-white ${tone === 'danger' ? 'bg-red-600' : 'bg-blue-600'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Implement `src/screens/settings/MembersScreen.jsx`**

```jsx
import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFirebase } from '../../contexts/FirebaseContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';
import { useMembers } from '../../hooks/useMembers';
import { useInvites } from '../../hooks/useInvites';
import { useTeams } from '../../hooks/useTeams';
import { createMembersService } from '../../services/membersService';
import { InviteMemberModal } from './InviteMemberModal';
import { InviteSuccessModal } from './InviteSuccessModal';
import { MemberActionMenu } from './MemberActionMenu';

function daysUntil(ts) {
  if (!ts?.toDate) return '—';
  const ms = ts.toDate().getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function MembersScreen() {
  const { app } = useFirebase();
  const { user } = useAuth();
  const { activeWsId, activeWorkspace } = useWorkspace();
  const { push } = useToast();
  const navigate = useNavigate();
  const { members } = useMembers(activeWsId);
  const { invites } = useInvites(activeWsId);
  const { teams } = useTeams();

  const svc = useMemo(() => createMembersService({ app }), [app]);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [successLink, setSuccessLink] = useState(null);

  if (!activeWorkspace || activeWorkspace.type !== 'club') {
    // Should never render — guarded at router level. Defensive redirect.
    return null;
  }

  const callerUid = user?.uid;
  const ownerUid = activeWorkspace.ownerId;
  const callerIsOwner = callerUid === ownerUid;
  const callerMember = members.find((m) => m.uid === callerUid);
  const callerIsDt = callerMember?.role === 'dt';
  const canEdit = callerIsOwner || callerIsDt;

  async function handleInvite(payload) {
    setInviteSubmitting(true);
    try {
      const r = await svc.inviteMember({ wsId: activeWsId, ...payload });
      setShowInvite(false);
      setSuccessLink(r.link);
    } catch (err) {
      push({ message: err?.message || 'Error al crear invitación', tone: 'error' });
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function handleRevokeInvite(inviteId) {
    try {
      await svc.revokeInvite({ wsId: activeWsId, inviteId });
      push({ message: 'Invitación cancelada', tone: 'success' });
    } catch (err) {
      push({ message: err?.message || 'Error', tone: 'error' });
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="flex justify-between items-baseline mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Miembros del club</h1>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
          >
            Invitar al staff
          </button>
        )}
      </header>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Miembros activos</h2>
        <ul className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {members.map((m) => {
            const isOwner = m.uid === ownerUid;
            const isCallerRow = m.uid === callerUid;
            const editable = canEdit && !isOwner;
            return (
              <li key={m.uid} className="px-4 py-3 flex items-center justify-between relative">
                <div>
                  <p className="text-sm font-medium text-slate-900">{m.displayName || m.email}</p>
                  <p className="text-xs text-slate-500">{m.email}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] uppercase tracking-wide bg-slate-100 px-2 py-0.5 rounded">
                      {m.role}
                    </span>
                    {isOwner && (
                      <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                        Propietario
                      </span>
                    )}
                  </div>
                </div>
                {editable && (
                  <MemberActionMenu
                    member={m}
                    teams={teams}
                    onChangeRole={async (role) => {
                      await svc.setMemberRole({ wsId: activeWsId, memberUid: m.uid, role });
                    }}
                    onEditTeams={async (assignedTeamIds) => {
                      await svc.setMemberTeams({ wsId: activeWsId, memberUid: m.uid, assignedTeamIds });
                    }}
                    onRevoke={async () => {
                      await svc.revokeMember({ wsId: activeWsId, memberUid: m.uid });
                    }}
                  />
                )}
                {isCallerRow && callerIsOwner && (
                  <Link
                    to="/area-privada/settings/transferir-propiedad"
                    className="text-xs text-blue-700 hover:underline"
                  >
                    Transferir propiedad
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Invitaciones pendientes ({invites.length})
        </h2>
        <ul className="space-y-2">
          {invites.map((inv) => (
            <li
              key={inv.id}
              className="bg-white rounded-lg border border-slate-200 p-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium">
                  {inv.inviteName || inv.inviteEmail || '(sin nombre)'}{' '}
                  <span className="text-xs text-slate-400">· {inv.role}</span>
                </p>
                <p className="text-xs text-slate-500">Caduca en {daysUntil(inv.expiresAt)} días</p>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard?.writeText(`${window.location.origin}/invite/${activeWsId}/${inv.id}`)
                    }
                    className="text-xs text-blue-700 hover:underline"
                  >
                    Copiar link
                  </button>
                  <button
                    type="button"
                    aria-label="Cancelar invitación"
                    onClick={() => handleRevokeInvite(inv.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {showInvite && (
        <InviteMemberModal
          teams={teams}
          submitting={inviteSubmitting}
          onClose={() => setShowInvite(false)}
          onSubmit={handleInvite}
        />
      )}
      {successLink && <InviteSuccessModal link={successLink} onClose={() => setSuccessLink(null)} />}
    </div>
  );
}

export default MembersScreen;
```

- [ ] **Step 7: Run; PASS 8/8.**
- [ ] **Step 8: Commit**

```powershell
git add src/screens/settings/MembersScreen.jsx src/screens/settings/MembersScreen.test.jsx src/screens/settings/InviteMemberModal.jsx src/screens/settings/InviteSuccessModal.jsx src/screens/settings/MemberActionMenu.jsx
git commit -m "feat(sub3-ui): MembersScreen + sub-componentes (TDD, 8 tests)"
```

---

### Task 24: TransferOwnershipScreen (TDD, 3 tests)

**Files:**

- Create: `src/screens/settings/TransferOwnershipScreen.jsx`
- Create: `src/screens/settings/TransferOwnershipScreen.test.jsx`

- [ ] **Step 1: Write failing tests**

```jsx
// src/screens/settings/TransferOwnershipScreen.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransferOwnershipScreen } from './TransferOwnershipScreen';

vi.mock('../../contexts/WorkspaceContext', () => ({ useWorkspace: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/FirebaseContext', () => ({ useFirebase: () => ({ app: {} }) }));
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock('../../hooks/useMembers', () => ({ useMembers: vi.fn() }));
const mockTransfer = vi.fn();
vi.mock('../../services/membersService', () => ({
  createMembersService: () => ({ transferOwnership: (...a) => mockTransfer(...a) }),
}));
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}));

import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMembers } from '../../hooks/useMembers';

function setupAsOwner() {
  useWorkspace.mockReturnValue({
    activeWsId: 'ws-club',
    activeWorkspace: { wsId: 'ws-club', type: 'club', name: 'Uros', ownerId: 'uid-owner' },
  });
  useAuth.mockReturnValue({ user: { uid: 'uid-owner' } });
  useMembers.mockReturnValue({
    members: [
      { uid: 'uid-owner', displayName: 'Sergio' },
      { uid: 'uid-other', displayName: 'María' },
    ],
    loading: false,
  });
}

describe('TransferOwnershipScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submit disabled until typing club name exactly', () => {
    setupAsOwner();
    render(<TransferOwnershipScreen />);
    fireEvent.click(screen.getByLabelText(/maría/i));
    const input = screen.getByPlaceholderText('Uros');
    fireEvent.change(input, { target: { value: 'Uros wrong' } });
    expect(screen.getByRole('button', { name: /transferir/i })).toBeDisabled();
    fireEvent.change(input, { target: { value: 'Uros' } });
    expect(screen.getByRole('button', { name: /transferir/i })).toBeEnabled();
  });

  it('submit calls transferOwnership', async () => {
    setupAsOwner();
    mockTransfer.mockResolvedValue({ ok: true });
    render(<TransferOwnershipScreen />);
    fireEvent.click(screen.getByLabelText(/maría/i));
    fireEvent.change(screen.getByPlaceholderText('Uros'), { target: { value: 'Uros' } });
    fireEvent.click(screen.getByRole('button', { name: /transferir/i }));
    await waitFor(() => expect(mockTransfer).toHaveBeenCalledWith({ wsId: 'ws-club', newOwnerUid: 'uid-other' }));
  });

  it('non-owner sees redirect notice (renders nothing actionable)', () => {
    useWorkspace.mockReturnValue({
      activeWsId: 'ws-club',
      activeWorkspace: { wsId: 'ws-club', type: 'club', name: 'Uros', ownerId: 'uid-other' },
    });
    useAuth.mockReturnValue({ user: { uid: 'uid-not-owner' } });
    useMembers.mockReturnValue({ members: [], loading: false });
    render(<TransferOwnershipScreen />);
    expect(screen.queryByRole('button', { name: /transferir/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement `src/screens/settings/TransferOwnershipScreen.jsx`**

```jsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirebase } from '../../contexts/FirebaseContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';
import { useMembers } from '../../hooks/useMembers';
import { createMembersService } from '../../services/membersService';

export function TransferOwnershipScreen() {
  const { app } = useFirebase();
  const { user } = useAuth();
  const { activeWsId, activeWorkspace } = useWorkspace();
  const { push } = useToast();
  const { members } = useMembers(activeWsId);
  const navigate = useNavigate();
  const [pickedUid, setPickedUid] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const svc = useMemo(() => createMembersService({ app }), [app]);
  const isOwner = activeWorkspace?.ownerId === user?.uid;

  if (!activeWorkspace || activeWorkspace.type !== 'club' || !isOwner) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <p className="text-sm text-slate-600">Solo el propietario del club puede transferir la propiedad.</p>
      </div>
    );
  }

  const candidates = members.filter((m) => m.uid !== user.uid);
  const matches = confirmText === activeWorkspace.name;
  const disabled = submitting || !pickedUid || !matches;

  async function submit() {
    if (disabled) return;
    setSubmitting(true);
    try {
      await svc.transferOwnership({ wsId: activeWsId, newOwnerUid: pickedUid });
      push({ message: 'Propiedad transferida.', tone: 'success' });
      navigate('/area-privada/settings/miembros');
    } catch (err) {
      push({ message: err?.message || 'Error', tone: 'error' });
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Transferir propiedad</h1>
      <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3 rounded mb-4">
        <p className="font-medium mb-1">Lee antes de continuar:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>El nuevo propietario tendrá control total: billing, ajustes y eliminar el workspace.</li>
          <li>Tu rol bajará a DT (puedes ser revocado o cambiar de rol después).</li>
          <li>Acción irreversible. Para volver, el nuevo propietario tendría que devolverte la propiedad.</li>
        </ul>
      </div>

      <fieldset className="mb-4">
        <legend className="text-sm font-medium mb-2">Nuevo propietario</legend>
        {candidates.length === 0 ? (
          <p className="text-sm text-slate-500">No hay otros miembros en el club. Invita a alguien antes.</p>
        ) : (
          candidates.map((m) => (
            <label key={m.uid} className="flex items-center gap-2 py-1">
              <input type="radio" name="newOwner" checked={pickedUid === m.uid} onChange={() => setPickedUid(m.uid)} />
              <span>{m.displayName || m.email}</span>
            </label>
          ))
        )}
      </fieldset>

      <label className="block text-sm font-medium mb-1">
        Para confirmar, escribe el nombre del workspace: <code className="text-blue-700">{activeWorkspace.name}</code>
      </label>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={activeWorkspace.name}
        className="w-full mb-4 px-3 py-2 border border-slate-300 rounded"
      />

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 text-sm">
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded disabled:opacity-40"
        >
          {submitting ? 'Transfiriendo...' : 'Transferir propiedad'}
        </button>
      </div>
    </div>
  );
}

export default TransferOwnershipScreen;
```

- [ ] **Step 4: Run; PASS 3/3.**
- [ ] **Step 5: Commit**

```powershell
git add src/screens/settings/TransferOwnershipScreen.jsx src/screens/settings/TransferOwnershipScreen.test.jsx
git commit -m "feat(sub3-ui): TransferOwnershipScreen typing-confirm (TDD, 3 tests)"
```

---

### Task 25: InviteLandingScreen claim flow (TDD, 6 tests)

**Files:**

- Create: `src/screens/InviteLandingScreen.jsx`
- Create: `src/screens/InviteLandingScreen.test.jsx`

- [ ] **Step 1: Write failing tests**

```jsx
// src/screens/InviteLandingScreen.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InviteLandingScreen } from './InviteLandingScreen';

vi.mock('../hooks/useAcceptInvite', () => ({ useAcceptInvite: vi.fn() }));
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: () => ({ wsId: 'ws-1', inviteId: 'inv-1' }),
  Link: ({ to, children }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

import { useAcceptInvite } from '../hooks/useAcceptInvite';

function r() {
  render(<InviteLandingScreen />);
}

describe('InviteLandingScreen', () => {
  it('loading', () => {
    useAcceptInvite.mockReturnValue({ status: 'loading' });
    r();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('needsAuth → CTA registro/login', () => {
    useAcceptInvite.mockReturnValue({ status: 'needsAuth', workspaceName: 'Uros' });
    r();
    expect(screen.getByRole('link', { name: /iniciar sesión|registrar/i })).toBeInTheDocument();
  });

  it('success', () => {
    useAcceptInvite.mockReturnValue({
      status: 'success',
      workspaceName: 'Uros',
      mismatched: false,
      claimedWsId: 'ws-1',
    });
    r();
    expect(screen.getByText(/bienvenido.*uros/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /entrar al workspace/i })).toBeInTheDocument();
  });

  it('success with email mismatch shows hint', () => {
    useAcceptInvite.mockReturnValue({
      status: 'success',
      workspaceName: 'Uros',
      mismatched: true,
      claimedWsId: 'ws-1',
    });
    r();
    expect(screen.getByText(/destinad/i)).toBeInTheDocument();
  });

  it('notFound', () => {
    useAcceptInvite.mockReturnValue({ status: 'notFound' });
    r();
    expect(screen.getByText(/ya no es válid/i)).toBeInTheDocument();
  });

  it('expired', () => {
    useAcceptInvite.mockReturnValue({ status: 'expired' });
    r();
    expect(screen.getByText(/caducad/i)).toBeInTheDocument();
  });
});
```

(Total: 6 tests — los 7 estados de la spec se cubren con loading + needsAuth + success + success+mismatch (cuenta como 1 test del estado success + sub-caso) + notFound + expired. `alreadyMember` y `error` se cubren en suites futuras si hace falta — el plan se queda en 6 declarados.)

- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement `src/screens/InviteLandingScreen.jsx`**

```jsx
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAcceptInvite } from '../hooks/useAcceptInvite';

export function InviteLandingScreen() {
  const { wsId, inviteId } = useParams();
  const state = useAcceptInvite({ wsId, inviteId });

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 max-w-md w-full p-8 text-center">
        {state.status === 'loading' && <p className="text-slate-500">Cargando invitación...</p>}

        {state.status === 'needsAuth' && (
          <>
            <h1 className="text-xl font-semibold mb-2">
              Has sido invitado{state.workspaceName ? ` a ${state.workspaceName}` : ''}
            </h1>
            <p className="text-sm text-slate-600 mb-4">Inicia sesión o regístrate para aceptar la invitación.</p>
            <Link
              to={`/login?redirect=${encodeURIComponent(`/invite/${wsId}/${inviteId}`)}`}
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded text-sm"
            >
              Iniciar sesión / Registrarme
            </Link>
          </>
        )}

        {state.status === 'success' && (
          <>
            <h1 className="text-xl font-semibold mb-2">Bienvenido a {state.workspaceName}</h1>
            {state.mismatched && (
              <p className="text-xs text-amber-700 mb-3">
                ⓘ Esta invitación estaba destinada a otro email. Has aceptado igualmente.
              </p>
            )}
            <Link to="/area-privada" className="inline-block px-4 py-2 bg-blue-600 text-white rounded text-sm">
              Entrar al workspace
            </Link>
          </>
        )}

        {state.status === 'notFound' && (
          <>
            <h1 className="text-xl font-semibold mb-2">Invitación no válida</h1>
            <p className="text-sm text-slate-600">Este enlace ya no es válido. Pídele al DT que te genere una nueva.</p>
          </>
        )}

        {state.status === 'expired' && (
          <>
            <h1 className="text-xl font-semibold mb-2">Invitación caducada</h1>
            <p className="text-sm text-slate-600">Esta invitación ha caducado. Pídele al DT que te genere una nueva.</p>
          </>
        )}

        {state.status === 'alreadyMember' && (
          <>
            <h1 className="text-xl font-semibold mb-2">Ya formas parte de {state.workspaceName}</h1>
            <Link to="/area-privada" className="inline-block px-4 py-2 bg-blue-600 text-white rounded text-sm">
              Ir al workspace
            </Link>
          </>
        )}

        {state.status === 'error' && (
          <>
            <h1 className="text-xl font-semibold mb-2">Algo salió mal</h1>
            <p className="text-sm text-slate-600">{state.error || 'Inténtalo de nuevo en unos minutos.'}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default InviteLandingScreen;
```

- [ ] **Step 4: Run; PASS 6/6.**
- [ ] **Step 5: Commit**

```powershell
git add src/screens/InviteLandingScreen.jsx src/screens/InviteLandingScreen.test.jsx
git commit -m "feat(sub3-ui): InviteLandingScreen 7-state FSM (TDD, 6 tests)"
```

---

### Task 26: AppRouter wiring + AppShell integration

**Files:**

- Modify: `src/shell/AppRouter.jsx`
- Modify: `src/shell/AppShell.jsx`

- [ ] **Step 1: Add lazy imports + 3 routes in `src/shell/AppRouter.jsx`**

Encima del `function ScrollToTop()` añadir:

```jsx
const MembersScreen = lazy(() => import('../screens/settings/MembersScreen'));
const TransferOwnershipScreen = lazy(() => import('../screens/settings/TransferOwnershipScreen'));
const InviteLandingScreen = lazy(() => import('../screens/InviteLandingScreen'));
```

Añadir tres `<Route>` (las dos privadas dentro del bloque autenticado, junto al de `/area-privada/settings`; la pública junto a `/exercise/:shareCode`):

```jsx
<Route
  path="/area-privada/settings/miembros"
  element={<Guarded name="Miembros"><MembersScreen /></Guarded>}
/>
<Route
  path="/area-privada/settings/transferir-propiedad"
  element={<Guarded name="Transferir propiedad"><TransferOwnershipScreen /></Guarded>}
/>
<Route
  path="/invite/:wsId/:inviteId"
  element={
    <Suspense fallback={<LazyFallback />}>
      <ModuleBoundary name="Invitación"><InviteLandingScreen /></ModuleBoundary>
    </Suspense>
  }
/>
```

Nota: `/invite/:wsId/:inviteId` queda fuera del `AuthGuard` — el componente decide si renderiza `needsAuth` y enlaza a `/login?redirect=...`.

- [ ] **Step 2: Mount `<WorkspaceSelector />` in `src/shell/AppShell.jsx`**

Localizar el header del shell (donde renderiza nav + user menu) y añadir `<WorkspaceSelector />` justo a la izquierda del menú de usuario. Inspeccionar `AppShell.jsx` para encontrar el slot exacto. Si el header no existe en este shell concreto (depende de la ruta), montar también en `DesktopSidebar.jsx`.

```jsx
import { WorkspaceSelector } from './WorkspaceSelector';
// ... dentro del header:
<WorkspaceSelector />;
```

- [ ] **Step 3: Run full project test suite + build**

```powershell
npm run lint
npm test
npm run build
```

Expected: Lint ok, tests verde (24 nuevos + previos), build sin warnings nuevos.

- [ ] **Step 4: Manual smoke local**

```powershell
npm run dev
```

Como super-admin: header debe mostrar dropdown con "Mi cuenta" + botón "+ Crear club". Crear "Club Test" → redirect a `/area-privada` → ir a `/area-privada/settings/miembros` → invitar coach con email ficticio + 1 team → modal de éxito con link copiable.

- [ ] **Step 5: Commit + push + PR**

```powershell
git add src/shell/AppRouter.jsx src/shell/AppShell.jsx
git commit -m "feat(sub3-ui): wire 3 routes + WorkspaceSelector en shell"
git push -u origin sub3-pr3-ui
gh pr create --base main --title "sub-proyecto 3 (PR #3) — UI: members + invites + transfer + claim" --body "$(cat <<'EOF'
## Summary
- WorkspaceSelector dropdown en header (gated por allowlist)
- CrearClubModal en shell
- MembersScreen + InviteMemberModal + InviteSuccessModal + MemberActionMenu
- TransferOwnershipScreen con typing-confirm
- InviteLandingScreen (ruta pública /invite/:wsId/:inviteId)
- 4 hooks (useClubAllowlist, useMembers, useInvites, useAcceptInvite)
- membersService callable wrappers
- ~24 tests RTL

Spec: docs/superpowers/specs/2026-05-04-sub-proyecto-3-invitaciones-y-licencias-design.md

## Test plan
- [x] vitest verde (24 nuevos)
- [x] eslint ok
- [x] vite build ok
- [x] smoke local: crear club + invitar + claim flow
- [ ] (deferred a PR #4) dogfood en producción con club real
EOF
)"
```

---

## PR #4 — Smoke + dogfood + observability

**Branch:** `sub3-pr4-dogfood`. Crear desde `main` después de mergear PR #3.

### Task 27: Dogfood E2E + runbooks + Cloud Logging dashboards

**Files:**

- Create: `docs/runbooks/sub-proyecto-3-dogfood.md`
- Create: `docs/runbooks/sub-proyecto-3-cloud-logging.md`

- [ ] **Step 1: Crear `docs/runbooks/sub-proyecto-3-dogfood.md`** (estructura mínima a rellenar durante el smoke real)

```markdown
# Sub-proyecto 3 — Dogfood E2E (Uros de Rivas)

**Fecha de ejecución:** YYYY-MM-DD
**Operador:** Sergio (super-admin)
**Coach de prueba:** [cuenta secundaria o coach real con consentimiento]
**Workspace creado:** `wsId = ____` (Uros de Rivas)

## Checklist E2E

- [ ] Login como super-admin → header muestra "+ Crear workspace de club".
- [ ] Crear "Uros de Rivas" → redirect a `/area-privada` con `activeWsId` correcto.
- [ ] Crear 1 team de prueba ("Cadete A").
- [ ] `/area-privada/settings/miembros` carga sin errores.
- [ ] Generar invite (rol coach, team Cadete A, email ficticio) → modal éxito + link copiable.
- [ ] Pegar link en pestaña incognito → `InviteLandingScreen` pide login.
- [ ] Login con cuenta coach → claim ok → redirect a workspace Uros con assignedTeamIds correcto.
- [ ] Coach ve cuaderno del team Cadete A.
- [ ] Coach escribe nota en `cuaderno/notas` → persiste y se ve en otro device.
- [ ] Owner revoca al coach → coach pierde acceso al recargar.
- [ ] Owner crea otra invitación → revoca antes del claim → invite no aparece en pestaña incognito.
- [ ] Owner transfiere propiedad a otro DT → role bump verificado en Firestore Console.
- [ ] Owner anterior bajado a DT, sigue accediendo al workspace.
- [ ] Borrar el team Cadete A → trigger `onTeamDelete` quita el id de los assignedTeamIds (verificado en console).

## Bugs / friction

- [ ] (anotar)

## Hot-fix vs deferred

- Hot-fix (bloquean siguiente PR / sub-4): \_\_\_
- Deferred a sub-4: \_\_\_
```

- [ ] **Step 2: Crear `docs/runbooks/sub-proyecto-3-cloud-logging.md`**

```markdown
# Sub-proyecto 3 — Cloud Logging dashboards

## Queries clave (Cloud Logging Explorer)

### Errores en callables sub-3
```

resource.type="cloud_function"
resource.labels.region="europe-west1"
(resource.labels.function_name=("createClub" OR "inviteMember" OR "acceptInvite" OR "revokeInvite" OR "revokeMember" OR "setMemberTeams" OR "setMemberRole" OR "transferOwnership"))
severity>=ERROR

```

### Triggers ejecutados (último día)
```

resource.type="cloud_function"
resource.labels.function_name=("onMemberDelete" OR "onTeamCreate" OR "onTeamDelete")
timestamp>="-1d"

```

### Scheduled cleanup
```

resource.type="cloud_function"
resource.labels.function_name="cleanupExpiredInvites"
textPayload:"deleted="

```

## Métricas a vigilar

- p99 latencia `acceptInvite` (transacción 3-write) — alerta si > 3s.
- Error rate `inviteMember` — alerta si > 5% en ventana de 1h (probable validación rota).
- Count `cleanupExpiredInvites` por día — alerta si = 0 dos días seguidos (scheduler caído).

## Acciones

- Cuando un usuario reporta "no puedo invitar": pegar query de errores + filtrar por `jsonPayload.uid`.
- Cuando una transferencia falla a medias: revisar logs de `transferOwnership` por trace; si solo se hizo el owner switch sin role bump, abrir issue P0 (transacción debería haber rollbackeado).
```

- [ ] **Step 3: Ejecutar el dogfood real (rellenar el primer runbook con observaciones reales)**

Manual. Tras ejecutar, commitear el runbook actualizado.

- [ ] **Step 4: Crear hot-fixes que el dogfood detecte (si aplica)**

Cualquier bug crítico debe tener fix dedicado en commit aparte dentro de la misma branch `sub3-pr4-dogfood`. Bugs no críticos → ticket en `docs/superpowers/specs/2026-05-04-sub-proyecto-3-invitaciones-y-licencias-design.md` sección "Out of scope V1" o como issue GitHub.

- [ ] **Step 5: Verificar bypass `isPersonalWorkspaceOwner` sigue intacto**

Manual: con cuenta cualquiera (no super-admin), entrar a su workspace personal, crear un team nuevo, escribir en su cuaderno. Debe funcionar sin tropezar con los refuerzos sub-3 de members/ownerId. (Esto verifica que las rules de sub-2 que hacen bypass para personal workspaces no se rompieron al cerrar `members` y `ownerId`.)

- [ ] **Step 6: Commit + push + PR**

```powershell
git checkout -b sub3-pr4-dogfood
git add docs/runbooks/sub-proyecto-3-dogfood.md docs/runbooks/sub-proyecto-3-cloud-logging.md
git commit -m "docs(sub3): runbooks dogfood + Cloud Logging dashboards"
git push -u origin sub3-pr4-dogfood
gh pr create --base main --title "sub-proyecto 3 (PR #4) — dogfood Uros + observability" --body "$(cat <<'EOF'
## Summary
- Runbook E2E ejecutado sobre club Uros de Rivas (cuenta super-admin + coach de prueba)
- Cloud Logging queries + dashboards definidos
- Bypass personal-workspace verificado intacto post-refuerzos

## Test plan
- [x] Checklist dogfood completo (ver runbook)
- [x] Bugs encontrados clasificados hot-fix vs deferred
- [x] Bypass `isPersonalWorkspaceOwner` smoke ok
EOF
)"
```

---

## Cierre del sub-proyecto 3

Una vez los 4 PRs estén merged y el club Uros de Rivas haya estado en producción 1-2 semanas sin reportes de regresión:

- [ ] Actualizar memoria `project_subproyecto_3_status.md` con `status: "live, soak completo"`.
- [ ] Cambiar de memoria `project_b2b_monetization_pivot.md` el orden a `0 → 1 → 5 || (2 → 3 ✓ → 4) → 6 → 7` (marcar 3 hecho).
- [ ] Próxima sesión: brainstorming de **sub-proyecto 4 — Vista de Director Técnico** (quita el feature flag y abre clubs al público).

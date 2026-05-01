# Sub-proyecto 1 — Modelo de cuenta y workspace + migración — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el modelo de datos de Pick&Coach desde `users/{uid}/...` a `workspaces/{wsId}/...` para habilitar B2B clubs en sub-proyectos siguientes, con un big-bang de los usuarios actuales a un workspace personal cada uno.

**Architecture:** Añadir helpers de path (`workspaceDocRef`, `workspaceColRef`), `WorkspaceProvider` (React context con `activeWsId`, `memberships[]`, persistencia en localStorage), y un script Node + Firebase Admin SDK idempotente que copia subcolecciones de `users/{uid}/...` a `workspaces/{wsId}/...`. Refactor de 22 servicios/hooks/screens al nuevo path. Reescritura de reglas Firestore. Cutover en ventana de mantenimiento con backup, run del script, smoke tests y deploy.

**Tech Stack:** React 19 + Vite 8, Firebase 12 (client SDK), `firebase-admin` ^12 (Node, a añadir), Firestore Emulator + `@firebase/rules-unit-testing` ^5 (ya instalado) para rules tests, Vitest 4 (ya configurado en `vite.config.js`).

**Spec base:** `docs/superpowers/specs/2026-05-01-sub-proyecto-1-modelo-cuenta-workspace-migracion-design.md`. Toda decisión de diseño reside ahí; el plan solo implementa.

---

## File Structure

### Files to create

| Path                                               | Responsibility                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/contexts/WorkspaceContext.jsx`                | `WorkspaceProvider`, `useWorkspace`, `resolveActiveWsId`, suscripciones a memberships y workspace activo                        |
| `src/contexts/__tests__/WorkspaceContext.test.jsx` | Unit tests del provider y resolver                                                                                              |
| `scripts/migration/migrateToWorkspaces.js`         | Entrypoint del script con CLI args (`--dry-run`, `--user uid`, `--project name`)                                                |
| `scripts/migration/lib/admin.js`                   | Init de Firebase Admin SDK con service account                                                                                  |
| `scripts/migration/lib/copyCollection.js`          | `copyCollection` recursivo idempotente                                                                                          |
| `scripts/migration/lib/copyTeams.js`               | `copyTeamsRecursive`                                                                                                            |
| `scripts/migration/lib/conversationsMove.js`       | `moveConversationsToPickHistory`                                                                                                |
| `scripts/migration/lib/notifsWsId.js`              | `addWsIdToNotifications`                                                                                                        |
| `scripts/migration/lib/verify.js`                  | `countDocsRecursive`, `verifyMigration`                                                                                         |
| `scripts/migration/lib/migrateUser.js`             | Orquestador `migrateUser` con idempotency check                                                                                 |
| `scripts/migration/__tests__/migration.test.ts`    | Tests sobre Firestore Emulator                                                                                                  |
| `scripts/cleanupOldPaths.js`                       | Borra `users/{uid}/teams/`, `brackets/`, `calendarSessions/`, `playoffConvocatorias/`, `exercises/`, `conversations/` a 30 días |
| `firestore.rules.test.ts`                          | Rules tests con `@firebase/rules-unit-testing`                                                                                  |
| `docs/runbooks/cutover-smoke-checklist.md`         | Checklist manual post-cutover (11 puntos del spec sec 8.3)                                                                      |

### Files to modify

| Path                                          | Cambio                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `package.json`                                | Añadir `firebase-admin` a `devDependencies`                                           |
| `src/services/firestoreHelpers.js`            | Añadir `workspaceDocRef`, `workspaceColRef`, `saveWorkspaceDoc`, `deleteWorkspaceDoc` |
| `src/services/teamsService.js`                | Switch paths a `workspaces/{wsId}/teams/...`                                          |
| `src/services/calendarService.js`             | Switch path                                                                           |
| `src/services/competitionsService.js`         | Switch path                                                                           |
| `src/services/playoffConvocatoriasService.js` | Switch path                                                                           |
| `src/services/trainingsService.js`            | Switch paths (trainings + exercises)                                                  |
| `src/services/firestoreService.js`            | Switch paths (brackets)                                                               |
| `src/services/bracketCalendarSyncService.js`  | Switch path (brackets locales)                                                        |
| `src/services/scoutingService.js`             | Switch sub-paths bajo team                                                            |
| `src/services/analysisService.js`             | Switch sub-paths bajo team                                                            |
| `src/services/planillaService.js`             | Switch sub-paths bajo team                                                            |
| `src/services/proposalExecutor.ts`            | Switch path de bracket (Pick agent)                                                   |
| `src/services/backupService.js`               | Switch paths de export/import                                                         |
| `src/hooks/useBracketSync.js`                 | Usar `useWorkspace` + `workspaceDocRef`                                               |
| `src/hooks/useBracketEditor.js`               | Idem                                                                                  |
| `src/hooks/useBracketCreation.js`             | Idem                                                                                  |
| `src/hooks/useCalendarSessions.js`            | Idem                                                                                  |
| `src/hooks/useHomeDashboard.js`               | Idem                                                                                  |
| `src/hooks/useSharing.js`                     | Idem (solo brackets locales; shared sigue)                                            |
| `src/hooks/useConversationPersistence.ts`     | Path nuevo `users/{uid}/pickHistory/{wsId}/conversations/...`                         |
| `src/hooks/useProactiveNotifications.js`      | Filter `where('wsId', '==', activeWsId)`                                              |
| `src/screens/BracketScreen.jsx`               | Direct ref → helper                                                                   |
| `src/screens/PlanillaSextosScreen.jsx`        | Direct refs vía servicios refactorizados                                              |
| `src/screens/AnalysisScreen.jsx`              | Idem                                                                                  |
| `src/screens/ScoutingScreen.jsx`              | Idem                                                                                  |
| `src/shell/CoachesApp.jsx`                    | Mount `WorkspaceProvider` entre `AuthProvider` y `ScreenContextProvider`              |
| `firestore.rules`                             | Reescritas para `workspaces/{wsId}/...`                                               |
| `firestore.indexes.json`                      | Añadir índice `proactiveNotifications` por `wsId` si hace falta                       |

---

## Pre-flight

### Task 0.1: Añadir `firebase-admin` a devDependencies

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Run npm install**

```bash
npm install --save-dev firebase-admin@^12
```

Expected: `firebase-admin` añadido en `devDependencies` de `package.json`. `package-lock.json` actualizado.

- [ ] **Step 2: Verify install**

```bash
node -e "console.log(require('firebase-admin/app').initializeApp ? 'ok' : 'fail')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add firebase-admin for migration scripts"
```

### Task 0.2: Crear estructura `scripts/migration/`

**Files:**

- Create: `scripts/migration/` directory
- Create: `scripts/migration/lib/` directory
- Create: `scripts/migration/__tests__/` directory

- [ ] **Step 1: Create directories**

```bash
mkdir -p scripts/migration/lib scripts/migration/__tests__
```

- [ ] **Step 2: Add a placeholder README so git tracks the structure**

Create `scripts/migration/README.md`:

````markdown
# Migration scripts

Scripts para la migración del modelo `users/{uid}/...` → `workspaces/{wsId}/...`.

## Uso

```bash
# Dry-run (cuenta docs, no escribe)
node scripts/migration/migrateToWorkspaces.js --dry-run

# Un solo user (testing)
node scripts/migration/migrateToWorkspaces.js --user UID

# Producción
node scripts/migration/migrateToWorkspaces.js --project pickncoach-prod
```
````

Service account JSON apuntado por `GOOGLE_APPLICATION_CREDENTIALS` o flag `--credentials`.

Diseño detallado: `docs/superpowers/specs/2026-05-01-sub-proyecto-1-modelo-cuenta-workspace-migracion-design.md` sección 4.

````

- [ ] **Step 3: Commit**

```bash
git add scripts/migration/README.md
git commit -m "chore(scripts): scaffold migration directory"
````

### Task 0.3: Verificar Firestore Emulator funciona

- [ ] **Step 1: Start emulator**

```bash
firebase emulators:start --only firestore
```

Expected: Firestore Emulator listening on `127.0.0.1:8080`. UI on `localhost:4000`.

- [ ] **Step 2: Stop emulator (Ctrl-C)**

Confirmas que arranca sin errores. No commit (solo verificación).

---

## Commit 1: feat(workspaces): path helpers and types

### Task 1.1: Tests para `workspaceDocRef` y `workspaceColRef`

**Files:**

- Test: `src/services/__tests__/workspacePaths.test.js` (create)

- [ ] **Step 1: Write the failing tests**

Create `src/services/__tests__/workspacePaths.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { workspaceDocRef, workspaceColRef } from '../firestoreHelpers';

const app = initializeApp({ projectId: 'test-project' }, 'test-app-paths');
const db = getFirestore(app);

describe('workspaceDocRef', () => {
  it('builds top-level workspace doc path', () => {
    const ref = workspaceDocRef(db, 'app1', 'ws1', 'teams', 'team1');
    expect(ref.path).toBe('artifacts/app1/workspaces/ws1/teams/team1');
  });

  it('supports deeply nested paths via varargs', () => {
    const ref = workspaceDocRef(db, 'app1', 'ws1', 'teams', 'team1', 'cuaderno', 'jugadores');
    expect(ref.path).toBe('artifacts/app1/workspaces/ws1/teams/team1/cuaderno/jugadores');
  });
});

describe('workspaceColRef', () => {
  it('builds top-level workspace collection path', () => {
    const ref = workspaceColRef(db, 'app1', 'ws1', 'teams');
    expect(ref.path).toBe('artifacts/app1/workspaces/ws1/teams');
  });

  it('supports nested collection paths via varargs', () => {
    const ref = workspaceColRef(db, 'app1', 'ws1', 'teams', 'team1', 'trainings');
    expect(ref.path).toBe('artifacts/app1/workspaces/ws1/teams/team1/trainings');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/services/__tests__/workspacePaths.test.js
```

Expected: FAIL — `workspaceDocRef`/`workspaceColRef` are not exports of `firestoreHelpers`.

- [ ] **Step 3: Implement helpers**

Modify `src/services/firestoreHelpers.js`. After the existing `userColRef` function, append:

```js
/**
 * Build a ref to a workspace-scoped document.
 * Soporta paths anidados via varargs: workspaceDocRef(db, appId, wsId, 'teams', teamId, 'cuaderno', 'jugadores')
 */
export function workspaceDocRef(db, appId, wsId, ...pathSegments) {
  return doc(db, 'artifacts', appId, 'workspaces', wsId, ...pathSegments);
}

/**
 * Build a ref to a workspace-scoped collection.
 */
export function workspaceColRef(db, appId, wsId, ...pathSegments) {
  return collection(db, 'artifacts', appId, 'workspaces', wsId, ...pathSegments);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/services/__tests__/workspacePaths.test.js
```

Expected: PASS — 4 tests.

### Task 1.2: Tests para `saveWorkspaceDoc` y `deleteWorkspaceDoc`

**Files:**

- Test: `src/services/__tests__/workspacePaths.test.js` (extend)

- [ ] **Step 1: Append tests to the same file**

Add to `src/services/__tests__/workspacePaths.test.js`:

```js
import { vi } from 'vitest';
import { saveWorkspaceDoc, deleteWorkspaceDoc } from '../firestoreHelpers';

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    setDoc: vi.fn(async () => undefined),
    deleteDoc: vi.fn(async () => undefined),
    serverTimestamp: () => ({ __ts: true }),
  };
});

import { setDoc, deleteDoc } from 'firebase/firestore';

describe('saveWorkspaceDoc', () => {
  it('writes with auto timestamps and merge', async () => {
    await saveWorkspaceDoc(db, 'app1', 'ws1', ['teams', 't1'], { name: 'Equipo' });
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, data, options] = setDoc.mock.calls[0];
    expect(ref.path).toBe('artifacts/app1/workspaces/ws1/teams/t1');
    expect(data.name).toBe('Equipo');
    expect(data.createdAt).toEqual({ __ts: true });
    expect(data.updatedAt).toEqual({ __ts: true });
    expect(options).toEqual({ merge: true });
  });

  it('preserves existing createdAt if provided', async () => {
    setDoc.mockClear();
    await saveWorkspaceDoc(db, 'app1', 'ws1', ['teams', 't1'], { name: 'Equipo', createdAt: 'EXISTING' });
    const [, data] = setDoc.mock.calls[0];
    expect(data.createdAt).toBe('EXISTING');
    expect(data.updatedAt).toEqual({ __ts: true });
  });
});

describe('deleteWorkspaceDoc', () => {
  it('deletes via deleteDoc with the right ref', async () => {
    deleteDoc.mockClear();
    await deleteWorkspaceDoc(db, 'app1', 'ws1', ['teams', 't1']);
    expect(deleteDoc).toHaveBeenCalledTimes(1);
    const [ref] = deleteDoc.mock.calls[0];
    expect(ref.path).toBe('artifacts/app1/workspaces/ws1/teams/t1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/services/__tests__/workspacePaths.test.js
```

Expected: FAIL — `saveWorkspaceDoc` and `deleteWorkspaceDoc` not exported.

- [ ] **Step 3: Implement helpers**

Append to `src/services/firestoreHelpers.js`:

```js
/**
 * Save a workspace-scoped document with merge + auto-timestamps.
 * pathSegments: array de strings, e.g. ['teams', teamId, 'cuaderno', 'jugadores']
 */
export async function saveWorkspaceDoc(db, appId, wsId, pathSegments, data) {
  const ref = workspaceDocRef(db, appId, wsId, ...pathSegments);
  await setDoc(
    ref,
    {
      ...data,
      updatedAt: serverTimestamp(),
      ...(data.createdAt ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
}

/**
 * Delete a workspace-scoped document.
 */
export async function deleteWorkspaceDoc(db, appId, wsId, pathSegments) {
  await deleteDoc(workspaceDocRef(db, appId, wsId, ...pathSegments));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/services/__tests__/workspacePaths.test.js
```

Expected: PASS — 7 tests.

### Task 1.3: Commit "feat(workspaces): add path helpers"

- [ ] **Step 1: Verify lint passes**

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 2: Stage and commit**

```bash
git add src/services/firestoreHelpers.js src/services/__tests__/workspacePaths.test.js
git commit -m "feat(workspaces): add path helpers and types

workspaceDocRef and workspaceColRef build refs under artifacts/{appId}/workspaces/{wsId}/...
with varargs for deeply nested paths. saveWorkspaceDoc/deleteWorkspaceDoc mirror the existing
user variants. Coexist with userDocRef/userColRef which now serve only user-private data."
```

---

## Commit 2: feat(workspaces): WorkspaceContext provider

### Task 2.1: Tests para `resolveActiveWsId`

**Files:**

- Test: `src/contexts/__tests__/WorkspaceContext.test.jsx` (create)

- [ ] **Step 1: Write failing tests for the pure resolver**

Create `src/contexts/__tests__/WorkspaceContext.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { resolveActiveWsId } from '../WorkspaceContext';

const personal = { wsId: 'ws-personal', workspaceType: 'personal', role: 'owner' };
const club = { wsId: 'ws-club', workspaceType: 'club', role: 'coach' };

describe('resolveActiveWsId', () => {
  it('returns savedWsId when it exists in memberships', () => {
    expect(resolveActiveWsId([personal, club], 'ws-club')).toBe('ws-club');
  });

  it('falls back to personal when savedWsId is not in memberships', () => {
    expect(resolveActiveWsId([personal, club], 'ws-deleted')).toBe('ws-personal');
  });

  it('falls back to personal when savedWsId is null', () => {
    expect(resolveActiveWsId([personal, club], null)).toBe('ws-personal');
  });

  it('returns first membership when no personal exists', () => {
    expect(resolveActiveWsId([club], null)).toBe('ws-club');
  });

  it('returns null when memberships is empty', () => {
    expect(resolveActiveWsId([], null)).toBe(null);
    expect(resolveActiveWsId([], 'whatever')).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/contexts/__tests__/WorkspaceContext.test.jsx
```

Expected: FAIL — `resolveActiveWsId` not exported.

- [ ] **Step 3: Create the file with the resolver**

Create `src/contexts/WorkspaceContext.jsx`:

```jsx
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from 'react';

export function resolveActiveWsId(memberships, savedWsId) {
  if (!Array.isArray(memberships) || memberships.length === 0) {
    return null;
  }
  if (savedWsId && memberships.some((m) => m.wsId === savedWsId)) {
    return savedWsId;
  }
  const personal = memberships.find((m) => m.workspaceType === 'personal');
  if (personal) return personal.wsId;
  return memberships[0]?.wsId ?? null;
}

const WorkspaceContext = createContext(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return ctx;
}

// WorkspaceProvider implementation comes in Task 2.2
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/contexts/__tests__/WorkspaceContext.test.jsx
```

Expected: PASS — 5 tests.

### Task 2.2: Implementar `WorkspaceProvider` con suscripciones

**Files:**

- Modify: `src/contexts/WorkspaceContext.jsx`

- [ ] **Step 1: Replace the placeholder with full implementation**

Replace the comment `// WorkspaceProvider implementation comes in Task 2.2` with:

```jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { useFirebase } from './FirebaseContext';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'pickncoach.activeWsId';

function readSavedWsId() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSavedWsId(wsId) {
  try {
    if (wsId) localStorage.setItem(STORAGE_KEY, wsId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function WorkspaceProvider({ children }) {
  const { db, appId } = useFirebase();
  const { user } = useAuth();

  const [memberships, setMemberships] = useState([]);
  const [activeWsId, setActiveWsIdState] = useState(null);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to user's memberships
  useEffect(() => {
    if (!db || !appId || !user?.uid) {
      setMemberships([]);
      setActiveWsIdState(null);
      setActiveWorkspace(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const ref = collection(db, 'artifacts', appId, 'users', user.uid, 'memberships');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const list = snap.docs.map((d) => ({ wsId: d.id, ...d.data() }));
        setMemberships(list);
        setActiveWsIdState((current) => {
          if (current && list.some((m) => m.wsId === current)) return current;
          return resolveActiveWsId(list, readSavedWsId());
        });
        setIsLoading(false);
      },
      (err) => {
        console.error('[WorkspaceProvider] memberships snapshot error', err);
        setMemberships([]);
        setIsLoading(false);
      },
    );
    return unsub;
  }, [db, appId, user?.uid]);

  // Subscribe to the active workspace doc
  useEffect(() => {
    if (!db || !appId || !activeWsId) {
      setActiveWorkspace(null);
      return;
    }
    const ref = doc(db, 'artifacts', appId, 'workspaces', activeWsId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setActiveWorkspace(snap.exists() ? { wsId: snap.id, ...snap.data() } : null);
      },
      (err) => {
        console.error('[WorkspaceProvider] workspace doc snapshot error', err);
        setActiveWorkspace(null);
      },
    );
    return unsub;
  }, [db, appId, activeWsId]);

  const setActive = useCallback(
    (wsId) => {
      if (!memberships.some((m) => m.wsId === wsId)) {
        console.warn(`[WorkspaceProvider] setActiveWorkspace ignored: ${wsId} not in memberships`);
        return;
      }
      writeSavedWsId(wsId);
      setActiveWsIdState(wsId);
    },
    [memberships],
  );

  const value = useMemo(
    () => ({
      activeWsId,
      activeWorkspace,
      memberships,
      isLoading,
      setActiveWorkspace: setActive,
    }),
    [activeWsId, activeWorkspace, memberships, isLoading, setActive],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
```

- [ ] **Step 2: Run existing tests to verify resolver still works**

```bash
npx vitest run src/contexts/__tests__/WorkspaceContext.test.jsx
```

Expected: PASS — 5 tests still pass (resolver unchanged).

### Task 2.3: Tests del lifecycle del provider

**Files:**

- Test: `src/contexts/__tests__/WorkspaceContext.test.jsx` (extend)

- [ ] **Step 1: Add lifecycle tests**

Append to `src/contexts/__tests__/WorkspaceContext.test.jsx`:

```jsx
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import { WorkspaceProvider, useWorkspace } from '../WorkspaceContext';

vi.mock('../FirebaseContext', () => ({
  useFirebase: () => ({ db: { __mock: 'db' }, appId: 'app1' }),
}));

vi.mock('../AuthContext', () => ({
  useAuth: () => mockAuth,
}));

let mockAuth = { user: null };

const onSnapshotMock = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: (...args) => ({ __col: args.slice(1).join('/') }),
  doc: (...args) => ({ __doc: args.slice(1).join('/') }),
  onSnapshot: (...args) => onSnapshotMock(...args),
}));

function Probe() {
  const ws = useWorkspace();
  return (
    <div>
      <span data-testid="loading">{String(ws.isLoading)}</span>
      <span data-testid="active">{ws.activeWsId ?? 'null'}</span>
      <span data-testid="count">{ws.memberships.length}</span>
    </div>
  );
}

beforeEach(() => {
  onSnapshotMock.mockReset();
  localStorage.clear();
});

describe('WorkspaceProvider', () => {
  it('renders with empty state when no user', () => {
    mockAuth = { user: null };
    render(
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>,
    );
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('active').textContent).toBe('null');
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('subscribes to memberships and resolves active when user is set', async () => {
    mockAuth = { user: { uid: 'u1' } };
    let snapshotCallback;
    onSnapshotMock.mockImplementation((_ref, cb) => {
      snapshotCallback = cb;
      return () => {};
    });

    render(
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>,
    );
    expect(onSnapshotMock).toHaveBeenCalled();

    act(() => {
      snapshotCallback({
        docs: [
          { id: 'ws-personal', data: () => ({ workspaceType: 'personal', role: 'owner', workspaceName: 'Mi cuenta' }) },
        ],
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('active').textContent).toBe('ws-personal');
      expect(screen.getByTestId('count').textContent).toBe('1');
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
  });

  it('uses saved wsId from localStorage when present', async () => {
    mockAuth = { user: { uid: 'u1' } };
    localStorage.setItem('pickncoach.activeWsId', 'ws-club');

    let snapshotCallback;
    onSnapshotMock.mockImplementation((_ref, cb) => {
      snapshotCallback = cb;
      return () => {};
    });

    render(
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>,
    );
    act(() => {
      snapshotCallback({
        docs: [
          { id: 'ws-personal', data: () => ({ workspaceType: 'personal' }) },
          { id: 'ws-club', data: () => ({ workspaceType: 'club' }) },
        ],
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('active').textContent).toBe('ws-club');
    });
  });

  it('falls back to personal when saved wsId is no longer a membership', async () => {
    mockAuth = { user: { uid: 'u1' } };
    localStorage.setItem('pickncoach.activeWsId', 'ws-deleted');

    let snapshotCallback;
    onSnapshotMock.mockImplementation((_ref, cb) => {
      snapshotCallback = cb;
      return () => {};
    });

    render(
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>,
    );
    act(() => {
      snapshotCallback({
        docs: [{ id: 'ws-personal', data: () => ({ workspaceType: 'personal' }) }],
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('active').textContent).toBe('ws-personal');
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/contexts/__tests__/WorkspaceContext.test.jsx
```

Expected: PASS — 9 tests total (5 resolver + 4 provider).

### Task 2.4: Mount `WorkspaceProvider` en `CoachesApp.jsx`

**Files:**

- Modify: `src/shell/CoachesApp.jsx`

- [ ] **Step 1: Add import and provider**

Find the import block at the top and add:

```jsx
import { WorkspaceProvider } from '../contexts/WorkspaceContext';
```

Find the JSX tree and insert `WorkspaceProvider` between `AuthProvider` and `ScreenContextProvider`:

```jsx
export default function CoachesApp() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <FirebaseProvider>
          <AuthProvider>
            <WorkspaceProvider>
              {' '}
              {/* ← NUEVO */}
              <ScreenContextProvider>
                <PickProvider>
                  <ToastProvider>
                    <ErrorBoundary>
                      <SidebarProvider>
                        <AppShell>
                          <AppRouter />
                        </AppShell>
                        <PickRoot />
                      </SidebarProvider>
                    </ErrorBoundary>
                  </ToastProvider>
                </PickProvider>
              </ScreenContextProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </FirebaseProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}
```

- [ ] **Step 2: Verify the app builds**

```bash
npm run build:client
```

Expected: build succeeds, no errors.

- [ ] **Step 3: Verify dev server boots without runtime errors**

Manually: `npm run dev`, open browser, verify the home renders. (No tests for the mount yet — covered by Commit 4 refactor smoke.) Stop server.

### Task 2.5: Commit "feat(workspaces): WorkspaceContext provider"

- [ ] **Step 1: Verify lint and tests**

```bash
npm run lint
npm test -- src/contexts/__tests__/WorkspaceContext.test.jsx src/services/__tests__/workspacePaths.test.js
```

Expected: PASS.

- [ ] **Step 2: Stage and commit**

```bash
git add src/contexts/WorkspaceContext.jsx src/contexts/__tests__/WorkspaceContext.test.jsx src/shell/CoachesApp.jsx
git commit -m "feat(workspaces): WorkspaceContext provider with active wsId resolution

Provider reads users/{uid}/memberships, resolves active wsId from localStorage
with fallback to personal, subscribes to active workspace doc. Mounted between
AuthProvider and ScreenContextProvider. UI consumers via useWorkspace()."
```

---

## Commit 3: feat(scripts): migration script with emulator tests

### Task 3.1: Implementar `lib/admin.js`

**Files:**

- Create: `scripts/migration/lib/admin.js`

- [ ] **Step 1: Create the file**

```js
import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';

let initialized = false;

export function initAdmin({ project, credentialsPath } = {}) {
  if (initialized) return admin;

  const credentials = credentialsPath ? JSON.parse(readFileSync(credentialsPath, 'utf8')) : null;

  admin.initializeApp({
    credential: credentials ? admin.credential.cert(credentials) : admin.credential.applicationDefault(),
    projectId: project ?? process.env.GCLOUD_PROJECT,
  });
  initialized = true;
  return admin;
}

export function getDb() {
  return admin.firestore();
}

export function getAuth() {
  return admin.auth();
}
```

No tests for this — it's a thin wrapper. Behavior tested implicitly via downstream tasks.

### Task 3.2: Tests para `copyCollection`

**Files:**

- Test: `scripts/migration/__tests__/copyCollection.test.js` (create)

- [ ] **Step 1: Write tests against Firestore Emulator**

Create `scripts/migration/__tests__/copyCollection.test.js`:

```js
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { copyCollection } from '../lib/copyCollection.js';

let testEnv;
let context;
let db;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'pickncoach-mig-test',
    firestore: { host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  context = testEnv.unauthenticatedContext();
  db = context.firestore();
});

describe('copyCollection', () => {
  it('copies all documents from src to dest with same ids', async () => {
    await db.doc('src/a').set({ name: 'A' });
    await db.doc('src/b').set({ name: 'B' });

    const copied = await copyCollection(db, 'src', 'dest');

    expect(copied).toBe(2);
    const destA = await db.doc('dest/a').get();
    expect(destA.data().name).toBe('A');
  });

  it('copies subcollections recursively', async () => {
    await db.doc('src/a').set({ name: 'A' });
    await db.doc('src/a/sub/x').set({ value: 1 });
    await db.doc('src/a/sub/y').set({ value: 2 });

    const copied = await copyCollection(db, 'src', 'dest');

    expect(copied).toBe(3); // 1 root + 2 in sub
    const subX = await db.doc('dest/a/sub/x').get();
    expect(subX.data().value).toBe(1);
  });

  it('is idempotent on re-run', async () => {
    await db.doc('src/a').set({ name: 'A' });
    await copyCollection(db, 'src', 'dest');
    const firstSnap = await db.doc('dest/a').get();
    const firstUpdate = firstSnap.updateTime;

    await copyCollection(db, 'src', 'dest');
    const secondSnap = await db.doc('dest/a').get();

    expect(secondSnap.data().name).toBe('A');
    // updateTime may or may not advance with merge=true; the important thing is no duplicate or error
    const allDocs = await db.collection('dest').get();
    expect(allDocs.size).toBe(1);
  });

  it('returns 0 when src has no docs', async () => {
    const copied = await copyCollection(db, 'src', 'dest');
    expect(copied).toBe(0);
  });
});
```

Note: `@firebase/rules-unit-testing` exposes a `firestore()` API on contexts. We use unauth context here just to get a Firestore client; we're testing the helper, not rules.

- [ ] **Step 2: Run with emulator running**

In one terminal:

```bash
firebase emulators:start --only firestore
```

In another:

```bash
npx vitest run scripts/migration/__tests__/copyCollection.test.js
```

Expected: FAIL — `lib/copyCollection.js` doesn't exist.

### Task 3.3: Implementar `copyCollection`

**Files:**

- Create: `scripts/migration/lib/copyCollection.js`

- [ ] **Step 1: Implement**

```js
const BATCH_LIMIT = 200;

/**
 * Recursively copy all docs (with their subcollections) from sourcePath to destPath.
 * Idempotent: uses set merge=true on dest, safe to re-run.
 *
 * @param {FirebaseFirestore.Firestore} db Admin SDK Firestore instance
 * @param {string} sourcePath Path to a collection, e.g. "users/u1/teams"
 * @param {string} destPath Target collection path, e.g. "workspaces/w1/teams"
 * @returns {Promise<number>} Total docs copied (including those in subcollections)
 */
export async function copyCollection(db, sourcePath, destPath) {
  const snap = await db.collection(sourcePath).get();
  let copied = 0;
  let batch = db.batch();
  let writes = 0;

  for (const docSnap of snap.docs) {
    const destRef = db.collection(destPath).doc(docSnap.id);
    batch.set(destRef, docSnap.data(), { merge: true });
    copied++;
    writes++;

    if (writes >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      writes = 0;
    }

    const subcols = await docSnap.ref.listCollections();
    for (const sub of subcols) {
      copied += await copyCollection(
        db,
        `${sourcePath}/${docSnap.id}/${sub.id}`,
        `${destPath}/${docSnap.id}/${sub.id}`,
      );
    }
  }

  if (writes > 0) await batch.commit();
  return copied;
}
```

- [ ] **Step 2: Re-run tests**

```bash
npx vitest run scripts/migration/__tests__/copyCollection.test.js
```

Expected: PASS — 4 tests.

### Task 3.4: Tests + implementación de `copyTeamsRecursive`

**Files:**

- Test: `scripts/migration/__tests__/copyTeams.test.js` (create)
- Create: `scripts/migration/lib/copyTeams.js`

- [ ] **Step 1: Write tests**

Create `scripts/migration/__tests__/copyTeams.test.js`:

```js
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { copyTeamsRecursive } from '../lib/copyTeams.js';

let testEnv;
let db;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'pickncoach-mig-test',
    firestore: { host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => testEnv.cleanup());
beforeEach(async () => {
  await testEnv.clearFirestore();
  db = testEnv.unauthenticatedContext().firestore();
});

const APP_ID = 'app1';
const UID = 'u1';
const WS_ID = 'ws1';

const SOURCE = `artifacts/${APP_ID}/users/${UID}/teams`;
const DEST = `artifacts/${APP_ID}/workspaces/${WS_ID}/teams`;

describe('copyTeamsRecursive', () => {
  it('copies team docs and known subcollections', async () => {
    await db.doc(`${SOURCE}/t1`).set({ name: 'Senior A' });
    await db.doc(`${SOURCE}/t1/members/m1`).set({ nombre: 'Pepe' });
    await db.doc(`${SOURCE}/t1/trainings/tr1`).set({ titulo: 'Sesión 1' });
    await db.doc(`${SOURCE}/t1/competitions/c1`).set({ nombre: 'Liga' });
    await db.doc(`${SOURCE}/t1/cuaderno/jugadores`).set({ rows: [] });

    const total = await copyTeamsRecursive(db, APP_ID, UID, WS_ID);

    expect(total).toBeGreaterThanOrEqual(5);
    const teamSnap = await db.doc(`${DEST}/t1`).get();
    expect(teamSnap.data().name).toBe('Senior A');
    const memberSnap = await db.doc(`${DEST}/t1/members/m1`).get();
    expect(memberSnap.data().nombre).toBe('Pepe');
    const cuadSnap = await db.doc(`${DEST}/t1/cuaderno/jugadores`).get();
    expect(cuadSnap.exists).toBe(true);
  });

  it('copies all teams when there are several', async () => {
    await db.doc(`${SOURCE}/t1`).set({ name: 'A' });
    await db.doc(`${SOURCE}/t2`).set({ name: 'B' });
    await db.doc(`${SOURCE}/t3`).set({ name: 'C' });

    const total = await copyTeamsRecursive(db, APP_ID, UID, WS_ID);

    expect(total).toBe(3);
    const all = await db.collection(DEST).get();
    expect(all.size).toBe(3);
  });

  it('returns 0 when the user has no teams', async () => {
    const total = await copyTeamsRecursive(db, APP_ID, UID, WS_ID);
    expect(total).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npx vitest run scripts/migration/__tests__/copyTeams.test.js
```

Expected: FAIL — `lib/copyTeams.js` not found.

- [ ] **Step 3: Implement**

Create `scripts/migration/lib/copyTeams.js`:

```js
import { copyCollection } from './copyCollection.js';

const TEAM_SUBCOLLECTIONS = ['members', 'trainings', 'competitions', 'cuaderno'];

export async function copyTeamsRecursive(db, appId, uid, wsId) {
  const sourceTeamsPath = `artifacts/${appId}/users/${uid}/teams`;
  const destTeamsPath = `artifacts/${appId}/workspaces/${wsId}/teams`;
  const teamsSnap = await db.collection(sourceTeamsPath).get();

  let total = 0;
  for (const teamDoc of teamsSnap.docs) {
    const teamId = teamDoc.id;
    await db.doc(`${destTeamsPath}/${teamId}`).set(teamDoc.data(), { merge: true });
    total++;

    for (const sub of TEAM_SUBCOLLECTIONS) {
      total += await copyCollection(db, `${sourceTeamsPath}/${teamId}/${sub}`, `${destTeamsPath}/${teamId}/${sub}`);
    }
  }
  return total;
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run scripts/migration/__tests__/copyTeams.test.js
```

Expected: PASS — 3 tests.

### Task 3.5: Tests + implementación de `moveConversationsToPickHistory`

**Files:**

- Test: `scripts/migration/__tests__/conversationsMove.test.js` (create)
- Create: `scripts/migration/lib/conversationsMove.js`

- [ ] **Step 1: Write tests**

```js
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { moveConversationsToPickHistory } from '../lib/conversationsMove.js';

let testEnv;
let db;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'pickncoach-mig-test',
    firestore: { host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => testEnv.cleanup());
beforeEach(async () => {
  await testEnv.clearFirestore();
  db = testEnv.unauthenticatedContext().firestore();
});

const APP_ID = 'app1';
const UID = 'u1';
const WS_ID = 'ws1';
const OLD = `artifacts/${APP_ID}/users/${UID}/conversations`;
const NEW = `artifacts/${APP_ID}/users/${UID}/pickHistory/${WS_ID}/conversations`;

describe('moveConversationsToPickHistory', () => {
  it('copies conversations and their messages subcollection', async () => {
    await db.doc(`${OLD}/c1`).set({ titulo: 'Hola' });
    await db.doc(`${OLD}/c1/messages/m1`).set({ texto: 'mensaje' });

    const total = await moveConversationsToPickHistory(db, APP_ID, UID, WS_ID);

    expect(total).toBeGreaterThanOrEqual(2);
    const conv = await db.doc(`${NEW}/c1`).get();
    expect(conv.data().titulo).toBe('Hola');
    const msg = await db.doc(`${NEW}/c1/messages/m1`).get();
    expect(msg.data().texto).toBe('mensaje');
  });

  it('returns 0 when there are no conversations', async () => {
    const total = await moveConversationsToPickHistory(db, APP_ID, UID, WS_ID);
    expect(total).toBe(0);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npx vitest run scripts/migration/__tests__/conversationsMove.test.js
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `scripts/migration/lib/conversationsMove.js`:

```js
import { copyCollection } from './copyCollection.js';

export async function moveConversationsToPickHistory(db, appId, uid, wsId) {
  const oldPath = `artifacts/${appId}/users/${uid}/conversations`;
  const newPath = `artifacts/${appId}/users/${uid}/pickHistory/${wsId}/conversations`;
  return await copyCollection(db, oldPath, newPath);
}
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run scripts/migration/__tests__/conversationsMove.test.js
```

Expected: PASS — 2 tests.

### Task 3.6: Tests + implementación de `addWsIdToNotifications`

**Files:**

- Test: `scripts/migration/__tests__/notifsWsId.test.js` (create)
- Create: `scripts/migration/lib/notifsWsId.js`

- [ ] **Step 1: Write tests**

```js
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { addWsIdToNotifications } from '../lib/notifsWsId.js';

let testEnv;
let db;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'pickncoach-mig-test',
    firestore: { host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => testEnv.cleanup());
beforeEach(async () => {
  await testEnv.clearFirestore();
  db = testEnv.unauthenticatedContext().firestore();
});

const APP_ID = 'app1';
const UID = 'u1';
const WS_ID = 'ws1';
const PATH = `artifacts/${APP_ID}/users/${UID}/proactiveNotifications`;

describe('addWsIdToNotifications', () => {
  it('adds wsId to docs that lack it', async () => {
    await db.doc(`${PATH}/n1`).set({ message: 'A' });
    await db.doc(`${PATH}/n2`).set({ message: 'B' });

    const updated = await addWsIdToNotifications(db, APP_ID, UID, WS_ID);

    expect(updated).toBe(2);
    const n1 = await db.doc(`${PATH}/n1`).get();
    expect(n1.data().wsId).toBe(WS_ID);
  });

  it('skips docs that already have wsId (idempotent)', async () => {
    await db.doc(`${PATH}/n1`).set({ message: 'A', wsId: 'preexisting' });
    await db.doc(`${PATH}/n2`).set({ message: 'B' });

    const updated = await addWsIdToNotifications(db, APP_ID, UID, WS_ID);

    expect(updated).toBe(1);
    const n1 = await db.doc(`${PATH}/n1`).get();
    expect(n1.data().wsId).toBe('preexisting');
  });

  it('returns 0 when there are no notifs', async () => {
    expect(await addWsIdToNotifications(db, APP_ID, UID, WS_ID)).toBe(0);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npx vitest run scripts/migration/__tests__/notifsWsId.test.js
```

- [ ] **Step 3: Implement**

Create `scripts/migration/lib/notifsWsId.js`:

```js
const BATCH_LIMIT = 200;

export async function addWsIdToNotifications(db, appId, uid, wsId) {
  const colRef = db.collection(`artifacts/${appId}/users/${uid}/proactiveNotifications`);
  const snap = await colRef.get();
  let updated = 0;
  let batch = db.batch();
  let writes = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.wsId) continue;
    batch.update(docSnap.ref, { wsId });
    updated++;
    writes++;
    if (writes >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      writes = 0;
    }
  }
  if (writes > 0) await batch.commit();
  return updated;
}
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run scripts/migration/__tests__/notifsWsId.test.js
```

Expected: PASS — 3 tests.

### Task 3.7: Tests + implementación de `verifyMigration` y `countDocsRecursive`

**Files:**

- Test: `scripts/migration/__tests__/verify.test.js` (create)
- Create: `scripts/migration/lib/verify.js`

- [ ] **Step 1: Write tests**

```js
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { verifyMigration, countDocsRecursive } from '../lib/verify.js';

let testEnv;
let db;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'pickncoach-mig-test',
    firestore: { host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => testEnv.cleanup());
beforeEach(async () => {
  await testEnv.clearFirestore();
  db = testEnv.unauthenticatedContext().firestore();
});

const APP_ID = 'app1';
const UID = 'u1';
const WS_ID = 'ws1';

describe('countDocsRecursive', () => {
  it('counts all docs including subcollections', async () => {
    await db.doc(`a/x`).set({});
    await db.doc(`a/x/sub/y`).set({});
    await db.doc(`a/z`).set({});
    expect(await countDocsRecursive(db, 'a')).toBe(3);
  });

  it('returns 0 for empty path', async () => {
    expect(await countDocsRecursive(db, 'empty')).toBe(0);
  });
});

describe('verifyMigration', () => {
  async function seedSourceWith(counts) {
    const base = `artifacts/${APP_ID}/users/${UID}`;
    for (let i = 0; i < counts.brackets; i++) await db.doc(`${base}/brackets/b${i}`).set({});
    for (let i = 0; i < counts.calendarSessions; i++) await db.doc(`${base}/calendarSessions/c${i}`).set({});
    for (let i = 0; i < counts.exercises; i++) await db.doc(`${base}/exercises/e${i}`).set({});
    for (let i = 0; i < counts.playoffConvocatorias; i++) await db.doc(`${base}/playoffConvocatorias/p${i}`).set({});
  }

  async function seedDestMatching(counts) {
    const base = `artifacts/${APP_ID}/workspaces/${WS_ID}`;
    for (let i = 0; i < counts.brackets; i++) await db.doc(`${base}/brackets/b${i}`).set({});
    for (let i = 0; i < counts.calendarSessions; i++) await db.doc(`${base}/calendarSessions/c${i}`).set({});
    for (let i = 0; i < counts.exercises; i++) await db.doc(`${base}/exercises/e${i}`).set({});
    for (let i = 0; i < counts.playoffConvocatorias; i++) await db.doc(`${base}/playoffConvocatorias/p${i}`).set({});
  }

  it('returns ok=true when all counts match', async () => {
    const c = { brackets: 2, calendarSessions: 3, exercises: 1, playoffConvocatorias: 0 };
    await seedSourceWith(c);
    await seedDestMatching(c);
    const result = await verifyMigration(db, APP_ID, UID, WS_ID);
    expect(result.ok).toBe(true);
    expect(result.diffs).toEqual([]);
  });

  it('returns diffs when counts mismatch', async () => {
    await seedSourceWith({ brackets: 5, calendarSessions: 0, exercises: 0, playoffConvocatorias: 0 });
    await seedDestMatching({ brackets: 3, calendarSessions: 0, exercises: 0, playoffConvocatorias: 0 });
    const result = await verifyMigration(db, APP_ID, UID, WS_ID);
    expect(result.ok).toBe(false);
    expect(result.diffs).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'brackets', oldCount: 5, newCount: 3 })]),
    );
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npx vitest run scripts/migration/__tests__/verify.test.js
```

- [ ] **Step 3: Implement**

Create `scripts/migration/lib/verify.js`:

```js
export async function countDocsRecursive(db, path) {
  const snap = await db.collection(path).get();
  let total = snap.size;
  for (const docSnap of snap.docs) {
    const subcols = await docSnap.ref.listCollections();
    for (const sub of subcols) {
      total += await countDocsRecursive(db, `${path}/${docSnap.id}/${sub.id}`);
    }
  }
  return total;
}

const COLLECTIONS_TO_VERIFY = ['brackets', 'calendarSessions', 'playoffConvocatorias', 'exercises', 'teams'];

export async function verifyMigration(db, appId, uid, wsId) {
  const oldBase = `artifacts/${appId}/users/${uid}`;
  const newBase = `artifacts/${appId}/workspaces/${wsId}`;

  const diffs = [];
  for (const name of COLLECTIONS_TO_VERIFY) {
    const [oldCount, newCount] = await Promise.all([
      countDocsRecursive(db, `${oldBase}/${name}`),
      countDocsRecursive(db, `${newBase}/${name}`),
    ]);
    if (oldCount !== newCount) {
      diffs.push({ name, oldCount, newCount });
    }
  }

  return { ok: diffs.length === 0, diffs };
}
```

- [ ] **Step 4: Run, verify pass**

```bash
npx vitest run scripts/migration/__tests__/verify.test.js
```

Expected: PASS — 4 tests.

### Task 3.8: Tests + implementación de `migrateUser` (orquestador)

**Files:**

- Test: `scripts/migration/__tests__/migrateUser.test.js` (create)
- Create: `scripts/migration/lib/migrateUser.js`

- [ ] **Step 1: Write tests for idempotency and core flow**

```js
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { migrateUser } from '../lib/migrateUser.js';

let testEnv;
let db;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'pickncoach-mig-test',
    firestore: { host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => testEnv.cleanup());
beforeEach(async () => {
  await testEnv.clearFirestore();
  db = testEnv.unauthenticatedContext().firestore();
});

const APP_ID = 'app1';
const UID = 'u1';

describe('migrateUser', () => {
  it('creates workspace, member, and membership cache', async () => {
    await db.doc(`artifacts/${APP_ID}/users/${UID}/teams/t1`).set({ name: 'A' });

    const result = await migrateUser(db, APP_ID, UID, { dryRun: false });

    expect(result.status).toBe('migrated');
    const wsId = result.newWsId;
    const wsDoc = await db.doc(`artifacts/${APP_ID}/workspaces/${wsId}`).get();
    expect(wsDoc.data().type).toBe('personal');
    expect(wsDoc.data().ownerId).toBe(UID);
    expect(wsDoc.data().plan).toBe('free');

    const memberDoc = await db.doc(`artifacts/${APP_ID}/workspaces/${wsId}/members/${UID}`).get();
    expect(memberDoc.data().role).toBe('owner');

    const cacheDoc = await db.doc(`artifacts/${APP_ID}/users/${UID}/memberships/${wsId}`).get();
    expect(cacheDoc.data().workspaceType).toBe('personal');
  });

  it('copies subcollections', async () => {
    await db.doc(`artifacts/${APP_ID}/users/${UID}/teams/t1`).set({ name: 'A' });
    await db.doc(`artifacts/${APP_ID}/users/${UID}/brackets/b1`).set({ name: 'BR' });
    await db.doc(`artifacts/${APP_ID}/users/${UID}/exercises/e1`).set({ name: 'EX' });
    await db.doc(`artifacts/${APP_ID}/users/${UID}/calendarSessions/c1`).set({ tipo: 'partido' });

    const result = await migrateUser(db, APP_ID, UID, { dryRun: false });

    const ws = result.newWsId;
    expect((await db.doc(`artifacts/${APP_ID}/workspaces/${ws}/teams/t1`).get()).exists).toBe(true);
    expect((await db.doc(`artifacts/${APP_ID}/workspaces/${ws}/brackets/b1`).get()).exists).toBe(true);
    expect((await db.doc(`artifacts/${APP_ID}/workspaces/${ws}/exercises/e1`).get()).exists).toBe(true);
    expect((await db.doc(`artifacts/${APP_ID}/workspaces/${ws}/calendarSessions/c1`).get()).exists).toBe(true);
  });

  it('is idempotent: re-run returns skipped without creating duplicates', async () => {
    await db.doc(`artifacts/${APP_ID}/users/${UID}/teams/t1`).set({ name: 'A' });
    const first = await migrateUser(db, APP_ID, UID, { dryRun: false });

    const second = await migrateUser(db, APP_ID, UID, { dryRun: false });
    expect(second.status).toBe('skipped');

    const allWorkspaces = await db.collection(`artifacts/${APP_ID}/workspaces`).get();
    expect(allWorkspaces.size).toBe(1);
    expect(allWorkspaces.docs[0].id).toBe(first.newWsId);
  });

  it('dry-run does not write anything', async () => {
    await db.doc(`artifacts/${APP_ID}/users/${UID}/teams/t1`).set({ name: 'A' });

    const result = await migrateUser(db, APP_ID, UID, { dryRun: true });

    expect(result.status).toBe('migrated');
    expect(result.message).toMatch(/DRY-RUN/);
    const wsCount = (await db.collection(`artifacts/${APP_ID}/workspaces`).get()).size;
    expect(wsCount).toBe(0);
  });

  it('migrates a user with no data (just creates workspace + member + cache)', async () => {
    const result = await migrateUser(db, APP_ID, UID, { dryRun: false });
    expect(result.status).toBe('migrated');
    const ws = result.newWsId;
    expect((await db.doc(`artifacts/${APP_ID}/workspaces/${ws}/members/${UID}`).get()).exists).toBe(true);
  });

  it('renames conversations to pickHistory/{wsId}/conversations', async () => {
    await db.doc(`artifacts/${APP_ID}/users/${UID}/conversations/c1`).set({ titulo: 'X' });

    const result = await migrateUser(db, APP_ID, UID, { dryRun: false });
    const ws = result.newWsId;
    const newConv = await db.doc(`artifacts/${APP_ID}/users/${UID}/pickHistory/${ws}/conversations/c1`).get();
    expect(newConv.exists).toBe(true);
  });

  it('adds wsId to existing proactiveNotifications', async () => {
    await db.doc(`artifacts/${APP_ID}/users/${UID}/proactiveNotifications/n1`).set({ message: 'X' });

    const result = await migrateUser(db, APP_ID, UID, { dryRun: false });
    const ws = result.newWsId;
    const notif = await db.doc(`artifacts/${APP_ID}/users/${UID}/proactiveNotifications/n1`).get();
    expect(notif.data().wsId).toBe(ws);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npx vitest run scripts/migration/__tests__/migrateUser.test.js
```

- [ ] **Step 3: Implement**

Create `scripts/migration/lib/migrateUser.js`:

```js
import admin from 'firebase-admin';
import { copyCollection } from './copyCollection.js';
import { copyTeamsRecursive } from './copyTeams.js';
import { moveConversationsToPickHistory } from './conversationsMove.js';
import { addWsIdToNotifications } from './notifsWsId.js';
import { verifyMigration, countDocsRecursive } from './verify.js';

async function findExistingPersonal(db, appId, uid) {
  const snap = await db
    .collection(`artifacts/${appId}/workspaces`)
    .where('type', '==', 'personal')
    .where('ownerId', '==', uid)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

async function countDryRunStats(db, appId, uid) {
  const base = `artifacts/${appId}/users/${uid}`;
  const counts = {};
  for (const name of [
    'brackets',
    'calendarSessions',
    'playoffConvocatorias',
    'exercises',
    'teams',
    'conversations',
    'proactiveNotifications',
  ]) {
    counts[name] = await countDocsRecursive(db, `${base}/${name}`);
  }
  const totalDocs = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, totalDocs };
}

export async function migrateUser(db, appId, uid, { dryRun = false } = {}) {
  // 1. Idempotency check
  const existing = await findExistingPersonal(db, appId, uid);
  if (existing) {
    return { status: 'skipped', message: `personal workspace already exists: ${existing}`, newWsId: existing };
  }

  // 2. Generate wsId
  const newWsId = db.collection(`artifacts/${appId}/workspaces`).doc().id;

  // 3. Dry-run: count, return
  if (dryRun) {
    const { counts, totalDocs } = await countDryRunStats(db, appId, uid);
    return {
      status: 'migrated',
      newWsId,
      message: `[DRY-RUN] would create wsId=${newWsId}, total ${totalDocs} docs across ${JSON.stringify(counts)}`,
    };
  }

  // 4. Create workspace + member + cache atomically
  const now = admin.firestore.FieldValue.serverTimestamp();
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

  // 5. Copy subcollections
  const counts = {};
  counts.brackets = await copyCollection(
    db,
    `artifacts/${appId}/users/${uid}/brackets`,
    `artifacts/${appId}/workspaces/${newWsId}/brackets`,
  );
  counts.calendarSessions = await copyCollection(
    db,
    `artifacts/${appId}/users/${uid}/calendarSessions`,
    `artifacts/${appId}/workspaces/${newWsId}/calendarSessions`,
  );
  counts.playoffConvocatorias = await copyCollection(
    db,
    `artifacts/${appId}/users/${uid}/playoffConvocatorias`,
    `artifacts/${appId}/workspaces/${newWsId}/playoffConvocatorias`,
  );
  counts.exercises = await copyCollection(
    db,
    `artifacts/${appId}/users/${uid}/exercises`,
    `artifacts/${appId}/workspaces/${newWsId}/exercises`,
  );
  counts.teams = await copyTeamsRecursive(db, appId, uid, newWsId);

  // 6. Restructure conversations + add wsId to notifs
  counts.conversations = await moveConversationsToPickHistory(db, appId, uid, newWsId);
  counts.notifications = await addWsIdToNotifications(db, appId, uid, newWsId);

  // 7. Verify counts
  const verify = await verifyMigration(db, appId, uid, newWsId);
  if (!verify.ok) {
    return {
      status: 'failed',
      newWsId,
      error: `verify mismatch: ${JSON.stringify(verify.diffs)}`,
    };
  }

  return {
    status: 'migrated',
    newWsId,
    message: `wsId=${newWsId}, counts=${JSON.stringify(counts)}`,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run scripts/migration/__tests__/migrateUser.test.js
```

Expected: PASS — 7 tests.

### Task 3.9: Implementar entrypoint `migrateToWorkspaces.js`

**Files:**

- Create: `scripts/migration/migrateToWorkspaces.js`

- [ ] **Step 1: Implement CLI entrypoint**

```js
#!/usr/bin/env node
import { initAdmin, getDb, getAuth } from './lib/admin.js';
import { migrateUser } from './lib/migrateUser.js';

function parseArgs(argv) {
  const args = { dryRun: false, user: null, project: null, credentials: null, appId: 'uros-fbm-app' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--user') args.user = argv[++i];
    else if (a === '--project') args.project = argv[++i];
    else if (a === '--credentials') args.credentials = argv[++i];
    else if (a === '--app-id') args.appId = argv[++i];
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

async function listUserUids(args) {
  if (args.user) return [args.user];
  const auth = getAuth();
  const all = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    all.push(...page.users.map((u) => u.uid));
    pageToken = page.pageToken;
  } while (pageToken);
  return all;
}

async function main() {
  const args = parseArgs(process.argv);
  initAdmin({ project: args.project, credentialsPath: args.credentials });
  const db = getDb();

  const uids = await listUserUids(args);
  console.log(`[migrate] target users: ${uids.length}${args.dryRun ? ' [DRY-RUN]' : ''}`);

  const summary = { migrated: 0, skipped: 0, failed: 0, errors: [] };
  for (const uid of uids) {
    try {
      const result = await migrateUser(db, args.appId, uid, { dryRun: args.dryRun });
      summary[result.status]++;
      console.log(`[${uid}] ${result.status}: ${result.message ?? result.error ?? ''}`);
      if (result.status === 'failed') {
        summary.errors.push({ uid, error: result.error });
      }
    } catch (e) {
      summary.failed++;
      summary.errors.push({ uid, error: e.message });
      console.error(`[${uid}] FATAL: ${e.message}`);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
```

- [ ] **Step 2: Make it executable and verify it loads (cannot run without service account, but should not crash on import)**

```bash
node -e "import('./scripts/migration/migrateToWorkspaces.js').then(() => console.log('ok')).catch(e => console.error(e))"
```

Expected: `ok` (or import error if any path is wrong — fix and retry).

### Task 3.10: Commit "feat(scripts): migration script with emulator tests"

- [ ] **Step 1: Verify all migration tests pass**

```bash
firebase emulators:exec --only firestore "npx vitest run scripts/migration/__tests__/"
```

Expected: PASS — all migration tests.

- [ ] **Step 2: Stage and commit**

```bash
git add scripts/migration/
git commit -m "feat(scripts): migration script with emulator tests

Idempotent migrateUser orchestrator with copyCollection (recursive), copyTeamsRecursive,
moveConversationsToPickHistory, addWsIdToNotifications, verifyMigration. CLI entrypoint
with --dry-run, --user, --project, --credentials, --app-id. Tests against Firestore Emulator
cover idempotency, dry-run, edge cases (zero data, missing collections)."
```

---

## Commit 4: refactor: switch services and hooks to workspaceDocRef

For each refactor task: read the file, find every reference to the old user-scoped path, replace with the workspace helper that takes `wsId` from the call site. Existing tests' mocks update to match new paths.

### Task 4.1: Refactor `src/services/teamsService.js`

**Files:**

- Modify: `src/services/teamsService.js`

- [ ] **Step 1: Read existing file**

```bash
cat src/services/teamsService.js
```

- [ ] **Step 2: Update path-building functions**

Replace every collection/doc construction that uses `users/{uid}/...` with the workspace equivalent. The signatures change: pass `wsId` instead of `uid`.

Find:

```js
return collection(db, 'artifacts', appId, 'users', uid, 'teams', teamId, 'members');
```

Replace with:

```js
return collection(db, 'artifacts', appId, 'workspaces', wsId, 'teams', teamId, 'members');
```

Apply the same swap (`'users', uid` → `'workspaces', wsId`) to **every** path-building call in `teamsService.js`. Update function signatures: `(db, appId, uid, ...)` → `(db, appId, wsId, ...)`. Rename internal variable `uid` → `wsId` everywhere it appears in path positions. Functions that receive uid for non-path reasons (e.g., `createdBy`) keep uid; use a separate parameter when both are needed.

- [ ] **Step 3: Update existing tests**

Open `src/services/teamsService.test.js`. Replace all path expectations of the form `artifacts/{appId}/users/{uid}/teams/...` with `artifacts/{appId}/workspaces/{wsId}/teams/...`. Update test fixtures to pass `wsId` instead of `uid` where the function signature requires it.

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/services/teamsService.test.js
```

Expected: PASS.

### Task 4.2: Refactor `src/services/calendarService.js`

**Files:**

- Modify: `src/services/calendarService.js`

- [ ] **Step 1: Apply path swap**

Change every:

```js
collection(db, 'artifacts', appId, 'users', uid, 'calendarSessions');
```

To:

```js
collection(db, 'artifacts', appId, 'workspaces', wsId, 'calendarSessions');
```

Update signatures and internal variable names (`uid` → `wsId`).

- [ ] **Step 2: Run any existing tests**

```bash
npx vitest run src/services/calendarService 2>/dev/null || echo "no tests"
```

If tests exist, update mocks similarly. If not, no action.

### Task 4.3: Refactor `src/services/competitionsService.js`

**Files:**

- Modify: `src/services/competitionsService.js`

- [ ] **Step 1: Apply path swap**

```js
// before
collection(db, 'artifacts', appId, 'users', uid, 'teams', teamId, 'competitions');
// after
collection(db, 'artifacts', appId, 'workspaces', wsId, 'teams', teamId, 'competitions');
```

Update signatures.

### Task 4.4: Refactor `src/services/playoffConvocatoriasService.js`

**Files:**

- Modify: `src/services/playoffConvocatoriasService.js`

Same swap pattern. Path goes from `users/{uid}/playoffConvocatorias` to `workspaces/{wsId}/playoffConvocatorias`.

### Task 4.5: Refactor `src/services/trainingsService.js`

**Files:**

- Modify: `src/services/trainingsService.js`

Two distinct paths in this file:

- `users/{uid}/exercises` → `workspaces/{wsId}/exercises`
- `users/{uid}/teams/{teamId}/trainings` → `workspaces/{wsId}/teams/{teamId}/trainings`

Update both. The functions that previously took `uid` now take `wsId`.

- [ ] **Step 2: Run existing tests**

```bash
npx vitest run src/services/trainingsService.test.js
```

Update mocks if needed.

### Task 4.6: Refactor `src/services/firestoreService.js` y `bracketCalendarSyncService.js`

**Files:**

- Modify: `src/services/firestoreService.js`
- Modify: `src/services/bracketCalendarSyncService.js`

Both files build paths to `users/{uid}/brackets/{id}`. Change to `workspaces/{wsId}/brackets/{id}`.

In `firestoreService.js` line 37:

```js
// before
userDocRef(db, appId, user.uid, 'brackets', updatedBracket.id),
// after
workspaceDocRef(db, appId, wsId, 'brackets', updatedBracket.id),
```

Pass `wsId` from callers. The shared bracket path (`shared/{shareCode}`) stays unchanged.

In `bracketCalendarSyncService.js` line 20:

```js
// before
const userRef = userDocRef(db, appId, uid, 'brackets', bracketId);
// after
const userRef = workspaceDocRef(db, appId, wsId, 'brackets', bracketId);
```

### Task 4.7: Refactor `src/services/scoutingService.js`, `analysisService.js`, `planillaService.js`

**Files:**

- Modify: `src/services/scoutingService.js`
- Modify: `src/services/analysisService.js`
- Modify: `src/services/planillaService.js`

Each builds sub-paths under `teams/{teamId}/...`. Apply the same swap. Each function's signature changes from accepting `uid` to `wsId` for path construction. Where the current function uses both (e.g., for `createdBy`), retain `uid` as a separate parameter.

### Task 4.8: Refactor `src/services/proposalExecutor.ts`

**Files:**

- Modify: `src/services/proposalExecutor.ts`

In line 85:

```ts
// before
const userRef = userDocRef(ctx.db, ctx.appId, ctx.uid, 'brackets', bracketId);
// after
const userRef = workspaceDocRef(ctx.db, ctx.appId, ctx.wsId, 'brackets', bracketId);
```

Update `ProposalExecutorContext` type to include `wsId: string`. All callers (Pick agent code) pass `wsId` from `useWorkspace()`.

- [ ] **Step 1: Update tests in `proposalExecutor.test.ts`**

The existing assertion at line 89:

```ts
expect.objectContaining({ path: 'artifacts/app1/users/u1/brackets/b1' }),
```

Becomes:

```ts
expect.objectContaining({ path: 'artifacts/app1/workspaces/w1/brackets/b1' }),
```

Update test fixtures to pass `wsId: 'w1'` in context.

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/services/proposalExecutor.test.ts
```

Expected: PASS.

### Task 4.9: Refactor `src/services/backupService.js`

**Files:**

- Modify: `src/services/backupService.js`

Lines 44-47 and 90-92 build paths under `base = ['artifacts', appId, 'users', uid]`. The base needs two variants now — workspace-scoped paths for product data, user-scoped for `profile/main`. Refactor:

```js
// before
const base = ['artifacts', appId, 'users', uid];
const [exercises, calendarSessions, brackets, scoutings, analisis, planillas] = await Promise.all([
  readCollection(db, ...base, 'exercises'),
  readCollection(db, ...base, 'calendarSessions'),
  ...
]);

// after
const wsBase = ['artifacts', appId, 'workspaces', wsId];
const userBase = ['artifacts', appId, 'users', uid];
const [exercises, calendarSessions, brackets, scoutings, analisis, planillas] = await Promise.all([
  readCollection(db, ...wsBase, 'exercises'),
  readCollection(db, ...wsBase, 'calendarSessions'),
  readCollection(db, ...wsBase, 'brackets'),
  ... // etc., wsBase for product data
]);
const profileSnap = await getDoc(doc(db, ...userBase, 'profile', 'main'));
```

Update signature: `backupService` now takes `(db, appId, uid, wsId, ...)` or accepts a `WorkspaceContext` object with both.

### Task 4.10: Refactor `src/hooks/useBracketSync.js`, `useBracketEditor.js`, `useBracketCreation.js`

**Files:**

- Modify: `src/hooks/useBracketSync.js`
- Modify: `src/hooks/useBracketEditor.js`
- Modify: `src/hooks/useBracketCreation.js`

In each hook:

```jsx
// add import at top
import { useWorkspace } from '@/contexts/WorkspaceContext';

// inside hook body, replace any path-building that used uid
const { activeWsId } = useWorkspace();
// then: workspaceDocRef(db, appId, activeWsId, 'brackets', bracketId)
```

The existing reference to `users/{uid}/brackets/...` (e.g., in `useBracketSync.js` line 151's pendingShareCode read of `shared/{code}` — that one stays under shared, unchanged). Only the local-bracket paths swap.

- [ ] **Step 1: Update each hook**

Apply the pattern. Run any existing tests:

```bash
npx vitest run src/hooks/useBracketSync 2>/dev/null
```

Update mocks if needed.

### Task 4.11: Refactor `src/hooks/useCalendarSessions.js` y `useHomeDashboard.js`

**Files:**

- Modify: `src/hooks/useCalendarSessions.js`
- Modify: `src/hooks/useHomeDashboard.js`

Same pattern: import `useWorkspace`, read `activeWsId`, use it in paths. Update existing tests in `useHomeDashboard.test.js` to expect new paths.

### Task 4.12: Refactor `src/hooks/useSharing.js`

**Files:**

- Modify: `src/hooks/useSharing.js`

Sharing hook deals with both local brackets (`users/{uid}/brackets/...` → workspace) and shared brackets (`shared/{shareCode}` → unchanged). Be careful to swap only the local paths.

In line 109 (and similar):

```js
// before
doc(db, 'artifacts', appId, 'users', user.uid, 'brackets', sharingBracket.id),
// after
doc(db, 'artifacts', appId, 'workspaces', activeWsId, 'brackets', sharingBracket.id),
```

The shared cursor path at line 45 stays as is (presence is shared, not workspace).

### Task 4.13: Refactor `src/hooks/useConversationPersistence.ts` (Pick history restructure)

**Files:**

- Modify: `src/hooks/useConversationPersistence.ts`

Current path at line 54:

```ts
return collection(db, 'artifacts', appId, 'users', user.uid, 'conversations');
```

Becomes:

```ts
return collection(db, 'artifacts', appId, 'users', user.uid, 'pickHistory', activeWsId, 'conversations');
```

And at line 60:

```ts
return collection(
  db,
  'artifacts',
  appId,
  'users',
  user.uid,
  'pickHistory',
  activeWsId,
  'conversations',
  convId,
  'messages',
);
```

Add `useWorkspace` import. The hook now requires `activeWsId` to be defined; if `null`, the hook returns null/empty (consistent with how it behaves when there's no user).

### Task 4.14: Refactor `src/hooks/useProactiveNotifications.js` (filter by wsId)

**Files:**

- Modify: `src/hooks/useProactiveNotifications.js`

Current path at line 27:

```js
const colRef = collection(db, 'artifacts', appId, 'users', uid, 'proactiveNotifications');
```

Stays under user, **but** the read query adds a filter:

```js
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { query, where } from 'firebase/firestore';

const { activeWsId } = useWorkspace();
const colRef = collection(db, 'artifacts', appId, 'users', user.uid, 'proactiveNotifications');
const filteredQuery = activeWsId ? query(colRef, where('wsId', '==', activeWsId)) : null;
// ... onSnapshot(filteredQuery, ...) when activeWsId is non-null
```

Notif creators (Cloud Functions, server side) must include `wsId` field on every new notif from now on. (Server side updates are out of scope for sub-proyecto 1; existing function-side notif creators are tracked in functions/ and updated separately if any.)

### Task 4.15: Refactor `BracketScreen.jsx`, `PlanillaSextosScreen.jsx`, `AnalysisScreen.jsx`, `ScoutingScreen.jsx`

**Files:**

- Modify: `src/screens/BracketScreen.jsx`
- Modify: `src/screens/PlanillaSextosScreen.jsx`
- Modify: `src/screens/AnalysisScreen.jsx`
- Modify: `src/screens/ScoutingScreen.jsx`

These screens have direct `doc(db, 'artifacts', appId, 'users', user.uid, 'brackets', ...)` calls. Replace with `workspaceDocRef(db, appId, activeWsId, 'brackets', ...)`. Add `useWorkspace` import. Path constructed via the helper, not raw.

In `BracketScreen.jsx` line 286:

```jsx
// before
doc(db, 'artifacts', appId, 'users', user.uid, 'brackets', activeBracket.id),
// after
workspaceDocRef(db, appId, activeWsId, 'brackets', activeBracket.id),
```

In `AnalysisScreen.jsx` line 87, the path uses `shared` (unchanged) — verify and skip if not local.

### Task 4.16: Run full test suite to verify no regressions

- [ ] **Step 1: Run tests**

```bash
npm test
```

Expected: ALL EXISTING TESTS PASS. Any failure indicates a missed reference or a mock that needs updating.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Run build to verify no type/import errors**

```bash
npm run build:client
```

Expected: build succeeds.

### Task 4.17: Commit "refactor: switch services and hooks to workspaceDocRef"

- [ ] **Step 1: Stage and commit**

```bash
git add src/services/ src/hooks/ src/screens/
git commit -m "refactor: switch services and hooks to workspaceDocRef

22 files refactored to consume useWorkspace().activeWsId and pass it through workspaceDocRef/
workspaceColRef. userDocRef stays for profile, memberships, pickHistory, proactiveNotifications.
useConversationPersistence path is restructured to users/{uid}/pickHistory/{wsId}/conversations.
useProactiveNotifications filters by wsId via where clause. shared/, presence/, shared-exercises/
paths untouched."
```

---

## Commit 5: feat(rules): firestore rules for workspaces with emulator tests

### Task 5.1: Update `firestore.rules`

**Files:**

- Modify: `firestore.rules`

- [ ] **Step 1: Replace contents**

Replace `firestore.rules` with:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isWorkspaceMember(appId, wsId) {
      return exists(/databases/$(database)/documents/
        artifacts/$(appId)/workspaces/$(wsId)/members/$(request.auth.uid));
    }

    function isWorkspaceOwner(appId, wsId) {
      return isSignedIn() &&
        get(/databases/$(database)/documents/artifacts/$(appId)/workspaces/$(wsId))
          .data.ownerId == request.auth.uid;
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
      return exists(sharedPath(appId, shareCode)) && canReadSharedData(get(sharedPath(appId, shareCode)).data);
    }

    // Workspace doc + subcolecciones (NUEVO)
    match /artifacts/{appId}/workspaces/{wsId} {
      allow read:   if isSignedIn() && isWorkspaceMember(appId, wsId);
      allow create: if isSignedIn() && request.resource.data.ownerId == request.auth.uid;
      allow update: if isWorkspaceOwner(appId, wsId);
      allow delete: if isWorkspaceOwner(appId, wsId);

      match /members/{memberUid} {
        allow read:                   if isSignedIn() && isWorkspaceMember(appId, wsId);
        allow create, update, delete: if isWorkspaceOwner(appId, wsId);
      }

      match /{collection}/{docId=**} {
        allow read, write: if isSignedIn() && isWorkspaceMember(appId, wsId);
      }
    }

    // User-private data (scope ahora más estrecho: profile, memberships, pickHistory, proactiveNotifications)
    match /artifacts/{appId}/users/{uid}/{document=**} {
      allow read, write: if isSignedIn() && request.auth.uid == uid;
    }

    // Shared (sin cambios)
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

### Task 5.2: Tests para las nuevas reglas

**Files:**

- Create: `firestore.rules.test.ts`

- [ ] **Step 1: Write rules tests**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

let testEnv: RulesTestEnvironment;
const APP_ID = 'app1';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'pickncoach-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => testEnv.cleanup());

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed: workspace WS_A owned by U_A; workspace WS_B owned by U_B
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`artifacts/${APP_ID}/workspaces/WS_A`).set({
      type: 'personal',
      name: 'Mi cuenta',
      ownerId: 'U_A',
      plan: 'free',
      billing: null,
    });
    await db.doc(`artifacts/${APP_ID}/workspaces/WS_A/members/U_A`).set({ role: 'owner' });
    await db.doc(`artifacts/${APP_ID}/workspaces/WS_B`).set({
      type: 'personal',
      name: 'Otra',
      ownerId: 'U_B',
      plan: 'free',
      billing: null,
    });
    await db.doc(`artifacts/${APP_ID}/workspaces/WS_B/members/U_B`).set({ role: 'owner' });
  });
});

describe('firestore.rules — workspaces', () => {
  it('member can read their workspace doc', async () => {
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/workspaces/WS_A`).get());
  });

  it('non-member cannot read workspace doc', async () => {
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/WS_B`).get());
  });

  it('unauthenticated cannot read workspace doc', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/WS_A`).get());
  });

  it('member can read+write subcollections of their workspace', async () => {
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/workspaces/WS_A/teams/t1`).set({ name: 'X' }));
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/workspaces/WS_A/teams/t1/cuaderno/jugadores`).set({ rows: [] }));
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/workspaces/WS_A/brackets/b1`).set({ name: 'BR' }));
  });

  it('non-member cannot read+write subcollections of another workspace', async () => {
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/WS_B/teams/t1`).set({ name: 'X' }));
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/WS_B/brackets/b1`).get());
  });

  it('user can create a workspace where they are owner', async () => {
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertSucceeds(
      db.doc(`artifacts/${APP_ID}/workspaces/WS_NEW`).set({
        type: 'personal',
        name: 'New',
        ownerId: 'U_A',
        plan: 'free',
        billing: null,
      }),
    );
  });

  it('user cannot create a workspace where ownerId is someone else', async () => {
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertFails(
      db.doc(`artifacts/${APP_ID}/workspaces/WS_FAKE`).set({
        type: 'personal',
        name: 'Fake',
        ownerId: 'U_B',
        plan: 'free',
        billing: null,
      }),
    );
  });

  it('owner can update workspace doc', async () => {
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/workspaces/WS_A`).update({ name: 'Renamed' }));
  });

  it('non-owner member cannot update workspace doc (V1 lock)', async () => {
    // Add U_C as a member of WS_A (not owner)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`artifacts/${APP_ID}/workspaces/WS_A/members/U_C`).set({ role: 'coach' });
    });
    const db = testEnv.authenticatedContext('U_C').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/WS_A`).update({ name: 'Hacked' }));
  });

  it('owner can write members subcollection (add member)', async () => {
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/workspaces/WS_A/members/U_C`).set({ role: 'coach' }));
  });

  it('non-owner member cannot write members subcollection', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`artifacts/${APP_ID}/workspaces/WS_A/members/U_C`).set({ role: 'coach' });
    });
    const db = testEnv.authenticatedContext('U_C').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/workspaces/WS_A/members/U_X`).set({ role: 'coach' }));
  });
});

describe('firestore.rules — users (private data, unchanged effect)', () => {
  it('user reads their own private data', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`artifacts/${APP_ID}/users/U_A/profile/main`).set({ theme: 'light' });
    });
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/users/U_A/profile/main`).get());
  });

  it('user cannot read another users private data', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`artifacts/${APP_ID}/users/U_B/profile/main`).set({ theme: 'dark' });
    });
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertFails(db.doc(`artifacts/${APP_ID}/users/U_B/profile/main`).get());
  });

  it('user reads their memberships', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`artifacts/${APP_ID}/users/U_A/memberships/WS_A`).set({ role: 'owner' });
    });
    const db = testEnv.authenticatedContext('U_A').firestore();
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/users/U_A/memberships/WS_A`).get());
  });
});

describe('firestore.rules — shared (unchanged)', () => {
  it('shared bracket with linkAccess=view is readable by signed-in user', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc(`artifacts/${APP_ID}/shared/SHARE1`)
        .set({
          shareConfig: { ownerId: 'U_A', linkAccess: 'view' },
        });
    });
    const db = testEnv.authenticatedContext('U_C').firestore();
    await assertSucceeds(db.doc(`artifacts/${APP_ID}/shared/SHARE1`).get());
  });
});
```

- [ ] **Step 2: Run rules tests**

In one terminal:

```bash
firebase emulators:start --only firestore
```

In another:

```bash
npx vitest run firestore.rules.test.ts
```

Expected: PASS — all rules tests.

### Task 5.3: Commit "feat(rules): firestore rules for workspaces with emulator tests"

- [ ] **Step 1: Stage and commit**

```bash
git add firestore.rules firestore.rules.test.ts
git commit -m "feat(rules): firestore rules for workspaces with emulator tests

V1 rules: workspace doc + subcollections gated by isWorkspaceMember (single exists()
per request); members/ subcollection writable only by owner; user-private data
remains scoped to uid; shared/, presence/, shared-exercises/ unchanged. Emulator
tests cover member/non-member/unauth, ownership creation, owner-only writes."
```

---

## Commit 6: chore: cleanup script and smoke checklist

### Task 6.1: Implementar `scripts/cleanupOldPaths.js`

**Files:**

- Create: `scripts/cleanupOldPaths.js`

- [ ] **Step 1: Implement**

```js
#!/usr/bin/env node
import { initAdmin, getDb, getAuth } from './migration/lib/admin.js';

const OLD_COLLECTIONS_TO_DELETE = [
  'teams',
  'brackets',
  'calendarSessions',
  'playoffConvocatorias',
  'exercises',
  'conversations',
];

function parseArgs(argv) {
  const args = { dryRun: false, project: null, credentials: null, appId: 'uros-fbm-app' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--project') args.project = argv[++i];
    else if (a === '--credentials') args.credentials = argv[++i];
    else if (a === '--app-id') args.appId = argv[++i];
  }
  return args;
}

async function deleteCollectionRecursive(db, path, dryRun) {
  const snap = await db.collection(path).get();
  let deleted = 0;
  for (const docSnap of snap.docs) {
    const subcols = await docSnap.ref.listCollections();
    for (const sub of subcols) {
      deleted += await deleteCollectionRecursive(db, `${path}/${docSnap.id}/${sub.id}`, dryRun);
    }
    if (!dryRun) await docSnap.ref.delete();
    deleted++;
  }
  return deleted;
}

async function listUserUids(db) {
  const auth = getAuth();
  const all = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    all.push(...page.users.map((u) => u.uid));
    pageToken = page.pageToken;
  } while (pageToken);
  return all;
}

async function main() {
  const args = parseArgs(process.argv);
  initAdmin({ project: args.project, credentialsPath: args.credentials });
  const db = getDb();

  const uids = await listUserUids(db);
  console.log(`[cleanup] target users: ${uids.length}${args.dryRun ? ' [DRY-RUN]' : ''}`);

  let totalDeleted = 0;
  for (const uid of uids) {
    let perUser = 0;
    for (const col of OLD_COLLECTIONS_TO_DELETE) {
      const path = `artifacts/${args.appId}/users/${uid}/${col}`;
      const count = await deleteCollectionRecursive(db, path, args.dryRun);
      perUser += count;
    }
    totalDeleted += perUser;
    console.log(`[${uid}] ${args.dryRun ? 'would delete' : 'deleted'} ${perUser} docs`);
  }
  console.log(`\nTotal ${args.dryRun ? 'would delete' : 'deleted'}: ${totalDeleted} docs`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
```

### Task 6.2: Crear smoke checklist en `docs/runbooks/`

**Files:**

- Create: `docs/runbooks/cutover-smoke-checklist.md`

- [ ] **Step 1: Create directory if missing**

```bash
mkdir -p docs/runbooks
```

- [ ] **Step 2: Create checklist**

````markdown
# Cutover smoke checklist — Sub-proyecto 1

Tras el cutover de la migración a `workspaces/{wsId}/`, ejecutar este checklist sobre 3 cuentas reales (la del dev + 2 conocidos) antes de quitar el banner de mantenimiento. Tiempo estimado: 5–10 min.

## Sobre cada cuenta

- [ ] Login funciona, redirect a `/area-privada/`.
- [ ] `HomeScreen` carga, lista de teams visible, contador de jugadores correcto.
- [ ] Abrir un team → cuaderno completo carga: jugadores, test-tiro, asistencia, informe-jugadores, notas, pilares, normas.
- [ ] Calendario carga sesiones (entrenamientos + partidos + playoffs virtuales).
- [ ] Abrir un bracket existente, ver matches y winners propagados correctamente.
- [ ] Crear un nuevo team. Verificar en Firestore Console que el doc se ha creado en `workspaces/{wsId}/teams/`, no en `users/{uid}/teams/`.
- [ ] Abrir Pick → enviar mensaje rápido → recibir respuesta. Verificar en Firestore Console que la conversación está en `users/{uid}/pickHistory/{wsId}/conversations/`.
- [ ] Mandar una convocatoria desde el calendario → marca `convocatoriaSentAt`. Verificar el path nuevo.
- [ ] `/pendientes` muestra los items correctos. Confirmar que los notifs proactivos siguen filtrados por `wsId`.
- [ ] Settings (`profile/main`) sigue funcionando, sin cambios visibles.
- [ ] Logout y re-login → `activeWsId` se restaura desde localStorage al workspace personal.

## Si algún punto falla

1. Anotar el path Firestore exacto del doc problemático.
2. Decisión binaria:
   - **Rollback**: redeploy del código previo + reglas previas. Datos antiguos en `users/{uid}/...` están intactos. Investigar offline.
   - **Fix-forward**: si es trivial (un path mal en un servicio), patch+deploy en caliente. Solo si la confianza es alta.
3. Banner de mantenimiento se mantiene hasta resolver.

## Cleanup a 30 días

Si tras 30 días no han aparecido bugs, ejecutar:

```bash
node scripts/cleanupOldPaths.js --dry-run    # verifica conteos
node scripts/cleanupOldPaths.js              # elimina paths antiguos
```
````

````

### Task 6.3: Commit "chore: cleanup script + smoke checklist"

- [ ] **Step 1: Stage and commit**

```bash
git add scripts/cleanupOldPaths.js docs/runbooks/cutover-smoke-checklist.md
git commit -m "chore: cleanup script and smoke checklist for cutover

cleanupOldPaths.js iterates all auth users, recursively deletes the legacy paths
under users/{uid}/ (teams, brackets, calendarSessions, playoffConvocatorias,
exercises, conversations). Idempotent: safe to re-run. cutover-smoke-checklist.md
is the post-cutover manual verification."
````

---

## Final: push and PR

### Task 7.1: Push branch

- [ ] **Step 1: Push**

```bash
git push -u origin feat/workspaces-foundation
```

### Task 7.2: Open PR (manual)

- [ ] **Step 1: Open PR via gh CLI**

```bash
gh pr create --title "feat(workspaces): foundation for B2B clubs (sub-proyecto 1)" --body "$(cat <<'EOF'
## Summary

Implementa sub-proyecto 1 del salto a B2B clubs y monetización: migración del modelo de datos de `users/{uid}/...` a `workspaces/{wsId}/...`, con un workspace personal autogenerado para cada usuario actual. Todos los datos del producto (teams, brackets, calendar, etc.) viven ahora bajo un workspace; los datos privados del user (profile, memberships, pickHistory, proactiveNotifications) quedan bajo `users/`.

Los clubs **no** llegan en este PR — son sub-proyectos 3-4. Este PR solo cambia el modelo y crea un workspace personal por usuario, dejando todo listo para que los siguientes sub-proyectos añadan invitaciones, vista DT y monetización sobre el modelo nuevo.

## Spec

`docs/superpowers/specs/2026-05-01-sub-proyecto-1-modelo-cuenta-workspace-migracion-design.md`

## Changes

- `feat(workspaces)`: path helpers + types
- `feat(workspaces)`: WorkspaceContext provider + useWorkspace hook
- `feat(scripts)`: idempotent migration script with Firestore Emulator tests
- `refactor`: 22 services/hooks/screens switched to workspace paths
- `feat(rules)`: Firestore rules rewritten for workspaces (V1 permissive within workspace)
- `chore`: cleanup script for 30-day old-paths removal + cutover smoke checklist

## Test plan

- [x] All existing tests pass
- [x] New unit tests for path helpers, WorkspaceContext, resolveActiveWsId
- [x] Emulator tests for migration script: idempotency, dry-run, edge cases
- [x] Emulator tests for Firestore rules: member/non-member, owner/non-owner, shared unchanged
- [ ] **Pending: maintenance window cutover** — backup + run script + smoke checklist on 3 real accounts

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Task 7.3: Self-review the PR before merge

- [ ] **Step 1: Visit the PR URL printed by gh**

- [ ] **Step 2: Review every commit individually**

For each of the 7 commits in the branch, click "Files changed" and verify:

1. No leftover `users/{uid}/teams/` paths in product-data services.
2. No leftover `userDocRef` calls for product data (only profile/memberships/pickHistory/proactiveNotifications).
3. All hooks now `useWorkspace()` for product data.
4. `WorkspaceProvider` is mounted between `AuthProvider` and `ScreenContextProvider`.
5. `firestore.rules` has the new workspace block.

- [ ] **Step 3: Run all tests one last time on local**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: If anything is missed, fix in a new commit, push, repeat from Step 1**

---

## Cutover (out-of-plan; runbook execution)

The actual cutover is **runbook execution**, not code work. Execute on a Sunday ~04:00 hora España. See `docs/superpowers/specs/2026-05-01-sub-proyecto-1-modelo-cuenta-workspace-migracion-design.md` section 5 for the procedure (backup, deploy with banner, run script, verify, cutover deploy, smoke checklist).

After the cutover succeeds, schedule the 30-day cleanup with `/schedule` in a new session.

---

## Self-review (for the plan author)

Spec coverage check (each section of the spec must map to at least one task):

- ✅ Spec §1 Schema → Task 1.1, 1.2 (helpers); Task 2.1, 2.2 (context); Task 4.1–4.16 (refactor uses schema); Task 3.8 (migrateUser creates workspace doc with the schema fields)
- ✅ Spec §2 Path helpers + 22 files → Task 1.1–1.3 (helpers), Task 4.1–4.16 (every file in the inventory)
- ✅ Spec §3 WorkspaceContext → Task 2.1–2.5
- ✅ Spec §4 Migration algorithm → Task 3.1–3.10 (every helper + orchestrator + entrypoint)
- ✅ Spec §5 Cutover procedure → out of plan, in cutover-smoke-checklist.md (Task 6.2) + spec section
- ✅ Spec §6 Firestore rules V1 → Task 5.1, 5.2
- ✅ Spec §7 PR strategy → Task 4.17 + final PR section
- ✅ Spec §8 Testing → Task 1.1, 2.1, 3.2–3.8, 5.2 (all unit + integration); smoke in Task 6.2
- ✅ Spec §9 Cleanup → Task 6.1
- ✅ Spec §11 Constraints alignment → preserved by design throughout (single code path, plan field as string, etc.)

Placeholder scan: clean — no TBDs, TODOs, or "fill in later" patterns. Quotas like "~50 mensajes" are deliberately deferred to sub-proyecto 5 and not in this plan.

Type/method consistency: `workspaceDocRef`, `workspaceColRef`, `useWorkspace`, `activeWsId`, `resolveActiveWsId` consistent across tasks. `migrateUser`, `copyCollection`, `copyTeamsRecursive`, `verifyMigration` consistent.

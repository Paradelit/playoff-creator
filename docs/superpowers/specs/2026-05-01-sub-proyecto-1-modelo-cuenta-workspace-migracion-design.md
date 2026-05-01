# Sub-proyecto 1 — Modelo de cuenta y workspace + migración

**Fecha:** 2026-05-01
**Estado:** Aprobado, pendiente de plan de implementación
**Autor:** Sergio Paradela (con Claude)
**Predecesor:** [Sub-proyecto 0 — Decisiones fundacionales](./2026-05-01-sub-proyecto-0-decisiones-fundacionales-design.md)
**Sucesor inmediato:** Sub-proyecto 5 — Monetización B2C (B2C-first dentro del bloque de monetización)

---

## 0. Por qué existe este spec

Sub-proyecto 0 fijó la constitución: una identidad por usuario, N memberships en workspaces, todo dato del producto bajo `workspaces/{wsId}/...`, migración M1 + D1. Este sub-proyecto **convierte la constitución en código y datos en producción**.

El alcance es deliberadamente acotado: V1 deploya solo el cambio de modelo + creación de un workspace personal para cada usuario actual. Los clubs **no** aparecen aquí (llegan en sub-proyecto 3-4); la matriz de permisos por rol **no** se refina aquí (llega en sub-proyecto 2); el paywall **no** se gatea aquí (llega en sub-proyecto 5).

El éxito de este sub-proyecto es invisible para el usuario: tras el cutover, todo funciona exactamente igual que antes, pero el modelo de datos subyacente está listo para soportar clubs.

---

## 1. Schema final

### 1.1 `workspaces/{wsId}/` — nuevo top-level

`wsId` se genera con `doc(collection(db, 'artifacts', appId, 'workspaces')).id` (Firestore auto-id, random, uniforme entre personal y club).

#### Doc principal

```ts
{
  type: 'personal' | 'club',
  name: string,                           // "Mi cuenta" para personal; custom para club
  ownerId: string,                        // uid del owner inicial; denormalizado desde members
                                          // para permitir checks rápidos en reglas Firestore
  createdAt: Timestamp,
  updatedAt: Timestamp,
  plan: string,                           // 'free' | 'pro' | 'max' | ... (string libre)
  planUpdatedAt: Timestamp | null,
  billing: {                              // null en V1; poblado en sub-proyectos 5/6
    stripeCustomerId?: string,
    stripeSubscriptionId?: string,
    currentPeriodEnd?: Timestamp,
    seatCount?: number,                   // solo B2B; null para personal
  } | null,
  logoUrl?: string,                       // solo club; opcional
}
```

#### `workspaces/{wsId}/members/{memberUid}`

```ts
{
  role: 'owner' | 'admin-billing' | 'dt' | 'coach',
  assignedTeamIds: string[],              // vacío en V1; cobra sentido en sub-proyecto 3
  joinedAt: Timestamp,
}
```

Doc id = uid del miembro. Para workspace personal: un único doc con `role: 'owner'` y `assignedTeamIds: []`.

#### Subcolecciones de datos del workspace

Mismo shape que hoy bajo `users/{uid}/...`, solo cambia el prefijo de path:

| Path nuevo                                                                                                                | Path antiguo equivalente                                  |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `workspaces/{wsId}/teams/{teamId}/`                                                                                       | `users/{uid}/teams/{teamId}/`                             |
| `workspaces/{wsId}/teams/{teamId}/members/{memberDocId}`                                                                  | `users/{uid}/teams/{teamId}/members/{memberDocId}`        |
| `workspaces/{wsId}/teams/{teamId}/trainings/{trainingId}`                                                                 | `users/{uid}/teams/{teamId}/trainings/{trainingId}`       |
| `workspaces/{wsId}/teams/{teamId}/competitions/{competitionId}`                                                           | `users/{uid}/teams/{teamId}/competitions/{competitionId}` |
| `workspaces/{wsId}/teams/{teamId}/cuaderno/{jugadores\|test-tiro\|asistencia\|informe-jugadores\|notas\|pilares\|normas}` | `users/{uid}/teams/{teamId}/cuaderno/...`                 |
| `workspaces/{wsId}/brackets/{bracketId}`                                                                                  | `users/{uid}/brackets/{bracketId}`                        |
| `workspaces/{wsId}/calendarSessions/{sessionId}`                                                                          | `users/{uid}/calendarSessions/{sessionId}`                |
| `workspaces/{wsId}/playoffConvocatorias/{playoffSessionId}`                                                               | `users/{uid}/playoffConvocatorias/{playoffSessionId}`     |
| `workspaces/{wsId}/exercises/{exerciseId}`                                                                                | `users/{uid}/exercises/{exerciseId}`                      |

### 1.2 `users/{uid}/` — más focalizado tras la migración

#### Sin cambios

```ts
profile/main: {
  // UI prefs (theme, idioma), notif config, cualquier otra preferencia personal
  // (campos existentes, intactos)
}
```

#### Nuevo: `memberships/{wsId}` (denormalización)

```ts
{
  role: string,                           // copia de workspaces/{wsId}/members/{uid}.role
  workspaceName: string,                  // cache de workspaces/{wsId}.name
  workspaceType: 'personal' | 'club',     // cache de workspaces/{wsId}.type
  joinedAt: Timestamp,
}
```

**Source of truth**: `workspaces/{wsId}/members/{uid}`. Esta colección bajo el user es **cache** para el context selector rápido. Drift aceptado: si el `name` del workspace cambia, el cache puede mostrar el viejo hasta que se actualice perezosamente (en el próximo guardado de la membership o en una suscripción al workspace doc cuando esté activo). No se propaga vía Cloud Functions.

#### Nuevo: `pickHistory/{wsId}/conversations/...`

Restructura del actual `users/{uid}/conversations/`. Las conversaciones quedan scopeadas al workspace donde transcurrieron. Si el usuario pierde acceso al workspace, su historial sigue en su cuenta pero la UI no lo carga (no hay forma de seleccionar el workspace inactivo en el selector).

```ts
pickHistory/{wsId}/conversations/{convId}: { ...campos existentes }
pickHistory/{wsId}/conversations/{convId}/messages/{messageId}: { ...campos existentes }
```

#### Modificado: `proactiveNotifications/{notifId}` con campo `wsId`

```ts
proactiveNotifications/{notifId}: {
  wsId: string,                           // NUEVO: identifica el workspace que generó el notif
  // resto de campos existentes intactos
}
```

UI filtra por workspace activo: `query(colRef, where('wsId', '==', activeWsId))`.

### 1.3 Inalterado en este sub-proyecto

- `artifacts/{appId}/shared/{shareCode}` (brackets compartidos): mismo path, mismas reglas. Los `shareConfig.ownerId` siguen apuntando al uid del usuario; se decidirá en futuros sub-proyectos si los brackets compartidos se mueven a `workspaces/` o se mantienen como datos cross-workspace.
- `artifacts/{appId}/presence/{shareCode}/cursors/...`: sin cambios.
- `artifacts/{appId}/shared-exercises/{shareCode}`: sin cambios.

---

## 2. Path helpers y refactor de servicios

### 2.1 Helpers nuevos en `src/services/firestoreHelpers.js`

Conviven con los existentes `userDocRef`/`userColRef` (que pasan a usarse solo para datos privados del user: `profile`, `memberships`, `pickHistory`, `proactiveNotifications`).

```ts
import { doc, collection } from 'firebase/firestore';

/**
 * Build a ref to a workspace-scoped document.
 * Soporta paths anidados via varargs: workspaceDocRef(db, appId, wsId, 'teams', teamId, 'cuaderno', 'jugadores')
 */
export function workspaceDocRef(db, appId, wsId, ...pathSegments) {
  return doc(db, 'artifacts', appId, 'workspaces', wsId, ...pathSegments);
}

/**
 * Build a ref to a workspace-scoped collection.
 * Varargs igual: workspaceColRef(db, appId, wsId, 'teams', teamId, 'trainings')
 */
export function workspaceColRef(db, appId, wsId, ...pathSegments) {
  return collection(db, 'artifacts', appId, 'workspaces', wsId, ...pathSegments);
}

/**
 * Save a workspace-scoped document with merge + auto-timestamps.
 */
export async function saveWorkspaceDoc(db, appId, wsId, pathSegments, data) {
  // pathSegments: array de strings, e.g. ['teams', teamId, 'cuaderno', 'jugadores']
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

### 2.2 Inventario de archivos a refactorizar

22 archivos invocan `userDocRef`/`userColRef` o construyen paths a mano bajo `users/{uid}/`. Para cada uno se decide qué pasa al nuevo helper de workspace y qué se queda como datos privados del user.

#### Servicios con paths que mueven a workspace

| Archivo                                                                                     | Path antiguo                                                            | Path nuevo                                                                          |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `services/teamsService.js`                                                                  | `users/{uid}/teams/{teamId}/...`                                        | `workspaces/{wsId}/teams/{teamId}/...`                                              |
| `services/calendarService.js`                                                               | `users/{uid}/calendarSessions/...`                                      | `workspaces/{wsId}/calendarSessions/...`                                            |
| `services/competitionsService.js`                                                           | `users/{uid}/teams/{teamId}/competitions/...`                           | `workspaces/{wsId}/teams/{teamId}/competitions/...`                                 |
| `services/playoffConvocatoriasService.js`                                                   | `users/{uid}/playoffConvocatorias/...`                                  | `workspaces/{wsId}/playoffConvocatorias/...`                                        |
| `services/trainingsService.js` (parcial — `exercises` y `trainings` mueven)                 | `users/{uid}/exercises/...`, `users/{uid}/teams/{teamId}/trainings/...` | `workspaces/{wsId}/exercises/...`, `workspaces/{wsId}/teams/{teamId}/trainings/...` |
| `services/firestoreService.js` (brackets)                                                   | `users/{uid}/brackets/...`                                              | `workspaces/{wsId}/brackets/...`                                                    |
| `services/bracketCalendarSyncService.js` (brackets locales)                                 | `users/{uid}/brackets/...`                                              | `workspaces/{wsId}/brackets/...`                                                    |
| `services/scoutingService.js`, `services/analysisService.js`, `services/planillaService.js` | sub-paths bajo team                                                     | sub-paths bajo team del workspace                                                   |
| `services/proposalExecutor.ts` (Pick agent — escribe brackets)                              | path de bracket bajo user                                               | path de bracket bajo workspace                                                      |
| `hooks/useBracketSync.js`, `useBracketEditor.js`, `useBracketCreation.js`                   | brackets bajo user                                                      | brackets bajo workspace                                                             |
| `hooks/useCalendarSessions.js`                                                              | sessions bajo user                                                      | sessions bajo workspace                                                             |
| `hooks/useHomeDashboard.js`                                                                 | múltiples reads bajo user                                               | múltiples reads bajo workspace                                                      |
| `hooks/useSharing.js`                                                                       | brackets locales bajo user; shared queda igual                          | brackets locales bajo workspace                                                     |
| `screens/PlanillaSextosScreen.jsx`, `AnalysisScreen.jsx`, `ScoutingScreen.jsx`              | refs directas en componentes                                            | a través de servicios refactorizados                                                |
| `screens/BracketScreen.jsx`                                                                 | `users/{uid}/brackets/...` directo                                      | helper de workspace                                                                 |

#### Servicios/hooks que se quedan bajo user (datos privados)

| Archivo                               | Path                                                                                  | Razón                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------- |
| `services/settingsService.js`         | `users/{uid}/profile/main`                                                            | UI prefs personales                         |
| `hooks/useConversationPersistence.ts` | de `users/{uid}/conversations/` a `users/{uid}/pickHistory/{wsId}/conversations/`     | Pick history per-user-per-workspace         |
| `hooks/useProactiveNotifications.js`  | `users/{uid}/proactiveNotifications/...` con filter `where('wsId', '==', activeWsId)` | Estado del usuario sobre data del workspace |

#### Servicios/hooks inalterados

`hooks/useSharedBrackets.js`, `services/exerciseSharingService.js`, `services/backupService.js` (parcial; algunas paths internas se actualizan), `services/firestoreService.js` (parte de shared queda igual), reglas de presence y shared.

### 2.3 Cómo cada servicio recibe `wsId`

Tres opciones consideradas:

1. **Cada servicio recibe `wsId` como parámetro explícito en cada llamada.** ❌ Prolijo, cada call site lo lee del context. Verbose.
2. **Un wrapper alrededor del WorkspaceContext provee servicios pre-bound a `activeWsId`.** ❌ Sobreingeniería para V1.
3. **Cada hook lee `useWorkspace().activeWsId` y lo pasa al servicio.** ✅ Patrón ya usado con `useFirebase()` para `appId`/`db`. Mínima fricción, máxima claridad.

**Decisión**: opción 3. El service exporta funciones puras que reciben `(db, appId, wsId, ...)`. El hook envuelve y suministra desde context.

Ejemplo:

```ts
// services/teamsService.js
export function teamsCol(db, appId, wsId) {
  return collection(db, 'artifacts', appId, 'workspaces', wsId, 'teams');
}

// hook que lo usa
import { useFirebase } from '@/contexts/FirebaseContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

function useTeams() {
  const { db, appId } = useFirebase();
  const { activeWsId } = useWorkspace();
  // ... onSnapshot(teamsCol(db, appId, activeWsId), ...)
}
```

---

## 3. WorkspaceContext

### 3.1 Estructura

```ts
// src/contexts/WorkspaceContext.jsx
type WorkspaceContextValue = {
  activeWsId: string | null;
  activeWorkspace: WorkspaceDoc | null; // doc completo del workspace activo
  memberships: MembershipCache[]; // de users/{uid}/memberships/
  isLoading: boolean; // true mientras se resuelven memberships
  setActiveWorkspace: (wsId: string) => void; // cambia y persiste en localStorage
  refreshMemberships: () => Promise<void>; // forzar re-fetch (raro, para tests)
};
```

### 3.2 Provider, ubicación en el árbol

```jsx
<BrowserRouter>
  <FirebaseProvider>
    <AuthProvider>
      <WorkspaceProvider>
        {' '}
        {/* ← NUEVO */}
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </WorkspaceProvider>
    </AuthProvider>
  </FirebaseProvider>
</BrowserRouter>
```

`WorkspaceProvider` se monta encima de `ToastProvider` y debajo de `AuthProvider`. Necesita el user autenticado para suscribirse a memberships.

### 3.3 Lifecycle del provider

```
1. Mount: leer user de useAuth()
   → si user == null: { activeWsId: null, memberships: [], isLoading: false }
2. user disponible: suscribir a users/{uid}/memberships/ via onSnapshot
   → mientras llega: isLoading: true
3. Memberships recibidos:
   → resolveActiveWsId(memberships, localStorage.activeWsId) determina activeWsId
   → suscribir al doc workspaces/{activeWsId} para activeWorkspace
   → isLoading: false
4. setActiveWorkspace(wsId):
   → si wsId no está en memberships: no-op + warning
   → si está: actualizar localStorage, re-suscribir a workspaces/{wsId}
5. Unmount / user logout: cancelar todas las suscripciones, limpiar state
```

### 3.4 `resolveActiveWsId`

```ts
function resolveActiveWsId(memberships: MembershipCache[], savedWsId: string | null): string | null {
  if (savedWsId && memberships.some((m) => m.wsId === savedWsId)) {
    return savedWsId;
  }
  // Fallback: el personal (que en V1 es el único)
  const personal = memberships.find((m) => m.workspaceType === 'personal');
  if (personal) return personal.wsId;
  // Edge: ningún personal — toma el primero disponible (no debería ocurrir post-migración)
  return memberships[0]?.wsId ?? null;
}
```

### 3.5 Persistencia

- Key: `pickncoach.activeWsId`.
- Escrito en `setActiveWorkspace`.
- Leído en mount.
- En sub-proyecto 4: si hay clubs, evaluar si conviene además persistir en `users/{uid}/profile/main.lastActiveWsId` para sync cross-device. V1 no lo añade.

### 3.6 V1: selector UI oculto

V1 no añade ningún componente UI de selector. La maquinaria de `setActiveWorkspace` existe pero no hay forma de invocarla desde la UI (cero workspaces extras a los que conmutar). Este es un cambio aditivo — el componente del selector se introduce en sub-proyecto 4 cuando los clubs reales hacen necesario el cambio.

---

## 4. Algoritmo de migración

### 4.1 Estructura del script

Ubicación: `scripts/migrateToWorkspaces.js` (nuevo). Service account JSON local apuntado por `GOOGLE_APPLICATION_CREDENTIALS` o flag `--credentials path/to/sa.json`.

```bash
# Diagnóstico (cuenta docs por user, sin escribir)
node scripts/migrateToWorkspaces.js --dry-run

# Un solo user (testing en staging)
node scripts/migrateToWorkspaces.js --user uid_xxxx

# Producción full
node scripts/migrateToWorkspaces.js --project pickncoach-prod
```

### 4.2 Algoritmo principal

```ts
async function main({ dryRun, userFilter, project }) {
  initAdminSDK(project);
  const users = userFilter ? [userFilter] : await listAllAuthUsers();
  const summary = { migrated: 0, skipped: 0, failed: 0, errors: [] };

  for (const uid of users) {
    try {
      const result = await migrateUser(uid, { dryRun });
      summary[result.status]++;
      log(`[${uid}] ${result.status}: ${result.message}`);
      if (result.status === 'failed') summary.errors.push({ uid, error: result.error });
    } catch (e) {
      summary.failed++;
      summary.errors.push({ uid, error: e.message });
      logError(`[${uid}] FATAL: ${e.message}`);
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.failed > 0 ? 1 : 0);
}
```

### 4.3 `migrateUser(uid, { dryRun })`

```ts
async function migrateUser(uid, { dryRun }) {
  // 1. Idempotency check
  const existing = await db
    .collection(`artifacts/${appId}/workspaces`)
    .where('type', '==', 'personal')
    .where('ownerId', '==', uid)
    .limit(1)
    .get();
  if (!existing.empty) {
    return {
      status: 'skipped',
      message: `personal workspace already exists: ${existing.docs[0].id}`,
    };
  }

  // 2. Generate wsId + dry-run preview
  const newWsId = db.collection(`artifacts/${appId}/workspaces`).doc().id;
  if (dryRun) {
    const stats = await countDocsToMigrate(uid);
    return {
      status: 'migrated',
      message: `[DRY-RUN] would create wsId=${newWsId} and migrate ${stats.totalDocs} docs across ${stats.subcollections.join(', ')}`,
    };
  }

  // 3. Create workspace + member + membership cache (atomic batch)
  const now = FieldValue.serverTimestamp();
  await db
    .batch()
    .set(workspaceDoc(newWsId), {
      type: 'personal',
      name: 'Mi cuenta',
      ownerId: uid,
      createdAt: now,
      updatedAt: now,
      plan: 'free',
      planUpdatedAt: null,
      billing: null,
    })
    .set(workspaceMemberDoc(newWsId, uid), {
      role: 'owner',
      assignedTeamIds: [],
      joinedAt: now,
    })
    .set(userMembershipCacheDoc(uid, newWsId), {
      role: 'owner',
      workspaceName: 'Mi cuenta',
      workspaceType: 'personal',
      joinedAt: now,
    })
    .commit();

  // 4. Copy product subcollections (recursive)
  const counts = {};
  counts.brackets = await copyCollection(`users/${uid}/brackets`, `workspaces/${newWsId}/brackets`);
  counts.calendarSessions = await copyCollection(
    `users/${uid}/calendarSessions`,
    `workspaces/${newWsId}/calendarSessions`,
  );
  counts.playoffConvocatorias = await copyCollection(
    `users/${uid}/playoffConvocatorias`,
    `workspaces/${newWsId}/playoffConvocatorias`,
  );
  counts.exercises = await copyCollection(`users/${uid}/exercises`, `workspaces/${newWsId}/exercises`);
  counts.teams = await copyTeamsRecursive(uid, newWsId);

  // 5. Restructure conversations: users/{uid}/conversations/* → users/{uid}/pickHistory/{wsId}/conversations/*
  counts.conversations = await moveConversationsToPickHistory(uid, newWsId);

  // 6. Add wsId to existing proactiveNotifications
  counts.notifications = await addWsIdToNotifications(uid, newWsId);

  // 7. Verify
  const verify = await verifyMigration(uid, newWsId);
  if (!verify.ok) {
    return {
      status: 'failed',
      error: `verify mismatch: ${JSON.stringify(verify.diffs)}`,
    };
  }

  return {
    status: 'migrated',
    message: `wsId=${newWsId}, counts=${JSON.stringify(counts)}`,
  };
}
```

### 4.4 `copyCollection(sourcePath, destPath)`

Helper genérico que copia todos los docs de `sourcePath` a `destPath`, preservando `id`, `data`, y subcolecciones recursivamente. Idempotente: si destPath/{id} ya existe, hace `set(..., { merge: true })` en lugar de error.

```ts
async function copyCollection(sourcePath, destPath, batchSize = 200) {
  const sourceCol = db.collection(sourcePath);
  const snap = await sourceCol.get();
  let copied = 0;
  let batch = db.batch();
  let writes = 0;

  for (const docSnap of snap.docs) {
    const destRef = db.collection(destPath).doc(docSnap.id);
    batch.set(destRef, docSnap.data(), { merge: true });
    copied++;
    writes++;

    // Flush batch every batchSize writes to avoid Firestore 500-write limit
    if (writes >= batchSize) {
      await batch.commit();
      batch = db.batch();
      writes = 0;
    }

    // Recurse into subcollections of this doc
    const subcolNames = await listSubcollections(docSnap.ref);
    for (const sub of subcolNames) {
      copied += await copyCollection(
        `${sourcePath}/${docSnap.id}/${sub}`,
        `${destPath}/${docSnap.id}/${sub}`,
        batchSize,
      );
    }
  }

  if (writes > 0) await batch.commit();
  return copied;
}
```

`listSubcollections(ref)` usa `ref.listCollections()` del Admin SDK (no disponible en client SDK; razón por la que la migración corre con Admin SDK).

### 4.5 `copyTeamsRecursive(uid, newWsId)`

Wrapper específico para teams que itera con awareness del shape (members, trainings, competitions, cuaderno):

```ts
async function copyTeamsRecursive(uid, newWsId) {
  const teamsSnap = await db.collection(`artifacts/${appId}/users/${uid}/teams`).get();
  let total = 0;
  for (const teamDoc of teamsSnap.docs) {
    const teamId = teamDoc.id;
    const sourceTeamPath = `artifacts/${appId}/users/${uid}/teams/${teamId}`;
    const destTeamPath = `artifacts/${appId}/workspaces/${newWsId}/teams/${teamId}`;

    // Copy team root doc
    await db.doc(destTeamPath).set(teamDoc.data(), { merge: true });
    total++;

    // Copy known subcollections
    for (const sub of ['members', 'trainings', 'competitions', 'cuaderno']) {
      total += await copyCollection(`${sourceTeamPath}/${sub}`, `${destTeamPath}/${sub}`);
    }
  }
  return total;
}
```

`cuaderno` es una colección de docs singleton (jugadores, test-tiro, etc.) — `copyCollection` los maneja igual que cualquier doc.

### 4.6 `moveConversationsToPickHistory(uid, newWsId)`

```ts
async function moveConversationsToPickHistory(uid, newWsId) {
  const sourcePath = `artifacts/${appId}/users/${uid}/conversations`;
  const destPath = `artifacts/${appId}/users/${uid}/pickHistory/${newWsId}/conversations`;
  // Mismo patrón que copyCollection, con messages como subcolección
  return await copyCollection(sourcePath, destPath);
}
```

Los docs viejos en `users/{uid}/conversations/` quedan inertes hasta el cleanup a 30 días.

### 4.7 `addWsIdToNotifications(uid, newWsId)`

```ts
async function addWsIdToNotifications(uid, newWsId) {
  const colRef = db.collection(`artifacts/${appId}/users/${uid}/proactiveNotifications`);
  const snap = await colRef.get();
  let updated = 0;
  let batch = db.batch();
  let writes = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.wsId) continue; // Idempotent: skip if already has wsId
    batch.update(docSnap.ref, { wsId: newWsId });
    updated++;
    writes++;
    if (writes >= 200) {
      await batch.commit();
      batch = db.batch();
      writes = 0;
    }
  }
  if (writes > 0) await batch.commit();
  return updated;
}
```

### 4.8 `verifyMigration(uid, newWsId)`

Compara conteos entre old paths y new paths. Devuelve `{ ok, diffs }`.

```ts
async function verifyMigration(uid, newWsId) {
  const checks = [
    ['brackets', `users/${uid}/brackets`, `workspaces/${newWsId}/brackets`],
    ['calendarSessions', `users/${uid}/calendarSessions`, `workspaces/${newWsId}/calendarSessions`],
    ['playoffConvocatorias', `users/${uid}/playoffConvocatorias`, `workspaces/${newWsId}/playoffConvocatorias`],
    ['exercises', `users/${uid}/exercises`, `workspaces/${newWsId}/exercises`],
    // teams: cuenta también subcolecciones
  ];
  const diffs = [];
  for (const [name, oldPath, newPath] of checks) {
    const [oldCount, newCount] = await Promise.all([countDocsRecursive(oldPath), countDocsRecursive(newPath)]);
    if (oldCount !== newCount) diffs.push({ name, oldCount, newCount });
  }
  // teams: comparar root + cada subcolección por team
  // ... (similar pattern)
  return { ok: diffs.length === 0, diffs };
}
```

### 4.9 Idempotencia, en una frase

Cualquiera de las siguientes operaciones es safe re-ejecutar: `migrateUser`, `copyCollection`, `addWsIdToNotifications`, `moveConversationsToPickHistory`. Todas usan `set(..., { merge: true })` o checks previos. Si el script se interrumpe a mitad, re-ejecutarlo retoma desde donde se quedó.

---

## 5. Cutover procedure (single-stage)

Domingo de madrugada (~04:00 hora España, baja actividad).

### 5.1 Pre-flight (sábado tarde)

1. Verificar staging tiene datos copia de prod y todo funciona.
2. Correr migration en staging contra esa copia. Verificar éxito.
3. Smoke tests en staging post-migración (los 11 puntos del checklist).
4. Backup local del service account JSON. Confirmar que `firebase` CLI está logueado al proyecto correcto.
5. Confirmar `firebase emulators:start` funciona localmente con las nuevas reglas (rules tests verdes).

### 5.2 Maintenance window (domingo 04:00–05:00 hora España)

```bash
# Step 1: Backup Firestore export to Cloud Storage
gcloud firestore export gs://pickncoach-backups/pre-workspace-migration-$(date -u +%Y%m%d-%H%M%S) \
  --project pickncoach-prod

# Step 2: Deploy with maintenance banner
# (Esto requiere un feature flag o env var que muestre banner read-only en la app)
firebase deploy --only hosting --project pickncoach-prod

# Step 3: Run migration script
node scripts/migrateToWorkspaces.js --project pickncoach-prod 2>&1 | tee migration.log

# Step 4: Verify counts
grep "FATAL\|failed" migration.log    # debe estar vacío
grep "migrated" migration.log | wc -l # debe == número de users esperados

# Step 5: Smoke tests manuales (11 puntos del checklist) en 3 cuentas reales

# Step 6: Cutover deploy (código nuevo lee de workspaces/, banner removido)
firebase deploy --only hosting,firestore:rules --project pickncoach-prod

# Step 7: Verificar app funciona en prod
```

### 5.3 Rollback plan

Si algo falla en step 5 o 6:

1. Re-deploy del código previo (`git checkout main~1` o equivalente).
2. Re-deploy de las reglas previas (mismo).
3. Los datos antiguos en `users/{uid}/...` están **intactos** — la migración solo copia, no borra.
4. La app vuelve a funcionar exactamente como antes del intento.
5. Investigar offline qué falló, fixear, intentar de nuevo el siguiente fin de semana.

Riesgo residual: si por algún bug del script se escribieron datos parciales en `workspaces/` y luego rollback dejó esos workspaces huérfanos. **Mitigación**: en el siguiente intento, el script detecta workspaces existentes (idempotency check) y skipea esos users; o bien antes del re-intento, un script de cleanup borra los workspaces/{wsId} creados por el intento fallido. Decisión sobre esto en el momento, según gravedad.

### 5.4 Banner de read-only

Implementación: feature flag `VITE_READ_ONLY_MODE` en env vars de Firebase Hosting. Cuando es `true`:

- App carga normalmente.
- Banner full-width arriba: _"Mantenimiento en curso. La app está en modo solo lectura durante ~30 min. Lamento las molestias."_.
- Todos los botones de escritura quedan disabled.
- Llamadas a Firestore writes interceptadas por un wrapper que devuelve toast _"App en mantenimiento"_.

Por la duración corta de la ventana, vale con esta solución básica. Si la migración crece a escalas mayores, en el futuro se evalúa banner-en-tiempo-real (status doc en Firestore que la app lee).

---

## 6. Reglas Firestore V1

### 6.1 Reglas finales

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

    // Helpers existentes de shared (sharedConfig, canReadSharedData, etc.) — sin cambios

    // === NUEVO: workspace doc + subcolecciones ===
    match /artifacts/{appId}/workspaces/{wsId} {
      allow read:   if isSignedIn() && isWorkspaceMember(appId, wsId);
      allow create: if isSignedIn() && request.resource.data.ownerId == request.auth.uid;
      allow update: if isWorkspaceOwner(appId, wsId);
      allow delete: if isWorkspaceOwner(appId, wsId);

      // Members subcollection: any member reads, only owner writes
      match /members/{memberUid} {
        allow read:                   if isSignedIn() && isWorkspaceMember(appId, wsId);
        allow create, update, delete: if isWorkspaceOwner(appId, wsId);
      }

      // V1 permisivo: cualquier miembro lee/escribe data del workspace.
      // Sub-proyecto 2 refinará con role + assignedTeamIds.
      match /{collection}/{docId=**} {
        allow read, write: if isSignedIn() && isWorkspaceMember(appId, wsId);
      }
    }

    // === EXISTENTE (mismo efecto, scope ahora más estrecho): datos privados del user ===
    match /artifacts/{appId}/users/{uid}/{document=**} {
      allow read, write: if isSignedIn() && request.auth.uid == uid;
    }

    // === EXISTENTE (sin cambios): shared, presence, shared-exercises ===
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

### 6.2 Coste por request

- Read de workspace data anidado (e.g., `workspaces/{wsId}/teams/{tId}/cuaderno/jugadores`): un solo `exists()` check via `isWorkspaceMember`. 1 lectura adicional.
- Read del workspace doc: igual, 1 `exists()`.
- Read de `members/{memberUid}`: 1 `exists()` (mismo pattern).
- Update del workspace doc por owner: 1 `get()` (vs `exists()`) — coste similar.

Total: cada operación en workspace data añade 1 read de pricing. Aceptable.

### 6.3 Corner case: lectura del workspace doc para resolver el workspace activo

Cuando el `WorkspaceProvider` se monta, hace:

1. `onSnapshot(users/{uid}/memberships/)` — cubierto por la regla `users/`.
2. `onSnapshot(workspaces/{activeWsId})` — cubierto por la regla nueva via `isWorkspaceMember`.

Ambas funcionan sin tocar nada extra.

---

## 7. PR strategy

### 7.1 Un solo PR grande con commits estructurados

Branch: `feat/workspaces-foundation`. Estructura de commits:

| #   | Commit                                                               | Tests                                                              | Notas                                          |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| 1   | `feat(workspaces): add path helpers and types`                       | unit tests para `workspaceDocRef`/`workspaceColRef`                | Adición pura, no se usa todavía                |
| 2   | `feat(workspaces): add WorkspaceContext provider`                    | unit tests para `resolveActiveWsId`, integration test del provider | Mounted en árbol pero todavía sin consumidores |
| 3   | `feat(scripts): migration script with emulator tests`                | tests Emulator: dry-run, idempotencia, edge cases                  | Script existe, se prueba en CI vía emulator    |
| 4   | `refactor: switch services and hooks to workspaceDocRef`             | tests existentes adaptados (mocks pasan a usar workspaceColRef)    | El cambio gordo; toca 22 archivos              |
| 5   | `feat(rules): firestore rules for workspaces with emulator tests`    | rules tests con `@firebase/rules-unit-testing`                     | Reglas nuevas en `firestore.rules`             |
| 6   | `chore(scripts): cleanup script for old paths + smoke checklist doc` | smoke checklist en `docs/runbooks/cutover-smoke-checklist.md`      | Para usar a 30 días                            |

Cada commit pasa lint + tests. PR mergeado a `main` el sábado.

### 7.2 Por qué no múltiples PRs

El cambio es atómico — el path de la app cambia de un día al otro. Múltiples PRs requeriría feature flags o transition layer, ambos sobrecomplicados para un dev solo. La PR grande es honesta sobre la naturaleza del cambio.

### 7.3 Revisión

Auto-review (eres el solo dev). Opcionalmente, `/ultrareview` o el agente code-reviewer al merge para validar.

---

## 8. Testing

### 8.1 Unit tests

```
src/services/__tests__/workspacePaths.test.ts
  - workspaceDocRef builds correct path
  - workspaceColRef supports varargs for nested paths
  - userDocRef still works (untouched paths)

src/contexts/__tests__/WorkspaceContext.test.tsx
  - resolveActiveWsId: savedWsId in memberships → uses it
  - resolveActiveWsId: savedWsId not in memberships → fallback to personal
  - resolveActiveWsId: no personal → fallback to first membership
  - resolveActiveWsId: empty memberships → null
  - setActiveWorkspace updates state and localStorage
  - setActiveWorkspace with invalid wsId is no-op + warning
  - Provider re-subscribes when activeWsId changes
  - Provider clears state on user logout
```

### 8.2 Firestore Emulator tests

```
scripts/__tests__/migration.test.ts
  Setup: seed Emulator con un user que tiene 3 teams, 5 brackets, 10 sessions, 8 conversations,
         15 exercises, 4 proactiveNotifications.

  Tests:
  - migrateUser crea workspace + member + cache de membership
  - migrateUser copia todos los docs (counts coinciden)
  - migrateUser deja datos antiguos intactos (D1 D-day retention)
  - migrateUser es idempotente (re-run = skip + cero writes adicionales)
  - migrateUser con --dry-run no escribe nada
  - migrateUser de un user sin datos crea solo workspace + member + cache
  - migrateUser falla limpiamente si Firestore export está corrupto (simulado)
  - verifyMigration detecta mismatch si se inyecta un doc faltante

  Pick history:
  - moveConversationsToPickHistory copia conversations + messages al nuevo path
  - re-ejecutar es idempotente

  Notifications:
  - addWsIdToNotifications añade wsId a todos
  - skip notifs que ya tienen wsId

firestore.rules.test.ts
  Setup: Emulator con reglas nuevas + 2 users + 2 workspaces.

  Tests:
  - User A miembro de Workspace X lee workspace X y subcolecciones
  - User A NO miembro de Workspace Y → denied
  - User A no autenticado → denied
  - User A lee users/A/* OK
  - User A lee users/B/* → denied
  - User A crea workspace con ownerId=A → OK
  - User A crea workspace con ownerId=B → denied
  - Owner de Workspace X update doc → OK
  - Member no-owner de X update doc → denied (V1 lock)
  - Owner de X delete member → OK
  - Member no-owner de X delete member → denied
  - shared/, presence/, shared-exercises/ siguen funcionando
```

### 8.3 Smoke tests post-cutover (manual, 5–10 min)

Sobre 3 cuentas reales (la del dev + 2 conocidos):

```
[ ] Login funciona, redirect a /area-privada/
[ ] HomeScreen carga, lista de teams visible, contador de jugadores correcto
[ ] Abrir un team → cuaderno completo carga (jugadores, test-tiro, asistencia, informe-jugadores, notas, pilares, normas)
[ ] Calendario carga sesiones (entrenamientos + partidos + playoffs virtuales)
[ ] Abrir un bracket existente, ver matches y winners propagados
[ ] Crear un nuevo team → escribe en workspaces/{wsId}/teams/, no en users/{uid}/teams/
[ ] Abrir Pick → mensaje rápido → respuesta → conversación se guarda en users/{uid}/pickHistory/{wsId}/
[ ] Mandar una convocatoria → marca convocatoriaSentAt en el path nuevo
[ ] Pendientes muestra los items correctos (notifs proactivos siguen filtrados por wsId)
[ ] Settings (profile/main) sigue funcionando, idéntico
[ ] Logout y re-login → activeWsId restaurado de localStorage al personal
```

---

## 9. Cleanup a 30 días

### 9.1 Cuándo

30 días tras el cutover, si no han aparecido bugs críticos en los datos nuevos.

### 9.2 Cómo

Script manual: `scripts/cleanupOldPaths.js`. Ejecutado por el dev tras confirmar que no hace falta el backup.

```bash
node scripts/cleanupOldPaths.js --dry-run    # cuenta cuánto se borraría
node scripts/cleanupOldPaths.js              # ejecuta el delete
```

Borra:

- `users/{uid}/teams/` (todas las subcolecciones recursivamente)
- `users/{uid}/brackets/`
- `users/{uid}/calendarSessions/`
- `users/{uid}/playoffConvocatorias/`
- `users/{uid}/exercises/`
- `users/{uid}/conversations/` (path antiguo de Pick history)

**Mantiene**:

- `users/{uid}/profile/main`
- `users/{uid}/memberships/`
- `users/{uid}/pickHistory/`
- `users/{uid}/proactiveNotifications/`
- `workspaces/` (lo nuevo)

### 9.3 Recordatorio

`/schedule` un agente background el día del cutover que se dispare a +30 días con el mensaje: _"Es 30 días desde la migración del 2026-05-XX. Verifica que todo va bien y ejecuta `scripts/cleanupOldPaths.js` para borrar paths antiguos."_. Tras el cutover, lo configuramos en una sesión nueva.

---

## 10. Out of sub-proyecto 1 (declarado explícitamente)

Estas piezas NO se entregan en sub-proyecto 1; cada una llega en el sub-proyecto correspondiente.

- **Componente UI del context selector visible**. Llega con sub-proyecto 4 (cuando hay clubs reales).
- **Persistencia cross-device de `activeWsId`** en Firestore (`users/{uid}/profile/main.lastActiveWsId`). Llega con sub-proyecto 4 si hace falta.
- **Permisos refinados por rol** (DT vs admin-billing vs coach con assignedTeamIds). Llega con sub-proyecto 2.
- **Pick gating por rol**. Llega con sub-proyecto 2.
- **Stripe customer/subscription en el workspace doc**. Llega con sub-proyectos 5 y 6.
- **Plan switching y paywall enforcement** sobre Pick u otras features. Llega con sub-proyecto 5.
- **Decisión sobre brackets compartidos** (`shared/{shareCode}`): se mantiene como hoy en V1; revisión en sub-proyecto 4 si los clubs introducen nuevos casos de sharing.

---

## 11. Alineación con las constraints del sub-proyecto 0

| #   | Constraint                               | Cumplimiento en V1                                                                                                    |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Una sola ruta de código                  | `workspaceDocRef` único; sin `if/else` personal vs club en hooks/services                                             |
| 2   | Plan field como string libre             | `workspaces/{wsId}.plan: string`                                                                                      |
| 3   | Stripe Volume mode preparado             | N/A en V1 (sin billing real); se prepara en sub-proyecto 6                                                            |
| 4   | `wsId` en context                        | `WorkspaceContext.activeWsId`                                                                                         |
| 5   | No hardcoding del segmento personal/club | `name: "Mi cuenta"` desde el doc; el segmento se lee de `type`                                                        |
| 6   | Pick respeta workspace activo            | Pick history bajo `pickHistory/{wsId}/...`; tools leen `workspaces/{activeWsId}/...`                                  |
| 7   | Permisos en Firestore + UI + Pick        | Reglas V1 en Firestore; WorkspaceProvider cubre UI; Pick hereda contexto. Refinement por rol llega con sub-proyecto 2 |

---

## 12. Riesgos y mitigaciones

| Riesgo                                                                                               | Probabilidad | Impacto | Mitigación                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------- | ------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bug en script de migración corrompe datos                                                            | Baja         | Alto    | Backup pre-migration + script idempotente + dry-run en staging + smoke tests                                                                       |
| Refactor de 22 archivos rompe alguna feature no testada                                              | Media        | Medio   | Tests existentes + smoke checklist exhaustivo post-cutover                                                                                         |
| Reglas Firestore demasiado permisivas/restrictivas                                                   | Baja         | Alto    | Tests Emulator de reglas obligatorios antes de merge                                                                                               |
| Service account JSON expuesto durante el run                                                         | Baja         | Alto    | Mantener .gitignored, no log de credentials, rotar tras la migración si hay duda                                                                   |
| Ventana de mantenimiento se alarga >1h                                                               | Baja         | Bajo    | Si pasa, el banner read-only sigue mostrándose; los usuarios verán toast pero no se pierde data. Comunicación informal con conocidos si hace falta |
| Idempotency check falla y se duplican workspaces                                                     | Muy baja     | Alto    | Query `where('type', '==', 'personal').where('ownerId', '==', uid)` antes de crear; tests del Emulator validan                                     |
| Cache de memberships diverge crítico (e.g., user pierde acceso pero cache sigue mostrando workspace) | Baja         | Bajo    | V1 no permite revocaciones; el primer escenario real de drift llega con sub-proyecto 3 (invitaciones), que tendrá su propio plan de invalidación   |

---

## 13. Sucesores

El siguiente sub-proyecto es **Sub-proyecto 5 — Monetización B2C** (per orden B2C-first acordado en sub-proyecto 0). Ese spec definirá:

- Esquema concreto de Stripe (Products, Prices, Customer, Subscription).
- Webhooks Cloud Function para sincronizar estado de suscripción al doc del workspace.
- Paywall enforcement en código (qué tools de Pick / qué features se bloquean en plan free).
- Customer Portal para gestión de suscripción.
- Quotas concretas para free tier (ya con números, no orientativos).
- Página `/area-privada/settings/subscription` con la UI de upgrade.
- Manejo de IVA (España) en facturación B2C.

Después de sub-proyecto 5, viene **Sub-proyecto 2 — Permisos y scoping**, que es el bloqueante directo de los sub-proyectos B2B (3 → 4).

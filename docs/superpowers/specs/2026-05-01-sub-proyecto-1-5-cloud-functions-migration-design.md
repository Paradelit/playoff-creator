# Sub-proyecto 1.5 — Cloud Functions migration + signup bootstrap

**Fecha:** 2026-05-01
**Estado:** Aprobado, pendiente de plan de implementación
**Autor:** Sergio Paradela (con Claude)
**Predecesor:** [Sub-proyecto 1 — Modelo de cuenta y workspace + migración](./2026-05-01-sub-proyecto-1-modelo-cuenta-workspace-migracion-design.md)
**Sucesor inmediato:** Sub-proyecto 5 — Monetización B2C (orden B2C-first)

---

## 0. Por qué existe este spec

Sub-proyecto 1 entregó la fundación cliente-side de la migración a `workspaces/{wsId}/...`. El final code review identificó que el spec scoped solo cliente (`src/...`) y dejó el lado Cloud Functions (`functions/src/...`) sin migrar.

Esos archivos siguen leyendo y escribiendo `users/{uid}/...`. Sin migrarlos:

- **Pick agent reads stale data** — el orchestrator del agente IA lee `users/{uid}/teams/...` en lugar de `workspaces/{wsId}/teams/...`. Cualquier edición que el coach haga post-cutover no la ve el agente.
- **proactiveEngine genera notifs sin `wsId`** — la UI las filtra por `where('wsId', '==', activeWsId)`, así que los notifs nuevos no aparecen.
- **dataCleanup deja orphans** — `deleteTeam`/`deleteBracket`/`deleteConversation` desde la UI llaman a Cloud Functions que limpian el path viejo; el path nuevo queda con datos huérfanos.
- **Memoria/RAG del agente con datos viejos** — `userRagService`, `userDigest`, `memoryTools` indexan paths obsoletos.
- **Nuevo signup post-cutover queda atrapado** — sin un trigger que cree workspace + member + cache automáticamente, todo sign-up nuevo aterriza en `WorkspaceProvisioningState` indefinidamente.

Adicionalmente, el review encontró dos hardening items:

- Los scripts (`migrateToWorkspaces.js`, `cleanupOldPaths.js`) hardcodean `appId: 'uros-fbm-app'`. Foot-gun para staging.
- El runbook de cutover en sub-proyecto 1 (sección 5.2) tiene el orden invertido: despliega código nuevo antes de correr la migración, dejando la app en estado vacío durante 15 min.

Este sub-proyecto cierra esos siete gaps. **Tras 1.5, el cutover es ejecutable.**

---

## 1. Scope (7 piezas)

| #   | Pieza                       | Archivos clave                                                                                                       |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Read tools migration        | `functions/src/ai/tools/readTools.ts` (13 paths)                                                                     |
| 2   | Pick agent wiring (wsId)    | `functions/src/ai/agentOrchestrator.ts`, `functions/src/ai/tools/registry.ts`, `src/hooks/usePick.ts`                |
| 3   | proactiveEngine migration   | `functions/src/proactiveEngine.ts`                                                                                   |
| 4   | dataCleanup migration       | `functions/src/dataCleanup.ts`, `src/services/dataCleanupService.ts`, `src/services/settingsService.js`              |
| 5   | RAG / digest / memory scope | `functions/src/ai/userRagService.ts`, `functions/src/ai/userDigest.ts`, `functions/src/ai/tools/memoryTools.ts`      |
| 6   | Signup bootstrap trigger    | `functions/src/index.ts` (export), `functions/src/auth/onUserCreate.ts` (nuevo)                                      |
| 7   | Scripts hardening + runbook | `scripts/migration/migrateToWorkspaces.js`, `scripts/cleanupOldPaths.js`, `docs/runbooks/cutover-smoke-checklist.md` |

---

## 2. Decisiones

### 2.1 Read tools migration (pieza 1)

`readTools.ts` tiene 13 invocaciones del patrón:

```ts
ctx.db.doc(`artifacts/${ctx.appId}/users/${ctx.userId}/teams/${teamId}`).get();
```

Todas pasan a:

```ts
ctx.db.doc(`artifacts/${ctx.appId}/workspaces/${ctx.wsId}/teams/${teamId}`).get();
```

Inventario completo de paths a swap:

- `users/${ctx.userId}/teams/${teamId}` (línea 83)
- `users/${ctx.userId}/exercises/${exerciseId}` (línea 173)
- `users/${ctx.userId}/teams/${teamId}/trainings/${trainingId}` (línea 230)
- `users/${ctx.userId}/brackets/${bracketId}` (líneas 308, 335)
- `users/${ctx.userId}/teams/${teamId}/cuaderno/${section}` (línea 371)
- `users/${ctx.userId}/teams/${teamId}/cuaderno/asistencia` (línea 391)
- `users/${ctx.userId}/teams/${teamId}/cuaderno/informe-jugadores` (línea 466)
- `users/${ctx.userId}/teams/${teamId}/cuaderno/test-tiro` (línea 485)
- `users/${ctx.userId}/scoutings/${sessionId}` (línea 504)
- `users/${ctx.userId}/analisis/${sessionId}` (línea 523)
- `users/${ctx.userId}/calendarSessions/${sessionId}` (línea 603)
- `users/${ctx.userId}/teams/${session.teamId}` (línea 628)
- `users/${ctx.userId}/teams/${session.teamId}/competitions/${session.competitionId}` (línea 638)

Cada uno cambia `users/${ctx.userId}` por `workspaces/${ctx.wsId}`.

Escrituras vía `proposalExecutor.ts` (cliente) ya están migradas en sub-proyecto 1. Las write tools server-side (`writeTools.ts`) **no escriben directamente** — proponen acciones que el cliente ejecuta. No requieren cambio de path.

### 2.2 Pick agent wiring (pieza 2)

#### ToolContext shape

```ts
// functions/src/ai/tools/registry.ts
export interface ToolContext {
  db: Firestore;
  userId: string; // existente — para audit fields y data user-private (pickHistory)
  wsId: string; // NUEVO — para rutas de producto (workspaces/{wsId}/...)
  appId: string;
  defaults?: { teamId?: string; sessionId?: string; bracketId?: string };
  agents?: AgentsMap;
  traceContext?: TraceContext;
  agentOptions?: AgentExecutionOptions;
  geminiApiKey?: string;
}
```

`userId` se mantiene para los casos donde el contexto sigue siendo del usuario (audit, pickHistory). `wsId` se añade y los read tools lo usan para construir paths.

#### Cliente envía wsId

En `src/hooks/usePick.ts` (o donde se invoque la callable del agente), añadir `wsId` al body:

```ts
const { activeWsId } = useWorkspace();
if (!activeWsId) return; // Pick UI ya gateada por activeWsId no-null
const result = await pickCallable({
  ...currentBody,
  wsId: activeWsId,
});
```

Si `activeWsId` es null, no se invoca (la UI de Pick está oculta vía `WorkspaceProvisioningState`).

#### Orchestrator valida server-side

En el callable entrypoint del orchestrator:

```ts
export async function pickCallable(request: CallableRequest) {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', 'auth required');

  const wsId = request.data?.wsId;
  if (typeof wsId !== 'string' || !wsId) {
    throw new HttpsError('invalid-argument', 'wsId required in request body');
  }

  // Validate membership server-side
  const memberRef = db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${userId}`);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) {
    throw new HttpsError('permission-denied', 'not a member of this workspace');
  }

  // Build ToolContext with both userId AND wsId
  const ctx: ToolContext = { db, userId, wsId, appId /* ... */ };

  // Run orchestration with the validated ctx
  return await runOrchestration(ctx, request.data);
}
```

Una sola validación al entrar; todos los tools confían en que `ctx.wsId` ya está validado. Una read extra en el entrypoint, aceptable.

### 2.3 proactiveEngine migration (pieza 3)

`proactiveEngine.ts` actualmente:

1. Itera `artifacts/{appId}/users/` (línea 121-128).
2. Por cada user, chequea `users/{uid}/teams/` y `users/{uid}/calendarSessions/` para activity (líneas 137-161).
3. Para users activos, query sessions today+tomorrow desde `users/{uid}/calendarSessions/` (línea 178).
4. Escribe notifs a `users/{uid}/proactiveNotifications/{notifId}` SIN `wsId` field (línea 245).

Cambios:

#### Migración de paths

Iterar `workspaces/` directamente (más limpio que iterar users → expandir memberships):

```ts
const workspacesRef = db.collection('artifacts').doc(appId).collection('workspaces');

const workspacesSnap = await workspacesRef.limit(MAX_WORKSPACES * 3).get();

const activeWsIds: Array<{ wsId: string; ownerId: string }> = [];

for (const wsDoc of workspacesSnap.docs) {
  if (activeWsIds.length >= MAX_WORKSPACES) break;
  const wsId = wsDoc.id;
  const ownerId = wsDoc.data().ownerId;

  // Check teams existence as activity proxy
  const teamsSnap = await db
    .collection('artifacts')
    .doc(appId)
    .collection('workspaces')
    .doc(wsId)
    .collection('teams')
    .limit(1)
    .get();
  if (!teamsSnap.empty) {
    activeWsIds.push({ wsId, ownerId });
    continue;
  }

  // Check recent sessions
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
    activeWsIds.push({ wsId, ownerId });
  }
}
```

#### Query de sesiones

```ts
const sessionsSnap = await db
  .collection('artifacts')
  .doc(appId)
  .collection('workspaces')
  .doc(wsId)
  .collection('calendarSessions')
  .where('fecha', '>=', today)
  .where('fecha', '<=', tomorrow)
  .get();
```

#### Write de notif con wsId

Para cada notif que se cree:

```ts
const notif: ProactiveNotification = {
  message,
  type: notifType,
  generatedAt: new Date().toISOString(),
  read: false,
  sessionId,
  wsId, // NUEVO — la UI filtra por esto
  ...(session.teamId ? { teamId: session.teamId } : {}),
};
```

Path del notif: **se mantiene** bajo `users/{uid}/proactiveNotifications/{notifId}` (constitución dice "datos del usuario viajan con el usuario"). Para encontrar al `uid` destinatario en V1.5 (sólo workspaces personales): `uid = ownerId` del workspace. Para B2B (clubs con N coaches), la lógica se expandirá en sub-proyecto 4.

#### Idempotency check

`notifId = "${fecha}-${sessionId}"` se mantiene. Para V1.5 esto sigue siendo único porque `sessionId` es único cross-workspace (Firestore auto-id).

### 2.4 dataCleanup migration (pieza 4)

#### Funciones afectadas

`functions/src/dataCleanup.ts` exporta:

- `deleteTeamCascade({ appId, teamId, uid })` — recursive delete de un team.
- `deleteBracketCascade({ appId, bracketId })` — delete de un bracket.
- `deleteConversationCascade({ appId, conversationId })` — delete de una conversación.
- `deleteAllUserDataCascade({ appId, uid })` — delete completo de cuenta.

#### Cambios en signaturas y paths

```ts
// deleteTeamCascade — nuevo signature
async function deleteTeamCascade({ appId, wsId, teamId }) {
  const teamRef = db.doc(`artifacts/${appId}/workspaces/${wsId}/teams/${teamId}`);
  await db.recursiveDelete(teamRef);
  // Cascade: borrar también scoutings/analisis/planillas asociados a sessions del team
  // (lógica análoga a la actual, pero bajo workspaces/{wsId}/...)
}

// deleteBracketCascade
async function deleteBracketCascade({ appId, wsId, bracketId }) {
  const bracketRef = db.doc(`artifacts/${appId}/workspaces/${wsId}/brackets/${bracketId}`);
  await db.recursiveDelete(bracketRef);
}

// deleteConversationCascade
async function deleteConversationCascade({ appId, uid, wsId, conversationId }) {
  const convRef = db.doc(`artifacts/${appId}/users/${uid}/pickHistory/${wsId}/conversations/${conversationId}`);
  await db.recursiveDelete(convRef);
}
```

Los callers (`src/services/dataCleanupService.ts`, `useBracketSync`, `useConversationPersistence`, etc.) pasan `wsId` desde `useWorkspace().activeWsId`.

#### `deleteAllUserDataCascade` — semántica forward-compatible

```ts
async function deleteAllUserDataCascade({ appId, uid }) {
  // 1. Iterar memberships del user
  const membershipsSnap = await db.collection(`artifacts/${appId}/users/${uid}/memberships`).get();

  for (const membershipDoc of membershipsSnap.docs) {
    const wsId = membershipDoc.id;
    const wsSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}`).get();
    if (!wsSnap.exists) continue;

    const ws = wsSnap.data();

    if (ws.type === 'personal' && ws.ownerId === uid) {
      // Personal workspace owned por este user → borrar workspace completo
      await db.recursiveDelete(db.doc(`artifacts/${appId}/workspaces/${wsId}`));
    } else {
      // Club workspace → solo eliminar la membership del user; el club sobrevive
      await db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${uid}`).delete();
    }
  }

  // 2. Borrar datos user-private
  await db.recursiveDelete(db.doc(`artifacts/${appId}/users/${uid}`));

  // 3. Auth user delete: responsabilidad del caller (Admin SDK call separado)
}
```

V1.5 sólo tiene workspaces personales, así que el branch `else` (club) no se ejerce hoy. Pero el código está listo para sub-proyecto 4 cuando los clubs lleguen.

#### NO doble-delete en paths viejos

Durante el grace period 30 días post-cutover, los paths viejos (`users/{uid}/teams/...`, etc.) siguen presentes para rollback safety. `dataCleanup.ts` **no** los borra adicionalmente — esa responsabilidad es del `cleanupOldPaths.js` script (Commit 6 de sub-proyecto 1) ejecutado al día 30. Si hay rollback, queremos los datos viejos intactos.

### 2.5 RAG / digest / memory scope (pieza 5)

`userRagService.ts`, `userDigest.ts`, `memoryTools.ts` mueven a per-workspace:

- Path actual: `artifacts/{appId}/users/{uid}/{ragIndex|digest|memory}/...`
- Path nuevo: `artifacts/{appId}/workspaces/{wsId}/{ragIndex|digest|memory}/...`

Razón: la memoria de Pick sobre un equipo del club es del club, no del coach individual. En B2B, varios coaches comparten contexto del mismo workspace; la memoria también debe estar workspace-scoped.

Migración inicial: el script `migrateToWorkspaces.js` (sub-proyecto 1) **NO** copia estas colecciones porque no estaban en el inventario original. **Decisión**: se añaden al script de migración de sub-proyecto 1 como ampliación, o se regeneran desde cero en V1.5.

Ampliación del script vs regenerar:

- **Ampliar**: el script copia también `ragIndex`, `digest`, `memory` de `users/{uid}/...` a `workspaces/{wsId}/...`. Preserva el state acumulado del agente. Más trabajo de copia pero respeta la memoria que el usuario ya tiene.
- **Regenerar**: dejar que el agente reconstruya su memoria desde cero post-cutover. Más simple pero el usuario "pierde" el contexto acumulado de Pick.

**Decisión**: ampliar el script. Coherente con "todo dato del workspace = del workspace". V1.5 incluye este paso en el plan de migración.

### 2.6 Signup bootstrap trigger (pieza 6)

#### Nueva Cloud Function

`functions/src/auth/onUserCreate.ts` (nuevo archivo). El SDK API exacto (Firebase Functions v1 `auth.user().onCreate()` legacy vs v2 `beforeUserCreated` blocking trigger) lo decide el plan de implementación según versión de `firebase-functions` instalada en `functions/package.json`. La lógica del handler es uniforme entre las dos APIs:

```ts
// PSEUDOCODE — el wrapper exacto se elige en el plan
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export async function bootstrapPersonalWorkspace(user: { uid: string }) {
  const db = getFirestore();
  const appId = process.env.PICK_APP_ID;
  if (!appId) {
    console.error('[bootstrapPersonalWorkspace] PICK_APP_ID env var missing');
    return;
  }

  const uid = user.uid;
  const newWsId = db.collection(`artifacts/${appId}/workspaces`).doc().id;
  const now = FieldValue.serverTimestamp();

  // Atomic batch
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
      migrationCompleteAt: now, // Treat trigger-created workspaces as "complete" from day 1
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

  console.log(`[bootstrapPersonalWorkspace] bootstrapped wsId=${newWsId} for uid=${uid}`);
}
```

El export concreto en `functions/src/index.ts` (e.g., `export const onUserCreate = functions.auth.user().onCreate(bootstrapPersonalWorkspace)`) lo materializa el plan de implementación.

#### `onDelete` NO en V1.5

Defer a sub-proyecto 2 cuando se aborde GDPR / "delete my account" como flujo explícito. V1.5 declara out-of-scope.

#### Race condition entre Auth.create y trigger completion

Pequeña ventana (1-3s típicamente) entre `signInWithPopup` resolviendo y el trigger completando. Cubierto por `WorkspaceProvisioningState` en el cliente — el user ve "Estamos preparando tu cuenta" durante ese segundo. Cuando el `onSnapshot` de memberships dispara con el doc nuevo, la UI cambia automáticamente al estado normal.

### 2.7 Scripts hardening + runbook (pieza 7)

#### `--app-id` requerido sin default

```js
// scripts/migration/migrateToWorkspaces.js
function parseArgs(argv) {
  const args = { dryRun: false, user: null, project: null, credentials: null, appId: null };
  // ...parse...
  if (!args.appId) {
    console.error('Error: --app-id is required (no default; foot-gun protection)');
    process.exit(2);
  }
  return args;
}
```

Aplicado idénticamente a `scripts/cleanupOldPaths.js`.

#### Runbook reordenado (definitivo para cutover)

Reescrita la sección 5.2 del spec sub-proyecto 1 + el doc `docs/runbooks/cutover-smoke-checklist.md`:

```
Domingo ~04:00 hora España:

1. Backup Firestore export:
   gcloud firestore export gs://<backup-bucket>/pre-cutover-$(date -u +%Y%m%d-%H%M%S) \
     --project <PROJECT_ID>

2. Banner read-only ON:
   - Set hosting env var VITE_READ_ONLY_MODE=true (o equivalente)
   - firebase deploy --only hosting --project <PROJECT_ID>
   - Verificar banner aparece en producción

3. Run migration:
   node scripts/migration/migrateToWorkspaces.js \
     --app-id <APP_ID> \
     --project <PROJECT_ID> \
     --credentials path/to/sa.json

4. Verify counts en migration.log — sin failed entries

5. Deploy nuevo código + reglas + onCreate trigger:
   firebase deploy --only hosting,functions,firestore:rules,firestore:indexes \
     --project <PROJECT_ID>

6. Smoke tests sobre 3 cuentas reales (11 puntos del checklist)

7. Banner OFF:
   - Unset VITE_READ_ONLY_MODE
   - firebase deploy --only hosting --project <PROJECT_ID>
```

**Diferencia clave vs spec sub-proyecto 1**: la migración corre ANTES del deploy del código nuevo, evitando la ventana awkward "código nuevo lee paths que aún no existen".

#### Riesgo residual entre paso 3 y paso 5

Entre `migrate` y `deploy code`, el código viejo sigue activo en producción. Si un user logueado escribe (a pesar del banner read-only), va al path viejo. Esa escritura se pierde post-cutover.

**Mitigación**:

- Banner read-only desde paso 2, antes incluso de migrar.
- Timing dominical 04:00 (low activity).
- Base de usuarios = dev y conocidos (comunicación informal previa).
- El banner UI no bloquea writes a nivel infra, solo disuade. Pero a este scale es suficiente.

---

## 3. Out of sub-proyecto 1.5 (declarado)

- **`auth.user().onDelete` trigger**: defer a sub-proyecto 2 (GDPR scope). V1.5 no lo incluye.
- **Permisos refinados por rol** (DT vs admin-billing vs coach + assignedTeamIds): sub-proyecto 2.
- **Vista DT, multi-equipo UI**: sub-proyecto 4.
- **Stripe / billing**: sub-proyectos 5 (B2C) y 6 (B2B).
- **Mover `activeWsId` a Firestore profile** (cross-device sync): sub-proyecto 4 si hace falta.
- **B2B membership flows** (invitar coach, revocar, transferir ownership): sub-proyecto 3.
- **Notificaciones push** (FCM): explícitamente fuera; los notifs siguen siendo sólo on-page.

---

## 4. Tests

### 4.1 Cloud Functions (Vitest + Firestore Emulator)

`functions/__tests__/`:

- `readTools.test.ts` — cada uno de los 13 read tools, smoke test contra emulator con seed data en `workspaces/{wsId}/...`. Verifica que el tool con `ctx.wsId` válido devuelve datos correctos; con `wsId` inválido devuelve null/error.
- `proactiveEngine.test.ts` — extender el test existente (si existe) para ejercitar la iteración sobre `workspaces/`, la query de sessions, y la escritura del notif con `wsId` field.
- `dataCleanup.test.ts` — extender los tests existentes para ejercitar las funciones bajo `workspaces/{wsId}/...`. Añadir test específico de `deleteAllUserDataCascade` con un personal workspace + (mock) club workspace.
- `auth/onUserCreate.test.ts` — nuevo. Mock event de user creation, verificar que crea workspace + member + cache atómicamente.

### 4.2 Pick agent wiring

`functions/src/ai/__tests__/orchestrator.test.ts` — extender (existe ya):

- Validación: callable rechaza request sin `wsId` con `invalid-argument`.
- Validación: callable rechaza con `permission-denied` si user no es member del wsId.
- Happy path: callable acepta y construye ToolContext con `userId` + `wsId`.

### 4.3 Cliente

`src/hooks/__tests__/usePick.test.tsx` (si existe) — mock callable, verificar que el cliente envía `wsId` en el body cuando `activeWsId` es non-null.

### 4.4 Smoke tests post-cutover

Reusar el checklist de sub-proyecto 1 (`docs/runbooks/cutover-smoke-checklist.md`) y añadir 3 puntos:

```
[ ] Pick chat → enviar mensaje → respuesta correcta. Verificar en Firestore Console que el orchestrator log pegó el wsId correcto.
[ ] Borrar un team desde la UI → verificar que el doc desaparece de workspaces/{wsId}/teams/.
[ ] Crear cuenta nueva con email distinto → verificar que el onCreate trigger creó workspace + member + cache automáticamente y aterriza en HomeScreen sin pasar por WorkspaceProvisioningState.
```

---

## 5. Alineación con constraints transversales (sub-proyecto 0)

| #   | Constraint                        | Cumplimiento en 1.5                                                                                                        |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | Una sola ruta de código           | Cloud Functions usan mismo path pattern `workspaces/{wsId}/...` que cliente. Sin if/else personal vs club.                 |
| 2   | Plan field como string libre      | N/A (no toca billing).                                                                                                     |
| 3   | Stripe Volume mode                | N/A.                                                                                                                       |
| 4   | `wsId` en context                 | `ToolContext.wsId` propagado desde el cliente vía callable body, validado server-side.                                     |
| 5   | No hardcoding del segmento        | Cloud Functions leen `workspaces/{wsId}/...` sin distinguir personal/club. proactiveEngine itera workspaces uniformemente. |
| 6   | Pick respeta workspace activo     | Validación server-side (`isWorkspaceMember`); tools solo ven `wsId` validado.                                              |
| 7   | Permisos en Firestore + UI + Pick | Reglas (sub-proyecto 1) + UI gates + tools server-side validan los tres.                                                   |

---

## 6. Riesgos y mitigaciones

| Riesgo                                                                                | Probabilidad | Impacto | Mitigación                                                                                                                    |
| ------------------------------------------------------------------------------------- | ------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `onCreate` trigger falla para algunos users durante ventana de migración              | Baja         | Medio   | El usuario ve `WorkspaceProvisioningState` con botón "Reintentar"; manualmente el dev puede crear el workspace via Admin SDK. |
| Race entre Auth.create y trigger completion deja al user con loading prolongado       | Baja         | Bajo    | UI ya cubre con `WorkspaceProvisioningState` durante 1-3s típicos.                                                            |
| Validación `isWorkspaceMember` añade latencia notable al callable de Pick             | Baja         | Bajo    | Una read extra (~30-100ms). Aceptable para una llamada que ya tarda segundos.                                                 |
| Migración de RAG/digest/memory rompe la memoria acumulada del agente                  | Baja         | Medio   | Tests Emulator; la migración es additive (set merge:true sobre dest); peor caso = el agente regenera memoria.                 |
| Operador olvida `--app-id` y el script falla silenciosamente                          | Baja         | Alto    | `--app-id` requerido sin default; exit 2 con mensaje explícito.                                                               |
| Entre paso 3 (migrate) y paso 5 (deploy), un user escribe al path viejo               | Baja         | Bajo    | Banner read-only desde paso 2; timing dominical; base pequeña.                                                                |
| `auth.user().onDelete` no implementado deja workspaces huérfanos si admin borra users | Media        | Bajo    | Defer aceptado; sub-proyecto 2 lo aborda con GDPR explícito.                                                                  |

---

## 7. Sucesores

Tras 1.5 mergeado:

1. **Cutover real**: ejecutar el runbook reordenado contra producción. Smoke tests sobre cuentas reales. Banner OFF.
2. **Sub-proyecto 5**: Monetización B2C. Stripe customer portal, paywall de Pick, quotas concretas, IVA España.
3. (Más adelante) Sub-proyectos 2-4-6-7 según el orden acordado.

Tras 1.5, la transición de modelo está completa. Lo que sigue es construir features sobre esa base.

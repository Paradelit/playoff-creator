# Sub-proyecto 2 — Permisos y scoping (design spec)

**Fecha:** 2026-05-04
**Predecesor:** Sub-proyecto 1 (modelo de cuenta + workspaces, live)
**Sucesor inmediato:** Sub-proyecto 3 (invitaciones y licencias)
**Status:** Diseño consolidado, pendiente revisión del usuario antes de pasar a `writing-plans`.

---

## Resumen de decisiones

1. **Aislamiento por categoría desde V1** (no por toggle global). Cuaderno, entrenamientos, brackets, calendarSessions y asistencia/informe operan en strict team scoping. Workspace doc, members directory, biblioteca club y cuaderno template son visibles a todos los members.

2. **Tres roles operativos**: `owner` (propiedad del workspace, exactamente uno), `dt` (membership.role, varios posibles), `coach` (membership.role, scopeado vía `assignedTeamIds`). El owner siempre tiene `role: 'dt'` en su membership y hereda DT + billing/transfer/delete que vienen de ser ownerId.

3. **Implementación vía membership doc lookup en reglas**, no custom claims. Razón: revocación instantánea sin esperar refresh de token, source of truth único, modelo simple.

4. **Sharing primitive nivel colección** (no per-doc): coach activa "DT puede leer toda mi asistencia de team1" mediante grant docs. V1 cubre `asistencia` e `informeJugadores` exclusivamente.

5. **Biblioteca de ejercicios bifurcada**: `workspaces/{wsId}/exercises/{*}` (DT escribe, members leen) y `users/{uid}/personalExercises/{*}` (workspace-agnostic, viaja con el coach entre clubs).

6. **Cuaderno template club-wide**: DT diseña una scaffold única por workspace (logo club, nombre, secciones 1-3) que todos los equipos heredan visualmente. Per-team templates son out-of-scope V1.

---

## 1. Identidad y representación de ownership

### Workspace doc

`artifacts/{appId}/workspaces/{wsId}`:

```ts
{
  ownerId: string,                  // exactamente 1 por workspace, source of truth
  type: 'personal' | 'club',         // ya existe (sub-1) — atención: en el workspace doc
                                     // el campo se llama `type`, NO `workspaceType`.
                                     // El membership doc del usuario sí usa `workspaceType`.
  plan: 'free' | 'pro' | ...,        // ya existe (sub-5)
  billing: { ...stripe-managed... }, // ya existe (sub-5), Cloud Functions only
  // ...resto sin tocar...
}
```

`ownerId` es la única fuente de verdad de "quién posee el workspace". No se duplica en la membership como `role: 'owner'`. Esto evita el bug "membership.role=owner pero ownerId=otro".

### Membership doc

`artifacts/{appId}/users/{uid}/memberships/{wsId}`:

```ts
{
  workspaceType: 'personal' | 'club',  // ya existe
  role: 'dt' | 'coach',                 // NUEVO sub-2
  assignedTeamIds: string[],            // NUEVO sub-2
}
```

- `role` ∈ {`'dt'`, `'coach'`}. Sin `'owner'` — ownership es propiedad del workspace, no del membership.
- `assignedTeamIds`: array de `teamId`s en los que este miembro tiene acceso write a contenido team-scoped. En V1 también gobierna READ de cuaderno/trainings/brackets/calendarSessions (strict scope).
- Para `role: 'dt'` el array puede estar vacío o contener teams si el DT entrena alguno; el rol de DT le da capacidades workspace-wide independiente del array.

### Personal vs club workspace

- **Personal**: `ownerId = uid del user`, una membership única `{ role: 'dt', assignedTeamIds: [...] }`. Como diseño, las reglas de Cat C bypasean strict scoping en personal workspaces (ver §4 helper `isPersonalWorkspaceOwner`): el owner-único de un personal workspace tiene acceso total a su propio contenido sin depender del estado de `assignedTeamIds`. Esto significa que `assignedTeamIds` en personal workspaces es cosmético (no se lee para gating) y la sincronización con creates de teams es best-effort, no crítica para acceso.

- **Club**: `ownerId = creator's uid` inicialmente. Memberships: el owner tiene `role: 'dt'`; otros DTs invitados tienen `role: 'dt'`; coaches invitados tienen `role: 'coach'` con sus `assignedTeamIds` específicos.

### Migración (data, no rules)

Las memberships creadas en sub-1 ya llevan `assignedTeamIds: []` y `role: 'owner'` (sub-1 las pobló así). Sub-2 las normaliza vía Cloud Function one-shot (ver §6): convierte `role: 'owner'` → `role: 'dt'` (alinea con la taxonomía sub-2 donde owner es propiedad del workspace, no rol de membership) y rellena `role: 'dt'` si está undefined. `assignedTeamIds` se mantiene como sub-1 lo dejó (vacío en personal workspaces; el bypass `isPersonalWorkspaceOwner` cubre el acceso). Idempotente.

Docs existentes en colecciones de items gateadas por `createdBy` (exercises, brackets, calendarSessions, teams/\*/trainings, teams/\*/members) tampoco lo tienen. La misma migración los backfilea con `createdBy = workspace.ownerId`. Cuaderno docs NO se backfilean porque son singleton state colaborativo, sin semántica de autor.

---

## 2. Categorización de colecciones

Cinco categorías, cada una con su patrón de regla.

### Cat A — Workspace meta

- `workspaces/{wsId}` — el doc del workspace
- `workspaces/{wsId}/members/{memberUid}` — directorio de memberships

### Cat B — Workspace-wide DT-curated

DT escribe, members leen.

- `workspaces/{wsId}/exercises/{*}` — biblioteca club de ejercicios
- `workspaces/{wsId}/cuadernoTemplate/{sectionId}` — scaffold del cuaderno (logo, nombre club, secciones 1-3)

### Cat C — Team-scoped strict

V1 modo B (strict scope) desde el principio.

- `workspaces/{wsId}/teams/{teamId}` — el team doc (nombre, color, metadata pública)
- `workspaces/{wsId}/teams/{teamId}/members/{*}` — jugadores del equipo (collection)
- `workspaces/{wsId}/teams/{teamId}/trainings/{*}` — entrenamientos (collection)
- `workspaces/{wsId}/teams/{teamId}/cuaderno/{sectionId}` — singleton docs por sección. `sectionId ∈ {'notas', 'pilares', 'normas', 'jugadores', 'test-tiro', 'asistencia', 'informe-jugadores', 'info'}` (kebab-case, real del codebase). Cada doc es estado colaborativo del equipo, NO carga `createdBy` semantic.
- `workspaces/{wsId}/brackets/{*}` — brackets enlazados al team vía campo `teamId`
- `workspaces/{wsId}/calendarSessions/{*}` — sessions enlazadas al team vía campo `teamId`
- `workspaces/{wsId}/teams/{teamId}/grants/{collectionType}/grantees/{grantedToUid}` — sharing grants per-team-per-sección. V1: `collectionType ∈ {'asistencia', 'informe-jugadores'}` (kebab-case, idéntico al sectionId del cuaderno). Path con `grantees` intermedio porque las reglas de Firestore exigen alternancia collection/doc estricta.

**Nota**: el `teams/{teamId}` doc en sí es member-readable (todos saben qué equipos existen + nombre/color). Solo el contenido nested está strict-scoped.

### Cat D — User-scoped (fuera de workspace)

Cubierto por la regla actual `users/{uid}/{**}`. Sin cambios estructurales.

- `users/{uid}/personalExercises/{*}` — biblioteca personal del coach, workspace-agnostic
- `users/{uid}/{...resto: profile, memberships, pickHistory, etc...}`

### Cat E — Sistema

Sin cambios; sub-5 ya los lockeó.

- `workspaces/{wsId}/usage/{monthId}` — quota counter, write-via-Admin-SDK
- `artifacts/{appId}/stripeEvents/{eventId}` — idempotency markers, write-via-Admin-SDK

### Fuera de scope sub-2

- `shared/{*}` y `shared-exercises/{*}` — share-by-code flow legado, reglas actuales correctas
- Cleanup de paths legacy `users/{uid}/{teams,brackets,calendarSessions,...}` programado para 2026-05-24, ortogonal

---

## 3. Matriz de permisos

Notación: ✅ permitido · ❌ denegado · ⚠ condicional · "member" = `isWorkspaceMember(wsId)` (cualquier rol).

### Cat A — Workspace meta

| Doc                   | read   | create                                | update                                                                 | delete                           |
| --------------------- | ------ | ------------------------------------- | ---------------------------------------------------------------------- | -------------------------------- |
| `workspaces/{wsId}`   | member | self-as-owner (`ownerId == auth.uid`) | owner libre · DT solo si NO toca `ownerId`/`plan`/`billing.*`          | owner                            |
| `members/{memberUid}` | member | DT/owner                              | DT/owner · ⚠ no la del `ownerId` (excepto el owner editando su propia) | DT/owner · ⚠ no la del `ownerId` |

**Sharp edge — DT no puede demote al owner.** Update de members requiere `memberUid != workspace.ownerId` para DTs no-owner. Owner sí puede modificar su propia membership pero antes debe transferir ownership cambiando `workspaces.ownerId` (operación owner-only).

**Sharp edge — field-level protection en workspace doc.** DT puede editar settings (display name, etc.) pero no `ownerId` (transfer = owner-only), no `plan` (Stripe webhook vía Admin SDK), no `billing.*` (idem). Patrón:

```js
request.resource.data.diff(resource.data).affectedKeys().hasAny(['ownerId', 'plan', 'billing']) == false;
```

**Sharp edge — transfer ownership valida nuevo owner**. Update con `ownerId` cambiado solo se permite si el nuevo `ownerId` ya es member del workspace.

### Cat B — Workspace-wide DT-curated

| Doc                               | read   | create                             | update                             | delete                             |
| --------------------------------- | ------ | ---------------------------------- | ---------------------------------- | ---------------------------------- |
| `exercises/{*}` (biblioteca club) | member | DT/owner · `createdBy == auth.uid` | DT/owner · `createdBy == auth.uid` | DT/owner · `createdBy == auth.uid` |
| `cuadernoTemplate/{*}`            | member | DT/owner                           | DT/owner                           | DT/owner                           |

**Coach NO escribe en biblioteca club.** Su biblioteca personal es Cat D.

**Coach NO edita ni borra ejercicios creados por DT.** El intersect DT/owner ∧ createdBy garantiza que solo el creator-DT puede tocar su ejercicio. Si un DT se demote a coach, pierde DT-rights y ya no puede editar sus propios ejercicios del club.

### Cat C — Team-scoped strict

DT NO obtiene read automático en club workspaces. Solo via `isAssignedToTeam`, `isCreator(resource)` o `hasGrantOn(...)`.

**Bypass para personal workspaces**: el helper `isPersonalWorkspaceOwner` (ver §4) abre acceso total al owner-único de su personal workspace, dado que por diseño (sub-0) los personal workspaces son solo-uso. Todas las reglas de Cat C empiezan con `isPersonalWorkspaceOwner(appId, wsId) || ...`. Esto evita que crear teams nuevos post-sub-2 deje contenido inaccesible hasta que sub-3 sincronice `assignedTeamIds`.

| Doc                                                                                    | read                                                               | create                                                    | update                                                              | delete                                                   |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| `teams/{teamId}` (el doc)                                                              | member (todos saben qué equipos existen)                           | DT/owner                                                  | DT/owner · O coach asignado                                         | DT/owner                                                 |
| `teams/{teamId}/members/{*}` (jugadores)                                               | coach asignado · O `isCreator`                                     | coach asignado · O DT (DT-create override)                | coach asignado · O `isCreator`                                      | coach asignado · O `isCreator`                           |
| `teams/{teamId}/trainings/{*}`                                                         | coach asignado · O `isCreator`                                     | coach asignado · O DT                                     | coach asignado · O `isCreator`                                      | coach asignado · O `isCreator`                           |
| `teams/{teamId}/cuaderno/{sectionId}` para sectionId ∉ {asistencia, informe-jugadores} | coach asignado                                                     | coach asignado                                            | coach asignado                                                      | coach asignado                                           |
| `teams/{teamId}/cuaderno/asistencia` (singleton)                                       | coach asignado · O `hasGrantOn(wsId, teamId, 'asistencia')`        | coach asignado                                            | coach asignado                                                      | coach asignado                                           |
| `teams/{teamId}/cuaderno/informe-jugadores` (singleton)                                | coach asignado · O `hasGrantOn(wsId, teamId, 'informe-jugadores')` | coach asignado                                            | coach asignado                                                      | coach asignado                                           |
| `brackets/{*}` (con `teamId` field)                                                    | coach asignado al `resource.data.teamId` · O `isCreator`           | coach asignado al `request.resource.data.teamId` · O DT   | coach asignado a AMBOS teamIds (existing y request) · O `isCreator` | coach asignado al `resource.data.teamId` · O `isCreator` |
| `calendarSessions/{*}` (con `teamId` field)                                            | igual brackets                                                     | igual brackets                                            | igual brackets                                                      | igual brackets                                           |
| `teams/{teamId}/grants/{collectionType}/grantees/{grantedToUid}`                       | member (transparencia)                                             | coach asignado · `grantedBy == auth.uid` · path coherente | ❌ (update prohibido, recreate)                                     | granter · O DT/owner                                     |

**Cuaderno docs son singleton state, no items con autor.** Cada `sectionId` es UN doc por equipo (no una subcolección). Coaches asignados al equipo escriben colaborativamente sobre el mismo doc. La regla NO incluye cláusula `isCreator` para cuaderno: si te quitan asignación al equipo, pierdes acceso a la cuaderno aunque hubieras escrito en el pasado. Coherente con "el cuaderno es del equipo, no del autor".

**Sharp edges:**

- **DT crea pero no lee** salvo que sea creador o esté asignado. DT puede plantar contenido en cualquier team (entrenamientos, jugadores, brackets) pero queda firmado con su uid; cuando coach del team escriba el suyo propio, DT no lo verá.

- **`teams/{teamId}` doc es member-readable.** Todos los members del workspace ven el listado de equipos del club con su metadata superficial (nombre, color). Sin esto, un coach asignado a t1 no podría ni siquiera enumerar el ecosistema del club. El contenido nested es lo que está strict-scoped.

- **Update de brackets/calendarSessions exige doble verificación**. Coach asignado a t1 NO puede mover un bracket de t1 a t2. Debe estar asignado a ambos teamIds (el existente y el nuevo). Sin esta cláusula doble, un coach podría hacer escapes de scoping.

- **Coach mantiene acceso vía `isCreator` tras desasignación parcial**. Si un coach pierde t1 pero mantiene t2, las cosas que él creó en t1 le siguen siendo legibles+editables. Si pierde la membership entera, `isMember` falla y se pierde todo. Decisión consciente: portfolio de creaciones sigue al autor.

### Cat D — User-scoped

| Path                                             | read                     | write |
| ------------------------------------------------ | ------------------------ | ----- |
| `users/{uid}/{**}` (incluye `personalExercises`) | self (`auth.uid == uid`) | self  |

Sin cambios sobre la regla actual. Biblioteca personal vive aquí; viaja con el coach entre clubs (no se duplica per-workspace).

### Cat E — Sistema

| Path                                       | read   | write               |
| ------------------------------------------ | ------ | ------------------- |
| `workspaces/{wsId}/usage/{monthId}`        | member | ❌ (Admin SDK only) |
| `artifacts/{appId}/stripeEvents/{eventId}` | ❌     | ❌ (Admin SDK only) |

Sin cambios sub-2; sub-5 ya los configuró.

---

## 4. Helper functions en firestore.rules

Toda la matriz se expresa con 8 helpers reutilizables. Firestore cachea los `get()` dentro de la misma evaluación de regla, así que llamar a `membershipData(...)` 3 veces en una rule sigue costando 1 read.

```js
// === IDENTIDAD ===

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
  // Personal workspaces son solo-uso por diseño (sub-0): ownerId es el único
  // habitante. Bypass de strict scoping en Cat C — sin esto, crear teams nuevos
  // en personal workspace post-sub-2 dejaría inaccesible el contenido propio
  // hasta que sub-3 sincronice assignedTeamIds. Defensa belt-and-suspenders.
  // Field es 'type' (no 'workspaceType') — sub-1 lo creó así.
  return isWorkspaceOwner(appId, wsId)
      && workspaceData(appId, wsId).type == 'personal';
}

function isDT(appId, wsId) {
  return isWorkspaceMember(appId, wsId) && membershipData(appId, wsId).role == 'dt';
}

// === SCOPING ===

function isAssignedToTeam(appId, wsId, teamId) {
  return isWorkspaceMember(appId, wsId)
      && teamId in membershipData(appId, wsId).assignedTeamIds;
}

function hasGrantOn(appId, wsId, teamId, collectionType) {
  return isWorkspaceMember(appId, wsId) && exists(
    /databases/$(database)/documents/
      artifacts/$(appId)/workspaces/$(wsId)/teams/$(teamId)
      /grants/$(collectionType)/grantees/$(request.auth.uid)
  );
}

// === COMPOSICIÓN ===

function isCreator(data) { return data.createdBy == request.auth.uid; }

function workspaceMetaProtected(diff) {
  return diff.affectedKeys().hasAny(['ownerId', 'plan', 'billing']) == false;
}
```

### Patrón de regla — cuaderno (singleton por sección, sin createdBy)

```js
match /artifacts/{appId}/workspaces/{wsId}
  /teams/{teamId}/cuaderno/{sectionId} {

  allow read: if isPersonalWorkspaceOwner(appId, wsId)
                 || isAssignedToTeam(appId, wsId, teamId)
                 || (
                   (sectionId == 'asistencia' || sectionId == 'informe-jugadores')
                   && hasGrantOn(appId, wsId, teamId, sectionId)
                 );

  allow write: if isPersonalWorkspaceOwner(appId, wsId)
                   || isAssignedToTeam(appId, wsId, teamId);
}
```

### Patrón de regla — items con createdBy (trainings, jugadores)

```js
match /artifacts/{appId}/workspaces/{wsId}
  /teams/{teamId}/trainings/{trainingId} {

  allow read: if isPersonalWorkspaceOwner(appId, wsId)
                 || isAssignedToTeam(appId, wsId, teamId)
                 || (resource != null && isCreator(resource.data));

  allow create: if isPersonalWorkspaceOwner(appId, wsId)
                   || (
                     (isAssignedToTeam(appId, wsId, teamId) || isDT(appId, wsId))
                     && isCreator(request.resource.data)
                   );

  allow update: if (isPersonalWorkspaceOwner(appId, wsId)
                     || isAssignedToTeam(appId, wsId, teamId)
                     || (resource != null && isCreator(resource.data)))
                   && request.resource.data.createdBy == resource.data.createdBy;

  allow delete: if isPersonalWorkspaceOwner(appId, wsId)
                   || isAssignedToTeam(appId, wsId, teamId)
                   || (resource != null && isCreator(resource.data));
}
```

### Patrón de regla — bracket (teamId en field)

```js
match /artifacts/{appId}/workspaces/{wsId}/brackets/{bracketId} {
  allow read: if isPersonalWorkspaceOwner(appId, wsId)
                 || isAssignedToTeam(appId, wsId, resource.data.teamId)
                 || isCreator(resource.data);

  allow create: if isPersonalWorkspaceOwner(appId, wsId)
                   || (
                     (isAssignedToTeam(appId, wsId, request.resource.data.teamId)
                       || isDT(appId, wsId))
                     && isCreator(request.resource.data)
                   );

  allow update: if (isPersonalWorkspaceOwner(appId, wsId)
                     || (isAssignedToTeam(appId, wsId, resource.data.teamId)
                         && isAssignedToTeam(appId, wsId, request.resource.data.teamId))
                     || isCreator(resource.data))
                   && request.resource.data.createdBy == resource.data.createdBy;

  allow delete: if isPersonalWorkspaceOwner(appId, wsId)
                   || isAssignedToTeam(appId, wsId, resource.data.teamId)
                   || isCreator(resource.data);
}
```

### Notas de implementación

1. **Wildcard de cuaderno por sectionId**: el match `cuaderno/{sectionId}` con `sectionId == 'asistencia' || sectionId == 'informe-jugadores'` (gating de grants por nombre) es DRY. Si añadimos una nueva sección al cuaderno, hereda el comportamiento base sin sharing — null-safe.

2. **`resource != null` en reads**: Firestore evalúa la regla read tanto para `get` (resource existe) como para `list` (resource null en algunos paths). El check evita NullPointerException al acceder `resource.data.createdBy`.

3. **`createdBy` inmutable**: TODAS las rules update con createdBy semánticamente activo deben llevar `request.resource.data.createdBy == resource.data.createdBy` para impedir cambio de autor post-create. Evita "abandono cambiando autor" e impersonación tardía.

4. **Sin claims, sin caches custom**: source of truth es el membership doc. Revocación instantánea garantizada.

---

## 5. Edge cases & lifecycle operations

### A. Cambios de ownership y rol

**Transfer de ownership**: owner cambia `workspaces/{wsId}.ownerId` a otro uid. La regla extiende el update con un check: el nuevo ownerId debe ya ser member del workspace.

```js
allow update: if isWorkspaceOwner(appId, wsId)
  && (request.resource.data.ownerId == resource.data.ownerId
      || isWorkspaceMemberUid(appId, wsId, request.resource.data.ownerId));
```

**Owner se quiere demoter a coach**: imposible directamente. Antes tiene que transferir ownership a otro DT. Sub-3 le presenta el flujo "Designa nuevo owner antes de cambiar tu rol".

**Promoción/democión DT↔Coach** (no afecta al owner): DT/owner edita `members/{uid}.role`. Constraint: no se toca la membership del `ownerId`.

```js
match /members/{memberUid} {
  allow update: if (isDT(appId, wsId) || isWorkspaceOwner(appId, wsId))
                   && memberUid != workspaceData(appId, wsId).ownerId;
  allow update: if isWorkspaceOwner(appId, wsId) && memberUid == request.auth.uid;
}
```

**Revoke de coach**: delete del membership doc. DT/owner pueden, salvo sobre el ownerId.

### B. Invariantes de autoría

**`createdBy` inmutable**. Cláusula obligatoria en cada update de docs con createdBy semánticamente activo. Evita abandono o impersonación.

**DT no puede impersonar coach al crear**. La regla create exige `request.resource.data.createdBy == request.auth.uid`. DT puede plantar contenido en cualquier equipo, pero queda firmado con SU uid.

**Coach mantiene acceso a sus creaciones tras desasignación parcial**. Si la `assignedTeamIds` se reduce, las creaciones le siguen siendo legibles+editables vía la cláusula `isCreator(resource.data)`. Si pierde la membership entera, `isMember` falla y todo se cierra. Audit trail (createdBy) sobrevive a la revocación.

### C. Sharing primitive — gestión y limpieza

**Quién crea grants**: coach asignado al equipo:

```js
match /teams/{teamId}/grants/{collectionType}/grantees/{grantedToUid} {
  allow read: if isWorkspaceMember(appId, wsId);
  allow create: if isAssignedToTeam(appId, wsId, teamId)
                   && request.resource.data.grantedBy == request.auth.uid
                   && request.resource.data.collectionType == collectionType
                   && request.resource.data.grantedTo == grantedToUid;
  allow update: if false;  // grants no se editan, se borran y recrean
  allow delete: if (isAssignedToTeam(appId, wsId, teamId)
                     && resource.data.grantedBy == request.auth.uid)
                   || isDT(appId, wsId)
                   || isWorkspaceOwner(appId, wsId);
}
```

**Stale grants después de revoke del coach**: si revocas a un coach que tenía grants vivos, los grants persisten (DT sigue con acceso). V1: aceptado. Sub-3 añadirá un Cloud Function trigger que, on member delete, limpia outstanding grants. La regla NO impone la limpieza.

**Grant a uid que ya no es member**: el `hasGrantOn` retorna true solo si el caller es member del workspace, así que un grant a alguien expulsado del workspace queda inerte automáticamente.

### D. Backfill races & migración ordering

**Problema**: las memberships existentes (creadas en sub-1) no tienen `role` ni `assignedTeamIds`. Las reglas nuevas las leen y fallan o devuelven false en cláusulas críticas.

**Solución elegida — dos deploys explícitos**:

- **Deploy 1**: Cloud Function de migración + ejecución manual sobre prod. Backfilea `role: 'dt'`, `assignedTeamIds: [...todos los teamIds]`, y `createdBy: ownerId` en docs viejos. Idempotente.
- **Deploy 2**: Nuevo `firestore.rules` rewriteado + tests. Asume el shape backfilleado.

**Verificación pre-deploy 2**: count queries que devuelvan 0 antes de proceder:

- Memberships sin `role` field
- Memberships sin `assignedTeamIds` field
- Docs sin `createdBy` en exercises, cuaderno/\*, brackets, calendarSessions, trainings

Si no es 0, abort. Re-run migration.

**Por qué no defaults blandos en helpers** (`m.get('role', 'dt')`): silenciaría errores reales (DT sin asignaciones por bug en migración) y rompería la auditabilidad. Preferimos audit trail explícito y rollback reversible.

**Rollback plan**: si las rules nuevas rompen prod, revertir solo el archivo `firestore.rules` (rules-deploy es atómico). Los datos backfilleados sobreviven y vuelven a ser correctos cuando re-despleguemos. Ningún rollback irreversible.

---

## 6. Tests + migración runbook + out-of-scope

### A. Estrategia de tests

`firestore.rules.test.ts` ya existe (sub-5 lo extendió para stripeEvents). Sub-2 reescribe el archivo con cobertura completa de la nueva matriz.

**Setup**: Firestore Emulator + `@firebase/rules-unit-testing`. Cada test crea un workspace con datos seed, autentica como uids distintos (owner / dt-no-owner / coach-asignado-a-t1 / coach-asignado-a-t2 / non-member) y asserta allow/deny.

**Cobertura objetivo (~28 casos)**:

| Bloque                               | Casos | Lo que valida                                                                                                                                                  |
| ------------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cat A — Workspace meta               | 4     | owner edita libre, DT edita pero no `ownerId/plan/billing`, coach denegado, non-member denegado                                                                |
| Cat A — Members directory            | 5     | DT crea/edita/borra coach; DT no toca ownerId membership; owner edita su propia; coach lee directorio; non-member denegado                                     |
| Cat B — Workspace-wide curated       | 4     | DT crea ejercicio/template; coach lee biblioteca club pero NO escribe; coach NO edita ejercicio del DT; DT edita su propia creación                            |
| Cat C — Team-scoped (cuaderno notas) | 6     | coach-t1 R/W en t1; coach-t1 denegado en t2; DT denegado en lectura sin asignar; DT puede CREATE en cualquier team; createdBy retains R/W; non-member denegado |
| Cat C — Sharing primitive            | 5     | coach-t1 crea grant para DT; DT con grant lee asistencia; DT sin grant denegado; coach revoca grant → DT denegado de nuevo; grant update prohibido             |
| Cat C — Brackets/calendarSessions    | 3     | coach-t1 R/W en bracket de t1; coach-t1 NO puede reparentear bracket de t1 a t2; DT crea bracket en cualquier team                                             |
| Lifecycle                            | 1     | transfer ownership requiere new ownerId sea member                                                                                                             |

**Patrón** (referencia, no exhaustivo):

```ts
it('coach asignado a t1 NO puede leer cuaderno/notas (doc) de t2', async () => {
  const coach = testEnv.authenticatedContext('coach-uid', {
    /*...*/
  });
  await assertFails(getDoc(coach.firestore().doc('artifacts/test-app/workspaces/ws1/teams/t2/cuaderno/notas')));
});
```

### B. Migración runbook

**Deploy 1 — `migrateToSubproyecto2` Cloud Function** (one-shot HTTP callable, admin-gated):

```ts
// functions/src/migrations/migrateToSubproyecto2.ts
export const migrateToSubproyecto2 = onCall(async (req) => {
  // 1. Auth: super-admin uid hardcoded o feature flag
  // 2. Iterar workspaces: artifacts/{appId}/workspaces/*
  // 3. Por cada workspace:
  //    a. Iterar memberships subcolección.
  //       Si !exists(role): set role='dt', assignedTeamIds=[...todos los teamIds del ws]
  //    b. Iterar docs sin createdBy en exercises, brackets, calendarSessions, teams/{tid}/trainings, teams/{tid}/members. Cuaderno NO se backfilea (singleton state, sin createdBy semántico).
  //       Si !exists(createdBy): set createdBy=workspace.ownerId
  // 4. Devolver counts: workspacesProcessed, membershipsBackfilled, docsBackfilled
});
```

**Verificación pre-deploy 2**: script con Admin SDK (o segunda Cloud Function read-only) que cuenta:

- Memberships sin `role`: debe ser 0
- Memberships sin `assignedTeamIds`: debe ser 0
- Docs sin `createdBy` (en las colecciones afectadas): debe ser 0

**Deploy 2 — `firestore.rules` reescrito + `firestore.rules.test.ts` extendido**. Tests pasando en Emulator antes del deploy (CI gate).

**Deploy 3 (cleanup, opcional)** — eliminar la Cloud Function de migración tras un soak de 1-2 semanas. Sub-2 cierra cuando deploy 3 sale.

### C. Out-of-scope explícito (no hacer en sub-2)

- UI para gestionar memberships (invitar, asignar a teams, transfer ownership) → sub-3
- DT view dashboard (lista cross-team, calendario cruzado) → sub-4
- Cleanup de stale grants on member delete → sub-3 lo añade como Cloud Function trigger
- Cloud Function trigger que sincroniza `assignedTeamIds` en personal workspaces cuando se crea un team → sub-3
- Templates per-equipo de cuaderno (modo opcional para clubes grandes) → diferido
- Rol `admin-billing` distinto del owner → diferido hasta cliente real
- PDF/exports filtered by role → sub-4 ó sub-7
- Audit log de quién leyó qué → no V1

---

## Cierre

Sub-proyecto 2 cierra cuando:

1. Cloud Function de migración deployed y ejecutada con éxito (counts a 0).
2. `firestore.rules` reescrito con los 5 patrones de Cat A-E.
3. `firestore.rules.test.ts` con ~28 casos pasando en CI.
4. Soak de 1-2 semanas sin reportes de regresión.
5. Cleanup deploy elimina la Cloud Function de migración.

Sucesor inmediato: **sub-proyecto 3 — Invitaciones y licencias**, que construye el flujo DT-invita-coach + asignación a equipos sobre la base de roles de este sub-proyecto.

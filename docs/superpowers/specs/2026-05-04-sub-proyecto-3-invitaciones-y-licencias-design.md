# Sub-proyecto 3 — Invitaciones y licencias (design spec)

**Fecha:** 2026-05-04
**Predecesor:** Sub-proyecto 2 (permisos y scoping, live)
**Sucesor inmediato:** Sub-proyecto 4 (vista de Director Técnico)
**Status:** Diseño consolidado, pendiente revisión del usuario antes de pasar a `writing-plans`.

---

## Resumen de decisiones

1. **Scope V1: allowlist + feature flag.** La creación de un workspace de club queda gated tras una allowlist hardcodeada de uids (super-admin + 1-2 testers). Toda la maquinaria (callables, triggers, UI de gestión de members, claim de invite) se entrega y queda viva, pero el botón "Crear workspace de club" solo lo ven los uids en allowlist. Sub-4 abrirá clubs al público al desplegar la vista DT.

2. **Mecanismo de invitación: link copiable single-use.** No se monta infra de email transaccional. El DT genera un invite y recibe un URL `https://app.com/invite/{wsId}/{inviteId}` que copia y comparte por WhatsApp/email manual. El email del coach es campo opcional (hint pre-asignado al invite, no contrato).

3. **Forma del invite: completo.** El invite lleva `role` (`'dt'` o `'coach'`), `email` opcional, `name` opcional, y `assignedTeamIds[]`. Tras claim, el coach entra al workspace con sus teams asignados y trabaja desde minuto cero.

4. **Lifetime: 7 días, single-use, revocable.** El invite caduca a los 7 días (re-issue gratis). Se borra al claim. El DT puede revocar invites pendientes desde la UI.

5. **UI: tres pantallas dedicadas.** `settings/miembros` para la gestión cotidiana del directorio + invitaciones pendientes; `settings/transferir-propiedad` separada con confirmación dura (typing del nombre del workspace); `/invite/:wsId/:inviteId` como ruta pública para el claim.

6. **5 hooks de Cloud Functions:** `onMemberDelete` (cleanup grants + invites), `onTeamCreate` (sync `assignedTeamIds` en personal), `onTeamDelete` (cleanup grants + remove from assignedTeamIds), `transferOwnership` callable (atomic owner switch + role bump), `cleanupExpiredInvites` (scheduler diario).

7. **Operaciones críticas via callables, no writes directos.** `members/{uid}` y `workspaces/{wsId}.ownerId` se cierran a writes desde cliente en sub-3 (sub-2 los permitía). Toda mutación pasa por callables con validación server-side. Los invites también: writes bloqueados, callables son el único path.

---

## 1. Arquitectura general

```
┌───────────────────────────────────────────────────────────┐
│  CLIENTE (React + Firestore SDK)                          │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  /area-privada/settings/miembros (UI principal)     │  │
│  │  /area-privada/settings/transferir-propiedad         │  │
│  │  /invite/:wsId/:inviteId (claim flow público)        │  │
│  │  Modal "Crear club" en shell (allowlist-gated)       │  │
│  └─────────────────────────────────────────────────────┘  │
│                  │                                         │
│   useMemberships, useInvites, useTransferOwnership         │
└──────────────────┼─────────────────────────────────────────┘
                   │
            ┌──────┴──────────┐
            │                 │
    ┌───────▼─────┐   ┌──────▼──────────────┐
    │  Firestore  │   │  Cloud Functions    │
    │  (reads)    │   │  (writes críticos)  │
    │             │   │                     │
    │ workspaces/ │   │  Callables:         │
    │ ws/members  │   │  • createClub       │
    │ ws/invites  │   │  • inviteMember     │
    │             │   │  • acceptInvite     │
    │             │   │  • revokeInvite     │
    │             │   │  • revokeMember     │
    │             │   │  • setMemberTeams   │
    │             │   │  • setMemberRole    │
    │             │   │  • transferOwnership│
    │             │   │                     │
    │             │   │  Triggers:          │
    │             │   │  • onMemberDelete   │
    │             │   │  • onTeamCreate     │
    │             │   │  • onTeamDelete     │
    │             │   │                     │
    │             │   │  Scheduled:         │
    │             │   │  • cleanupInvites   │
    └─────────────┘   └─────────────────────┘
```

### Por qué callables y no writes directos

Algunas operaciones requieren validar invariantes que las rules no pueden enforce sin lookups complejos o writes atómicos multi-doc:

- `inviteMember`: crear invite doc + validar teamIds + opcionalmente normalizar email. Atómico desde server.
- `transferOwnership`: cambiar `workspace.ownerId` Y subir `members/{newOwner}.role` a `'dt'` en una sola transacción. Sin atomic guarantee desde cliente.
- `acceptInvite`: borrar invite + crear `members/{uid}` + crear `users/{uid}/memberships/{wsId}` en transacción atómica. Tres writes coordinados.
- `revokeMember`: el delete de `members/{uid}` dispara el trigger `onMemberDelete` que limpia grants. La callable consolida auditoría/logging.

Operaciones que siguen siendo writes directos (sub-2 ya lo cubre): `cuadernoTemplate`, `exercises`, `teams`, `cuaderno/*`, `trainings`, edición de campos display del workspace.

### Feature flag (allowlist)

```ts
// functions/src/sub3/clubAllowlist.ts
export const CLUB_CREATION_ALLOWLIST = [
  'y6vqlMynjRQeRpAKUnYmQdUiMen1', // serpa2003@gmail.com
  // añadir testers según se vaya validando
];
```

El callable `createClub` valida la allowlist server-side. Existe además una callable read-only `getClubAllowlistStatus` que la UI invoca para decidir si renderizar el botón "Crear workspace de club" en el `WorkspaceSelector`. Resto del UI (gestión de miembros, claim) NO está gated — un coach que ya está en un club puede ver la pantalla de miembros (con permisos según rol). Sólo la **creación** de club lo está.

---

## 2. Modelo de datos

### Colección nueva: `workspaces/{wsId}/invites/{inviteId}`

```ts
{
  // Identidad (el doc id es el token; aleatorio Firestore-generated, ~120 bits)
  inviteId: string,            // doc id, también el token usado en URLs
  workspaceId: string,         // wsId, redundante para query collection group

  // Quién invita
  invitedBy: string,           // uid del DT/owner que generó el invite

  // Quién recibe (todos opcionales, no vinculantes)
  inviteEmail: string | null,
  inviteName: string | null,

  // Qué será cuando claim
  role: 'dt' | 'coach',
  assignedTeamIds: string[],

  // Lifecycle
  createdAt: Timestamp,
  expiresAt: Timestamp,        // createdAt + 7 días
  // SIN status field. El doc existe = invite vivo. Se borra al claim/revoke/expire.
}
```

**Por qué `inviteId` aleatorio = token:** Firestore IDs son random by default y suficientemente entrópicos. El URL natural es `https://app.com/invite/{wsId}/{inviteId}` — necesita el wsId también porque la query a Firestore es path-based.

**Por qué SIN status:** "pending / accepted / revoked / expired" se modela por presencia/ausencia. Un invite en cualquiera de esos estados terminales se borra. Más simple, evita races sobre quién decide si está expired.

**Por qué `assignedTeamIds` se guarda en el invite:** la decisión del DT al crear se materializa al claim. Si el DT cambia su decisión antes del claim, revoca y crea uno nuevo. La edición in-place de invites es out-of-scope V1.

### Membership doc tras claim

Sin cambios sobre el shape definido en sub-2, con campos de display/audit añadidos en sub-3:

```ts
// workspaces/{wsId}/members/{uid}
{
  role: 'dt' | 'coach',
  assignedTeamIds: string[],
  // Sub-3 añade:
  displayName: string,        // del Firebase Auth user — denormalizado para evitar lookups en UI
  email: string,              // idem
  joinedAt: Timestamp,
  invitedBy: string | null,   // uid del invitador (null para owner del workspace)
  mismatchedEmailHint?: true, // flag opcional: el invite tenía email distinto al del claim
}

// users/{uid}/memberships/{wsId}
{
  workspaceType: 'personal' | 'club',
  workspaceName: string,      // denormalizado para selector sin extra reads
}
```

### Field redundante en grants

Sub-2 creó `workspaces/{wsId}/teams/{teamId}/grants/{collectionType}/grantees/{grantedToUid}` con field `grantedTo: uid` ya en el body (espejando el doc id). Sub-3 lo aprovecha sin cambios — el trigger `onMemberDelete` lo necesita para query collection group (Firestore no permite filtrar por doc id en collection group queries). Los rules de sub-2 ya validan coherencia entre el doc id y el field `grantedTo`.

Adicionalmente, sub-3 añade `workspaceId: wsId` redundante a cada grant doc al crearse, también para query collection group por workspace.

### Allowlist storage

Hardcoded en `functions/src/sub3/clubAllowlist.ts` — array exportado, redeploy para cambios. Mismo patrón que `SUPERADMIN_UID` en migrations sub-2. Razón: 1-2 uids, cambio raro, simplicidad. Si la allowlist crece (>10 uids) o cambia frecuentemente, se migra a Firestore en sub-4.

---

## 3. Callables y triggers detallados

Todas las funciones viven en `functions/src/sub3/` (mirroring `sub5/`). Cada una con tipos, validación de auth, transacciones donde haga falta, y test unitario con mock Firestore.

### 3.1 Callables (server-side writes)

**`createClub({ name }) → { wsId }`**

- Auth: `auth.uid` debe estar en `CLUB_CREATION_ALLOWLIST`. Si no, `permission-denied`.
- Validación: `name` no vacío, ≤80 chars.
- Transacción atómica:
  1. Crea `workspaces/{newWsId}` con `{ type: 'club', ownerId: auth.uid, name, plan: 'free', createdAt }`.
  2. Crea `members/{auth.uid}` con `{ role: 'dt', assignedTeamIds: [], displayName, email, joinedAt, invitedBy: null }`.
  3. Crea `users/{auth.uid}/memberships/{newWsId}` con `{ workspaceType: 'club', workspaceName: name }`.
- Devuelve `{ wsId }`. UI redirige al nuevo workspace.

**`inviteMember({ wsId, role, assignedTeamIds, email?, name? }) → { inviteId, link }`**

- Auth: caller debe ser `dt` o `owner` del wsId.
- Validación: `role ∈ {'dt', 'coach'}`. Si `role === 'coach'`, `assignedTeamIds.length ≥ 1`. Cada `teamId` debe existir como doc en `workspaces/{wsId}/teams`. `email` (si presente) debe parsear como email válido.
- Crea `workspaces/{wsId}/invites/{inviteId}` con los campos del modelo.
- Devuelve `{ inviteId, link: 'https://app.com/invite/{wsId}/{inviteId}' }`.

**`acceptInvite({ wsId, inviteId }) → { ok: true, wsId }`**

- Auth: cualquier signed-in user.
- Validación en transacción:
  1. Lee `workspaces/{wsId}/invites/{inviteId}`. Si no existe → `not-found` ("invite usado o expirado").
  2. Si `expiresAt < now` → `failed-precondition` + delete del invite (cleanup oportunista). Mensaje: "invite caducado".
  3. Si ya existe `members/{auth.uid}` en este workspace → `already-exists` ("ya eres miembro").
  4. Crea `members/{auth.uid}` con `role`, `assignedTeamIds`, `displayName`, `email` (todos del Auth user), `joinedAt: now`, `invitedBy: invite.invitedBy`.
  5. Crea `users/{auth.uid}/memberships/{wsId}` con `workspaceType`, `workspaceName` (lee del workspace doc).
  6. Si `invite.inviteEmail && invite.inviteEmail !== auth.email`: añade `mismatchedEmailHint: true` al membership doc para audit.
  7. Borra el invite doc.
- Devuelve `{ ok: true, wsId }`. UI redirige al workspace.

**`revokeInvite({ wsId, inviteId }) → { ok: true }`**

- Auth: caller debe ser `dt` o `owner` del wsId.
- Borra `workspaces/{wsId}/invites/{inviteId}`. No hay transacción — borrar un invite no claimd no tiene side effects.

**`revokeMember({ wsId, memberUid }) → { ok: true }`**

- Auth: caller debe ser `dt` o `owner` del wsId.
- Validación: `memberUid !== workspace.ownerId`. Sin esto, owner se quedaría sin acceso a su propio workspace.
- Borra `workspaces/{wsId}/members/{memberUid}` Y `users/{memberUid}/memberships/{wsId}` en transacción atómica.
- El trigger `onMemberDelete` se encarga del cleanup de grants e invites pendientes generados por este uid.

**`setMemberTeams({ wsId, memberUid, assignedTeamIds }) → { ok: true }`**

- Auth: caller debe ser `dt` o `owner`.
- Validación:
  - Cada `teamId` existe en `workspaces/{wsId}/teams`.
  - Si caller NO es owner del workspace: `memberUid !== workspace.ownerId` (DT no-owner no puede tocar el assignment del owner).
  - Si caller ES owner: puede editar cualquier member, incluido sí mismo (caso natural — owner que quiere asignarse a un team que él mismo entrena).
- Update `members/{memberUid}.assignedTeamIds`.

**`setMemberRole({ wsId, memberUid, role }) → { ok: true }`**

- Auth: caller debe ser `dt` o `owner`.
- Validación: `role ∈ {'dt', 'coach'}` + `memberUid !== workspace.ownerId` (la membership del owner es siempre `role: 'dt'`, no se puede demote ni siquiera por sí mismo — para bajarse, antes hay que transferir ownership a otro DT).
- Update `members/{memberUid}.role`.

**`transferOwnership({ wsId, newOwnerUid }) → { ok: true }`**

- Auth: caller debe ser **owner** actual (`workspaces/{wsId}.ownerId === auth.uid`).
- Validación: `newOwnerUid !== auth.uid` + `newOwnerUid` ya es member del workspace.
- Transacción atómica:
  1. Update `workspaces/{wsId}.ownerId = newOwnerUid`.
  2. Update `members/{newOwnerUid}.role = 'dt'` (idempotente si ya era dt).
- El owner anterior conserva `role: 'dt'`. Si quiere bajarse a coach o irse, después llama `setMemberRole` o `revokeMember` (otro DT/owner debe ejecutarlo).

### 3.2 Triggers de Firestore

**`onMemberDelete`** — `artifacts/{appId}/workspaces/{wsId}/members/{memberUid}`:

- Collection group query sobre `grantees` con filter `workspaceId == wsId AND grantedBy == memberUid` → batch delete.
- Collection group query sobre `grantees` con filter `workspaceId == wsId AND grantedTo == memberUid` → batch delete.
- Collection group query sobre `invites` con filter `workspaceId == wsId AND invitedBy == memberUid` → batch delete.
- Logs detallados con counts de cada categoría.

**`onTeamCreate`** — `artifacts/{appId}/workspaces/{wsId}/teams/{teamId}`:

- Lee `workspaces/{wsId}` → si `type !== 'personal'`, return.
- Lee `members` (debería ser exactamente 1 member en personal). Update `assignedTeamIds: arrayUnion(teamId)`.

**`onTeamDelete`** — `artifacts/{appId}/workspaces/{wsId}/teams/{teamId}`:

- Borra subcolección `grants/*/grantees/*` recursivamente (Firebase Admin recursive delete utility).
- Lee todos los `members` del workspace y para cada uno: update `assignedTeamIds: arrayRemove(teamId)`.
- NO toca brackets/calendarSessions/jugadores/trainings/cuaderno (sobreviven, decisión de sub-0). Quedan visibles para sus creadores vía `isCreator` y para el owner del personal vía `isPersonalWorkspaceOwner` bypass.

### 3.3 Scheduled

**`cleanupExpiredInvites`** — schedule `every 24 hours`:

- Collection group query sobre `invites` con filter `expiresAt < now` → batch delete.
- Logs el count.

### 3.4 Tests para functions

Patrón sub-2/sub-5: vitest unit con mock Firestore (`functions/src/sub3/*.test.ts`). Cobertura objetivo:

| Función               | Tests   | Casos clave                                                                                                    |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| createClub            | 4       | allowlist ok, allowlist fail, name vacío, happy path crea 3 docs atómicos                                      |
| inviteMember          | 5       | DT ok, coach denegado, role inválido, teamId inexistente, email mal formado                                    |
| acceptInvite          | 6       | not-found, expired (+ delete oportunista), already-member, happy path, email mismatch flag, transacción atomic |
| revokeInvite          | 2       | DT ok, non-DT denegado                                                                                         |
| revokeMember          | 3       | DT ok, owner-target denegado, transacción atomic                                                               |
| setMemberTeams        | 3       | happy path, teamId inválido, owner-target denegado                                                             |
| setMemberRole         | 3       | dt↔coach ok, role inválido, owner-target denegado                                                              |
| transferOwnership     | 4       | owner ok, non-owner denegado, newOwner not-member denegado, role bump                                          |
| onMemberDelete        | 2       | borra grants y invites, sin grants no falla                                                                    |
| onTeamCreate          | 2       | personal sync, club no-op                                                                                      |
| onTeamDelete          | 2       | borra grants + arrayRemove, sin grants no falla                                                                |
| cleanupExpiredInvites | 1       | borra solo expirados                                                                                           |
| **Total**             | **~37** |                                                                                                                |

---

## 4. UI flows

Tres pantallas nuevas + integración en shell + ruta pública de claim.

### 4.1 Shell — entrada al modo club

En el header del shell, añadir un **WorkspaceSelector** dropdown. Solo visible si `memberships.length > 1` o si el user está en allowlist (entonces ve siempre el botón "+ Crear workspace de club"):

```
[Pick&Coach]  [▾ Mi cuenta]
              ┌─────────────────────────┐
              │ ◉ Mi cuenta             │
              │ ○ Uros de Rivas         │
              │ ─────────────────────── │
              │ + Crear workspace club  │ ← solo si en allowlist
              └─────────────────────────┘
```

Click en otro workspace → `setActiveWorkspace(wsId)` del context → recarga screens. Persiste en localStorage (ya cableado en `WorkspaceContext.jsx`).

Click en "+ Crear workspace de club" → modal con input `name` + textos explicativos. Submit → callable `createClub` → recibe `{ wsId }` → context selector cambia activeWsId → redirect a `/area-privada` (home del nuevo workspace, vacío).

### 4.2 `/area-privada/settings/miembros`

Nueva ruta accesible si `activeWorkspace.type === 'club'`. Si type === 'personal', redirect a settings root con toast "La gestión de miembros solo aplica a workspaces de club."

**Layout:** dos secciones — "Miembros activos" (tabla con owner + DTs + coaches, badges visibles, acciones inline) y "Invitaciones pendientes" (cards con email, teams, días hasta expiración, botones Copiar link / Cancelar).

**Acciones por rol del caller:**

- **Owner**: invitar, editar role/teams de cualquiera (su propia row inmutable + link separado a `/settings/transferir-propiedad`), revocar cualquiera (excepto sí mismo), cancelar/copiar invites.
- **DT no-owner**: invitar, editar role/teams de coaches y otros DTs (NO del owner), revocar coaches y DTs (NO al owner), cancelar/copiar invites.
- **Coach**: pantalla read-only. Ve directorio + invites pendientes (transparencia). Sin acciones.

**Modal de invite:** rol radio (coach/DT), email opcional, name opcional, multi-select de teams (mínimo 1 si role=coach). Submit → `inviteMember` → modal de éxito con link copiable (botón "📋 Copiar al portapapeles") y mensaje "caduca en 7 días".

**Menú member ([⋮]):** Cambiar rol (con confirmación "¿Bajar a Pepe a Coach? Perderá acceso club-wide a la biblioteca de ejercicios"), Editar equipos asignados, Revocar acceso (con confirmación "Sus contribuciones se mantienen pero firmadas con su nombre").

### 4.3 `/area-privada/settings/transferir-propiedad`

Pantalla aparte, solo accesible si caller es owner del workspace activo y `type === 'club'`. Redirect con toast si no.

Contiene:

- Bloque explicativo de las consecuencias (control de billing, ajustes, eliminar; rol baja a DT; irreversible).
- Selector de nuevo owner (radio entre members del workspace, excluyendo al caller).
- Input de confirmación: "Para confirmar, escribe el nombre del workspace: `Uros de Rivas`". Botón submit deshabilitado hasta typing exacto match.

Submit → callable `transferOwnership({ wsId, newOwnerUid })` → toast confirmación → redirect a `settings/miembros` (refresca con el nuevo dueño marcado y caller con `[DT]` sin `[Propietario]`).

### 4.4 `/invite/:wsId/:inviteId` (claim flow público)

Ruta accesible sin auth. Si no logueado, redirige a signup/login con `inviteId` en query string y vuelve aquí tras auth.

**Estados de la pantalla:**

1. **Cargando**: spinner.
2. **Logueado, claim ok**: "Bienvenido a [Club Name]" + CTA "Entrar al workspace" → redirect a `/area-privada` con `wsId` activo. Mensaje secundario si email mismatcheaba: "ⓘ Este invite estaba destinado a `pepe@gmail.com`. Has aceptado con `juan@gmail.com`."
3. **No logueado**: "Has sido invitado a [Club Name]" + CTA "Registrarme / Iniciar sesión".
4. **Invite no encontrado / ya usado**: "Este invite ya no es válido. Pídele al DT que te genere uno nuevo."
5. **Invite caducado**: "Este invite ha caducado. Pídele al DT que te genere uno nuevo." (Server lo borra al detectar.)
6. **Ya eres miembro**: "Ya formas parte de [Club Name]." + CTA "Ir al workspace".
7. **Error servidor**: mensaje genérico + retry.

**Implementación:** `<InviteLandingScreen>` orquesta los 7 estados. Hook `useAcceptInvite(wsId, inviteId)` llama el callable y maneja errores.

### 4.5 Tests UI

| Pantalla                | Tests   | Casos clave                                                                                                                    |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| WorkspaceSelector       | 4       | render N memberships, click cambia activeWsId, allowlist muestra/oculta botón crear, modal abre                                |
| Modal crear club        | 3       | validación nombre, submit ok, error allowlist                                                                                  |
| MembersScreen           | 8       | render owner+DT+coach, acciones por rol, modal invite, copiar link, cancelar invite, revocar member, editar teams, editar role |
| TransferOwnershipScreen | 3       | typing match habilita botón, submit ok, no-owner redirect                                                                      |
| InviteLandingScreen     | 6       | cada estado renderiza correcto                                                                                                 |
| **Total**               | **~24** |                                                                                                                                |

---

## 5. Reglas Firestore extendidas

Sub-3 NO reescribe las rules de sub-2. Añade el bloque para `invites` y refuerza `members` y `workspaces.ownerId`.

### 5.1 Bloque nuevo: `workspaces/{wsId}/invites/{inviteId}`

```js
match /invites/{inviteId} {
  // Members del workspace pueden leer invites pendientes (transparencia
  // entre DTs colaboradores; coach también los ve, no es sensitive).
  allow read: if isWorkspaceMember(appId, wsId);

  // Writes BLOQUEADOS desde cliente. Toda creación/modificación/borrado
  // pasa por callables (inviteMember/revokeInvite/acceptInvite) con
  // validación server-side + Admin SDK bypassing rules.
  allow write: if false;
}
```

### 5.2 Refuerzo en `members/{memberUid}`

Sub-2 permitía a DT/owner escribir directamente. Sub-3 cierra writes desde cliente. Toda mutación de members pasa por callables (`setMemberRole`, `setMemberTeams`, `revokeMember`). Las creates las hace `acceptInvite` y `createClub` vía Admin SDK (rules irrelevantes).

```js
match /members/{memberUid} {
  allow read: if isWorkspaceMember(appId, wsId);
  allow write: if false;  // ← cambio sub-3 (sub-2 permitía DT/owner directo)
}
```

**Razón:** las callables validan invariantes que las rules no pueden expresar fácilmente (teamId existe en este workspace, no demote owner, atomic role bump en transferOwnership). Cerrar writes elimina la superficie donde un cliente malicioso podría saltarse la validación.

### 5.3 Refuerzo en `workspaces/{wsId}` doc

Sub-2 permitía al owner cambiar `ownerId` directamente si nuevo owner era member. Sub-3 cierra: `ownerId` se cambia solo via callable `transferOwnership`, que garantiza `members/{newOwner}.role = 'dt'` atómicamente.

```js
allow update: if isWorkspaceOwner(appId, wsId)
  && request.resource.data.ownerId == resource.data.ownerId;  // ← inmutable desde cliente
allow update: if isDT(appId, wsId)
  && workspaceMetaProtected(request.resource.data.diff(resource.data));
```

(`workspaceMetaProtected` ya existía en sub-2 y bloqueaba `ownerId/plan/billing` para DT no-owner. Sub-3 extiende: ahora ni siquiera el owner cambia ownerId desde cliente.)

### 5.4 Sin cambios en grants

Sub-2 ya validaba coherencia entre doc id y `grantedTo` field. Sub-3 añade `workspaceId` redundante al body pero las rules de sub-2 no lo validan (no aporta seguridad — el path ya determina el workspace). El field es solo para query collection group.

### 5.5 Tests rules nuevos en `firestore.rules.test.ts`

| Bloque                        | Tests  | Lo que valida                                                                                                     |
| ----------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| `invites`                     | 5      | DT lee, coach lee, non-member denegado, DT NO crea directo, DT NO borra directo                                   |
| `members` refuerzo            | 3      | DT NO cambia role directo, DT NO modifica assignedTeamIds directo, owner NO modifica su propia membership directo |
| `workspaces.ownerId` refuerzo | 2      | owner NO cambia ownerId directo, DT NO cambia ownerId directo (re-confirmación de sub-2)                          |
| **Total nuevos**              | **10** | (60 totales en el archivo)                                                                                        |

---

## 6. PRs, tests y out-of-scope

### 6.1 Plan de PRs

Sub-3 se entrega en **4 PRs** (mirroring sub-2: backend → rules → cliente → cleanup/dogfood). Sin migración previa.

**PR #1 — Cloud Functions (backend foundation).**

- `functions/src/sub3/clubAllowlist.ts` (constante).
- 8 callables: `createClub`, `inviteMember`, `acceptInvite`, `revokeInvite`, `revokeMember`, `setMemberTeams`, `setMemberRole`, `transferOwnership`.
- 3 triggers: `onMemberDelete`, `onTeamCreate`, `onTeamDelete`.
- 1 scheduled: `cleanupExpiredInvites`.
- 1 callable read-only: `getClubAllowlistStatus` (consultada por el shell para mostrar/ocultar el botón crear).
- Tests vitest unit (~37) sobre cada callable + trigger con mock Firestore.
- Exports en `functions/src/index.ts`.
- Deploy a europe-west1.
- **Sin tocar UI ni rules.** Las callables están vivas pero nadie las llama todavía.

**PR #2 — Reglas Firestore extendidas.**

- `firestore.rules`: añade bloque `invites/{inviteId}` (read members, write false).
- Refuerzos: `members/{memberUid}` y `workspaces/{wsId}.ownerId` cerrados a writes directos.
- `firestore.rules.test.ts`: ~10 tests nuevos. Total archivo ~60 tests.
- Deploy de rules. Las callables de PR #1 siguen funcionando (Admin SDK bypassa rules).
- **Sin UI todavía.**

**PR #3 — UI cliente.**

- Componentes nuevos:
  - `src/shell/WorkspaceSelector.jsx` (header dropdown con allowlist gate).
  - `src/screens/settings/MembersScreen.jsx` + sub-componentes (modal invite, modal éxito link, menú member, modales confirm).
  - `src/screens/settings/TransferOwnershipScreen.jsx`.
  - `src/screens/InviteLandingScreen.jsx` (ruta pública `/invite/:wsId/:inviteId`).
  - Modal "Crear workspace de club" en el shell.
- Hooks nuevos: `useMemberships`, `useInvites`, `useClubAllowlist`, `useAcceptInvite`, `useTransferOwnership`.
- Servicios nuevos: `src/services/membersService.js` (envoltorios sobre los callables).
- Routing: añadidas las 3 rutas a `AppRouter.jsx` con lazy loading + `ModuleBoundary`.
- Tests RTL (~24).
- **Tras este PR, el flujo completo es operativo en producción** para uids en allowlist.

**PR #4 — Smoke + dogfood + observability.**

- Crear club workspace real con cuenta del super-admin sobre el club Uros de Rivas.
- Invitar un coach de prueba (coach colaborador real o cuenta secundaria).
- Validar end-to-end: claim, asignar teams, ver cuaderno, escribir notas, revocar.
- Documentar ruidos / bugs / friction en `docs/runbooks/sub-proyecto-3-dogfood.md`.
- Añadir Cloud Logging dashboards para callables (count, latency, error rate por función).
- Confirmar que el bypass `isPersonalWorkspaceOwner` sigue intacto sobre los 36 workspaces personales existentes.

### 6.2 Tests, breakdown total

| Capa                        | Cantidad                | Patrón                             |
| --------------------------- | ----------------------- | ---------------------------------- |
| Cloud Functions vitest unit | ~37                     | mock Firestore, mirroring sub-2    |
| Firestore rules emulator    | ~10 nuevos (60 totales) | extiende `firestore.rules.test.ts` |
| UI RTL                      | ~24                     | componentes + hooks                |
| Smoke manual                | 1 club real, ~20 min    | dogfood Uros de Rivas              |
| **Total nuevos**            | **~71**                 |                                    |

### 6.3 Decisiones diferidas (out-of-scope sub-3)

- **UI para conceder/gestionar grants de cuaderno** (asistencia, informe-jugadores). Cableada por sub-2 vía rules + colección. Sub-3 NO añade pantalla dedicada — se aborda en sub-4 cuando la vista DT necesita leer asistencia cross-team.
- **Vista DT cross-team** (calendario unificado, KPIs club-wide, lista de coaches con resumen). Es sub-4 entero.
- **Edición de invites pendientes** (cambiar email, role, assignedTeamIds antes del claim). V1 = revocar y crear otro. Si demanda real, sub-4 lo añade.
- **Bulk operations** (invitar 5 coaches a la vez, asignar 3 coaches a un mismo team de golpe). V1 = uno por uno.
- **Audit log público** ("Pepe creó este invite el 2026-05-04"). El `invitedBy` queda en cada membership doc, suficiente para inspección manual. UI dedicada de log = post-V1.
- **Notificaciones de invite/revoke** (email al coach revocado, push notification al DT cuando alguien claim). Sin infra de email aún. Post-V1.
- **Cleanup de invites cancelados pero no expirados.** La callable `revokeInvite` borra el doc directamente. No hay caso "soft-deleted invites".
- **Multi-club ownership transfer**. Un user owner de N clubs solo puede transferir uno por operación. UI no agrupa.
- **Quitar el feature flag = abrir clubs al público.** Es trabajo de sub-4 (junto con la vista DT).
- **Borrar workspace de club**. Out of V1. El owner que quiera borrar uno tendrá que pedirlo manualmente al super-admin (caso real ultra-raro en V1).

### 6.4 Cierre

Sub-proyecto 3 cierra cuando:

1. PR #1 (callables + triggers) deployed y testado.
2. PR #2 (rules) deployed sin breakage.
3. PR #3 (UI) deployed con allowlist activa.
4. PR #4 (smoke real) ejecutado, runbook escrito, bugs encontrados resueltos en hotfixes o documentados como deferred.
5. Soak de 1-2 semanas sobre el club real sin reportes de regresión.

Sucesor inmediato: **sub-proyecto 4 — Vista de Director Técnico**, que abre los clubs al público (quita el flag), añade dashboard cross-team, calendario unificado y materiales compartidos.

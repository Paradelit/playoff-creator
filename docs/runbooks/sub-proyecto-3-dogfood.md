# Sub-proyecto 3 — Dogfood E2E (Uros de Rivas)

**Fecha de ejecución:** _YYYY-MM-DD_
**Operador:** Sergio (super-admin uid `y6vqlMynjRQeRpAKUnYmQdUiMen1`)
**Coach de prueba:** _[cuenta secundaria o coach real con consentimiento]_
**Workspace creado:** `wsId = ____` (Uros de Rivas)

> Plantilla a rellenar durante el smoke real. Cada checkbox marca un paso del flujo end-to-end. Anota observaciones en la sección "Bugs / friction" según vayas detectando ruido.

---

## Pre-requisitos

- [ ] PR #1 (callables) merged y deployed.
- [ ] PR #2 (rules) merged y deployed.
- [ ] PR #3 (UI) merged y deployed (`npm run deploy` ejecutado).
- [ ] Allowlist en `functions/src/sub3/clubAllowlist.ts` incluye al menos el uid super-admin.

## Crear club + onboarding owner

- [ ] Login como super-admin → header (DesktopSidebar) muestra dropdown WorkspaceSelector con "Mi cuenta".
- [ ] Dropdown muestra el botón "**+ Crear workspace de club**" (solo visible para uids en allowlist).
- [ ] Click → modal `CrearClubModal` aparece.
- [ ] Submit con nombre vacío → botón deshabilitado.
- [ ] Submit con nombre "Uros de Rivas" → callable `createClub` ok → redirect a `/area-privada` → `activeWsId` apunta al nuevo workspace.
- [ ] El nuevo workspace es visible como segunda opción en el WorkspaceSelector.
- [ ] Switch a "Mi cuenta" → vuelve al workspace personal con datos previos intactos.
- [ ] Switch de vuelta a "Uros de Rivas".

## Crear team de prueba

- [ ] Desde el club, crear 1 team "Cadete A" desde la pantalla de equipos habitual.
- [ ] Verificar en Firestore Console: `artifacts/{appId}/workspaces/{wsId}/teams/{teamId}` existe.
- [ ] (Trigger `onTeamCreate`) → este es un workspace **club**, así que NO debe haber arrayUnion automático en members. Verificar en Console que `members/{owner}.assignedTeamIds` NO incluye este teamId.

## Invitar coach

- [ ] Navegar a `/area-privada/settings/miembros` desde el dropdown / nav.
- [ ] Pantalla muestra: tabla con 1 miembro (super-admin con badge "Propietario" + rol "dt").
- [ ] Sección "Invitaciones pendientes (0)".
- [ ] Botón "Invitar al staff" visible (caller es owner).
- [ ] Click → modal con: rol radio (Coach default), email opcional, name opcional, multi-select equipos.
- [ ] Pickear rol "Coach", marcar "Cadete A", email = `coach-test@example.com`, name = "Coach Test".
- [ ] Submit → callable `inviteMember` ok → modal de éxito con link copiable + "Caduca en 7 días".
- [ ] Botón "Copiar al portapapeles" funciona (verificar en clipboard del SO).
- [ ] Cerrar modal → fila "Coach Test · coach" aparece en "Invitaciones pendientes (1)".

## Claim flow desde otra cuenta

- [ ] Pegar el link de invite en pestaña incognito (sin auth).
- [ ] `InviteLandingScreen` renderiza estado `needsAuth` con CTA "Iniciar sesión / Registrarme".
- [ ] Click → redirect a `/login?redirect=/invite/{wsId}/{inviteId}`.
- [ ] Login con cuenta coach de prueba → vuelve a `/invite/...` → estado `success` → "Bienvenido a Uros de Rivas".
- [ ] Si email del coach != email del invite → ver hint "ⓘ Esta invitación estaba destinada a otro email" en el éxito.
- [ ] Click "Entrar al workspace" → redirect a `/area-privada` con `activeWsId = wsId del club`.
- [ ] Verificar en Firestore Console: `members/{coachUid}` creado con `role: 'coach'`, `assignedTeamIds: ['cadete-a-id']`. `users/{coachUid}/memberships/{wsId}` creado con `workspaceType: 'club'`.
- [ ] Verificar invite borrado del path `workspaces/{wsId}/invites/{inviteId}`.

## Coach trabajando

- [ ] Como coach, abrir `/area-privada/teams/{cadete-a-id}` → ve los datos del team.
- [ ] Coach escribe nota en `cuaderno/notas` → persiste.
- [ ] Owner abre la misma nota desde su sesión → la ve correctamente.
- [ ] Coach intenta entrar a `/area-privada/settings/miembros` → ve la pantalla en read-only (sin botón "Invitar al staff", sin menús de acciones).

## Revoke + atomicity

- [ ] Como owner, abrir menú de acciones del coach → "Revocar acceso" → modal de confirmación.
- [ ] Confirmar → callable `revokeMember` ok → coach desaparece de la lista.
- [ ] Verificar en Firestore Console: `members/{coachUid}` borrado, `users/{coachUid}/memberships/{wsId}` borrado.
- [ ] (Trigger `onMemberDelete`) → si el coach había creado grants (no aplica en este smoke porque sub-3 no tiene UI de grants), debería haberlos borrado.
- [ ] Coach hace refresh en su pestaña → workspace de Uros desaparece del WorkspaceSelector.

## Revocar invite antes del claim

- [ ] Owner crea otra invitación a "test2@example.com" para Cadete A.
- [ ] Antes de claim, owner cancela la invite desde la pantalla → callable `revokeInvite` ok.
- [ ] Pegar el link en pestaña incognito → estado `notFound` → "Este enlace ya no es válido".

## Transferir propiedad

- [ ] Invitar de nuevo al coach (mismo email, otro link) → claim → ahora es coach.
- [ ] Owner promueve coach a DT desde el menú → callable `setMemberRole` ok → badge cambia a "dt".
- [ ] Owner navega a `/area-privada/settings/transferir-propiedad`.
- [ ] Pantalla pide pickear nuevo owner (lista filtra al caller).
- [ ] Pickear coach (ahora DT) + escribir el nombre del workspace exacto → botón "Transferir propiedad" se habilita.
- [ ] Click → callable `transferOwnership` ok → toast → redirect a `settings/miembros`.
- [ ] Verificar en Console: `workspaces/{wsId}.ownerId` ahora es coach uid. `members/{coachUid}.role` sigue 'dt' (idempotente).
- [ ] Caller original sigue viendo el workspace pero sin badge "Propietario", solo "dt".
- [ ] El nuevo owner accede a `settings/transferir-propiedad` → puede usarlo.

## onTeamDelete trigger

- [ ] Borrar team "Cadete A" desde la UI habitual.
- [ ] Verificar en Console: `members/*.assignedTeamIds` ya no incluye ese teamId (arrayRemove).
- [ ] (No hay grants creados en este smoke, así que no aplica el cleanup de grants.)

## Bypass personal-workspace intacto

- [ ] Switch a "Mi cuenta" desde el WorkspaceSelector.
- [ ] Crear un team nuevo en el personal workspace.
- [ ] Verificar en Console: trigger `onTeamCreate` ejecutó → `members/{ownerUid}.assignedTeamIds` ahora incluye el nuevo teamId (arrayUnion).
- [ ] Escribir notas en cuaderno → funciona sin tropezar con los refuerzos de sub-3 (porque las rules de sub-2 hacen bypass para `isPersonalWorkspaceOwner`).

## Cleanup expirado (opcional, requiere esperar 7 días o forzar el scheduler)

- [ ] (Opcional) En Firebase Console → Cloud Scheduler → `cleanupExpiredInvites` → "Run now". Verificar logs reportan `deleted=N` con N coherente.

---

## Bugs / friction encontrados

_(rellenar durante el dogfood)_

| #   | Severidad | Pantalla / flujo | Descripción | Decisión |
| --- | --------- | ---------------- | ----------- | -------- |
| 1   |           |                  |             |          |

## Hot-fix vs deferred

**Hot-fix dentro de PR #4** (bloquean merge):

- _ninguno encontrado_

**Deferred a sub-4 o post-V1:**

- WorkspaceSelector no visible en mobile (CoachesNav) — sub-3 V1 solo desktop, ok mientras allowlist sea 1 user.
- _otros…_

## Observabilidad

Tras el smoke, abrir Cloud Logging (ver `docs/runbooks/sub-proyecto-3-cloud-logging.md`) y confirmar:

- Cero errores en cualquier callable o trigger.
- Latencias normales (< 500ms p99 en callables write, < 2s en `acceptInvite` por la transacción).

## Conclusión

- [ ] Smoke completo sin bugs P0/P1 → marcar PR #4 ready y mergear.
- [ ] Soak de 1-2 semanas en producción antes de declarar sub-3 cerrado y arrancar sub-4.

# Sub-proyecto 3 — Cloud Logging dashboards

Queries y métricas para vigilar las 13 funciones desplegadas por sub-3 en la región `europe-west1`.

## Acceso rápido

- **Cloud Logging Explorer**: https://console.cloud.google.com/logs/query?project=playoff-creator
- **Functions**: https://console.firebase.google.com/project/playoff-creator/functions

---

## Queries clave

### 1) Errores en cualquier callable sub-3 (últimas 24h)

```
resource.type="cloud_function"
resource.labels.region="europe-west1"
resource.labels.function_name=("createClub" OR "inviteMember" OR "acceptInvite" OR "revokeInvite" OR "revokeMember" OR "setMemberTeams" OR "setMemberRole" OR "transferOwnership" OR "getClubAllowlistStatus")
severity>=ERROR
timestamp>="-24h"
```

Use case: alerta cuando un usuario reporta "no puedo invitar / aceptar / transferir". Filtrar por `jsonPayload.uid` o `jsonPayload.wsId` si necesario.

### 2) Triggers Firestore ejecutados (últimas 24h)

```
resource.type="cloud_function"
resource.labels.function_name=("onMemberDelete" OR "onTeamCreate" OR "onTeamDelete")
timestamp>="-24h"
```

Cada ejecución loguea contadores (ver el `console.log` en cada trigger). Útil para verificar que cleanup no quedó atascado.

### 3) Scheduled cleanup de invites expirados

```
resource.type="cloud_function"
resource.labels.function_name="cleanupExpiredInvites"
textPayload:"deleted="
```

Espera ver una entrada por día a las ~00:00 Madrid. Si hay un día sin entrada → scheduler caído.

### 4) Audit de `transferOwnership` (operación rara y crítica)

```
resource.type="cloud_function"
resource.labels.function_name="transferOwnership"
severity>=INFO
```

Cada transferencia debe verse aquí. Útil para forensics si algún owner reporta "alguien me quitó la propiedad".

### 5) Audit de `acceptInvite` (entrada al club)

```
resource.type="cloud_function"
resource.labels.function_name="acceptInvite"
severity>=INFO
```

Útil para reconstruir quién entró cuándo a qué club.

---

## Métricas a vigilar (Cloud Monitoring)

| Métrica                           | Threshold             | Razón                                                                                                                                  |
| --------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| p99 latencia `acceptInvite`       | > 3s sostenido        | La transacción tiene 4 reads + 2 writes + 1 delete; si excede 3s, hay contention o índices ausentes.                                   |
| Error rate `inviteMember`         | > 5% en ventana de 1h | Probable validación rota o teamId no encontrado masivamente (nombre cambiado en Firestore mientras la UI tenía cache).                 |
| Error rate `createClub`           | > 0% no-allowlist     | Si vemos `permission-denied` que no sea de uids esperados, alguien intentó crear sin estar en allowlist (info, no incidente).          |
| Count `cleanupExpiredInvites/day` | = 0 dos días seguidos | Scheduler caído.                                                                                                                       |
| Cold-start p50 callables          | > 5s sostenido        | Considerar `minInstances: 1` para callables de claim/onboarding (`acceptInvite`, `getClubAllowlistStatus`). V1 acepta los cold starts. |

## Acciones runbook

### Usuario reporta "no puedo invitar"

1. Pedir email del usuario y nombre del club.
2. Ejecutar query #1 filtrando por `jsonPayload.uid` del usuario.
3. Ver el último error → mensaje de la `HttpsError`:
   - `permission-denied` → caller no es DT/owner. Verificar membership en Console.
   - `invalid-argument` con "team X no existe" → team borrado entre que la UI cargó y el submit. Refresh de la pantalla.
   - `invalid-argument` con "Email mal formado" → typo del usuario.

### Usuario reporta "transferí pero el rol no cambió"

1. Query #4 → confirmar que `transferOwnership` ejecutó.
2. Si la callable falló a media transacción → revisar logs de Firestore por `aborted` en la transaction.
3. Verificar manualmente en Console: `workspaces/{wsId}.ownerId` vs `members/{newOwner}.role`. Si están desincronizados, el bug es serio (debería haber rollbackeado). Abrir issue P0.

### Coach reporta "perdí acceso al club"

1. Query #2 filtrando por `function_name="onMemberDelete"` y el wsId.
2. Si encuentra el cleanup → verificar quién hizo el revoke (audit en query del callable `revokeMember`).
3. Si no, el problema no es revoke — investigar otras vías (cleanup de team que mata grants).

## Alertas configuradas

_(rellenar a medida que se configuren en Cloud Monitoring)_

| Alerta                    | Threshold | Canal |
| ------------------------- | --------- | ----- |
| _Pendiente de configurar_ |           |       |

## Mantenimiento

- Cuando la allowlist crezca > 10 uids, migrar `clubAllowlist.ts` a Firestore (`artifacts/{appId}/system/clubAllowlist`) y reescribir `getClubAllowlistStatus` para leerlo. Plan: sub-4.
- Cuando se abran clubs al público (sub-4), retirar `getClubAllowlistStatus` (o devolver siempre `true`) y eliminar el gate del `WorkspaceSelector`.

---
title: Sub-proyecto C — Tool use coverage + acción (AI chat priority)
date: 2026-05-15
status: design
owner: claude (autonomo, pendiente review usuario)
parent: 2026-05-13-ai-chat-priority-master-design.md
depende_de:
  - Sub-A cerrado funcionalmente (PRs #35-#55) — digest enriquecido + screen semantic
  - Sub-B cerrado funcionalmente (PRs #57-#62) — ambigüedad + proactividad + persona
---

## TL;DR

Sub-A puso **contexto** rico. Sub-B convirtió ese contexto en **conversación**.
Sub-C convierte la conversación en **acción persistente**: cierra el ciclo de las
acciones que hoy Pick "genera" sin marcar, y abre el set de tools de
update/delete que hoy faltan (todos los `propose_*` son create-only).

Dos capas (ordenadas por valor para el coach):

1. **Layer 1 — Cerrar el ciclo de acción** (C.1): Pick genera convocatoria →
   Pick marca el partido como "convocatoria mandada" tras confirmación →
   digest deja de proponerla → próximo turno no la sugiere de nuevo. Resuelve
   el caso narrativo central del master spec.
2. **Layer 2 — CRUD completion uniforme** (C.2-C.5): añadir `propose_update_*`
   - `propose_delete_*` a los proposals existentes donde tiene sentido
     (entrenamiento, calendar session, ejercicio, bracket). Fundación
     arquitectónica para futuro.

Layer 3 (live scoring + bulk + bracket structure + team members + competition
settings) queda **explícitamente diferida** hasta tener data de uso de C.1+C.2.

---

## El problema (caso narrativo)

**Caso 1 — el ciclo no se cierra (master spec):**

> Coach (viernes 18h): "mándame la convocatoria de mañana"
> Pick: genera el texto, render `convocatoria_preview`, coach pulsa "copiar".
> Coach: pega en WhatsApp, manda al grupo del equipo.
> [Sábado 09h, coach abre Pick]
> Pick (hoy): "Buenos días. **Convocatoria pendiente para el partido de las 11h**, ¿la preparo?"
> Pick (deseado): "Buenos días. Convocatoria mandada anoche, partido 11h vs Hispano. ¿Algo más?"

Pick re-anuncia lo mismo porque **no sabe** que la convocatoria ya se mandó.
La proactividad de sub-B se vuelve ruido cuando el digest no sabe el estado real.

**Caso 2 — no se puede editar lo creado:**

> Coach: "el entrenamiento de mañana muévelo a las 19:30"
> Pick (hoy): "No tengo una tool para editar entrenamientos existentes. ¿Lo borro y creo uno nuevo?"
> Pick (deseado): `propose_update_calendar_session(sessionId, { horaInicio: '19:30' })`.

Hoy todos los `propose_*` son create-only. Editar = borrar + crear, que en la UX
del chat es feo y rompe el ID estable del evento (link de convocatorias, asistencia
heredada, etc.).

**Caso 3 — no se puede deshacer lo creado por error:**

> Coach: "me has creado dos entrenamientos iguales para el martes, borra uno"
> Pick (hoy): "Lo siento, no puedo eliminar entrenamientos desde el chat."
> Pick (deseado): `propose_delete_calendar_session(sessionId)`.

El usuario tiene que abrir la UI, navegar al calendario, borrar manualmente.

---

## Goals

1. Pick **cierra el ciclo** en las acciones generadas: estado persistido tras
   confirmación + digest actualizado en el siguiente turno (Caso 1).
2. Pick ofrece **update + delete** sobre las entidades que crea (Caso 2 + 3),
   manteniendo el proposal pattern (sin auto-writes server-side).
3. Mantiene el budget de tokens del system prompt (~+1.2KB de schemas, OK).
4. No regresiones en evaluators existentes (`confirm-choice-emitted`, etc.).
5. Métricas baseline en Langfuse para medir adopción real de los nuevos tools.

## Non-goals

- **Pick autónomo** (acciones sin user confirm) — el proposal pattern se mantiene
  intacto. Cada `propose_*` sigue emitiendo `confirm_write` block.
- **Live scoring planilla** — diferido (Layer 3 deferred).
- **Bulk operations** ("borra todo lo del martes", "duplica esta semana") —
  diferido. Riesgo destructivo alto sin señal de demanda.
- **Bracket structure edits** (más allá de scores) — diferido.
- **Team member CRUD** desde chat — diferido.
- **Competition settings** post-creación — diferido.
- **Soft delete + undo** — hard delete con proposal pattern como safety net.
- **Optimistic locking / concurrent edit detection** — Firestore last-write-wins
  es suficiente para single-coach workflow.

---

## Estado actual (lo que hay que cambiar)

### `functions/src/ai/tools/writeTools.ts`

Inventario de proposals (12):

| Proposal                          | Crea                | Update         | Delete |
| --------------------------------- | ------------------- | -------------- | ------ |
| `propose_create_training`         | ✅                  | ❌             | ❌     |
| `propose_create_calendar_session` | ✅                  | ❌             | ❌     |
| `propose_update_bracket_scores`   | —                   | ✅ (parcial)   | ❌     |
| `propose_save_note`               | ✅ (append/replace) | ⚠ replace solo | ❌     |
| `propose_create_bracket`          | ✅                  | ❌             | ❌     |
| `propose_save_attendance`         | ✅                  | ✅ (overwrite) | ❌     |
| `propose_save_player_report`      | ✅                  | ✅ (overwrite) | ❌     |
| `propose_save_shooting_test`      | ✅                  | ✅ (overwrite) | ❌     |
| `propose_save_scouting`           | ✅                  | ✅ (overwrite) | ❌     |
| `propose_save_analysis`           | ✅                  | ✅ (overwrite) | ❌     |
| `propose_create_exercise`         | ✅                  | ❌             | ❌     |
| `propose_create_exercises`        | ✅ (bulk)           | —              | —      |

Observaciones:

- **5 entidades** ya tienen update implícito vía overwrite (`save_*`):
  attendance, player_report, shooting_test, scouting, analysis. Estas
  necesitan **delete** pero no update separado.
- **4 entidades** necesitan **update + delete** explícitos: training, calendar
  session, exercise, bracket.
- **Convocatoria** existe como soft-write (`mandar_convocatoria` genera texto)
  pero no persiste estado. Le falta `propose_mark_convocatoria_sent`.

### `functions/src/ai/digest/pendingConvocatorias.ts`

Computa lista de partidos próximos sin convocatoria, según ventana de aviso del
equipo. Filtro actual: por fecha + por `convocatoriaSentAt` (campo ya leído pero
**nunca escrito** desde Pick — solo desde frontend al usar `ShareConvocatoria`).

Tras C.1, Pick podrá escribir ese campo vía `propose_mark_convocatoria_sent`.

---

## Diseño

### Layer 1 — Cerrar el ciclo de acción (C.1)

**Nuevo tool:** `propose_mark_convocatoria_sent`

```text
name: propose_mark_convocatoria_sent
description: Propone marcar la convocatoria de un partido como enviada.
  Después de confirmar, el partido deja de aparecer en pendientes y Pick no
  vuelve a sugerirla. Úsalo cuando el coach diga "ya la mandé" / "la envié"
  o tras un flujo de mandar_convocatoria + share.
parameters:
  sessionId: string (required, calendarSessionId o id virtual de playoff)
  summary: string (required, "Convocatoria del partido X marcada como enviada")
isWrite: true
handler returns:
  kind: 'mark_convocatoria_sent'
  sessionId
  summary
```

**Frontend (`PickPanel`/`PickColumn`):**

- Wire en el handler de `confirm_write` con `kind === 'mark_convocatoria_sent'`:
  llama callable existente que hace `calendarSessions/{id}.update({ convocatoriaSentAt: serverTimestamp() })`.
- Para playoff virtual: setea `playoffConvocatoriaSent/{playoff-id}` en perfil del workspace (paths legacy de UX existente).

**Decisión: solo timestamp, no método.**

No registramos si fue por WhatsApp, email, manual etc. El digest sólo necesita
saber "sí/no". Método queda en sub-D si se demanda.

**Decisión: piggyback desde `mandar_convocatoria`.**

Tras render del `convocatoria_preview` block, el LLM puede proponer
`propose_mark_convocatoria_sent` en el mismo turno si el coach indica "ya la mandé".
No automático — siempre vía proposal.

**Evals C.1:**

- New score `convocatoria-close-loop`: para fixture donde el coach dice "ya
  mandé la del sábado", el orchestrator emite `propose_mark_convocatoria_sent`
  con el sessionId correcto.
- Regression: `pendingConvocatorias` digest excluye sessions con
  `convocatoriaSentAt` (cobertura existente, sólo re-verificar).

### Layer 2 — CRUD completion uniforme (C.2-C.5)

**Patrón común para todos los nuevos tools (uniformidad arquitectónica):**

```text
propose_update_<entity>:
  parameters:
    <entityId>: string (opcional si screen context aporta)
    updates: object (campos a cambiar — patch parcial Firestore-style)
    summary: string
  handler:
    valida entityId resolvable + updates no vacío + summary
    returns { kind: 'update_<entity>', <entityId>, updates, summary }

propose_delete_<entity>:
  parameters:
    <entityId>: string (opcional si screen context aporta)
    summary: string (required — explicación de qué se borra, para confirm UI)
  handler:
    valida entityId resolvable
    returns { kind: 'delete_<entity>', <entityId>, summary }
```

**Decisión: patch parcial vs overwrite.**

`propose_update_*` recibe campos parciales y hace `doc.update(updates)` (no
`set`). Razones:

- LLM tiende a recibir requests parciales del coach ("cambia la hora a 19:30")
  — pedirle dump completo es ruido.
- Frontend ya valida shape de `updates` antes de aplicar (mantenido).
- Reduce token usage por turno (no hay que re-emitir todos los campos).

**Decisión: hard delete.**

Firestore `doc.delete()`. Sin tombstones, sin filtros de visibilidad. Razones:

- Proposal pattern + user confirm es safety net suficiente.
- Soft delete añade complejidad a TODOS los reads (filtros, índices).
- Si la operación se confirma por error, el coach lo nota inmediatamente y
  puede recrear (sub-A digest avisa al siguiente turno si algo crítico falta).

**Sub-fases C.2-C.5 (1 PR cada una):**

| Sub | Tool 1                            | Tool 2                                                        | Entity-specific notes                                                                                        |
| --- | --------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| C.2 | `propose_update_training`         | `propose_delete_training`                                     | trainings/{id} bajo team                                                                                     |
| C.3 | `propose_update_calendar_session` | `propose_delete_calendar_session`                             | calendarSessions/{id}; rechazar sessionIds virtuales `playoff-*` (no editables)                              |
| C.4 | `propose_update_exercise`         | `propose_delete_exercise` + `propose_delete_exercises` (bulk) | exercises/{id} bajo workspace; bulk delete acotado a IDs explícitos (no "todos los que cumplen X")           |
| C.5 | —                                 | `propose_delete_bracket`                                      | brackets/{id}; warning destacado en confirm UI (borra all bracket data, share codes legacy quedan huérfanos) |

**Evals C.2-C.5:**

- New score `update-delete-offered`: turnos donde el coach dice "cambia/borra
  X" → Pick emite el proposal correcto (no falla con "no puedo hacerlo").
- Regression: tests existentes de proposals create-only siguen verdes.

### Layer 3 — Diferido (decisión basada en data)

Lo siguiente queda **fuera de sub-C** por scope + tamaño + falta de señal de demanda:

- **Live scoring planilla** (XL): requiere modelo de datos nuevo, write tools
  para puntos/faltas/tiempos, integración con UI de planilla. Sub-proyecto propio.
- **Bulk calendar ops** (M): "duplica esta semana", "mueve todo el martes". Riesgo
  destructivo. Sin demanda observada.
- **Bracket structure edits** (L): añadir/quitar matches, cambiar teams en match.
  Acotado por el invariante power-of-2; requiere rebalanceo.
- **Team member CRUD** (M): hoy se hace en UI; chat no se ha pedido.
- **Competition management** (M): settings post-creación de bracket. Marginal.

**Criterio de re-evaluación:** tras C.1+C.2 en producción 4 semanas, si las
métricas C.0 muestran:

- "Lo siento, no puedo X" turn rate >5% con X ∈ {live scoring, bulk, bracket
  structure, team member, competition} → priorizar el más demandado en sub-D.
- Si <2% → consolidar en sub-D opcional o cerrar el programa AI chat priority
  con feature freeze.

---

## Plan de implementación (8 sub-fases, 1 PR cada una)

| Sub | Foco                                                                  | Tipo PR | Dependencias |
| --- | --------------------------------------------------------------------- | ------- | ------------ |
| C.0 | Baseline metrics en Langfuse                                          | infra   | —            |
| C.1 | `propose_mark_convocatoria_sent` + digest filter + eval               | feature | C.0          |
| C.2 | `propose_update_training` + `propose_delete_training` + tests         | feature | C.0          |
| C.3 | `propose_update_calendar_session` + `propose_delete_calendar_session` | feature | C.0          |
| C.4 | `propose_update_exercise` + `propose_delete_exercise(s)`              | feature | C.0          |
| C.5 | `propose_delete_bracket`                                              | feature | C.0          |
| C.6 | Eval scores agregados (`action-close-loop`, `update-delete-offered`)  | infra   | C.1-C.5      |
| C.7 | CLAUDE.md update + memoria de cierre                                  | docs    | C.1-C.6      |

**Estimación:** 1-2 días por sub-fase. Total: ~2 semanas tirando solo, en
paralelo con cualquier otra cosa.

**Pattern (heredado de sub-A/sub-B):**

- TDD desde el primer sub-PR (test fail → impl → test pass).
- 1 PR por sub-fase, review checkpoint entre cada uno.
- Métricas Langfuse instrumentadas desde C.0.
- No deploy manual de functions a menos que el bug bloquee (sigue el IAM-gated
  CI; ver `feedback_ci_functions_deploy_iam.md`).

---

## Métricas de éxito

**Baseline a instrumentar en C.0:**

| Métrica                        | Cómo se mide                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `convocatoria_close_loop_rate` | (convocatorias marked-sent vía propose tool) / (mandar_convocatoria render count)           |
| `update_proposals_total`       | counter por kind: update_training, update_calendar_session, update_exercise                 |
| `delete_proposals_total`       | counter por kind: delete_training, delete_calendar_session, delete_exercise, delete_bracket |
| `update_delete_rejected_rate`  | turns donde Pick dijo "no puedo X" sobre update/delete / total turns                        |

**Targets post-C (4 semanas en prod):**

- `convocatoria_close_loop_rate` ≥ 40% (de las generadas, al menos 40% se marcan).
- `update_proposals_total + delete_proposals_total` ≥ 1 por usuario activo/semana.
- `update_delete_rejected_rate` ≤ 1% para X ∈ alcance de sub-C (training, session,
  exercise, bracket).

---

## Riesgos

**Riesgo 1 — Token bloat en system prompt.**

Cada nuevo tool añade ~150 tokens de declaración (name+description+params).
Sub-C añade 8 tools nuevos = ~1.2KB extra/turno. System prompt total queda
~5-6KB de digest + screens + tools. Aceptable. Si se observa degradación de
latencia, agrupar describe en una sola palabra clave.

**Riesgo 2 — Pick propone delete por interpretación incorrecta.**

Coach dice "este entrenamiento es muy duro" → Pick puede malinterpretarlo como
"borra el entrenamiento". Mitigación:

- Tests + evals que cubren intent classification clear "duro" ≠ "borrar".
- `summary` field obligatorio en `propose_delete_*` debe ser explícito ("Borrar
  entrenamiento del martes 19h"). El coach lo ve antes de confirmar.
- Confirm UI ya destaca destructive operations visualmente (heredado).

**Riesgo 3 — Confusión entre overwrite vs patch parcial.**

5 proposals existentes (`save_attendance` etc.) hacen overwrite. Los nuevos
`propose_update_*` hacen patch parcial. LLM podría confundirse al elegir.
Mitigación: descripciones explícitas en el tool description ("actualiza solo
los campos proporcionados, no sobrescribe el resto").

**Riesgo 4 — Auto-loop convocatoria.**

Si Pick marca convocatoria como sent prematuramente (antes de que el coach la
mande de verdad), el coach pierde el recordatorio. Mitigación:

- Proposal pattern explícito: Pick nunca marca sin que el coach diga "ya".
- Eval que verifica esto.

**Riesgo 5 — Layer 3 deferido se vuelve "infinito".**

Diferimos 5 items grandes. Riesgo de que sub-D nunca llegue. Mitigación: spec
explícito de re-evaluación a 4 semanas + criterios cuantitativos para escalar.

---

## Open questions resueltas (decisiones del autor)

1. ¿Update tools sobrescriben o patch parcial? → **Patch parcial.** Más
   natural para conversación ("cambia la hora a 19:30" no incluye resto).
2. ¿Delete soft o hard? → **Hard.** Proposal pattern es suficiente safety net.
3. ¿Bulk delete general (filter-based)? → **NO.** Solo bulk delete con IDs
   explícitos (`propose_delete_exercises` con array). Filter-based queda diferido.
4. ¿`propose_mark_convocatoria_sent` registra método (whatsapp/email/manual)? →
   **NO.** Solo timestamp. Método en sub-D si hay demanda.
5. ¿`propose_update_bracket_scores` necesita revert? → **NO.** Usuario puede
   set scores a null con el mismo tool.
6. ¿`propose_update_cuaderno_section`? → **NO en sub-C.** `propose_save_note`
   ya hace append/replace; falta UX señal de que se necesite edición puntual.
7. ¿`propose_update_bracket` general (metadatos del cuadro)? → **NO en sub-C.**
   Va junto con bracket structure edits en Layer 3 deferred.
8. ¿Confirmación adicional para delete vs update? → **NO.** Mismo confirm_write
   block para todo; el UI ya destaca destructive operations.

---

## Out-of-scope (para evitar scope creep)

- Live scoring planilla
- Bulk calendar ops (filter-based)
- Bracket structure edits
- Team member CRUD desde chat
- Competition management post-creación
- Soft delete + undo system
- Concurrent edit detection / optimistic locking
- Multi-step write transactions (delete training Y session enlazada)
- Convocatoria send method tracking
- Audit log de tool calls (separate ops concern)

---

## Aprobación

- [ ] Usuario revisa este spec.
- [ ] Si OK → entrar en writing-plans de sub-C (plan TDD).
- [ ] Si feedback → iterar sobre el spec antes de plans.

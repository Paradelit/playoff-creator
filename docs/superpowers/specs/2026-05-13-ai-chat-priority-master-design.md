---
title: AI chat priority — programa maestro (apuesta diferenciadora)
date: 2026-05-13
status: design
owner: claude (autonomo, pendiente review usuario)
scope: programa — decompone en 3 sub-proyectos secuenciales
relacionado:
  - PRODUCT.md (vision Pick + persona)
  - project_ai_priority.md (memoria — "AI chat es la prioridad")
  - project_help_is_agent_knowledge.md (memoria — ayuda pública = cerebro de Pick)
---

## TL;DR

Tras cerrar el master plan B2B (sub-0..sub-7) y los batches de audit + quality tooling
(PRs #26–#34), abrimos la **apuesta estratégica diferenciadora**: convertir Pick en un
copiloto que **anticipa, conversa y ejecuta** sobre la cuenta del entrenador, en vez de
un chat genérico de IA con tools.

3 sub-proyectos secuenciales:

| Sub | Foco                        | Por qué primero/después                                                |
| --- | --------------------------- | ---------------------------------------------------------------------- |
| A   | Contexto completo de cuenta | Fundación — sin saber el estado, no anticipa ni desambigua             |
| B   | Paridad conversacional      | Sobre el contexto rico — multi-turn, ambigüedad, persona, proactividad |
| C   | Tool use coverage + acción  | Pulido — al haber rodado A+B sabemos qué tools faltan de verdad        |

Hoy. **Sub-A** entra en spec inmediatamente (ver `2026-05-13-sub-proyecto-A-contexto-completo-design.md`). Sub-B y sub-C se brainstormean cuando A esté en revisión/implementación.

---

## El problema (caso narrativo)

Un entrenador entra en Pick un viernes por la noche:

> Usuario: "qué tengo el sábado"
> Pick (hoy): "Tienes un partido el sábado 2026-05-16 a las 11:00 vs Hispano en Pabellón Norte."
> Usuario: "ok, y la convocatoria?"
> Pick (hoy): "No tengo información sobre la convocatoria. ¿Quieres que la genere?"

El problema:

1. Pick sabe que hay partido — pero **no sabe** que la convocatoria aún no está hecha, aunque la app ya tiene esa información.
2. Pick **no anticipa**: tendría que haber dicho desde el primer "qué tengo el sábado" → "Partido a las 11h vs Hispano. Aún no has mandado la convocatoria — ¿la preparo?".
3. Cuando dice "y la convocatoria" Pick **no resuelve la ambigüedad**: ¿de qué partido? (asumir que del sábado, no preguntar).
4. Si el usuario dice "sí", Pick genera el texto — pero **no la persiste**, no marca el partido como "convocatoria mandada", no permite seguimiento.

El usuario esperaba un asistente que **conoce su semana, su equipo, sus pendientes**. Encontró un chatbot reactivo con un menú de tools.

**Esta apuesta** convierte (1) → contexto rico, (2) → proactividad, (3) → conversación natural, (4) → tool coverage + estado persistido.

---

## La apuesta

Pick gana cuando un coach piensa:

> "Pick me dijo lo que tenía que saber antes de que se lo preguntara."

Y pierde cuando piensa:

> "He tenido que abrir 3 pantallas para decirle a Pick lo que ya estaba en la app."

Esto requiere 3 pilares en orden:

### Pilar A — Contexto completo de cuenta

**Hoy** el `userDigest` que se inyecta en cada turno tiene:

- Teams (id, nombre, categoría, member count)
- Brackets activos (id, nombre, teamId)
- Próximas sesiones 7 días (max 15)
- Preferences (proactivityMode, defaultTrainingDuration)
- Memorias (max 15)

**Faltan** (lista no exhaustiva):

- Resultados recientes (último partido jugado y resultado)
- Convocatorias pendientes (partidos próximos sin convocatoria hecha)
- Asistencia recientes / anomalías (jugadores que faltan repetido)
- Informes de jugador pendientes (jugadores sin informe del trimestre)
- Scouting pendiente (próximos rivales sin scouting)
- Análisis pendiente (partidos pasados sin análisis)
- Tests de tiro recientes
- Bracket activo: ronda actual, próximo match, scores pendientes
- Cuaderno: última nota por sección
- Alertas/deadlines (fin de licencias, renovaciones, etc.)
- Estado de pantalla semántico (no solo "ruta=/teams/xyz" sino "viendo equipo Juniors B")

**Por qué primero:** sin esto, ni la conversación (pilar B) puede desambiguar, ni Pick puede anticipar.

### Pilar B — Paridad conversacional

**Hoy** el orchestrator funciona: compresión de historia, loop detection, retry, routing
fast/capable por complejidad. Pero **conversacionalmente** se siente robot:

- No usa el contexto rico para desambiguar referencias ("este equipo", "el partido", "el de Juan")
- No mantiene narrativa entre turnos (el resumen de turnos viejos pierde matices)
- No proactiviza — espera input siempre (excepto `usePickTips`)
- Personalidad inconsistente — algunos turnos suenan a coach, otros a SaaS
- No hace clarification questions cuando el input es ambiguo (asume o falla)
- No reconoce "no lo sé / no te puedo ayudar con eso" elegantemente

**Por qué después de A:** muchos de estos problemas son síntoma de contexto pobre. Pick no
desambigua porque no sabe qué hay. Resolver A reduce el alcance de B.

### Pilar C — Tool use coverage + acción

**Hoy** hay 34 tools (22 read + 12 write + 1 soft-write + memory + nav + knowledge + agents).
Gaps reales identificados:

- Live scoring de planilla (no existe write tool)
- Persistir convocatoria + estado "mandada" (sólo se genera texto)
- Updates / deletes (todos los `propose_*` son create-only)
- Bracket structure edits (más allá de scores)
- Team member operations (añadir/quitar/editar jugadores)
- Playoff series winner override (avanzar manualmente sin marcar todos los games)
- Calendar bulk ops (mover todo un día, repetir, etc.)
- Competition management (settings de bracket post-creación)

**Por qué al final:** este pilar es el menos diferenciador hoy (la mayoría de tools ya existe).
Y al haber rodado A+B sabremos cuáles writes los coaches piden de verdad por chat (vs cuáles
prefieren hacer en UI).

---

## Decisión: 3 sub-proyectos secuenciales

| Sub | Título                                | Spec date target   |
| --- | ------------------------------------- | ------------------ |
| A   | Contexto completo de cuenta           | 2026-05-13         |
| B   | Paridad conversacional + proactividad | tras A en revisión |
| C   | Tool use coverage + acción            | tras B en revisión |

Cada uno entra en su propio ciclo brainstorm → spec → plan → implementación.

### Dependencias

- B depende de A: la conversación necesita contexto rico para desambiguar.
- C es independiente técnicamente, pero su priorización (qué tools faltan más) requiere
  observar A+B en uso.
- A puede empezar **inmediatamente** sin bloqueos.

---

## Métricas de éxito (programa, no por sub)

Cómo sabremos que la apuesta funcionó:

| Métrica                                                       | Hoy (baseline) | Target     |
| ------------------------------------------------------------- | -------------- | ---------- |
| Mensajes/sesión por usuario activo                            | TBD medir      | +30%       |
| Sesiones que terminan en acción (proposal aceptado)           | TBD medir      | +50%       |
| Tasa de "fallback message" (Pick no entendió / no tenía info) | TBD medir      | <5%        |
| Coaches que abren Pick proactivamente sin task explícita      | TBD medir      | +100%      |
| Loops detectados / 1000 mensajes                              | observado bajo | sigue bajo |
| Tool error rate (fallos en función Firestore detrás de tool)  | TBD medir      | <2%        |

**Acción previa a sub-A:** instrumentar baseline. Pequeño M0 dentro de sub-A es enchufar
los counters que faltan en Langfuse.

---

## Out-of-scope (esta apuesta NO hace)

- Multimodal (voz, foto del entrenador hablando a Pick) — futuro
- Multi-usuario en la misma conversación (asistente compartido entre coaches) — fuera
- Pick autónomo (toma acciones sin user confirm) — el proposal-pattern se mantiene
- Cambiar el modelo LLM por defecto (seguimos con cadena Gemini → OpenRouter)
- Reescribir el frontend de chat (PickPanel/PickColumn/PickCompact se mantienen)
- Nuevos surfaces de UI (no añadimos sidebar floating de Pick ni overlay nuevo)

---

## Riesgos

**Bloating del system prompt** — sub-A debe respetar budget de tokens. Layer 1 (digest base) ~2-3KB, no más. Layer 3 (insights cached) NO va en system prompt, solo se inyecta cuando relevante.

**Privacy / scope creep** — más contexto = más superficie de datos. Sub-A debe respetar `members/{uid}.assignedTeamIds` (un asistente solo ve sus teams asignados, no todos los del workspace).

**Coste por mensaje** — más contexto base = más tokens cada turno. Hay que comparar contra la win en menos iteraciones (Pick que sabe contesta en 1 turno, hoy a veces necesita 3).

**Drift de conversación** — proactividad mal calibrada (Pick avisa de todo siempre) → ruido. Sub-B debe modelar bien el cuándo manifestarse vs callar.

---

## Open questions (a resolver en sub-A o sub-B)

1. ¿Se cachea el digest entre turnos de la misma conversación, o se recompone fresh cada turno?
   - Trade-off: freshness vs latencia/coste.
2. ¿Quién pre-computa los "pending convocatorias / scouting / analysis"? ¿Cloud Function scheduled, o on-demand al primer chat del día?
3. ¿Cómo se manifiesta la proactividad? (banner en PickPanel, mensaje inicial automático, badge en sidebar) — sub-B.
4. ¿La granularidad de scoping (assistant solo ve sus teams) aplica también a memorias y conversación histórica? (probablemente sí, validar en sub-A).
5. ¿La conversación histórica entre workspaces se separa, o se unifica? Hoy se guarda en `users/{uid}/pickHistory/{wsId}/conversations` — ya separada.

---

## Próximos pasos

1. **(Inmediato, este mismo PR):** spec de sub-A — `2026-05-13-sub-proyecto-A-contexto-completo-design.md`.
2. **(Al cerrar sub-A en revisión):** brainstorm sub-B (paridad conversacional).
3. **(Al cerrar sub-B en revisión):** brainstorm sub-C (tool coverage).
4. **(Paralelo, sin bloqueo):** instrumentar baseline metrics en Langfuse (M0 dentro de sub-A).

---

## Decisión / aprobación

- [ ] Usuario revisa este master spec.
- [ ] Usuario revisa sub-A design.
- [ ] Si ambos OK → entrar en writing-plans de sub-A.
- [ ] Si feedback → iterar sobre master + sub-A antes de plans.

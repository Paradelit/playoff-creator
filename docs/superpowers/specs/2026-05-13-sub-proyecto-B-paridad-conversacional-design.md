---
title: Sub-proyecto B — Paridad conversacional + proactividad
date: 2026-05-13
status: design
owner: claude (autonomo, pendiente review usuario)
parent: 2026-05-13-ai-chat-priority-master-design.md
depende_de: sub-A (completo en producción tras PRs #35-#55)
---

## TL;DR

Sub-A puso contexto rico en cada turno de Pick. Sub-B convierte ese
contexto en **conversación real**: multi-turn coherente, desambigua
referencias activamente, voz consistente, anticipa sin que se le pida,
maneja "no lo sé" con elegancia.

Cuatro capas (paralelas a las 4 de sub-A):

1. **Layer 1 — System prompt redesign**: persona reinforcement,
   examples, output structure guidance.
2. **Layer 2 — Historia conversacional smarter**: reemplaza la
   compresión flat por summarización topic-aware.
3. **Layer 3 — Detección + resolución de ambigüedad**: pre-LLM step que
   identifica preguntas ambiguas y pide clarificación en vez de asumir.
4. **Layer 4 — Proactive engine**: reemplaza/extiende `usePickTips` con
   mensajes proactivos basados en `pendingActions` + `anomalies` del
   digest.

---

## El problema (caso narrativo)

**Caso 1 — referencia ambigua sin desambigua:**

> Coach: "Mándame la convocatoria del partido"
> Pick (hoy con sub-A): Asume el partido más próximo. Si hay 3 equipos
> con partidos próximos, elige uno y puede equivocarse.
> Pick (deseado): "Tienes 3 partidos próximos: Cadete A (sábado vs
> Hispano), Juniors B (domingo vs Olímpico), Infantil (sábado vs San
> Isidro). ¿Cuál?"

**Caso 2 — narrativa multi-turn rota:**

> Coach: "qué planeamos para el sábado"
> Pick: detalla el partido del Cadete A.
> Coach: "vale, prepara la convocatoria del Cadete A"
> Pick: prepara correctamente.
> [10 turnos después]
> Coach: "y la del otro equipo?"
> Pick: no recuerda que estábamos hablando del sábado. Asks "¿qué
> equipo?".

Tras compresión de historia (líneas más cortas, sin contexto narrativo),
Pick pierde el hilo del fin de semana.

**Caso 3 — persona inconsistente:**

> Pick a veces: "Aquí tienes la lista de tus equipos." (estilo SaaS)
> Pick a veces: "Te traigo los equipos a la pizarra." (estilo coach)
> No hay convergencia clara.

**Caso 4 — falta proactividad:**

> Coach abre Pick un viernes 18:00 sin escribir nada.
> Pick (hoy): silencio o tip estático.
> Pick (deseado): "Mañana 11:00, Cadete A vs Hispano. La convocatoria
> aún no está mandada. ¿La preparo?"

**Caso 5 — "no lo sé" mediocre:**

> Coach: "qué resultados llevamos en la liga de Cadete A"
> Si no hay resultados parseados: Pick devuelve "No tengo información
> sobre eso."
> Deseado: "El Cadete A tiene 2 partidos jugados este mes pero no veo
> los resultados introducidos. Si me los pasas (o los introduces en el
> calendario), te puedo dar el balance."

---

## Goals

1. **Multi-turn coherente**: Pick mantiene el hilo de la conversación
   sobre 10+ turnos sin perder contexto narrativo crítico.
2. **Desambiguación activa**: cuando una pregunta tiene >1 interpretación
   plausible dado el contexto del coach, Pick pregunta cuál.
3. **Persona Pick consistente**: voz de coach (tutea, baloncesto-nativo,
   "tú entrenas, Pick trabaja") en todos los turnos.
4. **Proactividad medible**: Pick emite un mensaje proactivo útil al
   abrir si hay pendings urgentes (<24h) o anomalías.
5. **Fallbacks útiles**: cada caso de "no puedo" tiene mensaje
   específico (datos ausentes vs entendido pero no se puede vs LLM
   saturada vs tool error).

## Non-goals

- No cambia tools (sub-C).
- No cambia digest (sub-A está cerrado).
- No multimodal.
- No Pick autónomo (proposal-pattern se mantiene).
- No cambia LLM provider chain.
- No reescribe frontend chat UI (PickPanel/PickColumn/PickCompact).

---

## Estado actual (post sub-A en producción)

### Orquestador (`functions/src/ai/agents/orchestratorAgent.ts`)

- Compresión de historia: últimos 6 turnos verbatim, resto en formato:

  ```
  [Contexto resumido]
  U: hola, qué tengo el sábado
  A: Tienes Cadete A vs Hispano 11h
  ```

  Cada turno mayor a 6 se trunca a 130 chars.

- Routing fast/capable: keywords + length-based.
- Loop detection: idem args→stops.
- Retry on transient errors.
- Safety block: "He terminado." si nada útil.

### Persona

System prompt actual (`promptManager → orchestrator-system`) tiene
instrucciones de tono pero **examples están limitados**. El LLM tiende
al estilo SaaS cuando no se le refuerza. No hay convergencia testeada.

### Proactividad

`usePickTips.ts` (frontend) genera tips contextuales por screen pero
**estáticos** (no usan digest). No hay proactivity engine en backend.

### Ambigüedad

El orchestrator **no detecta ambigüedad**. Pasa el mensaje al LLM y
delega la decisión. El LLM a veces pregunta, a veces asume mal.

### Fallbacks

3 mensajes hardcoded:

- "He terminado." (no produjo nada útil)
- "He dejado un acceso directo abajo." (sólo actions)
- "La IA está saturada ahora mismo." (LLM 503/timeout)

Sin diferenciación entre "no entiendo" / "datos faltan" / "no se puede".

---

## Arquitectura propuesta — 4 capas

### Layer 1 — System prompt redesign

Refactor de `orchestrator-system` prompt para reinforcement de persona.

**Cambios:**

1. **Header de identidad fija** al inicio:

   ```
   Eres Pick, el copiloto de un entrenador de baloncesto. Tu voz:
   - Tuteas siempre. Hablas baloncesto-nativo.
   - "Tú entrenas. Pick trabaja." — devuelves trabajo hecho, no
     instrucciones para que el coach lo haga.
   - Anti-references: nunca suenes como un asistente SaaS genérico.
   ```

2. **Few-shot examples** representativos del estilo deseado.

3. **Output structure guidance**:

   ```
   Cuando respondes:
   - Empieza con el insight, no con "Claro" / "Por supuesto".
   - 1-3 frases para respuestas conversacionales.
   - Si propones algo accionable, separa la propuesta del contexto.
   ```

4. **Ambiguity protocol**: instrucciones específicas para que el LLM
   pida clarificación cuando hay >1 entidad plausible.

### Layer 2 — Historia conversacional smarter

Reemplaza `compressConversationHistory` flat por summarización
**topic-aware** que preserva narrativa.

**Algoritmo nuevo (`compressHistory v2`):**

1. Si historia ≤6 turnos: devuelve verbatim (como ahora).
2. Si historia >6 turnos:
   - Toma últimos 6 verbatim.
   - Para los anteriores, agrupa por "topic chunk" (consecutive turns
     about same entity/topic, detectado por overlapping entity mentions).
   - Resume cada chunk en 1-2 frases que preserven (a) qué se hizo y
     (b) entidades mencionadas.
   - Concatena los resúmenes en orden cronológico.

Ejemplo:

Antes:

```
[Contexto resumido]
U: qué tengo el sábado
A: Cadete A vs Hispano 11h, Juniors B vs Olímpico 13h
U: prepara la convocatoria del Cadete A
A: Hecho.
U: vale, ya te aviso para la del otro
A: Cuando quieras.
```

Después:

```
[Contexto previo]
1) Coach preguntó por sábado → mencionados: Cadete A vs Hispano,
   Juniors B vs Olímpico.
2) Coach pidió convocatoria del Cadete A → enviada.
3) Coach dejó pendiente convocatoria de Juniors B.
```

Cuando luego coach diga "y la otra", LLM ve "convocatoria de Juniors B
pendiente" en el contexto y resuelve.

**Implementación inicial:** summarización via LLM call (cheap model
fast) en cada compresión. Cache por (conversationId, turn-end-index)
para evitar re-summarizar.

### Layer 3 — Detección + resolución de ambigüedad

Pre-LLM step que clasifica el mensaje del coach antes de pasarlo al
orchestrator principal.

**`AmbiguityClassifier`** (nuevo módulo en `functions/src/ai/ambiguity/`):

Entrada: userMessage + userDigest + screenContext + última conversación.

Salida (`AmbiguityResult`):

- `kind: "clear" | "ambiguous" | "out-of-scope"`
- `if kind === "ambiguous"`: { phrasings: string[], candidates:
  Array<{id, label, kind}>, suggestedClarification: string }
- `if kind === "out-of-scope"`: { reason: string,
  suggestedAlternative?: string }

**Heurística inicial (sin LLM):**

Regex + scoping conocido. Ejemplos:

- "convocatoria del partido" + multiple upcoming partidos →
  `ambiguous`.
- "este jugador" sin screenSemantic.referableIds["este jugador"] →
  `ambiguous`.
- "balance financiero" → `out-of-scope`.

**Heurística avanzada (LLM):**

Si la heurística regex no resuelve, llamada al modelo fast con
instrucción específica de detectar ambigüedad.

**Flujo:**

```
userMessage → AmbiguityClassifier →
  - clear → continue al orchestrator normal
  - ambiguous → emite directly un confirm_choice block, salta al user
  - out-of-scope → emite text block con explicación + alternativas
```

Esto evita llamadas al LLM caro cuando la pregunta es ambigua.

### Layer 4 — Proactive engine

Reemplaza/extiende `usePickTips` con un engine que decide cuándo Pick
emite un mensaje proactivo basado en `digest.pendingActions` +
`digest.anomalies` (cuando lleguen).

**`ProactiveEngine`** (extiende el existente proactiveEngine.ts /
proactiveDailyBriefing scheduled function):

Triggers:

1. **Al abrir Pick por primera vez en el día (frontend)**: si hay
   convocatorias con severity=high o pendings críticos, emite mensaje
   proactivo.
2. **Cuando el coach navega a una screen con pending relevante**: ej.
   abrir CalendarScreen y hay convocatorias pendientes → banner.
3. **Push notification (opcional, futuro)**: cada mañana resumen
   diario.

**Prioridad** (de mayor a menor):

- Convocatoria <24h sin mandar.
- Análisis pendiente >7d.
- Anomalía attendance (jugador faltando seguido).
- Scouting pendiente del rival del próximo partido.
- Cumpleaños del día.

**Output:** un `ProactiveMessage` con (kind, text, severity,
suggestedPrompt). El frontend lo renderiza como banner o como mensaje
inicial.

---

## Componentes afectados

### Backend (`functions/`)

| Archivo                               | Cambio                                          |
| ------------------------------------- | ----------------------------------------------- |
| `ai/promptManager.ts`                 | Refactor `orchestrator-system` prompt — persona |
| `ai/agents/orchestratorAgent.ts`      | Usa nueva `compressHistoryV2`                   |
| `ai/history/compressHistory.ts` (NEW) | Topic-aware compression                         |
| `ai/ambiguity/classifier.ts` (NEW)    | AmbiguityClassifier heurístico + LLM            |
| `ai/ambiguity/types.ts` (NEW)         | `AmbiguityResult`                               |
| `ai/proactive/engine.ts` (refactor)   | Extiende del scheduled briefing existente       |
| `ai/proactive/triggers.ts` (NEW)      | Lógica de priorización                          |
| `ai/contentBlocks.ts`                 | Nuevo block `confirm_choice` + `proactive_card` |
| `__tests__/...`                       | Tests focales por módulo                        |

### Frontend (`src/`)

| Archivo                                          | Cambio                                      |
| ------------------------------------------------ | ------------------------------------------- |
| `components/pick/PickPanel.tsx`                  | Render de `proactive_card` block            |
| `components/pick/PickColumn.tsx`                 | Idem                                        |
| `components/pick/blocks/ConfirmChoice.tsx` (NEW) | Render del `confirm_choice` block           |
| `hooks/usePickTips.ts` (refactor)                | Pasa a consumir proactive del backend       |
| `hooks/usePick.ts`                               | Maneja proactive_card al abrir conversación |

### Tests

Vitest. Tests obligatorios para cada layer + integration test del flujo
ambigüedad → confirm_choice → orchestrator.

---

## Métricas de éxito (sub-B en Langfuse)

Además de los scores ya en prod:

| Score                         | Qué mide                                         |
| ----------------------------- | ------------------------------------------------ |
| `ambiguity_detected_rate`     | % turnos con kind=ambiguous detectado            |
| `clarification_resolved_rate` | % ambiguous → user picked candidate              |
| `persona_consistency_score`   | Heurística post-hoc del LLM (estilo coach)       |
| `proactive_emission_rate`     | % daily-active users que reciben proactive       |
| `proactive_acceptance_rate`   | % proactive_cards aceptadas (CTA clicked)        |
| `multi_turn_coherence_score`  | Eval LLM-as-judge sobre conversaciones >5 turnos |

---

## Fases dentro de sub-B

| Fase | Foco                                             | Risk |
| ---- | ------------------------------------------------ | ---- |
| B.0  | Instrumentar métricas baseline (sub-B specific)  | low  |
| B.1  | System prompt redesign + persona                 | low  |
| B.2  | Smarter history compression v2 (con caché)       | med  |
| B.3  | AmbiguityClassifier heurístico (regex-based)     | med  |
| B.4  | AmbiguityClassifier LLM-assisted                 | med  |
| B.5  | ProactiveEngine — triggers + priorización        | high |
| B.6  | Frontend: confirm_choice + proactive_card blocks | med  |
| B.7  | Eval cases multi-turn (LLM-as-judge fixtures)    | low  |
| B.8  | Docs CLAUDE.md update                            | low  |

Total estimado: **8-10 PRs**, similar a sub-A.

---

## Riesgos específicos

1. **Persona drift** — refactor del prompt puede regresionar respuestas
   actuales. Mitigación: snapshot tests de prompts compilados + manual
   review.
2. **Compresión cara** — summarización via LLM en cada turno
   multiplica calls. Mitigación: cache agresivo por
   conversationId+turn-index.
3. **Ambiguity false positives** — Pick pregunta cuando no hace falta,
   coach se frustra. Mitigación: heurística regex conservadora,
   threshold alto para el clasificador LLM.
4. **Proactive ruido** — Pick avisa de cosas no urgentes. Mitigación:
   solo severity=high al abrir; resto via opt-in setting.
5. **Latencia añadida** — clasificador previo añade ~100-300ms por
   turno. Mitigación: paralelizar con digest build cuando posible.

---

## Out-of-scope (siguen siendo sub-C u otro programa)

- Write tools nuevos (planilla, convocatoria persist, updates,
  deletes).
- Push notifications real (Firebase Cloud Messaging).
- Cross-workspace conversation history.
- Voice mode.

---

## Open questions

1. ¿`compressHistoryV2` cache vive en Firestore (persistente) o en
   memoria de la function (volátil)? Propuesta: Firestore por
   conversationId con TTL 7d.
2. ¿`AmbiguityClassifier` LLM usa fast model siempre, o capable cuando
   heurística regex baja confianza? Propuesta: fast siempre, capable
   como fallback raro.
3. ¿`ProactiveEngine` cómo evita ser ruidoso si el coach ignora
   mensajes? Propuesta: tracking `proactive_dismissals` en
   `users/{uid}/profile/main.proactive` + backoff exponencial por kind.
4. ¿`confirm_choice` block — el frontend renderiza como buttons
   inline o como nueva modal? Propuesta: inline buttons (consistent
   con confirm_write actual).
5. ¿Empezamos con B.0+B.1 (instrumentación + prompt) que son low risk
   y se pueden shippar sin tocar comportamiento, o vamos directo a
   B.3 (ambigüedad) que mueve la aguja más? Propuesta: B.0+B.1 primero
   para baseline, luego B.3.

---

## Salida esperada

Al aprobar este spec, el siguiente paso es:

1. Brainstorm + plan de B.0 + B.1 (instrumentación + prompt redesign).
2. Ship esos primero como foundation.
3. Luego B.2 (compression) y B.3 (ambigüedad) en paralelo.
4. B.4-B.6 secuenciales.
5. B.7-B.8 wrap-up.

---

## Decisión

- [ ] Usuario revisa spec.
- [ ] Si OK → writing-plans de B.0+B.1.
- [ ] Si feedback → iterar.

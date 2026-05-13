---
title: Sub-proyecto A — Contexto completo de cuenta (AI chat priority)
date: 2026-05-13
status: design
owner: claude (autonomo, pendiente review usuario)
parent: 2026-05-13-ai-chat-priority-master-design.md
---

## TL;DR

Convertir el `userDigest` actual (pobre — teams + brackets + sessions + prefs + memorias) en
un **sistema de contexto en 4 capas** que permita a Pick **anticipar, desambiguar y actuar**
sin que el coach le tenga que repetir lo que ya está en la app.

Cuatro capas:

1. **Digest base enriquecido** (~2-3KB en system prompt cada turno)
2. **Read tools de profundización** (lazy, on-demand, los que ya existen + nuevos)
3. **Insights pre-computados** (alertas, deadlines, anomalías, cacheados por workspace+día)
4. **Screen state semántico** (qué está viendo el coach, no solo qué URL)

---

## Problema concreto

Caso 1 — el viernes por la noche:

> Coach: "qué tengo el sábado"
> Pick (hoy): muestra session.
> Pick (deseado): muestra session **+ "Convocatoria pendiente, ¿la preparo?"**

Caso 2 — el lunes después de partido:

> Coach: "ayer cómo fue"
> Pick (hoy): no sabe (digest solo trae sesiones futuras).
> Pick (deseado): "Perdisteis 60-72 vs Hispano. Aún no hay análisis del partido, ¿te lo abro?"

Caso 3 — referencias en pantalla:

> Coach (en TeamDetailScreen): "genera entrenamiento para este equipo"
> Pick (hoy): screen.entityId está en context, pero el LLM tiene que adivinar.
> Pick (deseado): system prompt incluye "viendo equipo Juniors B, 12 jugadores, próximo partido sábado". Sin ambigüedad.

Caso 4 — proactividad:

> Coach abre PickPanel sin escribir nada.
> Pick (hoy): "Hola, ¿en qué puedo ayudarte?"
> Pick (deseado): "Buenos días. Hoy entrenamiento Juniors B 19h. Pendiente: convocatoria sábado, análisis del partido del domingo. ¿Por dónde empezamos?"

---

## Goals

1. El system prompt en cada turno incluye un digest **rico** que cubra: teams + rosters + brackets + ronda activa + sessions próximas + sessions pasadas recientes + pendientes + alertas + memorias + preferencias + screen state semántico.
2. Pick puede **anticipar** sin que el coach pregunte (lista de pendientes + alertas siempre disponible).
3. Pick **desambigua** referencias con el contexto rico (asistencia, jugadores, partidos por nombre/fecha) sin tener que llamar tools.
4. Pick **respeta el scope** (assistant ve solo sus teams asignados).
5. Pick **no degrada en latencia** — digest construido en <500ms p95, cacheado donde tiene sentido.
6. Pick **no degrada en coste** — system prompt total bajo 4KB de digest + screen + memorias.

## Non-goals

- No cambia la persona/voz de Pick (esto es pilar B).
- No añade write tools nuevos (esto es pilar C).
- No cambia el UI del chat.
- No cambia el LLM provider chain.
- No multimodal.
- No reemplaza memorias / knowledge base / RAG (los integra como están).

---

## Estado actual (lo que hay que cambiar)

### `functions/src/ai/userDigest.ts`

Estructura actual (`UserDigest`):

```text
UserDigest {
  teams: [{ id, name, categoria, nivel, memberCount }]
  activeBrackets: [{ id, name, teamId }]
  upcomingSessions: [{ id, fecha, horaInicio, tipo, teamName, rival, lugar }]  // próximas 7d, max 15
  preferences: { proactivityMode, defaultTrainingDuration }
  memories: [{ id, type, content }]  // max 15
  todayISO: string
}
```

Build via 5 Firestore reads en `Promise.all`:

- `teams` (collection get)
- `brackets` (collection get)
- `calendarSessions` (where fecha in [today, +7d])
- `users/{uid}/profile/main` (get)
- `fetchMemoriesForDigest` (helper)

Renderiza como prosa en `digestToPromptText` que entra en system prompt.

### `functions/src/ai/agents/orchestratorAgent.ts`

System prompt = `promptManager.compile("orchestrator-system", { digestText, screenInfo })`.

`screenInfo` se construye así:

```
PANTALLA ACTUAL: {screen} (ruta: {route})
Entidad enfocada: {entityType} id={entityId}
Datos visibles: {JSON.stringify(screen.data)}
```

Esto es **bruto** — el LLM ve JSON crudo y tiene que interpretar.

### `members/{uid}.assignedTeamIds`

Para asistentes (role=assistant), el digest **no respeta** este scope hoy — lee todos los teams del workspace. Bug latente.

---

## Arquitectura propuesta — 4 capas

### Layer 1 — Digest base enriquecido (system prompt cada turno)

Nueva estructura `UserDigest`:

```ts
interface UserDigest {
  // ── Identity & time ──
  todayISO: string;
  todayLocalDayOfWeek: string; // "lunes", "martes" — útil para "el sábado"
  workspace: { id: string; name: string; type: "personal" | "club"; userRole: "owner" | "coach" | "assistant" };

  // ── Teams (scoped por role) ──
  teams: Array<{
    id: string;
    name: string;
    categoria?: string;
    nivel?: string;
    memberCount: number;
    // NEW
    rosterSnapshot?: Array<{ id: string; nombre: string; dorsal?: number; posicion?: string }>; // primeros 12
    nextSession?: { fecha: string; tipo: string; rival?: string }; // próxima session de este team
    lastResult?: { fecha: string; ourScore: number; theirScore: number; rival: string }; // último resultado conocido
  }>;

  // ── Brackets ──
  activeBrackets: Array<{
    id: string;
    name: string;
    teamId?: string;
    // NEW
    currentRound?: string; // "Cuartos", "Semis", "Final"
    nextMatch?: { id: string; teamA: string; teamB: string; scheduled?: string };
    pendingScores?: number; // matches con result pero sin score introducido
  }>;

  // ── Calendar (ventana ampliada) ──
  upcomingSessions: Array<{...}>; // mantiene 7 días, max 15
  recentPastSessions: Array<{    // NEW — últimos 7 días
    id: string;
    fecha: string;
    tipo: string;
    teamName?: string;
    rival?: string;
    result?: { ourScore: number; theirScore: number };
  }>;

  // ── Pendientes (NEW — derivado de Layer 3 cache) ──
  pendingActions: {
    convocatorias: Array<{ sessionId: string; fecha: string; teamName?: string; rival?: string }>; // partidos próximos 14d sin convocatoria
    analyses: Array<{ sessionId: string; fecha: string; teamName?: string; rival?: string }>; // partidos jugados últimos 21d sin análisis
    scoutings: Array<{ sessionId: string; fecha: string; teamName?: string; rival?: string }>; // partidos próximos 14d sin scouting de rival
    playerReports: Array<{ teamId: string; teamName: string; missingForPlayerCount: number }>; // jugadores sin informe en trimestre actual
  };

  // ── Anomalías (NEW, ligero) ──
  anomalies: Array<{
    kind: "attendance" | "training_gap" | "cuaderno_gap" | "bracket_stale";
    summary: string; // "Juan ha faltado a los últimos 3 entrenamientos del Juniors B"
    severity: "info" | "warn";
  }>;

  // ── Preferences ──
  preferences: { proactivityMode?: string; defaultTrainingDuration?: number };

  // ── Memorias (sin cambio) ──
  memories: Array<{ id: string; type: MemoryType; content: string }>;

  // ── Screen state semántico (NEW) ──
  screenSemantic?: {
    surface: string; // "team-detail", "calendar", "bracket-editor", etc. — código semántico
    label: string;   // legible para el LLM: "Visualizando equipo Juniors B, 12 jugadores."
    referableIds?: Record<string, string>; // { "este equipo": teamId, "este partido": sessionId, ... }
  };
}
```

**Budget de tokens** — target estricto:

| Sección              | Budget  |
| -------------------- | ------- |
| Identity & time      | 100 t   |
| Teams (12 max, lite) | 600 t   |
| Brackets (5 max)     | 200 t   |
| Sessions (15 + 7)    | 600 t   |
| Pending actions      | 400 t   |
| Anomalies (5 max)    | 200 t   |
| Memorias (15 max)    | 600 t   |
| Screen semantic      | 100 t   |
| Total budget         | ~2800 t |

Para workspaces grandes, hay caps duros + ranking por relevancia (próximas sesiones primero, anomalías top-3, etc.).

### Layer 2 — Read tools de profundización (lazy)

Ya existen 22 read tools. Se mantienen. Se añade:

- `get_recent_results(teamId?, limit=10)` — historial de resultados de partidos
- `get_attendance_summary(teamId, weeks=4)` — agregado de asistencia por jugador
- `get_pending_actions_detail(kind)` — detalle expandido de pending (por si LLM quiere profundizar)
- `get_player_status(playerId)` — estado consolidado de un jugador (asistencia + informe + tests)
- `get_team_health(teamId)` — alertas combinadas para un team

**Por qué lazy:** muchos de estos son caros (multi-collection). El digest base trae _resumen_,
y si Pick necesita detalle pide via tool. Esto mantiene el system prompt acotado.

### Layer 3 — Insights pre-computados (cache)

Nuevo doc Firestore:

```
artifacts/{appId}/workspaces/{wsId}/pickInsights/{YYYY-MM-DD}
{
  computedAt: Timestamp,
  pendingActions: { ... },  // structure idéntica a digest.pendingActions
  anomalies: [...],
  lastResults: [...],
  recommendedMessage?: string  // "Pick proactivo": qué diría Pick al abrir sin input
}
```

**Cuándo se computa:**

1. **On-demand** primera vez que el digest del día se construye (build → cachea → reuse).
2. **Scheduled** (opcional, futuro): Cloud Function diaria a las 06:00 que pre-computa para
   workspaces activos en los últimos 7d.

**Por qué cache:**

- `buildUserDigest` se llama una vez por turno. Sin cache son ~6+ Firestore reads pesadas cada vez.
- Con cache, el cómputo pesado ocurre una vez al día por workspace.
- Si algo cambia mid-day (nuevo partido programado, scouting subido), se invalida el cache.

**Invalidation:**

- TTL 6h (si pasaron 6h, recomputar).
- Manual invalidation: write a `pickInsights/{date}.invalidated = true` desde callables que
  mutan el calendario / scouting / análisis / informes. Pick relee.
- Solo se invalida si quien escribió tiene assignedTeamIds que afectan al insight (granularidad).

**Por qué doc por día (no único `current`):**

- Permite ver "lo de ayer" sin perderlo.
- Simplifica TTL.
- Tamaño manejable.

**Relación L1 ↔ L3:**

El digest L1 (que va al system prompt cada turno) **no recomputa** `pendingActions` ni
`anomalies` cada vez. Lee el doc `pickInsights/{today}` y copia los campos relevantes
filtrados por scope del usuario (ver sección "Scoping"). Si el cache no existe o está
stale (`invalidated == true` o `computedAt < now - 6h`), `buildUserDigest` computa fresh
y persiste antes de devolver. Esto significa:

- Primer turno del día por workspace: lectura pesada (sin cache) + escritura del cache.
- Turnos siguientes ese día: lectura ligera del cache.
- Tras un write que invalida (nuevo partido, scouting subido, etc.): siguiente turno repaga
  el coste pesado.

**Scoping del cache (importante):**

El doc `pickInsights/{date}` se computa **workspace-wide** (todos los teams). El filtro
por `assignedTeamIds` ocurre **en código** dentro de `buildUserDigest`, no en Firestore
rules. Esto evita explosión combinatoria de docs (uno por user×date sería caro y
duplicado). Trade-off: assistants tienen permiso de _read_ sobre el doc completo, pero
el digest que llega al LLM ya viene filtrado. Validado por tests.

### Layer 4 — Screen state semántico

Hoy `screenContext` tiene `{screen, route, entityId, entityType, data}`. El LLM ve JSON crudo.

Cambio: en frontend (`PickProvider` o `ScreenContextProvider`), cuando se setea screen context,
también se calcula un **label semántico** y un **map de referables**:

```ts
{
  surface: "team-detail",
  label: "Visualizando equipo Juniors B, 12 jugadores. Próximo partido: sábado vs Hispano.",
  referableIds: {
    "este equipo": "team-abc123",
    "este partido": "session-xyz789"
  }
}
```

El digest L1 incluye este screenSemantic. El LLM puede resolver "genera entrenamiento para
este equipo" sin ambigüedad.

**Wire format (cómo llega del frontend al system prompt):**

1. Frontend, en `ScreenContextProvider`, llama un helper por screen: `getScreenSemantic(state) → ScreenSemantic | null`.
2. El resultado se merge en `screenContext` antes de pasarlo al `usePick` hook: `{ screen, route, entityId, entityType, data, semantic }`.
3. El callable `runAgent` recibe `screenContext.semantic` como campo opcional.
4. `buildUserDigest` lo copia tal cual en `UserDigest.screenSemantic`.
5. `digestToPromptText` lo renderiza como una sección al final del prompt.

**Trade-off:** lógica de construcción semántica vive en frontend (acceso a state local).
Cada screen importante debe registrar su propia helper (función pura: `(state) => screenSemantic`).
Empezamos con las 6 screens de mayor uso (TeamDetail, Calendar, BracketEditor,
PickPanel-from-pantalla, Asistencia, InformeJugador). Resto cae a `null` (fallback: sin
sección semántica, el LLM ve solo `screen + route + entityId`).

---

## Componentes afectados

### Backend (functions/)

- `functions/src/ai/userDigest.ts` — refactor mayor. Pasa de 165 LOC a ~400. Splitear en:
  - `userDigest.ts` (orquestador + tipo + render)
  - `digest/teamsDigest.ts`
  - `digest/calendarDigest.ts`
  - `digest/bracketsDigest.ts`
  - `digest/pendingActions.ts`
  - `digest/anomalies.ts`
  - `digest/insightsCache.ts`
- `functions/src/ai/tools/readTools.ts` — añadir 5 tools nuevos. Probablemente trigger
  `max-lines` warning — split en `readTools/queries.ts` + `readTools/aggregates.ts`.
- `functions/src/ai/types.ts` — extender `ScreenContextData` con `screenSemantic?`.
- `functions/src/index.ts` — `runAgent` callable invoca `buildUserDigest` ya, sigue igual.
- **Nuevo:** `functions/src/ai/digest/insightsCacheInvalidator.ts` — Firestore trigger
  onWrite sobre calendar / scouting / análisis / informes que invalida insights del día.
- **Tests:** `functions/src/ai/__tests__/userDigest.test.ts` se expande para cubrir todas
  las capas + scoping por role.

### Frontend (src/)

- `src/contexts/ScreenContextProvider.jsx` — añadir prop `semantic` opcional.
- `src/screens/TeamDetailScreen.jsx` — registrar semantic helper.
- `src/screens/CalendarioScreen.jsx` — registrar semantic helper.
- `src/screens/BracketScreen.jsx` — registrar semantic helper.
- (3 more screens TBD durante implementación).
- **No** cambia PickPanel/PickColumn/PickCompact — siguen consumiendo `useAgentResponse`.

### Firestore rules

- `pickInsights/{date}`: solo backend escribe. Lectura: cualquier miembro del workspace (es
  no-sensitive — derived data del propio workspace). **Decisión:** miembros leen, callables
  escriben.
- Rules nuevas a añadir en `firestore.rules` sección workspace child collections.

### Firestore indexes

- Posible nuevo index si `recentPastSessions` requiere where(fecha < today) order by fecha desc.

---

## Data flow nuevo

```
Coach abre Pick / envía mensaje
        ↓
PickPanel → POST /runAgent { message, screenContext }
        ↓
runAgent callable (functions/src/index.ts)
        ↓
buildUserDigest({ db, userId, wsId, appId, clientDate })
        ↓
   ┌───────────────┴───────────────┐
   ↓                               ↓
[Layer 1 base reads]      [Layer 3 insights cache]
- teams, brackets,         - Lee pickInsights/{today}
  sessions, profile,       - Si invalidated o >6h, recomputa:
  memories                     - pendingActions
                                - anomalies
                                - lastResults
                            - Si fresh, reusa.
   ↓                               ↓
   └───────────────┬───────────────┘
                   ↓
            Compose UserDigest
                   ↓
        digestToPromptText(digest)
                   ↓
            System prompt → LLM
                   ↓
        LLM responde / calls tools
                   ↓
   ┌───────────────┴───────────────┐
   ↓                               ↓
Layer 2 tools (lazy)         Devuelve a frontend
- get_recent_results
- get_attendance_summary
- get_player_status
- get_team_health
- get_pending_actions_detail
```

---

## Nuevos tools (signatures)

```ts
// 1. get_recent_results
{
  name: "get_recent_results",
  description: "Devuelve los últimos N partidos jugados con su resultado. Útil cuando el coach pregunta 'cómo fue el de ayer' o 'qué resultados llevamos'.",
  parameters: {
    type: "object",
    properties: {
      teamId: { type: "string", description: "Opcional. Si se omite, agregado de todos los teams asignados al coach." },
      limit: { type: "integer", description: "Default 10, max 30." }
    }
  }
}

// 2. get_attendance_summary
{
  name: "get_attendance_summary",
  description: "Agregado de asistencia por jugador en las últimas N semanas. Útil para detectar patrones (jugador que falta repetido) o resumir asistencia.",
  parameters: {
    type: "object",
    properties: {
      teamId: { type: "string", description: "Requerido." },
      weeks: { type: "integer", description: "Default 4." }
    },
    required: ["teamId"]
  }
}

// 3. get_pending_actions_detail
{
  name: "get_pending_actions_detail",
  description: "Detalle expandido de pending actions (convocatorias, analyses, scoutings, playerReports) — el digest trae resumen, este tool trae el detalle por kind.",
  parameters: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["convocatorias", "analyses", "scoutings", "playerReports"] }
    },
    required: ["kind"]
  }
}

// 4. get_player_status
{
  name: "get_player_status",
  description: "Estado consolidado de un jugador: asistencia reciente, último informe, último test de tiro, observaciones del cuaderno.",
  parameters: {
    type: "object",
    properties: {
      playerId: { type: "string", description: "Requerido." }
    },
    required: ["playerId"]
  }
}

// 5. get_team_health
{
  name: "get_team_health",
  description: "Resumen de alertas de un team: jugadores con asistencia irregular, informes pendientes, próximos compromisos sin scouting/convocatoria.",
  parameters: {
    type: "object",
    properties: {
      teamId: { type: "string", description: "Requerido." }
    },
    required: ["teamId"]
  }
}
```

Tools 1–5 son **read-only** y respetan `assignedTeamIds`.

---

## Scoping (role-aware)

| Role       | Teams visibles                       | Insights visibles              |
| ---------- | ------------------------------------ | ------------------------------ |
| owner      | todos los del workspace              | agregados de todo el workspace |
| coach (DT) | todos los del workspace              | agregados de todo el workspace |
| assistant  | solo `members/{uid}.assignedTeamIds` | filtrado por assignedTeamIds   |

Implementación: `buildUserDigest` recibe `userId` y resuelve `members/{uid}` para obtener
`role` + `assignedTeamIds` antes de leer teams. Reglas concretas:

- **owner / coach (DT):** `assignedTeamIds` se ignora aunque venga, lee todo el workspace.
- **assistant con `assignedTeamIds = [...]` no vacío:** filtra teams por `id ∈ assignedTeamIds`, brackets por `teamId ∈ assignedTeamIds` (excluye brackets con `teamId == null` para evitar leaks), sessions por `teamId ∈ assignedTeamIds`.
- **assistant con `assignedTeamIds` vacío o ausente:** devuelve digest sin teams/brackets/sessions (solo memorias propias + preferencias + screenSemantic). El LLM verá "(sin equipos asignados)" — no es un error, es estado válido.
- El cache `pickInsights/{date}` es workspace-wide, pero las listas `pendingActions.*` se filtran in-memory en `buildUserDigest` por `assignedTeamIds` antes de llegar al prompt.

Tests deben cubrir los 3 paths (owner/DT, assistant scoped, assistant sin scope).

---

## Eval cases (Langfuse / AutoEvaluator)

Nueva categoría de evals **"context-aware"** — casos que prueban que Pick usa el digest:

1. **"qué tengo el sábado"** sin más contexto → debe mencionar partido + flag convocatoria pendiente si aplica (presente en `pendingActions.convocatorias`).
2. **"cómo fue ayer"** con partido ayer → debe leer `recentPastSessions[]` (no llamar tool — está en digest). Si ayer no hay sesión, responder explícitamente "ayer no tuviste sesión" sin tool call.
3. **"genera entrenamiento para este equipo"** desde TeamDetailScreen → debe resolver `screenSemantic.referableIds["este equipo"]` sin llamar `list_teams` ni `get_team`.
4. **"convocatoria del próximo"** → resuelve `pendingActions.convocatorias[0]` y propone generar via `mandar_convocatoria`.
5. **"qué pendientes tengo"** → enumera `pendingActions` + `anomalies` sin tool call.
6. **(scoping)** assistant con `assignedTeamIds=[A,B]` pregunta "qué equipos tengo" → solo A,B (otro team C del workspace NO aparece en el response del LLM).
7. **(cache freshness)** tras `propose_save_scouting` aceptado en partido X, siguiente turno preguntando "qué scoutings pendientes" → X **no** aparece en `pendingActions.scoutings` (cache invalidado).

Métricas a trackear:

- `digest_size_tokens` — cada turno, log el size del digest text.
- `digest_build_ms` — cada turno, log el tiempo de construcción.
- `pending_actions_hit_rate` — cuando el coach pregunta algo cubierto por pendings, ¿Pick lo usa? (manual rating al principio).
- `screen_semantic_used` — si screenSemantic está presente y el LLM resolvió referencia → contar.

---

## Fases dentro de sub-A

| Fase | Foco                                                                                                      | Risk |
| ---- | --------------------------------------------------------------------------------------------------------- | ---- |
| A.0  | Instrumentar baseline (Langfuse counters)                                                                 | low  |
| A.1  | Refactor `userDigest.ts` → split por dominio (sin cambio funcional)                                       | low  |
| A.2  | Layer 1 — campos enriquecidos (rosterSnapshot, lastResult, nextSession, currentRound, recentPastSessions) | med  |
| A.3  | Scoping role-aware (`assignedTeamIds`) — **incluye fix bug actual**                                       | med  |
| A.4  | Layer 3 — insights cache (pendingActions + anomalies)                                                     | high |
| A.5  | Layer 4 — screen semantic (frontend + types backend)                                                      | med  |
| A.6  | Layer 2 — 5 new read tools                                                                                | low  |
| A.7  | Eval cases + tests                                                                                        | low  |
| A.8  | Docs (`CLAUDE.md`: nueva sección "Pick context system")                                                   | low  |

Total estimado: **8 PRs pequeños o 3 PRs medianos**. Decide writing-plans.

A.0–A.3 son foundation. A.4 es el cambio mayor (cache + invalidación). A.5–A.7 son enhancements
independientes.

**Sequencing:** A.0 puede ir al inicio para tener baseline antes de cambiar nada. A.3 puede ir
en paralelo con A.2 (fixes bug existente). A.4 idealmente último entre los grandes (más feedback
loop).

---

## Migration / backward compat

- `UserDigest` es interno (definido en functions). No hay clientes externos. **No hay migration**.
- `pickInsights/{date}` es greenfield. No hay datos legacy.
- `screenSemantic` es opcional en `ScreenContextData`. Si no se pasa, fallback al comportamiento actual (screen+route+entityId+data).
- Tools nuevos: aditivos. Tools existentes: no se modifican signatures.
- Prompt template `orchestrator-system`: se actualiza para acomodar nuevo digest format. Backward compat no aplica (es prompt, no API).

---

## Riesgos específicos

1. **Token bloat** — si workspaces grandes (50 teams) sin caps por sección, system prompt explota. Mitigación: caps duros + ranking.
2. **Cache staleness** — si invalidación no es completa, coach ve "stale insights" tras crear un partido nuevo. Mitigación: TTL 6h backstop + invalidation manual + test coverage de los Firestore triggers.
3. **Privacy leak vía digest** — assistant ve teams ajenos por error de scoping. Mitigación: tests obligatorios para el role-aware path.
4. **Coste latency** — primer turno del día = compute cache + reads. P95 puede subir. Mitigación: pre-compute scheduled (opcional, fase futura) + medir antes/después.
5. **Coste tokens** — sistema prompt 2-3x más grande. Compensado por menos iteraciones (Pick que sabe contesta en 1 turno). Medir ratio total_tokens/conversation.

---

## Open questions (a resolver durante implementación)

1. ¿`recentPastSessions` cuántos días atrás? Propuesta: 7d. Si <3 sessions, ampliar a 14d.
2. ¿`rosterSnapshot` se incluye siempre o solo si team es focused? Propuesta: solo los primeros 12 jugadores siempre. Si team es focus en screen, hasta 20.
3. ¿`anomalies` se computa solo en cache, o también ad-hoc? Propuesta: solo en cache (es caro).
4. ¿`pendingActions.playerReports` cómo se define "informe pendiente"? Propuesta: ningún `playerReports` doc con fecha en el trimestre actual.
5. ¿`screenSemantic.referableIds` lo mantiene cada screen, o lo construye un helper genérico que lee de `state.entityType + state.entityId`? Propuesta: helper genérico + override por screen cuando hace falta.
6. ¿El scheduled pre-compute existe en fase A.4 o se difiere? Propuesta: difiere — fase A.4 solo on-demand, scheduled queda como follow-up.

---

## Salida esperada de este spec

Al aprobarse, el siguiente paso es **invocar writing-plans** sobre este spec. El plan
debe descomponer las 9 fases (A.0–A.8) en PRs concretos con tests + checklist + criterio de
done.

---

## Decisión / aprobación

- [ ] Usuario revisa este sub-A design.
- [ ] Comments sobre arquitectura / fases / tools nuevos.
- [ ] Si OK → writing-plans.
- [ ] Si feedback → iterar.

# Sub-proyecto A — Contexto completo de cuenta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `userDigest` en un sistema de contexto en 4 capas (digest base enriquecido + read tools lazy + insights cache + screen semantic) que permita a Pick anticipar y desambiguar sin tool calls innecesarios.

**Architecture:** Layer 1 (digest base que entra en system prompt cada turno) reads desde Firestore + lee Layer 3 cache. Layer 2 (5 nuevos read tools) on-demand. Layer 3 (cache `pickInsights/{date}` workspace-wide con invalidación por triggers Firestore). Layer 4 (screen semantic computado en frontend, passthrough al backend).

**Tech Stack:** TypeScript + Firebase Cloud Functions v2 + Firestore Admin + Vitest + React 19 + Firestore rules. No nuevos SDKs externos.

**Spec:** `docs/superpowers/specs/2026-05-13-sub-proyecto-A-contexto-completo-design.md`

**PR breakdown (7 PRs):**

| PR  | Fases     | Foco                                             | Risk |
| --- | --------- | ------------------------------------------------ | ---- |
| 1   | A.0       | Instrument baseline (Langfuse counters)          | low  |
| 2   | A.1       | Refactor `userDigest.ts` → split por dominio     | low  |
| 3   | A.2 + A.3 | Enriched fields + scoping role-aware (bug fix)   | med  |
| 4   | A.4       | Layer 3 — insights cache + invalidation triggers | high |
| 5   | A.5       | Layer 4 — screen semantic (frontend + types)     | med  |
| 6   | A.6       | Layer 2 — 5 new read tools                       | low  |
| 7   | A.7 + A.8 | Eval cases + CLAUDE.md docs                      | low  |

---

## File Structure

### Backend (functions/)

```
functions/src/ai/
  userDigest.ts                # Orquestador + tipo UserDigest + digestToPromptText (slim post-refactor)
  digest/
    teamsDigest.ts             # NEW — build teams section (scoped)
    calendarDigest.ts          # NEW — build upcomingSessions + recentPastSessions
    bracketsDigest.ts          # NEW — build activeBrackets section
    pendingActions.ts          # NEW — derives pending actions from cache
    anomalies.ts               # NEW — derives anomalies from cache
    insightsCache.ts           # NEW — get/set/invalidate pickInsights/{date}
    insightsCompute.ts         # NEW — heavy compute for cache (used by insightsCache)
    types.ts                   # NEW — UserDigest, PickInsights, ScreenSemantic types
  tools/
    readTools.ts               # MODIFY — split a queries.ts + aggregates.ts si >500 LOC
    readTools/
      queries.ts               # NEW (post-split) — list_*, get_* existentes
      aggregates.ts            # NEW — 5 nuevos tools (get_recent_results, etc.)
  triggers/
    invalidatePickInsights.ts  # NEW — Firestore trigger onWrite que invalida cache
  __tests__/
    userDigest.test.ts         # MODIFY — expand para cubrir todas las capas + scoping
    digest/
      teamsDigest.test.ts      # NEW
      calendarDigest.test.ts   # NEW
      bracketsDigest.test.ts   # NEW
      pendingActions.test.ts   # NEW
      anomalies.test.ts        # NEW
      insightsCache.test.ts    # NEW
    tools/
      aggregates.test.ts       # NEW
    triggers/
      invalidatePickInsights.test.ts  # NEW
```

### Frontend (src/)

```
src/
  contexts/
    ScreenContextProvider.jsx  # MODIFY — añadir prop `semantic` opcional
  screens/semantic/
    getScreenSemantic.js       # NEW — helper genérico + dispatcher por surface
    teamDetail.semantic.js     # NEW
    calendar.semantic.js       # NEW
    bracket.semantic.js        # NEW
    asistencia.semantic.js     # NEW
    informeJugador.semantic.js # NEW
  screens/
    TeamDetailScreen.jsx       # MODIFY — wire getScreenSemantic
    CalendarioScreen.jsx       # MODIFY — wire getScreenSemantic
    BracketScreen.jsx          # MODIFY — wire getScreenSemantic
    AsistenciaScreen.jsx       # MODIFY — wire getScreenSemantic
    InformeJugadorScreen.jsx   # MODIFY — wire getScreenSemantic
```

### Firestore rules

```
firestore.rules                # MODIFY — añadir reglas pickInsights/{date}
```

### Tests

Vitest (root + functions/), 100% del nuevo código cubierto con tests unitarios. Tests E2E manuales documentados en CLAUDE.md.

---

## PR 1 — A.0: Instrument baseline (Langfuse counters)

**Goal:** Antes de cambiar nada, instrumentar contadores que medirán el impacto del programa (digest size, build time, tool call patterns). Sin esto, no sabemos si la apuesta funciona.

**Spec ref:** Sección "Eval cases / Métricas a trackear" del sub-A design. Master spec "Métricas de éxito".

**Files:**

- Modify: `functions/src/ai/userDigest.ts` (add timing + size scoring)
- Modify: `functions/src/ai/agents/orchestratorAgent.ts` (add fallback rate score)
- Modify: `functions/src/ai/__tests__/userDigest.test.ts` (assert scoring calls)

### Task 1.1: Add digest_build_ms + digest_size_tokens scoring

**Files:**

- Modify: `functions/src/ai/userDigest.ts` (después de la línea 121, antes del return)
- Test: `functions/src/ai/__tests__/userDigest.test.ts` (nuevo test)

- [ ] **Step 1: Write failing test**

```ts
// functions/src/ai/__tests__/userDigest.test.ts
import { buildUserDigest, digestToPromptText } from '../userDigest';

it('logs digest_build_ms and digest_size_tokens via observability when provided', async () => {
  const logScore = vi.fn();
  const fakeObs = { logScore } as any;
  const db = makeMockDb({
    /* minimal: empty teams, empty brackets, etc. */
  });

  const digest = await buildUserDigest({
    db,
    userId: 'u1',
    wsId: 'ws1',
    appId: 'app1',
    clientDate: '2026-05-13',
    observability: fakeObs,
    traceId: 'trace-123',
  });

  expect(logScore).toHaveBeenCalledWith('trace-123', expect.objectContaining({ name: 'digest_build_ms' }));
  expect(logScore).toHaveBeenCalledWith('trace-123', expect.objectContaining({ name: 'digest_size_tokens' }));
});
```

- [ ] **Step 2: Run test, expect fail**

```bash
cd functions && npm test -- userDigest --run
```

Expected: FAIL — `buildUserDigest` no acepta `observability` ni `traceId`.

- [ ] **Step 3: Add optional observability + traceId to buildUserDigest signature**

```ts
// functions/src/ai/userDigest.ts (modify signature)
export async function buildUserDigest(deps: {
  db: Firestore;
  userId: string;
  wsId: string;
  appId: string;
  clientDate?: string;
  observability?: { logScore: (traceId: string, score: { name: string; value: number; comment?: string }) => void };
  traceId?: string;
}): Promise<UserDigest> {
  const t0 = Date.now();
  // ... existing logic ...

  const result: UserDigest = {
    /* existing */
  };

  if (deps.observability && deps.traceId) {
    deps.observability.logScore(deps.traceId, {
      name: 'digest_build_ms',
      value: Date.now() - t0,
    });
    deps.observability.logScore(deps.traceId, {
      name: 'digest_size_tokens',
      // Aproximación: 1 token ≈ 4 chars
      value: Math.ceil(digestToPromptText(result).length / 4),
    });
  }

  return result;
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
cd functions && npm test -- userDigest --run
```

Expected: PASS.

- [ ] **Step 5: Wire from runAgent callable**

```ts
// functions/src/index.ts — donde se invoca buildUserDigest
const digest = await buildUserDigest({
  db,
  userId: uid,
  wsId,
  appId,
  clientDate,
  observability, // ya existe
  traceId, // ya existe (createTrace().id)
});
```

- [ ] **Step 6: Commit**

```bash
git add functions/src/ai/userDigest.ts functions/src/ai/__tests__/userDigest.test.ts functions/src/index.ts
git commit -m "feat(ai): instrument digest_build_ms + digest_size_tokens scoring"
```

### Task 1.2: Track fallback_message_emitted + tool_call_per_turn

**Files:**

- Modify: `functions/src/ai/agents/orchestratorAgent.ts` (after the "He terminado" / "He dejado un acceso directo" blocks)
- Test: `functions/src/ai/__tests__/orchestrator.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// orchestrator.test.ts
it("logs fallback_message_emitted when orchestrator emits 'He terminado'", async () => {
  const logScore = vi.fn();
  // ... arrange a run where LLM returns no text + no tools so safety block triggers
  // ... assert logScore called with name "fallback_message_emitted", value 1
});

it('logs tool_calls_per_turn distribution', async () => {
  // ... arrange a run with 3 tool calls
  // ... assert tool_calls_per_turn=3 logged
});
```

- [ ] **Step 2: Run tests, expect fail**

```bash
cd functions && npm test -- orchestrator --run
```

- [ ] **Step 3: Add scoring**

```ts
// orchestratorAgent.ts, near existing scoring (line ~312)
// After existing tool_calls + iteration_count, add:
if (traceId) {
  const fallbackEmitted = blocks.some(
    (b) => b.type === 'text' && (b.markdown === 'He terminado.' || b.markdown === 'He dejado un acceso directo abajo.'),
  );
  if (fallbackEmitted) {
    this.deps.observability.logScore(traceId, { name: 'fallback_message_emitted', value: 1 });
  }
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
cd functions && npm test -- orchestrator --run
```

- [ ] **Step 5: Commit**

```bash
git add functions/src/ai/agents/orchestratorAgent.ts functions/src/ai/__tests__/orchestrator.test.ts
git commit -m "feat(ai): track fallback_message_emitted + leverage tool_calls existing score"
```

### Task 1.3: Open PR

- [ ] **Step 1: Branch + push + PR**

```bash
git checkout -b sub-a-instrumentation
git push -u origin sub-a-instrumentation
gh pr create --title "feat(ai): instrument digest + orchestrator counters (sub-A.0)" --body "..."
```

PR #35 (spec + plan) queda separado de cualquier código. PR1 inicia el split en branches cortas — una por sub-fase para review fácil.

---

## PR 2 — A.1: Refactor `userDigest.ts` → split por dominio

**Goal:** Sin cambio funcional — sólo split de `userDigest.ts` en módulos por dominio. Reduce el archivo de 165 LOC a <80 y prepara para los cambios de A.2.

**Spec ref:** Sección "Componentes afectados → Backend" del sub-A design.

**Files:**

- Create: `functions/src/ai/digest/types.ts`
- Create: `functions/src/ai/digest/teamsDigest.ts`
- Create: `functions/src/ai/digest/calendarDigest.ts`
- Create: `functions/src/ai/digest/bracketsDigest.ts`
- Modify: `functions/src/ai/userDigest.ts` (slim down, re-export)
- Create: `functions/src/ai/__tests__/digest/teamsDigest.test.ts`
- Create: `functions/src/ai/__tests__/digest/calendarDigest.test.ts`
- Create: `functions/src/ai/__tests__/digest/bracketsDigest.test.ts`

### Task 2.1: Extract types

- [ ] **Step 1: Write the new file**

```ts
// functions/src/ai/digest/types.ts
import { MemoryType } from '../tools/memoryTools';

export interface DigestTeam {
  id: string;
  name: string;
  categoria?: string;
  nivel?: string;
  memberCount: number;
}

export interface DigestBracket {
  id: string;
  name: string;
  teamId?: string | null;
}

export interface DigestSession {
  id: string;
  fecha: string;
  horaInicio?: string;
  tipo?: string;
  teamName?: string;
  rival?: string;
  lugar?: string;
}

export interface DigestMemory {
  id: string;
  type: MemoryType;
  content: string;
}

export interface UserDigest {
  teams: DigestTeam[];
  activeBrackets: DigestBracket[];
  upcomingSessions: DigestSession[];
  preferences: { proactivityMode?: string; defaultTrainingDuration?: number };
  memories: DigestMemory[];
  todayISO: string;
}
```

- [ ] **Step 2: Update userDigest.ts to re-export and use these**

```ts
// functions/src/ai/userDigest.ts (top)
import type { UserDigest } from './digest/types';
export type { UserDigest } from './digest/types';
```

- [ ] **Step 3: Run all tests**

```bash
cd functions && npm test --run
```

Expected: PASS (no behavior change).

- [ ] **Step 4: Commit**

```bash
git add functions/src/ai/digest/types.ts functions/src/ai/userDigest.ts
git commit -m "refactor(ai): extract UserDigest types to digest/types.ts"
```

### Task 2.2: Extract teamsDigest builder

- [ ] **Step 1: Write test**

```ts
// functions/src/ai/__tests__/digest/teamsDigest.test.ts
import { buildTeamsDigest } from '../../digest/teamsDigest';

it('builds teams with id, name (formatted), categoria, nivel, memberCount', async () => {
  const db = makeMockDb({
    teams: [{ id: 't1', teamName: 'Juniors', categoria: 'junior', nivel: 'B', letra: 'B' }],
    members: { t1: 12 }, // count via mock
  });
  const result = await buildTeamsDigest({ db, appId: 'a', wsId: 'w' });
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ id: 't1', categoria: 'junior', nivel: 'B', memberCount: 12 });
  expect(result[0].name).toMatch(/Juniors/);
});
```

- [ ] **Step 2: Run, expect fail**

```bash
cd functions && npm test -- teamsDigest --run
```

- [ ] **Step 3: Implement**

```ts
// functions/src/ai/digest/teamsDigest.ts
import type { Firestore } from 'firebase-admin/firestore';
import { formatTeamDisplayName } from '../../shared/teamDomain';
import type { DigestTeam } from './types';

export async function buildTeamsDigest(deps: { db: Firestore; appId: string; wsId: string }): Promise<DigestTeam[]> {
  const base = deps.db.collection('artifacts').doc(deps.appId).collection('workspaces').doc(deps.wsId);
  const teamsSnap = await base.collection('teams').get();
  return Promise.all(
    teamsSnap.docs.map(async (d) => {
      const memSnap = await d.ref.collection('members').count().get();
      const data = d.data();
      return {
        id: d.id,
        name:
          formatTeamDisplayName({
            teamName: (data.teamName as string | undefined) || null,
            categoria: (data.categoria as string | undefined) || null,
            año: (data['año'] as string | undefined) || null,
            letra: (data.letra as string | undefined) || null,
            genero: (data.genero as string | undefined) || null,
            division: (data.division as string | undefined) || null,
          }) || '(sin nombre)',
        categoria: data.categoria as string | undefined,
        nivel: data.nivel as string | undefined,
        memberCount: memSnap.data().count,
      };
    }),
  );
}
```

- [ ] **Step 4: Replace inline teams build in userDigest.ts**

```ts
// userDigest.ts
import { buildTeamsDigest } from './digest/teamsDigest';

// inside buildUserDigest, replace the teams Promise.all block with:
const teams = await buildTeamsDigest({ db, appId, wsId });
```

- [ ] **Step 5: Run all tests**

```bash
cd functions && npm test --run
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add functions/src/ai/digest/teamsDigest.ts functions/src/ai/__tests__/digest/teamsDigest.test.ts functions/src/ai/userDigest.ts
git commit -m "refactor(ai): extract teams build to digest/teamsDigest.ts"
```

### Task 2.3: Extract calendarDigest builder

Repeat the pattern of Task 2.2 for upcomingSessions:

- Create `functions/src/ai/digest/calendarDigest.ts` with `buildCalendarDigest(deps): Promise<DigestSession[]>` (window: today → +7d, max 15, ordenado fecha asc).
- Test in `__tests__/digest/calendarDigest.test.ts` covers: empty result, ordering, max-15 cap, joining team name from teams.
- Replace inline in `userDigest.ts`.
- Commit: `refactor(ai): extract calendar build to digest/calendarDigest.ts`

### Task 2.4: Extract bracketsDigest builder

Same pattern:

- Create `functions/src/ai/digest/bracketsDigest.ts` with `buildBracketsDigest(deps): Promise<DigestBracket[]>`.
- Test covers: empty, with teamId, without teamId (legacy).
- Replace inline in `userDigest.ts`.
- Commit: `refactor(ai): extract brackets build to digest/bracketsDigest.ts`

### Task 2.5: Verify userDigest.ts is slim

- [ ] **Step 1: Run `wc -l functions/src/ai/userDigest.ts`**

Expected: <80 LOC.

- [ ] **Step 2: Run all tests + lint**

```bash
cd functions && npm test --run && npm run lint --prefix .. -- functions/src/ai
```

- [ ] **Step 3: Open PR (separate from spec PR for clean review)**

```bash
git checkout -b sub-a-refactor-digest
git push -u origin sub-a-refactor-digest
gh pr create --title "refactor(ai): split userDigest by domain (sub-A foundation)" --body "..."
```

---

## PR 3 — A.2 + A.3: Enriched fields + scoping role-aware

**Goal:** Enriquecer el digest con campos nuevos (rosterSnapshot, lastResult, nextSession, currentRound, recentPastSessions) y arreglar el bug de scoping (assistants ven todos los teams hoy).

**Spec ref:** Layer 1 + Scoping del sub-A design.

**Files:**

- Modify: `functions/src/ai/digest/types.ts` (add new fields to UserDigest)
- Modify: `functions/src/ai/digest/teamsDigest.ts` (rosterSnapshot, lastResult, nextSession)
- Modify: `functions/src/ai/digest/calendarDigest.ts` (recentPastSessions)
- Modify: `functions/src/ai/digest/bracketsDigest.ts` (currentRound, nextMatch, pendingScores)
- Modify: `functions/src/ai/userDigest.ts` (resolve role + assignedTeamIds, filter)
- Modify: `functions/src/ai/__tests__/userDigest.test.ts` (scoping tests)

### Task 3.1: Extend UserDigest type

- [ ] **Step 1: Update types.ts to match spec Layer 1 interface**

```ts
// functions/src/ai/digest/types.ts — append fields per spec interface UserDigest
// (See spec lines 126–195 for full structure)

export type UserRole = 'owner' | 'coach' | 'assistant';

export interface RosterPlayer {
  id: string;
  nombre: string;
  dorsal?: number;
  posicion?: string;
}

export interface MatchResult {
  ourScore: number;
  theirScore: number;
}

export interface DigestTeam {
  id: string;
  name: string;
  categoria?: string;
  nivel?: string;
  memberCount: number;
  rosterSnapshot?: RosterPlayer[];
  nextSession?: { fecha: string; tipo: string; rival?: string };
  lastResult?: { fecha: string; ourScore: number; theirScore: number; rival: string };
}

export interface DigestBracket {
  id: string;
  name: string;
  teamId?: string | null;
  currentRound?: string;
  nextMatch?: { id: string; teamA: string; teamB: string; scheduled?: string };
  pendingScores?: number;
}

export interface DigestSession {
  id: string;
  fecha: string;
  horaInicio?: string;
  tipo?: string;
  teamName?: string;
  rival?: string;
  lugar?: string;
  result?: MatchResult;
}

export interface ScreenSemantic {
  surface: string;
  label: string;
  referableIds?: Record<string, string>;
}

export interface PendingAction {
  sessionId: string;
  fecha: string;
  teamName?: string;
  rival?: string;
}

export interface PendingPlayerReports {
  teamId: string;
  teamName: string;
  missingForPlayerCount: number;
}

export interface PendingActions {
  convocatorias: PendingAction[];
  analyses: PendingAction[];
  scoutings: PendingAction[];
  playerReports: PendingPlayerReports[];
}

export interface Anomaly {
  kind: 'attendance' | 'training_gap' | 'cuaderno_gap' | 'bracket_stale';
  summary: string;
  severity: 'info' | 'warn';
}

export interface UserDigest {
  todayISO: string;
  todayLocalDayOfWeek: string;
  workspace: { id: string; name: string; type: 'personal' | 'club'; userRole: UserRole };
  teams: DigestTeam[];
  activeBrackets: DigestBracket[];
  upcomingSessions: DigestSession[];
  recentPastSessions: DigestSession[];
  pendingActions: PendingActions;
  anomalies: Anomaly[];
  preferences: { proactivityMode?: string; defaultTrainingDuration?: number };
  memories: { id: string; type: string; content: string }[];
  screenSemantic?: ScreenSemantic;
}
```

- [ ] **Step 2: tsc must pass (run build in functions/)**

```bash
cd functions && npm run build
```

If there are errors (legacy code expecting old type), fix them inline — but it should compile because the new fields are all optional (rosterSnapshot, lastResult, etc.) or filled with empty defaults.

- [ ] **Step 3: Commit**

```bash
git add functions/src/ai/digest/types.ts
git commit -m "feat(ai): extend UserDigest type with enriched + scoped fields"
```

### Task 3.2: Add rosterSnapshot + nextSession + lastResult to teamsDigest

- [ ] **Step 1: Write tests**

```ts
// teamsDigest.test.ts — append tests

it('includes rosterSnapshot with first 12 players sorted by dorsal', async () => {
  const db = makeMockDb({
    teams: [{ id: 't1', teamName: 'Juniors' }],
    teamMembers: {
      t1: [
        { id: 'p1', nombre: 'Ana', dorsal: 4 },
        { id: 'p2', nombre: 'Bea', dorsal: 5 },
        // ... 15 players
      ],
    },
  });
  const result = await buildTeamsDigest({ db, appId: 'a', wsId: 'w' });
  expect(result[0].rosterSnapshot).toHaveLength(12);
  expect(result[0].rosterSnapshot![0].dorsal).toBe(4);
});

it('includes nextSession from upcoming calendar', async () => {
  // ... arrange team + 1 upcoming session
  // ... expect result[0].nextSession.fecha matches
});

it('includes lastResult from past session with result', async () => {
  // ... arrange past session con result field
  // ... expect lastResult.ourScore/theirScore/rival
});
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement** — augment `buildTeamsDigest` to:

```ts
// teamsDigest.ts
export async function buildTeamsDigest(deps: {
  db: Firestore;
  appId: string;
  wsId: string;
  upcomingSessionsByTeam?: Map<string, DigestSession[]>; // optional, passed by orquestador
  pastSessionsByTeam?: Map<string, DigestSession[]>; // optional
}): Promise<DigestTeam[]> {
  // ... existing reads ...
  // For each team:
  //   - rosterSnapshot: read team.members ordered by dorsal asc, take first 12
  //   - nextSession: from upcomingSessionsByTeam.get(t.id)?.[0] if provided
  //   - lastResult: from pastSessionsByTeam.get(t.id)?.find(s => s.result)
}
```

The orquestador (userDigest.ts) computes upcomingSessions + recentPastSessions _first_ then passes the per-team groupings into buildTeamsDigest. This avoids re-querying.

- [ ] **Step 4: Run tests, expect pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ai): enrich teamsDigest with roster + next session + last result"
```

### Task 3.3: Add recentPastSessions to calendarDigest

- [ ] **Step 1: Test**

```ts
it('includes recentPastSessions in last 7 days with result', async () => {
  // arrange past sessions and results
  // expect recentPastSessions length, ordering desc, result field populated
});
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement**

```ts
// calendarDigest.ts
export async function buildCalendarDigest(deps): Promise<{
  upcomingSessions: DigestSession[];
  recentPastSessions: DigestSession[];
}> {
  // Reads with windows:
  // - upcoming: where fecha >= todayISO AND fecha <= today+7d  (existing)
  // - pastRecent: where fecha < todayISO AND fecha >= today-7d  (NEW)
  //   - if pastRecent.length < 3, widen to today-14d
  // Both ordered, capped at 15.
  // For pastRecent, also try to load result from session.result subfield or related doc.
}
```

- [ ] **Step 4: Run tests, expect pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ai): add recentPastSessions window (last 7-14d) to calendarDigest"
```

### Task 3.4: Add currentRound + nextMatch + pendingScores to bracketsDigest

- [ ] **Step 1: Tests**

```ts
it("derives currentRound from bracket.state — round with first un-decided match", async () => {
  // arrange a bracket with R1 all decided, R2 partially undecided
  // expect currentRound === "R2" o "Semis" según naming
});
it("includes pendingScores count", async () => { ... });
it("includes nextMatch (first match in currentRound without winner)", async () => { ... });
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement** in `bracketsDigest.ts` — use existing `bracketEngine.js` utilities if possible (but careful: it's in `src/`, not `functions/`; may need to port a minimal helper).

```ts
// bracketsDigest.ts
function deriveBracketState(bracketData: {
  rootId?: string;
  state?: Record<string, BracketMatch>;
}): { currentRound?: string; nextMatch?: ...; pendingScores?: number } {
  // Walk the tree from rootId backwards: find the deepest round that still has matches without winner
  // ...
}
```

- [ ] **Step 4: Run tests, expect pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ai): enrich bracketsDigest with current round + next match + pending scores"
```

### Task 3.5: Resolve role + assignedTeamIds in buildUserDigest

- [ ] **Step 1: Test scoping paths**

```ts
// userDigest.test.ts — add tests for the 3 paths
it("(owner) returns all teams of workspace", async () => { ... });
it("(coach) returns all teams of workspace", async () => { ... });
it("(assistant with assignedTeamIds=[t1, t2]) returns only t1, t2", async () => { ... });
it("(assistant without assignedTeamIds) returns no teams", async () => { ... });
it("(assistant) filters brackets by teamId in assignedTeamIds (excludes null teamId)", async () => { ... });
it("(assistant) filters upcomingSessions + recentPastSessions by teamId", async () => { ... });
```

- [ ] **Step 2: Run, expect fail (current code ignores role)**

- [ ] **Step 3: Implement role resolution in buildUserDigest**

```ts
// userDigest.ts (add at top of buildUserDigest)
const memberSnap = await base.collection('members').doc(userId).get();
const memberData = memberSnap.exists ? memberSnap.data() || {} : {};
const userRole = (memberData.role as UserRole) || 'assistant';
const assignedTeamIds: string[] | null =
  userRole === 'assistant' ? (Array.isArray(memberData.assignedTeamIds) ? memberData.assignedTeamIds : []) : null;

const wsSnap = await base.get();
const wsData = wsSnap.data() || {};

// after building teams/brackets/sessions, filter:
const scopedTeams = assignedTeamIds === null ? teams : teams.filter((t) => assignedTeamIds.includes(t.id));
// ... similar for brackets (filter by teamId in assignedTeamIds, exclude null teamId for assistant)
// ... similar for sessions

return {
  todayISO,
  todayLocalDayOfWeek: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][
    new Date(todayISO).getDay()
  ],
  workspace: {
    id: wsId,
    name: (wsData.name as string) || wsId,
    type: (wsData.type as 'personal' | 'club') || 'personal',
    userRole,
  },
  teams: scopedTeams,
  activeBrackets: scopedBrackets,
  upcomingSessions: scopedUpcoming,
  recentPastSessions: scopedPast,
  pendingActions: { convocatorias: [], analyses: [], scoutings: [], playerReports: [] }, // L3 cache fills these in PR4
  anomalies: [], // L3 cache fills in PR4
  preferences,
  memories,
};
```

- [ ] **Step 4: Run scoping tests, expect pass**

- [ ] **Step 5: Run ALL existing tests** — verify no regression

```bash
cd functions && npm test --run
```

- [ ] **Step 6: Commit**

```bash
git commit -m "fix(ai): scope userDigest by role + assignedTeamIds (sub-A.3)"
```

### Task 3.6: Update digestToPromptText for new fields

- [ ] **Step 1: Add render logic for new fields (rosterSnapshot, lastResult, nextSession per team; currentRound + nextMatch per bracket; recentPastSessions section; workspace section)**

- [ ] **Step 2: Tests assert prompt contains key sections**

- [ ] **Step 3: Run + commit**

```bash
git commit -m "feat(ai): render new digest fields in digestToPromptText"
```

### Task 3.7: Open PR

```bash
git push origin sub-a-enriched-scoping
gh pr create --title "feat(ai): enrich UserDigest fields + role-aware scoping (sub-A.2 + A.3)" --body "..."
```

---

## PR 4 — A.4: Insights cache (Layer 3) + invalidation triggers

**Goal:** Pre-computar y cachear pendingActions + anomalies en `pickInsights/{date}`. Invalidación por Firestore triggers cuando datos relevantes cambian.

**Spec ref:** Layer 3 del sub-A design.

**Files:**

- Create: `functions/src/ai/digest/insightsCompute.ts`
- Create: `functions/src/ai/digest/insightsCache.ts`
- Create: `functions/src/ai/digest/pendingActions.ts`
- Create: `functions/src/ai/digest/anomalies.ts`
- Create: `functions/src/ai/triggers/invalidatePickInsights.ts`
- Modify: `functions/src/ai/userDigest.ts` (consume cache)
- Modify: `functions/src/index.ts` (export trigger)
- Modify: `firestore.rules` (allow read pickInsights/{date} for members, deny client writes)
- Tests: `__tests__/digest/insightsCache.test.ts`, `pendingActions.test.ts`, `anomalies.test.ts`, `triggers/invalidatePickInsights.test.ts`

### Task 4.1: Implement pendingActions compute

- [ ] **Step 1: Test**

```ts
// __tests__/digest/pendingActions.test.ts
import { computePendingActions } from "../../digest/pendingActions";

it("flags convocatorias for partidos próximos 14d without convocatoria", async () => {
  // arrange: 2 partidos próximos, one has convocatoria, other doesn't
  // expect: result.convocatorias has only the one without
});
it("flags analyses for partidos jugados últimos 21d without analysis", async () => { ... });
it("flags scoutings for partidos próximos 14d without scouting de rival", async () => { ... });
it("flags playerReports per team where some players missing informe del trimestre actual", async () => { ... });
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement**

```ts
// functions/src/ai/digest/pendingActions.ts
import type { Firestore } from "firebase-admin/firestore";
import type { PendingActions } from "./types";

export async function computePendingActions(deps: {
  db: Firestore;
  appId: string;
  wsId: string;
  todayISO: string;
}): Promise<PendingActions> {
  const base = deps.db.collection("artifacts").doc(deps.appId).collection("workspaces").doc(deps.wsId);
  const today = deps.todayISO;
  const plus14 = isoOffset(today, 14);
  const minus21 = isoOffset(today, -21);

  // 1. Future partidos en 14d
  const futurePartidosSnap = await base.collection("calendarSessions")
    .where("fecha", ">=", today).where("fecha", "<=", plus14).where("tipo", "==", "partido").get();

  // 2. For each: check if convocatoria exists (sub-collection? field on doc? mirar implementación actual)
  //    (Resolve durante implementación — el spec asume modelo claro)
  const convocatorias: PendingAction[] = [];
  const scoutings: PendingAction[] = [];
  for (const sessDoc of futurePartidosSnap.docs) {
    const data = sessDoc.data();
    if (!data.convocatoriaSent) {
      convocatorias.push({ sessionId: sessDoc.id, fecha: data.fecha, teamName: ..., rival: data.rival });
    }
    if (!data.scoutingId) {
      scoutings.push({ sessionId: sessDoc.id, fecha: data.fecha, teamName: ..., rival: data.rival });
    }
  }

  // 3. Past partidos últimos 21d sin análisis
  const pastPartidosSnap = await base.collection("calendarSessions")
    .where("fecha", ">=", minus21).where("fecha", "<", today).where("tipo", "==", "partido").get();
  const analyses: PendingAction[] = [];
  for (const sessDoc of pastPartidosSnap.docs) {
    const data = sessDoc.data();
    if (!data.analysisId) {
      analyses.push({ sessionId: sessDoc.id, fecha: data.fecha, teamName: ..., rival: data.rival });
    }
  }

  // 4. Player reports por team (jugadores sin informe en trimestre actual)
  const playerReports: PendingPlayerReports[] = [];
  const teamsSnap = await base.collection("teams").get();
  const trimestreStart = startOfCurrentTrimester(today);
  for (const teamDoc of teamsSnap.docs) {
    const membersSnap = await teamDoc.ref.collection("members").get();
    const reportsSnap = await teamDoc.ref.collection("playerReports")
      .where("fecha", ">=", trimestreStart).get();
    const playersWithReport = new Set(reportsSnap.docs.map((d) => d.data().playerId));
    const missing = membersSnap.docs.filter((m) => !playersWithReport.has(m.id)).length;
    if (missing > 0) {
      playerReports.push({ teamId: teamDoc.id, teamName: ..., missingForPlayerCount: missing });
    }
  }

  return { convocatorias, analyses, scoutings, playerReports };
}

function isoOffset(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfCurrentTrimester(todayISO: string): string {
  // Trimestre escolar: sep-dic, ene-mar, abr-jun. Ajustar según convention.
  // Resolución durante implementación.
}
```

- [ ] **Step 4: Run tests, expect pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ai): compute pendingActions (convocatorias/analyses/scoutings/playerReports)"
```

### Task 4.2: Implement anomalies compute

- [ ] **Step 1: Tests**

```ts
it("flags attendance anomaly when player missed 3+ trainings last 4 weeks", async () => { ... });
it("flags training_gap if no training session in last 14 days for a team", async () => { ... });
it("flags cuaderno_gap if no cuaderno note in last 14 days for a team", async () => { ... });
it("flags bracket_stale if active bracket has no score change in 14 days", async () => { ... });
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement** in `anomalies.ts`:

```ts
export async function computeAnomalies(deps: { db; appId; wsId; todayISO }): Promise<Anomaly[]> {
  // Compute the 4 flagged kinds + cap at 10 anomalies (top by severity then recency).
}
```

- [ ] **Step 4: Test pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ai): compute anomalies (attendance, gaps, bracket stale)"
```

### Task 4.3: Implement insightsCache (get/set/invalidate)

- [ ] **Step 1: Tests**

```ts
// __tests__/digest/insightsCache.test.ts
import { getOrComputeInsights, invalidateInsights } from "../../digest/insightsCache";

it("computes fresh and persists if no cache exists for today", async () => { ... });
it("returns cached if fresh (computedAt < 6h ago, not invalidated)", async () => { ... });
it("recomputes if cache.invalidated === true", async () => { ... });
it("recomputes if cache.computedAt > 6h ago", async () => { ... });
it("invalidateInsights writes invalidated=true to today's doc", async () => { ... });
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement**

```ts
// functions/src/ai/digest/insightsCache.ts
import type { Firestore } from 'firebase-admin/firestore';
import { computePendingActions } from './pendingActions';
import { computeAnomalies } from './anomalies';
import type { PendingActions, Anomaly } from './types';

interface PickInsightsDoc {
  computedAt: FirebaseFirestore.Timestamp;
  invalidated?: boolean;
  pendingActions: PendingActions;
  anomalies: Anomaly[];
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export async function getOrComputeInsights(deps: {
  db: Firestore;
  appId: string;
  wsId: string;
  todayISO: string;
}): Promise<{ pendingActions: PendingActions; anomalies: Anomaly[] }> {
  const ref = deps.db
    .collection('artifacts')
    .doc(deps.appId)
    .collection('workspaces')
    .doc(deps.wsId)
    .collection('pickInsights')
    .doc(deps.todayISO);
  const snap = await ref.get();
  if (snap.exists) {
    const data = snap.data() as PickInsightsDoc;
    const ageMs = Date.now() - data.computedAt.toMillis();
    const fresh = !data.invalidated && ageMs < CACHE_TTL_MS;
    if (fresh) {
      return { pendingActions: data.pendingActions, anomalies: data.anomalies };
    }
  }
  // Recompute
  const [pendingActions, anomalies] = await Promise.all([computePendingActions(deps), computeAnomalies(deps)]);
  await ref.set({
    computedAt: FirebaseFirestore.Timestamp.now(),
    invalidated: false,
    pendingActions,
    anomalies,
  });
  return { pendingActions, anomalies };
}

export async function invalidateInsights(deps: {
  db: Firestore;
  appId: string;
  wsId: string;
  todayISO: string;
}): Promise<void> {
  const ref = deps.db
    .collection('artifacts')
    .doc(deps.appId)
    .collection('workspaces')
    .doc(deps.wsId)
    .collection('pickInsights')
    .doc(deps.todayISO);
  await ref.set({ invalidated: true }, { merge: true });
}
```

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ai): insightsCache get/set/invalidate with TTL 6h"
```

### Task 4.4: Wire insights into buildUserDigest

- [ ] **Step 1: Update userDigest.ts** to call `getOrComputeInsights` and filter by `assignedTeamIds`:

```ts
// userDigest.ts (inside buildUserDigest, after teams/sessions are built and scoped)
const insights = await getOrComputeInsights({ db, appId, wsId, todayISO });
const scopedPending = filterPendingActionsByScope(insights.pendingActions, assignedTeamIds, teamIdByName);
const scopedAnomalies = filterAnomaliesByScope(insights.anomalies, assignedTeamIds);
return { ..., pendingActions: scopedPending, anomalies: scopedAnomalies };
```

- [ ] **Step 2: Implement `filterPendingActionsByScope` + `filterAnomaliesByScope`** in `userDigest.ts` (or a new helper).

- [ ] **Step 3: Tests** — assert the digest pendingActions list is filtered for assistants.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ai): consume pickInsights cache in buildUserDigest with scope filter"
```

### Task 4.5: Firestore trigger to invalidate cache

- [ ] **Step 1: Test**

```ts
// __tests__/triggers/invalidatePickInsights.test.ts
import { triggerFn } from "../../triggers/invalidatePickInsights";

it("invalidates today's insights when a calendarSession is created", async () => { ... });
it("invalidates when a scouting doc is created/updated", async () => { ... });
it("invalidates when an analysis doc is created/updated", async () => { ... });
it("invalidates when a playerReport is created", async () => { ... });
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement** as multiple v2 Firestore triggers (one per collection):

```ts
// functions/src/ai/triggers/invalidatePickInsights.ts
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { admin } from '../../shared/admin'; // o equivalente
import { invalidateInsights } from '../digest/insightsCache';

const region = 'europe-west1';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const invalidateOnCalendarSession = onDocumentWritten(
  { region, document: 'artifacts/{appId}/workspaces/{wsId}/calendarSessions/{id}' },
  async (event) => {
    const { appId, wsId } = event.params;
    await invalidateInsights({ db: admin().firestore(), appId, wsId, todayISO: todayISO() });
  },
);

// Similar for: scouting, analysis, playerReports — paths per spec model
```

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Export from index.ts**

```ts
// functions/src/index.ts
export {
  invalidateOnCalendarSession,
  invalidateOnScouting,
  invalidateOnAnalysis,
  invalidateOnPlayerReport,
} from './ai/triggers/invalidatePickInsights';
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(ai): Firestore triggers to invalidate pickInsights on relevant writes"
```

### Task 4.6: Firestore rules for pickInsights

- [ ] **Step 1: Update firestore.rules**

```
match /artifacts/{appId}/workspaces/{wsId}/pickInsights/{date} {
  allow read: if isMember(appId, wsId);
  allow write: if false;  // only backend writes via Admin SDK
}
```

- [ ] **Step 2: Test rules** (existing `firestore.rules.test.ts`)

```ts
it("workspace member can read pickInsights/{date}", async () => { ... });
it("non-member cannot read pickInsights/{date}", async () => { ... });
it("no client can write pickInsights/{date}", async () => { ... });
```

- [ ] **Step 3: Run rules tests**

```bash
npx vitest run firestore.rules.test.ts
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(rules): pickInsights/{date} read-by-members, no client writes"
```

### Task 4.7: Open PR

```bash
git checkout -b sub-a-insights-cache
git push -u origin sub-a-insights-cache
gh pr create --title "feat(ai): Layer 3 insights cache + Firestore invalidation triggers (sub-A.4)" --body "..."
```

---

## PR 5 — A.5: Screen semantic (Layer 4)

**Goal:** Frontend computa label semántico + referableIds; backend lo pasa al system prompt.

**Spec ref:** Layer 4 del sub-A design.

**Files:**

- Create: `src/screens/semantic/getScreenSemantic.js`
- Create: `src/screens/semantic/teamDetail.semantic.js`
- Create: `src/screens/semantic/calendar.semantic.js`
- Create: `src/screens/semantic/bracket.semantic.js`
- Create: `src/screens/semantic/asistencia.semantic.js`
- Create: `src/screens/semantic/informeJugador.semantic.js`
- Modify: `src/contexts/ScreenContextProvider.jsx` (allow `semantic` field)
- Modify: 5 screens to wire helpers
- Modify: `functions/src/ai/types.ts` (extend `ScreenContextData.semantic`)
- Modify: `functions/src/ai/userDigest.ts` (passthrough)

### Task 5.1: Define ScreenSemantic in backend types

```ts
// functions/src/ai/types.ts
export interface ScreenSemantic {
  surface: string;
  label: string;
  referableIds?: Record<string, string>;
}

export interface ScreenContextData {
  screen: string;
  route: string;
  entityType?: string;
  entityId?: string;
  data?: Record<string, unknown>;
  semantic?: ScreenSemantic; // NEW
}
```

- [ ] Commit: `feat(ai): extend ScreenContextData with optional semantic`

### Task 5.2: Render screenSemantic in digestToPromptText

- [ ] Test: render contains `screenSemantic.label` when present, omitted otherwise.
- [ ] Implementation.
- [ ] Commit: `feat(ai): render screenSemantic section in digest prompt`

### Task 5.3: Build the dispatcher helper (frontend)

- [ ] **Step 1: Create** `src/screens/semantic/getScreenSemantic.js`:

```js
import teamDetailSemantic from './teamDetail.semantic';
import calendarSemantic from './calendar.semantic';
import bracketSemantic from './bracket.semantic';
import asistenciaSemantic from './asistencia.semantic';
import informeSemantic from './informeJugador.semantic';

const REGISTRY = {
  'team-detail': teamDetailSemantic,
  calendar: calendarSemantic,
  'bracket-editor': bracketSemantic,
  asistencia: asistenciaSemantic,
  'informe-jugador': informeSemantic,
};

export function getScreenSemantic(surface, state) {
  const fn = REGISTRY[surface];
  return fn ? fn(state) : null;
}
```

- [ ] **Step 2: Test** with each surface using mock state.

- [ ] **Step 3: Commit**

### Task 5.4–5.8: Build per-screen helpers

Each helper:

- Tests verify referableIds keys + label format.
- Implementation reads team/session/etc data from state.

Example for team detail:

```js
// src/screens/semantic/teamDetail.semantic.js
export default function teamDetailSemantic({ team, members, nextSession }) {
  if (!team) return null;
  return {
    surface: 'team-detail',
    label: `Visualizando equipo ${team.name}, ${members?.length || 0} jugadores${nextSession ? `. Próximo: ${nextSession.fecha} vs ${nextSession.rival || '(local)'}` : ''}`,
    referableIds: {
      'este equipo': team.id,
      ...(nextSession?.id ? { 'este partido': nextSession.id, 'el próximo partido': nextSession.id } : {}),
    },
  };
}
```

- Commit per helper: `feat(pick): screen semantic for <surface>`

### Task 5.9: Wire ScreenContextProvider + screens

- [ ] Modify `ScreenContextProvider.jsx` to accept `semantic` in setScreenContext.
- [ ] Each of 5 screens calls `setScreenContext({ ..., semantic: getScreenSemantic(...) })`.
- [ ] Commit: `feat(pick): wire screen semantic from 5 screens to ScreenContext`

### Task 5.10: Pass semantic through callable to digest

- [ ] In `functions/src/index.ts` (runAgent callable), receive `screenContext.semantic` and pass to `buildUserDigest` as `screenSemantic` field — already covered by types extension.
- [ ] Test: digest output contains screenSemantic when passed.
- [ ] Commit: `feat(ai): passthrough screenSemantic from callable to digest`

### Task 5.11: Open PR

```bash
git checkout -b sub-a-screen-semantic
git push -u origin sub-a-screen-semantic
gh pr create --title "feat(ai): Layer 4 screen semantic (sub-A.5)" --body "..."
```

---

## PR 6 — A.6: 5 new read tools (Layer 2)

**Goal:** Añadir tools de profundización: `get_recent_results`, `get_attendance_summary`, `get_pending_actions_detail`, `get_player_status`, `get_team_health`.

**Spec ref:** "Nuevos tools (signatures)" sección del sub-A design.

**Files:**

- Create: `functions/src/ai/tools/aggregates.ts` (5 new tools)
- Modify: `functions/src/ai/tools/readTools.ts` (split — move some existing to `tools/readTools/queries.ts` if max-lines triggers)
- Modify: `functions/src/index.ts` (register new tools)
- Tests: `__tests__/tools/aggregates.test.ts`

### Task 6.1: get_recent_results

- [ ] Test: covers teamId-scoped + workspace-wide aggregated + limit cap.
- [ ] Implementation reads `calendarSessions` where `fecha < today AND tipo == "partido"` ordered desc.
- [ ] Respect assignedTeamIds scoping (resolved from ctx.userId).
- [ ] Commit: `feat(ai): get_recent_results read tool`

### Task 6.2: get_attendance_summary

- [ ] Test: aggregates attendance docs for last N weeks for a team.
- [ ] Implementation reads `attendance` sub-collection (or wherever it lives — confirm during impl).
- [ ] Commit: `feat(ai): get_attendance_summary read tool`

### Task 6.3: get_pending_actions_detail

- [ ] Test: returns full PendingActions[kind] from cache.
- [ ] Implementation: reads cache via `getOrComputeInsights` and returns the kind.
- [ ] Commit: `feat(ai): get_pending_actions_detail read tool`

### Task 6.4: get_player_status

- [ ] Test: returns asistencia recent + último informe + último shooting test + observaciones.
- [ ] Implementation: 4 parallel reads + format.
- [ ] Commit: `feat(ai): get_player_status read tool`

### Task 6.5: get_team_health

- [ ] Test: aggregates anomalies + pendingActions filtered to one team.
- [ ] Implementation: reads cache + filters.
- [ ] Commit: `feat(ai): get_team_health read tool`

### Task 6.6: Register tools

```ts
// functions/src/index.ts
import { createAggregateTools } from './ai/tools/aggregates';
// ... in setup:
toolRegistry.registerMany(createAggregateTools());
```

- [ ] Test integration with orchestrator (mock LLM that calls one of the new tools).
- [ ] Commit: `feat(ai): register aggregate tools in agent setup`

### Task 6.7: Open PR

```bash
git checkout -b sub-a-aggregate-tools
git push -u origin sub-a-aggregate-tools
gh pr create --title "feat(ai): 5 new aggregate read tools (sub-A.6)" --body "..."
```

---

## PR 7 — A.7 + A.8: Eval cases + CLAUDE.md docs

**Goal:** Sembrar evals automáticos para los 7 casos del spec + documentar el sistema de contexto en CLAUDE.md.

### Task 7.1: Add eval case fixtures

- [ ] Create `functions/src/ai/__tests__/evals/contextAware.fixtures.ts` con 7 escenarios (per spec sección "Eval cases").
- [ ] Commit: `test(ai): context-aware eval fixtures`

### Task 7.2: Run evals + assert pass

- [ ] Hook into existing `AutoEvaluator` infra.
- [ ] Tests run the orchestrator on each fixture and assert expected blocks / no-tool-call where the spec demands.
- [ ] Commit: `test(ai): assert orchestrator handles context-aware cases without unnecessary tool calls`

### Task 7.3: Update CLAUDE.md

- [ ] Add new section under "AI integration":

```md
### Pick context system (sub-proyecto A)

El digest que se inyecta en el system prompt de Pick se construye en 4 capas:

1. **Digest base** (`functions/src/ai/userDigest.ts` + `digest/*`) — teams + rosters + brackets + sessions próximas + sessions recientes + pendientes (de cache) + anomalías (de cache) + memorias + preferencias + screen semantic. ~2-3KB en system prompt cada turno.
2. **Read tools lazy** (`tools/aggregates.ts`) — 5 tools para profundizar: get_recent_results, get_attendance_summary, get_pending_actions_detail, get_player_status, get_team_health.
3. **Insights cache** (`pickInsights/{date}` workspace-wide, TTL 6h, invalidación por Firestore triggers en calendar/scouting/análisis/playerReports).
4. **Screen semantic** (`src/screens/semantic/*`) — frontend compone label + referableIds que viajan al backend en `screenContext.semantic`.

Scoping: assistants ven solo `assignedTeamIds`; owner/coach ven todo el workspace. Filtro en `buildUserDigest`, no en rules (cache es workspace-wide).
```

- [ ] Commit: `docs: document Pick context system in CLAUDE.md`

### Task 7.4: Open PR

```bash
git checkout -b sub-a-evals-docs
git push -u origin sub-a-evals-docs
gh pr create --title "test+docs(ai): context-aware evals + CLAUDE.md (sub-A.7 + A.8)" --body "..."
```

---

## Done criteria (sub-A completa)

- [ ] Todos los 7 PRs mergeados a main.
- [ ] Tests verdes en cada PR.
- [ ] Smoke manual: abrir Pick en una cuenta con datos reales, verificar:
  - Digest contiene rosters + lastResult + nextSession por team.
  - Pendings visible en respuesta de "qué pendientes tengo".
  - Screen semantic resuelve "este equipo" desde TeamDetail.
  - Assistant con `assignedTeamIds=[X]` solo ve team X.
- [ ] Métricas baseline en Langfuse: digest_build_ms p50/p95, digest_size_tokens distribution.
- [ ] No regresiones en tool error rate ni en duration de runAgent (compare antes/después).

---

## Out-of-scope (deferred a follow-ups)

- Scheduled pre-compute de insights (hoy on-demand) — fase futura.
- Multimodal / voz — fuera del programa.
- Sub-B y sub-C (paridad conversacional + tool coverage acción) — siguen este sub-proyecto.
- Helpers semánticos para screens 7+ — incremental cuando se necesiten.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Task             | Command                                              |
| ---------------- | ---------------------------------------------------- |
| Dev server       | `npm run dev`                                        |
| Build            | `npm run build` (Vite)                               |
| Lint             | `npm run lint` (ESLint flat config)                  |
| Format           | `npm run format` / `npm run format:check` (Prettier) |
| Test all         | `npm test` (Vitest, single run)                      |
| Test watch       | `npm run test:watch`                                 |
| Test single file | `npx vitest run src/utils/bracketEngine.test.js`     |
| Deploy           | `npm run deploy` (Firebase Hosting → `dist/`)        |

Pre-commit hooks run Prettier + ESLint via husky/lint-staged on staged `.js`/`.jsx` files.

## Architecture

Basketball coaching SPA: React 19 + Vite + Firebase (Auth, Firestore, Storage) + Tailwind CSS. No TypeScript — all plain JS/JSX.

### Provider stack (nesting order matters)

Stack actual post sub-3 (CoachesApp.jsx):

`HelmetProvider → BrowserRouter → FirebaseProvider → AuthProvider → WorkspaceProvider → ScreenContextProvider → PickProvider → ToastProvider → ErrorBoundary → SidebarProvider → AppShell + AppRouter`

- **FirebaseContext**: inits app from `VITE_FIREBASE_*` env vars; exposes `db`, `appId`, `auth`, `storage`.
- **AuthContext**: Firebase Auth (Google OAuth + anonymous login + email linking).
- **WorkspaceContext**: expone `activeWsId`, `activeWorkspace`, `activeMember`, `memberships`. Subscribe a `members/{uid}` para conocer role + assignedTeamIds.
- **PickProvider**: contexto del AI agent (conversación, screen context). Depende de Workspace.
- **BracketContext** (module-level, sólo dentro de `/area-privada/playoffs`): composes `useBracketSync` + `useBracketEditor` + `useBracketCreation` + `useSharing`.

### Firestore data model

Post sub-proyecto 1 (workspace-as-entity, 2026-05-03):

```
artifacts/{appId}/
  workspaces/{wsId}/                    # type: 'personal' | 'club'
    members/{uid}                       # role, assignedTeamIds (server-written via callables)
    invites/{inviteId}                  # bearer + email-gated (post sub-7 batch security)
    grants/{collectionType}/grantees/{uid}  # sharing primitive (asistencia, informe-jugadores)
    teams/{teamId}/
      members/{teamMemberDocId}, trainings/, cuaderno/{section}
      grants/{collectionType}/grantees/{uid}
    brackets/{bracketId}                # linked to team via teamId field
    calendarSessions/{sessionId}        # entrenamiento, partido, playoff
    exercises/, cuadernoTemplate/, competitions/, recurringSessions/
    usage/{monthId}                     # AI quota counter, server-written
  users/{uid}/                          # PRIVATE user state (no shared workspace data)
    memberships/{wsId}                  # cache de memberships, espejo de workspaces/{wsId}/members/{uid}
    pickHistory/{wsId}/conversations/   # historial AI por workspace
    preferences/, ...                   # UI prefs personales
  shared/{shareCode}                    # legacy share (bracket sharing público)
  shared-exercises/{shareCode}          # exercise sharing (autor-gated post sub-7)
  stripeEvents/{eventId}                # webhook idempotency marker (admin-only)
  presence/{shareCode}/...              # cursor/edit presence en shared bracket
```

Security model (firestore.rules ~345 LOC):

- Cat A — workspace meta: solo owner edita plan/billing/ownerId/type. DT puede editar settings excepto los anteriores.
- Cat B — workspace-wide curated (exercises, cuadernoTemplate): DT escribe, todos leen.
- Cat C — team-scoped strict: owner/DT/assigned-coach por team.
- `workspaceMetaProtected` extendido en sub-7: bloquea `[ownerId, plan, billing, type, createdAt, migrationCompleteAt]` para clientes.
- `shared-exercises` writes: solo el autor (`sharedBy.uid == auth.uid`).
- Members writes: cerrados (`if false`) — todo via callables.

### Playoff bracket system

- **bracketEngine.js**: `buildDynamicBracket(initialMatches, roundsData)` builds a binary tree from initial matches (count MUST be power of 2). Each match has `children`, `nextId`, `slot` for tree navigation. `calculateMatchWinner()` resolves series winners (BO1/BO2/BO3).
- **Bracket data** lives in `bracketData.state[matchId]` — a flat map of all matches keyed by ID (e.g., `R1-M0`, `R2-M1`), with `rootId` pointing to the final.
- **AI bracket creation** (`aiService.js` → `callGeminiForBracket`): sends competition rules + classification PDFs to Gemini, returns structured JSON with team matchups. The prompt enforces power-of-2 match counts and specific array ordering for correct tree layout.
- **Bracket editing** uses undo/redo history (per bracket, stored in `historyRef`). Score changes auto-propagate winners up the tree.

### Calendar and virtual playoff sessions

- Regular calendar sessions (entrenamiento, partido) are persisted in Firestore `calendarSessions`.
- Playoff events are **virtual** — generated at runtime by `buildPlayoffSessions()` from bracket data, NOT stored in Firestore. Their IDs follow the pattern `playoff-{bracketId}-{matchId}-{gameIndex}`.
- Screens that need session data (Scouting, Analysis, Planilla) accept virtual sessions via `location.state.playoffSession` as fallback when Firestore lookup fails.

### Routing

`AppRouter.jsx` uses React Router v7 with lazy-loaded screens wrapped in `ModuleBoundary` (error boundary per route). The `/playoffs` route mounts `PlayoffCreatorModule` which has its own internal mode-based routing (`loading → dashboard → upload → preview → bracket`).

### AI integration

`aiService.js` calls Google Gemini API with model fallback chain (`gemini-flash-latest` → `gemini-2.0-flash` → `gemini-1.5-flash`). Three AI functions:

- `callGeminiForBracket()` — parse competition docs into bracket structure
- `callGeminiForResults()` — extract scores from game reports
- `callGeminiForCalendar()` — suggest calendar events from text

### Pick context system (sub-proyecto A — cerrado funcionalmente 2026-05-13)

El digest que se inyecta en el system prompt de Pick (`functions/src/ai/userDigest.ts`) se construye en capas:

- **Layer 1 — Digest base** (`functions/src/ai/digest/`):
  - `types.ts` — `UserDigest`, `DigestTeam`, `DigestBracket`, `DigestSession`, `PendingConvocatoria`, etc.
  - `teamsDigest.ts` — `buildTeamsDigest`: id, name, categoria, memberCount, `rosterSnapshot` (hasta 12 jugadores), `nextSession`, `lastResult` per team.
  - `bracketsDigest.ts` — `buildBracketsDigest`: id, name, teamId, `currentRound`, `nextMatch`, `pendingScores`.
  - `calendarDigest.ts` — `buildUpcomingSessionsDigest` (próximas 7d, max 15) + `buildRecentPastSessionsDigest` (últimas 7d con `result` normalizado al PoV del coach via `esLocal`).
  - `scoping.ts` — `resolveScopedTeamIds(role + assignedTeamIds)`: owner/coach ven todo, assistant sólo sus `assignedTeamIds`. Filtro aplicado en teams/brackets/sessions/pendings.
  - `pendingConvocatorias.ts` + `pendingAnalyses.ts` + `pendingScoutings.ts` + `pendingPlayerReports.ts` — partidos próximos/pasados sin convocatoria/análisis/scouting + jugadores sin informe del trimestre. On-demand, sin cache (sub-A.4a).

- **Layer 2 — Read tools lazy** (`functions/src/ai/tools/aggregateTools.ts`): 3 aggregate tools shipped — `get_recent_results`, `get_attendance_summary`, `get_player_status`. Las 2 restantes (`get_pending_actions_detail`, `get_team_health`) **dependen del cache L3** y siguen diferidas hasta que el deploy de triggers se desbloquee.

- **Layer 3 — Insights cache**: diferido (sub-A.4b). Requiere deploy de Firestore triggers que sigue bloqueado por IAM (ver `feedback_ci_functions_deploy_iam.md`). Mientras tanto el on-demand de A.4a cubre la funcionalidad principal.

- **Layer 4 — Screen semantic** (`src/utils/screenSemantic/*` + `src/contexts/ScreenContextProvider.tsx`):
  - Frontend computa `{ surface, label, referableIds }` por screen.
  - Backend renderiza via `renderScreenInfo()` en `orchestratorAgent.ts`. Si `screenContext.semantic` está presente, prefiere ese render sobre el bruto.
  - Helpers wired: TeamDetail, Calendar, Bracket, Asistencia, InformeJugadores, Scouting, Analysis, TrainingEditor, TeamTrainings.

- **Métricas baseline (sub-A.0 + sub-B.0)** logueadas a Langfuse cada turno: `digest_build_ms`, `digest_size_tokens`, `fallback_message_emitted`, `history_compression_ms`, además de las existentes `tool_calls`, `iteration_count`, `tool_errors_total`.

**Scoping bug fix** (sub-A.3): antes el digest ignoraba `members/{uid}.assignedTeamIds` y un asistente veía todos los teams del workspace. Tras sub-A.3, scoping role-aware aplicado en `buildUserDigest`. Tests cubren los 3 paths (owner/coach/assistant scoped/assistant sin teams).

**Token budget**: digest típico actual ~1.5–2.5KB. Caps duros pendientes para workspaces grandes (ver risk en sub-A spec).

**Spec + plan**: `docs/superpowers/specs/2026-05-13-ai-chat-priority-master-design.md` + `sub-proyecto-A-contexto-completo-design.md` + plan TDD en `docs/superpowers/plans/2026-05-13-sub-proyecto-A-contexto-completo.md`.

### Pick conversational layer (sub-proyecto B — en curso 2026-05-13)

Sobre el contexto rico de sub-A, sub-B añade 4 capas para conversación natural. Estado actual:

- **B.1 — System prompt redesign** ✅ (PR #57): persona reforzada, ambigüedad protocol, proactividad cues — todo en `functions/src/ai/promptManager.ts → orchestrator-system`.
- **B.2 — History compression v2** ✅ (este PR): `functions/src/ai/history/{cache, summarizer, compressHistoryV2}.ts`. Reemplaza el truncado flat a 130 chars por chunks topic-aware (4 turnos) resumidos vía LLM fast + cache Firestore por `(conversationId, chunkEndIndex)` en `users/{uid}/historySummaries/`. Si el summarizer falla, fallback a líneas flat.
- **B.3+B.4 — Ambiguity classifier** ⏳ pendiente: pre-LLM step que emite `confirm_choice` block cuando hay >1 candidato plausible.
- **B.5 — Proactive engine** ⏳ pendiente (`functions/src/proactiveEngine.ts` ya existe como daily-briefing — se extenderá para on-open).
- **B.6 — Frontend blocks** ⏳ pendiente: `ConfirmChoice` + `ProactiveCard` render.
- **B.7+B.8 — Eval multi-turn + docs** ⏳ pendiente.

**Spec + plan**: `docs/superpowers/specs/2026-05-13-sub-proyecto-B-paridad-conversacional-design.md` + plan TDD en `docs/superpowers/plans/2026-05-13-sub-proyecto-B-paridad-conversacional.md`.

### Key conventions

- `teamDisplayName(team)` (from `utils/teamUtils.js`) is the canonical way to format team names for display.
- Calendar/date constants (`TEAM_COLORS`, `MONTH_NAMES`, `DAY_HEADERS`, etc.) live in `utils/constants.js`.
- Firestore helpers post-sub-1: `workspaceDocRef` / `workspaceColRef` (`src/utils/firestorePaths.js`). Funciones equivalentes en `functions/src/`. **Nunca paths raw `artifacts/...` en código nuevo.** Legacy `userDocRef` / `userColRef` siguen vivos para `users/{uid}/...` (preferencias personales, pickHistory cache).
- `isMinibasketSextos(team)` gates minibasket-specific features (Planilla de Sextos).
- Multiple brackets can link to the same team via `bracket.teamId` — this is how multiple tournaments per team works.

### Quality gates

Pre-commit (husky/lint-staged): prettier + eslint --fix sobre staged files.
Pre-push: `npm test` completo.

CI bloquea PR si:

- Lint reporta **errores** (warnings se ven pero no bloquean; ver baseline abajo).
- Format check falla.
- Tests fallan.
- Build falla.
- Knip detecta dead code (con `continue-on-error` mientras se baseline-iza).

**Reglas ESLint as ERROR** (bloquean CI):

- `import/no-cycle` — arquitecturalmente prohibido (rompe tree-shaking, acoplamiento implícito).
- `import/no-duplicates` — code smell puro.
- `jsx-a11y/aria-props`, `aria-role`, `aria-unsupported-elements`, `role-has-required-aria-props`, `role-supports-aria-props` — a11y críticos.
- `no-unused-vars` — basura.

**Reglas as WARN** (tech debt visible, no bloqueante):

- `complexity` ≥20 (~38 fns actualmente).
- `max-lines` ≥500 (~2 files con file-disable explícito + override en categorías sensatas: tests, content, AI tools, landing).
- `react-refresh/only-export-components` (~11 — JSX files mixing exports).
- `react-hooks/exhaustive-deps` (~5 — falsos positivos comunes).
- `jsx-a11y/label-has-associated-control`, `no-autofocus` (~21 — UX-tradeoffs).
- `no-shadow` (~2).

Total warning baseline: ~82. PR que añade warnings nuevos no bloquea CI hoy, pero queda visible. Para activar `--max-warnings 0`: fix incremental de los 82 primero.

**Reglas OFF con rationale** (en eslint.config.js):

- `react-hooks/set-state-in-effect` — experimental, ruidoso sobre patterns legítimos React 19.
- `consistent-return` — useEffect early-return + cleanup-fn es idiomático React.
- `import/no-unresolved` + `named` + `namespace` — resolver issues con ESM-modern (firebase v12, vitest, vite 8).

## Design Context

Strategic + visual context lives in **`PRODUCT.md`** (and **`DESIGN.md`** once generated) at the project root. Read PRODUCT.md before any UI work. Quick map:

- **Register**: `product` (the private app under `/area-privada` is the default; `/` and `/ayuda` are brand-register surfaces).
- **AI persona**: the copilot is named **Pick**. Voice: tutea, baloncesto-nativo, _"Tú entrenas. Pick trabaja."_
- **Vibe**: sports-broadcast energy. Anti-references: generic SaaS templates, legacy coaching tools (FastModel-era), consumer fitness/social apps, plain AI chat shells.
- **Five design principles** (full text in PRODUCT.md):
  1. Pick es un compañero, no una pestaña.
  2. Lenguaje del baloncesto antes que el de software.
  3. La ayuda pública es el cerebro de Pick.
  4. Aguanta los tres arquetipos sin elegir uno (formativo / coordinador / senior).
  5. Movimiento que cuenta una jugada.
- **A11y target**: funcional, sin auditoría WCAG formal. Respetar `prefers-reduced-motion`, mantener landmarks y `aria-label` en botones-icono.

The impeccable plugin (`/impeccable …`) reads PRODUCT.md / DESIGN.md before doing design work. Do not synthesize new visual rules without consulting both files first.

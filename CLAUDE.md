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

`BrowserRouter → FirebaseProvider → AuthProvider → ToastProvider → AppRouter`

- **FirebaseContext**: inits app from `VITE_FIREBASE_*` env vars; exposes `db`, `appId`, `auth`, `storage`
- **AuthContext**: Firebase Auth (Google OAuth + anonymous login + email linking)
- **BracketContext** (module-level, only inside `/playoffs` route): composes `useBracketSync` + `useBracketEditor` + `useBracketCreation` + `useSharing`

### Firestore data model

```
artifacts/{appId}/users/{uid}/
  brackets/{bracketId}         # Playoff brackets (linked to team via teamId field)
  teams/{teamId}/
    members/, trainings/, cuaderno/ (jugadores, test-tiro, notas, pilares, normas)
  calendarSessions/{sessionId} # Training/match calendar events
artifacts/{appId}/shared/{shareCode}  # Shared bracket (public read, authenticated write)
```

Security: user docs private (`request.auth.uid == uid`), shared docs require auth only.

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

### Key conventions

- `teamDisplayName(team)` (from `TeamsScreen.jsx`) is the canonical way to format team names for display.
- Firestore helpers: `userDocRef(db, appId, uid, collection, docId)` and `userColRef(db, appId, uid, collection)` abstract the nested path.
- `isMinibasketSextos(team)` gates minibasket-specific features (Planilla de Sextos).
- Multiple brackets can link to the same team via `bracket.teamId` — this is how multiple tournaments per team works.

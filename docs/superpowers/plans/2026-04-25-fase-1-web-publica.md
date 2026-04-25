# Fase 1 — Web pública de Pick&Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public web surface of Pick&Coach (landing + help center) with SEO prerendering, unify the editorial content as single source of truth for both public help and AI agent knowledge base, refactor authenticated app under `/area-privada`, and complete the rename from "Urocoach"/"FBM Brackets"/"CoachApp"/"Copilot" to "Pick&Coach"/"Pick".

**Architecture:** Vite + React 19 SPA with build-time static prerender (`vite-react-ssg`) for public routes (`/`, `/ayuda`, `/ayuda/:slug`); content lives in `src/content/helpArticles.ts` and is consumed by both the web (rendering) and the AI indexer (embeddings to Firestore). All authenticated routes move under `/area-privada/*` with `LegacyPathRedirect` for old bookmarks. The agent's central route catalog (`functions/src/shared/appRouteCatalog.ts`) is the single point updated for the routing change.

**Tech Stack:** React 19, React Router 7, Vite 8, Vitest 4, Tailwind 3, Firebase Hosting/Firestore/Functions, `vite-react-ssg` (new), `react-helmet-async` (new), `react-markdown` (already dep), Gemini API (existing for AI).

**Spec:** `docs/superpowers/specs/2026-04-25-fase-1-web-publica-design.md`

---

## File Structure

### Created

| File                                       | Responsibility                                                                                                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/content/helpArticles.ts`              | Single source of truth for editorial content. Exports `HelpArticle`, `HELP_ARTICLES`, `HELP_CATEGORIES`. Consumed by web pages and by `functions/scripts/indexKnowledge.ts`. |
| `src/content/helpArticles.test.ts`         | Validation: required fields, unique ids, unique slugs, URL-safe slugs, valid categories.                                                                                     |
| `src/screens/LandingScreen.jsx`            | Public landing one-pager at `/`.                                                                                                                                             |
| `src/screens/LandingScreen.test.jsx`       | Smoke tests + auth-driven CTA.                                                                                                                                               |
| `src/screens/HelpIndexScreen.jsx`          | Public help index at `/ayuda`.                                                                                                                                               |
| `src/screens/HelpIndexScreen.test.jsx`     | Search behavior, category grouping.                                                                                                                                          |
| `src/screens/HelpArticleScreen.jsx`        | Public help detail at `/ayuda/:slug`.                                                                                                                                        |
| `src/screens/HelpArticleScreen.test.jsx`   | Markdown render, breadcrumb, related articles.                                                                                                                               |
| `src/components/help/HelpSearch.jsx`       | Search input + scoring algorithm. Decoupled via `onSearch` prop.                                                                                                             |
| `src/components/help/HelpSearch.test.jsx`  | Scoring correctness, debounce, URL state.                                                                                                                                    |
| `src/components/help/HelpArticleCard.jsx`  | Reusable card (title + summary + category) used in index, related-section, and landing featured.                                                                             |
| `src/components/help/HelpBreadcrumb.jsx`   | Breadcrumb component, prepared for future category-page link.                                                                                                                |
| `src/components/landing/HeroSection.jsx`   | Hero + dual CTA + auth detection.                                                                                                                                            |
| `src/components/landing/FeaturesGrid.jsx`  | 6 feature cards.                                                                                                                                                             |
| `src/components/landing/HowItWorks.jsx`    | 3 steps.                                                                                                                                                                     |
| `src/components/landing/FeaturedHelp.jsx`  | 4-6 featured help articles on landing.                                                                                                                                       |
| `src/components/landing/FinalCTA.jsx`      | Final CTA banner.                                                                                                                                                            |
| `src/components/landing/LandingFooter.jsx` | Minimal footer.                                                                                                                                                              |
| `src/router/LegacyPathRedirect.jsx`        | Redirects old paths (`/teams/*`, `/playoffs`, `/calendar/*`, `/settings`, `/exercises`) → `/area-privada/...`.                                                               |
| `src/router/LegacyPathRedirect.test.jsx`   | Mapping correctness.                                                                                                                                                         |
| `src/router/publicPaths.js`                | Helper `isPublicPath(pathname)` used by `AppShell` and other layout decisions.                                                                                               |
| `src/router/publicPaths.test.js`           | Coverage of public vs protected paths.                                                                                                                                       |
| `public/og-image.png`                      | 1200×630 generic Open Graph image.                                                                                                                                           |
| `public/robots.txt`                        | Generated at build time.                                                                                                                                                     |
| `scripts/buildSitemap.mjs`                 | Optional — only if vite-react-ssg sitemap output needs adjusting.                                                                                                            |

### Modified

| File                                                                    | Change                                                                                                                                                                             |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                                                            | `<title>` Urocoach → Pick&Coach. Add base meta tags.                                                                                                                               |
| `package.json`                                                          | Add deps: `vite-react-ssg`, `react-helmet-async`. Adjust `build` script if needed.                                                                                                 |
| `vite.config.js`                                                        | Wire `vite-react-ssg` plugin; preserve existing `manualChunks` and headers.                                                                                                        |
| `src/main.jsx`                                                          | Wrap app in `HelmetProvider`. Switch entry to `vite-react-ssg` API if required by plugin.                                                                                          |
| `src/shell/AppRouter.jsx`                                               | Move all protected routes under `/area-privada`. Add public routes for `/`, `/ayuda`, `/ayuda/:slug`. Add `LegacyPathRedirect`. Update login redirect, logout redirect, catch-all. |
| `src/shell/AppShell.jsx`                                                | Replace `isLogin` check with `isPublicPath()`.                                                                                                                                     |
| `src/shell/CoachesNav.jsx`                                              | Update `navigate('/...')` → `navigate('/area-privada/...')`.                                                                                                                       |
| `src/shell/DesktopSidebar.jsx`                                          | Same.                                                                                                                                                                              |
| `src/screens/LoginScreen.jsx`                                           | H1 "FBM Brackets" → "Pick&Coach".                                                                                                                                                  |
| `src/screens/HomeScreen.jsx`                                            | `navigate('/calendar')` → `'/area-privada/calendar'`, etc.                                                                                                                         |
| `src/screens/SettingsScreen.jsx`                                        | `navigate('/')` → `'/area-privada'`.                                                                                                                                               |
| `src/screens/TrainingEditorScreen.jsx`                                  | `navigate('/exercises')` → `'/area-privada/exercises'`.                                                                                                                            |
| `src/screens/TeamTrainingsScreen.jsx`                                   | Same.                                                                                                                                                                              |
| `src/screens/PlanillaSextosScreen.jsx`                                  | `navigate('/calendar')` → `'/area-privada/calendar'`.                                                                                                                              |
| `src/screens/CuadernoScreen.jsx`                                        | `navigate('/teams')` → `'/area-privada/teams'`.                                                                                                                                    |
| `src/screens/TeamDetailScreen.jsx`                                      | Same.                                                                                                                                                                              |
| `src/screens/SharedExerciseScreen.jsx`                                  | `navigate('/')` → `'/area-privada'` (it's the post-auth target).                                                                                                                   |
| `src/components/home/BibliotecaPreview.jsx`                             | All `navigate('/exercises*')` → `/area-privada/exercises*`.                                                                                                                        |
| `src/components/home/HomeComponents.jsx`                                | `navigate('/teams')` → `/area-privada/teams`.                                                                                                                                      |
| `src/components/settings/SettingsModals.jsx`                            | `navigate('/')` → `/area-privada`.                                                                                                                                                 |
| `src/components/settings/SettingsSections.jsx`                          | "backup .json de Urocoach" → "backup .json de Pick&Coach".                                                                                                                         |
| `src/hooks/useSettings.js`                                              | Backup filename `urocoach-backup-` → `pickandcoach-backup-`. Error string.                                                                                                         |
| `src/contexts/CopilotProvider.tsx`                                      | Rename to `PickProvider.tsx`, exports `PickProvider`/`usePick`.                                                                                                                    |
| `src/hooks/useCopilot.ts`                                               | Rename file/exports if any (will check).                                                                                                                                           |
| `src/hooks/useCopilotTips.ts`                                           | Rename.                                                                                                                                                                            |
| `src/components/copilot/*`                                              | Rename folder to `src/components/pick/`, rename files (`CopilotPanel.tsx` → `PickPanel.tsx`, etc.).                                                                                |
| All consumers of `useCopilot`, `CopilotProvider`, `Copilot*` components | Update imports/JSX names.                                                                                                                                                          |
| Strings UI containing "Copiloto" / "Copilot"                            | Replace with "Pick".                                                                                                                                                               |
| `firebase.json`                                                         | Replace catch-all rewrite with specific SPA-fallback rewrites; add cache headers.                                                                                                  |
| `functions/src/shared/appRouteCatalog.ts`                               | All path builders prefixed with `/area-privada` (except `home` which becomes `/area-privada`).                                                                                     |
| `functions/src/shared/appRouteCatalog.test.ts`                          | Update expected paths.                                                                                                                                                             |
| `functions/src/ai/promptManager.ts`                                     | "CoachApp" → "Pick&Coach"; copilot self-id → "Pick".                                                                                                                               |
| `functions/src/ai/tools/navigationTools.ts`                             | Description string CoachApp → Pick&Coach.                                                                                                                                          |
| `functions/src/ai/tools/knowledgeTools.ts`                              | Update tool to return `summary` + `body` (not just `content`).                                                                                                                     |
| `functions/src/ai/embeddingService.ts`                                  | If it formats result fields, update field names.                                                                                                                                   |
| `functions/scripts/indexKnowledge.ts`                                   | Read from `../../src/content/helpArticles.ts`; embed `title + \n\n + summary + \n\n + body`; new doc shape.                                                                        |
| `docs/copilot/*.md`                                                     | "CoachApp" → "Pick&Coach".                                                                                                                                                         |

### Deleted

| File                                  | Reason                                                                |
| ------------------------------------- | --------------------------------------------------------------------- |
| `functions/src/ai/knowledge/index.ts` | Content migrated to `src/content/helpArticles.ts`. Last task of F1.2. |

---

## Phase F1.0 — Sweep de renombrado a Pick&Coach + Pick

**Goal of this phase:** Replace all references to "Urocoach", "FBM Brackets", "CoachApp" → "Pick&Coach"; rename "Copilot" → "Pick" in code, files, and UI strings. No functional changes. Build/lint/tests must pass.

---

### Task 0.1: Discovery audit

**Files:**

- No files modified — output is a list used to drive subsequent tasks.

- [ ] **Step 1: Run exhaustive grep for legacy names**

```bash
cd C:/Users/ASUS/OneDrive/Desktop/playoff-creator
```

Use Grep tool with pattern: `Urocoach|urocoach|FBM Brackets|FBMBrackets|fbm-brackets|fbm_brackets|CoachApp|coach-app|coach_app` across all `*.{js,jsx,ts,tsx,html,json,md,css}` files, excluding `node_modules`, `dist`, `functions/lib`, `.claude/`.

Expected hits (must match the spec table; any extras must be added to the rename list before proceeding):

- `index.html:7` — `<title>Urocoach</title>`
- `src/hooks/useSettings.js:120,139` — backup filename + error msg
- `src/components/settings/SettingsSections.jsx:449` — UI copy
- `src/screens/LoginScreen.jsx:79` — H1 "FBM Brackets"
- `functions/src/ai/knowledge/index.ts` — 4 occurrences of "CoachApp"
- `functions/src/ai/promptManager.ts` — 3 occurrences of "CoachApp"
- `functions/src/ai/tools/navigationTools.ts:10` — "CoachApp"
- `functions/scripts/indexKnowledge.ts:77` — "CoachApp"
- `docs/copilot/NAVIGATION_SPEC.md`, `docs/copilot/BENCHMARK.md` — "CoachApp"

- [ ] **Step 2: Run exhaustive grep for "Copilot"/"copilot"**

Use Grep tool with pattern: `Copilot|copilot|Copiloto|copiloto` across same file set.

Expected categories of hits:

- File names: `src/components/copilot/`, `src/contexts/CopilotProvider.tsx`, `src/hooks/useCopilot*.ts`
- Symbol names: `CopilotProvider`, `useCopilot`, `useCopilotInternal`, `CopilotAPI`, `CopilotPanel`, `CopilotRoot`, `CopilotCompact`, `CopilotFeedback`, etc.
- UI strings: any text shown to user containing "Copilot" / "Copiloto"
- Doc references in `docs/copilot/`

- [ ] **Step 3: Document the full rename list**

Write the full hit list to a temporary scratch file or include it as a comment in the next commit message. This is the "ground truth" for the rename — any divergence becomes a follow-up task.

No commit in this task — pure discovery.

---

### Task 0.2: Rename "Urocoach" + "FBM Brackets" in user-facing code

**Files:**

- Modify: `index.html`
- Modify: `src/screens/LoginScreen.jsx`
- Modify: `src/hooks/useSettings.js`
- Modify: `src/components/settings/SettingsSections.jsx`

- [ ] **Step 1: Update `index.html` title**

```html
<title>Pick&Coach</title>
```

(Plain `&` in HTML title is acceptable in all major browsers; HTML parsers tolerate it. We only escape when context demands.)

- [ ] **Step 2: Update `src/screens/LoginScreen.jsx` line 79**

Replace:

```jsx
<h1 className="text-2xl md:text-3xl font-bold tracking-wide">FBM Brackets</h1>
```

With:

```jsx
<h1 className="text-2xl md:text-3xl font-bold tracking-wide">Pick&amp;Coach</h1>
```

(JSX needs `&amp;` to render literal `&`.)

- [ ] **Step 3: Update `src/hooks/useSettings.js` line 120**

Replace:

```js
a.download = `urocoach-backup-${new Date().toISOString().slice(0, 10)}.json`;
```

With:

```js
a.download = `pickandcoach-backup-${new Date().toISOString().slice(0, 10)}.json`;
```

- [ ] **Step 4: Update `src/hooks/useSettings.js` line 139**

Replace:

```js
setImportError(err.message || 'Archivo inválido. Usa un backup exportado desde Urocoach.');
```

With:

```js
setImportError(err.message || 'Archivo inválido. Usa un backup exportado desde Pick&Coach.');
```

- [ ] **Step 5: Update `src/components/settings/SettingsSections.jsx` line 449**

Replace:

```jsx
<p className="text-xs font-normal text-blue-600">Restaurar desde un backup .json de Urocoach</p>
```

With:

```jsx
<p className="text-xs font-normal text-blue-600">Restaurar desde un backup .json de Pick&amp;Coach</p>
```

- [ ] **Step 6: Run lint + tests**

```bash
npm run lint
npm test
```

Expected: PASS for both.

- [ ] **Step 7: Commit**

```bash
git add index.html src/screens/LoginScreen.jsx src/hooks/useSettings.js src/components/settings/SettingsSections.jsx
git commit -m "refactor(brand): rename Urocoach/FBM Brackets to Pick&Coach in user-facing strings"
```

---

### Task 0.3: Rename "CoachApp" → "Pick&Coach" in functions code and docs

**Files:**

- Modify: `functions/src/ai/promptManager.ts`
- Modify: `functions/src/ai/tools/navigationTools.ts`
- Modify: `functions/scripts/indexKnowledge.ts`
- Modify: `docs/copilot/NAVIGATION_SPEC.md`
- Modify: `docs/copilot/BENCHMARK.md`
- (Note: `functions/src/ai/knowledge/index.ts` will be deleted in F1.2 — no need to rename here.)

- [ ] **Step 1: Update `functions/src/ai/promptManager.ts`**

Replace each occurrence of "CoachApp" with "Pick&Coach". There are 3 occurrences (use Grep tool to confirm count after edit).

Also update copilot self-identification on line ~346 (orchestrator system prompt) — change something like "Eres el copilot IA de CoachApp, una aplicación para entrenadores de baloncesto." to "Eres Pick, el asistente IA de Pick&Coach, una aplicación para entrenadores de baloncesto."

(Read the file first to confirm exact line content before editing.)

- [ ] **Step 2: Update `functions/src/ai/tools/navigationTools.ts`**

Replace `Propone llevar al usuario a una pantalla concreta de CoachApp.` with `Propone llevar al usuario a una pantalla concreta de Pick&Coach.`

- [ ] **Step 3: Update `functions/scripts/indexKnowledge.ts` line 77**

Replace:

```ts
console.log(`\n🏀 CoachApp Knowledge Base Indexer`);
```

With:

```ts
console.log(`\n🏀 Pick&Coach Help Indexer`);
```

- [ ] **Step 4: Update `docs/copilot/*.md`**

Replace all "CoachApp" with "Pick&Coach" in `docs/copilot/NAVIGATION_SPEC.md` and `docs/copilot/BENCHMARK.md`. Use Edit tool with `replace_all: true` if the only occurrences are "CoachApp".

- [ ] **Step 5: Build functions to verify TS still compiles**

```bash
cd functions && npm run build && cd ..
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add functions/src/ai/promptManager.ts functions/src/ai/tools/navigationTools.ts functions/scripts/indexKnowledge.ts docs/copilot/
git commit -m "refactor(brand): rename CoachApp to Pick&Coach in agent prompts, tools, scripts and docs"
```

---

### Task 0.4: Rename `Copilot` → `Pick` (file structure)

**Files:**

- Rename folder: `src/components/copilot/` → `src/components/pick/`
- Rename: `src/components/copilot/CopilotRoot.tsx` → `src/components/pick/PickRoot.tsx`
- Rename: `CopilotPanel.tsx` → `PickPanel.tsx`
- Rename: `CopilotCompact.tsx` → `PickCompact.tsx`
- Rename: `CopilotFeedback.tsx` → `PickFeedback.tsx`
- Rename: `src/contexts/CopilotProvider.tsx` → `src/contexts/PickProvider.tsx`
- Rename: `src/hooks/useCopilot.ts` (read first to confirm filename) → `src/hooks/usePick.ts`
- Rename: `src/hooks/useCopilotTips.ts` → `src/hooks/usePickTips.ts`

- [ ] **Step 1: List all Copilot-named files to rename**

Use Glob tool with pattern `src/**/*opilot*` to enumerate. Confirm the list above is complete; add any missed files.

- [ ] **Step 2: Use git mv for each file**

```bash
git mv src/components/copilot src/components/pick
git mv src/components/pick/CopilotRoot.tsx src/components/pick/PickRoot.tsx
git mv src/components/pick/CopilotPanel.tsx src/components/pick/PickPanel.tsx
git mv src/components/pick/CopilotCompact.tsx src/components/pick/PickCompact.tsx
git mv src/components/pick/CopilotFeedback.tsx src/components/pick/PickFeedback.tsx
git mv src/contexts/CopilotProvider.tsx src/contexts/PickProvider.tsx
git mv src/hooks/useCopilot.ts src/hooks/usePick.ts
git mv src/hooks/useCopilotTips.ts src/hooks/usePickTips.ts
```

(Adjust based on actual file list from Step 1.)

- [ ] **Step 3: Verify renames**

```bash
git status
```

Expected: rename entries for all files above. No untracked or deleted.

- [ ] **Step 4: Commit (renames only, no content yet)**

```bash
git commit -m "refactor(pick): rename Copilot files to Pick (no content changes yet)"
```

(Tests/build will fail at this point — that's expected; the next task fixes content.)

---

### Task 0.5: Update symbol names and imports for Copilot → Pick

**Files:**

- Modify: `src/contexts/PickProvider.tsx` (was CopilotProvider.tsx)
- Modify: `src/hooks/usePick.ts`
- Modify: `src/hooks/usePickTips.ts`
- Modify: `src/components/pick/*.tsx` (each file)
- Modify: every consumer of these symbols (use Grep to find)

- [ ] **Step 1: Update `src/contexts/PickProvider.tsx`**

Read the file. Apply renames:

- `CopilotCtx` → `PickCtx`
- `CopilotProvider` → `PickProvider`
- `useCopilot` → `usePick`
- `useCopilotInternal` → `usePickInternal`
- `CopilotAPI` → `PickAPI`
- Error message: `'useCopilot must be used within CopilotProvider'` → `'usePick must be used within PickProvider'`
- Import path: `from '../hooks/useCopilot'` → `from '../hooks/usePick'`

- [ ] **Step 2: Update `src/hooks/usePick.ts` and `src/hooks/usePickTips.ts`**

Read each file. Apply renames consistently (`useCopilot*` → `usePick*`, `CopilotAPI` → `PickAPI`, internal helpers similarly).

- [ ] **Step 3: Update each file in `src/components/pick/`**

For each file, rename:

- Component name (default export and named exports): `CopilotXxx` → `PickXxx`
- Internal helpers if named with "copilot"/"Copilot"
- Imports of `useCopilot`/`CopilotAPI` → `usePick`/`PickAPI`
- JSX strings shown to user: "Copiloto"/"Copilot" → "Pick"

Read each file individually before editing — apply all changes in one Edit per file.

- [ ] **Step 4: Find all consumers and update imports + usage**

Use Grep with pattern `useCopilot|CopilotProvider|CopilotAPI|CopilotPanel|CopilotRoot|CopilotCompact|CopilotFeedback|from ['"].*copilot|from ['"].*Copilot` across `src/`.

For each hit:

- Update import path: `'../components/copilot/CopilotPanel'` → `'../components/pick/PickPanel'`
- Update import name: `import { useCopilot }` → `import { usePick }`
- Update JSX: `<CopilotPanel />` → `<PickPanel />`
- Update hook calls: `const x = useCopilot()` → `const x = usePick()`

Likely consumers: `src/StandaloneApp.jsx`, `src/shell/CoachesApp.jsx`, `src/shell/AppShell.jsx`, screens that mount the panel.

- [ ] **Step 5: Run lint + tests**

```bash
npm run lint
npm test
```

Expected: PASS. If tests fail because they reference the old names, update them too.

- [ ] **Step 6: Run build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(pick): rename Copilot symbols, components and consumers to Pick"
```

---

### Task 0.6: Update UI strings: "Copiloto" → "Pick"

**Files:**

- Modify: any file with user-visible "Copiloto"/"Copilot" strings (Grep to find)

- [ ] **Step 1: Find user-visible "Copiloto"/"Copilot" strings**

Use Grep with pattern: `["'>]Copiloto|["'>]Copilot[^A-Za-z]` across `src/**/*.{jsx,tsx,js,ts}`.

Filter out symbol names (Class, function, const) — focus on:

- Strings inside JSX text nodes (`>Copiloto<`)
- String literals in `aria-label`, `title`, `placeholder`, `alt`
- Strings in toast/notification calls
- Any other user-facing text

- [ ] **Step 2: Replace each user-visible string**

For each file with hits, read it and apply replacements with Edit. Examples of typical replacements:

- `"Copiloto"` → `"Pick"`
- `"Pregúntale al copiloto"` → `"Pregúntale a Pick"`
- `"El copiloto está pensando..."` → `"Pick está pensando..."`
- `aria-label="Abrir copiloto"` → `aria-label="Abrir Pick"`

Be careful not to change technical/code strings (variable names, log messages where the rename is irrelevant). The aim is text the user sees.

- [ ] **Step 3: Run lint + tests**

```bash
npm run lint
npm test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(pick): rename UI-visible 'Copiloto' strings to 'Pick'"
```

---

### Task 0.7: Final verification of F1.0

- [ ] **Step 1: Re-run discovery grep to confirm zero residue**

Use Grep tool: `Urocoach|urocoach|FBM Brackets|FBMBrackets|CoachApp|coach-app` across all source.

Expected: only hits in:

- `docs/superpowers/specs/2026-04-25-fase-1-web-publica-design.md` (the spec describes the rename — keep)
- `docs/superpowers/plans/2026-04-25-fase-1-web-publica.md` (this plan — keep)
- `functions/lib/` (compiled output, ignore)
- `.git/` (history, ignore)

If any other hit exists, add it to the rename list and apply, then re-verify.

- [ ] **Step 2: Re-run grep for `Copilot|copilot` excluding renamed-to symbols**

Use Grep with pattern `Copilot|Copiloto|copilot[^I]` (loose negative lookbehind to exclude any retained internal references).

Expected: only docs (`docs/copilot/*.md` filenames preserved on purpose, since they're historical names referring to the Copilot project era).

If any source file still has `Copilot`/`Copiloto`, fix it.

- [ ] **Step 3: Full test + lint + build**

```bash
npm run lint && npm test && npm run build
cd functions && npm run build && cd ..
```

Expected: ALL PASS.

- [ ] **Step 4: Smoke test in dev**

```bash
npm run dev
```

Manually verify in browser: login screen shows "Pick&Coach", open the chat, see "Pick" in UI strings.

- [ ] **Step 5: No commit needed if Steps 1-4 all clean**

If any fixes happened in steps 1-2, commit them:

```bash
git add -A
git commit -m "refactor(brand): final cleanup of legacy name residue"
```

---

## Phase F1.1 — Routing refactor a `/area-privada`

**Goal:** All authenticated app routes move under `/area-privada/*`. New `LegacyPathRedirect` component handles old bookmarks. The agent's route catalog is updated. The new public routes (`/`, `/ayuda`, `/ayuda/:slug`) are NOT yet implemented (they'll be added in F1.4/F1.5) — for now only `/login` and the share routes remain public besides redirects.

---

### Task 1.1: Update `appRouteCatalog.ts` path builders

**Files:**

- Modify: `functions/src/shared/appRouteCatalog.ts`
- Modify: `functions/src/shared/appRouteCatalog.test.ts`

- [ ] **Step 1: Update test first (TDD)**

Open `functions/src/shared/appRouteCatalog.test.ts`. Replace expected paths to include `/area-privada` prefix:

```ts
import { describe, it, expect } from 'vitest';
import { resolveAppNavigation } from './appRouteCatalog';

describe('resolveAppNavigation', () => {
  it('resolves home and static routes under /area-privada', () => {
    expect(resolveAppNavigation('home', {})).toEqual({ path: '/area-privada', label: 'Ir a inicio' });
    expect(resolveAppNavigation('teams', {})).toEqual({ path: '/area-privada/teams', label: 'Ir a mis equipos' });
    expect(resolveAppNavigation('calendar', {})).toEqual({ path: '/area-privada/calendar', label: 'Ir al calendario' });
  });

  it('requires teamId for team routes', () => {
    const r = resolveAppNavigation('team_detail', {});
    expect('error' in r).toBe(true);
    if ('error' in r) expect(r.error).toMatch(/teamId/i);
  });

  it('builds team detail path', () => {
    expect(resolveAppNavigation('team_detail', { teamId: 'abc' })).toEqual({
      path: '/area-privada/teams/abc',
      label: 'Ir al equipo',
    });
  });

  it('builds training editor path', () => {
    expect(resolveAppNavigation('training_editor', { teamId: 't1', trainingId: 'tr1' })).toEqual({
      path: '/area-privada/teams/t1/trainings/tr1',
      label: 'Abrir editor de entrenamiento',
    });
  });

  it('adds teamId query on playoffs when provided', () => {
    expect(resolveAppNavigation('playoffs', { teamId: 'x y' })).toEqual({
      path: '/area-privada/playoffs?teamId=x%20y',
      label: 'Ir a torneos (playoffs)',
    });
  });

  it('rejects unknown target', () => {
    const r = resolveAppNavigation('not_a_screen', {});
    expect('error' in r).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd functions && npx vitest run src/shared/appRouteCatalog.test.ts && cd ..
```

Expected: FAIL with mismatched paths (still old `/teams`, expected `/area-privada/teams`).

- [ ] **Step 3: Update `functions/src/shared/appRouteCatalog.ts`**

Read the file, then update each `case` in the switch statement of `resolveAppNavigation` to prefix paths with `/area-privada`:

```ts
case "home":
  return { path: "/area-privada", label: "Ir a inicio" };
case "teams":
  return { path: "/area-privada/teams", label: "Ir a mis equipos" };
case "team_detail": {
  const err = needTeam(teamId);
  if (err) return { error: err };
  return { path: `/area-privada/teams/${teamId}`, label: "Ir al equipo" };
}
case "team_trainings": {
  const err = needTeam(teamId);
  if (err) return { error: err };
  return { path: `/area-privada/teams/${teamId}/trainings`, label: "Ir a entrenamientos del equipo" };
}
case "training_editor": {
  const err = needTraining(teamId, trainingId);
  if (err) return { error: err };
  return { path: `/area-privada/teams/${teamId}/trainings/${trainingId}`, label: "Abrir editor de entrenamiento" };
}
case "calendar":
  return { path: "/area-privada/calendar", label: "Ir al calendario" };
case "session_scouting": {
  const err = needSession(sessionId);
  if (err) return { error: err };
  return { path: `/area-privada/calendar/${sessionId}/scouting`, label: "Ir a scouting del partido" };
}
case "session_analysis": {
  const err = needSession(sessionId);
  if (err) return { error: err };
  return { path: `/area-privada/calendar/${sessionId}/analysis`, label: "Ir al análisis del partido" };
}
case "session_planilla": {
  const err = needSession(sessionId);
  if (err) return { error: err };
  return { path: `/area-privada/calendar/${sessionId}/planilla`, label: "Ir a la planilla de sextos" };
}
case "playoffs": {
  if (teamId?.trim()) {
    return { path: `/area-privada/playoffs?teamId=${encodeURIComponent(teamId)}`, label: "Ir a torneos (playoffs)" };
  }
  return { path: "/area-privada/playoffs", label: "Ir a torneos (playoffs)" };
}
case "exercises":
  return { path: "/area-privada/exercises", label: "Ir a la biblioteca de ejercicios" };
case "settings":
  return { path: "/area-privada/settings", label: "Ir a ajustes" };
case "cuaderno": {
  const err = needTeam(teamId);
  if (err) return { error: err };
  return { path: `/area-privada/teams/${teamId}/cuaderno`, label: "Ir al cuaderno del equipo" };
}
case "cuaderno_info": {
  const err = needTeam(teamId);
  if (err) return { error: err };
  return { path: `/area-privada/teams/${teamId}/cuaderno/info`, label: "Ir a información del cuaderno" };
}
case "cuaderno_pilares": {
  const err = needTeam(teamId);
  if (err) return { error: err };
  return { path: `/area-privada/teams/${teamId}/cuaderno/pilares`, label: "Ir a pilares" };
}
case "cuaderno_normas": {
  const err = needTeam(teamId);
  if (err) return { error: err };
  return { path: `/area-privada/teams/${teamId}/cuaderno/normas`, label: "Ir a normas" };
}
case "cuaderno_test_tiro": {
  const err = needTeam(teamId);
  if (err) return { error: err };
  return { path: `/area-privada/teams/${teamId}/cuaderno/test-tiro`, label: "Ir al test de tiro" };
}
case "cuaderno_jugadores": {
  const err = needTeam(teamId);
  if (err) return { error: err };
  return { path: `/area-privada/teams/${teamId}/cuaderno/jugadores`, label: "Ir a jugadores" };
}
case "cuaderno_notas": {
  const err = needTeam(teamId);
  if (err) return { error: err };
  return { path: `/area-privada/teams/${teamId}/cuaderno/notas`, label: "Ir a notas" };
}
case "cuaderno_informe_jugadores": {
  const err = needTeam(teamId);
  if (err) return { error: err };
  return { path: `/area-privada/teams/${teamId}/cuaderno/informe-jugadores`, label: "Ir a informes de jugadores" };
}
case "cuaderno_asistencia": {
  const err = needTeam(teamId);
  if (err) return { error: err };
  return { path: `/area-privada/teams/${teamId}/cuaderno/asistencia`, label: "Ir a asistencia" };
}
case "cuaderno_entrenamientos": {
  const err = needTeam(teamId);
  if (err) return { error: err };
  return { path: `/area-privada/teams/${teamId}/cuaderno/entrenamientos`, label: "Ir a entrenamientos (cuaderno)" };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd functions && npx vitest run src/shared/appRouteCatalog.test.ts && cd ..
```

Expected: PASS.

- [ ] **Step 5: Build functions to verify TS compiles**

```bash
cd functions && npm run build && cd ..
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add functions/src/shared/appRouteCatalog.ts functions/src/shared/appRouteCatalog.test.ts
git commit -m "refactor(routing): prefix all agent navigation paths with /area-privada"
```

---

### Task 1.2: Create `publicPaths` helper

**Files:**

- Create: `src/router/publicPaths.js`
- Create: `src/router/publicPaths.test.js`

- [ ] **Step 1: Write failing test**

Create `src/router/publicPaths.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { isPublicPath } from './publicPaths';

describe('isPublicPath', () => {
  it('returns true for landing', () => {
    expect(isPublicPath('/')).toBe(true);
  });

  it('returns true for login', () => {
    expect(isPublicPath('/login')).toBe(true);
  });

  it('returns true for help index', () => {
    expect(isPublicPath('/ayuda')).toBe(true);
  });

  it('returns true for help articles', () => {
    expect(isPublicPath('/ayuda/como-crear-equipo')).toBe(true);
    expect(isPublicPath('/ayuda/foo-bar-baz')).toBe(true);
  });

  it('returns true for share routes', () => {
    expect(isPublicPath('/s/abc123')).toBe(true);
    expect(isPublicPath('/exercise/xyz')).toBe(true);
  });

  it('returns false for /area-privada', () => {
    expect(isPublicPath('/area-privada')).toBe(false);
    expect(isPublicPath('/area-privada/teams')).toBe(false);
    expect(isPublicPath('/area-privada/teams/abc/cuaderno')).toBe(false);
  });

  it('returns false for legacy paths (they will redirect)', () => {
    expect(isPublicPath('/teams')).toBe(false);
    expect(isPublicPath('/calendar')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/router/publicPaths.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/router/publicPaths.js`**

```js
/**
 * Returns true if the given pathname is a public route (no auth required).
 * Used by AppShell and other layout decisions to know when to skip sidebars/nav.
 */
export function isPublicPath(pathname) {
  if (pathname === '/') return true;
  if (pathname === '/login') return true;
  if (pathname === '/ayuda') return true;
  if (pathname.startsWith('/ayuda/')) return true;
  if (pathname.startsWith('/s/')) return true;
  if (pathname.startsWith('/exercise/')) return true;
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/router/publicPaths.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/router/publicPaths.js src/router/publicPaths.test.js
git commit -m "feat(router): add isPublicPath helper for layout decisions"
```

---

### Task 1.3: Create `LegacyPathRedirect` component

**Files:**

- Create: `src/router/LegacyPathRedirect.jsx`
- Create: `src/router/LegacyPathRedirect.test.jsx`

- [ ] **Step 1: Write failing test**

Create `src/router/LegacyPathRedirect.test.jsx`:

```jsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LegacyPathRedirect from './LegacyPathRedirect';

function TargetProbe() {
  // Renders the current location for assertion
  return <div data-testid="target-path">{window.location.pathname}</div>;
}

function renderWithRouter(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/teams" element={<LegacyPathRedirect />} />
        <Route path="/teams/*" element={<LegacyPathRedirect />} />
        <Route path="/playoffs" element={<LegacyPathRedirect />} />
        <Route path="/calendar" element={<LegacyPathRedirect />} />
        <Route path="/calendar/*" element={<LegacyPathRedirect />} />
        <Route path="/settings" element={<LegacyPathRedirect />} />
        <Route path="/exercises" element={<LegacyPathRedirect />} />
        <Route path="/exercises/*" element={<LegacyPathRedirect />} />
        <Route path="/area-privada/*" element={<div data-testid="area-privada">{window.location.pathname}</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LegacyPathRedirect', () => {
  it('redirects /teams to /area-privada/teams', () => {
    renderWithRouter('/teams');
    expect(screen.getByTestId('area-privada')).toBeInTheDocument();
  });

  it('redirects /teams/abc to /area-privada/teams/abc', () => {
    renderWithRouter('/teams/abc');
    expect(screen.getByTestId('area-privada')).toBeInTheDocument();
  });

  it('redirects /teams/abc/cuaderno to /area-privada/teams/abc/cuaderno', () => {
    renderWithRouter('/teams/abc/cuaderno');
    expect(screen.getByTestId('area-privada')).toBeInTheDocument();
  });

  it('redirects /playoffs to /area-privada/playoffs', () => {
    renderWithRouter('/playoffs');
    expect(screen.getByTestId('area-privada')).toBeInTheDocument();
  });

  it('redirects /calendar to /area-privada/calendar', () => {
    renderWithRouter('/calendar');
    expect(screen.getByTestId('area-privada')).toBeInTheDocument();
  });

  it('redirects /settings to /area-privada/settings', () => {
    renderWithRouter('/settings');
    expect(screen.getByTestId('area-privada')).toBeInTheDocument();
  });

  it('redirects /exercises to /area-privada/exercises', () => {
    renderWithRouter('/exercises');
    expect(screen.getByTestId('area-privada')).toBeInTheDocument();
  });
});
```

(Note: this test relies on `MemoryRouter` actually navigating; the `<Navigate>` rendered by `LegacyPathRedirect` will route the test's `Routes` to the `/area-privada/*` route, asserting via `data-testid="area-privada"`.)

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/router/LegacyPathRedirect.test.jsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/router/LegacyPathRedirect.jsx`**

```jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Redirect any legacy path (eg /teams/:teamId, /playoffs, /calendar/...) to its
 * /area-privada equivalent, preserving the rest of the path and query.
 */
export default function LegacyPathRedirect() {
  const location = useLocation();
  const target = `/area-privada${location.pathname}${location.search}${location.hash}`;
  return <Navigate to={target} replace />;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/router/LegacyPathRedirect.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/router/LegacyPathRedirect.jsx src/router/LegacyPathRedirect.test.jsx
git commit -m "feat(router): add LegacyPathRedirect for old bookmarks"
```

---

### Task 1.4: Refactor `AppRouter.jsx` to mount routes under `/area-privada`

**Files:**

- Modify: `src/shell/AppRouter.jsx`

- [ ] **Step 1: Read current `AppRouter.jsx` to confirm structure**

Use Read tool on `src/shell/AppRouter.jsx`. Confirm the routes match those expected in Task 1.4 Step 2.

- [ ] **Step 2: Rewrite `AppRouter.jsx`**

Replace entire file content with:

```jsx
import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ModuleBoundary from '../components/ModuleBoundary';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import LegacyPathRedirect from '../router/LegacyPathRedirect';

const TeamsScreen = lazy(() => import('../screens/TeamsScreen'));
const TeamDetailScreen = lazy(() => import('../screens/TeamDetailScreen'));
const TeamTrainingsScreen = lazy(() => import('../screens/TeamTrainingsScreen'));
const TrainingEditorScreen = lazy(() => import('../screens/TrainingEditorScreen'));
const ExerciseLibraryScreen = lazy(() => import('../screens/ExerciseLibraryScreen'));
const CalendarScreen = lazy(() => import('../screens/CalendarScreen'));
const SettingsScreen = lazy(() => import('../screens/SettingsScreen'));
const PlayoffCreatorModule = lazy(() => import('../PlayoffCreatorModule'));
const CuadernoScreen = lazy(() => import('../screens/CuadernoScreen'));
const InfoScreen = lazy(() => import('../screens/cuaderno/InfoScreen'));
const PilaresScreen = lazy(() => import('../screens/cuaderno/PilaresScreen'));
const NormasScreen = lazy(() => import('../screens/cuaderno/NormasScreen'));
const TestTiroScreen = lazy(() => import('../screens/cuaderno/TestTiroScreen'));
const JugadoresScreen = lazy(() => import('../screens/cuaderno/JugadoresScreen'));
const NotasScreen = lazy(() => import('../screens/cuaderno/NotasScreen'));
const InformeJugadoresScreen = lazy(() => import('../screens/cuaderno/InformeJugadoresScreen'));
const AsistenciaScreen = lazy(() => import('../screens/cuaderno/AsistenciaScreen'));
const PlanillaSextosScreen = lazy(() => import('../screens/PlanillaSextosScreen'));
const ScoutingScreen = lazy(() => import('../screens/ScoutingScreen'));
const AnalysisScreen = lazy(() => import('../screens/AnalysisScreen'));
const EntrenamientosScreen = lazy(() => import('../screens/cuaderno/EntrenamientosScreen'));
const SharedExerciseScreen = lazy(() => import('../screens/SharedExerciseScreen'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function LazyFallback() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 size={48} className="text-blue-600 animate-spin" aria-hidden="true" />
    </div>
  );
}

function AuthGuard({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  return children;
}

function ShareRedirect() {
  const { code } = useParams();
  return <Navigate to={`/area-privada/playoffs?share=${code}`} replace />;
}

function PlayoffsRoute() {
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const shareCode = params.get('share') || undefined;
  const initialTeamId = params.get('teamId') || undefined;

  return (
    <PlayoffCreatorModule
      initialShareCode={shareCode}
      initialTeamId={initialTeamId}
      onShareCodeConsumed={() => navigate('/area-privada/playoffs', { replace: true })}
      shareUrlBase={`${window.location.origin}/s`}
    />
  );
}

function LoginRoute() {
  const { user } = useAuth();
  const location = useLocation();

  if (user) {
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect');
    if (redirect && redirect.startsWith('/area-privada')) {
      return <Navigate to={redirect} replace />;
    }
    return <Navigate to="/area-privada" replace />;
  }

  return <LoginScreen />;
}

function Guarded({ name, children }) {
  return (
    <AuthGuard>
      <ModuleBoundary name={name}>{children}</ModuleBoundary>
    </AuthGuard>
  );
}

// Public placeholders for F1.1 — they get real implementations in F1.4 / F1.5.
function LandingPlaceholder() {
  return <div style={{ padding: 40 }}>Pick&amp;Coach landing (placeholder — implemented in F1.4)</div>;
}
function HelpIndexPlaceholder() {
  return <div style={{ padding: 40 }}>Centro de ayuda (placeholder — implemented in F1.5)</div>;
}
function HelpArticlePlaceholder() {
  return <div style={{ padding: 40 }}>Artículo de ayuda (placeholder — implemented in F1.5)</div>;
}

export default function AppRouter() {
  const { authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<LazyFallback />}>
      <ScrollToTop />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPlaceholder />} />
        <Route path="/ayuda" element={<HelpIndexPlaceholder />} />
        <Route path="/ayuda/:slug" element={<HelpArticlePlaceholder />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/s/:code" element={<ShareRedirect />} />
        <Route
          path="/exercise/:shareCode"
          element={
            <Suspense fallback={<LazyFallback />}>
              <ModuleBoundary>
                <SharedExerciseScreen />
              </ModuleBoundary>
            </Suspense>
          }
        />

        {/* Authenticated app under /area-privada */}
        <Route
          path="/area-privada"
          element={
            <AuthGuard>
              <HomeScreen />
            </AuthGuard>
          }
        />
        <Route
          path="/area-privada/playoffs"
          element={
            <Guarded name="Playoffs">
              <PlayoffsRoute />
            </Guarded>
          }
        />
        <Route
          path="/area-privada/teams"
          element={
            <Guarded name="Equipos">
              <TeamsScreen />
            </Guarded>
          }
        />
        <Route
          path="/area-privada/teams/:teamId"
          element={
            <Guarded name="Equipos">
              <TeamDetailScreen />
            </Guarded>
          }
        />

        <Route
          path="/area-privada/teams/:teamId/cuaderno"
          element={
            <Guarded name="Cuaderno">
              <CuadernoScreen />
            </Guarded>
          }
        />
        <Route
          path="/area-privada/teams/:teamId/cuaderno/info"
          element={
            <Guarded name="Cuaderno">
              <InfoScreen />
            </Guarded>
          }
        />
        <Route
          path="/area-privada/teams/:teamId/cuaderno/pilares"
          element={
            <Guarded name="Cuaderno">
              <PilaresScreen />
            </Guarded>
          }
        />
        <Route
          path="/area-privada/teams/:teamId/cuaderno/normas"
          element={
            <Guarded name="Cuaderno">
              <NormasScreen />
            </Guarded>
          }
        />
        <Route
          path="/area-privada/teams/:teamId/cuaderno/test-tiro"
          element={
            <Guarded name="Cuaderno">
              <TestTiroScreen />
            </Guarded>
          }
        />
        <Route
          path="/area-privada/teams/:teamId/cuaderno/jugadores"
          element={
            <Guarded name="Cuaderno">
              <JugadoresScreen />
            </Guarded>
          }
        />
        <Route
          path="/area-privada/teams/:teamId/cuaderno/notas"
          element={
            <Guarded name="Cuaderno">
              <NotasScreen />
            </Guarded>
          }
        />
        <Route
          path="/area-privada/teams/:teamId/cuaderno/informe-jugadores"
          element={
            <Guarded name="Cuaderno">
              <InformeJugadoresScreen />
            </Guarded>
          }
        />
        <Route
          path="/area-privada/teams/:teamId/cuaderno/asistencia"
          element={
            <Guarded name="Cuaderno">
              <AsistenciaScreen />
            </Guarded>
          }
        />
        <Route
          path="/area-privada/teams/:teamId/cuaderno/entrenamientos"
          element={
            <Guarded name="Cuaderno">
              <EntrenamientosScreen />
            </Guarded>
          }
        />

        <Route
          path="/area-privada/teams/:teamId/trainings"
          element={
            <Guarded name="Entrenamientos">
              <TeamTrainingsScreen />
            </Guarded>
          }
        />
        <Route
          path="/area-privada/teams/:teamId/trainings/:trainingId"
          element={
            <Guarded name="Entrenamientos">
              <TrainingEditorScreen />
            </Guarded>
          }
        />

        <Route
          path="/area-privada/exercises"
          element={
            <Guarded name="Ejercicios">
              <ExerciseLibraryScreen />
            </Guarded>
          }
        />
        <Route
          path="/area-privada/calendar"
          element={
            <Guarded name="Calendario">
              <CalendarScreen />
            </Guarded>
          }
        />
        <Route
          path="/area-privada/calendar/:sessionId/planilla"
          element={
            <AuthGuard>
              <PlanillaSextosScreen />
            </AuthGuard>
          }
        />
        <Route
          path="/area-privada/calendar/:sessionId/scouting"
          element={
            <Guarded name="Scouting">
              <ScoutingScreen />
            </Guarded>
          }
        />
        <Route
          path="/area-privada/calendar/:sessionId/analysis"
          element={
            <Guarded name="Análisis">
              <AnalysisScreen />
            </Guarded>
          }
        />
        <Route
          path="/area-privada/settings"
          element={
            <Guarded name="Ajustes">
              <SettingsScreen />
            </Guarded>
          }
        />

        {/* Legacy bookmark redirects → /area-privada/<old> */}
        <Route path="/teams" element={<LegacyPathRedirect />} />
        <Route path="/teams/*" element={<LegacyPathRedirect />} />
        <Route path="/playoffs" element={<LegacyPathRedirect />} />
        <Route path="/calendar" element={<LegacyPathRedirect />} />
        <Route path="/calendar/*" element={<LegacyPathRedirect />} />
        <Route path="/settings" element={<LegacyPathRedirect />} />
        <Route path="/exercises" element={<LegacyPathRedirect />} />
        <Route path="/exercises/*" element={<LegacyPathRedirect />} />

        {/* Catch-all → landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
```

- [ ] **Step 3: Run lint + tests**

```bash
npm run lint && npm test
```

Expected: existing tests should still pass (the AppRouter doesn't have unit tests directly — the failures will come from screens that hardcode `navigate('/...')` to old paths; we fix those next).

- [ ] **Step 4: Run dev and smoke-test in browser**

```bash
npm run dev
```

In browser, manually verify:

- `/` shows landing placeholder.
- `/login` works.
- After login, redirect goes to `/area-privada` (HomeScreen).
- `/teams` redirects to `/area-privada/teams`.
- `/area-privada/teams` works.

- [ ] **Step 5: Commit**

```bash
git add src/shell/AppRouter.jsx
git commit -m "refactor(router): mount authenticated app under /area-privada with legacy redirects"
```

---

### Task 1.5: Update hardcoded `navigate('/...')` calls

**Files:**

- Modify: `src/components/home/BibliotecaPreview.jsx`
- Modify: `src/components/home/HomeComponents.jsx`
- Modify: `src/components/settings/SettingsModals.jsx`
- Modify: `src/screens/TrainingEditorScreen.jsx`
- Modify: `src/screens/HomeScreen.jsx`
- Modify: `src/screens/SettingsScreen.jsx`
- Modify: `src/screens/TeamTrainingsScreen.jsx`
- Modify: `src/screens/PlanillaSextosScreen.jsx`
- Modify: `src/screens/CuadernoScreen.jsx`
- Modify: `src/screens/TeamDetailScreen.jsx`
- Modify: `src/screens/SharedExerciseScreen.jsx`
- Modify: `src/shell/CoachesNav.jsx`
- Modify: `src/shell/DesktopSidebar.jsx`

- [ ] **Step 1: Re-grep for current `navigate('/...')` calls**

Use Grep with pattern `navigate\(['"]\/[^a]` (matches `navigate('/x')` where x is not `a` — i.e. excludes `/area-privada`). Across `src/`.

(Pattern is heuristic — verify each hit.)

- [ ] **Step 2: Update `src/components/home/BibliotecaPreview.jsx`**

Replace:

- `navigate('/exercises#favoritos')` → `navigate('/area-privada/exercises#favoritos')`
- `navigate('/exercises#recien')` → `navigate('/area-privada/exercises#recien')`
- `navigate('/exercises#tendencias')` → `navigate('/area-privada/exercises#tendencias')`
- `navigate('/exercises')` (each occurrence) → `navigate('/area-privada/exercises')`

Use Edit with `replace_all: true` for `'/exercises'` → `'/area-privada/exercises'` if unambiguous.

- [ ] **Step 3: Update `src/components/home/HomeComponents.jsx`**

Replace `navigate('/teams')` → `navigate('/area-privada/teams')`.

- [ ] **Step 4: Update `src/components/settings/SettingsModals.jsx`**

Replace `navigate('/')` → `navigate('/area-privada')`.

- [ ] **Step 5: Update `src/screens/TrainingEditorScreen.jsx`**

Replace `navigate('/exercises')` → `navigate('/area-privada/exercises')`.

- [ ] **Step 6: Update `src/screens/HomeScreen.jsx`**

Replace:

- `navigate('/calendar')` → `navigate('/area-privada/calendar')`
- `navigate('/settings')` → `navigate('/area-privada/settings')`

- [ ] **Step 7: Update `src/screens/SettingsScreen.jsx`**

Replace `s.navigate('/')` → `s.navigate('/area-privada')`.

- [ ] **Step 8: Update `src/screens/TeamTrainingsScreen.jsx`**

Replace `navigate('/exercises')` → `navigate('/area-privada/exercises')`.

- [ ] **Step 9: Update `src/screens/PlanillaSextosScreen.jsx`**

Replace `navigate('/calendar')` → `navigate('/area-privada/calendar')`.

- [ ] **Step 10: Update `src/screens/CuadernoScreen.jsx`**

Replace `navigate('/teams')` → `navigate('/area-privada/teams')`.

- [ ] **Step 11: Update `src/screens/TeamDetailScreen.jsx`**

Replace both `navigate('/teams')` occurrences → `navigate('/area-privada/teams')`.

- [ ] **Step 12: Update `src/screens/SharedExerciseScreen.jsx`**

Both `navigate('/')` calls go to the home of the authenticated area (it's the post-share redirect). Replace both `navigate('/')` → `navigate('/area-privada')`.

- [ ] **Step 13: Update `src/shell/CoachesNav.jsx`**

Replace:

- `navigate('/teams')` (both occurrences, lines 68 and 95) → `navigate('/area-privada/teams')`
- `navigate('/calendar')` → `navigate('/area-privada/calendar')`
- `navigate('/playoffs')` → `navigate('/area-privada/playoffs')`
- `navigate('/exercises')` → `navigate('/area-privada/exercises')`

- [ ] **Step 14: Update `src/shell/DesktopSidebar.jsx`**

All four `navigate('/settings')` (lines 42, 50, 73, 81) → `navigate('/area-privada/settings')`.

Also check this file for any other `navigate('/<route>')` calls and update.

- [ ] **Step 15: Final grep to verify**

Use Grep with pattern `navigate\(['"]\/(?!area-privada|login|ayuda|s\/|exercise\/|\?|$)`. Should return zero hits (matches `navigate('/x')` where x is anything other than the allowed public/area-privada/special paths).

Manually inspect any hit to confirm legitimate (eg query-only navigation like `navigate('?foo=bar')` is OK).

- [ ] **Step 16: Run lint + tests + build**

```bash
npm run lint && npm test && npm run build
```

Expected: PASS.

- [ ] **Step 17: Commit**

```bash
git add -A
git commit -m "refactor(routing): update hardcoded navigate paths to /area-privada"
```

---

### Task 1.6: Update `AppShell` to use `isPublicPath`

**Files:**

- Modify: `src/shell/AppShell.jsx`

- [ ] **Step 1: Read current `src/shell/AppShell.jsx`**

Use Read tool. Confirm structure.

- [ ] **Step 2: Update `src/shell/AppShell.jsx`**

Replace the file with:

```jsx
import React from 'react';
import { useLocation } from 'react-router-dom';
import CoachesNav from './CoachesNav';
import DesktopSidebar from './DesktopSidebar';
import { useSidebar } from '../contexts/SidebarContext';
import ProactiveNotificationsBanner from '../components/ProactiveNotificationsBanner';
import { isPublicPath } from '../router/publicPaths';

export default function AppShell({ children }) {
  const location = useLocation();
  const { collapsed } = useSidebar();
  const publicPath = isPublicPath(location.pathname);

  const pad = collapsed ? 'md:pl-16' : 'md:pl-60';

  return (
    <>
      {!publicPath && (
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:bg-blue-700 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-xl focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:font-semibold focus:no-underline"
        >
          Saltar al contenido principal
        </a>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className={publicPath ? 'outline-none' : `${pad} pb-16 md:pb-0 transition-[padding] duration-200 outline-none`}
      >
        {!publicPath && <ProactiveNotificationsBanner />}
        {children}
      </main>
      {!publicPath && (
        <>
          <CoachesNav />
          <DesktopSidebar />
        </>
      )}
    </>
  );
}
```

- [ ] **Step 3: Run lint + tests**

```bash
npm run lint && npm test
```

Expected: PASS.

- [ ] **Step 4: Smoke test in dev**

```bash
npm run dev
```

Verify:

- On `/`, the sidebar/bottom nav are NOT shown.
- On `/login`, neither shown.
- On `/area-privada/teams`, both ARE shown.
- On `/ayuda` placeholder, neither shown.

- [ ] **Step 5: Commit**

```bash
git add src/shell/AppShell.jsx
git commit -m "refactor(shell): use isPublicPath helper for layout decisions"
```

---

### Task 1.7: Phase F1.1 verification

- [ ] **Step 1: Full lint + tests + build**

```bash
npm run lint && npm test && npm run build
cd functions && npm run build && cd ..
```

Expected: ALL PASS.

- [ ] **Step 2: Manual smoke test in dev**

```bash
npm run dev
```

Test scenarios in browser:

1. Anonymous user opens `/` → sees landing placeholder. No sidebar.
2. Anonymous user goes to `/area-privada/teams` → redirects to `/login?redirect=/area-privada/teams`.
3. Login → redirects to `/area-privada/teams` (preserved intent).
4. Authenticated user opens `/teams` → redirects to `/area-privada/teams` and works.
5. Authenticated user clicks "Ajustes" in sidebar → goes to `/area-privada/settings`.
6. Open chat with Pick. Ask "llévame a equipos". The agent's `suggest_navigation` tool should now propose `/area-privada/teams` (not `/teams`).

If any scenario fails, debug and fix before proceeding to F1.2.

- [ ] **Step 3: No commit needed if all green**

If fixes were applied during smoke test, commit them with appropriate message.

---

## Phase F1.2 — Migración de contenido + checkpoint de curación

**Goal:** Move editorial content from `functions/src/ai/knowledge/index.ts` to a new unified location `src/content/helpArticles.ts` with the new `HelpArticle` schema. Curate content (with explicit user checkpoint). Update the AI indexer to read from the new source. Update the knowledge tool to surface `summary` + `body`. Re-index Firestore. Delete the old file.

---

### Task 2.1: Create `src/content/helpArticles.ts` (schema + categories, empty article list)

**Files:**

- Create: `src/content/helpArticles.ts`

- [ ] **Step 1: Create the file**

Create `src/content/helpArticles.ts`:

```ts
/**
 * Single source of truth for editorial content.
 *
 * Consumed by:
 * - The public web (/ayuda index and /ayuda/:slug detail pages).
 * - The AI agent's knowledge base indexer (functions/scripts/indexKnowledge.ts),
 *   which embeds each article and writes it to Firestore `knowledgeBase/{id}`
 *   for use by the `search_knowledge_base` tool.
 *
 * Principle: anything in this file is BOTH publicly publishable AND consumed
 * by the agent. There is no separate "agent-only" or "draft" content.
 */

export type HelpCategory = 'app-usage' | 'competition-rules' | 'bracket-engine' | 'basketball-concepts';

export interface HelpArticle {
  /** Stable internal id (e.g. "app-create-team"). Used as Firestore doc id. */
  id: string;
  /** URL-facing slug (SEO-friendly Spanish, e.g. "como-crear-equipo"). Mounted at /ayuda/:slug. */
  slug: string;
  category: HelpCategory;
  /** Used in lists and as <title>. */
  title: string;
  /** 1-2 sentences (120-160 chars). Used in <meta description>, index cards, agent preview. */
  summary: string;
  /** Markdown. Rendered on detail page; embedded for semantic search. */
  body: string;
  /** Optional — boost in client-side search scoring. */
  tags?: string[];
  /** Optional — order within category (lower = earlier). */
  order?: number;
  /** ISO date — shown as "Última actualización: 25 abr 2026". */
  updatedAt: string;
}

export const HELP_CATEGORIES: Record<
  HelpCategory,
  {
    label: string;
    description: string;
    order: number;
  }
> = {
  'app-usage': {
    label: 'Guías de uso',
    description: 'Cómo usar Pick&Coach paso a paso',
    order: 1,
  },
  'competition-rules': {
    label: 'Reglas y formatos',
    description: 'Formatos de competición y series',
    order: 2,
  },
  'bracket-engine': {
    label: 'Motor de cuadros',
    description: 'Cómo funcionan los cuadros de playoffs',
    order: 3,
  },
  'basketball-concepts': {
    label: 'Conceptos de baloncesto',
    description: 'Fundamentos, posiciones y sistemas',
    order: 4,
  },
};

export const HELP_ARTICLES: HelpArticle[] = [
  // Articles populated in Task 2.3 after migration + curation.
];
```

- [ ] **Step 2: Run TS typecheck via build**

```bash
npm run build
```

Expected: PASS (file is valid TS, no consumers yet).

- [ ] **Step 3: Commit**

```bash
git add src/content/helpArticles.ts
git commit -m "feat(content): add HelpArticle schema and HELP_CATEGORIES"
```

---

### Task 2.2: Write validation test for `HELP_ARTICLES`

**Files:**

- Create: `src/content/helpArticles.test.ts`

- [ ] **Step 1: Write the test**

Create `src/content/helpArticles.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { HELP_ARTICLES, HELP_CATEGORIES } from './helpArticles';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('HELP_ARTICLES', () => {
  it('has at least one article (post-migration)', () => {
    // Will be 0 right after schema creation; test toleratively for now.
    // Expect ≥1 once Task 2.3 lands the migration.
    expect(HELP_ARTICLES.length).toBeGreaterThanOrEqual(0);
  });

  it('each article has required fields', () => {
    for (const a of HELP_ARTICLES) {
      expect(typeof a.id, `id of ${a.title || '?'}`).toBe('string');
      expect(a.id.length, `id of ${a.title || '?'}`).toBeGreaterThan(0);
      expect(typeof a.slug, `slug of ${a.id}`).toBe('string');
      expect(a.slug.length, `slug of ${a.id}`).toBeGreaterThan(0);
      expect(typeof a.title, `title of ${a.id}`).toBe('string');
      expect(a.title.length, `title of ${a.id}`).toBeGreaterThan(0);
      expect(typeof a.summary, `summary of ${a.id}`).toBe('string');
      expect(a.summary.length, `summary of ${a.id}`).toBeGreaterThan(0);
      expect(a.summary.length, `summary of ${a.id} too long`).toBeLessThanOrEqual(220);
      expect(typeof a.body, `body of ${a.id}`).toBe('string');
      expect(a.body.length, `body of ${a.id}`).toBeGreaterThan(0);
      expect(typeof a.updatedAt, `updatedAt of ${a.id}`).toBe('string');
      expect(a.updatedAt, `updatedAt of ${a.id}`).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(HELP_CATEGORIES[a.category], `category of ${a.id}`).toBeTruthy();
    }
  });

  it('all ids are unique', () => {
    const ids = HELP_ARTICLES.map((a) => a.id);
    const set = new Set(ids);
    expect(set.size).toBe(ids.length);
  });

  it('all slugs are unique', () => {
    const slugs = HELP_ARTICLES.map((a) => a.slug);
    const set = new Set(slugs);
    expect(set.size).toBe(slugs.length);
  });

  it('all slugs are URL-safe (lowercase kebab, no diacritics)', () => {
    for (const a of HELP_ARTICLES) {
      expect(a.slug, `slug of ${a.id}`).toMatch(SLUG_RE);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it passes (with empty list)**

```bash
npx vitest run src/content/helpArticles.test.ts
```

Expected: PASS (loops are no-op on empty array; "at least one" uses ≥0).

- [ ] **Step 3: Commit**

```bash
git add src/content/helpArticles.test.ts
git commit -m "test(content): add validation for HelpArticle invariants"
```

---

### Task 2.3: Migrate 26 entries (1:1, no curation yet) + propose curation list

**Files:**

- Modify: `src/content/helpArticles.ts` (populate `HELP_ARTICLES` array)
- (Reference: read `functions/src/ai/knowledge/index.ts` for source content)

- [ ] **Step 1: Read source content**

Read `functions/src/ai/knowledge/index.ts` in full. Note the 26 entries with their `id`, `category`, `title`, `content`.

- [ ] **Step 2: Build the migration**

For each of the 26 entries, construct a `HelpArticle`:

- `id`: keep the existing id (preserves Firestore doc continuity for the indexer).
- `slug`: derive a Spanish, kebab-case, URL-safe slug from the title (no diacritics). E.g. `"Cómo crear un equipo"` → `como-crear-un-equipo`. **Slugs must be unique.**
- `category`: keep existing category.
- `title`: keep existing title.
- `summary`: write a 1-2 sentence summary (120-160 chars). Derive from the first sentences of `content`, condense.
- `body`: convert the existing `content` (plain text with newlines) to markdown:
  - Preserve paragraph breaks.
  - Convert lines that look like list items (start with `-`) into proper markdown lists.
  - Wrap UI references in backticks (e.g. `` `Equipos` ``, `` `Plantilla` ``).
  - Replace any "CoachApp" residue with "Pick&Coach".
  - Replace "copilot"/"copiloto" UI references with "Pick".
- `tags`: optional — add 2-4 lowercase keyword tags relevant to user search (e.g. `['equipos', 'crear', 'plantilla']`).
- `order`: leave undefined (alphabetical default).
- `updatedAt`: `'2026-04-25'`.

Populate `HELP_ARTICLES` in `src/content/helpArticles.ts` with all 26 articles.

- [ ] **Step 3: Run validation tests**

```bash
npx vitest run src/content/helpArticles.test.ts
```

Expected: PASS (validates all 26 articles satisfy schema invariants).

- [ ] **Step 4: Generate curation proposal document**

Create a transient summary doc (NOT committed) at `/tmp/curation-proposal.md` (or output as a structured message to the user). Format:

```markdown
# Propuesta de curación — 26 artículos migrados

Cada artículo evaluado contra: "¿es información universalmente cierta y publicable como ayuda al usuario?"

## ✅ Quedan tal cual (X artículos)

- `id` — `categoría` — Título
  Justificación: corta.

## ✏️ Reescribir (Y artículos)

- `id` — `categoría` — Título
  Problema: descripción.
  Cambio propuesto: descripción.

## 🗑️ Eliminar (Z artículos)

- `id` — `categoría` — Título
  Razón: descripción.

## Total: X intactos + Y reescritos + Z eliminados = 26

## Resultado final estimado: (X + Y) artículos publicables
```

Pay special attention to `competition-rules` entries — likely candidates for "eliminate" or "rewrite" since they're written as universals when they aren't.

- [ ] **Step 5: 🛑 CHECKPOINT — pause for user review**

**STOP.** Output the curation proposal to the user. Wait for explicit approval or revision instructions before proceeding to Task 2.4.

Do NOT commit yet — Task 2.4 applies the approved curation and commits the final state.

---

### Task 2.4: Apply approved curation

**Files:**

- Modify: `src/content/helpArticles.ts`

- [ ] **Step 1: Apply user-approved changes**

Based on the user's response in the checkpoint, apply:

- For "rewrite": update `body`, `summary`, `tags?` of the article.
- For "eliminate": remove the article from `HELP_ARTICLES`.
- For "keep": no change.

- [ ] **Step 2: Run validation tests**

```bash
npx vitest run src/content/helpArticles.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: PASS (no regressions).

- [ ] **Step 4: Commit**

```bash
git add src/content/helpArticles.ts
git commit -m "feat(content): migrate and curate 26 help articles to unified schema"
```

---

### Task 2.5: Update `indexKnowledge.ts` to read from new source

**Files:**

- Modify: `functions/scripts/indexKnowledge.ts`

- [ ] **Step 1: Read current `functions/scripts/indexKnowledge.ts`**

Use Read tool. Confirm structure. Note imports and Firestore writes.

- [ ] **Step 2: Update import + embedding text + Firestore doc shape**

Replace the relevant sections:

```ts
// Old:
import { KNOWLEDGE_BASE } from '../src/ai/knowledge/index';

// New:
import { HELP_ARTICLES } from '../../src/content/helpArticles';
```

Update the loop body to use the new fields:

```ts
for (const entry of HELP_ARTICLES) {
  const textToEmbed = `${entry.title}\n\n${entry.summary}\n\n${entry.body}`;
  const existingContent = existingMap.get(entry.id);

  // Skip if body hasn't changed (use body as the canonical content marker).
  if (existingContent === entry.body) {
    console.log(`  ⏭️  Skipping "${entry.title}" (unchanged)`);
    skipped++;
    continue;
  }

  process.stdout.write(`  🔄 Embedding "${entry.title}"...`);
  try {
    const embedding = await embedText(textToEmbed);
    await col.doc(entry.id).set({
      id: entry.id,
      slug: entry.slug,
      category: entry.category,
      title: entry.title,
      summary: entry.summary,
      body: entry.body,
      tags: entry.tags || [],
      embedding,
      indexedAt: new Date().toISOString(),
    });

    const isNew = !existingMap.has(entry.id);
    console.log(` ✅ ${isNew ? 'created' : 'updated'}`);
    if (isNew) created++;
    else updated++;

    await new Promise((r) => setTimeout(r, 200));
  } catch (err) {
    console.log(` ❌ Error: ${(err as Error).message}`);
  }
}
```

Also update the `existingMap` build to read `body` (was `content`):

```ts
for (const doc of existingSnap.docs) {
  const data = doc.data();
  // Backward compat: read either body (new) or content (old indexed records)
  existingMap.set(doc.id, (data.body as string) || (data.content as string) || '');
}
```

And the deletion loop already uses `knownIds` from `KNOWLEDGE_BASE.map(e => e.id)` — change to `HELP_ARTICLES.map(e => e.id)`.

- [ ] **Step 3: Build functions to verify TS compiles**

```bash
cd functions && npm run build && cd ..
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add functions/scripts/indexKnowledge.ts
git commit -m "refactor(indexer): read from src/content/helpArticles.ts and write new doc shape"
```

---

### Task 2.6: Update `knowledgeTools.ts` to surface `summary` + `body`

**Files:**

- Modify: `functions/src/ai/tools/knowledgeTools.ts`
- (Reference: read `functions/src/ai/embeddingService.ts` for `searchKnowledgeBase` return shape)

- [ ] **Step 1: Read `functions/src/ai/embeddingService.ts`**

Use Read tool. Confirm what fields `searchKnowledgeBase` returns. The tool result formatting depends on this.

- [ ] **Step 2: Update `embeddingService.ts` if it filters fields**

If `searchKnowledgeBase` selectively reads `content`, change to read `body` (and/or `summary`). Preserve backward read for any old docs.

- [ ] **Step 3: Update `functions/src/ai/tools/knowledgeTools.ts`**

In the tool handler, update the `results` mapping:

```ts
return {
  found: true,
  query,
  results: results.map((r) => ({
    title: r.title,
    summary: r.summary,
    category: r.category,
    body: r.body,
    relevance: Math.round(r.score * 100),
  })),
};
```

(Adjust property names to match what `searchKnowledgeBase` actually returns.)

- [ ] **Step 4: Build functions**

```bash
cd functions && npm run build && cd ..
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/src/ai/tools/knowledgeTools.ts functions/src/ai/embeddingService.ts
git commit -m "refactor(agent): surface summary + body in knowledge search results"
```

---

### Task 2.7: Re-index Firestore

**Files:**

- (No files modified — this runs the indexer.)

- [ ] **Step 1: Verify env vars are set**

Confirm:

- `GEMINI_API_KEY` is set
- `FIREBASE_PROJECT_ID` is set
- `GOOGLE_APPLICATION_CREDENTIALS` is set OR `firebase login` was done

```bash
cd functions
echo $GEMINI_API_KEY  # should not be empty
echo $FIREBASE_PROJECT_ID  # should not be empty
```

If missing, ask the user to set them.

- [ ] **Step 2: Run the indexer**

```bash
cd functions
npx tsx scripts/indexKnowledge.ts
cd ..
```

Expected output: progress lines showing `created`/`updated` per article, plus deletion of any stale entries (notably any entries removed in Task 2.4 curation).

- [ ] **Step 3: Verify in Firebase Console**

Open Firebase Console → Firestore → `knowledgeBase` collection. Confirm:

- Same number of docs as `HELP_ARTICLES.length`.
- Each doc has new fields: `slug`, `summary`, `body` (in addition to existing `embedding`, `indexedAt`).
- Deleted articles are gone.

- [ ] **Step 4: No commit needed (this is a data-only change in Firestore)**

---

### Task 2.8: Verify agent retrieval still works

- [ ] **Step 1: Manual smoke test**

```bash
npm run dev
```

In browser, log in and open Pick chat. Ask: _"¿Cómo creo un equipo?"_

Expected: Pick uses `search_knowledge_base` tool, retrieves the relevant article, and answers using the new `summary` + `body` content. The answer should be coherent and not reference outdated names (no "CoachApp", no "copilot").

Also try: _"¿Qué formatos de serie hay?"_ and _"Explica el motor de cuadros."_ to cover other categories.

- [ ] **Step 2: If issues, fix and re-deploy functions**

```bash
firebase deploy --only functions
```

(Only if local emulator isn't being used — confirm with user.)

- [ ] **Step 3: No commit unless changes were made**

---

### Task 2.9: Delete `functions/src/ai/knowledge/index.ts`

**Files:**

- Delete: `functions/src/ai/knowledge/index.ts`
- Delete: `functions/src/ai/knowledge/` (directory if empty)

- [ ] **Step 1: Verify no remaining imports**

Use Grep with pattern `from ['"][^'"]*ai/knowledge` across `functions/src/`. Should return zero hits.

- [ ] **Step 2: Delete the file**

```bash
git rm functions/src/ai/knowledge/index.ts
```

If the directory is now empty:

```bash
rmdir functions/src/ai/knowledge
```

- [ ] **Step 3: Build functions**

```bash
cd functions && npm run build && cd ..
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(content): remove legacy knowledge/index.ts (migrated to src/content/helpArticles.ts)"
```

---

## Phase F1.3 — Pipeline de prerender + SEO infra

**Goal:** Install `vite-react-ssg`, `react-helmet-async`, set up the build pipeline so that public routes are prerendered to static HTML at build time. Generate `sitemap.xml` and `robots.txt`. Update `firebase.json` rewrites. The placeholder pages from F1.1 get prerendered as a smoke test.

---

### Task 3.0: Spike — validate `vite-react-ssg` integration

**Files:**

- (No commits in this task — pure validation. May install the dep temporarily.)

- [ ] **Step 1: Install `vite-react-ssg` (and peer deps)**

```bash
npm install --save-dev vite-react-ssg react-helmet-async
```

- [ ] **Step 2: Read the plugin's quick-start docs**

Use WebFetch on `https://github.com/zhongjyuan/vite-react-ssg` (or the actual package URL) to confirm setup. Key things to verify:

- Compatible with Vite 8.
- Compatible with React Router 7 with `<Routes>`/`<Route>` API (vs data-router).
- Whether it requires entry file changes (`createRoot` → its own API).

- [ ] **Step 3: Try a minimal config**

In `vite.config.js`, add the plugin (alongside existing `react()`):

```js
import { ViteReactSSG } from 'vite-react-ssg/vite';

export default defineConfig({
  plugins: [
    react(),
    ViteReactSSG({
      includedRoutes: () => ['/'], // start with just landing
    }),
  ],
  // ... rest of config preserved
});
```

In `src/main.jsx`, switch entry per the library's docs (typically wrapping with `ViteReactSSG` HOC or using a different mount).

- [ ] **Step 4: Build and inspect output**

```bash
npm run build
ls dist/
cat dist/index.html
```

Expected: `dist/index.html` should contain the placeholder text "Pick&Coach landing (placeholder)" rendered into the HTML, not just `<div id="root"></div>`.

- [ ] **Step 5: Decide go/no-go**

If the spike succeeds → proceed with F1.3 using `vite-react-ssg`.

If the spike fails (incompatibility, blocking bugs):

- Document specifically what failed.
- Fall back to **custom prerender script** approach: write `scripts/prerender.mjs` using `react-dom/server` + `StaticRouter` + post-build HTML injection. Update tasks 3.1-3.7 accordingly.

The decision is reversible — committing to library or custom should not happen until this spike passes.

- [ ] **Step 6: Revert spike changes**

```bash
git checkout vite.config.js src/main.jsx package.json package-lock.json
```

(Spike artifacts get re-applied properly in Task 3.1+.)

---

### Task 3.1: Install dependencies and add `HelmetProvider` wrapper

**Files:**

- Modify: `package.json` (via `npm install`)
- Modify: `src/main.jsx` (or wherever the app is bootstrapped)

- [ ] **Step 1: Install deps**

```bash
npm install --save-dev vite-react-ssg
npm install react-helmet-async
```

- [ ] **Step 2: Wrap app in `HelmetProvider`**

Read `src/main.jsx`. Locate the existing tree (probably `BrowserRouter > FirebaseProvider > AuthProvider > ToastProvider > AppRouter` per CLAUDE.md). Wrap with `HelmetProvider`:

```jsx
import { HelmetProvider } from 'react-helmet-async';

// Inside the existing tree, somewhere outside BrowserRouter is fine; common pattern is at the top:
<HelmetProvider>
  <BrowserRouter>{/* ...existing providers and AppRouter */}</BrowserRouter>
</HelmetProvider>;
```

- [ ] **Step 3: Run lint + build**

```bash
npm run lint && npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/main.jsx
git commit -m "feat(seo): add vite-react-ssg + react-helmet-async deps"
```

---

### Task 3.2: Configure `vite-react-ssg` with route enumeration

**Files:**

- Modify: `vite.config.js`
- Modify: `src/main.jsx` (entry adjustments per plugin docs — TBD by spike result)

**NOTE:** The exact API depends on what the spike (Task 3.0) confirmed. Below is the most common form; adjust if the spike uncovered specifics.

- [ ] **Step 1: Update `vite.config.js`**

Read current `vite.config.js`. Add the plugin while preserving everything else:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { ViteReactSSG } from 'vite-react-ssg/vite';
import { HELP_ARTICLES } from './src/content/helpArticles';

export default defineConfig({
  plugins: [
    react(),
    ViteReactSSG({
      // Enumerate all public routes to prerender:
      includedRoutes: () => ['/', '/ayuda', ...HELP_ARTICLES.map((a) => `/ayuda/${a.slug}`)],
    }),
  ],
  base: '/',
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    exclude: ['node_modules', 'dist', 'functions/**', 'tests/**', '.claude/**'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'unsafe-none',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
  },
  build: {
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfjs-dist')) return 'pdf';
          if (id.includes('xlsx')) return 'xlsx';
          if (id.includes('html-to-image')) return 'html-to-image';
          if (id.includes('firebase')) return 'firebase';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('lucide-react'))
            return 'vendor';
        },
      },
    },
  },
});
```

(Note: importing TS file `./src/content/helpArticles` from `vite.config.js` requires Vite to resolve TS at config time. If this errors, options: (a) use `tsx` to run vite, (b) use a `.ts` config file `vite.config.ts`, (c) read the `HELP_ARTICLES` from a JSON file emitted by a small build step. Pick the simplest that works.)

- [ ] **Step 2: Update `src/main.jsx` entry per plugin requirements**

Per `vite-react-ssg` docs, the entry typically becomes:

```jsx
import { ViteReactSSG } from 'vite-react-ssg';
import App from './App'; // or wherever the root tree lives

export const createRoot = ViteReactSSG(<App />);
```

Adapt to actual library API. Preserve `HelmetProvider` wrapping.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected:

- `dist/index.html` exists with prerendered landing placeholder content.
- `dist/ayuda/index.html` exists with index placeholder content.
- Each `dist/ayuda/{slug}/index.html` exists for each article slug.

- [ ] **Step 4: Run dev**

```bash
npm run dev
```

Confirm app still hydrates correctly (clicking around works).

- [ ] **Step 5: Commit**

```bash
git add vite.config.js src/main.jsx
git commit -m "feat(seo): wire vite-react-ssg with prerender of /, /ayuda, /ayuda/:slug"
```

---

### Task 3.3: Generate `sitemap.xml` and `robots.txt`

**Files:**

- Create: `public/robots.txt` OR generated script that writes to `dist/`
- Modify: `vite.config.js` (if sitemap is a config option of the plugin)
- Create: `scripts/buildSitemap.mjs` (only if vite-react-ssg doesn't include this)

- [ ] **Step 1: Check if `vite-react-ssg` generates sitemap automatically**

Per spike findings — many SSG plugins emit `sitemap.xml` by default with the included routes. If yes, jump to Step 4.

- [ ] **Step 2 (if needed): Create `scripts/buildSitemap.mjs`**

```js
// scripts/buildSitemap.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HELP_ARTICLES } from '../src/content/helpArticles.ts'; // requires tsx loader

const SITE_URL = process.env.SITE_URL || 'https://pickandcoach.web.app';
const TODAY = new Date().toISOString().slice(0, 10);

const urls = [
  { loc: '/', lastmod: TODAY, changefreq: 'weekly', priority: 1.0 },
  { loc: '/ayuda', lastmod: TODAY, changefreq: 'weekly', priority: 0.8 },
  ...HELP_ARTICLES.map((a) => ({
    loc: `/ayuda/${a.slug}`,
    lastmod: a.updatedAt.slice(0, 10),
    changefreq: 'monthly',
    priority: 0.6,
  })),
];

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls
    .map(
      (u) =>
        `  <url>\n` +
        `    <loc>${SITE_URL}${u.loc}</loc>\n` +
        `    <lastmod>${u.lastmod}</lastmod>\n` +
        `    <changefreq>${u.changefreq}</changefreq>\n` +
        `    <priority>${u.priority}</priority>\n` +
        `  </url>`,
    )
    .join('\n') +
  `\n</urlset>\n`;

writeFileSync(join(process.cwd(), 'dist', 'sitemap.xml'), xml, 'utf8');
console.log(`✓ Wrote dist/sitemap.xml (${urls.length} URLs)`);
```

Then update `package.json`:

```json
"scripts": {
  "build": "vite build && tsx scripts/buildSitemap.mjs"
}
```

(Install `tsx` as devDep if not present: `npm install --save-dev tsx`.)

- [ ] **Step 3: Create `public/robots.txt`**

```
User-agent: *
Allow: /
Allow: /ayuda
Allow: /ayuda/
Disallow: /login
Disallow: /area-privada
Disallow: /s/
Disallow: /exercise/

Sitemap: https://pickandcoach.web.app/sitemap.xml
```

(`public/robots.txt` is automatically copied to `dist/` by Vite.)

- [ ] **Step 4: Build and verify**

```bash
npm run build
ls dist/sitemap.xml dist/robots.txt
cat dist/sitemap.xml
cat dist/robots.txt
```

Expected: both files exist with correct content.

- [ ] **Step 5: Commit**

```bash
git add public/robots.txt scripts/buildSitemap.mjs package.json package-lock.json
git commit -m "feat(seo): generate sitemap.xml and add robots.txt"
```

---

### Task 3.4: Update `firebase.json` (rewrites + cache headers)

**Files:**

- Modify: `firebase.json`

- [ ] **Step 1: Read current `firebase.json`**

Use Read tool. Confirm structure.

- [ ] **Step 2: Replace `firebase.json` hosting block**

```jsonc
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json",
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"],
      "ignore": ["node_modules", ".git", "firebase-debug.log", "firebase-debug.*.log", "*.local"],
    },
  ],
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "headers": [
      {
        "source": "**",
        "headers": [
          { "key": "Cross-Origin-Opener-Policy", "value": "unsafe-none" },
          { "key": "Cross-Origin-Embedder-Policy", "value": "unsafe-none" },
        ],
      },
      {
        "source": "**/*.html",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=300, s-maxage=600" }],
      },
      {
        "source": "**/*.@(js|css|webp|png|jpg|svg|woff2)",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }],
      },
    ],
    "rewrites": [
      { "source": "/area-privada/**", "destination": "/index.html" },
      { "source": "/login", "destination": "/index.html" },
      { "source": "/s/**", "destination": "/index.html" },
      { "source": "/exercise/**", "destination": "/index.html" },
      { "source": "/teams/**", "destination": "/index.html" },
      { "source": "/playoffs", "destination": "/index.html" },
      { "source": "/calendar/**", "destination": "/index.html" },
      { "source": "/settings", "destination": "/index.html" },
      { "source": "/exercises/**", "destination": "/index.html" },
    ],
  },
  "emulators": {
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "auth": { "port": 9099 },
    "hosting": { "port": 5000 },
    "ui": { "enabled": true },
  },
}
```

(Legacy paths are added as rewrites so the SPA's `LegacyPathRedirect` can intercept and redirect them at runtime — the static HTML for `/teams` won't exist, so SPA needs to take over.)

- [ ] **Step 3: Verify with local Firebase emulator**

```bash
npm run build
firebase emulators:start --only hosting
```

In browser:

- `http://localhost:5000/` → landing placeholder (served as static HTML).
- `http://localhost:5000/ayuda` → ayuda placeholder (static HTML).
- `http://localhost:5000/area-privada` → SPA fallback, serves `index.html` and React handles routing.
- `http://localhost:5000/teams` → SPA fallback, `LegacyPathRedirect` redirects to `/area-privada/teams`.

- [ ] **Step 4: Commit**

```bash
git add firebase.json
git commit -m "chore(hosting): replace catch-all rewrite with specific SPA fallbacks; add cache headers"
```

---

### Task 3.5: Phase F1.3 verification

- [ ] **Step 1: Full build + check output**

```bash
npm run build
```

Expected:

- `dist/index.html` exists with rendered placeholder.
- `dist/ayuda/index.html` exists.
- `dist/ayuda/{slug}/index.html` exists for each article (count = `HELP_ARTICLES.length`).
- `dist/sitemap.xml` exists with all URLs.
- `dist/robots.txt` exists.

- [ ] **Step 2: `curl` smoke test**

Start emulator:

```bash
firebase emulators:start --only hosting
```

In another shell:

```bash
curl -s http://localhost:5000/ | grep -i "pick&coach landing"  # should match
curl -s http://localhost:5000/ayuda | grep -i "centro de ayuda"  # should match
curl -s http://localhost:5000/sitemap.xml | head -5  # should be XML
```

- [ ] **Step 3: No commit needed if all passes**

---

## Phase F1.4 — Landing one-pager

**Goal:** Replace the landing placeholder with the real one-pager. Auth-aware CTA, hero, features grid, how-it-works, featured help, final CTA, footer, full SEO meta tags.

---

### Task 4.1: Create `HeroSection`

**Files:**

- Create: `src/components/landing/HeroSection.jsx`
- Create: `src/components/landing/HeroSection.test.jsx`

- [ ] **Step 1: Write failing test**

Create `src/components/landing/HeroSection.test.jsx`:

```jsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HeroSection from './HeroSection';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../contexts/AuthContext';

function renderHero() {
  return render(
    <MemoryRouter>
      <HeroSection />
    </MemoryRouter>,
  );
}

describe('HeroSection', () => {
  it('shows "Empezar gratis" CTA when not authenticated', () => {
    useAuth.mockReturnValue({ user: null });
    renderHero();
    expect(screen.getByRole('link', { name: /empezar gratis/i })).toHaveAttribute('href', '/login');
  });

  it('shows "Ir a tu área privada" CTA when authenticated', () => {
    useAuth.mockReturnValue({ user: { email: 'coach@test.com' } });
    renderHero();
    expect(screen.getByRole('link', { name: /ir a tu área privada/i })).toHaveAttribute('href', '/area-privada');
  });

  it('shows session badge with email when authenticated', () => {
    useAuth.mockReturnValue({ user: { email: 'coach@test.com' } });
    renderHero();
    expect(screen.getByText(/coach@test.com/)).toBeInTheDocument();
  });

  it('always shows secondary CTA to /ayuda', () => {
    useAuth.mockReturnValue({ user: null });
    renderHero();
    expect(screen.getByRole('link', { name: /ver centro de ayuda/i })).toHaveAttribute('href', '/ayuda');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/landing/HeroSection.test.jsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/landing/HeroSection.jsx`**

```jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function HeroSection() {
  const { user } = useAuth();

  return (
    <section className="relative bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Trophy size={32} className="text-amber-400" aria-hidden="true" />
              <span className="text-amber-400 font-semibold tracking-wide">Pick&amp;Coach</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Tu copiloto IA para entrenar baloncesto
            </h1>
            <p className="text-lg lg:text-xl text-blue-100 mb-8 leading-relaxed">
              Playoffs, entrenamientos, calendario y scouting. Todo en un sitio, con un copiloto IA que hace el trabajo
              contigo.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              {user ? (
                <Link
                  to="/area-privada"
                  className="inline-flex items-center justify-center px-6 py-3 bg-amber-400 text-blue-950 font-semibold rounded-xl hover:bg-amber-300 transition-colors shadow-lg"
                >
                  Ir a tu área privada
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center px-6 py-3 bg-amber-400 text-blue-950 font-semibold rounded-xl hover:bg-amber-300 transition-colors shadow-lg"
                >
                  Empezar gratis
                </Link>
              )}
              <Link
                to="/ayuda"
                className="inline-flex items-center justify-center px-6 py-3 bg-white/10 border border-white/30 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors"
              >
                Ver centro de ayuda
              </Link>
            </div>

            {user && (
              <p className="mt-4 text-sm text-blue-200">
                Sesión activa como <span className="font-medium">{user.email}</span>
              </p>
            )}
          </div>

          <div className="relative">
            {/* Placeholder hero visual — to be replaced with real screenshot of Pick chat. */}
            <div
              className="aspect-[4/3] bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-blue-200 text-sm"
              role="img"
              aria-label="Captura del copiloto Pick (pendiente)"
            >
              [Captura de Pick — pendiente]
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/components/landing/HeroSection.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/HeroSection.jsx src/components/landing/HeroSection.test.jsx
git commit -m "feat(landing): add HeroSection with auth-aware CTA"
```

---

### Task 4.2: Create `FeaturesGrid`

**Files:**

- Create: `src/components/landing/FeaturesGrid.jsx`

- [ ] **Step 1: Implement `src/components/landing/FeaturesGrid.jsx`**

```jsx
import React from 'react';
import { Bot, Trophy, Calendar, NotebookPen, BookOpen, Search } from 'lucide-react';

const FEATURES = [
  {
    icon: Bot,
    title: 'Pick, tu copiloto IA',
    description:
      'Pide cualquier cosa y la hace: crea un entrenamiento, importa el cuadrante, sugiere ejercicios. Con contexto de tu equipo y tu calendario.',
  },
  {
    icon: Trophy,
    title: 'Cuadros de playoffs con IA',
    description: 'Sube las bases y la clasificación. El cuadro se genera solo, incluyendo BYE y series BO1/BO3.',
  },
  {
    icon: Calendar,
    title: 'Calendario y entrenamientos',
    description: 'Importa tu cuadrante desde Excel. Genera entrenamientos completos con IA. Ajusta al vuelo.',
  },
  {
    icon: NotebookPen,
    title: 'Cuaderno del entrenador',
    description: 'Informes de jugadores, notas, pilares, normas, test de tiro. Privado por equipo.',
  },
  {
    icon: BookOpen,
    title: 'Biblioteca de ejercicios',
    description: 'Crea, etiqueta, reutiliza. Compartible con otros entrenadores.',
  },
  {
    icon: Search,
    title: 'Scouting y análisis',
    description: 'Prepara partido, analiza el jugado, con la IA ayudando a extraer lo que importa.',
  },
];

export default function FeaturesGrid() {
  return (
    <section className="bg-white py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="max-w-3xl mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
            Todo lo que necesitas para entrenar mejor
          </h2>
          <p className="text-lg text-slate-600">
            Pensado para entrenadores de baloncesto federado, de minibasket a sénior. Pronto, también para clubes.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="p-6 lg:p-8 bg-slate-50 border border-slate-100 rounded-2xl hover:border-blue-200 hover:bg-white hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center mb-4">
                  <Icon size={24} aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-600 leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/FeaturesGrid.jsx
git commit -m "feat(landing): add FeaturesGrid with 6 product capabilities"
```

---

### Task 4.3: Create `HowItWorks`

**Files:**

- Create: `src/components/landing/HowItWorks.jsx`

- [ ] **Step 1: Implement**

```jsx
import React from 'react';

const STEPS = [
  { n: '1', title: 'Crea tu cuenta', description: 'Regístrate gratis con Google, Apple o correo.' },
  { n: '2', title: 'Añade tu equipo', description: 'Configura categoría, jugadores y calendario en minutos.' },
  {
    n: '3',
    title: 'Deja que Pick te ayude',
    description: 'Pídele entrenamientos, cuadros, análisis. Lo hace contigo.',
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-slate-50 py-20 lg:py-28">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 text-center mb-16">Empieza en 3 pasos</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((s) => (
            <div key={s.n} className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-600 text-white text-2xl font-bold rounded-full flex items-center justify-center">
                {s.n}
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">{s.title}</h3>
              <p className="text-slate-600">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/HowItWorks.jsx
git commit -m "feat(landing): add HowItWorks 3-step section"
```

---

### Task 4.4: Create `HelpArticleCard` (reusable)

**Files:**

- Create: `src/components/help/HelpArticleCard.jsx`
- Create: `src/components/help/HelpArticleCard.test.jsx`

- [ ] **Step 1: Write failing test**

```jsx
// src/components/help/HelpArticleCard.test.jsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HelpArticleCard from './HelpArticleCard';

const ARTICLE = {
  id: 'app-create-team',
  slug: 'como-crear-equipo',
  category: 'app-usage',
  title: 'Cómo crear un equipo',
  summary: 'Aprende a crear tu primer equipo paso a paso desde la pantalla de Equipos.',
  body: '...',
  updatedAt: '2026-04-25',
};

describe('HelpArticleCard', () => {
  it('renders title, summary and link', () => {
    render(
      <MemoryRouter>
        <HelpArticleCard article={ARTICLE} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/ayuda/como-crear-equipo');
    expect(screen.getByText('Cómo crear un equipo')).toBeInTheDocument();
    expect(screen.getByText(/aprende a crear/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/help/HelpArticleCard.test.jsx
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```jsx
// src/components/help/HelpArticleCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function HelpArticleCard({ article }) {
  return (
    <Link
      to={`/ayuda/${article.slug}`}
      className="group block p-5 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all"
    >
      <h3 className="font-semibold text-slate-900 group-hover:text-blue-700 mb-1.5">{article.title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{article.summary}</p>
      <span className="inline-flex items-center gap-1 mt-3 text-sm text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        Leer más <ArrowRight size={14} aria-hidden="true" />
      </span>
    </Link>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/components/help/HelpArticleCard.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/help/HelpArticleCard.jsx src/components/help/HelpArticleCard.test.jsx
git commit -m "feat(help): add reusable HelpArticleCard"
```

---

### Task 4.5: Create `FeaturedHelp` section for landing

**Files:**

- Create: `src/components/landing/FeaturedHelp.jsx`

- [ ] **Step 1: Implement**

```jsx
// src/components/landing/FeaturedHelp.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { HELP_ARTICLES } from '../../content/helpArticles';
import HelpArticleCard from '../help/HelpArticleCard';

// Slugs of articles to feature on the landing.
// Edit this list to curate the front page (no schema change needed).
const FEATURED_SLUGS = [
  'como-crear-equipo',
  'como-generar-un-entrenamiento-con-ia',
  'como-importar-el-calendario-desde-excel',
  'como-crear-un-cuadro-de-playoffs',
  'biblioteca-de-ejercicios',
  'que-es-el-cuaderno-del-entrenador',
];

export default function FeaturedHelp() {
  const featured = FEATURED_SLUGS.map((slug) => HELP_ARTICLES.find((a) => a.slug === slug))
    .filter(Boolean)
    .slice(0, 6);

  if (featured.length === 0) return null;

  return (
    <section className="bg-white py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-3">Aprende a usarlo</h2>
            <p className="text-lg text-slate-600">Guías destacadas del centro de ayuda.</p>
          </div>
          <Link
            to="/ayuda"
            className="hidden sm:inline-flex items-center gap-1 text-blue-700 font-medium hover:text-blue-900"
          >
            Ver todos los artículos <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {featured.map((a) => (
            <HelpArticleCard key={a.id} article={a} />
          ))}
        </div>
      </div>
    </section>
  );
}
```

(Note: `FEATURED_SLUGS` may need to be adjusted if the curated slugs don't match — Task 4.10 verifies.)

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/FeaturedHelp.jsx
git commit -m "feat(landing): add FeaturedHelp section pulling from HELP_ARTICLES"
```

---

### Task 4.6: Create `FinalCTA` and `LandingFooter`

**Files:**

- Create: `src/components/landing/FinalCTA.jsx`
- Create: `src/components/landing/LandingFooter.jsx`

- [ ] **Step 1: Implement `FinalCTA.jsx`**

```jsx
// src/components/landing/FinalCTA.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function FinalCTA() {
  const { user } = useAuth();
  return (
    <section className="bg-gradient-to-br from-blue-700 to-blue-900 text-white py-20 lg:py-24">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <h2 className="text-3xl lg:text-4xl font-bold mb-4">Empieza a entrenar con tu copiloto hoy</h2>
        <p className="text-lg text-blue-100 mb-8">Gratis para entrenadores. Sin tarjeta. Sin compromiso.</p>
        <Link
          to={user ? '/area-privada' : '/login'}
          className="inline-flex items-center justify-center px-8 py-4 bg-amber-400 text-blue-950 font-semibold rounded-xl hover:bg-amber-300 transition-colors shadow-lg text-lg"
        >
          {user ? 'Ir a tu área privada' : 'Empezar gratis'}
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Implement `LandingFooter.jsx`**

```jsx
// src/components/landing/LandingFooter.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';

export default function LandingFooter() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-12">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-amber-400" aria-hidden="true" />
            <span className="text-white font-semibold">Pick&amp;Coach</span>
          </div>
          <nav className="flex gap-6 text-sm">
            <Link to="/ayuda" className="hover:text-white transition-colors">
              Centro de ayuda
            </Link>
            <Link to="/login" className="hover:text-white transition-colors">
              Iniciar sesión
            </Link>
          </nav>
          <p className="text-xs">© {new Date().getFullYear()} Pick&amp;Coach</p>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/FinalCTA.jsx src/components/landing/LandingFooter.jsx
git commit -m "feat(landing): add FinalCTA and LandingFooter"
```

---

### Task 4.7: Create `LandingScreen` composing all sections + Helmet

**Files:**

- Create: `src/screens/LandingScreen.jsx`
- Create: `src/screens/LandingScreen.test.jsx`
- Modify: `src/shell/AppRouter.jsx` (replace `LandingPlaceholder` with real `LandingScreen`)

- [ ] **Step 1: Write failing test**

```jsx
// src/screens/LandingScreen.test.jsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import LandingScreen from './LandingScreen';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null })),
}));

describe('LandingScreen', () => {
  it('renders hero, features, how-it-works and footer', () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <LandingScreen />
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: /copiloto ia/i })).toBeInTheDocument();
    expect(screen.getByText(/pick, tu copiloto ia/i)).toBeInTheDocument();
    expect(screen.getByText(/empieza en 3 pasos/i)).toBeInTheDocument();
    expect(screen.getByText(/centro de ayuda/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/screens/LandingScreen.test.jsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/screens/LandingScreen.jsx`**

```jsx
import React from 'react';
import { Helmet } from 'react-helmet-async';
import HeroSection from '../components/landing/HeroSection';
import FeaturesGrid from '../components/landing/FeaturesGrid';
import HowItWorks from '../components/landing/HowItWorks';
import FeaturedHelp from '../components/landing/FeaturedHelp';
import FinalCTA from '../components/landing/FinalCTA';
import LandingFooter from '../components/landing/LandingFooter';

const SITE_URL = 'https://pickandcoach.web.app';
const TITLE = 'Pick&Coach — Copiloto IA para entrenadores de baloncesto';
const DESCRIPTION =
  'Playoffs, entrenamientos, calendario y scouting. Todo en un sitio, con un copiloto IA que hace el trabajo contigo.';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Pick&Coach',
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Web',
  description: DESCRIPTION,
  url: SITE_URL,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'EUR',
  },
};

export default function LandingScreen() {
  return (
    <>
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={SITE_URL + '/'} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={SITE_URL + '/'} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content={OG_IMAGE} />
        <script type="application/ld+json">{JSON.stringify(JSON_LD)}</script>
      </Helmet>

      <HeroSection />
      <FeaturesGrid />
      <HowItWorks />
      <FeaturedHelp />
      <FinalCTA />
      <LandingFooter />
    </>
  );
}
```

- [ ] **Step 4: Update `src/shell/AppRouter.jsx`**

Replace the import + placeholder with the real screen:

```jsx
// At the top of AppRouter.jsx, alongside other imports:
const LandingScreen = lazy(() => import('../screens/LandingScreen'));

// Then in the routes:
<Route path="/" element={<LandingScreen />} />;
```

Remove the `LandingPlaceholder` function.

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/screens/LandingScreen.test.jsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/screens/LandingScreen.jsx src/screens/LandingScreen.test.jsx src/shell/AppRouter.jsx
git commit -m "feat(landing): assemble LandingScreen with all sections, Helmet meta, JSON-LD"
```

---

### Task 4.8: Add `public/og-image.png` placeholder

**Files:**

- Create: `public/og-image.png`

- [ ] **Step 1: Create or place a 1200×630 placeholder image**

Option A (preferred — creates a real placeholder programmatically):

```bash
# Use ImageMagick if available:
convert -size 1200x630 xc:'#0f172a' -gravity center \
  -font Arial -pointsize 72 -fill '#fbbf24' -annotate 0 'Pick&Coach' \
  public/og-image.png 2>/dev/null || echo "ImageMagick not available — manual placeholder needed"
```

Option B: Use any 1200×630 PNG (even a solid-color rectangle) named `public/og-image.png`. The user should replace with a designed asset later.

- [ ] **Step 2: Verify build copies it**

```bash
npm run build
ls dist/og-image.png
```

Expected: file exists in `dist/`.

- [ ] **Step 3: Commit**

```bash
git add public/og-image.png
git commit -m "feat(seo): add placeholder og-image (1200x630)"
```

---

### Task 4.9: Phase F1.4 verification

- [ ] **Step 1: Build and inspect HTML**

```bash
npm run build
cat dist/index.html | grep -i "Tu copiloto IA"
cat dist/index.html | grep -i 'meta name="description"'
cat dist/index.html | grep -i 'application/ld+json'
```

Expected: all three commands return matches (HTML is prerendered with content + meta + JSON-LD).

- [ ] **Step 2: Lighthouse audit (optional but recommended)**

```bash
firebase emulators:start --only hosting
```

In another shell, use Chrome DevTools Lighthouse on `http://localhost:5000/`:

- Performance ≥ 90
- SEO ≥ 95
- Accessibility ≥ 90

If scores below threshold, identify issues (e.g. missing alt text, color contrast) and fix.

- [ ] **Step 3: Share card preview (optional)**

After deploy to staging:

- https://opengraph.xyz/url/{deployed-url}
- https://cards-dev.twitter.com/validator (if account available)

Expected: card renders with title, description, og-image.

- [ ] **Step 4: Commit fixes if any**

---

## Phase F1.5 — Centro de ayuda

**Goal:** Replace placeholders with real `HelpIndexScreen` (with search) and `HelpArticleScreen` (markdown render, breadcrumb, related articles).

---

### Task 5.1: Create `HelpSearch` component

**Files:**

- Create: `src/components/help/HelpSearch.jsx`
- Create: `src/components/help/HelpSearch.test.jsx`

- [ ] **Step 1: Write failing test**

```jsx
// src/components/help/HelpSearch.test.jsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HelpSearch from './HelpSearch';

describe('HelpSearch', () => {
  it('renders an input with placeholder', () => {
    render(<HelpSearch query="" onChange={() => {}} onSearch={async () => []} />);
    expect(screen.getByPlaceholderText(/buscar/i)).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<HelpSearch query="" onChange={onChange} onSearch={async () => []} />);
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'equipo' } });
    expect(onChange).toHaveBeenCalledWith('equipo');
  });

  it('debounces onSearch calls', async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn(async () => []);
    const { rerender } = render(<HelpSearch query="" onChange={() => {}} onSearch={onSearch} />);

    rerender(<HelpSearch query="e" onChange={() => {}} onSearch={onSearch} />);
    rerender(<HelpSearch query="eq" onChange={() => {}} onSearch={onSearch} />);
    rerender(<HelpSearch query="equipo" onChange={() => {}} onSearch={onSearch} />);

    expect(onSearch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    await Promise.resolve();
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('equipo');

    vi.useRealTimers();
  });

  it('does not call onSearch for queries < 2 chars', async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn(async () => []);
    const { rerender } = render(<HelpSearch query="" onChange={() => {}} onSearch={onSearch} />);
    rerender(<HelpSearch query="e" onChange={() => {}} onSearch={onSearch} />);
    vi.advanceTimersByTime(300);
    await Promise.resolve();
    expect(onSearch).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/help/HelpSearch.test.jsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/components/help/HelpSearch.jsx`**

```jsx
import React, { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

const DEBOUNCE_MS = 150;
const MIN_QUERY = 2;

export default function HelpSearch({ query, onChange, onSearch, autoFocus = false }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.trim().length < MIN_QUERY) return;
    timerRef.current = setTimeout(() => {
      onSearch(query.trim());
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, onSearch]);

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search size={20} className="text-slate-400" aria-hidden="true" />
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar en el centro de ayuda…"
        autoFocus={autoFocus}
        className="w-full pl-12 pr-4 py-4 text-lg bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        aria-label="Buscar en el centro de ayuda"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/components/help/HelpSearch.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/help/HelpSearch.jsx src/components/help/HelpSearch.test.jsx
git commit -m "feat(help): add HelpSearch with debounce and min-query"
```

---

### Task 5.2: Create search scoring utility

**Files:**

- Create: `src/components/help/searchArticles.js`
- Create: `src/components/help/searchArticles.test.js`

- [ ] **Step 1: Write failing test**

```js
// src/components/help/searchArticles.test.js
import { describe, it, expect } from 'vitest';
import { searchArticles } from './searchArticles';

const ARTICLES = [
  {
    id: 'a1',
    slug: 'a1',
    title: 'Cómo crear un equipo',
    summary: 'Crea tu primer equipo.',
    tags: ['equipos', 'crear'],
  },
  {
    id: 'a2',
    slug: 'a2',
    title: 'Generar entrenamiento con IA',
    summary: 'Pídele un entrenamiento al copiloto.',
    tags: ['ia', 'entrenamiento'],
  },
  { id: 'a3', slug: 'a3', title: 'Importar calendario', summary: 'Sube tu Excel.', tags: ['calendario', 'importar'] },
];

describe('searchArticles', () => {
  it('returns empty for empty query', () => {
    expect(searchArticles('', ARTICLES)).toEqual([]);
  });

  it('matches by title', () => {
    const r = searchArticles('equipo', ARTICLES);
    expect(r[0].id).toBe('a1');
  });

  it('matches by summary', () => {
    const r = searchArticles('excel', ARTICLES);
    expect(r[0].id).toBe('a3');
  });

  it('matches by tag', () => {
    const r = searchArticles('importar', ARTICLES);
    expect(r[0].id).toBe('a3');
  });

  it('is case- and accent-insensitive', () => {
    const r = searchArticles('CÓMO', ARTICLES);
    expect(r[0].id).toBe('a1');
    const r2 = searchArticles('como', ARTICLES);
    expect(r2[0].id).toBe('a1');
  });

  it('ranks title matches above summary matches', () => {
    const articles = [
      { id: 'a', slug: 'a', title: 'Foo', summary: 'Mentions equipo here', tags: [] },
      { id: 'b', slug: 'b', title: 'Equipo guide', summary: 'Foo', tags: [] },
    ];
    const r = searchArticles('equipo', articles);
    expect(r[0].id).toBe('b');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/help/searchArticles.test.js
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/components/help/searchArticles.js`**

```js
function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const TITLE_WEIGHT = 10;
const SUMMARY_WEIGHT = 4;
const TAG_WEIGHT = 6;

/**
 * Returns articles whose normalized title/summary/tags contain the query,
 * sorted by descending score. Pure function, no side effects.
 */
export function searchArticles(query, articles) {
  const q = normalize(query.trim());
  if (!q) return [];

  const scored = [];
  for (const a of articles) {
    let score = 0;
    if (normalize(a.title).includes(q)) score += TITLE_WEIGHT;
    if (normalize(a.summary).includes(q)) score += SUMMARY_WEIGHT;
    if (a.tags) {
      for (const t of a.tags) {
        if (normalize(t).includes(q)) {
          score += TAG_WEIGHT;
          break;
        }
      }
    }
    if (score > 0) scored.push({ article: a, score });
  }
  scored.sort((x, y) => y.score - x.score);
  return scored.map((s) => s.article);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/components/help/searchArticles.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/help/searchArticles.js src/components/help/searchArticles.test.js
git commit -m "feat(help): add client-side article scoring with diacritic normalization"
```

---

### Task 5.3: Create `HelpIndexScreen`

**Files:**

- Create: `src/screens/HelpIndexScreen.jsx`
- Create: `src/screens/HelpIndexScreen.test.jsx`
- Modify: `src/shell/AppRouter.jsx` (replace `HelpIndexPlaceholder`)

- [ ] **Step 1: Write failing test**

```jsx
// src/screens/HelpIndexScreen.test.jsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import HelpIndexScreen from './HelpIndexScreen';

vi.mock('../content/helpArticles', () => ({
  HELP_ARTICLES: [
    {
      id: 'a1',
      slug: 'crear-equipo',
      category: 'app-usage',
      title: 'Crear equipo',
      summary: 'Crea tu equipo',
      body: '',
      tags: ['equipos'],
      updatedAt: '2026-04-25',
    },
    {
      id: 'a2',
      slug: 'reglas-bo3',
      category: 'competition-rules',
      title: 'Series BO3',
      summary: 'Cómo funciona BO3',
      body: '',
      tags: ['bo3'],
      updatedAt: '2026-04-25',
    },
  ],
  HELP_CATEGORIES: {
    'app-usage': { label: 'Guías de uso', description: 'Cómo usar la app', order: 1 },
    'competition-rules': { label: 'Reglas', description: 'Formatos', order: 2 },
    'bracket-engine': { label: 'Motor de cuadros', description: '', order: 3 },
    'basketball-concepts': { label: 'Baloncesto', description: '', order: 4 },
  },
}));

function renderScreen(initialEntry = '/ayuda') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <HelpIndexScreen />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('HelpIndexScreen', () => {
  it('renders categories with their articles when no query', () => {
    renderScreen();
    expect(screen.getByText('Guías de uso')).toBeInTheDocument();
    expect(screen.getByText('Reglas')).toBeInTheDocument();
    expect(screen.getByText('Crear equipo')).toBeInTheDocument();
    expect(screen.getByText('Series BO3')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderScreen();
    expect(screen.getByPlaceholderText(/buscar/i)).toBeInTheDocument();
  });

  it('filters when query in URL', () => {
    renderScreen('/ayuda?q=BO3');
    // Search results show only matches; categories panel hidden.
    expect(screen.queryByText('Guías de uso')).not.toBeInTheDocument();
    expect(screen.getByText('Series BO3')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/screens/HelpIndexScreen.test.jsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/screens/HelpIndexScreen.jsx`**

```jsx
import React, { useCallback, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { HELP_ARTICLES, HELP_CATEGORIES } from '../content/helpArticles';
import HelpSearch from '../components/help/HelpSearch';
import HelpArticleCard from '../components/help/HelpArticleCard';
import { searchArticles } from '../components/help/searchArticles';

const SITE_URL = 'https://pickandcoach.web.app';
const TITLE = 'Centro de ayuda — Pick&Coach';
const DESCRIPTION = 'Guías, reglas, y conceptos. Aprende a sacar el máximo partido a Pick&Coach.';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

function articlesByCategory(articles) {
  const byCat = {};
  for (const a of articles) {
    if (!byCat[a.category]) byCat[a.category] = [];
    byCat[a.category].push(a);
  }
  for (const cat of Object.keys(byCat)) {
    byCat[cat].sort((x, y) => {
      if (x.order != null && y.order != null) return x.order - y.order;
      if (x.order != null) return -1;
      if (y.order != null) return 1;
      return x.title.localeCompare(y.title, 'es');
    });
  }
  return byCat;
}

function sortedCategories() {
  return Object.entries(HELP_CATEGORIES).sort((a, b) => a[1].order - b[1].order);
}

export default function HelpIndexScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState(() =>
    initialQuery.trim().length >= 2 ? searchArticles(initialQuery, HELP_ARTICLES) : null,
  );

  const onChange = useCallback(
    (next) => {
      setQuery(next);
      const params = new URLSearchParams(searchParams);
      if (next.trim()) params.set('q', next);
      else params.delete('q');
      setSearchParams(params, { replace: true });
      if (next.trim().length < 2) setResults(null);
    },
    [searchParams, setSearchParams],
  );

  const onSearch = useCallback(async (q) => {
    setResults(searchArticles(q, HELP_ARTICLES));
  }, []);

  const grouped = useMemo(() => articlesByCategory(HELP_ARTICLES), []);

  const showResults = results !== null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={SITE_URL + '/ayuda'} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={SITE_URL + '/ayuda'} />
        <meta property="og:image" content={OG_IMAGE} />
      </Helmet>

      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
          <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-3">Centro de ayuda</h1>
          <p className="text-lg text-slate-600 mb-8">Guías para sacar el máximo a Pick&amp;Coach.</p>
          <HelpSearch query={query} onChange={onChange} onSearch={onSearch} autoFocus />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
        {showResults ? (
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              {results.length} resultado{results.length === 1 ? '' : 's'} para «{query}»
            </h2>
            {results.length === 0 ? (
              <p className="text-slate-600">
                No encontramos artículos para «{query}». Prueba otra búsqueda o{' '}
                <button onClick={() => onChange('')} className="text-blue-700 hover:underline">
                  vuelve al índice
                </button>
                .
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {results.map((a) => (
                  <HelpArticleCard key={a.id} article={a} />
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="space-y-12">
            {sortedCategories().map(([catKey, catMeta]) => {
              const articles = grouped[catKey] || [];
              if (articles.length === 0) return null;
              return (
                <section key={catKey}>
                  <h2 className="text-2xl font-semibold text-slate-900 mb-1">{catMeta.label}</h2>
                  <p className="text-slate-600 mb-5">{catMeta.description}</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {articles.map((a) => (
                      <HelpArticleCard key={a.id} article={a} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Update `src/shell/AppRouter.jsx`**

```jsx
const HelpIndexScreen = lazy(() => import('../screens/HelpIndexScreen'));

// In routes:
<Route path="/ayuda" element={<HelpIndexScreen />} />;
```

Remove `HelpIndexPlaceholder`.

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/screens/HelpIndexScreen.test.jsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/screens/HelpIndexScreen.jsx src/screens/HelpIndexScreen.test.jsx src/shell/AppRouter.jsx
git commit -m "feat(help): implement HelpIndexScreen with search and category grouping"
```

---

### Task 5.4: Create `HelpBreadcrumb` component

**Files:**

- Create: `src/components/help/HelpBreadcrumb.jsx`

- [ ] **Step 1: Implement**

```jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function HelpBreadcrumb({ category, categoryLabel, articleTitle }) {
  // category param reserved for future /ayuda/categoria/:cat route — currently
  // category is rendered as text only (not a link).
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
      <ol className="flex items-center gap-1 flex-wrap">
        <li>
          <Link to="/ayuda" className="hover:text-blue-700">
            Centro de ayuda
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight size={14} />
        </li>
        <li>
          {/* When /ayuda/categoria/:cat ships, wrap in <Link to={`/ayuda/categoria/${category}`}>. */}
          <span>{categoryLabel}</span>
        </li>
        <li aria-hidden="true">
          <ChevronRight size={14} />
        </li>
        <li className="text-slate-900 font-medium" aria-current="page">
          {articleTitle}
        </li>
      </ol>
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/help/HelpBreadcrumb.jsx
git commit -m "feat(help): add HelpBreadcrumb (category prepared as future link)"
```

---

### Task 5.5: Create `HelpArticleScreen`

**Files:**

- Create: `src/screens/HelpArticleScreen.jsx`
- Create: `src/screens/HelpArticleScreen.test.jsx`
- Modify: `src/shell/AppRouter.jsx` (replace `HelpArticlePlaceholder`)

- [ ] **Step 1: Write failing test**

```jsx
// src/screens/HelpArticleScreen.test.jsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import HelpArticleScreen from './HelpArticleScreen';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null })),
}));

vi.mock('../content/helpArticles', () => ({
  HELP_ARTICLES: [
    {
      id: 'a1',
      slug: 'crear-equipo',
      category: 'app-usage',
      title: 'Crear equipo',
      summary: 'Crea tu equipo.',
      body: '## Pasos\n\n1. Abrir Equipos\n2. Pulsar Nuevo equipo',
      updatedAt: '2026-04-25',
    },
    {
      id: 'a2',
      slug: 'otra-cosa',
      category: 'app-usage',
      title: 'Otra cosa',
      summary: 'Otra cosa.',
      body: 'Body.',
      updatedAt: '2026-04-25',
    },
  ],
  HELP_CATEGORIES: {
    'app-usage': { label: 'Guías de uso', description: 'Cómo usar la app', order: 1 },
  },
}));

function renderAt(slug) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/ayuda/${slug}`]}>
        <Routes>
          <Route path="/ayuda/:slug" element={<HelpArticleScreen />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('HelpArticleScreen', () => {
  it('renders title and breadcrumb', () => {
    renderAt('crear-equipo');
    expect(screen.getByRole('heading', { level: 1, name: 'Crear equipo' })).toBeInTheDocument();
    expect(screen.getByText(/centro de ayuda/i)).toBeInTheDocument();
    expect(screen.getByText(/guías de uso/i)).toBeInTheDocument();
  });

  it('renders markdown body', () => {
    renderAt('crear-equipo');
    expect(screen.getByRole('heading', { level: 2, name: /pasos/i })).toBeInTheDocument();
    expect(screen.getByText(/abrir equipos/i)).toBeInTheDocument();
  });

  it('shows related articles from same category', () => {
    renderAt('crear-equipo');
    expect(screen.getByText('Otra cosa')).toBeInTheDocument();
  });

  it('shows CTA to /login when not authenticated', () => {
    renderAt('crear-equipo');
    expect(screen.getByRole('link', { name: /pregúntale a pick/i })).toHaveAttribute('href', '/login');
  });

  it('renders 404-ish state for unknown slug', () => {
    renderAt('does-not-exist');
    expect(screen.getByText(/no encontramos/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/screens/HelpArticleScreen.test.jsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/screens/HelpArticleScreen.jsx`**

```jsx
import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowRight } from 'lucide-react';
import { HELP_ARTICLES, HELP_CATEGORIES } from '../content/helpArticles';
import { useAuth } from '../contexts/AuthContext';
import HelpBreadcrumb from '../components/help/HelpBreadcrumb';
import HelpArticleCard from '../components/help/HelpArticleCard';

const SITE_URL = 'https://pickandcoach.web.app';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

function formatDateEs(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function HelpArticleScreen() {
  const { slug } = useParams();
  const { user } = useAuth();

  const article = useMemo(() => HELP_ARTICLES.find((a) => a.slug === slug), [slug]);
  const related = useMemo(() => {
    if (!article) return [];
    return HELP_ARTICLES.filter((a) => a.category === article.category && a.slug !== article.slug).slice(0, 4);
  }, [article]);

  if (!article) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Artículo no encontrado</h1>
          <p className="text-slate-600 mb-6">No encontramos el artículo «{slug}».</p>
          <Link to="/ayuda" className="text-blue-700 font-medium hover:underline">
            Volver al centro de ayuda
          </Link>
        </div>
      </div>
    );
  }

  const categoryLabel = HELP_CATEGORIES[article.category]?.label || article.category;
  const articleUrl = `${SITE_URL}/ayuda/${article.slug}`;
  const pageTitle = `${article.title} — Ayuda de Pick&Coach`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.summary,
    dateModified: article.updatedAt,
    url: articleUrl,
    image: OG_IMAGE,
    author: {
      '@type': 'Organization',
      name: 'Pick&Coach',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Pick&Coach',
    },
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={article.summary} />
        <link rel="canonical" href={articleUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={article.summary} />
        <meta property="og:url" content={articleUrl} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={article.title} />
        <meta name="twitter:description" content={article.summary} />
        <meta name="twitter:image" content={OG_IMAGE} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-10 lg:py-14">
        <HelpBreadcrumb category={article.category} categoryLabel={categoryLabel} articleTitle={article.title} />

        <header className="mt-6 mb-10">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-100 rounded-full mb-3">
            {categoryLabel}
          </span>
          <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-3">{article.title}</h1>
          <p className="text-sm text-slate-500">Última actualización: {formatDateEs(article.updatedAt)}</p>
        </header>

        <article className="prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-blue-700">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, ...props }) =>
                props.href && /^https?:\/\//.test(props.href) ? (
                  <a {...props} target="_blank" rel="noopener noreferrer">
                    {props.children}
                  </a>
                ) : (
                  <a {...props}>{props.children}</a>
                ),
            }}
          >
            {article.body}
          </ReactMarkdown>
        </article>

        {related.length > 0 && (
          <section className="mt-16 pt-8 border-t border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Otros artículos de {categoryLabel}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {related.map((a) => (
                <HelpArticleCard key={a.id} article={a} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-12 p-6 lg:p-8 bg-white border border-blue-100 rounded-2xl shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">¿Aún tienes preguntas?</h2>
          <p className="text-slate-600 mb-4">
            Pregúntale a Pick desde tu cuenta — responde con tu contexto y puede ejecutar acciones por ti.
          </p>
          <Link
            to={user ? '/area-privada' : '/login'}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Pregúntale a Pick <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update `src/shell/AppRouter.jsx`**

```jsx
const HelpArticleScreen = lazy(() => import('../screens/HelpArticleScreen'));

// In routes:
<Route path="/ayuda/:slug" element={<HelpArticleScreen />} />;
```

Remove `HelpArticlePlaceholder`.

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/screens/HelpArticleScreen.test.jsx
```

Expected: PASS.

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/screens/HelpArticleScreen.jsx src/screens/HelpArticleScreen.test.jsx src/shell/AppRouter.jsx
git commit -m "feat(help): implement HelpArticleScreen with markdown render, related, and CTA"
```

---

### Task 5.6: Phase F1.5 verification

- [ ] **Step 1: Build and inspect prerendered article HTMLs**

```bash
npm run build
ls dist/ayuda/
ls dist/ayuda/{first-article-slug}/
cat dist/ayuda/{first-article-slug}/index.html | grep -i "última actualización"
cat dist/ayuda/{first-article-slug}/index.html | grep -i "application/ld+json"
```

Expected: each article has its HTML prerendered with title, body content, JSON-LD.

- [ ] **Step 2: Smoke test in dev**

```bash
npm run dev
```

In browser:

1. `/ayuda` shows categories with articles. Search for "equipo" filters correctly. URL updates to `/ayuda?q=equipo`.
2. Click an article — opens `/ayuda/{slug}`. Markdown renders. Breadcrumb correct.
3. Click a "related article" — navigates correctly.
4. CTA "Pregúntale a Pick" links to `/login` (anon) or `/area-privada` (auth).
5. Visit nonexistent `/ayuda/foo-bar` — shows 404-ish state.

- [ ] **Step 3: Commit any fixes if found**

---

## Phase F1.6 — Verificación post-deploy

**Goal:** Deploy to Firebase. Verify share cards, rich results. Submit sitemap to Search Console.

---

### Task 6.1: Deploy to Firebase Hosting

- [ ] **Step 1: Verify build is clean**

```bash
npm run lint && npm test && npm run build
```

Expected: ALL PASS.

- [ ] **Step 2: Deploy**

```bash
firebase deploy --only hosting
```

Note the deployed URL (typically `https://<project-id>.web.app/`).

- [ ] **Step 3: Smoke test deployed URL**

In browser, visit:

- `https://<project-id>.web.app/` — landing renders.
- `https://<project-id>.web.app/ayuda` — index renders.
- `https://<project-id>.web.app/ayuda/{first-slug}` — article renders.
- `https://<project-id>.web.app/sitemap.xml` — XML returns.
- `https://<project-id>.web.app/robots.txt` — text returns.

Use `curl` to verify HTML is prerendered (not just SPA shell):

```bash
curl -s https://<project-id>.web.app/ | grep -i "tu copiloto ia"
curl -s https://<project-id>.web.app/ayuda | grep -i "centro de ayuda"
```

Expected: matches.

---

### Task 6.2: Validate share cards and rich results

- [ ] **Step 1: Open Graph debugger**

Visit https://opengraph.xyz/url/https://%3Cproject-id%3E.web.app/ — verify:

- Title shows correctly.
- Description shows correctly.
- og:image renders.

Repeat for `/ayuda` and one `/ayuda/{slug}`.

- [ ] **Step 2: Twitter card validator** (if account)

Visit https://cards-dev.twitter.com/validator and paste deployed URL. Should show "summary_large_image" card.

- [ ] **Step 3: Google Rich Results Test**

Visit https://search.google.com/test/rich-results and paste a `/ayuda/{slug}` URL. Should detect `Article` type with no errors.

- [ ] **Step 4: If any failures, fix and re-deploy**

Common issues:

- og:image URL must be absolute and accessible.
- JSON-LD must be valid (use https://validator.schema.org/).

---

### Task 6.3: Submit sitemap to Google Search Console

- [ ] **Step 1: Verify domain ownership in Search Console**

Open https://search.google.com/search-console.

If the domain isn't verified yet, follow the verification flow (DNS TXT record, HTML file, or analytics). For Firebase Hosting on `*.web.app`, the recommended method is the HTML file upload.

- [ ] **Step 2: Submit sitemap**

In Search Console → Sitemaps:

- Enter `https://<project-id>.web.app/sitemap.xml`
- Submit.

Expected: status "Success" (sitemap discovered).

- [ ] **Step 3: Document for the user**

Inform user that:

- Indexing will take 2-4 weeks for full coverage.
- They can monitor coverage in Search Console → Pages.
- Any indexing issues will appear there.

---

## Self-Review Checklist (run before sharing this plan)

✓ Spec coverage:

- F1.0 sweep: Tasks 0.1-0.7 cover the full rename matrix from spec section 7.A.
- F1.1 routing: Tasks 1.1-1.7 cover catalog + router refactor + redirects + nav updates + AppShell.
- F1.2 content: Tasks 2.1-2.9 cover schema + migration + curation checkpoint + indexer + tool + re-index + cleanup.
- F1.3 prerender: Tasks 3.0-3.5 cover spike + library setup + sitemap + robots + Firebase config.
- F1.4 landing: Tasks 4.1-4.9 cover all sections + Helmet + og-image + verification.
- F1.5 help: Tasks 5.1-5.6 cover search + index + breadcrumb + article + JSON-LD + verification.
- F1.6 verification: Tasks 6.1-6.3 cover deploy + share cards + Search Console.

✓ Placeholder scan: no "TBD"/"TODO"/"implement later". Each step has actual code or commands. The one ambiguity (`vite-react-ssg` API specifics) is gated by the spike (Task 3.0) with documented fallback.

✓ Type consistency: `HelpArticle` interface + `HELP_CATEGORIES` shape used consistently. `searchArticles(query, articles)` signature consistent across tests and component usage. Path builders in `appRouteCatalog.ts` consistent with router `<Route path>` declarations.

✓ Risk mitigations from spec section 7.D have explicit task placement: spike for vite-react-ssg (Task 3.0), curation checkpoint (Task 2.3), grep audit for residue (Task 0.7), agent retrieval verification (Task 2.8), `&` escaping verified inline (HTML uses `&amp;`, JSON/JS strings literal).

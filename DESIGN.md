---
name: Pick&Coach
description: Sports-broadcast workspace for basketball coaches with Pick, an AI assistant always on the bench beside you.
colors:
  court-orange: '#f97316'
  court-orange-deep: '#ea580c'
  club-orange: '#FF8300'
  score-clock-blue: '#1A6FD4'
  score-clock-blue-deep: '#1535A8'
  electric-line-cyan: '#00F0FF'
  midnight-electric: '#0A0E27'
  trophy-amber: '#EFBF04'
  trophy-amber-deep: '#CC9F00'
  pick-purple: '#8B5CF6'
  alert-red: '#DC2626'
  success-green: '#10B981'
  event-partido: '#F43F5E'
  event-entreno: '#1A6FD4'
  event-playoff: '#EFBF04'
  ink-900: '#0F172A'
  ink-700: '#334155'
  ink-500: '#64748B'
  ink-400: '#94A3B8'
  ash-200: '#E2E8F0'
  ash-100: '#F1F5F9'
  ash-50: '#F8FAFC'
  surface-white: '#FFFFFF'
  surface-night: '#06060F'
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: 'clamp(2.25rem, 5.5vw, 3.75rem)'
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: '-0.02em'
  headline:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    fontSize: 'clamp(1.5rem, 3vw, 2.25rem)'
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: '-0.015em'
  title:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 700
    letterSpacing: '0.1em'
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
    fontSize: '0.75rem'
    fontWeight: 400
rounded:
  sm: '6px'
  md: '8px'
  lg: '12px'
  xl: '16px'
  full: '9999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '16px'
  lg: '24px'
  xl: '32px'
  '2xl': '48px'
  '3xl': '80px'
components:
  button-cta-landing:
    backgroundColor: '{colors.court-orange}'
    textColor: '{colors.surface-white}'
    rounded: '{rounded.lg}'
    padding: '14px 28px'
  button-cta-landing-hover:
    backgroundColor: '{colors.court-orange-deep}'
  button-primary-app:
    backgroundColor: '{colors.score-clock-blue}'
    textColor: '{colors.surface-white}'
    rounded: '{rounded.md}'
    padding: '8px 12px'
  button-primary-app-hover:
    backgroundColor: '{colors.score-clock-blue-deep}'
  button-ghost:
    backgroundColor: '{colors.ash-100}'
    textColor: '{colors.ink-700}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
  button-ghost-hover:
    backgroundColor: '{colors.ash-200}'
  button-danger:
    backgroundColor: '{colors.alert-red}'
    textColor: '{colors.surface-white}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
  card-match:
    backgroundColor: '{colors.surface-white}'
    textColor: '{colors.ink-900}'
    rounded: '{rounded.lg}'
    padding: '0px'
  card-team-gradient:
    backgroundColor: '{colors.score-clock-blue-deep}'
    textColor: '{colors.surface-white}'
    rounded: '{rounded.xl}'
    padding: '20px'
  input-text:
    backgroundColor: '{colors.surface-white}'
    textColor: '{colors.ink-900}'
    rounded: '{rounded.sm}'
    padding: '8px 12px'
  modal-panel:
    backgroundColor: '{colors.surface-white}'
    textColor: '{colors.ink-900}'
    rounded: '{rounded.lg}'
    padding: '24px'
  pick-avatar:
    backgroundColor: '{colors.court-orange}'
    textColor: '{colors.surface-white}'
    rounded: '{rounded.full}'
    size: '28px'
---

# Design System: Pick&Coach

## 1. Overview

**Creative North Star: "The Bench Beside Pick"**

Pick&Coach is a basketball coaching workspace where Pick, an AI assistant, is already sat next to the coach on the bench. The interface enacts that relationship literally: orange CTAs that open like a teammate calling a play, electric-cyan controls that snap like a 24-second clock, amber that arrives when the trophy does, and motion that always narrates a basketball moment (the shot going up, the PDF resolving into a bracket, Pick thinking before responding).

The atmosphere is **court-side, alive, intentional**. Sports-broadcast energy held together by craft. Every gradient, every shadow, every keyframe is doing a job. Decoration without narrative is the absolute failure mode.

The system explicitly rejects:

- Generic SaaS templates (hero-metric cards, identical icon grids, glassmorphism).
- Legacy coaching software (FastModel-era density, beige tables, PDF-first UI).
- Consumer fitness/social aesthetics (gamified streaks, neon graphs, leaderboards).
- Plain AI chat shells (the blank-prompt minimalism of ChatGPT.com).

**Key Characteristics:**

- Two intentional accents: **Court Orange** for brand and Pick affordances, **Score-Clock Cyan** for in-app utility actions. Never collapsed into one.
- Motion narrates. Every keyframe should be describable in a sentence ("Pick is thinking", "the bracket is being drawn", "the team card is sliding in").
- Color does wayfinding: amber means trophy / your-team, purple means Pick, red means destructive.
- Light by default in the private app; light-or-dark on public surfaces.
- System fonts only. The voice carries the brand; type doesn't need to be designed on top.

## 2. Colors

The palette uses four named accents, each with a single defended job, anchored by a tinted slate scale ("Ink" / "Ash") that leans cool. Never pure white, never pure black.

### Primary

- **Court Orange** (`#f97316`, with deep stop `#ea580c`): the brand color and the Pick affordance color. Lives on landing CTAs, the Pick avatar, eyebrow tags, and any moment where the system is greeting the user. The 135° gradient (`#f97316 → #ea580c`) is the one signature gradient, used only on primary brand CTAs.
- **Club Orange** (`#FF8300`): the legacy "club orange" defined in `tailwind.config.js` as `orange-500`. Coexists with Court Orange. Tailwind utilities (`bg-orange-500`) resolve here, while inline CTA gradients use the literal `#f97316`. Treat as a known drift; the `HomeScreen` orange team card uses this Club Orange ramp on purpose.

### Secondary

- **Score-Clock Cyan** (`#1A6FD4` mid, `#1535A8` hover, `#0F1E6B` deep, `#0A0E27` midnight): the in-app workhorse. Primary action buttons inside `/area-privada` (the `ToolbarButton` blue), nav chrome, dark card gradients on `HomeScreen`, the user-message bubble in Pick conversations. Reserves the loud orange for moments that matter.
- **Electric Line Cyan** (`#00F0FF`, the Tailwind `blue-400` override): rare, for highlight strokes and electric accents. Never as a fill for long-form text.

### Tertiary

- **Trophy Amber** (`#EFBF04`, deep `#CC9F00`): exclusively about competition outcomes. The header of the final match in a bracket, "your team's path" connector lines (so a coach can scan a bracket and find their team in 1.5 seconds), the trophy icon, the playoff badge on team cards. **Amber is reserved.** It must never appear as a generic accent.
- **Pick Purple** (`#8B5CF6`): the AI-only color. Appears in step three of "Cómo funciona", in micro-scenes featuring Pick conversations, and in any future UI that visually attributes content to Pick. Not used elsewhere.

### Neutral

- **Ink** scale (slate, cool-tinted):
  - **Ink-900** (`#0F172A`): primary text on light surfaces.
  - **Ink-700** (`#334155`): secondary text, body copy on light cards.
  - **Ink-500** (`#64748B`): tertiary, captions, labels.
  - **Ink-400** (`#94A3B8`): placeholder, disabled, "por determinar" italics.
- **Ash** scale (slate, lighter):
  - **Ash-200** (`#E2E8F0`): borders, dividers.
  - **Ash-100** (`#F1F5F9`): subtle row backgrounds, ghost-button rest.
  - **Ash-50** (`#F8FAFC`): page background, card-group backgrounds.
- **Surface White** (`#FFFFFF`): card backgrounds, modal panels. Never a flat page background; always lifted on Ash-50 or Ash-100.
- **Surface Night** (`#06060F`): the deep dark used in landing dark mode. Carries the orange and blue radial blobs that bleed across the hero.

### Semantic

- **Alert Red** (`#DC2626`, with surrounds `#FEE2E2` / `#7F1D1D`): destructive confirmations, danger buttons, "loser" badge in bracket rows. Soft variants `bg-rose-50` / `text-rose-500` on `MatchCard` loser rows.
- **Success Green** (`#10B981`, Tailwind emerald-500): completion ticks, success bullets in landing copy ("100% gratuito" dot), generic winner row in `MatchCard` (`bg-emerald-100` / `text-emerald-800`).

### Event palette (Calendar / WeekStrip / dots)

Events have three categories that need to be spotted at a glance across the calendar grid, week strip, and home dots. The palette is canonical:

- **Partido** → `bg-rose-500` (`#F43F5E`). Tailwind rose, also used as the event chip background in `MonthGrid` and `WeekView`. Soft tint `bg-rose-100` / `text-rose-600` on home weekly summary chip.
- **Entrenamiento** → team color from `TEAM_COLORS` array (per-team identity). Default in dot rows: `bg-blue-500`.
- **Playoff** → `bg-amber-500`. This is the **one allowed leak** of Trophy Amber outside the strict reservation: a playoff event IS the path to the trophy, so the visual link is intentional. Trophy Amber stays reserved everywhere else.

The "today" indicator on `MonthGrid`, `WeekView` and home `WeekStrip` uses `bg-amber-400` + `text-slate-900` + `font-bold` — defended pair (passes WCAG AA, distinct from event dots which are `amber-500`).

### Named Rules

**The Two-Accent Rule.** Court Orange and Score-Clock Cyan are not interchangeable. **Orange = brand and Pick.** **Cyan = in-app utility.** Never use orange for an in-app save button. Never use cyan as the landing CTA. The day they collapse into one, the system loses its narrative.

**The Trophy-Amber Reservation.** Amber is for the trophy and what leads to it: trophy icon, final-match header, "your team's path" connector lines in `BracketNode`, "today" indicator on calendar/week-strip (the day is the spotlight, not a trophy — so use `amber-400` not `amber-500` to keep it visually separate), the playoff event chip, and the playoff badge on `WeeklySummaryChip`. Anywhere else it dilutes the bracket's signal. If you're tempted to use amber as a generic warm accent, use Court Orange instead. **The known exception**: the analog Cuaderno wraparound — paper-feel, deliberately warm — is allowed to use amber tints (`bg-amber-50/100` on the Cuaderno quick-action card, paper portada accents) because the whole surface is intentionally evoking a coach's physical notebook.

**The Pick-Purple Reservation.** Purple is Pick. Don't use it for users, calendars, scouting, or any non-AI surface. A future reader should be able to point at any purple in the product and say "that's where Pick is talking."

## 3. Typography

**Display Font:** Tailwind's default sans stack (`ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, ...`).
**Body Font:** Same stack.
**Mono:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, ...`. Used inside the chat-window chrome label ("Pick&Coach · copiloto IA").

**Character:** System fonts on purpose. The voice is in the copy (active verbs, baloncesto vocabulary, tutea), not in a custom typeface. Type does scale and weight contrast aggressively (`font-extrabold` 800 alongside `font-normal` 400 inside the same hero), so hierarchy still has snap without buying a license.

### Hierarchy

- **Display** (800, `clamp(2.25rem, 5.5vw, 3.75rem)`, line-height ~1.08, `tracking-tight` -0.02em): the landing H1, the homepage hero, milestone heads.
- **Headline** (800, `clamp(1.5rem, 3vw, 2.25rem)`, line-height ~1.15): section titles inside long pages and screens (`HomeScreen` greetings, `CuadernoScreen` tab heads).
- **Title** (700, `1.125rem` to `1.25rem`, line-height ~1.3): card titles, modal heads, team names on `TeamCard`.
- **Body** (400, `1rem`, line-height 1.5, max line length 65–75ch on landing prose): paragraph copy, descriptions, bracket "Por determinar" placeholders.
- **Label** (700, `0.75rem`, `letter-spacing: 0.1em`, UPPERCASE): eyebrow tags ("CÓMO FUNCIONA"), `MatchCard` round headers, category labels ("MINIBASKET · MIXTO"), score-clock chrome.
- **Mono** (400, `0.75rem`): chat-window chrome label, debug strings.

### Named Rules

**The All-Caps-For-Eyebrows-Only Rule.** UPPERCASE plus `tracking-widest` is reserved for eyebrows and labels. Never set body, button, or heading text in caps. Caps stop being a signal if they're everywhere.

**The Heading-Pair Rule.** A pair of `font-extrabold tracking-tight` headings followed by a `font-normal text-slate-600` body is the canonical block. If a screen has neither, it is drifting toward "admin panel".

## 4. Elevation

Pick&Coach is **layered with purpose**, not flat. Cards lift, modals float, the Pick chat box glows. But every shadow has a job: indicate hover state, separate a card from a busy gradient background, signal that something is "above" the surface (modals, dropdowns).

The hero chat box uses an animated orange glow (`box-shadow: 0 0 24px 0 rgba(249, 115, 22, .15)` pulsing to `0 0 48px 8px rgba(249, 115, 22, .35)`). Pick's "presence" expressed as a heartbeat. This is the only animated shadow in the system; reserved for the landing demo.

### Shadow Vocabulary

- **Resting card** (`shadow-md`: `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): default `MatchCard`, secondary cards.
- **Final-match card** (Tailwind `shadow-amber-200 shadow-lg`, an amber-tinted lift): the bracket's final match. The amber glow says "this is where it ends."
- **Lifted card** (`shadow-xl`): modal panels, dropdowns, dialog children.
- **Team-card heavy** (`shadow-2xl`): the gradient `TeamCard` on `HomeScreen`. The heavy lift is intentional; it competes with a saturated background and needs to read as the dominant object.
- **Pick glow** (animated orange, see above): landing hero only.

### Named Rules

**The Shadow-Means-State Rule.** Shadows are not decoration. A resting card uses `shadow-md`; on hover it goes `shadow-lg`. A modal is `shadow-xl`. If a shadow doesn't change between states or doesn't justify the lift, remove it.

**The Glow-Is-Pick's-Heartbeat Rule.** The animated orange glow on the hero chat box is reserved for that specific surface. Don't replicate it on other cards or buttons. If everything glows, nothing does.

## 5. Components

### Buttons

Two parallel button systems, each with a defended role.

- **Landing CTA (Court Orange gradient).**
  - **Shape:** `rounded-xl` (12px), padding `14px 28px`, `font-bold` 700 white text.
  - **Background:** `linear-gradient(135deg, #f97316, #ea580c)`.
  - **Hover:** `transform: scale(1.02)`. A subtle lift, no color change.
  - **Where:** hero CTA, navbar primary CTA, final-CTA section. Anywhere the user is being recruited _into_ the product.

- **App primary (Score-Clock Cyan)**, exposed as `ToolbarButton variant="primary"`.
  - **Shape:** `rounded-lg` (8px), `h-9 px-3` desktop, `w-full px-4 py-3` mobile, `font-bold`.
  - **Background:** `bg-blue-600` resting → `bg-blue-700` hover (resolves to `#1A6FD4` → `#1535A8` per the Tailwind config override).
  - **Where:** bracket toolbar, in-app primary actions, save buttons. Anywhere the user is _operating_ the product.

- **App accent gradient**, `ToolbarButton variant="accent"`.
  - `bg-gradient-to-r from-blue-700 to-blue-500`. Reserved for "primary among primaries", the most important action on a screen.

- **Ghost**, `ToolbarButton variant="ghost"`.
  - `bg-blue-800 hover:bg-blue-700 text-white`. Used inside a saturated dark toolbar where Score-Clock Cyan would over-pop.

- **Danger** (`ConfirmDialog destructive` variant).
  - `bg-red-600 hover:bg-red-700 text-white`.

**The Two-Button Rule.** Inside `/area-privada`, never use the orange gradient as a primary action. On the landing or help, never use blue as a primary CTA. Cross the line and the narrative ("orange = Pick / brand, blue = utility") falls apart.

### Cards

Two card families, both `rounded-2xl` (16px) but visually opposite.

- **MatchCard / functional card.** `bg-white border border-slate-300 shadow-md` resting → `shadow-lg` on hover. White panels with `border-b border-slate-100` row dividers internally. The final match swaps to `border-amber-400 shadow-amber-200 shadow-lg` and its header bar goes `bg-amber-400 text-white`.
- **TeamCard / hero card.** Full gradient (`from-blue-900 via-blue-800 to-blue-700` and friends), white text, `shadow-2xl`, embedded `bg-white/15` quick-action circles, `text-blue-300` eyebrows. Used on `HomeScreen` to make each team feel like a brand object, not a row.

**The No-Nested-Cards Rule.** A `MatchCard` does not contain a sub-card. A `TeamCard` does not contain a sub-card. Nested cards are always wrong. If you need grouping inside a card, use spacing and dividers (already the pattern in `MatchCard`).

### Inputs

- **Text input.** `border border-slate-300 rounded` (6px), padding `p-1.5` to `px-3 py-2`, `bg-white`, `font-normal`. Focus: `focus:ring-2 focus:ring-blue-500 focus:outline-none`. The blue focus ring is the system focus ring everywhere.
- **Disabled.** `bg-slate-100 text-transparent` (the bracket score-input pattern, keeps width but blanks the value when a game is skipped by series).
- **Score input** (signature). `w-[72px] h-8 text-center text-sm font-semibold`, no spinners (`[appearance:textfield]`). Compact and number-pad friendly.

### Modals

- **Backdrop.** `fixed inset-0 bg-slate-900/60 backdrop-blur-sm`. Slate-900 at 60% with a small blur. Not pure black, not over-glass.
- **Panel.** `bg-white rounded-xl shadow-xl max-w-sm w-full p-6`, with `animate-slide-up` entrance (the `slide-up` keyframe: 16px → 0, ease-out, 0.25s).
- **Behavior.** Focus trap, Escape closes, Tab cycles, body scroll lock, focus restored on close (see `Dialog.jsx`).

### Bracket connectors (signature)

The bracket tree (`BracketNode.jsx`) draws connector lines between matches: 2px wide, `bg-slate-300` neutral, `bg-amber-500` when the line is on "your team's path through the tournament". A coach can scan a 16-team bracket and find their team's road to the trophy in the time it takes to blink. This is the system's purest expression of "color does wayfinding".

### Pick chat surface (signature)

Pick's avatar is a 28px round badge with `linear-gradient(135deg, #f97316, #ea580c)` and a white "P". Pick's response blocks are pill-shaped tinted-orange or neutral cards with leading emoji and a single bolded summary line. The "Pick is thinking" state is three orange dots animating in a staggered cadence (1.2s loop, 0.16s offset between dots). This visual grammar should reappear anywhere Pick speaks.

### Navigation

- **Public navbar** (`PublicNavbar.jsx`). Sticky, `backdrop-blur-sm`, transparent-when-at-top + opaque-on-scroll. Trophy icon plus bold "Pick&Coach" lockup on the left, two text links in the middle, theme toggle plus orange CTA on the right.
- **Active link.** `text-orange-400`. Always orange. Public space is brand territory.

## 6. Do's and Don'ts

### Do

- **Do** keep Court Orange and Score-Clock Cyan in their lanes (orange for brand and Pick, cyan for in-app utility).
- **Do** treat amber as a reservation. It appears with the trophy, the final, and "your team's path", never as decoration.
- **Do** make every animation describable as a sentence. If you cannot narrate it, delete it.
- **Do** respect `prefers-reduced-motion: reduce` from the first commit, the way `src/index.css` already does.
- **Do** use system fonts. The voice carries the brand. Adding a custom typeface is a strategic decision, not a styling tweak.
- **Do** keep Pick Purple as the AI-only color so future users can spot Pick by hue alone.
- **Do** use Score-Clock Cyan focus rings (`focus-visible:ring-blue-400`) consistently. The blue focus ring is the system focus ring.

### Don't

- **Don't** build any of the four anti-references from PRODUCT.md. Specifically:
  - **Don't** ship hero-metric templates (big number plus small label plus supporting stats plus gradient accent). That's the SaaS cliché PRODUCT.md explicitly rejects.
  - **Don't** make grids of identical icon-heading-text cards. Pick&Coach already has visually distinct card families (`MatchCard`, `TeamCard`, the playoff scrolltelling). Use them.
  - **Don't** use glassmorphism as a default surface treatment. The `PublicNavbar` uses one targeted `backdrop-blur`. That is the budget.
  - **Don't** rebuild Pick as a plain chat shell. The conversation is a layer over the workspace, not the workspace itself.
- **Don't** use side-stripe borders (`border-l-4` colored stripes) as a decorative accent on cards or rows. (Existing instances in `MatchCard` for winner / loser / myTeam rows are a known violation; rework when polished, replace the stripe with a full row tint or a leading icon.)
- **Don't** use gradient text (`background-clip: text` over a gradient) as a headline treatment. (Existing instance in the hero "más inteligente." span is a known violation; flag for polish.)
- **Don't** mix the two oranges in the same screen. Pick one (`#f97316` for inline gradients, `#FF8300` only when going through Tailwind utilities) and stay consistent until the drift is resolved.
- **Don't** add em dashes (—) in copy. The system uses commas, colons, semicolons, periods, and parentheses.
- **Don't** introduce a new accent color. Every additional color halves the meaning of the existing four.
- **Don't** invent new shadow values. The vocabulary is `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`, plus the amber-tinted final-match shadow and the Pick glow. If you need a new one, you probably need a different layout.
- **Don't** use the orange CTA gradient on a private-app surface. If a private screen "needs" it for emphasis, the screen has a layout problem, not a color problem.

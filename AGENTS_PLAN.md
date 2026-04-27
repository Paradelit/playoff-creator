# IMPLEMENTATION PLAN: Multi-Agent Architecture + Langfuse Observability

> **This file is a self-contained implementation plan.** It contains all the context and instructions needed to implement the changes described below. Read it fully before starting any work.

---

## PROJECT CONTEXT

### What this project is

Basketball coaching SPA: React 19 + Vite 8 + Firebase (Auth, Firestore, Storage, Hosting) + Tailwind CSS.  
**No TypeScript yet** — all plain JS/JSX. No backend — currently a static SPA served from Firebase Hosting.

### Current AI system

There are 3 AI functions in `src/services/aiService.js` that call the Gemini REST API **directly from the browser**:

| Function                  | Purpose                                    | Called from                       |
| ------------------------- | ------------------------------------------ | --------------------------------- |
| `callGeminiForBracket()`  | Parse competition PDFs → bracket structure | `src/hooks/useBracketCreation.js` |
| `callGeminiForCalendar()` | Extract training sessions from Excel       | `src/hooks/useCalendarImport.js`  |
| `callGeminiForResults()`  | Extract match scores from game reports     | `src/hooks/useBracketEditor.js`   |

A private function `callGemini()` handles the actual HTTP call with model fallback chain (`gemini-flash-latest` → `gemini-2.0-flash` → `gemini-1.5-flash`).

**Problem:** The Gemini API key is exposed in the frontend as `VITE_GEMINI_API_KEY` — it gets embedded in the JS bundle. This is a security risk.

### Current architecture

- **Provider stack (nesting order):** `BrowserRouter → FirebaseProvider → AuthProvider → ToastProvider → AppRouter`
- **Contexts:** `FirebaseContext`, `AuthContext`, `BracketContext`, `ToastContext`
- **Firebase config:** `firebase.json` has `hosting` and `firestore` — NO `functions` yet
- **Routing:** `src/shell/AppRouter.jsx` with React Router v7, lazy-loaded screens
- **Existing file `extractTextFromFile()`** in `aiService.js` handles PDF/text extraction — this stays in the frontend

### Key files to read before implementing

- `CLAUDE.md` — project conventions, architecture, data model
- `src/services/aiService.js` — current AI logic to migrate (258 lines)
- `src/hooks/useBracketCreation.js` — consumes bracket AI (192 lines)
- `src/hooks/useCalendarImport.js` — consumes calendar AI (210 lines)
- `src/hooks/useBracketEditor.js` — consumes results AI (357 lines)
- `src/shell/CoachesApp.jsx` — provider stack to modify
- `firebase.json` — needs functions config added
- `.env` — has VITE_GEMINI_API_KEY that must be removed
- `vite.config.js` — may need chunk config for langfuse
- `package.json` — current dependencies

---

## WHAT TO BUILD

### Goal

Replace the 3 direct Gemini API calls in the frontend with:

1. **Firebase Cloud Functions v2 backend** (TypeScript) containing a multi-agent architecture
2. **Agent Router/Orchestrator** that routes requests to specialized agents
3. **Langfuse integration** for full observability (tracing, spans, generations, user feedback)
4. **TypeScript** for all new code (`allowJs: true` for coexistence with existing JS)
5. **AI Chat** with intent-based routing (user sends free text → router classifies → dispatches to agent)
6. **Feedback UI component** (thumbs up/down) that sends scores to Langfuse via Cloud Functions

### Architecture diagram

```
Browser (React SPA)
  └─ AIContext (provides runAgent, aiChat, submitFeedback)
       └─ httpsCallable() ──→ Firebase Cloud Functions v2
                                  └─ index.ts (callable functions: runAgent, aiChat, submitFeedback)
                                       └─ AgentRouter
                                            ├─ routeExplicit(agentName, input) → for existing flows
                                            └─ routeByIntent(userMessage, context) → for AI chat
                                                 └─ AgentOrchestrator
                                                      ├─ BracketAgent  ──→ LLMProvider ──→ Gemini API
                                                      ├─ CalendarAgent ──→ LLMProvider ──→ Gemini API
                                                      └─ ResultsAgent  ──→ LLMProvider ──→ Gemini API
                                                 └─ ObservabilityService ──→ Langfuse Cloud (secret key)
```

---

## CONFIRMED DECISIONS

- **Backend:** Firebase Cloud Functions v2 (2nd gen, Node.js 22, TypeScript)
- **Agent framework:** Custom lightweight (no LangGraph) — design interfaces for future LangGraph migration
- **TypeScript:** Incremental — `allowJs: true` in frontend tsconfig. ALL new code in TypeScript. Existing JS migrates gradually.
- **Langfuse:** Cloud (free Hobby plan). Both public + secret keys via Firebase Secret Manager. Active in dev and production.
- **Migration strategy:** Big-bang — migrate all 3 hooks at once, delete old AI functions from aiService.js
- **Feedback UI:** Yes — AIFeedback.tsx component with thumbs up/down → Langfuse scores via callable function
- **Intent router:** Yes, part of initial scope — routeByIntent() for free-text AI chat
- **Extensibility:** registerAgent() method for future agents (training generator, stats analyzer)
- **Deployment strategy:** DEV-FIRST — nothing reaches production until manually verified by the user (see DEPLOYMENT STRATEGY section below)

---

## DEPLOYMENT STRATEGY — DEV-FIRST, NO PRODUCTION UNTIL VERIFIED

**CRITICAL RULE: Do NOT deploy to production, do NOT merge to main, and do NOT run `firebase deploy` (without emulator flags) until the user has explicitly verified everything works in dev.**

### Git branching

All work MUST happen on a feature branch:

```bash
git checkout -b feat/agent-architecture
```

Do NOT merge this branch into `main` until the user gives explicit approval. All commits go to this branch.

### Local development with Firebase Emulators

Use Firebase Emulators for ALL testing during development. This avoids touching production Cloud Functions, Firestore, or Auth:

```bash
# Start all emulators (functions + firestore + auth + hosting)
firebase emulators:start
```

The frontend dev server (`npm run dev`) must connect to the local emulators, not to production Firebase. Add emulator connection in the Firebase init code:

```typescript
// Only in development — connect to local emulators
if (import.meta.env.DEV) {
  const { connectFunctionsEmulator } = await import('firebase/functions');
  connectFunctionsEmulator(getFunctions(undefined, 'europe-west1'), 'localhost', 5001);
}
```

This snippet should be added to `src/services/aiClient.ts` or to `FirebaseContext.jsx` during development.

### What counts as "dev verified"

Before the user approves for production, ALL of the following must work locally with emulators:

1. Creating a bracket with PDFs → full flow via emulated Cloud Function → Gemini → response renders correctly
2. Importing calendar from Excel → full flow via emulated Cloud Function
3. Uploading match results → full flow via emulated Cloud Function
4. AI Chat panel → sends message → receives classified response
5. AIFeedback → sends score → appears in Langfuse dashboard
6. Langfuse dashboard shows traces, spans, and generations
7. `npm run build` succeeds and `VITE_GEMINI_API_KEY` is NOT in the bundle
8. All existing tests pass (`npm test`)

### Production deployment (ONLY after user approval)

Once the user has verified everything in dev, the production deployment is:

```bash
# 1. Merge branch to main
git checkout main
git merge feat/agent-architecture

# 2. Deploy functions + hosting to production
firebase deploy

# 3. Verify production
# User manually tests the same flows in the live app
```

**The implementor must STOP and notify the user when dev verification is ready.** Do not proceed to production deployment autonomously.

---

## IMPLEMENTATION — STEP BY STEP

Execute these phases in order. Each phase must be completed and verified before moving to the next.

**Reminder: All work on branch `feat/agent-architecture`. All testing via Firebase Emulators. No production deploy.**

### PHASE 0: TypeScript Setup

**Goal:** Enable TypeScript in the project without breaking existing code.

#### Step 0.1: Install TypeScript dependencies (frontend)

```bash
npm install --save-dev typescript
```

Note: `@types/react` and `@types/react-dom` are already installed.

#### Step 0.2: Create `tsconfig.json` at project root

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "allowJs": true,
    "checkJs": false,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "functions"],
}
```

#### Step 0.3: Update ESLint config

Add TypeScript parser support for `.ts/.tsx` files in `eslint.config.js`. Keep existing JS rules working.

#### Step 0.4: Verify

```bash
npx tsc --noEmit   # should pass (allowJs + checkJs:false means no errors on JS)
npm run build       # should pass
npm test            # should pass
```

---

### PHASE 1: Firebase Cloud Functions Setup

**Goal:** Initialize Cloud Functions and configure secrets.

#### Step 1.1: Initialize functions

```bash
firebase init functions
```

Choose:

- **Language:** TypeScript
- **ESLint:** Yes
- **Install dependencies:** Yes

This creates `functions/` directory with its own `package.json`, `tsconfig.json`, etc.

#### Step 1.2: Install backend dependencies

```bash
cd functions
npm install langfuse
```

#### Step 1.3: Update `firebase.json`

Ensure it includes the functions config alongside existing hosting and firestore configs.

#### Step 1.4: Set up secrets

These will be set when the user has the actual keys. For now, ensure the code references them via `defineSecret()`:

```bash
firebase functions:secrets:set GEMINI_API_KEY         # the current VITE_GEMINI_API_KEY value
firebase functions:secrets:set LANGFUSE_PUBLIC_KEY     # from Langfuse Cloud dashboard
firebase functions:secrets:set LANGFUSE_SECRET_KEY     # from Langfuse Cloud dashboard
firebase functions:secrets:set LANGFUSE_BASE_URL       # https://cloud.langfuse.com
```

---

### PHASE 2: Backend Infrastructure (`functions/src/ai/`)

**Goal:** Build the infrastructure layer — types, LLM provider, observability, prompt manager.

#### Step 2.1: Create `functions/src/ai/types.ts`

Define all shared TypeScript interfaces:

```typescript
// TraceContext — passed through the agent pipeline for observability
export interface TraceContext {
  trace: any; // Langfuse trace object
  span?: any; // Langfuse span object
}

// Result from an LLM generation
export interface LLMResult<T = unknown> {
  data: T;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

// Result of intent classification by the router
export interface IntentResult {
  agent: string;
  confidence: number;
  input: Record<string, unknown>;
  fallbackMessage?: string;
}

// Options for agent execution
export interface AgentExecutionOptions {
  userId: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

// Agent descriptor for intent routing prompt
export interface AgentDescriptor {
  name: string;
  description: string;
  inputSchema: string;
}
```

#### Step 2.2: Create `functions/src/ai/observability.ts`

Wrapper over Langfuse SDK with **secret key** (only possible server-side).

Requirements:

- Initialize Langfuse client using `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` from environment
- `createTrace({ name, userId, sessionId, metadata })` → returns trace object
- `createSpan(trace, { name, input })` → returns span object
- `logGeneration(span, { model, input, output, latencyMs, tokens })` → logs LLM call
- `logScore(traceId, { name, value, comment })` → logs user feedback
- `flush()` → calls `shutdownAsync()` — **critical in Cloud Functions** since the environment dies after response
- If Langfuse is not configured (missing keys), operate as no-op — never throw

#### Step 2.3: Create `functions/src/ai/llmProvider.ts`

Migrate the `callGemini()` private function from `src/services/aiService.js` into a proper class.

Requirements:

- Get API key from `process.env.GEMINI_API_KEY` (Firebase Secret Manager)
- Model fallback chain: `['gemini-2.5-flash-preview-04-17', 'gemini-2.0-flash', 'gemini-1.5-flash']`
- Same HTTP call logic: POST to `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- Same retry logic on 503, same error handling on 429/403
- Emit observability events: call `observability.logGeneration()` with model, latency, tokens
- Return typed `LLMResult<T>` with parsed JSON
- Accept `onStatus` callback to report progress (model being used, retries)

#### Step 2.4: Create `functions/src/ai/promptManager.ts`

Extract the 3 large prompt strings from `src/services/aiService.js` into versioned templates.

Requirements:

- `PROMPTS.BRACKET_CREATION` — extract the prompt from `callGeminiForBracket()` lines 100-147
- `PROMPTS.CALENDAR_IMPORT` — extract the prompt from `callGeminiForCalendar()` lines 164-223
- `PROMPTS.RESULTS_EXTRACT` — extract the prompt from `callGeminiForResults()` lines 236-247
- `PROMPTS.INTENT_ROUTING` — NEW prompt that classifies user intent given a free-text message and a list of available agents. Should return JSON with `{ agent, confidence, input, fallbackMessage }`
- Each prompt is a function that takes its variables and returns the full prompt string
- Each prompt has a `version` field for tracking in Langfuse

---

### PHASE 3: Backend Agents (`functions/src/ai/agents/`)

**Goal:** Create the specialized agents.

#### Step 3.1: Create `functions/src/ai/agents/baseAgent.ts`

Abstract base class using Template Method pattern:

```typescript
export abstract class BaseAgent<TInput, TOutput> {
  abstract readonly name: string;
  abstract readonly description: string;
  protected llmProvider: LLMProvider;
  protected observability: ObservabilityService;

  constructor(deps: { llmProvider: LLMProvider; observability: ObservabilityService }) {
    this.llmProvider = deps.llmProvider;
    this.observability = deps.observability;
  }

  async execute(input: TInput, traceContext: TraceContext, options?: AgentExecutionOptions): Promise<TOutput> {
    const span = this.observability.createSpan(traceContext.trace, { name: this.name, input });
    try {
      const validated = this.validateInput(input);
      const prompt = this.buildPrompt(validated);
      const raw = await this.llmProvider.generate<unknown>({ prompt, traceContext: { ...traceContext, span } });
      const result = this.processOutput(raw.data, validated);
      // end span with success
      return result;
    } catch (error) {
      // end span with error
      throw error;
    }
  }

  abstract validateInput(input: TInput): TInput;
  abstract buildPrompt(input: TInput): string;
  abstract processOutput(raw: unknown, input: TInput): TOutput;

  describe(): AgentDescriptor {
    return { name: this.name, description: this.description, inputSchema: '' };
  }
}
```

#### Step 3.2: Create `functions/src/ai/agents/bracketAgent.ts`

Migrate logic from `callGeminiForBracket()` AND the validation/normalization from `useBracketCreation.js` lines 70-98.

```typescript
export interface BracketInput {
  basesText: string;
  clasifText: string;
  userInstructions?: string;
}

export interface BracketAIResult {
  tournamentName: string;
  analysis: string;
  rounds: Array<{ name: string; dates: string[]; format: string; gamesCount: number }>;
  initialMatches: Array<{
    title: string;
    team1: string | null;
    team2: string | null;
    team1Origin: string;
    team2Origin: string;
    team1Options: string[];
    team2Options: string[];
  }>;
}
```

The `processOutput` method must:

1. Validate `initialMatches` array exists and is non-empty
2. Normalize match count to nearest power of 2 (truncate if needed)
3. Normalize each match to ensure all required fields have defaults
4. This logic currently lives in `useBracketCreation.js` lines 76-98 — move it here

#### Step 3.3: Create `functions/src/ai/agents/calendarAgent.ts`

Migrate logic from `callGeminiForCalendar()`.

```typescript
export interface CalendarInput {
  excelText: string;
  teams: Array<{ id: string; teamName: string }>;
}

export interface CalendarAIResult {
  analysis: string;
  recurring: Array<{
    teamId: string;
    teamName: string;
    diaSemana: number;
    horaInicio: string;
    horaFin: string;
    lugar: string;
    tipo: string;
  }>;
  specific: Array<{
    teamId: string;
    teamName: string;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    lugar: string;
    tipo: string;
    rival: string;
  }>;
}
```

The `processOutput` method must validate that `recurring` and `specific` are arrays (defaulting to []).

#### Step 3.4: Create `functions/src/ai/agents/resultsAgent.ts`

Migrate logic from `callGeminiForResults()`.

```typescript
export interface ResultsInput {
  bracketState: Array<{
    id: string;
    title: string;
    team1: string | null;
    team2: string | null;
    gamesCount: number;
    format: string;
  }>;
  resultsText: string;
}

export interface ResultsAIResult {
  updatedMatches: Array<{ id: string; scores: Array<{ s1: string; s2: string }> }>;
}
```

---

### PHASE 4: Backend Orchestration + API (`functions/src/`)

**Goal:** Build the router, orchestrator, and expose callable functions.

#### Step 4.1: Create `functions/src/ai/agentRouter.ts`

```typescript
export class AgentRouter {
  private agents: Map<string, BaseAgent<any, any>> = new Map();
  private llmProvider: LLMProvider;
  private observability: ObservabilityService;

  constructor(deps: {
    agents: Record<string, BaseAgent<any, any>>;
    llmProvider: LLMProvider;
    observability: ObservabilityService;
  });

  // Explicit routing: caller knows which agent to use
  async routeExplicit<T>(
    agentName: string,
    input: unknown,
    options: AgentExecutionOptions,
  ): Promise<{ result: T; traceId: string }>;

  // Intent-based routing: LLM classifies user message
  async routeByIntent(
    userMessage: string,
    context: Record<string, unknown>,
    options: AgentExecutionOptions,
  ): Promise<
    | { type: 'agent_result'; agent: string; result: unknown; traceId: string }
    | { type: 'no_match'; message: string; traceId: string }
  >;

  // Register new agents dynamically
  registerAgent(name: string, agent: BaseAgent<any, any>): void;

  // Internal: classify intent using PROMPTS.INTENT_ROUTING
  private async classifyIntent(
    message: string,
    agentDescriptions: AgentDescriptor[],
    context: Record<string, unknown>,
    traceContext: TraceContext,
  ): Promise<IntentResult>;
}
```

#### Step 4.2: Create `functions/src/ai/agentOrchestrator.ts`

```typescript
export interface PipelineStep {
  agent: string;
  input: Record<string, unknown>;
  outputKey: string;
}

export class AgentOrchestrator {
  constructor(deps: { router: AgentRouter; observability: ObservabilityService });
  async executePipeline(steps: PipelineStep[], options: AgentExecutionOptions): Promise<Record<string, unknown>>;
}
```

#### Step 4.3: Create `functions/src/ai/index.ts`

Re-export all public types and classes.

#### Step 4.4: Create `functions/src/index.ts`

The main entry point for Cloud Functions. Expose 3 callable functions:

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const geminiKey = defineSecret('GEMINI_API_KEY');
const langfusePublicKey = defineSecret('LANGFUSE_PUBLIC_KEY');
const langfuseSecretKey = defineSecret('LANGFUSE_SECRET_KEY');

// Singleton initialization (reused across warm invocations)
let router: AgentRouter | null = null;
let observability: ObservabilityService | null = null;

function getSystem() {
  /* lazy init */
}

// 1. runAgent — execute a specific agent by name
export const runAgent = onCall(
  { secrets: [geminiKey, langfusePublicKey, langfuseSecretKey], region: 'europe-west1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
    const { agent, input } = request.data;
    const system = getSystem();
    try {
      return await system.router.routeExplicit(agent, input, { userId: request.auth.uid });
    } finally {
      await system.observability.flush();
    }
  },
);

// 2. aiChat — route by intent (free-text AI chat)
export const aiChat = onCall(
  { secrets: [geminiKey, langfusePublicKey, langfuseSecretKey], region: 'europe-west1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
    const { message, context } = request.data;
    const system = getSystem();
    try {
      return await system.router.routeByIntent(message, context || {}, { userId: request.auth.uid });
    } finally {
      await system.observability.flush();
    }
  },
);

// 3. submitFeedback — user feedback → Langfuse scores
export const submitFeedback = onCall(
  { secrets: [langfusePublicKey, langfuseSecretKey], region: 'europe-west1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
    const { traceId, score, comment } = request.data;
    const system = getSystem();
    system.observability.logScore(traceId, { name: 'user-feedback', value: score, comment });
    await system.observability.flush();
    return { success: true };
  },
);
```

Use `region: 'europe-west1'` since the project appears to be Spain-based (Spanish language throughout).

#### Step 4.5: Verify backend

```bash
cd functions
npm run build     # TypeScript compiles
npm test          # if tests exist
```

---

### PHASE 5: Frontend Changes

**Goal:** Replace direct Gemini calls with Cloud Functions calls. Simplify the frontend.

#### Step 5.1: Install langfuse in frontend (for chunk splitting only, not usage)

Actually, Langfuse is NOT needed in the frontend anymore — it's all server-side now. Skip this.

#### Step 5.2: Create `src/services/aiClient.ts`

Lightweight client that calls Cloud Functions:

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

export async function runAgent<TResult>(
  agentName: string,
  input: Record<string, unknown>,
): Promise<{ result: TResult; traceId: string }> {
  const functions = getFunctions(undefined, 'europe-west1');
  const callable = httpsCallable(functions, 'runAgent');
  const response = await callable({ agent: agentName, input });
  return response.data as { result: TResult; traceId: string };
}

export async function aiChat(
  message: string,
  context?: Record<string, unknown>,
): Promise<{ type: string; result: unknown; traceId: string }> {
  const functions = getFunctions(undefined, 'europe-west1');
  const callable = httpsCallable(functions, 'aiChat');
  const response = await callable({ message, context });
  return response.data as any;
}

export async function submitFeedback(traceId: string, score: number, comment?: string): Promise<void> {
  const functions = getFunctions(undefined, 'europe-west1');
  const callable = httpsCallable(functions, 'submitFeedback');
  await callable({ traceId, score, comment });
}
```

#### Step 5.3: Create `src/contexts/AIContext.tsx`

```tsx
import { createContext, useContext, useMemo } from 'react';
import { runAgent, aiChat, submitFeedback } from '../services/aiClient';

interface AIContextValue {
  runAgent: typeof runAgent;
  aiChat: typeof aiChat;
  submitFeedback: typeof submitFeedback;
}

const AIContext = createContext<AIContextValue | null>(null);

export function AIProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => ({ runAgent, aiChat, submitFeedback }), []);
  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAI(): AIContextValue {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI must be used within AIProvider');
  return ctx;
}
```

#### Step 5.4: Modify `src/shell/CoachesApp.jsx`

Add `AIProvider` to the provider stack. New order:

`BrowserRouter → FirebaseProvider → AuthProvider → AIProvider → ToastProvider → AppRouter`

#### Step 5.5: Modify `src/hooks/useBracketCreation.js`

Replace:

```javascript
import { extractTextFromFile, callGeminiForBracket } from '../services/aiService';
```

With:

```javascript
import { extractTextFromFile } from '../services/aiService';
import { useAI } from '../contexts/AIContext';
```

In the hook body, add: `const { runAgent } = useAI();`

Replace the call to `callGeminiForBracket` AND the power-of-2 validation/normalization (lines 65-98) with:

```javascript
const { result: aiData, traceId } = await runAgent('bracket', {
  basesText,
  clasifText,
  userInstructions: customPrompt,
});
// aiData is already validated and normalized by BracketAgent on the server
```

Store `traceId` for use with AIFeedback component.

#### Step 5.6: Modify `src/hooks/useCalendarImport.js`

Replace `callGeminiForCalendar` import and usage:

```javascript
import { useAI } from '../contexts/AIContext';
// ...
const { runAgent } = useAI();
// ...
const { result } = await runAgent('calendar', {
  excelText: csvParts.join('\n\n'),
  teams: teamList,
});
```

Remove the `callGeminiForCalendar` import.

#### Step 5.7: Modify `src/hooks/useBracketEditor.js`

Replace `callGeminiForResults` import and usage:

```javascript
import { extractTextFromFile } from '../services/aiService';
import { useAI } from '../contexts/AIContext';
// ...
const { runAgent } = useAI();
// ...
const { result: aiResults } = await runAgent('results', {
  bracketState: simplifiedBracket,
  resultsText,
});
```

#### Step 5.8: Create `src/components/AIFeedback.tsx`

Thumbs up/down component that sends feedback to Langfuse via callable function:

```tsx
import { useState } from 'react';
import { useAI } from '../contexts/AIContext';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface AIFeedbackProps {
  traceId: string | null;
}

export default function AIFeedback({ traceId }: AIFeedbackProps) {
  const { submitFeedback } = useAI();
  const [submitted, setSubmitted] = useState<'positive' | 'negative' | null>(null);

  if (!traceId) return null;

  const handleFeedback = async (value: number) => {
    setSubmitted(value > 0 ? 'positive' : 'negative');
    try {
      await submitFeedback(traceId, value);
    } catch {
      // silent fail — feedback is non-critical
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <span>¿Te fue útil?</span>
      <button
        onClick={() => handleFeedback(1)}
        disabled={!!submitted}
        className={`p-1 rounded hover:bg-green-50 ${submitted === 'positive' ? 'text-green-600' : ''}`}
      >
        <ThumbsUp size={16} />
      </button>
      <button
        onClick={() => handleFeedback(0)}
        disabled={!!submitted}
        className={`p-1 rounded hover:bg-red-50 ${submitted === 'negative' ? 'text-red-600' : ''}`}
      >
        <ThumbsDown size={16} />
      </button>
      {submitted && <span className="text-xs text-slate-300">¡Gracias!</span>}
    </div>
  );
}
```

Integrate this component in `PreviewScreen.jsx` (bracket preview) after the bracket is shown.

#### Step 5.9: Create `src/hooks/useAIChat.ts`

```typescript
import { useState } from 'react';
import { useAI } from '../contexts/AIContext';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  traceId?: string;
  agentUsed?: string;
}

export function useAIChat() {
  const { aiChat, submitFeedback } = useAI();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  async function sendMessage(userMessage: string, context?: Record<string, unknown>) {
    const userMsg: ChatMessage = { id: Date.now(), role: 'user', content: userMessage };
    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);
    try {
      const result = await aiChat(userMessage, context);
      const assistantMsg: ChatMessage = {
        id: Date.now(),
        role: 'assistant',
        content: result.type === 'no_match' ? (result as any).message : JSON.stringify((result as any).result, null, 2),
        traceId: result.traceId,
        agentUsed: result.type === 'agent_result' ? (result as any).agent : undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      return result;
    } finally {
      setIsProcessing(false);
    }
  }

  return { messages, isProcessing, sendMessage, submitFeedback };
}
```

#### Step 5.10: Create `src/components/AIChatPanel.tsx`

A floating chat panel component accessible from any screen. Design it as a slide-out panel or modal. Use the existing Tailwind design system. Include:

- Message history with user/assistant bubbles
- Input field with send button
- Loading state while processing
- AIFeedback component on each assistant message
- Agent indicator showing which agent responded

---

### PHASE 6: Cleanup

#### Step 6.1: Clean up `src/services/aiService.js`

Delete these functions (they are now in Cloud Functions):

- `callGemini()` (private)
- `callGeminiForBracket()`
- `callGeminiForCalendar()`
- `callGeminiForResults()`

Keep only:

- `getPdfjs()` (private)
- `extractTextFromFile()` (exported — used by hooks for PDF/text extraction before sending to backend)

#### Step 6.2: Remove `VITE_GEMINI_API_KEY` from `.env`

Delete the line `VITE_GEMINI_API_KEY=...` from `.env`. The key is now in Firebase Secret Manager.

#### Step 6.3: Update `.env.example`

Remove `VITE_GEMINI_API_KEY` line. Add a comment explaining keys are in Firebase Secret Manager:

```
# AI keys are managed via Firebase Secret Manager (firebase functions:secrets:set)
# See AGENTS_PLAN.md for setup instructions
```

#### Step 6.4: Update `vite.config.js`

No Langfuse chunk needed in frontend anymore (Langfuse is server-side only). No changes needed.

---

## VERIFICATION CHECKLIST (DEV — before requesting user approval)

All checks must pass **locally with Firebase Emulators** before notifying the user:

### Build checks

- [ ] `npx tsc --noEmit` passes in project root (frontend TypeScript)
- [ ] `cd functions && npm run build` passes (backend TypeScript compiles)
- [ ] `npm test` passes in project root (existing frontend tests)
- [ ] `npm run build` passes (Vite production build)
- [ ] `VITE_GEMINI_API_KEY` does NOT appear in the built JS bundle (`dist/`)

### Functional checks (with `firebase emulators:start`)

- [ ] Creating a bracket with PDFs works end-to-end (frontend → emulated Cloud Function → Gemini → response)
- [ ] Importing calendar from Excel works end-to-end
- [ ] Uploading match results works end-to-end
- [ ] AI Chat panel sends text → receives classified response
- [ ] AIFeedback component sends scores successfully
- [ ] Langfuse dashboard shows traces with spans, generations, and scores

### When all checks pass

**STOP. Do not deploy to production.** Notify the user that dev verification is ready and wait for their explicit approval before merging to `main` or running `firebase deploy`.

## VERIFICATION CHECKLIST (PRODUCTION — after user approval)

Only after the user says "deploy to production":

- [ ] `git checkout main && git merge feat/agent-architecture`
- [ ] `firebase deploy` succeeds (hosting + functions)
- [ ] User manually verifies bracket creation in live app
- [ ] User manually verifies calendar import in live app
- [ ] User manually verifies results upload in live app
- [ ] User confirms Langfuse traces appear for production usage

---

## FILE SUMMARY

### New files (backend — `functions/src/`)

| File                         | Purpose                               |
| ---------------------------- | ------------------------------------- |
| `ai/types.ts`                | Shared TypeScript interfaces          |
| `ai/observability.ts`        | Langfuse wrapper with secret key      |
| `ai/llmProvider.ts`          | Gemini API client with model fallback |
| `ai/promptManager.ts`        | Versioned prompt templates            |
| `ai/agents/baseAgent.ts`     | Abstract base agent class             |
| `ai/agents/bracketAgent.ts`  | Bracket creation agent                |
| `ai/agents/calendarAgent.ts` | Calendar import agent                 |
| `ai/agents/resultsAgent.ts`  | Results extraction agent              |
| `ai/agentRouter.ts`          | Router with explicit + intent modes   |
| `ai/agentOrchestrator.ts`    | Pipeline orchestrator                 |
| `ai/index.ts`                | Public re-exports                     |
| `index.ts`                   | Callable functions API                |

### New files (frontend — `src/`)

| File                         | Purpose                              |
| ---------------------------- | ------------------------------------ |
| `services/aiClient.ts`       | Lightweight callable function client |
| `contexts/AIContext.tsx`     | React context providing AI functions |
| `hooks/useAIChat.ts`         | Chat hook with intent routing        |
| `components/AIFeedback.tsx`  | Thumbs up/down feedback component    |
| `components/AIChatPanel.tsx` | Chat panel UI                        |

### Modified files

| File                              | Change                                             |
| --------------------------------- | -------------------------------------------------- |
| `tsconfig.json`                   | NEW — TypeScript config                            |
| `firebase.json`                   | Add functions config                               |
| `.env` / `.env.example`           | Remove VITE_GEMINI_API_KEY                         |
| `eslint.config.js`                | Add TS parser support                              |
| `src/services/aiService.js`       | Delete AI functions, keep only extractTextFromFile |
| `src/hooks/useBracketCreation.js` | Use useAI().runAgent('bracket', ...)               |
| `src/hooks/useCalendarImport.js`  | Use useAI().runAgent('calendar', ...)              |
| `src/hooks/useBracketEditor.js`   | Use useAI().runAgent('results', ...)               |
| `src/shell/CoachesApp.jsx`        | Add AIProvider to provider stack                   |
| `src/screens/PreviewScreen.jsx`   | Add AIFeedback component                           |

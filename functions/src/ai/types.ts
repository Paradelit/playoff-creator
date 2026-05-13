/** Langfuse trace context passed through the agent pipeline */
export interface TraceContext {
  trace: unknown;
  span?: unknown;
}

/** Result from an LLM generation */
export interface LLMResult<T = unknown> {
  data: T;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

/** Result of intent classification by the router */
export interface IntentResult {
  agent: string;
  confidence: number;
  input: Record<string, unknown>;
  fallbackMessage?: string;
}

/** Options for agent execution */
export interface AgentExecutionOptions {
  userId: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

/** Agent descriptor for intent routing prompt */
export interface AgentDescriptor {
  name: string;
  description: string;
  inputSchema: string;
}

/** LLM generation request */
export interface LLMGenerateRequest {
  prompt: string;
  traceContext: TraceContext;
  onStatus?: (status: string) => void;
}

/**
 * Snapshot semántico de lo que el coach está viendo. Lo computa el frontend
 * (cada screen relevante registra su helper) y viaja por el callable hasta
 * el system prompt. Permite a Pick resolver referencias como "este equipo"
 * o "este partido" sin tool calls.
 *
 * Sub-A.5 — fase frontend pendiente. Hoy el campo es opcional y, si no
 * llega, el system prompt cae al render bruto (screen + route + entityId).
 */
export interface ScreenSemantic {
  /** Código semántico estable: "team-detail", "calendar", "bracket-editor", etc. */
  surface: string;
  /** Frase legible para el LLM: "Visualizando equipo Juniors B, 12 jugadores...". */
  label: string;
  /** Map de frases referenciales → entityId. Ej: { "este equipo": "team-abc" }. */
  referableIds?: Record<string, string>;
}

/** Screen context from the frontend */
export interface ScreenContextData {
  screen: string;
  route: string;
  params: Record<string, string>;
  entityType?: string;
  entityId?: string;
  data?: Record<string, unknown>;
  /** Snapshot semántico opcional. Si presente, el orchestrator lo prefiere
   *  sobre el render bruto de screen/route/entityId. */
  semantic?: ScreenSemantic;
}

/** Action the agent can suggest */
export interface AgentAction {
  type: "navigate" | "create";
  label: string;
  path?: string;
  data?: unknown;
}

/** Enhanced response from the AI system */
export interface EnrichedResponse {
  type: "agent_result" | "conversational" | "no_match";
  agent?: string;
  result?: unknown;
  naturalResponse: string;
  suggestedMode: "compact" | "panel" | "column";
  actions?: AgentAction[];
  traceId: string;
}

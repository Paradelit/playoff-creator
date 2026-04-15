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

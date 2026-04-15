import { Langfuse } from "langfuse";

interface CreateTraceParams {
  name: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

interface CreateSpanParams {
  name: string;
  input?: unknown;
}

interface LogGenerationParams {
  model: string;
  input: string;
  output: unknown;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

interface LogScoreParams {
  name: string;
  value: number;
  comment?: string;
}

export class ObservabilityService {
  private client: Langfuse | null = null;

  constructor() {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const baseUrl = process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com";

    if (publicKey && secretKey) {
      this.client = new Langfuse({ publicKey, secretKey, baseUrl });
    }
  }

  createTrace(params: CreateTraceParams): unknown {
    if (!this.client) return {};
    return this.client.trace({
      name: params.name,
      userId: params.userId,
      sessionId: params.sessionId,
      metadata: params.metadata,
    });
  }

  createSpan(trace: unknown, params: CreateSpanParams): unknown {
    if (!this.client || !trace) return {};
    const t = trace as { span: (p: { name: string; input: unknown }) => unknown };
    if (typeof t.span !== "function") return {};
    return t.span({ name: params.name, input: params.input });
  }

  logGeneration(
    span: unknown,
    params: LogGenerationParams
  ): void {
    if (!this.client || !span) return;
    const s = span as { generation: (p: Record<string, unknown>) => void };
    if (typeof s.generation !== "function") return;
    s.generation({
      name: "llm-call",
      model: params.model,
      input: params.input,
      output: params.output,
      metadata: {
        latencyMs: params.latencyMs,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
      },
    });
  }

  endSpan(span: unknown, output?: unknown, error?: string): void {
    if (!span) return;
    const s = span as { end: (p?: Record<string, unknown>) => void };
    if (typeof s.end !== "function") return;
    s.end(error ? { output: error, level: "ERROR" } : { output });
  }

  logScore(traceId: string, params: LogScoreParams): void {
    if (!this.client) return;
    this.client.score({
      traceId,
      name: params.name,
      value: params.value,
      comment: params.comment,
    });
  }

  async flush(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.shutdownAsync();
    } catch (err) {
      console.error("Langfuse flush error:", err);
    }
  }
}

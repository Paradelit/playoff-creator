import { BaseAgent } from "./agents/baseAgent";
import { LLMProvider } from "./llmProvider";
import { ObservabilityService } from "./observability";
import { AgentExecutionOptions, AgentDescriptor, IntentResult, TraceContext } from "./types";
import { PROMPTS } from "./promptManager";

export class AgentRouter {
  private agents: Map<string, BaseAgent<unknown, unknown>> = new Map();
  private llmProvider: LLMProvider;
  private observability: ObservabilityService;

  constructor(deps: {
    agents: Record<string, BaseAgent<unknown, unknown>>;
    llmProvider: LLMProvider;
    observability: ObservabilityService;
  }) {
    this.llmProvider = deps.llmProvider;
    this.observability = deps.observability;
    for (const [name, agent] of Object.entries(deps.agents)) {
      this.agents.set(name, agent);
    }
  }

  /** Explicit routing: caller knows which agent to use */
  async routeExplicit<T>(
    agentName: string,
    input: unknown,
    options: AgentExecutionOptions
  ): Promise<{ result: T; traceId: string }> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent "${agentName}" not found. Available: ${Array.from(this.agents.keys()).join(", ")}`);
    }

    const trace = this.observability.createTrace({
      name: `agent:${agentName}`,
      userId: options.userId,
      sessionId: options.sessionId,
      metadata: options.metadata,
    });

    const traceId = (trace as { id?: string })?.id || "";
    const traceContext: TraceContext = { trace };

    const result = await agent.execute(input, traceContext, options);
    return { result: result as T, traceId };
  }

  /** Intent-based routing: LLM classifies user message */
  async routeByIntent(
    userMessage: string,
    context: Record<string, unknown>,
    options: AgentExecutionOptions
  ): Promise<
    | { type: "agent_result"; agent: string; result: unknown; traceId: string }
    | { type: "no_match"; message: string; traceId: string }
  > {
    const trace = this.observability.createTrace({
      name: "intent-routing",
      userId: options.userId,
      sessionId: options.sessionId,
      metadata: { ...options.metadata, userMessage },
    });

    const traceId = (trace as { id?: string })?.id || "";
    const traceContext: TraceContext = { trace };

    const agentDescriptions = Array.from(this.agents.values()).map((a) => a.describe());
    const intent = await this.classifyIntent(userMessage, agentDescriptions, context, traceContext);

    if (!intent.agent || intent.confidence < 0.5) {
      return {
        type: "no_match",
        message: intent.fallbackMessage || "No entendí tu solicitud. Puedo ayudarte a crear brackets, importar calendarios o procesar resultados.",
        traceId,
      };
    }

    const agent = this.agents.get(intent.agent);
    if (!agent) {
      return {
        type: "no_match",
        message: `No encontré el agente "${intent.agent}".`,
        traceId,
      };
    }

    const result = await agent.execute(intent.input, traceContext, options);
    return { type: "agent_result", agent: intent.agent, result, traceId };
  }

  /** Register new agents dynamically */
  registerAgent(name: string, agent: BaseAgent<unknown, unknown>): void {
    this.agents.set(name, agent);
  }

  private async classifyIntent(
    message: string,
    agentDescriptions: AgentDescriptor[],
    context: Record<string, unknown>,
    traceContext: TraceContext
  ): Promise<IntentResult> {
    const span = this.observability.createSpan(traceContext.trace, {
      name: "classify-intent",
      input: message,
    });

    const prompt = PROMPTS.INTENT_ROUTING.build(message, agentDescriptions, context);
    const result = await this.llmProvider.generate<IntentResult>({
      prompt,
      traceContext: { ...traceContext, span },
    });

    this.observability.endSpan(span, result.data);
    return result.data;
  }
}

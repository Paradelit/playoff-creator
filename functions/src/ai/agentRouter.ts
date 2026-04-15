import { BaseAgent } from "./agents/baseAgent";
import { LLMProvider } from "./llmProvider";
import { ObservabilityService } from "./observability";
import {
  AgentExecutionOptions,
  AgentDescriptor,
  IntentResult,
  TraceContext,
  ScreenContextData,
  EnrichedResponse,
} from "./types";
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

  /** Intent-based routing: LLM classifies user message, returns EnrichedResponse */
  async routeByIntent(
    userMessage: string,
    context: Record<string, unknown>,
    options: AgentExecutionOptions,
    screenContext?: ScreenContextData,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<EnrichedResponse> {
    const trace = this.observability.createTrace({
      name: "intent-routing",
      userId: options.userId,
      sessionId: options.sessionId,
      metadata: { ...options.metadata, userMessage },
    });

    const traceId = (trace as { id?: string })?.id || "";
    const traceContext: TraceContext = { trace };

    const agentDescriptions = Array.from(this.agents.values()).map((a) => a.describe());
    const intent = await this.classifyIntent(
      userMessage,
      agentDescriptions,
      { ...context, screenContext },
      traceContext,
      screenContext,
      conversationHistory
    );

    // Route to conversational agent for low-confidence or explicit conversational match
    if (!intent.agent || intent.agent === "conversational" || intent.confidence < 0.5) {
      const conversational = this.agents.get("conversational");
      if (conversational) {
        const result = (await conversational.execute(
          { userMessage, screenContext, conversationHistory },
          traceContext,
          options
        )) as { naturalResponse: string; suggestedMode: "compact" | "panel" | "column"; actions?: unknown[] };
        return {
          type: "conversational",
          naturalResponse: result.naturalResponse,
          suggestedMode: result.suggestedMode,
          actions: result.actions as EnrichedResponse["actions"],
          traceId,
        };
      }
      return {
        type: "no_match",
        naturalResponse:
          intent.fallbackMessage ||
          "No entendí tu solicitud. Puedo ayudarte a crear brackets, importar calendarios, generar entrenamientos o procesar resultados.",
        suggestedMode: "panel",
        traceId,
      };
    }

    // Route to specialized agent
    const agent = this.agents.get(intent.agent);
    if (!agent) {
      return {
        type: "no_match",
        naturalResponse: `No encontré el agente "${intent.agent}".`,
        suggestedMode: "panel",
        traceId,
      };
    }

    const result = await agent.execute(intent.input, traceContext, options);

    // Wrap result in natural language
    const wrapped = await this.wrapInNaturalLanguage(intent.agent, result, screenContext, traceContext);

    return {
      type: "agent_result",
      agent: intent.agent,
      result,
      naturalResponse: wrapped.naturalResponse,
      suggestedMode: wrapped.suggestedMode,
      actions: wrapped.actions,
      traceId,
    };
  }

  /** Register new agents dynamically */
  registerAgent(name: string, agent: BaseAgent<unknown, unknown>): void {
    this.agents.set(name, agent);
  }

  private async classifyIntent(
    message: string,
    agentDescriptions: AgentDescriptor[],
    context: Record<string, unknown>,
    traceContext: TraceContext,
    screenContext?: ScreenContextData,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<IntentResult> {
    const span = this.observability.createSpan(traceContext.trace, {
      name: "classify-intent",
      input: message,
    });

    const prompt = PROMPTS.INTENT_ROUTING.build(message, agentDescriptions, context, screenContext, conversationHistory);
    const result = await this.llmProvider.generate<IntentResult>({
      prompt,
      traceContext: { ...traceContext, span },
    });

    this.observability.endSpan(span, result.data);
    return result.data;
  }

  private async wrapInNaturalLanguage(
    agentName: string,
    result: unknown,
    screenContext: ScreenContextData | undefined,
    traceContext: TraceContext
  ): Promise<{ naturalResponse: string; suggestedMode: "compact" | "panel" | "column"; actions?: EnrichedResponse["actions"] }> {
    const span = this.observability.createSpan(traceContext.trace, {
      name: "wrap-natural-language",
      input: { agentName },
    });

    try {
      const prompt = PROMPTS.NATURAL_RESPONSE_WRAPPER.build(agentName, result, screenContext);
      const llmResult = await this.llmProvider.generate<{
        naturalResponse: string;
        suggestedMode: string;
        actions: Array<{ type: "navigate" | "create"; label: string; path?: string; data?: unknown }>;
      }>({
        prompt,
        traceContext: { ...traceContext, span },
      });

      this.observability.endSpan(span, llmResult.data);
      return {
        naturalResponse: llmResult.data.naturalResponse || "Operación completada.",
        suggestedMode: (["compact", "panel", "column"].includes(llmResult.data.suggestedMode)
          ? llmResult.data.suggestedMode
          : "panel") as "compact" | "panel" | "column",
        actions: Array.isArray(llmResult.data.actions) ? llmResult.data.actions : [],
      };
    } catch {
      this.observability.endSpan(span, undefined, "Failed to wrap in natural language");
      return {
        naturalResponse: "Operación completada correctamente.",
        suggestedMode: "panel",
        actions: [],
      };
    }
  }
}

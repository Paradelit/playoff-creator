import { TraceContext, AgentExecutionOptions, AgentDescriptor, LLMGenerateRequest } from "../types";
import { LLMProvider } from "../llmProvider";
import { ObservabilityService } from "../observability";

export abstract class BaseAgent<TInput, TOutput> {
  abstract readonly name: string;
  abstract readonly description: string;
  protected llmProvider: LLMProvider;
  protected observability: ObservabilityService;

  constructor(deps: { llmProvider: LLMProvider; observability: ObservabilityService }) {
    this.llmProvider = deps.llmProvider;
    this.observability = deps.observability;
  }

  async execute(
    input: TInput,
    traceContext: TraceContext,
    _options?: AgentExecutionOptions
  ): Promise<TOutput> {
    const span = this.observability.createSpan(traceContext.trace, {
      name: this.name,
      input,
    });

    try {
      const validated = this.validateInput(input);
      const prompt = this.buildPrompt(validated);
      const request: LLMGenerateRequest = {
        prompt,
        traceContext: { ...traceContext, span },
      };
      const raw = await this.llmProvider.generate<unknown>(request);
      const result = this.processOutput(raw.data, validated);
      this.observability.endSpan(span, result);
      return result;
    } catch (error) {
      this.observability.endSpan(span, undefined, String(error));
      throw error;
    }
  }

  abstract validateInput(input: TInput): TInput;
  abstract buildPrompt(input: TInput): string;
  abstract processOutput(raw: unknown, input: TInput): TOutput;

  describe(): AgentDescriptor {
    return { name: this.name, description: this.description, inputSchema: "" };
  }
}

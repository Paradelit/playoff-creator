import { TraceContext, AgentExecutionOptions, AgentDescriptor, LLMGenerateRequest } from "../types";
import { LLMProvider } from "../llmProvider";
import { ObservabilityService } from "../observability";
import { PromptManager, CompiledPrompt } from "../promptManager";

export abstract class BaseAgent<TInput, TOutput> {
  abstract readonly name: string;
  abstract readonly description: string;
  protected llmProvider: LLMProvider;
  protected observability: ObservabilityService;
  protected promptManager: PromptManager;

  constructor(deps: { llmProvider: LLMProvider; observability: ObservabilityService; promptManager: PromptManager }) {
    this.llmProvider = deps.llmProvider;
    this.observability = deps.observability;
    this.promptManager = deps.promptManager;
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
      const compiled = await this.buildPrompt(validated);
      const request: LLMGenerateRequest = {
        prompt: compiled.text,
        traceContext: { ...traceContext, span },
      };
      const raw = await this.llmProvider.generate<unknown>(request);
      const result = this.processOutput(raw.data, validated);

      // Log generation with prompt version info for Langfuse analytics
      this.observability.logGeneration(span, {
        model: raw.model,
        input: compiled.text.substring(0, 500),
        output: result,
        latencyMs: raw.latencyMs,
        inputTokens: raw.inputTokens,
        outputTokens: raw.outputTokens,
        promptName: compiled.promptName,
        promptVersion: compiled.promptVersion,
      });

      this.observability.endSpan(span, result);
      return result;
    } catch (error) {
      this.observability.endSpan(span, undefined, String(error));
      throw error;
    }
  }

  abstract validateInput(input: TInput): TInput;
  abstract buildPrompt(input: TInput): Promise<CompiledPrompt>;
  abstract processOutput(raw: unknown, input: TInput): TOutput;

  describe(): AgentDescriptor {
    return { name: this.name, description: this.description, inputSchema: "" };
  }
}

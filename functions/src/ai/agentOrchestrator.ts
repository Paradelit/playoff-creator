import { AgentRouter } from "./agentRouter";
import { ObservabilityService } from "./observability";
import { AgentExecutionOptions } from "./types";

export interface PipelineStep {
  agent: string;
  input: Record<string, unknown>;
  outputKey: string;
}

export class AgentOrchestrator {
  private router: AgentRouter;
  private observability: ObservabilityService;

  constructor(deps: { router: AgentRouter; observability: ObservabilityService }) {
    this.router = deps.router;
    this.observability = deps.observability;
  }

  async executePipeline(
    steps: PipelineStep[],
    options: AgentExecutionOptions
  ): Promise<Record<string, unknown>> {
    const trace = this.observability.createTrace({
      name: "pipeline",
      userId: options.userId,
      sessionId: options.sessionId,
      metadata: { steps: steps.map((s) => s.agent) },
    });

    const results: Record<string, unknown> = {};

    for (const step of steps) {
      // Resolve input references from previous step outputs
      const resolvedInput: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(step.input)) {
        if (typeof value === "string" && value.startsWith("$")) {
          const ref = value.substring(1);
          resolvedInput[key] = results[ref];
        } else {
          resolvedInput[key] = value;
        }
      }

      const { result } = await this.router.routeExplicit(
        step.agent,
        resolvedInput,
        options
      );
      results[step.outputKey] = result;
    }

    // Flush after pipeline since trace is created here
    void trace; // trace is used for observability context
    return results;
  }
}

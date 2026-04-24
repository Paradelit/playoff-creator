import { ObservabilityService } from "./observability";
import { ContentBlock } from "./contentBlocks";

export interface AutoEvalMetrics {
  toolCalls: Array<{ name: string }>;
  loopDetected: boolean;
  contentBlocks: ContentBlock[];
}

/**
 * AutoEvaluator scores a completed orchestrator run on several quality
 * dimensions and writes the results to Langfuse via ObservabilityService.
 * Scores are always in the range 0.0–1.0.
 *
 * Dimensions:
 *   tool-efficiency      — unique tool names / total calls (1.0 if no calls)
 *   loop-detected        — 0.0 if a loop was detected, 1.0 otherwise
 *   response-completeness — heuristic: text length and presence
 *   tool-call-count      — 1 - min(calls / 8, 1.0) — rewards conciseness
 */
export class AutoEvaluator {
  constructor(private observability: ObservabilityService) {}

  score(traceId: string, metrics: AutoEvalMetrics): void {
    const { toolCalls, loopDetected, contentBlocks } = metrics;
    const totalToolCalls = toolCalls.length;

    // 1. tool-efficiency
    let toolEfficiency: number;
    let efficiencyComment: string;
    if (totalToolCalls === 0) {
      toolEfficiency = 1.0;
      efficiencyComment = "No tool calls — N/A";
    } else {
      const uniqueCount = new Set(toolCalls.map((t) => t.name)).size;
      toolEfficiency = uniqueCount / totalToolCalls;
      efficiencyComment = `${uniqueCount} unique / ${totalToolCalls} total`;
    }
    this.observability.logScore(traceId, {
      name: "tool-efficiency",
      value: toolEfficiency,
      comment: efficiencyComment,
    });

    // 2. loop-detected
    this.observability.logScore(traceId, {
      name: "loop-detected",
      value: loopDetected ? 0.0 : 1.0,
      comment: loopDetected ? "Loop detected in orchestrator run" : "No loop detected",
    });

    // 3. response-completeness
    const textBlocks = contentBlocks.filter(
      (b): b is { type: "text"; markdown: string } => b.type === "text"
    );
    let responseCompleteness: number;
    let completenessComment: string;
    if (textBlocks.length === 0) {
      responseCompleteness = 0.0;
      completenessComment = "No text blocks in response";
    } else {
      const hasSubstantialText = textBlocks.some((b) => b.markdown.length > 20);
      responseCompleteness = hasSubstantialText ? 1.0 : 0.5;
      completenessComment = hasSubstantialText
        ? `${textBlocks.length} text block(s), substantial content`
        : `${textBlocks.length} text block(s), short content`;
    }
    this.observability.logScore(traceId, {
      name: "response-completeness",
      value: responseCompleteness,
      comment: completenessComment,
    });

    // 4. tool-call-count
    const toolCallCountScore =
      totalToolCalls === 0 ? 1.0 : 1 - Math.min(totalToolCalls / 8, 1.0);
    this.observability.logScore(traceId, {
      name: "tool-call-count",
      value: toolCallCountScore,
      comment: `${totalToolCalls} tool call(s)`,
    });
  }
}

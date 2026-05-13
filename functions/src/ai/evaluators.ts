import { ObservabilityService } from './observability';
import { ContentBlock } from './contentBlocks';
import type { UserDigest } from './digest/types';

export interface AutoEvalMetrics {
  toolCalls: Array<{ name: string }>;
  loopDetected: boolean;
  contentBlocks: ContentBlock[];
  /** Sub-A.7: digest del turno para puntuar context-richness. */
  userDigest?: UserDigest;
  /** Sub-A.7: screen semantic del turno para puntuar referencias contextuales. */
  screenSemantic?: { surface: string; referableIds?: Record<string, string> } | null;
}

/**
 * Computa un score 0.0–1.0 que refleja cuán "rico" salió el digest este
 * turno. Es la suma de campos opcionales populated dividida por 10 (max).
 *
 * Útil en Langfuse para trackear cobertura de datos sobre los turnos —
 * un workspace recién creado dará scores bajos, uno con histórico
 * acumulado dará scores altos. La curva sobre tiempo muestra si la
 * inversión en sub-A está rindiendo.
 */
export function computeDigestRichness(digest: UserDigest): number {
  let score = 0;
  if (digest.teams.length > 0) score += 0.1;
  if (digest.teams.some((t) => t.rosterSnapshot && t.rosterSnapshot.length > 0)) score += 0.1;
  if (digest.teams.some((t) => t.nextSession)) score += 0.1;
  if (digest.teams.some((t) => t.lastResult)) score += 0.1;
  if (digest.upcomingSessions.length > 0) score += 0.1;
  if (digest.recentPastSessions.length > 0) score += 0.1;
  if (digest.pendingActions.convocatorias.length > 0) score += 0.1;
  if (digest.pendingActions.scoutings.length > 0) score += 0.1;
  if (digest.pendingActions.analyses.length > 0) score += 0.1;
  if (digest.pendingActions.playerReports.length > 0) score += 0.1;
  return Math.min(1.0, Math.round(score * 10) / 10);
}

/**
 * Score 0.0/0.5/1.0 del screen semantic recibido este turno:
 * - 0.0: no hubo screenSemantic.
 * - 0.5: hubo screenSemantic pero sin referableIds (solo label).
 * - 1.0: hubo screenSemantic + referableIds no-vacío.
 */
export function computeScreenSemanticScore(
  semantic: { referableIds?: Record<string, string> } | null | undefined,
): number {
  if (!semantic) return 0.0;
  const refs = semantic.referableIds;
  if (!refs || Object.keys(refs).length === 0) return 0.5;
  return 1.0;
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
      efficiencyComment = 'No tool calls — N/A';
    } else {
      const uniqueCount = new Set(toolCalls.map((t) => t.name)).size;
      toolEfficiency = uniqueCount / totalToolCalls;
      efficiencyComment = `${uniqueCount} unique / ${totalToolCalls} total`;
    }
    this.observability.logScore(traceId, {
      name: 'tool-efficiency',
      value: toolEfficiency,
      comment: efficiencyComment,
    });

    // 2. loop-detected
    this.observability.logScore(traceId, {
      name: 'loop-detected',
      value: loopDetected ? 0.0 : 1.0,
      comment: loopDetected ? 'Loop detected in orchestrator run' : 'No loop detected',
    });

    // 3. response-completeness
    const textBlocks = contentBlocks.filter((b): b is { type: 'text'; markdown: string } => b.type === 'text');
    let responseCompleteness: number;
    let completenessComment: string;
    if (textBlocks.length === 0) {
      responseCompleteness = 0.0;
      completenessComment = 'No text blocks in response';
    } else {
      const hasSubstantialText = textBlocks.some((b) => b.markdown.length > 20);
      responseCompleteness = hasSubstantialText ? 1.0 : 0.5;
      completenessComment = hasSubstantialText
        ? `${textBlocks.length} text block(s), substantial content`
        : `${textBlocks.length} text block(s), short content`;
    }
    this.observability.logScore(traceId, {
      name: 'response-completeness',
      value: responseCompleteness,
      comment: completenessComment,
    });

    // 4. tool-call-count
    const toolCallCountScore = totalToolCalls === 0 ? 1.0 : 1 - Math.min(totalToolCalls / 8, 1.0);
    this.observability.logScore(traceId, {
      name: 'tool-call-count',
      value: toolCallCountScore,
      comment: `${totalToolCalls} tool call(s)`,
    });

    // 5. digest-richness (sub-A.7)
    if (metrics.userDigest) {
      const richness = computeDigestRichness(metrics.userDigest);
      this.observability.logScore(traceId, {
        name: 'digest-richness',
        value: richness,
        comment: `Populated optional sections: ${(richness * 10).toFixed(0)}/10`,
      });
    }

    // 6. screen-semantic-score (sub-A.7)
    if (metrics.screenSemantic !== undefined) {
      const score = computeScreenSemanticScore(metrics.screenSemantic);
      const refs = metrics.screenSemantic?.referableIds;
      const refCount = refs ? Object.keys(refs).length : 0;
      this.observability.logScore(traceId, {
        name: 'screen-semantic-score',
        value: score,
        comment: metrics.screenSemantic
          ? `surface=${metrics.screenSemantic.surface}, refs=${refCount}`
          : 'no screen semantic',
      });
    }

    // 7. confirm-choice-emitted (sub-B.7) — 1.0 if the turn short-circuited
    //    into a ConfirmChoice (ambiguity resolved without paying for an LLM turn).
    const hasConfirmChoice = contentBlocks.some((b) => b.type === 'confirm_choice');
    if (hasConfirmChoice) {
      this.observability.logScore(traceId, {
        name: 'confirm-choice-emitted',
        value: 1.0,
        comment: 'Ambiguity classifier emitted ConfirmChoice (saved an LLM turn)',
      });
    }
  }
}

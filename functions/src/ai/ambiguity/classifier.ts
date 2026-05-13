import type { UserDigest } from '../digest/types';
import type { ScreenContextData } from '../types';
import type { SummarizerLLM } from '../history/summarizer';
import { detectAmbiguity } from './heuristics';
import type { AmbiguityResult } from './types';

/**
 * Ambiguity classifier entrypoint (sub-B.3).
 *
 * Currently regex-only via `detectAmbiguity`. The `llm` slot is reserved for
 * sub-B.4, which will run a fast-model classification when the heuristic says
 * "clear" but we still want a second opinion (e.g. anaphoric references the
 * regex didn't catch). Keeping the slot now means B.4 is a non-breaking add.
 */
export interface ClassifierDeps {
  /** Optional. Reserved for sub-B.4 LLM fallback. */
  llm?: SummarizerLLM;
  /** When true, never call the LLM even if `llm` is provided. Used in tests. */
  heuristicsOnly?: boolean;
}

export async function classifyAmbiguity(
  _deps: ClassifierDeps,
  message: string,
  digest: UserDigest,
  screen: ScreenContextData | null,
): Promise<AmbiguityResult> {
  return detectAmbiguity(message, digest, screen);
}

import type { UserDigest } from '../digest/types';
import type { ScreenContextData, TraceContext } from '../types';
import type { SummarizerLLM } from '../history/summarizer';
import { detectAmbiguity } from './heuristics';
import { llmClassifyAmbiguity } from './llmClassifier';
import type { AmbiguityResult } from './types';

/**
 * Ambiguity classifier entrypoint.
 *
 * Two-stage:
 *   1. Regex heuristic (sub-B.3) catches the most common patterns cheaply
 *      ("del partido", "este equipo/jugador", out-of-scope finance/messaging).
 *   2. LLM fallback (sub-B.4) runs when the regex says "clear" but we have
 *      an LLM + traceContext available — a fast-model pass that can spot
 *      anaphora and other patterns the regex doesn't encode. Fails open.
 *
 * Skip LLM with `heuristicsOnly: true` (tests, or when the caller knows the
 * extra latency isn't worth it for trivially short greetings).
 */
export interface ClassifierDeps {
  /** Optional. When present, used as a second-opinion fast-model classifier. */
  llm?: SummarizerLLM;
  /** Required if llm is provided. Forwarded to the LLM provider. */
  traceContext?: TraceContext;
  /** When true, never call the LLM even if `llm` is provided. */
  heuristicsOnly?: boolean;
  /** Skip LLM for very short messages (<MIN_LLM_LEN chars). Default true —
   *  saves a fast-model call on "hola", "ok", "gracias", etc. */
  skipLlmForShortMessages?: boolean;
}

const MIN_LLM_LEN = 10;

export async function classifyAmbiguity(
  deps: ClassifierDeps,
  message: string,
  digest: UserDigest,
  screen: ScreenContextData | null,
): Promise<AmbiguityResult> {
  const heur = detectAmbiguity(message, digest, screen);
  if (heur.kind !== 'clear') return heur;
  if (deps.heuristicsOnly) return heur;
  if (!deps.llm || !deps.traceContext) return heur;
  const skipShort = deps.skipLlmForShortMessages !== false;
  if (skipShort && message.trim().length < MIN_LLM_LEN) return heur;
  return llmClassifyAmbiguity({ llm: deps.llm, traceContext: deps.traceContext }, message, digest);
}

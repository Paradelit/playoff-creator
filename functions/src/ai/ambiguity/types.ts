import type { AmbiguityCandidate } from '../../shared/pickContracts';

export type { AmbiguityCandidate };

export type AmbiguityKind = 'clear' | 'ambiguous' | 'out-of-scope';

export interface AmbiguityResult {
  kind: AmbiguityKind;
  /** Set when kind === "ambiguous". Phrasing for Pick to use when asking. */
  clarification?: string;
  /** Set when kind === "ambiguous". Candidates the user can pick from. */
  candidates?: AmbiguityCandidate[];
  /** Set when kind === "out-of-scope". Short explanation Pick can show. */
  reason?: string;
  /** Optional follow-up suggestion when kind === "out-of-scope". */
  suggestedAlternative?: string;
}

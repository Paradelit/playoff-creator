/**
 * Helpers para extraer la "ronda actual" + "siguiente partido" + "pending
 * scores" de un bracket doc. Independiente de Firestore — opera sobre el
 * `bracketData.state` ya leído.
 *
 * El modelo (ver `src/utils/bracketEngine.js` + CLAUDE.md):
 * - `state` es un map flat `{ matchId → match }`.
 * - Cada match: { id, title, team1, team2, round, winner, scores, dates,
 *   gamesCount, nextId, ... }.
 * - `rootId` apunta a la final.
 *
 * Sub-A.2 follow-up: lo difiero del PR original porque requería walk del
 * tree. Aquí está, plano y testable.
 */

export interface BracketMatch {
  id?: string;
  title?: string;
  team1?: string;
  team2?: string;
  round?: number;
  winner?: string | null;
  scores?: Array<{ s1?: unknown; s2?: unknown }>;
  dates?: string[];
  gamesCount?: number;
}

export interface BracketState {
  state?: Record<string, BracketMatch>;
  rootId?: string;
}

export interface BracketDerived {
  currentRound?: string;
  nextMatch?: {
    id: string;
    teamA: string;
    teamB: string;
    scheduled?: string;
  };
  pendingScores?: number;
}

function isCompleteSeries(m: BracketMatch): boolean {
  // Si winner está marcado, la serie está cerrada.
  return Boolean(m.winner);
}

function hasBothTeams(m: BracketMatch): boolean {
  return Boolean(m.team1 && m.team2);
}

export function deriveBracketState(data: BracketState): BracketDerived {
  if (!data || !data.state || typeof data.state !== "object") return {};
  const matches = Object.values(data.state).filter((m): m is BracketMatch => Boolean(m));
  if (matches.length === 0) return {};

  // Detecta rondas presentes; ordena asc para que la ronda más temprana
  // con pendientes sea la "actual".
  const rounds = Array.from(new Set(matches.map((m) => m.round).filter((r): r is number => typeof r === "number")));
  rounds.sort((a, b) => a - b);

  let currentRoundNum: number | undefined;
  for (const r of rounds) {
    const inRound = matches.filter((m) => m.round === r);
    if (inRound.some((m) => !isCompleteSeries(m))) {
      currentRoundNum = r;
      break;
    }
  }
  if (currentRoundNum === undefined) {
    // Bracket completo: todas las rondas tienen ganador.
    return {};
  }

  const inCurrentRound = matches.filter((m) => m.round === currentRoundNum);
  const sample = inCurrentRound[0];
  const currentRound = sample?.title || `Ronda ${currentRoundNum}`;

  const undecided = inCurrentRound
    .filter((m) => !isCompleteSeries(m))
    .sort((a, b) => (a.id || "").localeCompare(b.id || ""));

  const next = undecided.find(hasBothTeams) || undecided[0];
  const nextMatch =
    next && next.id
      ? {
          id: next.id,
          teamA: next.team1 || "?",
          teamB: next.team2 || "?",
          scheduled: next.dates?.[0],
        }
      : undefined;

  // pendingScores: cuántas series en la current round están sin winner
  // y tienen ambos equipos definidos (un match con team1+team2 ya está
  // listo para introducir scores).
  const pendingScores = inCurrentRound.filter((m) => !isCompleteSeries(m) && hasBothTeams(m)).length;

  return {
    currentRound,
    nextMatch,
    ...(pendingScores > 0 ? { pendingScores } : {}),
  };
}

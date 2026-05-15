import type { Firestore } from "firebase-admin/firestore";
import type { SessionWithTeamId } from "./calendarDigest";

interface RawScore {
  s1?: unknown;
  s2?: unknown;
}

interface RawMatch {
  id?: string;
  team1?: string;
  team2?: string;
  dates?: unknown[];
  times?: unknown[];
  places?: unknown[];
  scores?: RawScore[];
  gamesCount?: number;
}

function parseDateToISO(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

/**
 * Mirrors `isGameSkippedBySeries` from src/utils/calendarUtils.js.
 * Skip a game if the series is already decided (best-of-N) before it.
 */
function isGameSkippedBySeries(match: RawMatch, gameIndex: number): boolean {
  const scores = Array.isArray(match.scores) ? match.scores : [];
  let t1Wins = 0;
  let t2Wins = 0;
  for (let i = 0; i < gameIndex; i++) {
    const s = scores[i];
    if (!s) continue;
    const a = Number(s.s1);
    const b = Number(s.s2);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (a > b) t1Wins++;
    else if (b > a) t2Wins++;
  }
  const gamesCount = typeof match.gamesCount === "number" && match.gamesCount > 0 ? match.gamesCount : 1;
  const needed = Math.ceil(gamesCount / 2);
  return t1Wins >= needed || t2Wins >= needed;
}

/**
 * Port server-side of `buildPlayoffSessions` (src/utils/calendarUtils.js).
 * Genera sesiones virtuales de playoff dentro del rango `[fromISO, toISO]`
 * inclusivo. Para cada bracket con `myTeam` definido y `bracketData.state`,
 * recorre los matches; por cada match donde myTeam participa, emite una
 * sesión por game-index salvo que el game esté skipped por la serie.
 *
 * IDs siguen el patrón `playoff-{bracketId}-{matchId}-{gameIndex}` igual
 * que el frontend, para que sean reutilizables con
 * `propose_mark_convocatoria_sent`, `mandar_convocatoria`, etc.
 *
 * Necesario porque el frontend computa estos virtuals localmente y el
 * digest sólo leía `calendarSessions` — Pick no sabía de playoffs.
 */
export async function buildPlayoffSessionsInRange(deps: {
  db: Firestore;
  appId: string;
  wsId: string;
  /** Inclusive lower bound (YYYY-MM-DD). */
  fromISO: string;
  /** Inclusive upper bound (YYYY-MM-DD). */
  toISO: string;
  teamsById: Map<string, string>;
  scopedTeamIds?: Set<string> | null;
}): Promise<SessionWithTeamId[]> {
  const base = deps.db.collection("artifacts").doc(deps.appId).collection("workspaces").doc(deps.wsId);
  const bracketsSnap = await base.collection("brackets").get();
  const result: SessionWithTeamId[] = [];

  for (const bDoc of bracketsSnap.docs) {
    const data = bDoc.data();
    const teamId = data.teamId as string | undefined;
    if (!teamId) continue;
    if (deps.scopedTeamIds && !deps.scopedTeamIds.has(teamId)) continue;

    const myTeam = data.myTeam as string | undefined;
    if (!myTeam) continue;
    const stateContainer = (data.bracketData as { state?: Record<string, RawMatch> } | undefined) || data;
    const state = (stateContainer.state || {}) as Record<string, RawMatch>;
    const teamName = deps.teamsById.get(teamId);

    for (const match of Object.values(state)) {
      if (!match || typeof match !== "object") continue;
      if (match.team1 !== myTeam && match.team2 !== myTeam) continue;
      const dates = Array.isArray(match.dates) ? match.dates : [];
      const times = Array.isArray(match.times) ? match.times : [];
      const places = Array.isArray(match.places) ? match.places : [];
      const isMyTeamTeam1 = match.team1 === myTeam;
      const rival = isMyTeamTeam1 ? match.team2 : match.team1;

      for (let gi = 0; gi < dates.length; gi++) {
        const iso = parseDateToISO(dates[gi]);
        if (!iso) continue;
        if (iso < deps.fromISO || iso > deps.toISO) continue;
        if (isGameSkippedBySeries(match, gi)) continue;

        const horaInicio = times[gi];
        const lugar = places[gi];
        result.push({
          id: `playoff-${bDoc.id}-${match.id || "M"}-${gi}`,
          fecha: iso,
          horaInicio: typeof horaInicio === "string" && horaInicio ? horaInicio : undefined,
          tipo: "playoff",
          teamId,
          teamName,
          rival: typeof rival === "string" && rival ? rival : undefined,
          lugar: typeof lugar === "string" && lugar ? lugar : undefined,
        });
      }
    }
  }

  return result;
}

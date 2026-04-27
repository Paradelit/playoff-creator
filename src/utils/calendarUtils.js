import { teamDisplayName } from './teamUtils';

/**
 * Parse a date string in DD/MM/YYYY or YYYY-MM-DD format to ISO YYYY-MM-DD.
 * Returns null if the format is unrecognized.
 */
export function parseDateToISO(d) {
  if (typeof d !== 'string' || !d) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

/**
 * True if a game within a match won't be played because the series is already
 * decided by the previous games (e.g. BO3 with 2-0 after games 0-1).
 */
export function isGameSkippedBySeries(match, gameIndex) {
  if (!match || !Array.isArray(match.scores)) return false;
  const gamesCount = match.gamesCount || 1;
  if (gamesCount !== 3 || gameIndex !== 2) return false;
  const g0 = match.scores[0];
  const g1 = match.scores[1];
  if (!g0 || !g1) return false;
  const a1 = parseInt(g0.s1, 10);
  const b1 = parseInt(g0.s2, 10);
  const a2 = parseInt(g1.s1, 10);
  const b2 = parseInt(g1.s2, 10);
  if (isNaN(a1) || isNaN(b1) || isNaN(a2) || isNaN(b2)) return false;
  if (a1 === b1 || a2 === b2) return false;
  const t1Wins = (a1 > b1 ? 1 : 0) + (a2 > b2 ? 1 : 0);
  const t2Wins = (b1 > a1 ? 1 : 0) + (b2 > a2 ? 1 : 0);
  return t1Wins === 2 || t2Wins === 2;
}

/**
 * Build virtual calendar sessions from playoff brackets.
 * Only includes matches where myTeam is involved and dates are set.
 */
export function buildPlayoffSessions(brackets, teams) {
  const result = [];
  const teamIds = new Set(teams.map((t) => t.id));
  for (const b of brackets) {
    if (!b.teamId || !teamIds.has(b.teamId) || !b.bracketData?.state) continue;
    const team = teams.find((t) => t.id === b.teamId);
    const teamName = team ? teamDisplayName(team) : '';
    const myTeam = b.myTeam;
    for (const match of Object.values(b.bracketData.state)) {
      if (!myTeam || (match.team1 !== myTeam && match.team2 !== myTeam)) continue;
      const dates = match.dates || [];
      const times = match.times || [];
      const endTimes = match.endTimes || [];
      const places = match.places || [];
      if (dates.length === 0) continue;
      const isMyTeamTeam1 = match.team1 === myTeam;
      const rival = isMyTeamTeam1 ? match.team2 : match.team1;
      for (let gi = 0; gi < dates.length; gi++) {
        const dateStr = parseDateToISO(dates[gi]);
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
        if (isGameSkippedBySeries(match, gi)) continue;
        result.push({
          id: `playoff-${b.id}-${match.id}-${gi}`,
          teamId: b.teamId,
          teamName,
          tipo: 'playoff',
          fecha: dateStr,
          horaInicio: times[gi] || '',
          horaFin: endTimes[gi] || '',
          lugar: places[gi] || '',
          rival: rival || 'Por definir',
          esLocal: isMyTeamTeam1,
          bracketId: b.id,
          bracketMatchId: match.id,
          bracketName: b.name || b.tournamentNameDetected || 'Torneo',
          bracketShareCode: b.shareCode || null,
          matchTitle: match.title || '',
          gameIndex: gi,
          gamesCount: match.gamesCount || 1,
          scores: match.scores,
          isMyTeamTeam1,
          isPlayoff: true,
        });
      }
    }
  }
  return result;
}

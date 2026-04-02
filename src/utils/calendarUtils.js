import { teamDisplayName } from '../screens/TeamsScreen';

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
      if (dates.length === 0) continue;
      const rival = match.team1 === myTeam ? match.team2 : match.team1;
      for (let gi = 0; gi < dates.length; gi++) {
        const dateStr = parseDateToISO(dates[gi]);
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
        result.push({
          id: `playoff-${b.id}-${match.id}-${gi}`,
          teamId: b.teamId,
          teamName,
          tipo: 'playoff',
          fecha: dateStr,
          horaInicio: '',
          horaFin: '',
          lugar: '',
          rival: rival || 'Por definir',
          esLocal: true,
          bracketId: b.id,
          bracketName: b.name || b.tournamentNameDetected || 'Playoff',
          matchTitle: match.title || '',
          gameIndex: gi,
          gamesCount: match.gamesCount || 1,
          scores: match.scores,
          isPlayoff: true,
        });
      }
    }
  }
  return result;
}

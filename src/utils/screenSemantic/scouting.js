/**
 * Builder de screen semantic para ScoutingScreen.
 *
 * @param {object} state
 * @param {{ id: string, fecha?: string, rival?: string } | null} state.session
 * @param {{ id: string, teamName?: string, categoria?: string } | null} state.team
 * @returns {{ surface: string, label: string, referableIds?: Record<string, string> } | null}
 */
export function buildScoutingSemantic(state) {
  if (!state || !state.session || !state.session.id) return null;
  const { session, team = null } = state;

  const teamName = team?.teamName || team?.name || 'sin equipo';
  const categoria = team?.categoria ? ` (${team.categoria})` : '';
  const fechaSuffix = session.fecha ? ` del ${session.fecha}` : '';
  const rivalSuffix = session.rival ? ` vs ${session.rival}` : '';

  const referableIds = {
    'esta sesión': session.id,
    'este partido': session.id,
    'este scouting': session.id,
  };
  if (team?.id) referableIds['este equipo'] = team.id;

  return {
    surface: 'scouting',
    label: `Scouting${rivalSuffix}${fechaSuffix}. Equipo: ${teamName}${categoria}.`,
    referableIds,
  };
}

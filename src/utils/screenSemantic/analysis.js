/**
 * Builder de screen semantic para AnalysisScreen.
 *
 * @param {object} state
 * @param {{ id: string, fecha?: string, rival?: string } | null} state.session
 * @param {{ id: string, teamName?: string, categoria?: string } | null} state.team
 * @param {{ ourScore?: number, theirScore?: number } | null} [state.result]
 * @returns {{ surface: string, label: string, referableIds?: Record<string, string> } | null}
 */
export function buildAnalysisSemantic(state) {
  if (!state || !state.session || !state.session.id) return null;
  const { session, team = null, result = null } = state;

  const teamName = team?.teamName || team?.name || 'sin equipo';
  const categoria = team?.categoria ? ` (${team.categoria})` : '';
  const fechaSuffix = session.fecha ? ` del ${session.fecha}` : '';
  const rivalSuffix = session.rival ? ` vs ${session.rival}` : '';
  const resultSuffix =
    result && Number.isFinite(result.ourScore) && Number.isFinite(result.theirScore)
      ? ` (${result.ourScore}-${result.theirScore})`
      : '';

  const referableIds = {
    'esta sesión': session.id,
    'este partido': session.id,
    'este análisis': session.id,
  };
  if (team?.id) referableIds['este equipo'] = team.id;

  return {
    surface: 'analysis',
    label: `Análisis post-partido${rivalSuffix}${fechaSuffix}${resultSuffix}. Equipo: ${teamName}${categoria}.`,
    referableIds,
  };
}

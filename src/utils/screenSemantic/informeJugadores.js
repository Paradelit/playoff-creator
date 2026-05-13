/**
 * Builder de screen semantic para InformeJugadoresScreen (cuaderno →
 * informe de jugadores).
 *
 * @param {object} state
 * @param {{ id: string, teamName?: string, categoria?: string } | null} state.team
 * @param {number} [state.rowCount]  — número de filas actuales en el informe
 * @returns {{ surface: string, label: string, referableIds?: Record<string, string> } | null}
 */
export function buildInformeJugadoresSemantic(state) {
  if (!state || !state.team || !state.team.id) return null;
  const { team, rowCount = 0 } = state;
  const teamName = team.teamName || team.name || 'sin nombre';
  const categoria = team.categoria ? ` (${team.categoria})` : '';

  const parts = [`Cuaderno → Informe de Jugadores de ${teamName}${categoria}`];
  if (rowCount > 0) parts.push(`${rowCount} filas en el informe`);

  return {
    surface: 'cuaderno-informe-jugadores',
    label: parts.join('. ') + '.',
    referableIds: {
      'este equipo': team.id,
      'este informe': team.id,
    },
  };
}

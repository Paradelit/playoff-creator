/**
 * Builder de screen semantic para AsistenciaScreen (cuaderno → asistencia).
 *
 * Pura — sin acceso a Firestore ni hooks.
 *
 * @param {object} state
 * @param {{ id: string, teamName?: string, categoria?: string } | null} state.team
 * @param {Array<{ id: string, tipo?: string }>} [state.members]
 * @param {string} [state.activeMonth]  — key tipo "2026-05"
 * @returns {{ surface: string, label: string, referableIds?: Record<string, string> } | null}
 */
export function buildAsistenciaSemantic(state) {
  if (!state || !state.team || !state.team.id) return null;
  const { team, members = [], activeMonth = null } = state;

  const jugadoresCount = members.filter((m) => (m.tipo || 'jugador') === 'jugador').length;
  const teamName = team.teamName || team.name || 'sin nombre';
  const categoria = team.categoria ? ` (${team.categoria})` : '';

  const parts = [`Cuaderno → Asistencia de ${teamName}${categoria}`];
  parts.push(`${jugadoresCount} jugadores`);
  if (activeMonth) parts.push(`Mes activo: ${activeMonth}`);

  return {
    surface: 'cuaderno-asistencia',
    label: parts.join('. ') + '.',
    referableIds: {
      'este equipo': team.id,
    },
  };
}

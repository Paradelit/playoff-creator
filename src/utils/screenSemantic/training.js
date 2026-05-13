/**
 * Builders de screen semantic para TrainingEditorScreen + TeamTrainingsScreen.
 *
 * Ambos comparten el contexto del team. TrainingEditor además identifica el
 * training específico que se está editando.
 */

/**
 * Builder para TrainingEditorScreen — editor de un training específico.
 *
 * @param {object} state
 * @param {string | null} state.teamId
 * @param {{ id: string, teamName?: string, categoria?: string } | null} state.team
 * @param {{ id: string, meta?: { numero?: number, fecha?: string, equipo?: string } } | null} state.training
 * @returns {{ surface: string, label: string, referableIds?: Record<string, string> } | null}
 */
export function buildTrainingEditorSemantic(state) {
  if (!state || !state.training || !state.training.id) return null;
  const { teamId = null, team = null, training } = state;

  const teamName = team?.teamName || team?.name || training.meta?.equipo || 'sin equipo';
  const categoria = team?.categoria ? ` (${team.categoria})` : '';
  const numero = training.meta?.numero;
  const fecha = training.meta?.fecha;

  const parts = ['Editor de entrenamiento'];
  if (numero) parts.push(`#${numero}`);
  if (fecha) parts.push(`fecha ${fecha}`);
  parts.push(`Equipo: ${teamName}${categoria}`);

  const referableIds = { 'este entrenamiento': training.id };
  if (teamId) referableIds['este equipo'] = teamId;

  return {
    surface: 'training-editor',
    label: parts.join('. ') + '.',
    referableIds,
  };
}

/**
 * Builder para TeamTrainingsScreen — lista de entrenamientos del team.
 *
 * @param {object} state
 * @param {string | null} state.teamId
 * @param {{ id: string, teamName?: string, categoria?: string } | null} state.team
 * @param {Array<unknown>} [state.trainings]
 * @returns {{ surface: string, label: string, referableIds?: Record<string, string> } | null}
 */
export function buildTeamTrainingsSemantic(state) {
  if (!state || !state.teamId) return null;
  const { teamId, team = null, trainings = [] } = state;

  const teamName = team?.teamName || team?.name || 'sin equipo';
  const categoria = team?.categoria ? ` (${team.categoria})` : '';

  return {
    surface: 'team-trainings',
    label: `Lista de entrenamientos de ${teamName}${categoria}. ${trainings.length} entrenamientos guardados.`,
    referableIds: {
      'este equipo': teamId,
    },
  };
}

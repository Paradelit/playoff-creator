/**
 * Builder de screen semantic para BracketScreen.
 *
 * Bracket es un orquestador editorial — el coach navega el cuadro,
 * introduce resultados, comparte. La entidad enfocada es el bracket
 * entero, no un match concreto. Los referableIds se concentran en el
 * bracket id (con varios sinónimos).
 *
 * Pura — sin acceso a Firestore ni hooks.
 */

/**
 * @param {object} state
 * @param {string | null} state.activeBracketId
 * @param {{ name?: string, tournamentName?: string, myTeam?: string, teamId?: string } | null} state.activeBracket
 * @param {boolean} [state.canEdit]
 * @returns {{ surface: string, label: string, referableIds?: Record<string, string> } | null}
 */
export function buildBracketSemantic(state) {
  if (!state || !state.activeBracketId) return null;
  const { activeBracketId, activeBracket, canEdit } = state;

  const bracketName = activeBracket?.name || activeBracket?.tournamentName || 'cuadro';
  const myTeam = activeBracket?.myTeam || null;
  const teamId = activeBracket?.teamId || null;

  const parts = [`Visualizando bracket "${bracketName}"`];
  if (myTeam) parts.push(`Mi equipo: ${myTeam}`);
  if (canEdit === false) parts.push('Modo solo-lectura (no puedes editar)');

  const referableIds = {
    'este bracket': activeBracketId,
    'este cuadro': activeBracketId,
    'este playoff': activeBracketId,
  };
  if (teamId) {
    referableIds['este equipo'] = teamId;
  }

  return {
    surface: 'bracket-editor',
    label: parts.join('. ') + '.',
    referableIds,
  };
}

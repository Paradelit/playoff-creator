/**
 * Builder de screen semantic para TeamDetailScreen.
 *
 * Entrada: estado local del screen (team + members + sessions filtradas
 * + activePlayoff). Salida: `ScreenSemantic` con label legible y
 * referableIds que el LLM puede resolver sin tool calls.
 *
 * Pura — sin acceso a Firestore ni a hooks. Testable directamente.
 */

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

/**
 * @param {object} state
 * @param {{ id: string, teamName?: string, categoria?: string } | null} state.team
 * @param {Array<{ id: string, tipo?: string }>} state.members
 * @param {Array<{ id: string, teamId?: string, fecha?: string, tipo?: string, rival?: string }>} state.allSessions
 * @param {{ id: string, name?: string } | null} state.activePlayoff
 * @returns {{ surface: string, label: string, referableIds?: Record<string, string> } | null}
 */
export function buildTeamDetailSemantic(state) {
  if (!state || !state.team || !state.team.id) return null;
  const { team, members = [], allSessions = [], activePlayoff = null } = state;

  const jugadoresCount = members.filter((m) => (m.tipo || 'jugador') === 'jugador').length;
  const staffCount = members.length - jugadoresCount;

  const todayISO = TODAY_ISO();
  const nextSession = allSessions
    .filter((s) => s.teamId === team.id && typeof s.fecha === 'string' && s.fecha >= todayISO)
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))[0];

  const parts = [];
  const teamName = team.teamName || team.name || 'sin nombre';
  const categoria = team.categoria ? ` (${team.categoria})` : '';
  parts.push(`Visualizando equipo ${teamName}${categoria}`);
  parts.push(`${jugadoresCount} jugadores${staffCount > 0 ? `, ${staffCount} staff` : ''}`);
  if (nextSession) {
    const rivalSuffix = nextSession.rival ? ` vs ${nextSession.rival}` : '';
    const tipo = nextSession.tipo || 'sesión';
    parts.push(`Próximo: ${nextSession.fecha} (${tipo})${rivalSuffix}`);
  }
  if (activePlayoff) {
    parts.push(`Bracket activo: ${activePlayoff.name || activePlayoff.id}`);
  }

  const referableIds = { 'este equipo': team.id };
  if (nextSession) {
    referableIds['este partido'] = nextSession.id;
    referableIds['el próximo partido'] = nextSession.id;
  }
  if (activePlayoff) {
    referableIds['este playoff'] = activePlayoff.id;
    referableIds['este bracket'] = activePlayoff.id;
  }

  return {
    surface: 'team-detail',
    label: parts.join('. ') + '.',
    referableIds,
  };
}

/**
 * Builder de screen semantic para CalendarScreen.
 *
 * El calendario no tiene una "entidad enfocada" única (a diferencia de
 * TeamDetail) — el coach ve un rango. Los referableIds se mantienen
 * conservadores: solo "esta sesión" cuando hay exactamente una visible
 * en la vista día, y "este equipo" cuando hay filtro activo.
 *
 * Pura — sin acceso a Firestore ni hooks.
 */

const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function formatDate(date) {
  const d = date.getDate();
  const m = MONTHS_ES[date.getMonth()] || '';
  const y = date.getFullYear();
  return `${d} de ${m} ${y}`;
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * @param {object} state
 * @param {Date} state.currentDate
 * @param {'month'|'week'|'day'} state.viewMode
 * @param {Array<{ id: string, fecha?: string, tipo?: string, teamId?: string, rival?: string }>} state.visibleSessions
 * @param {Array<{ id: string, fecha?: string, tipo?: string, rival?: string }>} [state.daySessionList]
 * @param {{ id: string, teamName?: string } | null} [state.filterTeam]
 * @returns {{ surface: string, label: string, referableIds?: Record<string, string> } | null}
 */
export function buildCalendarSemantic(state) {
  if (!state || !state.currentDate || !state.viewMode) return null;
  const { currentDate, viewMode, visibleSessions = [], daySessionList = [], filterTeam = null } = state;

  const parts = [];
  if (viewMode === 'month') {
    const monthName = MONTHS_ES[currentDate.getMonth()] || '';
    parts.push(`Calendario, vista mensual, ${monthName} ${currentDate.getFullYear()}`);
  } else if (viewMode === 'week') {
    const monday = getMonday(currentDate);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    parts.push(`Calendario, vista semanal: semana del ${formatDate(monday)} al ${formatDate(sunday)}`);
  } else {
    parts.push(`Calendario, vista día: ${formatDate(currentDate)}`);
  }

  parts.push(`${visibleSessions.length} sesiones visibles`);
  if (filterTeam) {
    parts.push(`Filtrado por equipo: ${filterTeam.teamName || filterTeam.id}`);
  }

  const referableIds = {};
  if (filterTeam?.id) {
    referableIds['este equipo'] = filterTeam.id;
  }
  // Sólo expongo "esta sesión" cuando hay UNA visible inequívoca (caso
  // típico: vista día con un solo partido). En vista mes/semana con
  // múltiples sesiones, "esta sesión" es ambiguo — mejor que el LLM
  // pregunte cuál.
  if (viewMode === 'day' && daySessionList.length === 1) {
    referableIds['esta sesión'] = daySessionList[0].id;
  }

  return {
    surface: 'calendar',
    label: parts.join('. ') + '.',
    ...(Object.keys(referableIds).length > 0 ? { referableIds } : {}),
  };
}

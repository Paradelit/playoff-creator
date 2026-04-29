/**
 * Demo data para ContextoReal: un fin de semana real de un club formativo.
 * 4 sesiones, 1 conflicto que la app resuelve, huecos libres entre sesiones.
 */

export const CONTEXTO_REAL_TEAMS = [
  { id: 'benjamin', name: 'Benjamín', categoria: 'Benjamín', genero: 'Mixto' },
  { id: 'cadete-a', name: 'Cadete A', categoria: 'Cadete', genero: 'Masculino' },
  { id: 'infantil-a', name: 'Infantil A', categoria: 'Infantil', genero: 'Femenino' },
];

export const CONTEXTO_REAL_COURTS = [
  { id: 'court-1', label: 'Pista 1 Central' },
];

/**
 * Estado ordenado: lo que la app deja al final, sin solapes y con huecos visibles.
 *
 * Sábado:
 *   09:00 Partido Benjamín (60 min)
 *   11:30 Partido Cadete A (90 min)   ← 90 min libres entre uno y otro
 *   13:30 Entreno tiro Cadete A (60 min) ← 30 min libres entre el anterior y este
 *
 * Domingo:
 *   12:00 Partido playoff Infantil A (90 min)
 */
const ORDERED_SESSION_ROWS = [
  ['S01', 'benjamin', 'court-1', 'sabado', 540, 60, 'match', 'Partido · vs CB Visitante'],
  ['S02', 'cadete-a', 'court-1', 'sabado', 690, 90, 'match', 'Partido · vs Estudiantes'],
  ['S03', 'cadete-a', 'court-1', 'sabado', 810, 60, 'training', 'Entreno tiro · catch & shoot'],
  ['S04', 'infantil-a', 'court-1', 'domingo', 720, 90, 'playoff', 'Playoff cuartos · vs Real Madrid'],
];

/**
 * Estado caos inicial (lo que el coach intenta encajar):
 * el partido benjamín y el partido cadete chocan a la misma hora en la misma pista.
 */
const CHAOS_OVERRIDES = {
  S01: { startMin: 660 }, // Benjamín 11:00
  S02: { startMin: 660 }, // Cadete A 11:00 ← conflicto con S01 en court-1
};

const CONFLICT_PAIRS = {
  S01: ['S02'],
  S02: ['S01'],
};

function buildSession([id, teamId, court, day, startMin, durationMin, type, label]) {
  return {
    id,
    teamId,
    court,
    day,
    startMin,
    durationMin,
    type,
    label,
    conflicts: [],
  };
}

export const CONTEXTO_REAL_ORDERED_SESSIONS = ORDERED_SESSION_ROWS.map(buildSession);

export const CONTEXTO_REAL_SESSIONS = CONTEXTO_REAL_ORDERED_SESSIONS.map((session) => {
  const override = CHAOS_OVERRIDES[session.id];
  const conflicts = CONFLICT_PAIRS[session.id] ?? [];
  if (!override) return { ...session, conflicts };
  return {
    ...session,
    startMin: override.startMin,
    conflicts,
  };
});

/**
 * Devuelve los huecos libres entre sesiones consecutivas en el estado ordenado.
 * Útil para anotar "90 min libres" entre dos chips.
 */
export function buildOrderedGaps() {
  const byDay = { sabado: [], domingo: [] };
  CONTEXTO_REAL_ORDERED_SESSIONS.forEach((session) => {
    byDay[session.day].push(session);
  });
  const gaps = [];
  Object.entries(byDay).forEach(([day, sessions]) => {
    sessions
      .slice()
      .sort((a, b) => a.startMin - b.startMin)
      .forEach((session, idx, arr) => {
        const next = arr[idx + 1];
        if (!next) return;
        const startOfNext = next.startMin;
        const endOfThis = session.startMin + session.durationMin;
        const minutes = startOfNext - endOfThis;
        if (minutes <= 0) return;
        gaps.push({
          id: `${session.id}-gap-${next.id}`,
          day,
          afterId: session.id,
          beforeId: next.id,
          minutes,
        });
      });
  });
  return gaps;
}

export const CONTEXTO_REAL_GAPS = buildOrderedGaps();

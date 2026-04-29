function inFase(s, competitionId, faseId) {
  return s.competitionId === competitionId && s.faseId === faseId;
}

export function computeJornadaNumero(session, allSessions, competitionId, faseId) {
  const auto = (allSessions || [])
    .filter((s) => inFase(s, competitionId, faseId))
    .filter((s) => !s.jornadaNumeroManual)
    .sort((a, b) => (a.fecha > b.fecha ? 1 : -1));

  const includesSelf = auto.some((s) => s.id === session.id);
  if (!includesSelf) {
    const merged = [...auto, session].sort((a, b) => (a.fecha > b.fecha ? 1 : -1));
    return merged.findIndex((s) => s.id === session.id) + 1;
  }
  return auto.findIndex((s) => s.id === session.id) + 1;
}

export function recalcAutoJornadas(sessions, competitionId, faseId) {
  const inScope = (sessions || []).filter((s) => inFase(s, competitionId, faseId));
  const autos = inScope
    .filter((s) => !s.jornadaNumeroManual)
    .sort((a, b) => (a.fecha > b.fecha ? 1 : -1))
    .map((s, i) => ({ ...s, jornadaNumero: i + 1 }));
  const manuals = inScope.filter((s) => s.jornadaNumeroManual);
  const recalced = [...autos, ...manuals];
  return (sessions || []).map((s) => recalced.find((r) => r.id === s.id) || s);
}

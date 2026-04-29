function vueltaSuffix(fase, jornadaNumero) {
  if (!fase || !Number.isFinite(fase.jornadas)) return '';
  if (fase.jornadas % 2 !== 0) return '';
  const half = Math.floor(fase.jornadas / 2);
  return jornadaNumero <= half ? ' (1ª vuelta)' : ' (2ª vuelta)';
}

export function generarEncabezado({ session, competition }) {
  const rival = session?.rival || 'Rival';

  if (session?.tipo === 'playoff') {
    const matchTitle = session.matchTitle || 'Eliminatoria';
    const game = (session.gameIndex || 0) + 1;
    return `*Playoffs ${matchTitle}*\n_Jornada ${game} vs ${rival}_`;
  }

  if (!session?.competitionId || !competition) {
    return `*Amistoso*\n_vs ${rival}_`;
  }

  const fase = (competition.fases || []).find((f) => f.id === session.faseId);
  if (!fase) return `*${competition.nombre}*\n_vs ${rival}_`;

  const vuelta = vueltaSuffix(fase, session.jornadaNumero);
  return `*${competition.nombre} — ${fase.nombre}${vuelta}*\n_Jornada ${session.jornadaNumero} vs ${rival}_`;
}

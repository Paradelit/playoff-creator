const MINIBASKET_SEXTOS = [
  { categoria: 'Benjamín', año: '2º' },
  { categoria: 'Alevín', año: '1º' },
  { categoria: 'Alevín', año: '2º' },
];

export function isMinibasketSextos(team) {
  if (!team) return false;
  return MINIBASKET_SEXTOS.some((m) => m.categoria === team.categoria && m.año === team.año);
}

export function validateSextos(jugadores) {
  return jugadores.map((j) => {
    const countFirst5 = j.sextos.slice(0, 5).filter(Boolean).length;
    const valid = countFirst5 >= 2 && countFirst5 <= 3;
    return { ...j, valid, countFirst5 };
  });
}

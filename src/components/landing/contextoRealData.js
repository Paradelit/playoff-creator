export const CONTEXTO_REAL_TEAMS = [
  { id: 'cadete-a', name: 'Cadete A' },
  { id: 'cadete-b', name: 'Cadete B' },
  { id: 'infantil-a', name: 'Infantil A' },
  { id: 'infantil-b', name: 'Infantil B' },
  { id: 'mini-mixto', name: 'Mini Mixto' },
  { id: 'mini-femenino', name: 'Mini Femenino' },
  { id: 'junior-a', name: 'Junior A' },
  { id: 'junior-b', name: 'Junior B' },
  { id: 'senior-masculino', name: 'Sénior Masculino' },
  { id: 'pre-mini', name: 'Pre-Mini' },
];

export const CONTEXTO_REAL_COURTS = [
  { id: 'court-1', label: 'Pista 1 Central' },
  { id: 'court-2', label: 'Pista 2 Lateral' },
  { id: 'court-3', label: 'Pabellón Anexo' },
];

const ORDERED_SESSION_ROWS = [
  ['S01', 'cadete-a', 'court-1', 'sabado', 540, 80, 'training'],
  ['S02', 'infantil-a', 'court-2', 'sabado', 540, 80, 'training'],
  ['S03', 'junior-a', 'court-3', 'sabado', 540, 90, 'training'],
  ['S04', 'mini-mixto', 'court-1', 'sabado', 630, 60, 'training'],
  ['S05', 'cadete-b', 'court-2', 'sabado', 630, 70, 'training'],
  ['S06', 'pre-mini', 'court-3', 'sabado', 645, 50, 'training'],
  ['S07', 'senior-masculino', 'court-1', 'sabado', 705, 90, 'match'],
  ['S08', 'mini-femenino', 'court-2', 'sabado', 720, 60, 'training'],
  ['S09', 'infantil-b', 'court-3', 'sabado', 720, 80, 'training'],
  ['S10', 'junior-b', 'court-1', 'sabado', 810, 70, 'training'],
  ['S11', 'cadete-a', 'court-2', 'sabado', 810, 60, 'training'],
  ['S12', 'mini-mixto', 'court-3', 'sabado', 815, 50, 'training'],
  ['S13', 'junior-a', 'court-1', 'sabado', 900, 90, 'match'],
  ['S14', 'infantil-a', 'court-2', 'sabado', 900, 60, 'training'],
  ['S15', 'senior-masculino', 'court-3', 'sabado', 905, 80, 'training'],
  ['S16', 'cadete-b', 'court-1', 'sabado', 1005, 60, 'training'],
  ['S17', 'pre-mini', 'court-2', 'sabado', 995, 50, 'training'],
  ['S18', 'mini-femenino', 'court-3', 'sabado', 1000, 60, 'match'],
  ['S19', 'infantil-b', 'court-1', 'sabado', 1080, 70, 'training'],
  ['S20', 'junior-b', 'court-2', 'sabado', 1085, 80, 'match'],
  ['S21', 'cadete-a', 'court-3', 'sabado', 1090, 60, 'training'],
  ['S22', 'mini-mixto', 'court-1', 'sabado', 1170, 50, 'training'],
  ['S23', 'senior-masculino', 'court-2', 'sabado', 1175, 70, 'training'],
  ['S24', 'infantil-a', 'court-3', 'sabado', 1180, 60, 'match'],
  ['S25', 'cadete-b', 'court-1', 'domingo', 540, 80, 'match'],
  ['S26', 'junior-a', 'court-2', 'domingo', 540, 90, 'training'],
  ['S27', 'pre-mini', 'court-3', 'domingo', 545, 50, 'training'],
  ['S28', 'mini-femenino', 'court-1', 'domingo', 635, 60, 'training'],
  ['S29', 'infantil-b', 'court-2', 'domingo', 640, 80, 'match'],
  ['S30', 'senior-masculino', 'court-3', 'domingo', 650, 90, 'training'],
  ['S31', 'mini-mixto', 'court-1', 'domingo', 720, 60, 'training'],
  ['S32', 'cadete-a', 'court-2', 'domingo', 730, 70, 'match'],
  ['S33', 'junior-b', 'court-3', 'domingo', 735, 80, 'training'],
  ['S34', 'infantil-a', 'court-1', 'domingo', 815, 60, 'training'],
  ['S35', 'cadete-b', 'court-2', 'domingo', 825, 70, 'training'],
  ['S36', 'mini-femenino', 'court-3', 'domingo', 830, 60, 'training'],
  ['S37', 'senior-masculino', 'court-1', 'domingo', 900, 90, 'match'],
  ['S38', 'junior-a', 'court-2', 'domingo', 905, 80, 'training'],
  ['S39', 'pre-mini', 'court-3', 'domingo', 910, 50, 'match'],
  ['S40', 'infantil-b', 'court-1', 'domingo', 1000, 70, 'training'],
  ['S41', 'mini-mixto', 'court-2', 'domingo', 995, 60, 'training'],
  ['S42', 'cadete-a', 'court-3', 'domingo', 1005, 80, 'training'],
  ['S43', 'junior-b', 'court-1', 'domingo', 1080, 70, 'match'],
  ['S44', 'infantil-a', 'court-2', 'domingo', 1085, 60, 'training'],
  ['S45', 'cadete-b', 'court-3', 'domingo', 1090, 70, 'training'],
  ['S46', 'senior-masculino', 'court-1', 'domingo', 1170, 90, 'training'],
  ['S47', 'mini-femenino', 'court-2', 'domingo', 1180, 60, 'match'],
];

const CONFLICT_OVERRIDES = {
  S04: { court: 'court-2', startMin: 620, conflicts: ['S05'] },
  S05: { court: 'court-2', startMin: 635, conflicts: ['S04'] },
  S08: { court: 'court-3', startMin: 735, conflicts: ['S09'] },
  S09: { court: 'court-3', startMin: 725, conflicts: ['S08'] },
  S14: { court: 'court-3', startMin: 900, conflicts: ['S15'] },
  S15: { court: 'court-3', startMin: 915, conflicts: ['S14'] },
  S29: { court: 'court-3', startMin: 655, conflicts: ['S30'] },
  S30: { court: 'court-3', startMin: 650, conflicts: ['S29'] },
  S34: { court: 'court-1', startMin: 822, conflicts: ['S35'] },
  S35: { court: 'court-1', startMin: 832, conflicts: ['S34'] },
  S41: { court: 'court-3', startMin: 1000, conflicts: ['S42'] },
  S42: { court: 'court-3', startMin: 1008, conflicts: ['S41'] },
};

function buildSession([id, teamId, court, day, startMin, durationMin, type]) {
  return {
    id,
    teamId,
    court,
    day,
    startMin,
    durationMin,
    type,
    conflicts: [],
  };
}

export const CONTEXTO_REAL_ORDERED_SESSIONS = ORDERED_SESSION_ROWS.map(buildSession);

export const CONTEXTO_REAL_SESSIONS = CONTEXTO_REAL_ORDERED_SESSIONS.map((session) => {
  const override = CONFLICT_OVERRIDES[session.id];
  if (!override) return { ...session };
  return {
    ...session,
    court: override.court,
    startMin: override.startMin,
    conflicts: override.conflicts,
  };
});

function startTimestamp(session) {
  const [h, m] = (session.horaInicio || '00:00').split(':').map(Number);
  const [Y, M, D] = session.fecha.split('-').map(Number);
  return new Date(Y, M - 1, D, h || 0, m || 0).getTime();
}

export function buildConvocatoriaPendientes(sessions, teams, now = new Date()) {
  const result = [];
  const teamsById = new Map((teams || []).map((t) => [t.id, t]));
  const nowMs = now.getTime();

  for (const s of sessions || []) {
    if (!['partido', 'playoff'].includes(s.tipo)) continue;
    if (s.convocatoriaSentAt) continue;
    if (!s.fecha) continue;
    const startMs = startTimestamp(s);
    if (startMs <= nowMs) continue;
    const team = teamsById.get(s.teamId);
    const ventanaH = team?.convocatoriaReminderHours ?? 72;
    const horas = (startMs - nowMs) / 3600000;
    if (horas > ventanaH) continue;
    result.push({
      id: `convocatoria-${s.id}`,
      type: 'convocatoria',
      session: s,
      team,
      label: `Mandar convocatoria · vs ${s.rival || 'rival'}`,
      severity: horas < 24 ? 'high' : 'normal',
    });
  }
  return result.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
    return startTimestamp(a.session) - startTimestamp(b.session);
  });
}

function isLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function birthdayOnDay(fechaNac, day) {
  const [, m, d] = fechaNac.split('-').map(Number);
  const sameMonthDay = day.getMonth() === m - 1 && day.getDate() === d;
  if (sameMonthDay) return true;
  if (m === 2 && d === 29 && day.getMonth() === 1 && day.getDate() === 28 && !isLeap(day.getFullYear())) return true;
  return false;
}

function ageOn(fechaNac, day) {
  const [Y, M, D] = fechaNac.split('-').map(Number);
  let age = day.getFullYear() - Y;
  if (day.getMonth() < M - 1 || (day.getMonth() === M - 1 && day.getDate() < D)) age -= 1;
  return age;
}

export function buildCumpleañosDelDia(members, teams, now = new Date()) {
  const result = [];
  const teamsById = new Map((teams || []).map((t) => [t.id, t]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);

  for (const m of members || []) {
    if (!m.fechaNacimiento || typeof m.fechaNacimiento !== 'string') continue;
    if (birthdayOnDay(m.fechaNacimiento, today)) {
      result.push({
        id: `cumpleaños-${m.id}-${today.getFullYear()}`,
        type: 'cumpleaños',
        member: m,
        team: teamsById.get(m.teamId),
        label: `Hoy cumple ${m.nombre}`,
        severity: 'high',
        age: ageOn(m.fechaNacimiento, today),
      });
    } else if (birthdayOnDay(m.fechaNacimiento, tomorrow)) {
      result.push({
        id: `cumpleaños-${m.id}-${tomorrow.getFullYear()}-tomorrow`,
        type: 'cumpleaños',
        member: m,
        team: teamsById.get(m.teamId),
        label: `Mañana cumple ${m.nombre}`,
        severity: 'normal',
        age: ageOn(m.fechaNacimiento, tomorrow),
      });
    }
  }
  return result;
}

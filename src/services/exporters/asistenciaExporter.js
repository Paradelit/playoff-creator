import { EXPORT_MONTHS, monthKeyForExport, sessionLabelForDate } from './exportUtils';

const RESUMEN_MONTHS = EXPORT_MONTHS.filter((m) => m.key !== 'agosto');

export function groupSessionsByMonth(calSessions, manualSessions) {
  const result = {};
  for (const m of EXPORT_MONTHS) result[m.key] = [];

  const sortedCal = [...(calSessions || [])].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  for (const s of sortedCal) {
    const key = monthKeyForExport(s.fecha);
    if (!key) continue;
    result[key].push({ id: s.id, label: sessionLabelForDate(s.fecha), isCalendar: true });
  }

  for (const key of Object.keys(manualSessions || {})) {
    if (!result[key]) continue;
    for (const ms of manualSessions[key]) {
      result[key].push({ id: ms.id, label: ms.label || '', isCalendar: false });
    }
  }
  return result;
}

export function computeMonthTotals(member, sessions, attendance) {
  let f = 0;
  let r = 0;
  let minus = 0;
  for (const sess of sessions) {
    const code = attendance?.[sess.id]?.[member.id] || '';
    if (code === 'F' || code === 'L+') f++;
    else if (code === 'r' || code === 'R') r++;
    else if (code === '-') minus++;
  }
  return { f, r, minus };
}

export function computeYearTotals(member, sessionsByMonth, attendance) {
  const byMonth = {};
  let totalF = 0;
  let totalR = 0;
  let totalMinus = 0;
  for (const m of EXPORT_MONTHS) {
    const totals = computeMonthTotals(member, sessionsByMonth[m.key] || [], attendance);
    if (m.key === 'agosto') {
      byMonth[m.key] = 0; // agosto excluido del resumen anual, siempre 0 en byMonth
      continue;
    }
    byMonth[m.key] = totals.f;
    totalF += totals.f;
    totalR += totals.r;
    totalMinus += totals.minus;
  }
  return { byMonth, year: { f: totalF, r: totalR, minus: totalMinus } };
}

export { RESUMEN_MONTHS };

import {
  EXPORT_MONTHS,
  monthKeyForExport,
  sessionLabelForDate,
  formatFilename,
  fetchLogoAsDataUrl,
} from './exportUtils';
import { teamDisplayName } from '../../utils/teamUtils';

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

const MAX_PLAYERS = 16;
const MAX_SESSIONS = 16;

function paddedMembers(members) {
  const out = [];
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const real = members[i];
    out.push({
      id: real?.id || `_pad_${i}`,
      nombre: real?.nombre || `Jugador/a ${i + 1}`,
      isReal: !!real,
    });
  }
  return out;
}

const COLOR_FILLS = {
  F: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } },
  r: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE047' } },
  R: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE047' } },
  '-': { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } },
  'L+': { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF60A5FA' } },
};

const COLOR_TEXT = {
  F: { argb: 'FFFFFFFF' },
  '-': { argb: 'FFFFFFFF' },
  'L+': { argb: 'FFFFFFFF' },
};

export async function exportAsistenciaToExcel({
  team,
  profile,
  members,
  attendance,
  calSessions,
  manualSessions,
  temporada,
}) {
  const ExcelJSMod = await import('exceljs');
  const ExcelJS = ExcelJSMod.default || ExcelJSMod;
  const teamName = team ? teamDisplayName(team) : 'Equipo';
  const realMembers = members || [];
  if (realMembers.length > MAX_PLAYERS) {
    console.warn(`[asistenciaExporter] ${realMembers.length} jugadores, truncando a ${MAX_PLAYERS}`);
  }
  const padded = paddedMembers(realMembers);
  const sessionsByMonth = groupSessionsByMonth(calSessions || [], manualSessions || {});
  const logoDataUrl = await fetchLogoAsDataUrl(profile?.logoClub);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Playoff Creator';
  wb.created = new Date();

  let logoId = null;
  if (logoDataUrl) {
    try {
      logoId = wb.addImage({ base64: logoDataUrl, extension: 'png' });
    } catch {
      logoId = null;
    }
  }

  buildInstruccionesSheet(wb, padded, teamName, logoId);

  for (const m of EXPORT_MONTHS) {
    buildMonthSheet(wb, m, padded, sessionsByMonth[m.key], attendance, teamName, logoId);
  }

  buildResumenSheet(wb, padded, sessionsByMonth, attendance, teamName, temporada, logoId);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownloadBlob(blob, formatFilename('asistencia', teamName, temporada, 'xlsx'));
}

function triggerDownloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

function buildInstruccionesSheet(wb, padded, teamName, logoId) {
  const ws = wb.addWorksheet('Instrucciones');
  ws.columns = [{ width: 4 }, { width: 26 }, { width: 4 }, { width: 4 }, { width: 60 }];
  if (logoId !== null) {
    ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 80, height: 80 } });
  }
  ws.getCell('C2').value = 'Instrucciones';
  ws.getCell('C2').font = { size: 14, bold: true };
  ws.getCell('B3').value = 'Nombre del equipo';
  ws.getCell('E3').value = teamName;
  ws.getCell('E3').font = { bold: true };

  for (let i = 0; i < MAX_PLAYERS; i++) {
    ws.getCell(`A${5 + i}`).value = i + 1;
    ws.getCell(`B${5 + i}`).value = padded[i].nombre;
  }

  const notes = [
    'Nomenclatura para cumplimentar las hojas:',
    'F  = Ha faltado (rojo)',
    'r  = Un poco tarde, ≤10 min (amarillo)',
    'R  = Muy tarde, >10 min (amarillo)',
    '-  = Mala actitud (negro)',
    'L  = Lesionado y no viene',
    'L+ = Lesionado pero viene (azul)',
    '',
    'En las celdas "Totales" de la derecha se irán sumando automáticamente las F, las R y los -.',
    'En las celdas "Totales" de abajo, se sumarán las faltas en el día del equipo.',
    'En la última hoja "Resumen" se acumulan las faltas mensuales por jugador.',
  ];
  notes.forEach((text, i) => {
    ws.getCell(`E${5 + i}`).value = text;
  });
}

function buildMonthSheet(wb, month, padded, sessions, attendance, teamName, logoId) {
  const ws = wb.addWorksheet(month.full);
  ws.columns = [
    { width: 4 },
    { width: 30 },
    ...Array.from({ length: MAX_SESSIONS }, () => ({ width: 6 })),
    { width: 2 },
    { width: 6 },
    { width: 6 },
    { width: 6 },
  ];
  if (logoId !== null) {
    ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 60, height: 60 } });
  }

  ws.getCell('C2').value = month.full;
  ws.getCell('C2').font = { size: 14, bold: true };
  ws.getCell('E3').value = teamName;
  ws.getCell('E3').font = { bold: true };
  ws.mergeCells('E3:P3');
  ws.getCell('T4').value = 'Totales';
  ws.getCell('T4').alignment = { horizontal: 'center' };
  ws.getCell('T4').font = { bold: true };
  ws.mergeCells('T4:V4');

  const allSessions = sessions || [];
  if (allSessions.length > MAX_SESSIONS) {
    console.warn(`[asistenciaExporter] ${month.full}: ${allSessions.length} sesiones, truncando a ${MAX_SESSIONS}`);
  }
  const limited = allSessions.slice(0, MAX_SESSIONS);
  for (let i = 0; i < limited.length; i++) {
    const cell = ws.getCell(5, 3 + i);
    cell.value = limited[i].label || '';
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: 'center' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    cell.border = {
      bottom: { style: 'thin' },
      top: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  }
  ws.getCell('T5').value = 'F';
  ws.getCell('U5').value = 'R';
  ws.getCell('V5').value = '-';
  ['T5', 'U5', 'V5'].forEach((addr) => {
    const c = ws.getCell(addr);
    c.font = { bold: true };
    c.alignment = { horizontal: 'center' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    c.border = {
      bottom: { style: 'thin' },
      top: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  for (let i = 0; i < MAX_PLAYERS; i++) {
    const rowIdx = 6 + i;
    ws.getCell(rowIdx, 1).value = i + 1;
    ws.getCell(rowIdx, 1).alignment = { horizontal: 'center' };
    ws.getCell(rowIdx, 2).value = padded[i].nombre;
    ws.getCell(rowIdx, 2).font = { bold: padded[i].isReal };

    for (let s = 0; s < limited.length; s++) {
      const code = padded[i].isReal ? attendance?.[limited[s].id]?.[padded[i].id] || '' : '';
      const cell = ws.getCell(rowIdx, 3 + s);
      cell.value = code;
      cell.alignment = { horizontal: 'center' };
      cell.font = { bold: !!code, color: COLOR_TEXT[code] };
      if (COLOR_FILLS[code]) cell.fill = COLOR_FILLS[code];
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    }

    const totals = computeMonthTotals(padded[i], limited, attendance);
    const rangeStart = `C${rowIdx}`;
    const rangeEnd = `${columnLetter(2 + MAX_SESSIONS)}${rowIdx}`;
    ws.getCell(rowIdx, 20).value = {
      formula: `COUNTIF(${rangeStart}:${rangeEnd},"F")+COUNTIF(${rangeStart}:${rangeEnd},"L+")`,
      result: totals.f,
    };
    ws.getCell(rowIdx, 21).value = {
      formula: `COUNTIF(${rangeStart}:${rangeEnd},"r")+COUNTIF(${rangeStart}:${rangeEnd},"R")`,
      result: totals.r,
    };
    ws.getCell(rowIdx, 22).value = {
      formula: `COUNTIF(${rangeStart}:${rangeEnd},"-")`,
      result: totals.minus,
    };
    ['T', 'U', 'V'].forEach((col) => {
      const c = ws.getCell(`${col}${rowIdx}`);
      c.alignment = { horizontal: 'center' };
      c.font = { bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      c.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  }

  ws.getCell('B22').value = 'Totales';
  ws.getCell('B22').font = { bold: true };
  for (let s = 0; s < limited.length; s++) {
    const colIdx = 3 + s;
    const colLetterStr = columnLetter(colIdx);
    ws.getCell(22, colIdx).value = {
      formula: `COUNTIF(${colLetterStr}6:${colLetterStr}21,"F")`,
      result: limited[s] ? sumFForDay(padded, limited[s].id, attendance) : 0,
    };
    ws.getCell(22, colIdx).alignment = { horizontal: 'center' };
    ws.getCell(22, colIdx).font = { bold: true };
  }
}

function sumFForDay(padded, sessionId, attendance) {
  let total = 0;
  for (const m of padded) {
    if (!m.isReal) continue;
    if (attendance?.[sessionId]?.[m.id] === 'F') total++;
  }
  return total;
}

function columnLetter(idx) {
  let s = '';
  let n = idx;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function buildResumenSheet(wb, padded, sessionsByMonth, attendance, teamName, temporada, logoId) {
  const ws = wb.addWorksheet('Resumen');
  ws.columns = [
    { width: 4 },
    { width: 8 },
    { width: 8 },
    { width: 8 },
    { width: 8 },
    ...Array.from({ length: 10 }, () => ({ width: 6 })),
    { width: 6 },
    { width: 6 },
    { width: 6 },
  ];
  if (logoId !== null) {
    ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 60, height: 60 } });
  }

  ws.getCell('A2').value = `Resumen Asistencia ${temporada}`;
  ws.getCell('A2').font = { size: 14, bold: true };
  ws.mergeCells('A2:R2');
  ws.getCell('F3').value = teamName;
  ws.getCell('F3').font = { bold: true };
  ws.mergeCells('F3:N3');
  ws.getCell('P4').value = 'Totales';
  ws.getCell('P4').alignment = { horizontal: 'center' };
  ws.getCell('P4').font = { bold: true };
  ws.mergeCells('P4:R4');

  RESUMEN_MONTHS.forEach((m, i) => {
    const cell = ws.getCell(5, 6 + i);
    cell.value = m.label;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  });
  ws.getCell('P5').value = 'F';
  ws.getCell('Q5').value = 'R';
  ws.getCell('R5').value = '-';
  ['P5', 'Q5', 'R5'].forEach((a) => {
    const c = ws.getCell(a);
    c.font = { bold: true };
    c.alignment = { horizontal: 'center' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
  });

  for (let i = 0; i < MAX_PLAYERS; i++) {
    const rowIdx = 6 + i;
    ws.getCell(rowIdx, 1).value = i + 1;
    ws.getCell(rowIdx, 1).alignment = { horizontal: 'center' };
    ws.getCell(rowIdx, 2).value = padded[i].nombre;
    ws.getCell(rowIdx, 2).font = { bold: padded[i].isReal };
    ws.mergeCells(`B${rowIdx}:E${rowIdx}`);

    const totals = computeYearTotals(padded[i], sessionsByMonth, attendance);
    RESUMEN_MONTHS.forEach((m, j) => {
      const cell = ws.getCell(rowIdx, 6 + j);
      cell.value = totals.byMonth[m.key];
      cell.alignment = { horizontal: 'center' };
    });
    ws.getCell(rowIdx, 16).value = totals.year.f;
    ws.getCell(rowIdx, 17).value = totals.year.r;
    ws.getCell(rowIdx, 18).value = totals.year.minus;
    ['P', 'Q', 'R'].forEach((col) => {
      const c = ws.getCell(`${col}${rowIdx}`);
      c.alignment = { horizontal: 'center' };
      c.font = { bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    });
  }

  ws.getCell('B22').value = 'Totales equipo';
  ws.getCell('B22').font = { bold: true };
  ws.mergeCells('B22:E22');
  RESUMEN_MONTHS.forEach((m, j) => {
    let total = 0;
    for (const member of padded) {
      if (!member.isReal) continue;
      const monthSessions = sessionsByMonth[m.key] || [];
      total += computeMonthTotals(member, monthSessions, attendance).f;
    }
    ws.getCell(22, 6 + j).value = total;
    ws.getCell(22, 6 + j).alignment = { horizontal: 'center' };
    ws.getCell(22, 6 + j).font = { bold: true };
  });
}

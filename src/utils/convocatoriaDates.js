const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
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

export function saludoFromHour(h) {
  if (h >= 18) return 'Buenas noches';
  if (h >= 14) return 'Buenas tardes';
  return 'Buenos días';
}

function ymdToLocalDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function diffDays(target, now) {
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const n = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((t - n) / (1000 * 60 * 60 * 24));
}

export function fechaRelativa(targetYmd, now = new Date()) {
  const target = ymdToLocalDate(targetYmd);
  const days = diffDays(target, now);
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  if (days >= 2 && days <= 6) return `el ${DIAS_SEMANA[target.getDay()]}`;
  return `el ${target.getDate()} de ${MESES[target.getMonth()]}`;
}

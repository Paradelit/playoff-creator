export const TEAM_COLORS = [
  'bg-blue-600 text-white',
  'bg-orange-500 text-white',
  'bg-amber-500 text-white',
  'bg-rose-500 text-white',
  'bg-emerald-500 text-white',
  'bg-blue-400 text-white',
  'bg-pink-500 text-white',
  'bg-blue-800 text-white',
];

export function teamColorIndex(teamId) {
  if (!teamId) return 0;
  return teamId.charCodeAt(0) % TEAM_COLORS.length;
}

export const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const MONTH_NAMES_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const DAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const DAY_NAMES_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DAY_NAMES_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const DURACION_PARTIDO_FALLBACK = 90;

const DURACION_PARTIDO_MINUTOS = {
  premini: 60,
  minibasket: 75,
  mini: 75,
  preinfantil: 80,
  alevin: 80,
  infantil: 90,
  cadete: 90,
  junior: 100,
  senior: 100,
};

function normalizarCategoria(s) {
  if (typeof s !== 'string') return '';
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function estimarDuracionPartido(team) {
  const cat = normalizarCategoria(team?.categoria);
  return DURACION_PARTIDO_MINUTOS[cat] ?? DURACION_PARTIDO_FALLBACK;
}

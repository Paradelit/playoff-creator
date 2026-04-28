export function slugify(input) {
  if (typeof input !== 'string') return 'equipo';
  const normalized = input
    .replace(/º/g, 'o') // masculine ordinal º → o (e.g. 2º → 2o)
    .replace(/ª/g, 'a') // feminine ordinal ª → a
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
  return normalized || 'equipo';
}

export function formatFilename(type, teamName, temporada, ext) {
  const slug = slugify(teamName);
  const prefix = type === 'asistencia' ? 'Asistencia' : 'Informe-jugadores';
  return `${prefix}-${slug}-${temporada}.${ext}`;
}

export const EXPORT_MONTHS = [
  { key: 'agosto', label: 'Ago', full: 'Agosto', num: 7 },
  { key: 'septiembre', label: 'Sep', full: 'Septiembre', num: 8 },
  { key: 'octubre', label: 'Oct', full: 'Octubre', num: 9 },
  { key: 'noviembre', label: 'Nov', full: 'Noviembre', num: 10 },
  { key: 'diciembre', label: 'Dic', full: 'Diciembre', num: 11 },
  { key: 'enero', label: 'Ene', full: 'Enero', num: 0 },
  { key: 'febrero', label: 'Feb', full: 'Febrero', num: 1 },
  { key: 'marzo', label: 'Mar', full: 'Marzo', num: 2 },
  { key: 'abril', label: 'Abr', full: 'Abril', num: 3 },
  { key: 'mayo', label: 'May', full: 'Mayo', num: 4 },
  { key: 'junio', label: 'Jun', full: 'Junio', num: 5 },
];

export function monthKeyForExport(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const m = d.getMonth();
  return EXPORT_MONTHS.find((mo) => mo.num === m)?.key || null;
}

const DAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export function sessionLabelForDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return null;
  return `${DAY_LETTERS[d.getDay()]}-${d.getDate()}`;
}

export async function fetchLogoAsDataUrl(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

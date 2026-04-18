/**
 * Returns the current basketball season string, e.g. "2025-26".
 * Season starts in September.
 */
export function getTemporada() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

/**
 * Format a Date object as YYYY-MM-DD.
 */
export function toYMD(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Format a YYYY-MM-DD string as DD/MM/YYYY for display.
 */
/**
 * Returns the current season start/end dates as YYYY-MM-DD strings.
 * Season runs from September 1 to June 30.
 */
export function getSeasonDateRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;
  return { startDate: `${startYear}-09-01`, endDate: `${startYear + 1}-06-30` };
}

export function formatDateDisplay(ymd) {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Parse "HH:MM" into minutes since midnight. Returns null for invalid/empty input.
 */
export function hhmmToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Format minutes since midnight as "HH:MM".
 */
export function minutesToHHMM(min) {
  if (min == null || Number.isNaN(min)) return '';
  const safe = Math.max(0, Math.min(24 * 60, Math.round(min)));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Minutes between two "HH:MM" strings (b - a). Returns null if either is invalid.
 */
export function minutesBetween(a, b) {
  const ma = hhmmToMinutes(a);
  const mb = hhmmToMinutes(b);
  if (ma == null || mb == null) return null;
  return mb - ma;
}

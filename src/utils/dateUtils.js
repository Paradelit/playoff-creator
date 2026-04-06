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
export function formatDateDisplay(ymd) {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

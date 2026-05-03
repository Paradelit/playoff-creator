// src/billing/currentMonthId.ts
/**
 * Returns the current month id in 'YYYY-MM' format computed in Europe/Madrid timezone.
 * Mirror of functions/src/billing/currentMonthId.ts — same algorithm so the client
 * subscribes to the correct usage doc.
 */
export function currentMonthId(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  return `${year}-${month}`;
}

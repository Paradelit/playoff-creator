import { describe, it, expect } from 'vitest';
import { groupSessionsByMonth, computeMonthTotals, computeYearTotals } from './asistenciaExporter';

describe('groupSessionsByMonth', () => {
  it('groups calendar and manual sessions per month with correct labels', () => {
    const calSessions = [
      { id: 'c1', fecha: '2025-09-03' }, // X-3
      { id: 'c2', fecha: '2025-09-08' }, // L-8
      { id: 'c3', fecha: '2025-10-06' }, // L-6
    ];
    const manualSessions = {
      septiembre: [{ id: 'm1', label: 'X-1' }],
    };
    const result = groupSessionsByMonth(calSessions, manualSessions);
    expect(result.septiembre).toEqual([
      { id: 'c1', label: 'X-3', isCalendar: true },
      { id: 'c2', label: 'L-8', isCalendar: true },
      { id: 'm1', label: 'X-1', isCalendar: false },
    ]);
    expect(result.octubre).toEqual([{ id: 'c3', label: 'L-6', isCalendar: true }]);
    expect(result.agosto).toEqual([]);
  });

  it('sorts calendar sessions by date', () => {
    const calSessions = [
      { id: 'b', fecha: '2025-09-15' },
      { id: 'a', fecha: '2025-09-03' },
    ];
    const result = groupSessionsByMonth(calSessions, {});
    expect(result.septiembre.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('returns one entry per month in EXPORT_MONTHS, even when empty', () => {
    const result = groupSessionsByMonth([], {});
    const keys = Object.keys(result);
    expect(keys).toContain('agosto');
    expect(keys).toContain('junio');
    expect(keys).toHaveLength(11);
  });
});

describe('computeMonthTotals', () => {
  it('counts F+L+ as F, r+R as R, - as -', () => {
    const member = { id: 'm1', nombre: 'X' };
    const sessions = [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }];
    const attendance = {
      s1: { m1: 'F' },
      s2: { m1: 'L+' },
      s3: { m1: 'r' },
      s4: { m1: '-' },
    };
    expect(computeMonthTotals(member, sessions, attendance)).toEqual({ f: 2, r: 1, minus: 1 });
  });

  it('returns zeros when no sessions match', () => {
    expect(computeMonthTotals({ id: 'm1' }, [], {})).toEqual({ f: 0, r: 0, minus: 0 });
  });
});

describe('computeYearTotals', () => {
  it('sums monthly F totals (excluding agosto, per reference)', () => {
    const member = { id: 'm1', nombre: 'X' };
    const sessionsByMonth = {
      agosto: [{ id: 'a1' }],
      septiembre: [{ id: 's1' }],
      octubre: [{ id: 'o1' }, { id: 'o2' }],
    };
    const attendance = {
      a1: { m1: 'F' }, // agosto NO se cuenta en el yearly
      s1: { m1: 'F' },
      o1: { m1: 'L+' },
      o2: { m1: 'r' },
    };
    const result = computeYearTotals(member, sessionsByMonth, attendance);
    expect(result.byMonth.agosto).toBe(0); // excluded
    expect(result.byMonth.septiembre).toBe(1);
    expect(result.byMonth.octubre).toBe(1);
    expect(result.year).toEqual({ f: 2, r: 1, minus: 0 });
  });
});

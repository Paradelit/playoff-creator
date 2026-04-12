import { describe, it, expect, vi, afterEach } from 'vitest';
import { getTemporada, toYMD, getSeasonDateRange, formatDateDisplay } from './dateUtils';

describe('toYMD', () => {
  it('formats a Date as YYYY-MM-DD', () => {
    expect(toYMD(new Date(2025, 0, 5))).toBe('2025-01-05');
  });

  it('pads single-digit month and day', () => {
    expect(toYMD(new Date(2025, 2, 3))).toBe('2025-03-03');
  });

  it('handles December correctly', () => {
    expect(toYMD(new Date(2025, 11, 31))).toBe('2025-12-31');
  });
});

describe('formatDateDisplay', () => {
  it('formats YYYY-MM-DD as DD/MM/YYYY', () => {
    expect(formatDateDisplay('2025-03-15')).toBe('15/03/2025');
  });

  it('returns dash for null/undefined', () => {
    expect(formatDateDisplay(null)).toBe('—');
    expect(formatDateDisplay(undefined)).toBe('—');
    expect(formatDateDisplay('')).toBe('—');
  });
});

describe('getTemporada', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns current season when month >= September', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 8, 15)); // September 2025
    expect(getTemporada()).toBe('2025-26');
  });

  it('returns previous season when month < September', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 10)); // March 2026
    expect(getTemporada()).toBe('2025-26');
  });

  it('handles January correctly', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1)); // January 2026
    expect(getTemporada()).toBe('2025-26');
  });

  it('handles August (last month before new season)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 7, 31)); // August 2025
    expect(getTemporada()).toBe('2024-25');
  });
});

describe('getSeasonDateRange', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns Sep-Jun range for current season in fall', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 9, 1)); // October 2025
    expect(getSeasonDateRange()).toEqual({
      startDate: '2025-09-01',
      endDate: '2026-06-30',
    });
  });

  it('returns Sep-Jun range for current season in spring', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 10)); // April 2026
    expect(getSeasonDateRange()).toEqual({
      startDate: '2025-09-01',
      endDate: '2026-06-30',
    });
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getTemporada,
  toYMD,
  getSeasonDateRange,
  formatDateDisplay,
  hhmmToMinutes,
  minutesToHHMM,
  minutesBetween,
} from './dateUtils';

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

describe('hhmmToMinutes', () => {
  it('parses HH:MM into minutes since midnight', () => {
    expect(hhmmToMinutes('00:00')).toBe(0);
    expect(hhmmToMinutes('09:30')).toBe(570);
    expect(hhmmToMinutes('23:59')).toBe(23 * 60 + 59);
  });

  it('accepts single-digit hours', () => {
    expect(hhmmToMinutes('9:05')).toBe(9 * 60 + 5);
  });

  it('returns null for invalid input', () => {
    expect(hhmmToMinutes('')).toBeNull();
    expect(hhmmToMinutes(null)).toBeNull();
    expect(hhmmToMinutes('24:00')).toBeNull();
    expect(hhmmToMinutes('9:60')).toBeNull();
    expect(hhmmToMinutes('nope')).toBeNull();
  });
});

describe('minutesToHHMM', () => {
  it('formats minutes as HH:MM with padding', () => {
    expect(minutesToHHMM(0)).toBe('00:00');
    expect(minutesToHHMM(570)).toBe('09:30');
    expect(minutesToHHMM(23 * 60 + 59)).toBe('23:59');
  });

  it('clamps out-of-range values', () => {
    expect(minutesToHHMM(-30)).toBe('00:00');
    expect(minutesToHHMM(25 * 60)).toBe('24:00');
  });

  it('returns empty string for invalid input', () => {
    expect(minutesToHHMM(null)).toBe('');
    expect(minutesToHHMM(Number.NaN)).toBe('');
  });
});

describe('minutesBetween', () => {
  it('returns difference in minutes (b - a)', () => {
    expect(minutesBetween('09:00', '10:30')).toBe(90);
    expect(minutesBetween('10:30', '09:00')).toBe(-90);
  });

  it('returns null if either value is invalid', () => {
    expect(minutesBetween('09:00', '')).toBeNull();
    expect(minutesBetween('bad', '10:00')).toBeNull();
  });
});

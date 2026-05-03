// src/billing/currentMonthId.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { currentMonthId } from './currentMonthId';

describe('currentMonthId (frontend mirror)', () => {
  afterEach(() => vi.useRealTimers());

  it("returns 'YYYY-MM' format in Europe/Madrid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    expect(currentMonthId()).toBe('2026-05');
  });

  it('rolls over correctly at Madrid midnight', () => {
    vi.useFakeTimers();
    // 2026-04-30T22:30:00Z → 2026-05-01T00:30 Madrid (CEST = UTC+2 in summer)
    vi.setSystemTime(new Date('2026-04-30T22:30:00Z'));
    expect(currentMonthId()).toBe('2026-05');
  });
});

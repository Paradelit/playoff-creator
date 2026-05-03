// functions/src/billing/currentMonthId.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { currentMonthId } from "./currentMonthId";

describe("currentMonthId", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'YYYY-MM' format", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T12:00:00Z"));
    expect(currentMonthId()).toBe("2026-05");
  });

  it("uses Europe/Madrid timezone — last second of month UTC is still that month in Madrid (+1h CEST)", () => {
    vi.useFakeTimers();
    // 2026-05-31T23:30:00Z → 2026-06-01T01:30 Madrid (CEST = UTC+2 in summer)
    vi.setSystemTime(new Date("2026-05-31T23:30:00Z"));
    expect(currentMonthId()).toBe("2026-06");
  });

  it("rolls over correctly at Madrid midnight on day 1", () => {
    vi.useFakeTimers();
    // 2026-04-30T22:30:00Z → 2026-05-01T00:30 Madrid
    vi.setSystemTime(new Date("2026-04-30T22:30:00Z"));
    expect(currentMonthId()).toBe("2026-05");
  });

  it("pads single-digit months with zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
    expect(currentMonthId()).toBe("2026-01");
  });
});

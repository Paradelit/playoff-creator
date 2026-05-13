import { describe, expect, it } from "vitest";
import { deriveBracketState } from "../../digest/bracketState";

describe("deriveBracketState", () => {
  it("returns {} on empty/missing state", () => {
    expect(deriveBracketState({})).toEqual({});
    expect(deriveBracketState({ state: {} })).toEqual({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(deriveBracketState(null as any)).toEqual({});
  });

  it("returns {} when all matches have winner (bracket completed)", () => {
    const result = deriveBracketState({
      state: {
        "R1-M0": { id: "R1-M0", round: 1, team1: "A", team2: "B", winner: "A" },
        "R2-M0": { id: "R2-M0", round: 2, team1: "A", team2: "C", winner: "A" },
      },
    });
    expect(result).toEqual({});
  });

  it("identifies current round as earliest with un-decided match", () => {
    const result = deriveBracketState({
      state: {
        "R1-M0": { id: "R1-M0", round: 1, team1: "A", team2: "B", winner: "A", title: "Cuartos" },
        "R1-M1": { id: "R1-M1", round: 1, team1: "C", team2: "D", winner: "C", title: "Cuartos" },
        "R2-M0": { id: "R2-M0", round: 2, team1: "A", team2: "C", title: "SEMIFINALES" },
      },
    });
    expect(result.currentRound).toBe("SEMIFINALES");
  });

  it("falls back to 'Ronda N' when match has no title", () => {
    const result = deriveBracketState({
      state: {
        "R1-M0": { id: "R1-M0", round: 1, team1: "A", team2: "B" },
      },
    });
    expect(result.currentRound).toBe("Ronda 1");
  });

  it("nextMatch is the first un-decided match in current round (with both teams)", () => {
    const result = deriveBracketState({
      state: {
        "R1-M0": { id: "R1-M0", round: 1, team1: "A", team2: "B", winner: "A" },
        "R1-M1": { id: "R1-M1", round: 1, team1: "C", team2: "D" },
        "R1-M2": { id: "R1-M2", round: 1, team1: "E", team2: "F" },
      },
    });
    expect(result.nextMatch).toEqual({
      id: "R1-M1",
      teamA: "C",
      teamB: "D",
      scheduled: undefined,
    });
  });

  it("nextMatch includes scheduled date when present", () => {
    const result = deriveBracketState({
      state: {
        "R1-M0": { id: "R1-M0", round: 1, team1: "A", team2: "B", dates: ["2026-05-20"] },
      },
    });
    expect(result.nextMatch?.scheduled).toBe("2026-05-20");
  });

  it("nextMatch falls back to '?' for missing teams", () => {
    const result = deriveBracketState({
      state: {
        "R1-M0": { id: "R1-M0", round: 1 },
      },
    });
    expect(result.nextMatch).toEqual({
      id: "R1-M0",
      teamA: "?",
      teamB: "?",
      scheduled: undefined,
    });
  });

  it("pendingScores counts un-decided matches with both teams in current round", () => {
    const result = deriveBracketState({
      state: {
        "R1-M0": { id: "R1-M0", round: 1, team1: "A", team2: "B", winner: "A" }, // decided
        "R1-M1": { id: "R1-M1", round: 1, team1: "C", team2: "D" }, // pending
        "R1-M2": { id: "R1-M2", round: 1, team1: "E", team2: "F" }, // pending
        "R1-M3": { id: "R1-M3", round: 1, team1: "G" }, // missing team2, NOT counted
      },
    });
    expect(result.pendingScores).toBe(2);
  });

  it("pendingScores omitted when 0", () => {
    const result = deriveBracketState({
      state: {
        "R1-M0": { id: "R1-M0", round: 1, team1: "A" }, // missing team2
      },
    });
    expect(result.pendingScores).toBeUndefined();
  });
});

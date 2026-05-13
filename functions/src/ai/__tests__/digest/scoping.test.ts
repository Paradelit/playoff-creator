import { describe, expect, it } from "vitest";
import { resolveScopedTeamIds } from "../../digest/scoping";

describe("resolveScopedTeamIds", () => {
  it("returns null for owner (no filter)", () => {
    expect(resolveScopedTeamIds({ role: "owner" })).toBeNull();
  });

  it("returns null for coach (no filter)", () => {
    expect(resolveScopedTeamIds({ role: "coach" })).toBeNull();
  });

  it("returns null for owner even if assignedTeamIds is set (ignored)", () => {
    expect(resolveScopedTeamIds({ role: "owner", assignedTeamIds: ["t1"] })).toBeNull();
  });

  it("returns Set for assistant with assignedTeamIds non-empty", () => {
    const set = resolveScopedTeamIds({ role: "assistant", assignedTeamIds: ["t1", "t2"] });
    expect(set).toBeInstanceOf(Set);
    expect(set!.has("t1")).toBe(true);
    expect(set!.has("t2")).toBe(true);
    expect(set!.size).toBe(2);
  });

  it("returns empty Set for assistant without assignedTeamIds", () => {
    expect(resolveScopedTeamIds({ role: "assistant" })?.size).toBe(0);
  });

  it("returns empty Set for assistant with null assignedTeamIds", () => {
    expect(resolveScopedTeamIds({ role: "assistant", assignedTeamIds: null })?.size).toBe(0);
  });

  it("returns empty Set for assistant with empty array", () => {
    expect(resolveScopedTeamIds({ role: "assistant", assignedTeamIds: [] })?.size).toBe(0);
  });
});

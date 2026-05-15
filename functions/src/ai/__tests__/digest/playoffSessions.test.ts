import { describe, expect, it } from "vitest";
import { buildPlayoffSessionsInRange } from "../../digest/playoffSessions";

interface DocSnapStub {
  id: string;
  data: () => Record<string, unknown>;
}

function makeDb(brackets: Array<{ id: string; data: Record<string, unknown> }>) {
  const docs: DocSnapStub[] = brackets.map((b) => ({ id: b.id, data: () => b.data }));
  return {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: () => ({
            collection: (name: string) => {
              if (name === "brackets") return { get: async () => ({ docs }) };
              return { get: async () => ({ docs: [] }) };
            },
          }),
        }),
      }),
    }),
  };
}

const TEAMS_BY_ID = new Map([
  ["t1", "Cadete A"],
  ["t2", "Junior B"],
]);

describe("buildPlayoffSessionsInRange", () => {
  it("emits virtual sessions for matches with myTeam in date range", async () => {
    const db = makeDb([
      {
        id: "br1",
        data: {
          teamId: "t1",
          myTeam: "Cadete A",
          bracketData: {
            state: {
              "R1-M0": {
                id: "R1-M0",
                team1: "Cadete A",
                team2: "Hispano",
                dates: ["2026-05-16"],
                times: ["11:00"],
                places: ["Pabellón Norte"],
                gamesCount: 1,
              },
            },
          },
        },
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildPlayoffSessionsInRange({
      db: db as any,
      appId: "a",
      wsId: "w",
      fromISO: "2026-05-15",
      toISO: "2026-05-22",
      teamsById: TEAMS_BY_ID,
    });

    expect(result).toEqual([
      {
        id: "playoff-br1-R1-M0-0",
        fecha: "2026-05-16",
        horaInicio: "11:00",
        tipo: "playoff",
        teamId: "t1",
        teamName: "Cadete A",
        rival: "Hispano",
        lugar: "Pabellón Norte",
      },
    ]);
  });

  it("emits multiple virtual sessions per match (best-of-N games)", async () => {
    const db = makeDb([
      {
        id: "br1",
        data: {
          teamId: "t1",
          myTeam: "Cadete A",
          bracketData: {
            state: {
              "R1-M0": {
                id: "R1-M0",
                team1: "Cadete A",
                team2: "Hispano",
                dates: ["2026-05-16", "2026-05-17"],
                times: ["11:00", "12:00"],
                places: ["Pabellón Norte", "Pabellón Sur"],
                gamesCount: 3,
              },
            },
          },
        },
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildPlayoffSessionsInRange({
      db: db as any,
      appId: "a",
      wsId: "w",
      fromISO: "2026-05-15",
      toISO: "2026-05-22",
      teamsById: TEAMS_BY_ID,
    });

    expect(result.map((r) => r.id)).toEqual(["playoff-br1-R1-M0-0", "playoff-br1-R1-M0-1"]);
    expect(result[1].fecha).toBe("2026-05-17");
  });

  it("skips games already decided by series (BO3, 2-0 after game 0)", async () => {
    const db = makeDb([
      {
        id: "br1",
        data: {
          teamId: "t1",
          myTeam: "Cadete A",
          bracketData: {
            state: {
              "R1-M0": {
                id: "R1-M0",
                team1: "Cadete A",
                team2: "Hispano",
                dates: ["2026-05-09", "2026-05-12", "2026-05-16"],
                times: ["11:00", "12:00", "13:00"],
                places: ["", "", ""],
                gamesCount: 3,
                // After games 0 and 1, t1 has 2 wins → game 2 should be skipped
                scores: [
                  { s1: 60, s2: 50 },
                  { s1: 70, s2: 55 },
                ],
              },
            },
          },
        },
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildPlayoffSessionsInRange({
      db: db as any,
      appId: "a",
      wsId: "w",
      fromISO: "2026-05-01",
      toISO: "2026-05-22",
      teamsById: TEAMS_BY_ID,
    });

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["playoff-br1-R1-M0-0", "playoff-br1-R1-M0-1"]);
  });

  it("filters matches where myTeam is not involved", async () => {
    const db = makeDb([
      {
        id: "br1",
        data: {
          teamId: "t1",
          myTeam: "Cadete A",
          bracketData: {
            state: {
              "R1-M0": {
                id: "R1-M0",
                team1: "Other",
                team2: "Another",
                dates: ["2026-05-16"],
                times: ["11:00"],
                places: [""],
                gamesCount: 1,
              },
            },
          },
        },
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildPlayoffSessionsInRange({
      db: db as any,
      appId: "a",
      wsId: "w",
      fromISO: "2026-05-15",
      toISO: "2026-05-22",
      teamsById: TEAMS_BY_ID,
    });

    expect(result).toEqual([]);
  });

  it("filters by date range", async () => {
    const db = makeDb([
      {
        id: "br1",
        data: {
          teamId: "t1",
          myTeam: "Cadete A",
          bracketData: {
            state: {
              "R1-M0": {
                id: "R1-M0",
                team1: "Cadete A",
                team2: "Hispano",
                dates: ["2026-04-01", "2026-05-16", "2026-06-01"],
                times: ["", "", ""],
                places: ["", "", ""],
                gamesCount: 3,
              },
            },
          },
        },
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildPlayoffSessionsInRange({
      db: db as any,
      appId: "a",
      wsId: "w",
      fromISO: "2026-05-10",
      toISO: "2026-05-20",
      teamsById: TEAMS_BY_ID,
    });

    expect(result).toHaveLength(1);
    expect(result[0].fecha).toBe("2026-05-16");
  });

  it("respects scopedTeamIds (assistant scope)", async () => {
    const db = makeDb([
      {
        id: "br1",
        data: {
          teamId: "t1",
          myTeam: "Cadete A",
          bracketData: {
            state: {
              "R1-M0": {
                id: "R1-M0",
                team1: "Cadete A",
                team2: "Rival",
                dates: ["2026-05-16"],
                times: ["11:00"],
                places: [""],
                gamesCount: 1,
              },
            },
          },
        },
      },
      {
        id: "br2",
        data: {
          teamId: "t2",
          myTeam: "Junior B",
          bracketData: {
            state: {
              "R1-M0": {
                id: "R1-M0",
                team1: "Junior B",
                team2: "Rival",
                dates: ["2026-05-17"],
                times: ["12:00"],
                places: [""],
                gamesCount: 1,
              },
            },
          },
        },
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildPlayoffSessionsInRange({
      db: db as any,
      appId: "a",
      wsId: "w",
      fromISO: "2026-05-15",
      toISO: "2026-05-22",
      teamsById: TEAMS_BY_ID,
      scopedTeamIds: new Set(["t1"]),
    });

    expect(result).toHaveLength(1);
    expect(result[0].teamId).toBe("t1");
  });

  it("skips brackets without myTeam or teamId", async () => {
    const db = makeDb([
      { id: "br-noteam", data: { myTeam: "X", bracketData: { state: {} } } },
      { id: "br-nomyteam", data: { teamId: "t1", bracketData: { state: {} } } },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildPlayoffSessionsInRange({
      db: db as any,
      appId: "a",
      wsId: "w",
      fromISO: "2026-05-15",
      toISO: "2026-05-22",
      teamsById: TEAMS_BY_ID,
    });

    expect(result).toEqual([]);
  });

  it("parses DD/MM/YYYY date format", async () => {
    const db = makeDb([
      {
        id: "br1",
        data: {
          teamId: "t1",
          myTeam: "Cadete A",
          bracketData: {
            state: {
              "R1-M0": {
                id: "R1-M0",
                team1: "Cadete A",
                team2: "Rival",
                dates: ["16/05/2026"],
                times: ["11:00"],
                places: [""],
                gamesCount: 1,
              },
            },
          },
        },
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildPlayoffSessionsInRange({
      db: db as any,
      appId: "a",
      wsId: "w",
      fromISO: "2026-05-15",
      toISO: "2026-05-22",
      teamsById: TEAMS_BY_ID,
    });

    expect(result[0].fecha).toBe("2026-05-16");
  });
});

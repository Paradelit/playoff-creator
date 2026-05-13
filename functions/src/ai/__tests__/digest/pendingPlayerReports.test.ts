import { describe, expect, it } from "vitest";
import { buildPendingPlayerReports } from "../../digest/pendingPlayerReports";

interface MemberStub {
  id: string;
  data: Record<string, unknown>;
}

function makeDb(opts: {
  teams: Array<{
    id: string;
    members: MemberStub[];
    informeRows?: Array<Record<string, unknown>>;
  }>;
}) {
  return {
    collection: (root: string) => {
      void root;
      return {
        doc: () => ({
          collection: () => ({
            doc: () => ({
              collection: (sub: string) => {
                void sub;
                return {
                  doc: (teamId: string) => ({
                    collection: (subSub: string) => {
                      if (subSub === "members") {
                        const team = opts.teams.find((t) => t.id === teamId);
                        return {
                          get: async () => ({
                            docs: (team?.members || []).map((m) => ({ id: m.id, data: () => m.data })),
                          }),
                        };
                      }
                      if (subSub === "cuaderno") {
                        return {
                          doc: () => ({
                            get: async () => {
                              const team = opts.teams.find((t) => t.id === teamId);
                              if (!team?.informeRows) return { exists: false, data: () => undefined };
                              return { exists: true, data: () => ({ rows: team.informeRows }) };
                            },
                          }),
                        };
                      }
                      return { get: async () => ({ docs: [] }) };
                    },
                  }),
                };
              },
            }),
          }),
        }),
      };
    },
  };
}

describe("buildPendingPlayerReports", () => {
  it("returns [] when teamsById is empty", async () => {
    const db = makeDb({ teams: [] });
    const result = await buildPendingPlayerReports({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      teamsById: new Map(),
      scopedTeamIds: null,
    });
    expect(result).toEqual([]);
  });

  it("flags jugadores sin row en el informe", async () => {
    const db = makeDb({
      teams: [
        {
          id: "tA",
          members: [
            { id: "p1", data: { tipo: "jugador", nombre: "Ana" } },
            { id: "p2", data: { tipo: "jugador", nombre: "Bea" } },
          ],
          informeRows: [{ id: "p1", nombre: "Ana", compromiso: "alto" }],
        },
      ],
    });
    const result = await buildPendingPlayerReports({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      teamsById: new Map([["tA", "Cadete A"]]),
      scopedTeamIds: null,
    });
    expect(result).toHaveLength(1);
    expect(result[0].teamName).toBe("Cadete A");
    expect(result[0].missingForPlayerCount).toBe(1);
    expect(result[0].missingPlayerNames).toEqual(["Bea"]);
  });

  it("flags row vacío (sin ningún campo de texto)", async () => {
    const db = makeDb({
      teams: [
        {
          id: "tA",
          members: [{ id: "p1", data: { tipo: "jugador", nombre: "Ana" } }],
          informeRows: [{ id: "p1", nombre: "Ana", compromiso: "", actitud: "" }],
        },
      ],
    });
    const result = await buildPendingPlayerReports({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      teamsById: new Map([["tA", "Cadete A"]]),
      scopedTeamIds: null,
    });
    expect(result[0].missingForPlayerCount).toBe(1);
  });

  it("considera row OK si al menos un campo de texto tiene contenido", async () => {
    const db = makeDb({
      teams: [
        {
          id: "tA",
          members: [{ id: "p1", data: { tipo: "jugador", nombre: "Ana" } }],
          informeRows: [{ id: "p1", nombre: "Ana", tiro: "buena mecánica" }],
        },
      ],
    });
    const result = await buildPendingPlayerReports({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      teamsById: new Map([["tA", "Cadete A"]]),
      scopedTeamIds: null,
    });
    expect(result).toHaveLength(0); // sin pending
  });

  it("matchea por nombre cuando el id no coincide pero el nombre sí", async () => {
    const db = makeDb({
      teams: [
        {
          id: "tA",
          members: [{ id: "p1", data: { tipo: "jugador", nombre: "Pablo" } }],
          informeRows: [{ id: "different-id", nombre: "Pablo", compromiso: "alto" }],
        },
      ],
    });
    const result = await buildPendingPlayerReports({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      teamsById: new Map([["tA", "Cadete A"]]),
      scopedTeamIds: null,
    });
    expect(result).toHaveLength(0);
  });

  it("filtra por scopedTeamIds", async () => {
    const db = makeDb({
      teams: [
        {
          id: "tA",
          members: [{ id: "p1", data: { tipo: "jugador", nombre: "Ana" } }],
          informeRows: [],
        },
        {
          id: "tB",
          members: [{ id: "p2", data: { tipo: "jugador", nombre: "Bea" } }],
          informeRows: [],
        },
      ],
    });
    const result = await buildPendingPlayerReports({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      teamsById: new Map([
        ["tA", "Cadete A"],
        ["tB", "Cadete B"],
      ]),
      scopedTeamIds: new Set(["tA"]),
    });
    expect(result).toHaveLength(1);
    expect(result[0].teamId).toBe("tA");
  });

  it("ordena teams por missingForPlayerCount desc", async () => {
    const db = makeDb({
      teams: [
        {
          id: "tA",
          members: [{ id: "p1", data: { tipo: "jugador", nombre: "Ana" } }],
          informeRows: [],
        },
        {
          id: "tB",
          members: [
            { id: "p2", data: { tipo: "jugador", nombre: "Bea" } },
            { id: "p3", data: { tipo: "jugador", nombre: "Carla" } },
          ],
          informeRows: [],
        },
      ],
    });
    const result = await buildPendingPlayerReports({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      teamsById: new Map([
        ["tA", "A"],
        ["tB", "B"],
      ]),
      scopedTeamIds: null,
    });
    expect(result[0].teamId).toBe("tB");
    expect(result[1].teamId).toBe("tA");
  });

  it("cap missingPlayerNames a 10 (preview)", async () => {
    const members = Array.from({ length: 15 }, (_, i) => ({
      id: `p${i}`,
      data: { tipo: "jugador", nombre: `Jugador${String.fromCharCode(65 + i)}` },
    }));
    const db = makeDb({
      teams: [{ id: "tA", members, informeRows: [] }],
    });
    const result = await buildPendingPlayerReports({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      teamsById: new Map([["tA", "A"]]),
      scopedTeamIds: null,
    });
    expect(result[0].missingForPlayerCount).toBe(15);
    expect(result[0].missingPlayerNames).toHaveLength(10);
  });
});

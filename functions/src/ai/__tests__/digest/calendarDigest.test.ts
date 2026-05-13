import { describe, expect, it } from "vitest";
import { buildUpcomingSessionsDigest } from "../../digest/calendarDigest";

interface DocSnapStub {
  id: string;
  data: () => Record<string, unknown>;
}

function makeDb(sessions: Array<{ id: string; data: Record<string, unknown> }>) {
  const docs: DocSnapStub[] = sessions.map((s) => ({ id: s.id, data: () => s.data }));
  const query = {
    where: () => query,
    orderBy: () => query,
    get: async () => ({ docs }),
  };
  return {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: () => ({
            collection: (name: string) => {
              if (name === "calendarSessions") return query;
              return { get: async () => ({ docs: [] }) };
            },
          }),
        }),
      }),
    }),
  };
}

describe("buildUpcomingSessionsDigest", () => {
  it("maps session fields including teamName from teamsById", async () => {
    const db = makeDb([
      {
        id: "s1",
        data: {
          fecha: "2026-05-15",
          horaInicio: "19:00",
          tipo: "entrenamiento",
          teamId: "t1",
          lugar: "Pabellón",
        },
      },
    ]);
    const teamsById = new Map([["t1", "Juniors B"]]);
    const result = await buildUpcomingSessionsDigest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      todayISO: "2026-05-13",
      teamsById,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "s1",
      fecha: "2026-05-15",
      horaInicio: "19:00",
      tipo: "entrenamiento",
      teamName: "Juniors B",
      lugar: "Pabellón",
    });
  });

  it("caps at 15 sessions", async () => {
    const sessions = Array.from({ length: 25 }, (_, i) => ({
      id: `s${i}`,
      data: { fecha: "2026-05-15" },
    }));
    const db = makeDb(sessions);
    const result = await buildUpcomingSessionsDigest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      todayISO: "2026-05-13",
      teamsById: new Map(),
    });
    expect(result).toHaveLength(15);
  });

  it("returns empty array when no sessions match window", async () => {
    const db = makeDb([]);
    const result = await buildUpcomingSessionsDigest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      todayISO: "2026-05-13",
      teamsById: new Map(),
    });
    expect(result).toEqual([]);
  });
});

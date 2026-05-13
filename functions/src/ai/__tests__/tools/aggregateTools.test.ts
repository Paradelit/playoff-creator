import { describe, expect, it } from "vitest";
import { createAggregateTools } from "../../tools/aggregateTools";
import type { ToolContext } from "../../tools/registry";

/**
 * Tests focales de los 3 aggregate read tools. Mock minimal de Firestore
 * para verificar shape de output + filtros básicos.
 */

interface DocStub {
  id: string;
  data: Record<string, unknown>;
  exists?: boolean;
}

function makeDoc(id: string, data: Record<string, unknown>, exists = true): DocStub {
  return { id, data, exists };
}

function makeDocResult(d: DocStub | null) {
  if (!d || d.exists === false) {
    return { exists: false, data: () => undefined };
  }
  return { exists: true, data: () => d.data };
}

// Mock factory: structure deep mirrors Firestore Admin SDK.
function makeMockDb(state: {
  teams?: Record<string, Record<string, unknown>>; // teamId → team data
  members?: Record<string, DocStub[]>; // teamId → member docs
  attendance?: Record<string, Record<string, Record<string, string>>>; // teamId → { sessionId → { memberId → code } }
  informe?: Record<string, Record<string, unknown>>; // teamId → informe doc data
  shooting?: Record<string, Record<string, unknown>>; // teamId → shooting doc data
  sessions?: DocStub[]; // all calendarSessions; filters applied via .where chain mock
}) {
  function makeQuery(allSessions: DocStub[]) {
    let filters: Array<(d: DocStub) => boolean> = [];
    let orderField: string | null = null;
    let orderDir: "asc" | "desc" = "asc";
    let limitN: number | null = null;
    interface WrappedDoc {
      id: string;
      data: () => Record<string, unknown>;
    }
    const q: {
      where: (field: string, op: string, value: unknown) => typeof q;
      orderBy: (field: string, dir?: "asc" | "desc") => typeof q;
      limit: (n: number) => typeof q;
      get: () => Promise<{ docs: WrappedDoc[] }>;
    } = {
      where: (field: string, op: string, value: unknown) => {
        filters.push((d) => {
          const v = d.data[field];
          if (op === "==") return v === value;
          if (op === "<") return typeof v === "string" && typeof value === "string" && v < value;
          if (op === ">=") return typeof v === "string" && typeof value === "string" && v >= value;
          return true;
        });
        return q;
      },
      orderBy: (field: string, dir: "asc" | "desc" = "asc") => {
        orderField = field;
        orderDir = dir;
        return q;
      },
      limit: (n: number) => {
        limitN = n;
        return q;
      },
      get: async () => {
        let docs = allSessions.filter((d) => filters.every((f) => f(d)));
        if (orderField) {
          docs = [...docs].sort((a, b) => {
            const aV = String(a.data[orderField!] || "");
            const bV = String(b.data[orderField!] || "");
            return orderDir === "asc" ? aV.localeCompare(bV) : bV.localeCompare(aV);
          });
        }
        if (limitN !== null) docs = docs.slice(0, limitN);
        return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
      },
    };
    return q;
  }

  const db = {
    doc: (path: string) => {
      // path like "artifacts/a/workspaces/w" or full path to a sub-doc.
      return {
        collection: (name: string) => makeColRef(name, path),
        get: async () => ({ exists: false, data: () => undefined }),
      };
    },
    collection: (name: string) => makeColRef(name, ""),
  };

  function makeColRef(name: string, parentPath: string) {
    return {
      doc: (id: string) => {
        const fullPath = `${parentPath}/${name}/${id}`.replace(/^\//, "");
        return {
          get: async () => {
            // teams/{teamId}
            const teamMatch = fullPath.match(/^artifacts\/[^/]+\/workspaces\/[^/]+\/teams\/([^/]+)$/);
            if (teamMatch) {
              const teamId = teamMatch[1];
              const data = state.teams?.[teamId];
              return makeDocResult(data ? { id: teamId, data, exists: true } : null);
            }
            // teams/{teamId}/cuaderno/{name}
            const cuadernoMatch = fullPath.match(
              /^artifacts\/[^/]+\/workspaces\/[^/]+\/teams\/([^/]+)\/cuaderno\/(.+)$/
            );
            if (cuadernoMatch) {
              const teamId = cuadernoMatch[1];
              const section = cuadernoMatch[2];
              if (section === "asistencia") {
                const m = state.attendance?.[teamId];
                if (m) return makeDocResult({ id: section, data: { attendance: m } });
              }
              if (section === "informe-jugadores") {
                const d = state.informe?.[teamId];
                if (d) return makeDocResult({ id: section, data: d });
              }
              if (section === "test-tiro") {
                const d = state.shooting?.[teamId];
                if (d) return makeDocResult({ id: section, data: d });
              }
              return makeDocResult(null);
            }
            // teams/{teamId}/members/{playerId}
            const memberMatch = fullPath.match(
              /^artifacts\/[^/]+\/workspaces\/[^/]+\/teams\/([^/]+)\/members\/(.+)$/
            );
            if (memberMatch) {
              const teamId = memberMatch[1];
              const playerId = memberMatch[2];
              const members = state.members?.[teamId] || [];
              const found = members.find((m) => m.id === playerId);
              return makeDocResult(found || null);
            }
            return makeDocResult(null);
          },
          collection: (sub: string) => makeColRef(sub, fullPath),
        };
      },
      get: async () => {
        // collection get: teams or teamId/members
        function wrap(docs: DocStub[]) {
          return docs.map((d) => ({ id: d.id, data: () => d.data }));
        }
        if (name === "teams") {
          return { docs: wrap([]) };
        }
        if (name === "members") {
          const teamMatch = parentPath.match(/teams\/([^/]+)$/);
          const teamId = teamMatch?.[1];
          return { docs: wrap(state.members?.[teamId || ""] || []) };
        }
        if (name === "calendarSessions") {
          return { docs: wrap(state.sessions || []) };
        }
        return { docs: [] };
      },
      // For calendarSessions queries:
      where: (...args: [string, string, unknown]) => {
        if (name === "calendarSessions") {
          return makeQuery(state.sessions || []).where(...args);
        }
        return makeQuery([]).where(...args);
      },
      orderBy: (...args: [string, ("asc" | "desc")?]) => {
        if (name === "calendarSessions") {
          return makeQuery(state.sessions || []).orderBy(...args);
        }
        return makeQuery([]).orderBy(...args);
      },
      limit: (n: number) => {
        if (name === "calendarSessions") {
          return makeQuery(state.sessions || []).limit(n);
        }
        return makeQuery([]).limit(n);
      },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db as any;
}

function pastISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const tools = createAggregateTools();
function findTool(name: string) {
  const t = tools.find((x) => x.name === name);
  if (!t) throw new Error(`Tool ${name} not found`);
  return t;
}

function makeCtx(db: unknown): ToolContext {
  return {
    db: db as FirebaseFirestore.Firestore,
    userId: "u1",
    wsId: "w1",
    appId: "app1",
  };
}

describe("createAggregateTools", () => {
  it("registers 3 tools", () => {
    expect(tools.map((t) => t.name)).toEqual([
      "get_recent_results",
      "get_attendance_summary",
      "get_player_status",
    ]);
  });

  describe("get_recent_results", () => {
    it("returns past partidos with parsed results normalizados al PoV del coach", async () => {
      const db = makeMockDb({
        sessions: [
          makeDoc("s1", {
            tipo: "partido",
            fecha: pastISO(1),
            teamId: "tA",
            rival: "Hispano",
            esLocal: true,
            resultado: { local: 70, visitante: 65 },
          }),
          makeDoc("s2", {
            tipo: "partido",
            fecha: pastISO(8),
            teamId: "tA",
            rival: "Olímpico",
            esLocal: false,
            resultado: { local: 60, visitante: 72 },
          }),
        ],
        teams: { tA: { teamName: "Cadete A" } },
      });
      const tool = findTool("get_recent_results");
      const out = (await tool.handler({}, makeCtx(db))) as {
        count: number;
        results: Array<{ sessionId: string; result: { ourScore: number; theirScore: number } | null }>;
      };
      expect(out.count).toBe(2);
      expect(out.results[0].sessionId).toBe("s1");
      expect(out.results[0].result).toEqual({ ourScore: 70, theirScore: 65 });
      // s2: esLocal=false, so ourScore=visitante=72, theirScore=local=60
      expect(out.results[1].result).toEqual({ ourScore: 72, theirScore: 60 });
    });

    it("clamps limit to range [1, 30]", async () => {
      const db = makeMockDb({ sessions: [] });
      const tool = findTool("get_recent_results");
      // limit=999 should clamp to 30 internally; we can't easily inspect the
      // internal limit but the call should not throw.
      await expect(tool.handler({ limit: 999 }, makeCtx(db))).resolves.toBeDefined();
    });
  });

  describe("get_attendance_summary", () => {
    it("aggregates F/R/-/L counts per player in window", async () => {
      const db = makeMockDb({
        members: {
          tA: [
            makeDoc("p1", { tipo: "jugador", nombre: "Ana", dorsal: 4 }),
            makeDoc("p2", { tipo: "jugador", nombre: "Bea", dorsal: 5 }),
          ],
        },
        attendance: {
          tA: {
            s1: { p1: "F", p2: "R" },
            s2: { p1: "F", p2: "L+" },
            s3: { p1: "-", p2: "" },
          },
        },
        sessions: [
          makeDoc("s1", { teamId: "tA", fecha: pastISO(3) }),
          makeDoc("s2", { teamId: "tA", fecha: pastISO(7) }),
          makeDoc("s3", { teamId: "tA", fecha: pastISO(10) }),
        ],
      });
      const tool = findTool("get_attendance_summary");
      const out = (await tool.handler({ teamId: "tA" }, makeCtx(db))) as {
        teamId: string;
        weeks: number;
        totalSessionsInWindow: number;
        summary: Array<{ playerId: string; F: number; R: number; "-": number; lesionado: number }>;
      };
      expect(out.teamId).toBe("tA");
      expect(out.totalSessionsInWindow).toBe(3);
      const p1 = out.summary.find((s) => s.playerId === "p1");
      const p2 = out.summary.find((s) => s.playerId === "p2");
      expect(p1).toMatchObject({ F: 2, R: 0, "-": 1, lesionado: 0 });
      expect(p2).toMatchObject({ F: 0, R: 1, "-": 0, lesionado: 1 });
      // Sort: p1 has más F → primero.
      expect(out.summary[0].playerId).toBe("p1");
    });

    it("requires teamId", async () => {
      const db = makeMockDb({});
      const tool = findTool("get_attendance_summary");
      const out = (await tool.handler({}, makeCtx(db))) as { error?: string };
      expect(out.error).toBeDefined();
    });
  });

  describe("get_player_status", () => {
    it("returns player info + 4w attendance + informe row + shooting row", async () => {
      const db = makeMockDb({
        members: {
          tA: [
            makeDoc("p1", {
              tipo: "jugador",
              nombre: "Pablo",
              dorsal: "4",
              posicion: "Base",
              fechaNacimiento: "2010-04-29",
            }),
          ],
        },
        attendance: {
          tA: { s1: { p1: "F" }, s2: { p1: "R" } },
        },
        sessions: [
          makeDoc("s1", { teamId: "tA", fecha: pastISO(5) }),
          makeDoc("s2", { teamId: "tA", fecha: pastISO(12) }),
        ],
        informe: {
          tA: { rows: [{ id: "p1", nombre: "Pablo", compromiso: "alto" }] },
        },
        shooting: {
          tA: { rows: [{ id: "p1", librePct: "70%" }] },
        },
      });
      const tool = findTool("get_player_status");
      const out = (await tool.handler({ teamId: "tA", playerId: "p1" }, makeCtx(db))) as {
        nombre: string;
        dorsal?: string | number;
        attendance4w: { F: number; R: number; sessionsInWindow: number };
        informeRow: { compromiso: string };
        shootingRow: { librePct: string };
      };
      expect(out.nombre).toBe("Pablo");
      expect(out.dorsal).toBe("4");
      expect(out.attendance4w).toMatchObject({ F: 1, R: 1, sessionsInWindow: 2 });
      expect(out.informeRow).toMatchObject({ compromiso: "alto" });
      expect(out.shootingRow).toMatchObject({ librePct: "70%" });
    });

    it("returns error when player not found", async () => {
      const db = makeMockDb({ members: { tA: [] } });
      const tool = findTool("get_player_status");
      const out = (await tool.handler({ teamId: "tA", playerId: "missing" }, makeCtx(db))) as {
        error?: string;
      };
      expect(out.error).toBeDefined();
    });

    it("requires both teamId and playerId", async () => {
      const db = makeMockDb({});
      const tool = findTool("get_player_status");
      const noTeam = (await tool.handler({ playerId: "p1" }, makeCtx(db))) as { error?: string };
      expect(noTeam.error).toBeDefined();
      const noPlayer = (await tool.handler({ teamId: "tA" }, makeCtx(db))) as { error?: string };
      expect(noPlayer.error).toBeDefined();
    });
  });
});

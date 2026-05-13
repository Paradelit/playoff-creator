import { describe, expect, it } from "vitest";
import { buildPendingAnalysesAndScoutings } from "../../digest/pendingAnalysesScoutings";

/**
 * Tests focales del builder de pending analyses + scoutings. Verifica:
 * - lee scoutings + analisis collections para construir Sets de IDs
 * - cruza con partidos futuros (14d) y pasados (21d)
 * - filtra por scopedTeamIds cuando aplica
 * - orden: pendingScoutings asc, pendingAnalyses desc
 */

interface DocStub {
  id: string;
  data: Record<string, unknown>;
}

function makeDb(opts: {
  scoutingIds?: string[];
  analysisIds?: string[];
  futurePartidos?: DocStub[];
  pastPartidos?: DocStub[];
}) {
  const scoutings = (opts.scoutingIds || []).map((id) => ({ id, data: () => ({}) }));
  const analyses = (opts.analysisIds || []).map((id) => ({ id, data: () => ({}) }));
  const future = (opts.futurePartidos || []).map((d) => ({ id: d.id, data: () => d.data }));
  const past = (opts.pastPartidos || []).map((d) => ({ id: d.id, data: () => d.data }));

  let whereCount = 0;
  const query = {
    where: () => {
      whereCount += 1;
      return query;
    },
    orderBy: () => query,
    get: async () => {
      // El orden de invocaciones determina si es futuro o pasado:
      // future: where("fecha", ">=", today).where("fecha", "<=", lookahead).where("tipo", "==", "partido")
      // past:   where("fecha", ">=", lookback).where("fecha", "<", today).where("tipo", "==", "partido")
      // whereCount termina en 3 para ambos, así que necesitamos otro marcador.
      // Trick: en cada query nuevo, whereCount empieza desde 0 — no, query es shared.
      // Mejor: usamos un contador separado por query.
      return { docs: [] };
    },
  };
  void whereCount;

  // Más simple: stub que devuelve la lista correcta según una flag externa.
  let nextQueryReturns: "future" | "past" = "future";
  const futureQuery = {
    where: () => futureQuery,
    orderBy: () => futureQuery,
    get: async () => ({ docs: future }),
  };
  const pastQuery = {
    where: () => pastQuery,
    orderBy: () => pastQuery,
    get: async () => ({ docs: past }),
  };

  return {
    collection: (root: string) => {
      // root = "artifacts"
      void root;
      return {
        doc: () => ({
          collection: () => ({
            doc: () => ({
              collection: (name: string) => {
                if (name === "scoutings") return { get: async () => ({ docs: scoutings }) };
                if (name === "analisis") return { get: async () => ({ docs: analyses }) };
                if (name === "calendarSessions") {
                  // Alternar futuro/pasado en llamadas sucesivas
                  const isFuture = nextQueryReturns === "future";
                  nextQueryReturns = isFuture ? "past" : "future";
                  return isFuture ? futureQuery : pastQuery;
                }
                return { get: async () => ({ docs: [] }) };
              },
            }),
          }),
        }),
      };
    },
  };
}

const TODAY = "2026-05-13";

describe("buildPendingAnalysesAndScoutings", () => {
  it("flags partido futuro sin scouting doc", async () => {
    const db = makeDb({
      scoutingIds: [], // ninguno tiene scouting
      analysisIds: [],
      futurePartidos: [
        { id: "s1", data: { fecha: "2026-05-15", teamId: "tA", rival: "Hispano" } },
      ],
      pastPartidos: [],
    });
    const result = await buildPendingAnalysesAndScoutings({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      todayISO: TODAY,
      teamsById: new Map([["tA", "Cadete A"]]),
      scopedTeamIds: null,
    });
    expect(result.pendingScoutings).toHaveLength(1);
    expect(result.pendingScoutings[0].sessionId).toBe("s1");
    expect(result.pendingScoutings[0].teamName).toBe("Cadete A");
    expect(result.pendingScoutings[0].rival).toBe("Hispano");
  });

  it("excluye partido futuro con scouting doc existente", async () => {
    const db = makeDb({
      scoutingIds: ["s1"], // s1 tiene scouting
      futurePartidos: [{ id: "s1", data: { fecha: "2026-05-15", teamId: "tA" } }],
    });
    const result = await buildPendingAnalysesAndScoutings({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      todayISO: TODAY,
      teamsById: new Map(),
      scopedTeamIds: null,
    });
    expect(result.pendingScoutings).toHaveLength(0);
  });

  it("flags partido pasado sin analysis doc", async () => {
    const db = makeDb({
      analysisIds: [],
      pastPartidos: [
        { id: "s2", data: { fecha: "2026-05-10", teamId: "tA", rival: "Olímpico" } },
      ],
    });
    const result = await buildPendingAnalysesAndScoutings({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      todayISO: TODAY,
      teamsById: new Map([["tA", "Cadete A"]]),
      scopedTeamIds: null,
    });
    expect(result.pendingAnalyses).toHaveLength(1);
    expect(result.pendingAnalyses[0].sessionId).toBe("s2");
    expect(result.pendingAnalyses[0].rival).toBe("Olímpico");
  });

  it("excluye partido pasado con analysis doc existente", async () => {
    const db = makeDb({
      analysisIds: ["s2"],
      pastPartidos: [{ id: "s2", data: { fecha: "2026-05-10", teamId: "tA" } }],
    });
    const result = await buildPendingAnalysesAndScoutings({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      todayISO: TODAY,
      teamsById: new Map(),
      scopedTeamIds: null,
    });
    expect(result.pendingAnalyses).toHaveLength(0);
  });

  it("filtra por scopedTeamIds (asistente solo ve sus teams)", async () => {
    const db = makeDb({
      futurePartidos: [
        { id: "s1", data: { fecha: "2026-05-15", teamId: "tA" } },
        { id: "s2", data: { fecha: "2026-05-16", teamId: "tB" } },
      ],
    });
    const result = await buildPendingAnalysesAndScoutings({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      todayISO: TODAY,
      teamsById: new Map(),
      scopedTeamIds: new Set(["tA"]),
    });
    expect(result.pendingScoutings).toHaveLength(1);
    expect(result.pendingScoutings[0].sessionId).toBe("s1");
  });

  it("ordena pendingScoutings asc (próximas primero)", async () => {
    const db = makeDb({
      futurePartidos: [
        { id: "s-far", data: { fecha: "2026-05-20", teamId: "tA" } },
        { id: "s-near", data: { fecha: "2026-05-14", teamId: "tA" } },
      ],
    });
    const result = await buildPendingAnalysesAndScoutings({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      todayISO: TODAY,
      teamsById: new Map(),
      scopedTeamIds: null,
    });
    expect(result.pendingScoutings.map((p) => p.sessionId)).toEqual(["s-near", "s-far"]);
  });

  it("ordena pendingAnalyses desc (más recientes primero)", async () => {
    const db = makeDb({
      pastPartidos: [
        { id: "s-old", data: { fecha: "2026-05-01", teamId: "tA" } },
        { id: "s-recent", data: { fecha: "2026-05-10", teamId: "tA" } },
      ],
    });
    const result = await buildPendingAnalysesAndScoutings({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      appId: "a",
      wsId: "w",
      todayISO: TODAY,
      teamsById: new Map(),
      scopedTeamIds: null,
    });
    expect(result.pendingAnalyses.map((p) => p.sessionId)).toEqual(["s-recent", "s-old"]);
  });
});

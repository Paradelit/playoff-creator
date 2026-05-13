import type { Firestore } from "firebase-admin/firestore";

/**
 * Pending player reports on-demand (sub-A.4a #3).
 *
 * Modelo de datos:
 * - `teams/{teamId}/cuaderno/informe-jugadores` es UN doc por team con
 *   shape `{ rows: [{ id, nombre, compromiso, actitud, ... }, ...] }`.
 *   El frontend actualiza ese doc cuando el coach edita el informe.
 * - No hay concepto de "informe del trimestre X" persistido — es un doc
 *   continuo. Por tanto "pending" = jugadores del team que NO tienen
 *   row en el informe (o cuya row no tiene ningún campo de texto
 *   relevante completado).
 *
 * Esto evita falsos negativos cuando el coach añade un jugador nuevo y
 * el informe del team no se ha actualizado.
 */

export interface PendingPlayerReportsByTeam {
  teamId: string;
  teamName?: string;
  missingForPlayerCount: number;
  missingPlayerNames: string[]; // top 10 por orden alfabético
}

const NAMES_PREVIEW_LIMIT = 10;

const INFORME_TEXT_FIELDS = [
  "compromiso",
  "actitud",
  "aptitudes",
  "capAprender",
  "calidad",
  "tiro",
];

function hasInformeContent(row: Record<string, unknown>): boolean {
  return INFORME_TEXT_FIELDS.some((field) => {
    const v = row[field];
    return typeof v === "string" && v.trim().length > 0;
  });
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}

export async function buildPendingPlayerReports(deps: {
  db: Firestore;
  appId: string;
  wsId: string;
  teamsById: Map<string, string>; // teamId → display name
  scopedTeamIds: Set<string> | null;
}): Promise<PendingPlayerReportsByTeam[]> {
  const base = deps.db.collection("artifacts").doc(deps.appId).collection("workspaces").doc(deps.wsId);
  const result: PendingPlayerReportsByTeam[] = [];

  // Solo procesamos los teams del scope (o todos si scope=null).
  const teamIds =
    deps.scopedTeamIds === null
      ? Array.from(deps.teamsById.keys())
      : Array.from(deps.scopedTeamIds);

  if (teamIds.length === 0) return [];

  // Para cada team, leemos members + informe en paralelo.
  await Promise.all(
    teamIds.map(async (teamId) => {
      const teamRef = base.collection("teams").doc(teamId);
      const [membersSnap, informeSnap] = await Promise.all([
        teamRef.collection("members").get(),
        teamRef.collection("cuaderno").doc("informe-jugadores").get(),
      ]);

      const jugadores = membersSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
        .filter((m) => ((m as { tipo?: string }).tipo || "jugador") === "jugador");

      if (jugadores.length === 0) return;

      const informeData = informeSnap.exists ? informeSnap.data() || {} : {};
      const rows = Array.isArray(informeData.rows)
        ? (informeData.rows as Array<Record<string, unknown>>)
        : [];

      // Index rows por id + por nombre normalizado.
      const rowsById = new Map<string, Record<string, unknown>>();
      const rowsByName = new Map<string, Record<string, unknown>>();
      for (const row of rows) {
        if (typeof row.id === "string") rowsById.set(row.id, row);
        if (typeof row.nombre === "string") rowsByName.set(normalizeName(row.nombre), row);
      }

      const missing: string[] = [];
      for (const j of jugadores) {
        const nombre = (j as { nombre?: string }).nombre || "(sin nombre)";
        const row =
          rowsById.get(j.id) ||
          (typeof nombre === "string" ? rowsByName.get(normalizeName(nombre)) : undefined);
        if (!row) {
          missing.push(nombre);
          continue;
        }
        if (!hasInformeContent(row)) {
          missing.push(nombre);
        }
      }

      if (missing.length > 0) {
        missing.sort((a, b) => a.localeCompare(b));
        result.push({
          teamId,
          teamName: deps.teamsById.get(teamId),
          missingForPlayerCount: missing.length,
          missingPlayerNames: missing.slice(0, NAMES_PREVIEW_LIMIT),
        });
      }
    })
  );

  // Orden: teams con más pending primero (más atención del coach).
  result.sort((a, b) => b.missingForPlayerCount - a.missingForPlayerCount);
  return result;
}

import type { Firestore } from "firebase-admin/firestore";

/**
 * Pending analyses + scoutings on-demand (sub-A.4a follow-up).
 *
 * Modelo de datos:
 * - Scouting docs: `workspaces/{wsId}/scoutings/{sessionId}` (1 doc por sesión).
 * - Analysis docs: `workspaces/{wsId}/analisis/{sessionId}` (sí, "analisis"
 *   sin acento y sin pluralización extra — es lo que escribe el frontend
 *   en `src/services/analysisService.js`).
 *
 * Estrategia: leer los IDs (no los docs completos) de ambas colecciones +
 * los partidos en las ventanas relevantes. Marcar pending lo que no tiene
 * doc correspondiente.
 *
 * Ventanas:
 * - Pending scouting: partidos próximos en 14 días (más amplio que la
 *   ventana de convocatorias porque preparas scouting con más antelación).
 * - Pending analysis: partidos jugados en los últimos 21 días.
 */

export interface PendingMatchAction {
  sessionId: string;
  fecha: string;
  teamId?: string;
  teamName?: string;
  rival?: string;
}

const SCOUTING_LOOKAHEAD_DAYS = 14;
const ANALYSIS_LOOKBACK_DAYS = 21;

function isoOffset(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function buildPendingAnalysesAndScoutings(deps: {
  db: Firestore;
  appId: string;
  wsId: string;
  todayISO: string;
  teamsById: Map<string, string>;
  /** Filtro role-aware (sub-A.3). null = no filtro. */
  scopedTeamIds: Set<string> | null;
}): Promise<{
  pendingScoutings: PendingMatchAction[];
  pendingAnalyses: PendingMatchAction[];
}> {
  const base = deps.db.collection("artifacts").doc(deps.appId).collection("workspaces").doc(deps.wsId);
  const lookaheadISO = isoOffset(deps.todayISO, SCOUTING_LOOKAHEAD_DAYS);
  const lookbackISO = isoOffset(deps.todayISO, -ANALYSIS_LOOKBACK_DAYS);

  // 4 reads en paralelo: scouting IDs, analysis IDs, partidos futuros 14d,
  // partidos pasados 21d. Las primeras dos son select() en docs ID-only
  // si Firestore Admin lo soportara con .listDocuments(), pero un .get()
  // sobre la collection devuelve todos los docs. Para colecciones de
  // tamaño moderado (≤100 docs cada una) es aceptable.
  const [scoutingsSnap, analysesSnap, futureSnap, pastSnap] = await Promise.all([
    base.collection("scoutings").get(),
    base.collection("analisis").get(),
    base
      .collection("calendarSessions")
      .where("fecha", ">=", deps.todayISO)
      .where("fecha", "<=", lookaheadISO)
      .where("tipo", "==", "partido")
      .get(),
    base
      .collection("calendarSessions")
      .where("fecha", ">=", lookbackISO)
      .where("fecha", "<", deps.todayISO)
      .where("tipo", "==", "partido")
      .get(),
  ]);

  const scoutingIds = new Set(scoutingsSnap.docs.map((d) => d.id));
  const analysisIds = new Set(analysesSnap.docs.map((d) => d.id));

  function passesScope(teamId: string | undefined): boolean {
    if (!deps.scopedTeamIds) return true;
    return Boolean(teamId && deps.scopedTeamIds.has(teamId));
  }

  function toPending(d: FirebaseFirestore.QueryDocumentSnapshot): PendingMatchAction {
    const data = d.data();
    const teamId = data.teamId as string | undefined;
    return {
      sessionId: d.id,
      fecha: (data.fecha as string) || "",
      teamId,
      teamName: teamId ? deps.teamsById.get(teamId) : undefined,
      rival: (data.rival as string) || undefined,
    };
  }

  const pendingScoutings: PendingMatchAction[] = futureSnap.docs
    .filter((d) => !scoutingIds.has(d.id))
    .filter((d) => passesScope(d.data().teamId as string | undefined))
    .map(toPending)
    .sort((a, b) => a.fecha.localeCompare(b.fecha)); // próximas primero

  const pendingAnalyses: PendingMatchAction[] = pastSnap.docs
    .filter((d) => !analysisIds.has(d.id))
    .filter((d) => passesScope(d.data().teamId as string | undefined))
    .map(toPending)
    .sort((a, b) => b.fecha.localeCompare(a.fecha)); // más recientes primero

  return { pendingScoutings, pendingAnalyses };
}

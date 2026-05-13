import type { Firestore } from "firebase-admin/firestore";
import type { DigestSession, MatchResult } from "./types";

const UPCOMING_DAYS = 7;
const PAST_DAYS = 7;
const UPCOMING_CAP = 15;
const PAST_CAP = 15;

function isoOffset(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Lee `calendarSessions` con ventana [todayISO, todayISO+7d], ordenada
 * asc por fecha, capada a 15 entries. Si `scopedTeamIds` está presente,
 * filtra los docs cuyo `teamId` no esté en el set ANTES de capar a 15.
 * Sessions sin teamId se incluyen sólo si `scopedTeamIds` es null.
 *
 * Returns `SessionWithTeamId` (DigestSession + opcional teamId) para que
 * el orquestador pueda agrupar por team sin re-leer los docs.
 */
export async function buildUpcomingSessionsDigest(deps: {
  db: Firestore;
  appId: string;
  wsId: string;
  todayISO: string;
  teamsById: Map<string, string>;
  scopedTeamIds?: Set<string> | null;
}): Promise<SessionWithTeamId[]> {
  const base = deps.db.collection("artifacts").doc(deps.appId).collection("workspaces").doc(deps.wsId);
  const toISO = isoOffset(deps.todayISO, UPCOMING_DAYS);

  const sessionsSnap = await base
    .collection("calendarSessions")
    .where("fecha", ">=", deps.todayISO)
    .where("fecha", "<=", toISO)
    .orderBy("fecha", "asc")
    .get();

  const filtered = sessionsSnap.docs.filter((d) => {
    if (!deps.scopedTeamIds) return true;
    const tid = d.data().teamId as string | undefined;
    return Boolean(tid && deps.scopedTeamIds.has(tid));
  });

  return filtered.slice(0, UPCOMING_CAP).map((d) => {
    const data = d.data();
    return {
      id: d.id,
      fecha: (data.fecha as string) || "",
      horaInicio: (data.horaInicio as string) || undefined,
      tipo: (data.tipo as string) || undefined,
      teamName: data.teamId ? deps.teamsById.get(data.teamId as string) : undefined,
      rival: (data.rival as string) || undefined,
      lugar: (data.lugar as string) || undefined,
      teamId: (data.teamId as string | undefined) || undefined,
      // Bandera de pendingConvocatorias (sub-A.4a). El orquestador del
      // digest la usa para computar pendientes sin re-leer Firestore.
      // Propagada pero NO renderizada — vive en SessionWithTeamId, no
      // en DigestSession.
      convocatoriaSentAt: data.convocatoriaSentAt,
    };
  });
}

/**
 * Parsea `session.resultado = { local, visitante }` (strings o numbers, según
 * cómo lo escribe el frontend en `CalendarHelpers.QuickResultado`) y lo
 * normaliza al punto de vista del coach usando `esLocal`. Devuelve null si
 * falta alguno de los dos scores o si `esLocal` no está definido.
 */
function parseSessionResult(data: Record<string, unknown>): MatchResult | null {
  const resultado = data.resultado as { local?: unknown; visitante?: unknown } | undefined;
  if (!resultado) return null;
  const local = Number(resultado.local);
  const visitante = Number(resultado.visitante);
  if (!Number.isFinite(local) || !Number.isFinite(visitante)) return null;
  const esLocal = data.esLocal as boolean | undefined;
  if (esLocal === undefined) return null;
  return {
    ourScore: esLocal ? local : visitante,
    theirScore: esLocal ? visitante : local,
  };
}

/**
 * Lee `calendarSessions` con ventana [todayISO-7d, todayISO), ordenada
 * desc por fecha, capada a 15 entries. Incluye `result` normalizado al
 * coach cuando el frontend ya capturó `resultado` + `esLocal`.
 *
 * Si la ventana de 7d devuelve <3 sesiones, no se amplía automáticamente
 * en esta fase — el spec proponía 14d como fallback pero lo dejamos para
 * follow-up tras observar uso (YAGNI).
 */
export async function buildRecentPastSessionsDigest(deps: {
  db: Firestore;
  appId: string;
  wsId: string;
  todayISO: string;
  teamsById: Map<string, string>;
  scopedTeamIds?: Set<string> | null;
}): Promise<SessionWithTeamId[]> {
  const base = deps.db.collection("artifacts").doc(deps.appId).collection("workspaces").doc(deps.wsId);
  const fromISO = isoOffset(deps.todayISO, -PAST_DAYS);

  const sessionsSnap = await base
    .collection("calendarSessions")
    .where("fecha", ">=", fromISO)
    .where("fecha", "<", deps.todayISO)
    .orderBy("fecha", "desc")
    .get();

  const filtered = sessionsSnap.docs.filter((d) => {
    if (!deps.scopedTeamIds) return true;
    const tid = d.data().teamId as string | undefined;
    return Boolean(tid && deps.scopedTeamIds.has(tid));
  });

  return filtered.slice(0, PAST_CAP).map((d) => {
    const data = d.data();
    const result = parseSessionResult(data);
    return {
      id: d.id,
      fecha: (data.fecha as string) || "",
      horaInicio: (data.horaInicio as string) || undefined,
      tipo: (data.tipo as string) || undefined,
      teamName: data.teamId ? deps.teamsById.get(data.teamId as string) : undefined,
      rival: (data.rival as string) || undefined,
      lugar: (data.lugar as string) || undefined,
      teamId: (data.teamId as string | undefined) || undefined,
      ...(result ? { result } : {}),
    };
  });
}

// Re-export the `teamId` from the raw doc so the orchestrator can group
// by team without a second pass over the docs. Used by `buildUserDigest`
// to compose the `upcomingSessionsByTeam` / `recentPastSessionsByTeam`
// maps that feed `buildTeamsDigest`.
export type SessionWithTeamId<T extends DigestSession = DigestSession> = T & {
  teamId?: string;
  /** Sub-A.4a: presente en upcomingSessions raw para computar pending
   *  convocatorias. NO viaja al digest renderizado. */
  convocatoriaSentAt?: unknown;
};

export function groupSessionsByTeamId(sessions: SessionWithTeamId[]): Map<string, DigestSession[]> {
  const map = new Map<string, DigestSession[]>();
  for (const s of sessions) {
    if (!s.teamId) continue;
    const list = map.get(s.teamId) || [];
    list.push(s);
    map.set(s.teamId, list);
  }
  return map;
}

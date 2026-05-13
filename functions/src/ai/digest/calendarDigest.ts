import type { Firestore } from "firebase-admin/firestore";
import type { DigestSession } from "./types";

/**
 * Lee `calendarSessions` con ventana [todayISO, todayISO+7d], ordenada
 * asc por fecha, capada a 15 entries (matches behavior pre sub-A.1).
 * El join con teamName se hace en el orquestador (userDigest.ts) para
 * evitar pasar el map de teams aquí — cada builder es independiente.
 */
export async function buildUpcomingSessionsDigest(deps: {
  db: Firestore;
  appId: string;
  wsId: string;
  todayISO: string;
  teamsById: Map<string, string>;
}): Promise<DigestSession[]> {
  const base = deps.db.collection("artifacts").doc(deps.appId).collection("workspaces").doc(deps.wsId);
  const sevenDaysFromNow = new Date(deps.todayISO);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const toISO = sevenDaysFromNow.toISOString().slice(0, 10);

  const sessionsSnap = await base
    .collection("calendarSessions")
    .where("fecha", ">=", deps.todayISO)
    .where("fecha", "<=", toISO)
    .orderBy("fecha", "asc")
    .get();

  return sessionsSnap.docs.slice(0, 15).map((d) => {
    const data = d.data();
    return {
      id: d.id,
      fecha: (data.fecha as string) || "",
      horaInicio: (data.horaInicio as string) || undefined,
      tipo: (data.tipo as string) || undefined,
      teamName: data.teamId ? deps.teamsById.get(data.teamId as string) : undefined,
      rival: (data.rival as string) || undefined,
      lugar: (data.lugar as string) || undefined,
    };
  });
}

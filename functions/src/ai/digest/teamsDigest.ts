import type { Firestore } from "firebase-admin/firestore";
import { formatTeamDisplayName } from "../../shared/teamDomain";
import type { DigestSession, DigestTeam, RosterPlayer } from "./types";

const ROSTER_SNAPSHOT_LIMIT = 12;

/**
 * Sort key for rosterSnapshot: dorsal asc, treating missing/non-numeric as
 * "last". Pure helper to keep ordering deterministic and testable.
 */
function dorsalSortKey(d?: string): number {
  if (!d) return Number.MAX_SAFE_INTEGER;
  const n = parseInt(d, 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

/**
 * Lee la colección `teams` del workspace + members de cada team. Computa:
 * - memberCount (incluyendo staff)
 * - rosterSnapshot: hasta 12 jugadores (excluye staff), ordenados por dorsal
 * - nextSession (si `upcomingSessionsByTeam` la incluye)
 * - lastResult (si `recentPastSessionsByTeam` tiene un partido con `result`)
 */
export async function buildTeamsDigest(deps: {
  db: Firestore;
  appId: string;
  wsId: string;
  /** Map teamId → próximas sesiones (orden asc). Si omitido, no se enriquece. */
  upcomingSessionsByTeam?: Map<string, DigestSession[]>;
  /** Map teamId → sesiones pasadas recientes (orden desc, ya con `result`
   *  cuando aplica). Si omitido, no se enriquece. */
  recentPastSessionsByTeam?: Map<string, DigestSession[]>;
  /** Si está presente, sólo computa teams cuyo id ∈ scopedTeamIds. Si es
   *  null, devuelve todos los teams del workspace. */
  scopedTeamIds?: Set<string> | null;
}): Promise<DigestTeam[]> {
  const base = deps.db.collection("artifacts").doc(deps.appId).collection("workspaces").doc(deps.wsId);
  const teamsSnap = await base.collection("teams").get();
  const scopedDocs = deps.scopedTeamIds
    ? teamsSnap.docs.filter((d) => deps.scopedTeamIds!.has(d.id))
    : teamsSnap.docs;

  return Promise.all(
    scopedDocs.map(async (d) => {
      const data = d.data();
      // Una sola lectura de members — `.get()` nos da memberCount + roster.
      // Para teams con ≤30 miembros (caso típico) cuesta lo mismo que .count()
      // separado, y nos evita un round-trip.
      const memSnap = await d.ref.collection("members").get();
      const memberCount = memSnap.docs.length;

      const players: RosterPlayer[] = memSnap.docs
        .map((m) => ({
          id: m.id,
          tipo: (m.data().tipo as string | undefined) || "jugador",
          nombre: (m.data().nombre as string | undefined) || "",
          dorsal: (m.data().dorsal as string | undefined) || undefined,
          posicion: (m.data().posicion as string | undefined) || undefined,
        }))
        .filter((m) => m.tipo === "jugador")
        .sort((a, b) => dorsalSortKey(a.dorsal) - dorsalSortKey(b.dorsal))
        .slice(0, ROSTER_SNAPSHOT_LIMIT)
        .map(({ id, nombre, dorsal, posicion }) => ({ id, nombre, dorsal, posicion }));

      const team: DigestTeam = {
        id: d.id,
        name:
          formatTeamDisplayName({
            teamName: (data.teamName as string | undefined) || null,
            categoria: (data.categoria as string | undefined) || null,
            "año": (data["año"] as string | undefined) || null,
            letra: (data.letra as string | undefined) || null,
            genero: (data.genero as string | undefined) || null,
            division: (data.division as string | undefined) || null,
          }) || "(sin nombre)",
        categoria: data.categoria as string | undefined,
        nivel: data.nivel as string | undefined,
        memberCount,
        ...(players.length > 0 ? { rosterSnapshot: players } : {}),
      };

      const next = deps.upcomingSessionsByTeam?.get(d.id)?.[0];
      if (next) {
        team.nextSession = {
          id: next.id,
          fecha: next.fecha,
          tipo: next.tipo,
          rival: next.rival,
        };
      }

      const lastWithResult = deps.recentPastSessionsByTeam?.get(d.id)?.find((s) => s.result);
      if (lastWithResult?.result) {
        team.lastResult = {
          fecha: lastWithResult.fecha,
          rival: lastWithResult.rival,
          ourScore: lastWithResult.result.ourScore,
          theirScore: lastWithResult.result.theirScore,
        };
      }

      return team;
    })
  );
}

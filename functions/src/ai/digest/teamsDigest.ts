import type { Firestore } from "firebase-admin/firestore";
import { formatTeamDisplayName } from "../../shared/teamDomain";
import type { DigestTeam } from "./types";

/**
 * Lee la colección `teams` del workspace + el count de `members` de cada
 * team. Equivalente funcional al bloque inline que vivía en userDigest.ts
 * antes de sub-A.1 — sin enriquecimientos todavía (esos llegan en A.2).
 */
export async function buildTeamsDigest(deps: {
  db: Firestore;
  appId: string;
  wsId: string;
}): Promise<DigestTeam[]> {
  const base = deps.db.collection("artifacts").doc(deps.appId).collection("workspaces").doc(deps.wsId);
  const teamsSnap = await base.collection("teams").get();
  return Promise.all(
    teamsSnap.docs.map(async (d) => {
      const memSnap = await d.ref.collection("members").count().get();
      const data = d.data();
      return {
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
        memberCount: memSnap.data().count,
      };
    })
  );
}

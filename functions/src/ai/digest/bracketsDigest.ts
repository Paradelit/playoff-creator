import type { Firestore } from "firebase-admin/firestore";
import type { DigestBracket } from "./types";

/**
 * Lee la colección `brackets` del workspace y devuelve {id, name, teamId} de
 * cada uno. Equivalente funcional al bloque inline que vivía en userDigest.ts
 * antes de sub-A.1.
 */
export async function buildBracketsDigest(deps: {
  db: Firestore;
  appId: string;
  wsId: string;
  /** Si está presente, sólo incluye brackets cuyo `teamId` esté en el set
   *  (brackets sin teamId se excluyen para no leak via lista global). Si
   *  null, devuelve todos. */
  scopedTeamIds?: Set<string> | null;
}): Promise<DigestBracket[]> {
  const base = deps.db.collection("artifacts").doc(deps.appId).collection("workspaces").doc(deps.wsId);
  const bracketsSnap = await base.collection("brackets").get();
  return bracketsSnap.docs
    .filter((d) => {
      if (!deps.scopedTeamIds) return true;
      const tid = d.data().teamId as string | undefined;
      return Boolean(tid && deps.scopedTeamIds.has(tid));
    })
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: (data.name as string) || (data.tournamentName as string) || "Playoff",
        teamId: (data.teamId as string | undefined) || null,
      };
    });
}

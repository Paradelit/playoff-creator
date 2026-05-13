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
}): Promise<DigestBracket[]> {
  const base = deps.db.collection("artifacts").doc(deps.appId).collection("workspaces").doc(deps.wsId);
  const bracketsSnap = await base.collection("brackets").get();
  return bracketsSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: (data.name as string) || (data.tournamentName as string) || "Playoff",
      teamId: (data.teamId as string | undefined) || null,
    };
  });
}

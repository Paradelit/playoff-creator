import type { Firestore } from "firebase-admin/firestore";
import { deriveBracketState, type BracketMatch } from "./bracketState";
import type { DigestBracket } from "./types";

/**
 * Lee la colección `brackets` del workspace y devuelve {id, name, teamId,
 * currentRound, nextMatch, pendingScores} de cada uno.
 *
 * Sub-A.2 follow-up: enriquecimientos del bracket (currentRound,
 * nextMatch, pendingScores) que estaban diferidos en #38 porque
 * requerían un walk del state tree. Ahora extraídos via
 * `deriveBracketState` (puro, testable).
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
      // bracketData.state suele vivir embebido. Algunos brackets legacy
      // lo tienen bajo `bracketData`, otros directamente. Soportamos ambos.
      const stateContainer =
        (data.bracketData as { state?: Record<string, unknown>; rootId?: string } | undefined) || data;
      const derived = deriveBracketState({
        state: stateContainer.state as Record<string, BracketMatch> | undefined,
        rootId: stateContainer.rootId as string | undefined,
      });
      return {
        id: d.id,
        name: (data.name as string) || (data.tournamentName as string) || "Playoff",
        teamId: (data.teamId as string | undefined) || null,
        ...(derived.currentRound ? { currentRound: derived.currentRound } : {}),
        ...(derived.nextMatch ? { nextMatch: derived.nextMatch } : {}),
        ...(derived.pendingScores !== undefined ? { pendingScores: derived.pendingScores } : {}),
      };
    });
}

// functions/src/common/assertWorkspaceMembership.ts
import { HttpsError } from "firebase-functions/v2/https";
import type { Firestore } from "firebase-admin/firestore";

export interface WorkspaceMembershipContext {
  ownerId: string;
  workspaceType: "personal" | "club" | undefined;
  role: "owner" | "dt" | "coach" | undefined;
  assignedTeamIds: string[];
  isOwner: boolean;
  isDT: boolean;
}

/**
 * Verifica que `uid` es miembro del workspace `(appId, wsId)` y devuelve su
 * contexto de role + scoping. Lanza HttpsError si:
 *   - el workspace no existe (`not-found`)
 *   - el caller no es miembro (`permission-denied`)
 *
 * Pre sub-7 security batch, varias callables aceptaban wsId directamente
 * del cliente sin verificar membership server-side. Este helper centraliza el
 * patrón que aiChat ya hacía a mano y lo aplica al resto (cleanupUserData,
 * runAgent, etc.) — defensa en profundidad además de las firestore.rules.
 *
 * Diseñado para ser barato: 2 reads (workspace + member). Las callables que ya
 * leen el workspace pueden saltarse este helper y verificar en línea.
 */
export async function assertWorkspaceMembership(
  db: Firestore,
  appId: string,
  wsId: string,
  uid: string,
): Promise<WorkspaceMembershipContext> {
  const wsRef = db.doc(`artifacts/${appId}/workspaces/${wsId}`);
  const wsSnap = await wsRef.get();
  if (!wsSnap.exists) {
    throw new HttpsError("not-found", `workspace not found: ${wsId}`);
  }
  const ws = (wsSnap.data() || {}) as {
    ownerId?: string;
    type?: "personal" | "club";
  };

  const memberRef = db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${uid}`);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) {
    throw new HttpsError("permission-denied", "Not a member of this workspace");
  }
  const member = (memberSnap.data() || {}) as {
    role?: "owner" | "dt" | "coach";
    assignedTeamIds?: string[];
  };

  const isOwner = ws.ownerId === uid;
  // En personal workspaces el role del owner está como "owner"; en clubs como
  // "dt". Tratamos ambos como nivel DT para autorización de operaciones admin.
  const isDT = member.role === "dt" || member.role === "owner";

  return {
    ownerId: ws.ownerId ?? "",
    workspaceType: ws.type,
    role: member.role,
    assignedTeamIds: member.assignedTeamIds ?? [],
    isOwner,
    isDT,
  };
}

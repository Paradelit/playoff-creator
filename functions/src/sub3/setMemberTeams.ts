import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

interface HandlerArgs {
  db: Firestore; appId: string; auth: { uid: string };
  data: { wsId: string; memberUid: string; assignedTeamIds: string[] };
}

export async function handleSetMemberTeams({ db, appId, auth, data }: HandlerArgs) {
  const { wsId, memberUid, assignedTeamIds } = data ?? ({} as HandlerArgs["data"]);
  if (!wsId || !memberUid) throw new HttpsError("invalid-argument", "wsId+memberUid requeridos");
  if (!Array.isArray(assignedTeamIds)) throw new HttpsError("invalid-argument", "assignedTeamIds requerido");

  const wsSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}`).get();
  if (!wsSnap.exists) throw new HttpsError("not-found", "workspace no existe");
  const ownerId = wsSnap.data()!.ownerId;
  const callerIsOwner = ownerId === auth.uid;

  const callerSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${auth.uid}`).get();
  const isDt = callerSnap.exists && callerSnap.data()?.role === "dt";
  if (!callerIsOwner && !isDt) throw new HttpsError("permission-denied", "Solo DT/owner pueden editar equipos.");

  if (!callerIsOwner && memberUid === ownerId) {
    throw new HttpsError("permission-denied", "Solo el propietario puede editar sus propios equipos.");
  }

  for (const teamId of assignedTeamIds) {
    const t = await db.doc(`artifacts/${appId}/workspaces/${wsId}/teams/${teamId}`).get();
    if (!t.exists) throw new HttpsError("invalid-argument", `team ${teamId} no existe`);
  }

  await db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${memberUid}`).update({ assignedTeamIds });
  return { ok: true };
}

export const setMemberTeams = onCall({ region: "europe-west1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const appId = process.env.PICK_APP_ID;
  if (!appId) throw new HttpsError("failed-precondition", "PICK_APP_ID missing");
  return handleSetMemberTeams({
    db: getFirestore(), appId, auth: { uid: request.auth.uid }, data: request.data,
  });
});

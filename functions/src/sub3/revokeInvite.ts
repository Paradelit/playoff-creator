import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

interface HandlerArgs {
  db: Firestore; appId: string; auth: { uid: string };
  data: { wsId: string; inviteId: string };
}

export async function handleRevokeInvite({ db, appId, auth, data }: HandlerArgs) {
  const { wsId, inviteId } = data ?? ({} as HandlerArgs["data"]);
  if (!wsId || !inviteId) throw new HttpsError("invalid-argument", "wsId+inviteId requeridos");

  const wsSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}`).get();
  if (!wsSnap.exists) throw new HttpsError("not-found", "workspace no existe");
  const isOwner = wsSnap.data()!.ownerId === auth.uid;

  const memberSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${auth.uid}`).get();
  const isDt = memberSnap.exists && memberSnap.data()?.role === "dt";

  if (!isOwner && !isDt) throw new HttpsError("permission-denied", "Solo DT/owner pueden revocar.");

  await db.doc(`artifacts/${appId}/workspaces/${wsId}/invites/${inviteId}`).delete();
  return { ok: true };
}

export const revokeInvite = onCall({ region: "europe-west1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const appId = process.env.PICK_APP_ID;
  if (!appId) throw new HttpsError("failed-precondition", "PICK_APP_ID missing");
  return handleRevokeInvite({
    db: getFirestore(), appId, auth: { uid: request.auth.uid }, data: request.data,
  });
});

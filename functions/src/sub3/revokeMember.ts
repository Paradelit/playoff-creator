import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

interface HandlerArgs {
  db: Firestore; appId: string; auth: { uid: string };
  data: { wsId: string; memberUid: string };
}

export async function handleRevokeMember({ db, appId, auth, data }: HandlerArgs) {
  const { wsId, memberUid } = data ?? ({} as HandlerArgs["data"]);
  if (!wsId || !memberUid) throw new HttpsError("invalid-argument", "wsId+memberUid requeridos");

  await db.runTransaction(async (tx) => {
    const wsSnap = await tx.get(db.doc(`artifacts/${appId}/workspaces/${wsId}`));
    if (!wsSnap.exists) throw new HttpsError("not-found", "workspace no existe");
    const ownerId = wsSnap.data()!.ownerId;
    if (memberUid === ownerId) {
      throw new HttpsError("failed-precondition", "No puedes expulsar al propietario. Transfiere la propiedad antes.");
    }

    const callerSnap = await tx.get(db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${auth.uid}`));
    const isOwner = ownerId === auth.uid;
    const isDt = callerSnap.exists && callerSnap.data()?.role === "dt";
    if (!isOwner && !isDt) throw new HttpsError("permission-denied", "Solo DT/owner pueden revocar.");

    tx.delete(db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${memberUid}`));
    tx.delete(db.doc(`artifacts/${appId}/users/${memberUid}/memberships/${wsId}`));
  });

  return { ok: true };
}

export const revokeMember = onCall({ region: "europe-west1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const appId = process.env.PICK_APP_ID;
  if (!appId) throw new HttpsError("failed-precondition", "PICK_APP_ID missing");
  return handleRevokeMember({
    db: getFirestore(), appId, auth: { uid: request.auth.uid }, data: request.data,
  });
});

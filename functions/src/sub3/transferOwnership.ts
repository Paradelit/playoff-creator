import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

interface HandlerArgs {
  db: Firestore; appId: string; auth: { uid: string };
  data: { wsId: string; newOwnerUid: string };
}

export async function handleTransferOwnership({ db, appId, auth, data }: HandlerArgs) {
  const { wsId, newOwnerUid } = data ?? ({} as HandlerArgs["data"]);
  if (!wsId || !newOwnerUid) throw new HttpsError("invalid-argument", "wsId+newOwnerUid requeridos");
  if (newOwnerUid === auth.uid) throw new HttpsError("invalid-argument", "newOwnerUid debe ser distinto del actual.");

  await db.runTransaction(async (tx) => {
    const wsSnap = await tx.get(db.doc(`artifacts/${appId}/workspaces/${wsId}`));
    if (!wsSnap.exists) throw new HttpsError("not-found", "workspace no existe");
    if (wsSnap.data()!.ownerId !== auth.uid) {
      throw new HttpsError("permission-denied", "Solo el propietario actual puede transferir.");
    }

    const newOwnerSnap = await tx.get(db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${newOwnerUid}`));
    if (!newOwnerSnap.exists) {
      throw new HttpsError("failed-precondition", "El nuevo propietario debe ser miembro previo del workspace.");
    }

    tx.update(db.doc(`artifacts/${appId}/workspaces/${wsId}`), { ownerId: newOwnerUid });
    tx.update(db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${newOwnerUid}`), { role: "dt" });
  });

  return { ok: true };
}

export const transferOwnership = onCall({ region: "europe-west1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const appId = process.env.PICK_APP_ID;
  if (!appId) throw new HttpsError("failed-precondition", "PICK_APP_ID missing");
  return handleTransferOwnership({
    db: getFirestore(), appId, auth: { uid: request.auth.uid }, data: request.data,
  });
});

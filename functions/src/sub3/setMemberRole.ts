import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import type { ClubRole } from "./types";

interface HandlerArgs {
  db: Firestore; appId: string; auth: { uid: string };
  data: { wsId: string; memberUid: string; role: ClubRole };
}

export async function handleSetMemberRole({ db, appId, auth, data }: HandlerArgs) {
  const { wsId, memberUid, role } = data ?? ({} as HandlerArgs["data"]);
  if (!wsId || !memberUid) throw new HttpsError("invalid-argument", "wsId+memberUid requeridos");
  if (role !== "dt" && role !== "coach") throw new HttpsError("invalid-argument", "role inválido");

  const wsSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}`).get();
  if (!wsSnap.exists) throw new HttpsError("not-found", "workspace no existe");
  const ownerId = wsSnap.data()!.ownerId;

  if (memberUid === ownerId) {
    throw new HttpsError("failed-precondition", "El propietario es siempre DT. Transfiere la propiedad antes.");
  }

  const callerSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${auth.uid}`).get();
  const isOwner = ownerId === auth.uid;
  const isDt = callerSnap.exists && callerSnap.data()?.role === "dt";
  if (!isOwner && !isDt) throw new HttpsError("permission-denied", "Solo DT/owner pueden cambiar roles.");

  await db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${memberUid}`).update({ role });
  return { ok: true };
}

export const setMemberRole = onCall({ region: "europe-west1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const appId = process.env.PICK_APP_ID;
  if (!appId) throw new HttpsError("failed-precondition", "PICK_APP_ID missing");
  return handleSetMemberRole({
    db: getFirestore(), appId, auth: { uid: request.auth.uid }, data: request.data,
  });
});

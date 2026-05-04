import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { isInClubAllowlist } from "./clubAllowlist";

interface HandlerArgs {
  db: Firestore;
  appId: string;
  auth: { uid: string; displayName: string | null; email: string | null };
  data: { name: string };
}

export async function handleCreateClub({ db, appId, auth, data }: HandlerArgs): Promise<{ wsId: string }> {
  if (!isInClubAllowlist(auth.uid)) {
    throw new HttpsError("permission-denied", "Workspace de club no disponible para esta cuenta.");
  }
  const name = (data?.name ?? "").trim();
  if (!name) throw new HttpsError("invalid-argument", "Nombre obligatorio.");
  if (name.length > 80) throw new HttpsError("invalid-argument", "Nombre máx. 80 caracteres.");

  const newWsId = db.collection(`artifacts/${appId}/workspaces`).doc().id;
  const now = FieldValue.serverTimestamp();
  const displayName = auth.displayName ?? "";
  const email = auth.email ?? "";

  await db.batch()
    .set(db.doc(`artifacts/${appId}/workspaces/${newWsId}`), {
      type: "club", ownerId: auth.uid, name,
      plan: "free", planUpdatedAt: null, billing: null,
      createdAt: now, updatedAt: now,
    })
    .set(db.doc(`artifacts/${appId}/workspaces/${newWsId}/members/${auth.uid}`), {
      role: "dt", assignedTeamIds: [],
      displayName, email,
      joinedAt: now, invitedBy: null,
    })
    .set(db.doc(`artifacts/${appId}/users/${auth.uid}/memberships/${newWsId}`), {
      workspaceType: "club", workspaceName: name, role: "dt", joinedAt: now,
    })
    .commit();

  return { wsId: newWsId };
}

export const createClub = onCall({ region: "europe-west1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const appId = process.env.PICK_APP_ID;
  if (!appId) throw new HttpsError("failed-precondition", "PICK_APP_ID missing");
  return handleCreateClub({
    db: getFirestore(), appId,
    auth: {
      uid: request.auth.uid,
      displayName: (request.auth.token?.name as string) ?? null,
      email: (request.auth.token?.email as string) ?? null,
    },
    data: request.data,
  });
});

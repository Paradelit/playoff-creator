import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { INVITE_LIFETIME_MS, type ClubRole } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface HandlerArgs {
  db: Firestore;
  appId: string;
  auth: { uid: string };
  appBaseUrl: string;
  data: { wsId: string; role: ClubRole; assignedTeamIds: string[]; email?: string|null; name?: string|null };
}

export async function handleInviteMember({ db, appId, auth, appBaseUrl, data }: HandlerArgs) {
  const { wsId, role, assignedTeamIds, email, name } = data ?? ({} as HandlerArgs["data"]);
  if (!wsId) throw new HttpsError("invalid-argument", "wsId requerido");
  if (role !== "dt" && role !== "coach") throw new HttpsError("invalid-argument", "role inválido");
  if (!Array.isArray(assignedTeamIds)) throw new HttpsError("invalid-argument", "assignedTeamIds requerido");
  if (role === "coach" && assignedTeamIds.length === 0) {
    throw new HttpsError("invalid-argument", "Coach requiere al menos un equipo.");
  }
  if (email != null && email !== "" && !EMAIL_RE.test(email)) {
    throw new HttpsError("invalid-argument", "Email mal formado.");
  }

  const wsSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}`).get();
  if (!wsSnap.exists) throw new HttpsError("not-found", "workspace no existe");
  const ws = wsSnap.data()!;

  const memberSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${auth.uid}`).get();
  const isOwner = ws.ownerId === auth.uid;
  const isDt = memberSnap.exists && memberSnap.data()?.role === "dt";
  if (!isOwner && !isDt) throw new HttpsError("permission-denied", "Solo DT/owner pueden invitar.");

  for (const teamId of assignedTeamIds) {
    const t = await db.doc(`artifacts/${appId}/workspaces/${wsId}/teams/${teamId}`).get();
    if (!t.exists) throw new HttpsError("invalid-argument", `team ${teamId} no existe`);
  }

  const inviteRef = db.collection(`artifacts/${appId}/workspaces/${wsId}/invites`).doc();
  const inviteId = inviteRef.id;
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + INVITE_LIFETIME_MS);

  await db.doc(`artifacts/${appId}/workspaces/${wsId}/invites/${inviteId}`).set({
    inviteId, workspaceId: wsId,
    invitedBy: auth.uid,
    inviteEmail: email ?? null, inviteName: name ?? null,
    role, assignedTeamIds,
    createdAt: FieldValue.serverTimestamp(), expiresAt,
  });

  return { inviteId, link: `${appBaseUrl}/invite/${wsId}/${inviteId}` };
}

export const inviteMember = onCall({ region: "europe-west1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const appId = process.env.PICK_APP_ID;
  if (!appId) throw new HttpsError("failed-precondition", "PICK_APP_ID missing");
  const appBaseUrl = process.env.APP_BASE_URL ?? "https://playoff-creator.web.app";
  return handleInviteMember({
    db: getFirestore(), appId,
    auth: { uid: request.auth.uid },
    appBaseUrl, data: request.data,
  });
});

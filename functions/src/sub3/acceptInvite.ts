import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { syncClubSeatCount } from "../billing/syncClubSeatCount";
import { stripeSecretKey } from "../billing/stripeClient";

interface HandlerArgs {
  db: Firestore;
  appId: string;
  auth: { uid: string; displayName: string | null; email: string | null };
  data: { wsId: string; inviteId: string };
}

export async function handleAcceptInvite({ db, appId, auth, data }: HandlerArgs) {
  const { wsId, inviteId } = data ?? ({} as HandlerArgs["data"]);
  if (!wsId || !inviteId) throw new HttpsError("invalid-argument", "wsId+inviteId requeridos");

  const inviteRef = db.doc(`artifacts/${appId}/workspaces/${wsId}/invites/${inviteId}`);
  const memberRef = db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${auth.uid}`);
  const wsRef = db.doc(`artifacts/${appId}/workspaces/${wsId}`);
  const membershipRef = db.doc(`artifacts/${appId}/users/${auth.uid}/memberships/${wsId}`);

  type ExpiredFlag = { expired: true };
  const result = await db.runTransaction(async (tx) => {
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists) throw new HttpsError("not-found", "Invitación no encontrada o ya usada.");
    const invite = inviteSnap.data()!;

    const expiresAt = invite.expiresAt as Timestamp;
    if (expiresAt && expiresAt.toMillis() < Date.now()) {
      tx.delete(inviteRef);
      return { expired: true } satisfies ExpiredFlag;
    }

    const memberSnap = await tx.get(memberRef);
    if (memberSnap.exists) throw new HttpsError("already-exists", "Ya eres miembro de este workspace.");

    const wsSnap = await tx.get(wsRef);
    if (!wsSnap.exists) throw new HttpsError("not-found", "Workspace no encontrado.");
    const ws = wsSnap.data()!;

    const displayName = auth.displayName ?? "";
    const email = auth.email ?? "";
    const mismatchedEmailHint = invite.inviteEmail && invite.inviteEmail !== email ? { mismatchedEmailHint: true as const } : {};

    tx.set(memberRef, {
      role: invite.role, assignedTeamIds: invite.assignedTeamIds ?? [],
      displayName, email,
      joinedAt: FieldValue.serverTimestamp(),
      invitedBy: invite.invitedBy ?? null,
      ...mismatchedEmailHint,
    });
    tx.set(membershipRef, {
      workspaceType: ws.type === "club" ? "club" : "personal",
      workspaceName: ws.name ?? "",
      role: invite.role,
      joinedAt: FieldValue.serverTimestamp(),
    });
    tx.delete(inviteRef);
    return { expired: false };
  });

  if ((result as ExpiredFlag).expired) {
    throw new HttpsError("failed-precondition", "Invitación caducada. Pide una nueva.");
  }

  // Best-effort: si el workspace es un club B2B activo, sincroniza quantity en
  // Stripe. No bloquea la respuesta — el coach ya es miembro independientemente
  // de si Stripe responde. Webhook eventual escribirá el nuevo seatCount.
  // Cualquier fallo queda en logs para reconciliación posterior.
  await syncClubSeatCount(db, appId, wsId);

  return { ok: true, wsId };
}

export const acceptInvite = onCall({ region: "europe-west1", secrets: [stripeSecretKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const appId = process.env.PICK_APP_ID;
  if (!appId) throw new HttpsError("failed-precondition", "PICK_APP_ID missing");
  return handleAcceptInvite({
    db: getFirestore(), appId,
    auth: {
      uid: request.auth.uid,
      displayName: (request.auth.token?.name as string) ?? null,
      email: (request.auth.token?.email as string) ?? null,
    },
    data: request.data,
  });
});

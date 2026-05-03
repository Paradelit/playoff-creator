// functions/src/billing/createPortalSession.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { getStripe, stripeSecretKey } from "./stripeClient";

interface HandlerArgs {
  db: Firestore;
  auth: { uid: string };
  data: { wsId: string; appId: string; returnUrl: string };
}

export async function handleCreatePortalSession({ db, auth, data }: HandlerArgs) {
  const { wsId, appId, returnUrl } = data;
  if (!wsId || !appId || !returnUrl) {
    throw new HttpsError("invalid-argument", "Missing wsId, appId or returnUrl");
  }

  const wsSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}`).get();
  if (!wsSnap.exists) {
    throw new HttpsError("not-found", "workspace not found");
  }
  const ws = wsSnap.data();
  if (!ws || ws.ownerId !== auth.uid) {
    throw new HttpsError("permission-denied", "Only the workspace owner can manage billing");
  }
  const customerId: string | undefined = ws.billing?.stripeCustomerId;
  if (!customerId) {
    throw new HttpsError("failed-precondition", "no Stripe customer for this workspace");
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return { url: session.url };
}

export const createPortalSession = onCall(
  { secrets: [stripeSecretKey], region: "europe-west1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
    return handleCreatePortalSession({
      db: getFirestore(),
      auth: { uid: request.auth.uid },
      data: request.data,
    });
  }
);

// functions/src/billing/createCheckoutSession.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import {
  getStripe,
  stripeSecretKey,
  stripePriceMonthly,
  stripePriceAnnual,
} from "./stripeClient";

interface HandlerArgs {
  db: Firestore;
  auth: { uid: string };
  data: { wsId: string; appId: string; priceId: string };
}

/**
 * Pure handler — extracted for testability. The onCall wrapper below is the
 * deployment surface; tests call this directly with mocked db + auth.
 */
export async function handleCreateCheckoutSession({ db, auth, data }: HandlerArgs) {
  const { wsId, appId, priceId } = data;
  if (!wsId || !appId || !priceId) {
    throw new HttpsError("invalid-argument", "Missing wsId, appId or priceId");
  }
  // Allowlist guards against an attacker passing an arbitrary priceId
  // (e.g. a free or 1¢ price they created). Only our two known prices are accepted.
  const allowedPrices = [stripePriceMonthly.value(), stripePriceAnnual.value()].filter(Boolean);
  if (!allowedPrices.includes(priceId)) {
    throw new HttpsError("invalid-argument", `Invalid priceId: ${priceId}`);
  }

  const wsRef = db.doc(`artifacts/${appId}/workspaces/${wsId}`);
  const wsSnap = await wsRef.get();
  if (!wsSnap.exists) {
    throw new HttpsError("not-found", `workspace not found: ${wsId}`);
  }
  const ws = wsSnap.data();
  if (!ws || ws.ownerId !== auth.uid) {
    throw new HttpsError("permission-denied", "Only the workspace owner can manage billing");
  }

  const stripe = getStripe();
  let customerId: string | undefined = ws.billing?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { wsId, appId, uid: auth.uid },
    });
    customerId = customer.id;
    // Persist immediately so concurrent calls or a webhook race don't create a second customer.
    await wsRef.update({
      "billing.stripeCustomerId": customerId,
      "billing.lastEventAt": FieldValue.serverTimestamp(),
    });
  }

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    // subscription_data.metadata propagates to subscription + invoice events,
    // which is how webhooks resolve a Stripe event back to the workspace.
    subscription_data: {
      metadata: { wsId, appId },
    },
    return_url: `${process.env.APP_BASE_URL ?? "https://playoff-creator.web.app"}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
    allow_promotion_codes: true,
  });

  return { clientSecret: session.client_secret };
}

export const createCheckoutSession = onCall(
  {
    secrets: [stripeSecretKey, stripePriceMonthly, stripePriceAnnual],
    region: "europe-west1",
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
    return handleCreateCheckoutSession({
      db: getFirestore(),
      auth: { uid: request.auth.uid },
      data: request.data,
    });
  }
);

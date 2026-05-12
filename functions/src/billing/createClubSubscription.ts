// functions/src/billing/createClubSubscription.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { getStripe, stripeSecretKey, stripePricePerSeat } from "./stripeClient";

interface HandlerArgs {
  db: Firestore;
  auth: { uid: string };
  data: { wsId: string; appId: string; priceId: string };
}

/**
 * Inicia el checkout B2B per-seat para un club. Diferencias clave vs el B2C
 * de createCheckoutSession:
 *   - Solo válido en workspaces type='club'.
 *   - priceId debe coincidir con STRIPE_PRICE_B2B_PER_SEAT (allowlist de 1).
 *   - quantity inicial = miembros actuales del club (todos pagan, sin asientos free).
 *   - subscription_data.metadata.tier='b2b' permite al webhook persistir la
 *     distinción en workspace.billing.tier.
 */
export async function handleCreateClubSubscription({ db, auth, data }: HandlerArgs) {
  const { wsId, appId, priceId } = data;
  if (!wsId || !appId || !priceId) {
    throw new HttpsError("invalid-argument", "Missing wsId, appId or priceId");
  }
  const expectedPrice = stripePricePerSeat.value();
  if (!expectedPrice) {
    throw new HttpsError("failed-precondition", "Stripe per-seat price not configured");
  }
  if (priceId !== expectedPrice) {
    throw new HttpsError("invalid-argument", `Invalid priceId: ${priceId}`);
  }

  const wsRef = db.doc(`artifacts/${appId}/workspaces/${wsId}`);
  const wsSnap = await wsRef.get();
  if (!wsSnap.exists) {
    throw new HttpsError("not-found", `workspace not found: ${wsId}`);
  }
  const ws = wsSnap.data();
  if (!ws) throw new HttpsError("internal", "workspace data missing");
  if (ws.type !== "club") {
    throw new HttpsError("failed-precondition", "B2B subscriptions require type=club");
  }
  if (ws.ownerId !== auth.uid) {
    throw new HttpsError("permission-denied", "Only the workspace owner can manage billing");
  }

  // Cuento miembros actuales para fijar quantity inicial. Todos los seats pagan
  // (DT incluido) por decisión de spec 0 — coherente con la lógica del webhook.
  const membersSnap = await db.collection(`artifacts/${appId}/workspaces/${wsId}/members`).get();
  const seatCount = Math.max(membersSnap.size, 1);

  const stripe = getStripe();
  let customerId: string | undefined = ws.billing?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { wsId, appId, uid: auth.uid, tier: "b2b" },
    });
    customerId = customer.id;
    await wsRef.update({
      "billing.stripeCustomerId": customerId,
      "billing.tier": "b2b",
      "billing.lastEventAt": FieldValue.serverTimestamp(),
    });
  }

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    customer: customerId,
    line_items: [{ price: priceId, quantity: seatCount }],
    mode: "subscription",
    subscription_data: {
      // tier permite distinguir B2B vs B2C en el webhook sin tener que mirar el
      // priceId. Si el mismo Stripe Price se reusa para más cosas en el futuro,
      // esto sigue funcionando.
      metadata: { wsId, appId, tier: "b2b" },
    },
    return_url: `${process.env.APP_BASE_URL ?? "https://playoff-creator.web.app"}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
    allow_promotion_codes: true,
  });

  return { clientSecret: session.client_secret, seatCount };
}

export const createClubSubscription = onCall(
  {
    secrets: [stripeSecretKey, stripePricePerSeat],
    region: "europe-west1",
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
    return handleCreateClubSubscription({
      db: getFirestore(),
      auth: { uid: request.auth.uid },
      data: request.data,
    });
  }
);

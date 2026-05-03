// functions/src/billing/handlers/checkoutCompleted.ts
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import type Stripe from "stripe";

/**
 * Fires the moment a Checkout Session is paid. Promotes the workspace to plan='pro'
 * and persists the Stripe subscription/customer references. Idempotent at the
 * dispatcher level (stripeEvents collection); safe to retry.
 */
export async function handleCheckoutCompleted(
  db: Firestore,
  event: Stripe.CheckoutSessionCompletedEvent
): Promise<void> {
  const session = event.data.object;
  const wsId = session.metadata?.wsId;
  const appId = session.metadata?.appId;
  if (!wsId || !appId) {
    logger.warn("WEBHOOK_ORPHAN_EVENT", { type: event.type, eventId: event.id });
    return;
  }
  await db.doc(`artifacts/${appId}/workspaces/${wsId}`).update({
    plan: "pro",
    planUpdatedAt: FieldValue.serverTimestamp(),
    "billing.stripeCustomerId": session.customer,
    "billing.stripeSubscriptionId": session.subscription,
    "billing.status": "active",
    "billing.cancelAtPeriodEnd": false,
    "billing.lastEventAt": FieldValue.serverTimestamp(),
  });
}

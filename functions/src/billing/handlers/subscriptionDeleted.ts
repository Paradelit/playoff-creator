// functions/src/billing/handlers/subscriptionDeleted.ts
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import type Stripe from "stripe";

/**
 * Final state for cancellations after the grace period. Downgrades the
 * workspace to plan='free' so quota gating kicks back in on the next AI call.
 */
export async function handleSubscriptionDeleted(
  db: Firestore,
  event: Stripe.CustomerSubscriptionDeletedEvent
): Promise<void> {
  const sub = event.data.object;
  const wsId = sub.metadata?.wsId;
  const appId = sub.metadata?.appId;
  if (!wsId || !appId) {
    logger.warn("WEBHOOK_ORPHAN_EVENT", { type: event.type, eventId: event.id });
    return;
  }
  await db.doc(`artifacts/${appId}/workspaces/${wsId}`).update({
    plan: "free",
    planUpdatedAt: FieldValue.serverTimestamp(),
    "billing.status": "canceled",
    "billing.cancelAtPeriodEnd": false,
    "billing.lastEventAt": FieldValue.serverTimestamp(),
  });
}

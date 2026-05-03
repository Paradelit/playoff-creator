// functions/src/billing/handlers/subscriptionUpdated.ts
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import type Stripe from "stripe";

/**
 * Fires on subscription state transitions (active → past_due, cancel-at-period-end
 * toggled, plan switch). Mirrors Stripe state into workspace.billing without
 * downgrading plan — that's subscriptionDeleted's job.
 */
export async function handleSubscriptionUpdated(
  db: Firestore,
  event: Stripe.CustomerSubscriptionUpdatedEvent
): Promise<void> {
  const sub = event.data.object;
  const wsId = sub.metadata?.wsId;
  const appId = sub.metadata?.appId;
  if (!wsId || !appId) {
    logger.warn("WEBHOOK_ORPHAN_EVENT", { type: event.type, eventId: event.id });
    return;
  }
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodEnd = (sub as any).current_period_end as number | undefined;
  await db.doc(`artifacts/${appId}/workspaces/${wsId}`).update({
    "billing.status": sub.status,
    "billing.cancelAtPeriodEnd": sub.cancel_at_period_end ?? false,
    "billing.currentPeriodEnd": periodEnd ? Timestamp.fromMillis(periodEnd * 1000) : null,
    "billing.priceId": priceId,
    "billing.lastEventAt": FieldValue.serverTimestamp(),
  });
}

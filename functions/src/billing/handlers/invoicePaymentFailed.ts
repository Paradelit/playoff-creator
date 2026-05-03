// functions/src/billing/handlers/invoicePaymentFailed.ts
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import type Stripe from "stripe";

/**
 * Marks billing.status='past_due' but keeps plan='pro' so the user can still
 * use the product while Smart Retries try the card again. Final cancellation
 * (after retries exhausted + grace period) comes through subscriptionDeleted.
 */
export async function handleInvoicePaymentFailed(
  db: Firestore,
  event: Stripe.InvoicePaymentFailedEvent
): Promise<void> {
  const invoice = event.data.object;
  const wsId = invoice.metadata?.wsId ?? extractSubscriptionMetadata(invoice, "wsId");
  const appId = invoice.metadata?.appId ?? extractSubscriptionMetadata(invoice, "appId");
  if (!wsId || !appId) {
    logger.warn("WEBHOOK_ORPHAN_EVENT", { type: event.type, eventId: event.id });
    return;
  }
  await db.doc(`artifacts/${appId}/workspaces/${wsId}`).update({
    "billing.status": "past_due",
    "billing.lastEventAt": FieldValue.serverTimestamp(),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSubscriptionMetadata(invoice: any, key: string): string | undefined {
  return invoice?.subscription_details?.metadata?.[key];
}

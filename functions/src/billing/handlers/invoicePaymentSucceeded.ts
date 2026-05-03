// functions/src/billing/handlers/invoicePaymentSucceeded.ts
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import type Stripe from "stripe";

/**
 * Reaffirms plan='pro' and clears past_due flags on a successful renewal.
 * Stripe sends this for the initial paid checkout AND for every recurring
 * renewal. Idempotent at the dispatcher level.
 *
 * Metadata resolution: the invoice itself rarely carries metadata, but the
 * subscription's metadata is exposed via subscription_details.metadata on the
 * invoice payload. Falls back to subscription_details path before declaring
 * the event orphan.
 */
export async function handleInvoicePaymentSucceeded(
  db: Firestore,
  event: Stripe.InvoicePaymentSucceededEvent
): Promise<void> {
  const invoice = event.data.object;
  const wsId = invoice.metadata?.wsId ?? extractSubscriptionMetadata(invoice, "wsId");
  const appId = invoice.metadata?.appId ?? extractSubscriptionMetadata(invoice, "appId");
  if (!wsId || !appId) {
    logger.warn("WEBHOOK_ORPHAN_EVENT", { type: event.type, eventId: event.id });
    return;
  }
  await db.doc(`artifacts/${appId}/workspaces/${wsId}`).update({
    plan: "pro",
    "billing.status": "active",
    "billing.lastEventAt": FieldValue.serverTimestamp(),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSubscriptionMetadata(invoice: any, key: string): string | undefined {
  return invoice?.subscription_details?.metadata?.[key];
}

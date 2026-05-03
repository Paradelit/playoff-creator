// functions/src/billing/webhook.ts
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { getStripe, stripeSecretKey, stripeWebhookSigningSecret } from "./stripeClient";
import { handleCheckoutCompleted } from "./handlers/checkoutCompleted";
import { handleSubscriptionUpdated } from "./handlers/subscriptionUpdated";
import { handleSubscriptionDeleted } from "./handlers/subscriptionDeleted";
import { handleInvoicePaymentSucceeded } from "./handlers/invoicePaymentSucceeded";
import { handleInvoicePaymentFailed } from "./handlers/invoicePaymentFailed";

export type WebhookHandler = (db: Firestore, event: Stripe.Event) => Promise<void>;

/**
 * Process a verified Stripe event with at-least-once + idempotency semantics.
 *
 * - Reads `stripeEvents/{eventId}` first; if marker exists, the event was
 *   already processed and we no-op (Stripe retries land here).
 * - Runs the matching handler (if any). Unknown event types fall through.
 * - Writes the marker AFTER the handler succeeds. If the handler throws,
 *   the marker is NOT written so Stripe retries; handlers must be idempotent.
 *
 * Marker writes always include the event type and the resolved wsId (or null)
 * for forensic queries. That's why this function takes appId — the marker
 * lives under `artifacts/{appId}/stripeEvents/`.
 */
export async function dispatchWebhook(
  db: Firestore,
  appId: string,
  event: Stripe.Event,
  handlers: Record<string, WebhookHandler>
): Promise<void> {
  const eventRef = db.doc(`artifacts/${appId}/stripeEvents/${event.id}`);
  const existing = await eventRef.get();
  if (existing.exists) {
    logger.info("[stripeWebhook] duplicate event, skipping", {
      eventId: event.id,
      type: event.type,
    });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wsId = (event.data.object as any)?.metadata?.wsId ?? null;
  const handler = handlers[event.type];
  if (handler) {
    try {
      await handler(db, event);
    } catch (err) {
      logger.error("[stripeWebhook] handler failed", {
        eventId: event.id,
        type: event.type,
        err: (err as Error).message,
      });
      // Re-throw so Stripe receives 500 and retries this event.
      // Marker is intentionally NOT written here — preserves at-least-once.
      throw err;
    }
  }

  await eventRef.set({
    type: event.type,
    processedAt: FieldValue.serverTimestamp(),
    wsId,
  });
}

const HANDLERS: Record<string, WebhookHandler> = {
  "checkout.session.completed": handleCheckoutCompleted as WebhookHandler,
  "customer.subscription.updated": handleSubscriptionUpdated as WebhookHandler,
  "customer.subscription.deleted": handleSubscriptionDeleted as WebhookHandler,
  "invoice.payment_succeeded": handleInvoicePaymentSucceeded as WebhookHandler,
  "invoice.payment_failed": handleInvoicePaymentFailed as WebhookHandler,
};

export const stripeWebhook = onRequest(
  {
    secrets: [stripeSecretKey, stripeWebhookSigningSecret],
    region: "europe-west1",
    // The Functions framework parses application/json bodies and exposes the
    // raw bytes via req.rawBody, which is what Stripe's constructEvent needs
    // for HMAC signature verification.
  },
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string | undefined;
    if (!sig) {
      logger.warn("[stripeWebhook] missing stripe-signature header");
      res.status(400).send("Missing stripe-signature header");
      return;
    }

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSigningSecret.value()
      );
    } catch (err) {
      logger.error("[stripeWebhook] signature verification failed", {
        err: (err as Error).message,
      });
      res.status(400).send(`Webhook signature error: ${(err as Error).message}`);
      return;
    }

    const appId = process.env.PICK_APP_ID || "uros-fbm-app";
    try {
      await dispatchWebhook(getFirestore(), appId, event, HANDLERS);
      res.status(200).send("ok");
    } catch (err) {
      // Generic handler failure — Stripe will retry per its backoff policy.
      res.status(500).send(`Handler error: ${(err as Error).message}`);
    }
  }
);

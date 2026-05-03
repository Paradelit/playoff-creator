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
 * Marker writes include the event type and the resolved wsId (or null) for
 * forensic queries. That's why this function takes appId — the marker lives
 * under `artifacts/{appId}/stripeEvents/`.
 *
 * IMPORTANT: this no-marker-transaction model relies on every handler being
 * purely deterministic — given the same event payload, it must produce the
 * same Firestore writes. All current handlers use `.update()` with fields
 * derived directly from the event, which is safe under at-least-once delivery
 * and parallel-delivery races. If a future handler conditionally branches on
 * existing workspace state (e.g., "only downgrade if currently pro"), wrap
 * that handler in a Firestore transaction to close the lost-update window.
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

  // Mirror the handlers' metadata fallback so forensic queries by wsId catch
  // invoice events too (invoices carry wsId in subscription_details.metadata).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = event.data.object as any;
  const wsId = obj?.metadata?.wsId ?? obj?.subscription_details?.metadata?.wsId ?? null;
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

    // Fail closed if PICK_APP_ID is unset — never silently process live
    // Stripe traffic against the prod namespace from a misconfigured deploy.
    // 503 lets Stripe retry while the deploy is fixed.
    const appId = process.env.PICK_APP_ID;
    if (!appId) {
      logger.error("[stripeWebhook] PICK_APP_ID env var missing; refusing dispatch", {
        eventId: event.id,
      });
      res.status(503).send("Service misconfigured");
      return;
    }
    try {
      await dispatchWebhook(getFirestore(), appId, event, HANDLERS);
      res.status(200).send("ok");
    } catch (err) {
      // Stripe doesn't read the response body for retry decisions — only the
      // status code matters. Keep the body generic so handler internals
      // (paths, IDs, customer data) don't leak into Stripe's webhook attempt
      // logs. Detailed error is in logger.error inside the dispatcher.
      logger.error("[stripeWebhook] dispatch failed", {
        eventId: event.id,
        type: event.type,
        err: (err as Error).message,
      });
      res.status(500).send("Handler error");
    }
  }
);

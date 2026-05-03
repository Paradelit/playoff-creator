// functions/src/billing/stripeClient.ts
import Stripe from "stripe";
import { defineSecret } from "firebase-functions/params";

export const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
export const stripeWebhookSigningSecret = defineSecret("STRIPE_WEBHOOK_SIGNING_SECRET");
export const stripePriceMonthly = defineSecret("STRIPE_PRICE_MONTHLY");
export const stripePriceAnnual = defineSecret("STRIPE_PRICE_ANNUAL");

let cached: Stripe | null = null;

/**
 * Returns a singleton Stripe client. Initialized on first use.
 * Throws if STRIPE_SECRET_KEY is missing — failing fast prevents silent
 * degradation where webhooks/checkout return success without contacting Stripe.
 */
export function getStripe(): Stripe {
  if (cached) return cached;
  const key = stripeSecretKey.value();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is required but missing");
  }
  cached = new Stripe(key);
  return cached;
}

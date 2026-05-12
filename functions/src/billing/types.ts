// functions/src/billing/types.ts
import type { Timestamp } from "firebase-admin/firestore";

export type WorkspacePlan = "free" | "pro";

/**
 * Distingue suscripciones B2C (personal, 1 asiento implícito) de B2B
 * (club, per-seat con quantity sincronizada con members count).
 * Se setea desde el checkout — la única forma de empezar B2B es vía
 * createClubSubscription, que pasa tier='b2b' en session metadata.
 */
export type BillingTier = "b2c" | "b2b";

export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "trialing";

export interface WorkspaceBilling {
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Timestamp | null;
  priceId: string | null;
  tier: BillingTier | null;
  // Sólo presente en tier='b2b'. Refleja subscription.items[0].quantity.
  // Sincronizado por handleSubscriptionUpdated.
  seatCount: number | null;
  lastEventAt: Timestamp;
}

export interface UsageData {
  count: number;
  lastIncrementAt: Timestamp;
  monthId: string;
}

export interface QuotaResult {
  count: number;
  monthId: string;
}

export interface StripeEventDoc {
  type: string;
  processedAt: Timestamp;
  wsId: string | null;
}

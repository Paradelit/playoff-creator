// functions/src/billing/types.ts
import type { Timestamp } from "firebase-admin/firestore";

export type WorkspacePlan = "free" | "pro";

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

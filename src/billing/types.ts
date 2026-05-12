// src/billing/types.ts
import type { Timestamp } from 'firebase/firestore';

export type WorkspacePlan = 'free' | 'pro';

export type BillingTier = 'b2c' | 'b2b';

export type SubscriptionStatus = 'active' | 'past_due' | 'unpaid' | 'canceled' | 'trialing';

export interface WorkspaceBilling {
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Timestamp | null;
  priceId: string | null;
  tier: BillingTier | null;
  seatCount: number | null;
  lastEventAt: Timestamp;
}

export interface UsageData {
  count: number;
  lastIncrementAt: Timestamp;
  monthId: string;
}

export interface QuotaExceededDetails {
  count: number;
  limit: number;
  monthId: string;
}

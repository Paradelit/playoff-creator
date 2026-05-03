// functions/src/billing/quota.ts
import type { Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { FREE_QUOTA, PRO_FAIR_USE } from "./constants";
import { incrementUsage } from "./usage";
import { currentMonthId } from "./currentMonthId";
import type { QuotaResult, WorkspacePlan } from "./types";

interface AssertWithinQuotaArgs {
  wsId: string;
  appId: string;
}

/**
 * Asserts the workspace has remaining quota for an AI call.
 * Always increments the counter (increment-before-execution semantics — see spec sec. 3.4).
 *
 * - Pro plans: never throws, but logs PRO_FAIR_USE_EXCEEDED past the soft cap.
 * - Free plans: throws HttpsError('resource-exhausted', 'QUOTA_EXCEEDED') when count > FREE_QUOTA.
 */
export async function assertWithinQuota(
  db: Firestore,
  { wsId, appId }: AssertWithinQuotaArgs
): Promise<QuotaResult> {
  const wsSnap = await db.doc(`artifacts/${appId}/workspaces/${wsId}`).get();
  if (!wsSnap.exists) {
    throw new HttpsError("not-found", `workspace not found: ${wsId}`);
  }
  const plan = (wsSnap.data()?.plan as WorkspacePlan | undefined) ?? "free";
  const monthId = currentMonthId();
  const usage = await incrementUsage(db, appId, wsId, monthId);

  if (plan === "pro") {
    if (usage.count > PRO_FAIR_USE) {
      logger.warn("PRO_FAIR_USE_EXCEEDED", {
        wsId,
        appId,
        count: usage.count,
        monthId,
      });
    }
    return usage;
  }

  if (usage.count > FREE_QUOTA) {
    throw new HttpsError("resource-exhausted", "QUOTA_EXCEEDED", {
      count: usage.count,
      limit: FREE_QUOTA,
      monthId,
    });
  }
  return usage;
}

// functions/src/billing/usage.ts
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { QuotaResult } from "./types";

/**
 * Atomically increment the usage counter for a workspace in a given month.
 * Creates the doc with `count: 1` if it doesn't exist; otherwise increments.
 *
 * Runs inside a Firestore transaction to avoid race conditions when
 * multiple AI calls fire concurrently for the same workspace.
 */
export async function incrementUsage(
  db: Firestore,
  appId: string,
  wsId: string,
  monthId: string
): Promise<QuotaResult> {
  const ref = db.doc(`artifacts/${appId}/workspaces/${wsId}/usage/${monthId}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, {
        count: 1,
        lastIncrementAt: FieldValue.serverTimestamp(),
        monthId,
      });
      return { count: 1, monthId };
    }
    const next = (snap.data()?.count ?? 0) + 1;
    tx.update(ref, {
      count: FieldValue.increment(1),
      lastIncrementAt: FieldValue.serverTimestamp(),
    });
    return { count: next, monthId };
  });
}

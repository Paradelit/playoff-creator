import type { Firestore, Timestamp as TimestampType } from 'firebase-admin/firestore';

/**
 * Persistent cache for history-summary chunks (sub-B.2).
 *
 * Each cached entry is keyed by `(wsId, conversationId, chunkEndIndex)` and
 * stored under the user's private doc tree so it inherits the same auth scope
 * as `users/{uid}/pickHistory`. The orchestrator computes the same key on
 * every turn — if older turns haven't shifted, the summary is reused and we
 * skip the (paid) LLM call.
 *
 * Rules: covered by the catch-all `users/{uid}/{document=**}` block in
 * firestore.rules. The backend (Admin SDK) writes here; a malicious client
 * COULD technically write too, but the worst-case is the user poisoning their
 * own summaries, identical risk profile to pickHistory.
 */

let _Timestamp: typeof TimestampType | null = null;
async function getTimestamp(): Promise<typeof TimestampType> {
  if (_Timestamp) return _Timestamp;
  // Lazy import so tests that pass a mock Firestore never touch firebase-admin.
  const admin = await import('firebase-admin/firestore');
  _Timestamp = admin.Timestamp;
  return _Timestamp;
}

export interface HistoryCacheDeps {
  db: Firestore;
  appId: string;
  wsId: string;
  userId: string;
}

interface HistorySummaryDoc {
  summary: string;
  createdAt: TimestampType | { toMillis(): number };
}

/**
 * Builds a doc ref under `artifacts/{appId}/users/{uid}/historySummaries/{id}`.
 * The id encodes wsId so a single user moving between workspaces never
 * cross-pollutes summaries between them. We replace ":" with "__" because
 * doc ids can't contain colons in all Firestore SDKs.
 */
function summaryRef(deps: HistoryCacheDeps, key: string) {
  const safeKey = key.replace(/:/g, '__');
  const docId = `${deps.wsId}__${safeKey}`;
  return deps.db
    .collection('artifacts')
    .doc(deps.appId)
    .collection('users')
    .doc(deps.userId)
    .collection('historySummaries')
    .doc(docId);
}

export async function getCachedSummary(deps: HistoryCacheDeps, key: string): Promise<string | null> {
  const snap = await summaryRef(deps, key).get();
  if (!snap.exists) return null;
  const data = snap.data() as HistorySummaryDoc | undefined;
  return typeof data?.summary === 'string' ? data.summary : null;
}

export async function setCachedSummary(deps: HistoryCacheDeps, key: string, summary: string): Promise<void> {
  const Timestamp = await getTimestamp();
  await summaryRef(deps, key).set({
    summary,
    createdAt: Timestamp.now(),
  });
}

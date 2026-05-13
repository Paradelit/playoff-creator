import type { Firestore, Timestamp as TimestampType } from 'firebase-admin/firestore';
import type { ProactiveKind } from './types';

/**
 * Dismissals (sub-B.5b).
 *
 * Per-user backoff state for proactive messages. When the coach clicks
 * "Ahora no" on a ProactiveCard, we record a timestamp under
 * `users/{uid}/preferences/proactive` keyed by `ProactiveKind`. The next
 * time the engine considers emitting the same kind, it checks this state
 * and skips if dismissed within BACKOFF_DAYS.
 *
 * 7-day backoff is conservative: the coach gets reminded again next week,
 * not next session — avoids re-nagging on the same urgency in the same
 * news cycle.
 */

const BACKOFF_DAYS = 7;
const BACKOFF_MS = BACKOFF_DAYS * 24 * 60 * 60 * 1000;

let _Timestamp: typeof TimestampType | null = null;
async function getTimestamp(): Promise<typeof TimestampType> {
  if (_Timestamp) return _Timestamp;
  const admin = await import('firebase-admin/firestore');
  _Timestamp = admin.Timestamp;
  return _Timestamp;
}

export interface DismissalsDeps {
  db: Firestore;
  appId: string;
  userId: string;
}

interface DismissalEntry {
  lastDismissedAt?: TimestampType | { toMillis: () => number } | null;
}

type DismissalsDoc = Partial<Record<ProactiveKind, DismissalEntry>>;

function ref(deps: DismissalsDeps) {
  return deps.db
    .collection('artifacts')
    .doc(deps.appId)
    .collection('users')
    .doc(deps.userId)
    .collection('preferences')
    .doc('proactive');
}

export async function wasRecentlyDismissed(deps: DismissalsDeps, kind: ProactiveKind): Promise<boolean> {
  const snap = await ref(deps).get();
  if (!snap.exists) return false;
  const data = (snap.data() as DismissalsDoc | undefined) || {};
  const entry = data[kind];
  if (!entry || !entry.lastDismissedAt || typeof entry.lastDismissedAt.toMillis !== 'function') {
    return false;
  }
  const ageMs = Date.now() - entry.lastDismissedAt.toMillis();
  return ageMs < BACKOFF_MS;
}

export async function recordDismissal(deps: DismissalsDeps, kind: ProactiveKind): Promise<void> {
  const Timestamp = await getTimestamp();
  await ref(deps).set({ [kind]: { lastDismissedAt: Timestamp.now() } }, { merge: true });
}

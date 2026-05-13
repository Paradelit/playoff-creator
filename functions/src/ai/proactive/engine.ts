import type { Firestore } from 'firebase-admin/firestore';
import type { UserDigest } from '../digest/types';
import { prioritizeProactive } from './priorizer';
import { wasRecentlyDismissed as defaultWasRecentlyDismissed } from './dismissals';
import type { ProactiveKind, ProactiveMessage } from './types';

/**
 * On-open Proactive engine (sub-B.5).
 *
 * Pure orchestrator on top of `prioritizeProactive` (pure) + `wasRecentlyDismissed`
 * (IO). The frontend calls this via `pickGetProactive` when Pick opens.
 * Returns at most ONE message — we never barrage the coach. If everything
 * relevant has been dismissed in the last 7 days, we stay quiet.
 *
 * Same-kind dedupe: even if there are 3 ambient convocatorias pendientes,
 * we only check the kind's dismissal status once. Picking the right
 * convocatoria (most urgent) is the priorizer's job.
 */

export interface ProactiveEngineDeps {
  db: Firestore;
  appId: string;
  userId: string;
  /** Override for tests. Defaults to the real Firestore-backed check. */
  wasRecentlyDismissed?: (
    deps: { db: Firestore; appId: string; userId: string },
    kind: ProactiveKind,
  ) => Promise<boolean>;
}

export async function decideProactive(
  deps: ProactiveEngineDeps,
  digest: UserDigest,
  nowISO: string,
): Promise<ProactiveMessage | null> {
  const candidates = prioritizeProactive(digest, nowISO);
  if (candidates.length === 0) return null;

  const check = deps.wasRecentlyDismissed || defaultWasRecentlyDismissed;
  const dismissedKinds = new Set<ProactiveKind>();
  const checkedKinds = new Set<ProactiveKind>();

  for (const candidate of candidates) {
    if (dismissedKinds.has(candidate.kind)) continue;
    if (!checkedKinds.has(candidate.kind)) {
      checkedKinds.add(candidate.kind);
      const dismissed = await check({ db: deps.db, appId: deps.appId, userId: deps.userId }, candidate.kind);
      if (dismissed) {
        dismissedKinds.add(candidate.kind);
        continue;
      }
    }
    return candidate;
  }
  return null;
}

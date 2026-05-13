import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wasRecentlyDismissed, recordDismissal } from '../dismissals';

/**
 * Mock Firestore that supports the single path used by dismissals:
 *   artifacts/{appId}/users/{uid}/preferences/proactive
 * Tests assert on the `store` map for write verification.
 */
function makeMockDb(initial: Record<string, Record<string, unknown>> = {}) {
  const store = new Map<string, Record<string, unknown>>(Object.entries(initial));

  function doc(path: string) {
    return {
      get: vi.fn(async () => ({
        exists: store.has(path),
        data: () => store.get(path),
      })),
      set: vi.fn(async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
        if (opts?.merge) {
          const existing = store.get(path) || {};
          store.set(path, { ...existing, ...data });
        } else {
          store.set(path, data);
        }
      }),
    };
  }

  function collection(parent: string) {
    return {
      doc: (id: string) => {
        const childPath = `${parent}/${id}`;
        return {
          ...doc(childPath),
          collection: (sub: string) => collection(`${childPath}/${sub}`),
        };
      },
    };
  }

  return {
    db: { collection: (root: string) => collection(root) },
    store,
  };
}

const DEPS_BASE = { appId: 'a', userId: 'u1' };

describe('wasRecentlyDismissed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-13T18:00:00Z'));
  });

  it('returns false when there is no dismissals doc', async () => {
    const { db } = makeMockDb();
    const out = await wasRecentlyDismissed({ db: db as never, ...DEPS_BASE }, 'convocatoria_urgent');
    expect(out).toBe(false);
  });

  it('returns false when this kind has never been dismissed', async () => {
    const { db } = makeMockDb({
      'artifacts/a/users/u1/preferences/proactive': {
        scouting_missing: { lastDismissedAt: { toMillis: () => Date.now() } },
      },
    });
    const out = await wasRecentlyDismissed({ db: db as never, ...DEPS_BASE }, 'convocatoria_urgent');
    expect(out).toBe(false);
  });

  it('returns true when dismissed less than 7 days ago', async () => {
    const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000;
    const { db } = makeMockDb({
      'artifacts/a/users/u1/preferences/proactive': {
        convocatoria_urgent: { lastDismissedAt: { toMillis: () => sixDaysAgo } },
      },
    });
    const out = await wasRecentlyDismissed({ db: db as never, ...DEPS_BASE }, 'convocatoria_urgent');
    expect(out).toBe(true);
  });

  it('returns false when dismissed more than 7 days ago (backoff expired)', async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const { db } = makeMockDb({
      'artifacts/a/users/u1/preferences/proactive': {
        convocatoria_urgent: { lastDismissedAt: { toMillis: () => eightDaysAgo } },
      },
    });
    const out = await wasRecentlyDismissed({ db: db as never, ...DEPS_BASE }, 'convocatoria_urgent');
    expect(out).toBe(false);
  });

  it('handles malformed entries defensively (returns false)', async () => {
    const { db } = makeMockDb({
      'artifacts/a/users/u1/preferences/proactive': {
        convocatoria_urgent: { lastDismissedAt: null },
      },
    });
    const out = await wasRecentlyDismissed({ db: db as never, ...DEPS_BASE }, 'convocatoria_urgent');
    expect(out).toBe(false);
  });
});

describe('recordDismissal', () => {
  it('writes a {kind: {lastDismissedAt}} entry with merge:true', async () => {
    const { db, store } = makeMockDb({
      'artifacts/a/users/u1/preferences/proactive': {
        scouting_missing: { lastDismissedAt: { toMillis: () => 1 } },
      },
    });
    await recordDismissal({ db: db as never, ...DEPS_BASE }, 'convocatoria_urgent');
    const data = store.get('artifacts/a/users/u1/preferences/proactive')!;
    expect(data.convocatoria_urgent).toBeDefined();
    // scouting_missing must still be present (merge: true)
    expect(data.scouting_missing).toBeDefined();
  });

  it('creates the doc if it does not exist yet', async () => {
    const { db, store } = makeMockDb();
    await recordDismissal({ db: db as never, ...DEPS_BASE }, 'scouting_missing');
    const data = store.get('artifacts/a/users/u1/preferences/proactive');
    expect(data).toBeDefined();
    expect(data!.scouting_missing).toBeDefined();
  });
});

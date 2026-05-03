import { describe, expect, it, vi } from 'vitest';

vi.mock('../tools/memoryTools', () => ({
  fetchMemoriesForDigest: vi.fn().mockResolvedValue([]),
  // Re-export the enum used in userDigest's type imports.
  MemoryType: { tactical: 'tactical', personal: 'personal', team: 'team' },
}));

// Imported AFTER mocks so the mocked memoryTools is wired in.
import { buildUserDigest } from '../userDigest';

type DocSnap = { exists: boolean; data: () => Record<string, unknown> | undefined };
type QuerySnap = { docs: never[]; size: number; empty: boolean };

function emptyQuery(): QuerySnap {
  return { docs: [], size: 0, empty: true };
}

// Minimal Firestore-shaped fake that records every doc path read.
// `profileData` is returned when the read path ends with /profile/main;
// every other read returns an empty result. Sufficient to assert which
// path the digest uses for the profile read.
function makeFakeDb(profileData: Record<string, unknown> | null) {
  const accessedDocPaths: string[] = [];

  function makeDocRef(path: string): unknown {
    return {
      get: async (): Promise<DocSnap> => {
        accessedDocPaths.push(path);
        if (path.endsWith('/profile/main') && profileData) {
          return { exists: true, data: () => profileData };
        }
        return { exists: false, data: () => undefined };
      },
      collection: (name: string) => makeColRef(`${path}/${name}`),
    };
  }

  function makeColRef(path: string): unknown {
    return {
      doc: (id: string) => makeDocRef(`${path}/${id}`),
      get: async () => emptyQuery(),
      where: () => makeQuery(path),
      orderBy: () => makeQuery(path),
    };
  }

  function makeQuery(path: string): unknown {
    return {
      where: () => makeQuery(path),
      orderBy: () => makeQuery(path),
      get: async () => emptyQuery(),
    };
  }

  const db = { collection: (name: string) => makeColRef(name) };
  return { db, accessedDocPaths };
}

describe('buildUserDigest — preferences come from user profile', () => {
  it('reads profile/main from users/{uid}/, not from workspaces/{wsId}/', async () => {
    const { db, accessedDocPaths } = makeFakeDb({
      proactivityMode: 'high',
      defaultTrainingDuration: 90,
    });

    const digest = await buildUserDigest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      userId: 'u1',
      wsId: 'w1',
      appId: 'app1',
      clientDate: '2026-05-03',
    });

    expect(digest.preferences.proactivityMode).toBe('high');
    expect(digest.preferences.defaultTrainingDuration).toBe(90);
    expect(accessedDocPaths).toContain('artifacts/app1/users/u1/profile/main');
    expect(accessedDocPaths).not.toContain('artifacts/app1/workspaces/w1/profile/main');
  });

  it('returns empty preferences when profile/main does not exist', async () => {
    const { db } = makeFakeDb(null);

    const digest = await buildUserDigest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      userId: 'u1',
      wsId: 'w1',
      appId: 'app1',
      clientDate: '2026-05-03',
    });

    expect(digest.preferences.proactivityMode).toBeUndefined();
    expect(digest.preferences.defaultTrainingDuration).toBeUndefined();
    expect(digest.todayISO).toBe('2026-05-03');
  });
});

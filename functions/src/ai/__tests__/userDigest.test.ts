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

describe('buildUserDigest — sub-A.2/A.3 (workspace + day of week + scoping integration)', () => {
  it('exposes workspace.name + workspace.type + userRole from members doc', async () => {
    // Build a fake DB that returns workspace + member docs with concrete data.
    const accessedPaths: string[] = [];
    function makeDocRef(path: string): unknown {
      return {
        get: async () => {
          accessedPaths.push(path);
          if (path === 'artifacts/app1/workspaces/w1') {
            return { exists: true, data: () => ({ name: 'Club ABC', type: 'club' }) };
          }
          if (path === 'artifacts/app1/workspaces/w1/members/u1') {
            return { exists: true, data: () => ({ role: 'owner' }) };
          }
          return { exists: false, data: () => undefined };
        },
        collection: (name: string) => makeColRef(`${path}/${name}`),
      };
    }
    function makeColRef(path: string): unknown {
      const query = {
        where: () => query,
        orderBy: () => query,
        get: async () => ({ docs: [] }),
      };
      return {
        doc: (id: string) => makeDocRef(`${path}/${id}`),
        get: async () => ({ docs: [] }),
        where: () => query,
        orderBy: () => query,
      };
    }
    const db = { collection: (n: string) => makeColRef(n) };

    const digest = await buildUserDigest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      userId: 'u1',
      wsId: 'w1',
      appId: 'app1',
      clientDate: '2026-05-13',
    });

    expect(digest.workspace).toEqual({
      id: 'w1',
      name: 'Club ABC',
      type: 'club',
      userRole: 'owner',
    });
    expect(digest.todayISO).toBe('2026-05-13');
    // 2026-05-13 fue miércoles (verificación leve).
    expect(digest.todayLocalDayOfWeek).toBe('miércoles');
  });

  it('defaults role to "assistant" when members doc is missing', async () => {
    function makeDocRef(_path: string): unknown {
      return {
        get: async () => ({ exists: false, data: () => undefined }),
        collection: (n: string) => makeColRef(`${_path}/${n}`),
      };
    }
    function makeColRef(path: string): unknown {
      const query = {
        where: () => query,
        orderBy: () => query,
        get: async () => ({ docs: [] }),
      };
      return {
        doc: (id: string) => makeDocRef(`${path}/${id}`),
        get: async () => ({ docs: [] }),
        where: () => query,
        orderBy: () => query,
      };
    }
    const db = { collection: (n: string) => makeColRef(n) };

    const digest = await buildUserDigest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      userId: 'u1',
      wsId: 'w1',
      appId: 'app1',
      clientDate: '2026-05-13',
    });
    expect(digest.workspace.userRole).toBe('assistant');
    // Sin assignedTeamIds, el assistant no ve ningún team.
    expect(digest.teams).toEqual([]);
    expect(digest.activeBrackets).toEqual([]);
  });

  it('returns recentPastSessions: [] when no past sessions match', async () => {
    const { db } = makeFakeDb(null);
    const digest = await buildUserDigest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      userId: 'u1',
      wsId: 'w1',
      appId: 'app1',
      clientDate: '2026-05-13',
    });
    expect(digest.recentPastSessions).toEqual([]);
  });
});

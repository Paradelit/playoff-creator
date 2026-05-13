import { describe, it, expect, vi } from 'vitest';
import { getCachedSummary, setCachedSummary } from '../cache';

/**
 * Minimal Firestore mock that supports the path used by cache.ts:
 *   artifacts/{appId}/users/{uid}/historySummaries/{summaryId}
 *
 * The cache layer reads/writes a single doc per (wsId, key). We mirror just
 * enough of the Admin SDK chainable surface to verify get/set behavior.
 */
function makeMockDb(initial: Record<string, Record<string, unknown>> = {}) {
  const store = new Map<string, Record<string, unknown>>(Object.entries(initial));
  const setSpy = vi.fn(async (path: string, data: Record<string, unknown>) => {
    store.set(path, data);
  });

  function doc(path: string) {
    return {
      get: vi.fn(async () => ({
        exists: store.has(path),
        data: () => store.get(path),
      })),
      set: vi.fn(async (data: Record<string, unknown>) => setSpy(path, data)),
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
    db: {
      collection: (root: string) => collection(root),
    },
    store,
    setSpy,
  };
}

const DEPS = { appId: 'app1', wsId: 'ws1', userId: 'u1' };

describe('history cache', () => {
  it('returns null when summary not cached', async () => {
    const { db } = makeMockDb();
    const result = await getCachedSummary({ db: db as never, ...DEPS }, 'conv1:5');
    expect(result).toBeNull();
  });

  it('returns cached summary text when present', async () => {
    const { db } = makeMockDb({
      'artifacts/app1/users/u1/historySummaries/ws1__conv1__5': {
        summary: 'resumen previo',
        createdAt: { toMillis: () => Date.now() },
      },
    });
    const result = await getCachedSummary({ db: db as never, ...DEPS }, 'conv1:5');
    expect(result).toBe('resumen previo');
  });

  it('setCachedSummary persists with createdAt field', async () => {
    const { db, store } = makeMockDb();
    await setCachedSummary({ db: db as never, ...DEPS }, 'conv1:5', 'nuevo');
    const written = store.get('artifacts/app1/users/u1/historySummaries/ws1__conv1__5');
    expect(written).toBeDefined();
    expect(written!.summary).toBe('nuevo');
    expect(written!.createdAt).toBeDefined();
  });

  it('scopes keys by wsId so different workspaces never share summaries', async () => {
    const { db, store } = makeMockDb();
    await setCachedSummary({ db: db as never, appId: 'app1', userId: 'u1', wsId: 'wsA' }, 'conv1:5', 'A');
    await setCachedSummary({ db: db as never, appId: 'app1', userId: 'u1', wsId: 'wsB' }, 'conv1:5', 'B');
    expect(store.get('artifacts/app1/users/u1/historySummaries/wsA__conv1__5')!.summary).toBe('A');
    expect(store.get('artifacts/app1/users/u1/historySummaries/wsB__conv1__5')!.summary).toBe('B');
  });
});

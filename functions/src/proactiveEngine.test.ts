import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Fake Firestore ───────────────────────────────────────────────────────────
// Mirrors the shape used in dataCleanup.test.ts but adapted to the operations
// proactiveEngine performs: collection().doc().collection() chains, where()
// filters, .limit(), and .set()/.get() on document refs.

type DocData = Record<string, unknown>;
type Filter = { field: string; op: string; value: unknown };

function getPathValue(data: DocData, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return (value as DocData)[segment];
  }, data);
}

function parentPath(path: string): string {
  return path.split('/').slice(0, -1).join('/');
}

function lastSegment(path: string): string {
  return path.split('/').at(-1) || '';
}

class FakeDocumentSnapshot {
  constructor(
    readonly ref: FakeDocumentReference,
    private readonly value: DocData | undefined,
  ) {}

  get exists(): boolean {
    return this.value !== undefined;
  }

  get id(): string {
    return lastSegment(this.ref.path);
  }

  data(): DocData | undefined {
    return this.value ? structuredClone(this.value) : undefined;
  }
}

class FakeQueryDocumentSnapshot extends FakeDocumentSnapshot {
  // Same surface but `data()` is guaranteed defined for query results.
}

class FakeQuerySnapshot {
  readonly size: number;
  readonly empty: boolean;

  constructor(readonly docs: FakeQueryDocumentSnapshot[]) {
    this.size = docs.length;
    this.empty = docs.length === 0;
  }
}

class FakeDocumentReference {
  constructor(
    private readonly db: FakeFirestore,
    readonly path: string,
  ) {}

  collection(name: string): FakeCollectionReference {
    return new FakeCollectionReference(this.db, `${this.path}/${name}`);
  }

  async get(): Promise<FakeDocumentSnapshot> {
    return new FakeDocumentSnapshot(this, this.db.read(this.path));
  }

  async set(value: DocData): Promise<void> {
    this.db.write(this.path, value);
  }
}

class FakeCollectionReference {
  constructor(
    private readonly db: FakeFirestore,
    readonly path: string,
  ) {}

  doc(id: string): FakeDocumentReference {
    return new FakeDocumentReference(this.db, `${this.path}/${id}`);
  }

  where(field: string, op: string, value: unknown): FakeQuery {
    return new FakeQuery(this.db, { collectionPath: this.path, filters: [{ field, op, value }], limit: undefined });
  }

  limit(n: number): FakeQuery {
    return new FakeQuery(this.db, { collectionPath: this.path, filters: [], limit: n });
  }

  async get(): Promise<FakeQuerySnapshot> {
    return new FakeQuery(this.db, { collectionPath: this.path, filters: [], limit: undefined }).get();
  }
}

class FakeQuery {
  constructor(
    private readonly db: FakeFirestore,
    private readonly config: { collectionPath: string; filters: Filter[]; limit: number | undefined },
  ) {}

  where(field: string, op: string, value: unknown): FakeQuery {
    return new FakeQuery(this.db, {
      ...this.config,
      filters: [...this.config.filters, { field, op, value }],
    });
  }

  limit(n: number): FakeQuery {
    return new FakeQuery(this.db, { ...this.config, limit: n });
  }

  async get(): Promise<FakeQuerySnapshot> {
    const matches = this.db.runQuery(this.config);
    const docs = matches.map(
      (path) => new FakeQueryDocumentSnapshot(new FakeDocumentReference(this.db, path), this.db.read(path)),
    );
    return new FakeQuerySnapshot(docs);
  }
}

class FakeFirestore {
  private readonly docs = new Map<string, DocData>();

  collection(name: string): FakeCollectionReference {
    return new FakeCollectionReference(this, name);
  }

  read(path: string): DocData | undefined {
    const data = this.docs.get(path);
    return data ? structuredClone(data) : undefined;
  }

  write(path: string, value: DocData): void {
    this.docs.set(path, structuredClone(value));
  }

  has(path: string): boolean {
    return this.docs.has(path);
  }

  runQuery(config: { collectionPath: string; filters: Filter[]; limit: number | undefined }): string[] {
    let results = [...this.docs.entries()]
      .filter(([path]) => parentPath(path) === config.collectionPath)
      .filter(([, data]) => this.matchesFilters(data, config.filters))
      .map(([path]) => path);

    if (typeof config.limit === 'number') {
      results = results.slice(0, config.limit);
    }
    return results;
  }

  private matchesFilters(data: DocData, filters: Filter[]): boolean {
    return filters.every((filter) => {
      const candidate = getPathValue(data, filter.field);
      if (filter.op === '==') return candidate === filter.value;
      if (filter.op === '>=') return String(candidate ?? '') >= String(filter.value ?? '');
      if (filter.op === '<=') return String(candidate ?? '') <= String(filter.value ?? '');
      throw new Error(`Unsupported operator in fake query: ${filter.op}`);
    });
  }
}

// ── Mocks ────────────────────────────────────────────────────────────────────
// `vi.hoisted` lets us share a single FakeFirestore instance between the mock
// factory (which is hoisted above imports) and the test bodies below.

const fakeState = vi.hoisted(() => ({
  db: null as FakeFirestore | null,
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => fakeState.db,
}));

vi.mock('./ai/llmProvider', () => ({
  LLMProvider: class {
    async generate<T>(): Promise<{ data: T }> {
      return { data: { message: 'Mock AI message' } as unknown as T };
    }
  },
}));

vi.mock('./ai/observability', () => ({
  ObservabilityService: class {
    async flush(): Promise<void> {}
    createTrace() {
      return { id: 'trace-1' };
    }
  },
}));

// Imported AFTER the mocks above so getFirestore() returns the fake.
import { runProactiveBriefing } from './proactiveEngine';

const APP_ID = 'app1';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

describe('runProactiveBriefing — workspace iteration', () => {
  beforeEach(() => {
    fakeState.db = new FakeFirestore();
  });

  it('iterates workspaces (not users) and writes notif with wsId field', async () => {
    const today = todayStr();
    const db = fakeState.db!;

    db.write(`artifacts/${APP_ID}/workspaces/ws1`, { type: 'personal', ownerId: 'user1' });
    db.write(`artifacts/${APP_ID}/workspaces/ws1/teams/t1`, { categoria: 'Cadete' });
    db.write(`artifacts/${APP_ID}/workspaces/ws1/calendarSessions/sess1`, {
      fecha: today,
      tipo: 'entrenamiento',
      teamId: 't1',
    });

    const result = await runProactiveBriefing('mock-api-key', APP_ID);

    expect(result.notifications).toBe(1);
    expect(result.errors).toBe(0);

    // Notif still lives under users/{uid}/proactiveNotifications and carries wsId.
    const notif = db.read(`artifacts/${APP_ID}/users/user1/proactiveNotifications/${today}-sess1`);
    expect(notif).toBeDefined();
    expect(notif).toMatchObject({
      type: 'training-tip',
      sessionId: 'sess1',
      wsId: 'ws1',
      teamId: 't1',
      read: false,
    });
  });

  it('skips workspaces with no teams and no recent sessions', async () => {
    const db = fakeState.db!;
    db.write(`artifacts/${APP_ID}/workspaces/ws-empty`, { type: 'personal', ownerId: 'user2' });
    // No teams, no sessions — workspace must be filtered out by the activity probe.

    const result = await runProactiveBriefing('mock-api-key', APP_ID);

    expect(result.notifications).toBe(0);
    expect(result.processed).toBe(0);
  });

  it('idempotent: re-run skips already-written notifs', async () => {
    const today = todayStr();
    const db = fakeState.db!;

    db.write(`artifacts/${APP_ID}/workspaces/ws1`, { type: 'personal', ownerId: 'user1' });
    db.write(`artifacts/${APP_ID}/workspaces/ws1/teams/t1`, {});
    db.write(`artifacts/${APP_ID}/workspaces/ws1/calendarSessions/sess1`, {
      fecha: today,
      tipo: 'partido',
      rival: 'Rojo',
    });
    db.write(`artifacts/${APP_ID}/users/user1/proactiveNotifications/${today}-sess1`, {
      message: 'pre-existing',
      type: 'match-reminder',
      wsId: 'ws1',
      sessionId: 'sess1',
      generatedAt: 'past',
      read: false,
    });

    const result = await runProactiveBriefing('mock-api-key', APP_ID);

    expect(result.skipped).toBe(1);
    expect(result.notifications).toBe(0);

    // Pre-existing notif is untouched (message stays 'pre-existing').
    const notif = db.read(`artifacts/${APP_ID}/users/user1/proactiveNotifications/${today}-sess1`);
    expect(notif).toMatchObject({ message: 'pre-existing' });
  });
});

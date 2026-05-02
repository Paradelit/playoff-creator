import { describe, expect, it } from 'vitest';
import { createReadTools } from '../readTools';
import type { ToolContext, ToolDefinition } from '../registry';
import type { Firestore, FieldPath } from 'firebase-admin/firestore';

// ─────────────────────────────────────────────────────────────────────────────
// FakeFirestore — copied from functions/src/dataCleanup.test.ts (lines 1-179).
// Duplicated intentionally per the plan: extract to a shared helper if a third
// test file in functions/ adopts this pattern.
// ─────────────────────────────────────────────────────────────────────────────

type DocData = Record<string, unknown>;
type Filter = { field: string | FieldPath; op: string; value: unknown };

function isDocumentIdField(field: string | FieldPath): field is FieldPath {
  return typeof field === 'object' && field !== null && field.constructor?.name === 'FieldPath';
}

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

  data(): DocData | undefined {
    return this.value ? structuredClone(this.value) : undefined;
  }

  get(path: string): unknown {
    return this.value ? getPathValue(this.value, path) : undefined;
  }
}

class FakeQueryDocumentSnapshot extends FakeDocumentSnapshot {
  get id(): string {
    return lastSegment(this.ref.path);
  }
}

class FakeQuerySnapshot {
  readonly size: number;

  constructor(readonly docs: FakeQueryDocumentSnapshot[]) {
    this.size = docs.length;
  }

  get empty(): boolean {
    return this.docs.length === 0;
  }
}

class FakeAggregateSnapshot {
  constructor(private readonly count: number) {}
  data(): { count: number } {
    return { count: this.count };
  }
}

class FakeAggregateQuery {
  constructor(private readonly query: FakeQuery) {}
  async get(): Promise<FakeAggregateSnapshot> {
    const snap = await this.query.get();
    return new FakeAggregateSnapshot(snap.size);
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

  async delete(): Promise<void> {
    this.db.delete(this.path);
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

  where(field: string | FieldPath, op: string, value: unknown): FakeQuery {
    return new FakeQuery(this.db, { collectionPath: this.path, filters: [{ field, op, value }] });
  }

  count(): FakeAggregateQuery {
    return new FakeAggregateQuery(new FakeQuery(this.db, { collectionPath: this.path, filters: [] }));
  }

  async get(): Promise<FakeQuerySnapshot> {
    return new FakeQuery(this.db, { collectionPath: this.path, filters: [] }).get();
  }
}

class FakeQuery {
  constructor(
    private readonly db: FakeFirestore,
    private readonly config: {
      collectionPath?: string;
      groupName?: string;
      filters: Filter[];
      orderField?: string;
    },
  ) {}

  where(field: string | FieldPath, op: string, value: unknown): FakeQuery {
    return new FakeQuery(this.db, {
      ...this.config,
      filters: [...this.config.filters, { field, op, value }],
    });
  }

  orderBy(field: string): FakeQuery {
    return new FakeQuery(this.db, { ...this.config, orderField: field });
  }

  async get(): Promise<FakeQuerySnapshot> {
    const matches = this.db.runQuery(this.config);
    return new FakeQuerySnapshot(
      matches.map(
        (path) =>
          new FakeQueryDocumentSnapshot(new FakeDocumentReference(this.db, path), this.db.read(path)),
      ),
    );
  }
}

class FakeFirestore {
  private readonly docs = new Map<string, DocData>();

  constructor(initialDocs: Array<[string, DocData]> = []) {
    initialDocs.forEach(([path, data]) => {
      this.docs.set(path, structuredClone(data));
    });
  }

  collection(name: string): FakeCollectionReference {
    return new FakeCollectionReference(this, name);
  }

  collectionGroup(name: string): FakeQuery {
    return new FakeQuery(this, { groupName: name, filters: [] });
  }

  doc(path: string): FakeDocumentReference {
    return new FakeDocumentReference(this, path);
  }

  async recursiveDelete(ref: { path: string }): Promise<void> {
    const prefix = `${ref.path}/`;
    for (const path of [...this.docs.keys()]) {
      if (path === ref.path || path.startsWith(prefix)) {
        this.docs.delete(path);
      }
    }
  }

  read(path: string): DocData | undefined {
    const data = this.docs.get(path);
    return data ? structuredClone(data) : undefined;
  }

  delete(path: string): void {
    this.docs.delete(path);
  }

  has(path: string): boolean {
    return this.docs.has(path);
  }

  runQuery(config: { collectionPath?: string; groupName?: string; filters: Filter[] }): string[] {
    return [...this.docs.entries()]
      .filter(([path]) => {
        if (config.collectionPath) return parentPath(path) === config.collectionPath;
        return path.split('/').slice(0, -1).at(-1) === config.groupName;
      })
      .filter(([path, data]) => this.matchesFilters(path, data, config.filters))
      .map(([path]) => path);
  }

  private matchesFilters(path: string, data: DocData, filters: Filter[]): boolean {
    return filters.every((filter) => {
      const candidate = isDocumentIdField(filter.field)
        ? lastSegment(path)
        : getPathValue(data, filter.field);
      if (filter.op === '==') return candidate === filter.value;
      if (filter.op === '>=') return String(candidate ?? '') >= String(filter.value ?? '');
      if (filter.op === '<=') return String(candidate ?? '') <= String(filter.value ?? '');
      throw new Error(`Unsupported operator in fake query: ${filter.op}`);
    });
  }
}

function makeDb(initialDocs: Array<[string, DocData]>): FakeFirestore {
  return new FakeFirestore(initialDocs);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const APP_ID = 'app1';
const WS_ID = 'ws1';
const USER_ID = 'user1';

function buildCtx(db: FakeFirestore): ToolContext {
  return {
    db: db as unknown as Firestore,
    userId: USER_ID,
    wsId: WS_ID,
    appId: APP_ID,
    defaults: {},
  };
}

function findTool(name: string): ToolDefinition {
  const tool = createReadTools().find((t) => t.name === name);
  if (!tool) throw new Error(`Tool not found in registry: ${name}`);
  return tool;
}

// ─────────────────────────────────────────────────────────────────────────────
// Smoke tests — verify each representative read tool reads from
// workspaces/{wsId}/... after the Commit 2 path swap.
// ─────────────────────────────────────────────────────────────────────────────

describe('readTools — workspace path coverage', () => {
  it('get_team reads from workspaces/{wsId}/teams/{teamId}', async () => {
    const db = makeDb([
      [`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/team-1`, { categoria: 'Cadete', nivel: 'A' }],
      [`artifacts/${APP_ID}/workspaces/${WS_ID}/teams/team-1/members/m1`, { tipo: 'jugador', nombre: 'Ana' }],
    ]);

    const result = await findTool('get_team').handler({ teamId: 'team-1' }, buildCtx(db));

    expect(result).toMatchObject({
      id: 'team-1',
      categoria: 'Cadete',
      nivel: 'A',
    });
  });

  it('get_bracket reads from workspaces/{wsId}/brackets/{bracketId}', async () => {
    const db = makeDb([
      [`artifacts/${APP_ID}/workspaces/${WS_ID}/brackets/br-1`, { name: 'Liga', teamId: 't1' }],
    ]);

    const result = await findTool('get_bracket').handler({ bracketId: 'br-1' }, buildCtx(db));

    expect(result).toMatchObject({ id: 'br-1', name: 'Liga' });
  });

  it('get_exercise reads from workspaces/{wsId}/exercises/{exerciseId}', async () => {
    const db = makeDb([
      [`artifacts/${APP_ID}/workspaces/${WS_ID}/exercises/e1`, { nombre: 'Calentamiento' }],
    ]);

    const result = await findTool('get_exercise').handler({ exerciseId: 'e1' }, buildCtx(db));

    expect(result).toMatchObject({ id: 'e1', nombre: 'Calentamiento' });
  });

  it('get_cuaderno_section reads from workspaces/{wsId}/teams/{teamId}/cuaderno/{section}', async () => {
    const db = makeDb([
      [
        `artifacts/${APP_ID}/workspaces/${WS_ID}/teams/t1/cuaderno/jugadores`,
        { rows: [{ nombre: 'Marta' }] },
      ],
    ]);

    const result = await findTool('get_cuaderno_section').handler(
      { teamId: 't1', section: 'jugadores' },
      buildCtx(db),
    );

    expect(result).toMatchObject({
      section: 'jugadores',
      rows: [{ nombre: 'Marta' }],
    });
  });

  it('read_scouting reads from workspaces/{wsId}/scoutings/{sessionId}', async () => {
    const db = makeDb([
      [`artifacts/${APP_ID}/workspaces/${WS_ID}/scoutings/s1`, { rival: 'Rojos', notas: 'Zona 2-3' }],
    ]);

    const ctx = { ...buildCtx(db), defaults: { sessionId: 's1' } };
    const result = await findTool('read_scouting').handler({}, ctx);

    expect(result).toMatchObject({ id: 's1', rival: 'Rojos' });
  });

  it('read_analysis reads from workspaces/{wsId}/analisis/{sessionId}', async () => {
    // Calendar-side coverage: read_analysis hits workspaces/{wsId}/analisis/{sessionId}
    // (the create-read-tools registry has no get_calendar_session — list_calendar_sessions
    //  uses the userCol helper which is out of scope for Commit 2). read_analysis is the
    //  closest representative that exercises a session-keyed swapped path (line 523).
    const db = makeDb([
      [`artifacts/${APP_ID}/workspaces/${WS_ID}/analisis/s1`, { foco: 'rebote', notas: 'Mejorar' }],
    ]);

    const ctx = { ...buildCtx(db), defaults: { sessionId: 's1' } };
    const result = await findTool('read_analysis').handler({}, ctx);

    expect(result).toMatchObject({ id: 's1', foco: 'rebote' });
  });
});

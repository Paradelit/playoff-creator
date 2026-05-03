import { describe, expect, it } from 'vitest';
import { cleanupUserData } from './dataCleanup';
import type { Firestore, FieldPath } from 'firebase-admin/firestore';

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

  async get(): Promise<FakeQuerySnapshot> {
    return new FakeQuery(this.db, { collectionPath: this.path, filters: [] }).get();
  }
}

class FakeQuery {
  constructor(
    private readonly db: FakeFirestore,
    private readonly config: { collectionPath?: string; groupName?: string; filters: Filter[] },
  ) {}

  where(field: string | FieldPath, op: string, value: unknown): FakeQuery {
    return new FakeQuery(this.db, {
      ...this.config,
      filters: [...this.config.filters, { field, op, value }],
    });
  }

  async get(): Promise<FakeQuerySnapshot> {
    const matches = this.db.runQuery(this.config);
    return new FakeQuerySnapshot(matches.map((path) => new FakeQueryDocumentSnapshot(new FakeDocumentReference(this.db, path), this.db.read(path))));
  }
}

class FakeFirestore {
  private readonly docs = new Map<string, DocData>();

  constructor(initialDocs: Array<[string, DocData]>) {
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
      const candidate = isDocumentIdField(filter.field) ? lastSegment(path) : getPathValue(data, filter.field);
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

describe('cleanupUserData', () => {
  it('deletes a team cascade including sessions, playoff artifacts and owned shared brackets', async () => {
    const db = makeDb([
      ['artifacts/app1/workspaces/ws1/teams/team-1', { categoria: 'Cadete' }],
      ['artifacts/app1/workspaces/ws1/teams/team-1/members/m1', { nombre: 'Ana' }],
      ['artifacts/app1/workspaces/ws1/teams/team-2', { categoria: 'Infantil' }],
      ['artifacts/app1/workspaces/ws1/calendarSessions/session-1', { teamId: 'team-1' }],
      ['artifacts/app1/workspaces/ws1/scoutings/session-1', { rival: 'Rojo' }],
      ['artifacts/app1/workspaces/ws1/analisis/session-1', { foco: 'rebote' }],
      ['artifacts/app1/workspaces/ws1/planillas/session-1', { jugadores: [] }],
      ['artifacts/app1/workspaces/ws1/scoutings/playoff-bracket-1-R1-M0-0', { rival: 'Azul' }],
      ['artifacts/app1/workspaces/ws1/analisis/playoff-bracket-1-R1-M0-0', { foco: 'cierre' }],
      ['artifacts/app1/workspaces/ws1/planillas/playoff-bracket-1-R1-M0-0', { jugadores: [] }],
      ['artifacts/app1/workspaces/ws1/brackets/bracket-1', { teamId: 'team-1', shareCode: 'SHARE1' }],
      ['artifacts/app1/shared/SHARE1', { shareConfig: { ownerId: 'u1' } }],
      ['artifacts/app1/shared/SHARE1/comments/c1', { text: 'hola' }],
      ['artifacts/app1/shared/SHARE2', { shareConfig: { ownerId: 'u2' } }],
      ['artifacts/app1/presence/SHARE1/members/u1', { active: true }],
      ['artifacts/app1/presence/SHARE2/members/u2', { active: true }],
    ]);

    const result = await cleanupUserData({
      db: db as unknown as Firestore,
      appId: 'app1',
      userId: 'u1',
      wsId: 'ws1',
      action: 'deleteTeam',
      teamId: 'team-1',
    });

    expect(result.deleted).toMatchObject({
      teams: 1,
      calendarSessions: 1,
      scoutings: 2,
      analisis: 2,
      planillas: 2,
      sharedRefs: 1,
      sharedBrackets: 1,
      presence: 1,
    });
    expect(db.has('artifacts/app1/workspaces/ws1/teams/team-1')).toBe(false);
    expect(db.has('artifacts/app1/workspaces/ws1/teams/team-1/members/m1')).toBe(false);
    expect(db.has('artifacts/app1/workspaces/ws1/calendarSessions/session-1')).toBe(false);
    expect(db.has('artifacts/app1/workspaces/ws1/scoutings/playoff-bracket-1-R1-M0-0')).toBe(false);
    expect(db.has('artifacts/app1/workspaces/ws1/brackets/bracket-1')).toBe(false);
    expect(db.has('artifacts/app1/shared/SHARE1')).toBe(false);
    expect(db.has('artifacts/app1/presence/SHARE1/members/u1')).toBe(false);
    expect(db.has('artifacts/app1/workspaces/ws1/teams/team-2')).toBe(true);
    expect(db.has('artifacts/app1/shared/SHARE2')).toBe(true);
  });

  it('deletes a bracket cascade including playoff artifacts and owned shared bracket', async () => {
    const db = makeDb([
      ['artifacts/app1/workspaces/ws1/brackets/bracket-1', { teamId: 'team-1', shareCode: 'SHARE1' }],
      ['artifacts/app1/workspaces/ws1/scoutings/playoff-bracket-1-R1-M0-0', { rival: 'Azul' }],
      ['artifacts/app1/workspaces/ws1/analisis/playoff-bracket-1-R1-M0-0', { foco: 'cierre' }],
      ['artifacts/app1/workspaces/ws1/planillas/playoff-bracket-1-R1-M0-0', { jugadores: [] }],
      ['artifacts/app1/shared/SHARE1', { shareConfig: { ownerId: 'u1' } }],
      ['artifacts/app1/presence/SHARE1/members/u1', { active: true }],
    ]);

    const result = await cleanupUserData({
      db: db as unknown as Firestore,
      appId: 'app1',
      userId: 'u1',
      wsId: 'ws1',
      action: 'deleteBracket',
      bracketId: 'bracket-1',
    });

    expect(result.deleted).toMatchObject({
      scoutings: 1,
      analisis: 1,
      planillas: 1,
      sharedRefs: 1,
      sharedBrackets: 1,
      presence: 1,
    });
    expect(db.has('artifacts/app1/workspaces/ws1/brackets/bracket-1')).toBe(false);
    expect(db.has('artifacts/app1/workspaces/ws1/scoutings/playoff-bracket-1-R1-M0-0')).toBe(false);
    expect(db.has('artifacts/app1/shared/SHARE1')).toBe(false);
    expect(db.has('artifacts/app1/presence/SHARE1/members/u1')).toBe(false);
  });

  it('deleteAllUserData removes user personal workspace + user-private data', async () => {
    const db = makeDb([
      ['artifacts/app1/workspaces/ws1', { type: 'personal', ownerId: 'u1' }],
      ['artifacts/app1/workspaces/ws1/teams/t1', { categoria: 'Cadete' }],
      ['artifacts/app1/workspaces/ws1/brackets/bracket-own', { shareCode: 'OWN1' }],
      ['artifacts/app1/users/u1/memberships/ws1', { role: 'owner' }],
      ['artifacts/app1/users/u1/profile/main', { nombre: 'Coach' }],
      ['artifacts/app1/users/u1/proactiveNotifications/n1', { message: 'X' }],
      ['artifacts/app1/users/u1/pickHistory/ws1/conversations/c1', { title: 'hola' }],
      ['artifacts/app1/shared/OWN1', { shareConfig: { ownerId: 'u1' } }],
      ['artifacts/app1/shared/FOREIGN1', { shareConfig: { ownerId: 'u2' } }],
      ['artifacts/app1/presence/OWN1/members/u1', { active: true }],
    ]);

    const result = await cleanupUserData({
      db: db as unknown as Firestore,
      appId: 'app1',
      userId: 'u1',
      action: 'deleteAllUserData',
    });

    expect(result.deleted).toMatchObject({
      users: 1,
      sharedBrackets: 1,
      presence: 1,
    });
    expect(db.has('artifacts/app1/workspaces/ws1')).toBe(false);
    expect(db.has('artifacts/app1/workspaces/ws1/teams/t1')).toBe(false);
    expect(db.has('artifacts/app1/workspaces/ws1/brackets/bracket-own')).toBe(false);
    expect(db.has('artifacts/app1/users/u1/profile/main')).toBe(false);
    expect(db.has('artifacts/app1/users/u1/proactiveNotifications/n1')).toBe(false);
    expect(db.has('artifacts/app1/users/u1/memberships/ws1')).toBe(false);
    expect(db.has('artifacts/app1/users/u1/pickHistory/ws1/conversations/c1')).toBe(false);
    expect(db.has('artifacts/app1/shared/OWN1')).toBe(false);
    expect(db.has('artifacts/app1/presence/OWN1/members/u1')).toBe(false);
    // Foreign shared artifacts survive
    expect(db.has('artifacts/app1/shared/FOREIGN1')).toBe(true);
  });

  it('deleteAllUserData leaves club workspaces standing, only removes user from members', async () => {
    const db = makeDb([
      ['artifacts/app1/workspaces/ws-club', { type: 'club', ownerId: 'u-other' }],
      ['artifacts/app1/workspaces/ws-club/members/u1', { role: 'coach' }],
      ['artifacts/app1/workspaces/ws-club/members/u-other', { role: 'owner' }],
      ['artifacts/app1/workspaces/ws-club/teams/t1', { categoria: 'Cadete' }],
      ['artifacts/app1/users/u1/memberships/ws-club', { role: 'coach' }],
      ['artifacts/app1/users/u1/profile/main', { nombre: 'Coach' }],
    ]);

    await cleanupUserData({
      db: db as unknown as Firestore,
      appId: 'app1',
      userId: 'u1',
      action: 'deleteAllUserData',
    });

    // Club survives
    expect(db.has('artifacts/app1/workspaces/ws-club')).toBe(true);
    expect(db.has('artifacts/app1/workspaces/ws-club/teams/t1')).toBe(true);
    expect(db.has('artifacts/app1/workspaces/ws-club/members/u-other')).toBe(true);
    // User's membership in the club is removed
    expect(db.has('artifacts/app1/workspaces/ws-club/members/u1')).toBe(false);
    // User-private data is gone
    expect(db.has('artifacts/app1/users/u1/profile/main')).toBe(false);
    expect(db.has('artifacts/app1/users/u1/memberships/ws-club')).toBe(false);
  });

  it('deletes a conversation recursively under pickHistory/{wsId}', async () => {
    const db = makeDb([
      ['artifacts/app1/users/u1/pickHistory/ws1/conversations/c1', { title: 'Plan partido' }],
      ['artifacts/app1/users/u1/pickHistory/ws1/conversations/c1/messages/m1', { role: 'user', content: 'hola' }],
      ['artifacts/app1/users/u1/pickHistory/ws1/conversations/c1/messages/m2', { role: 'assistant', content: 'ok' }],
    ]);

    const result = await cleanupUserData({
      db: db as unknown as Firestore,
      appId: 'app1',
      userId: 'u1',
      wsId: 'ws1',
      action: 'deleteConversation',
      conversationId: 'c1',
    });

    expect(result.deleted.conversations).toBe(1);
    expect(db.has('artifacts/app1/users/u1/pickHistory/ws1/conversations/c1')).toBe(false);
    expect(db.has('artifacts/app1/users/u1/pickHistory/ws1/conversations/c1/messages/m1')).toBe(false);
    expect(db.has('artifacts/app1/users/u1/pickHistory/ws1/conversations/c1/messages/m2')).toBe(false);
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

type DocData = Record<string, unknown>;

function lastSegment(path: string): string {
  return path.split("/").at(-1) || "";
}

function parentPath(path: string): string {
  return path.split("/").slice(0, -1).join("/");
}

function getPathValue(data: DocData, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    return (value as DocData)[segment];
  }, data);
}

interface Filter {
  field: string;
  op: string;
  value: unknown;
}

class FakeQuery {
  constructor(
    private readonly db: FakeFirestore,
    private readonly collectionPath: string,
    private readonly filters: Filter[],
    private readonly limitValue: number | null,
  ) {}

  where(field: string, op: string, value: unknown): FakeQuery {
    return new FakeQuery(
      this.db,
      this.collectionPath,
      [...this.filters, { field, op, value }],
      this.limitValue,
    );
  }

  limit(n: number): FakeQuery {
    return new FakeQuery(this.db, this.collectionPath, this.filters, n);
  }

  async get(): Promise<{ empty: boolean; docs: Array<{ id: string; data: () => DocData }> }> {
    const matches: Array<{ path: string; data: DocData }> = [];
    for (const [path, data] of this.db.docs.entries()) {
      if (parentPath(path) !== this.collectionPath) continue;
      const ok = this.filters.every((f) => {
        const candidate = getPathValue(data, f.field);
        if (f.op === "==") return candidate === f.value;
        throw new Error(`Unsupported op in fake query: ${f.op}`);
      });
      if (ok) matches.push({ path, data });
    }
    const sliced = this.limitValue == null ? matches : matches.slice(0, this.limitValue);
    return {
      empty: sliced.length === 0,
      docs: sliced.map((m) => ({ id: lastSegment(m.path), data: () => m.data })),
    };
  }
}

class FakeCollectionReference {
  constructor(
    private readonly db: FakeFirestore,
    private readonly path: string,
  ) {}

  doc(id?: string): { id: string; path: string } {
    const realId = id ?? `auto-${++this.db.autoIdCounter}`;
    return { id: realId, path: `${this.path}/${realId}` };
  }

  where(field: string, op: string, value: unknown): FakeQuery {
    return new FakeQuery(this.db, this.path, [{ field, op, value }], null);
  }
}

class FakeBatch {
  private readonly ops: Array<{ path: string; data: DocData }> = [];

  constructor(private readonly db: FakeFirestore) {}

  set(ref: { path: string }, data: DocData): FakeBatch {
    this.ops.push({ path: ref.path, data });
    return this;
  }

  async commit(): Promise<void> {
    for (const op of this.ops) {
      this.db.docs.set(op.path, structuredClone(op.data));
    }
  }
}

class FakeFirestore {
  readonly docs = new Map<string, DocData>();
  autoIdCounter = 0;

  collection(path: string): FakeCollectionReference {
    return new FakeCollectionReference(this, path);
  }

  doc(path: string): { path: string } {
    return { path };
  }

  batch(): FakeBatch {
    return new FakeBatch(this);
  }

  read(path: string): DocData | undefined {
    const data = this.docs.get(path);
    return data ? structuredClone(data) : undefined;
  }
}

let fakeDbInstance: FakeFirestore;

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => fakeDbInstance,
  FieldValue: {
    serverTimestamp: () => ({ __ts: "serverTimestamp" }),
  },
}));

import { bootstrapPersonalWorkspace } from "../onUserCreate";

const APP_ID = "app1";
const UID = "user-new";

beforeEach(() => {
  fakeDbInstance = new FakeFirestore();
});

describe("bootstrapPersonalWorkspace", () => {
  it("creates workspace + member + memberships cache atomically for new user", async () => {
    const result = await bootstrapPersonalWorkspace({ uid: UID }, APP_ID);

    expect(result.status).toBe("created");
    expect(result.wsId).toBeTruthy();

    const wsId = result.wsId;
    const wsDoc = fakeDbInstance.read(`artifacts/${APP_ID}/workspaces/${wsId}`);
    expect(wsDoc).toMatchObject({
      type: "personal",
      name: "Mi cuenta",
      ownerId: UID,
      plan: "free",
      planUpdatedAt: null,
      billing: null,
    });

    const memberDoc = fakeDbInstance.read(
      `artifacts/${APP_ID}/workspaces/${wsId}/members/${UID}`,
    );
    expect(memberDoc).toMatchObject({
      role: "owner",
      assignedTeamIds: [],
    });

    const cacheDoc = fakeDbInstance.read(
      `artifacts/${APP_ID}/users/${UID}/memberships/${wsId}`,
    );
    expect(cacheDoc).toMatchObject({
      role: "owner",
      workspaceName: "Mi cuenta",
      workspaceType: "personal",
    });
  });

  it("is idempotent: re-run returns skipped without creating duplicate", async () => {
    const first = await bootstrapPersonalWorkspace({ uid: UID }, APP_ID);
    const second = await bootstrapPersonalWorkspace({ uid: UID }, APP_ID);

    expect(first.status).toBe("created");
    expect(second.status).toBe("skipped");
    expect(second.wsId).toBe(first.wsId);

    // Only one workspace doc exists (filter out subcollection docs by path depth)
    const workspacePaths = Array.from(fakeDbInstance.docs.keys()).filter(
      (p) =>
        p.startsWith(`artifacts/${APP_ID}/workspaces/`) &&
        p.split("/").length === 4, // artifacts/{appId}/workspaces/{wsId} → 4 segments
    );
    expect(workspacePaths).toHaveLength(1);
  });
});

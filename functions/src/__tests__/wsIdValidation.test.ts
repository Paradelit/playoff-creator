import { describe, expect, it, vi, beforeEach } from "vitest";

// buildUserDigest is invoked inside aiChatHandler — stub it out so tests don't
// need to mock all the Firestore reads it would normally do. The orchestrator
// is also stubbed via the `fakeSystem` fixture below.
vi.mock("../ai/userDigest", () => ({
  buildUserDigest: vi.fn(async () => ({})),
  digestToPromptText: vi.fn(() => ""),
}));

import { aiChatHandler } from "../index";

type Mocked = ReturnType<typeof vi.fn>;

function makeFakeDb(memberExists: boolean) {
  // Member check returns exists flag, no data() needed.
  const memberGet: Mocked = vi.fn(async () => ({ exists: memberExists }));
  const memberRef = { get: memberGet };

  // Workspace plan lookup (assertWithinQuota) — returns a "pro" plan so quota is never exhausted.
  const wsGet: Mocked = vi.fn(async () => ({
    exists: true,
    data: () => ({ plan: "pro" }),
  }));
  const wsRef = { get: wsGet };

  // Usage doc (incrementUsage inside assertWithinQuota).
  const usageGet: Mocked = vi.fn(async () => ({ exists: false }));
  const usageRef = { get: usageGet };

  // The transaction mock: just run the callback synchronously with a fake tx.
  const fakeTx = {
    get: vi.fn(async () => ({ exists: false })),
    set: vi.fn(),
    update: vi.fn(),
  };
  const runTransaction: Mocked = vi.fn(async (cb) => cb(fakeTx));

  // Route doc() calls by path prefix.
  const doc: Mocked = vi.fn((path: string) => {
    if (path.includes("/members/")) return memberRef;
    if (path.includes("/usage/")) return usageRef;
    return wsRef; // workspace plan lookup
  });

  return {
    db: { doc, runTransaction } as unknown as Parameters<typeof aiChatHandler>[2],
    doc,
    memberGet,
    wsGet,
  };
}

function makeFakeSystem() {
  const flush = vi.fn(async () => {});
  const createTrace = vi.fn(() => ({ id: "trace-1" }));
  const run = vi.fn(async () => ({ blocks: [], _autoEvalMetrics: undefined }));
  const fakeSystem = {
    observability: { flush, createTrace, getLangfuseClient: () => null, logScore: () => {} },
    orchestrator: { run },
    agents: {},
  } as unknown as Parameters<typeof aiChatHandler>[1];
  return { fakeSystem, flush, createTrace, run };
}

describe("aiChat wsId validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws invalid-argument when wsId is missing", async () => {
    const { fakeSystem } = makeFakeSystem();
    const { db } = makeFakeDb(true);
    const request = {
      auth: { uid: "user1" },
      data: { message: "hi", appId: "app1" },
    };
    await expect(aiChatHandler(request, fakeSystem, db)).rejects.toMatchObject({
      code: "invalid-argument",
      message: expect.stringContaining("wsId"),
    });
  });

  it("throws permission-denied when user is not a member of wsId", async () => {
    const { fakeSystem } = makeFakeSystem();
    const { db, doc, memberGet } = makeFakeDb(false);
    const request = {
      auth: { uid: "user1" },
      data: { message: "hi", appId: "app1", wsId: "ws-other" },
    };
    await expect(aiChatHandler(request, fakeSystem, db)).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect(doc).toHaveBeenCalledWith(
      "artifacts/app1/workspaces/ws-other/members/user1"
    );
    expect(memberGet).toHaveBeenCalledTimes(1);
  });

  it("proceeds when wsId is provided and user is a member", async () => {
    const { fakeSystem, run } = makeFakeSystem();
    const { db } = makeFakeDb(true);
    const request = {
      auth: { uid: "user1" },
      data: { message: "hi", appId: "app1", wsId: "ws1" },
    };
    const result = await aiChatHandler(request, fakeSystem, db);
    expect(result).toMatchObject({ blocks: [], traceId: "trace-1" });
    expect(run).toHaveBeenCalledTimes(1);
    // Confirm the toolCtx passed to orchestrator.run carries wsId
    const firstCall = run.mock.calls[0] as unknown[] | undefined;
    const toolCtx = firstCall?.[1] as { wsId?: string } | undefined;
    expect(toolCtx?.wsId).toBe("ws1");
  });
});

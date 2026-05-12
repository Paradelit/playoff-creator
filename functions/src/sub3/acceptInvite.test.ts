import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

// syncClubSeatCount es side-effect post-commit; los tests del handler verifican
// la transacción de membership, no la sincronización de Stripe. Cobertura propia
// vive en syncClubSeatCount.test.ts.
vi.mock("../billing/syncClubSeatCount", () => ({
  syncClubSeatCount: vi.fn().mockResolvedValue(undefined),
}));

import { handleAcceptInvite } from "./acceptInvite";

const APP_ID = "app-test"; const WS_ID = "ws-1"; const INVITE_ID = "inv-1";

function tsFromMs(ms: number) {
  return { toMillis: () => ms } as unknown as Timestamp;
}

function makeDb(state: {
  invite?: Record<string, unknown> | null;
  workspace?: Record<string, unknown> | null;
  existingMember?: boolean;
}) {
  const ops: Array<{ kind: "set"|"delete"; path: string; data?: Record<string, unknown> }> = [];
  const docs: Record<string, { exists: boolean; data: () => Record<string, unknown> | undefined }> = {
    [`artifacts/${APP_ID}/workspaces/${WS_ID}/invites/${INVITE_ID}`]:
      state.invite ? { exists: true, data: () => state.invite! } : { exists: false, data: () => undefined },
    [`artifacts/${APP_ID}/workspaces/${WS_ID}`]:
      state.workspace ? { exists: true, data: () => state.workspace! } : { exists: false, data: () => undefined },
    [`artifacts/${APP_ID}/workspaces/${WS_ID}/members/uid-claimer`]:
      state.existingMember ? { exists: true, data: () => ({}) } : { exists: false, data: () => undefined },
  };
  const tx = {
    get: async (ref: { path: string }) => docs[ref.path] ?? { exists: false, data: () => undefined },
    set: (ref: { path: string }, data: Record<string, unknown>) => ops.push({ kind: "set", path: ref.path, data }),
    delete: (ref: { path: string }) => ops.push({ kind: "delete", path: ref.path }),
  };
  const db = {
    doc: (path: string) => ({ path }),
    runTransaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
  return { db: db as unknown as Parameters<typeof handleAcceptInvite>[0]["db"], ops };
}

const NOW_MS = 1_700_000_000_000;
beforeEach(() => vi.useFakeTimers().setSystemTime(NOW_MS));

describe("handleAcceptInvite", () => {
  it("not-found when invite missing", async () => {
    const { db } = makeDb({ invite: null, workspace: { name: "Club", type: "club" } });
    await expect(handleAcceptInvite({
      db, appId: APP_ID,
      auth: { uid: "uid-claimer", displayName: "Juan", email: "j@x.com" },
      data: { wsId: WS_ID, inviteId: INVITE_ID },
    })).rejects.toMatchObject({ code: "not-found" });
  });

  it("expired -> throws failed-precondition AND deletes invite oportunistically", async () => {
    const { db, ops } = makeDb({
      invite: { role: "coach", assignedTeamIds: ["team-A"], invitedBy: "uid-dt", inviteEmail: null,
                expiresAt: tsFromMs(NOW_MS - 1000) },
      workspace: { name: "Club", type: "club" },
    });
    await expect(handleAcceptInvite({
      db, appId: APP_ID,
      auth: { uid: "uid-claimer", displayName: "Juan", email: "j@x.com" },
      data: { wsId: WS_ID, inviteId: INVITE_ID },
    })).rejects.toMatchObject({ code: "failed-precondition" });
    expect(ops.find(o => o.kind === "delete" && o.path.endsWith(INVITE_ID))).toBeTruthy();
  });

  it("already-member when claimer already has membership", async () => {
    const { db } = makeDb({
      invite: { role: "coach", assignedTeamIds: ["team-A"], invitedBy: "uid-dt", inviteEmail: null,
                expiresAt: tsFromMs(NOW_MS + 60_000) },
      workspace: { name: "Club", type: "club" },
      existingMember: true,
    });
    await expect(handleAcceptInvite({
      db, appId: APP_ID,
      auth: { uid: "uid-claimer", displayName: "Juan", email: "j@x.com" },
      data: { wsId: WS_ID, inviteId: INVITE_ID },
    })).rejects.toMatchObject({ code: "already-exists" });
  });

  it("happy path: writes member + membership, deletes invite", async () => {
    const { db, ops } = makeDb({
      invite: { role: "coach", assignedTeamIds: ["team-A"], invitedBy: "uid-dt", inviteEmail: "j@x.com",
                expiresAt: tsFromMs(NOW_MS + 60_000) },
      workspace: { name: "Club", type: "club" },
    });
    const result = await handleAcceptInvite({
      db, appId: APP_ID,
      auth: { uid: "uid-claimer", displayName: "Juan", email: "j@x.com" },
      data: { wsId: WS_ID, inviteId: INVITE_ID },
    });
    expect(result).toEqual({ ok: true, wsId: WS_ID });
    expect(ops.filter(o => o.kind === "set")).toHaveLength(2);
    expect(ops.find(o => o.kind === "delete" && o.path.endsWith(INVITE_ID))).toBeTruthy();
    const member = ops.find(o => o.path.endsWith("/members/uid-claimer"))!;
    expect(member.data).toMatchObject({
      role: "coach", assignedTeamIds: ["team-A"],
      displayName: "Juan", email: "j@x.com",
      invitedBy: "uid-dt",
    });
    expect(member.data!.mismatchedEmailHint).toBeUndefined();
  });

  it("email mismatch lanza permission-denied (post sub-7 security batch)", async () => {
    // Pre-batch: el handler grababa un mismatchedEmailHint:true y dejaba pasar.
    // Eso convertía el invite en bearer-token (cualquiera con la URL aceptaba).
    // Ahora: si invite.inviteEmail está set y no coincide con auth.email, throw.
    const { db } = makeDb({
      invite: { role: "coach", assignedTeamIds: ["team-A"], invitedBy: "uid-dt",
                inviteEmail: "pepe@x.com", expiresAt: tsFromMs(NOW_MS + 60_000) },
      workspace: { name: "Club", type: "club" },
    });
    await expect(handleAcceptInvite({
      db, appId: APP_ID,
      auth: { uid: "uid-claimer", displayName: "Juan", email: "juan@x.com" },
      data: { wsId: WS_ID, inviteId: INVITE_ID },
    })).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("invite sin inviteEmail (link-share intencional) sigue aceptando cualquier auth", async () => {
    const { db, ops } = makeDb({
      invite: { role: "coach", assignedTeamIds: ["team-A"], invitedBy: "uid-dt",
                inviteEmail: null, expiresAt: tsFromMs(NOW_MS + 60_000) },
      workspace: { name: "Club", type: "club" },
    });
    await handleAcceptInvite({
      db, appId: APP_ID,
      auth: { uid: "uid-claimer", displayName: "Juan", email: "juan@x.com" },
      data: { wsId: WS_ID, inviteId: INVITE_ID },
    });
    const member = ops.find(o => o.path.endsWith("/members/uid-claimer"));
    expect(member).toBeDefined();
  });

  it("transaction atomicity: tx.set + tx.delete are queued, no direct writes", async () => {
    const { db, ops } = makeDb({
      invite: { role: "dt", assignedTeamIds: [], invitedBy: "uid-dt", inviteEmail: null,
                expiresAt: tsFromMs(NOW_MS + 60_000) },
      workspace: { name: "Club", type: "club" },
    });
    await handleAcceptInvite({
      db, appId: APP_ID,
      auth: { uid: "uid-claimer", displayName: "Juan", email: "j@x.com" },
      data: { wsId: WS_ID, inviteId: INVITE_ID },
    });
    expect(ops).toHaveLength(3);
  });
});

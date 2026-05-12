// functions/src/billing/syncClubSeatCount.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const stripeSubscriptionsRetrieve = vi.fn();
const stripeSubscriptionsUpdate = vi.fn();
vi.mock("./stripeClient", () => ({
  getStripe: () => ({
    subscriptions: {
      retrieve: stripeSubscriptionsRetrieve,
      update: stripeSubscriptionsUpdate,
    },
  }),
}));

import { syncClubSeatCount } from "./syncClubSeatCount";

function makeDb(state: {
  workspace?: Record<string, unknown> | null;
  memberCount?: number;
}) {
  const wsPath = `artifacts/app-1/workspaces/ws-1`;
  const membersPath = `artifacts/app-1/workspaces/ws-1/members`;
  const db = {
    doc: (path: string) => ({
      path,
      get: async () =>
        path === wsPath && state.workspace
          ? { exists: true, data: () => state.workspace }
          : { exists: false, data: () => undefined },
    }),
    collection: (path: string) => ({
      get: async () =>
        path === membersPath
          ? { size: state.memberCount ?? 0, docs: [] }
          : { size: 0, docs: [] },
    }),
  };
  return db;
}

beforeEach(() => {
  stripeSubscriptionsRetrieve.mockReset();
  stripeSubscriptionsUpdate.mockReset();
});

describe("syncClubSeatCount", () => {
  it("no-op si workspace no existe", async () => {
    const db = makeDb({ workspace: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await syncClubSeatCount(db as any, "app-1", "ws-1");
    expect(stripeSubscriptionsRetrieve).not.toHaveBeenCalled();
    expect(stripeSubscriptionsUpdate).not.toHaveBeenCalled();
  });

  it("no-op para workspace personal", async () => {
    const db = makeDb({
      workspace: {
        type: "personal",
        billing: { tier: "b2b", stripeSubscriptionId: "sub_x", status: "active" },
      },
      memberCount: 1,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await syncClubSeatCount(db as any, "app-1", "ws-1");
    expect(stripeSubscriptionsRetrieve).not.toHaveBeenCalled();
  });

  it("no-op para club free (sin tier B2B)", async () => {
    const db = makeDb({
      workspace: { type: "club", billing: null },
      memberCount: 5,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await syncClubSeatCount(db as any, "app-1", "ws-1");
    expect(stripeSubscriptionsRetrieve).not.toHaveBeenCalled();
  });

  it("no-op si status='canceled' o 'unpaid'", async () => {
    for (const status of ["canceled", "unpaid"]) {
      stripeSubscriptionsRetrieve.mockReset();
      const db = makeDb({
        workspace: {
          type: "club",
          billing: { tier: "b2b", stripeSubscriptionId: "sub_x", status },
        },
        memberCount: 3,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await syncClubSeatCount(db as any, "app-1", "ws-1");
      expect(stripeSubscriptionsRetrieve).not.toHaveBeenCalled();
    }
  });

  it("no-op si quantity en Stripe ya coincide con member count", async () => {
    const db = makeDb({
      workspace: {
        type: "club",
        billing: { tier: "b2b", stripeSubscriptionId: "sub_x", status: "active" },
      },
      memberCount: 4,
    });
    stripeSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ id: "si_1", quantity: 4 }] },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await syncClubSeatCount(db as any, "app-1", "ws-1");
    expect(stripeSubscriptionsRetrieve).toHaveBeenCalledOnce();
    expect(stripeSubscriptionsUpdate).not.toHaveBeenCalled();
  });

  it("actualiza quantity en Stripe cuando difiere de member count", async () => {
    const db = makeDb({
      workspace: {
        type: "club",
        billing: { tier: "b2b", stripeSubscriptionId: "sub_x", status: "active" },
      },
      memberCount: 5,
    });
    stripeSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ id: "si_1", quantity: 4 }] },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await syncClubSeatCount(db as any, "app-1", "ws-1");
    expect(stripeSubscriptionsUpdate).toHaveBeenCalledWith("sub_x", {
      items: [{ id: "si_1", quantity: 5 }],
      proration_behavior: "create_prorations",
    });
  });

  it("se traga errores de Stripe en lugar de propagarlos (best-effort)", async () => {
    const db = makeDb({
      workspace: {
        type: "club",
        billing: { tier: "b2b", stripeSubscriptionId: "sub_x", status: "active" },
      },
      memberCount: 5,
    });
    stripeSubscriptionsRetrieve.mockRejectedValue(new Error("Stripe is down"));
    // No debe throw:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(syncClubSeatCount(db as any, "app-1", "ws-1")).resolves.toBeUndefined();
  });

  it("no actualiza si memberCount = 0 (safety)", async () => {
    const db = makeDb({
      workspace: {
        type: "club",
        billing: { tier: "b2b", stripeSubscriptionId: "sub_x", status: "active" },
      },
      memberCount: 0,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await syncClubSeatCount(db as any, "app-1", "ws-1");
    expect(stripeSubscriptionsRetrieve).not.toHaveBeenCalled();
  });
});

// functions/src/billing/createClubSubscription.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const stripeCustomersCreate = vi.fn();
const stripeCheckoutCreate = vi.fn();
vi.mock("./stripeClient", () => ({
  getStripe: () => ({
    customers: { create: stripeCustomersCreate },
    checkout: { sessions: { create: stripeCheckoutCreate } },
  }),
  stripeSecretKey: { value: () => "sk_test_xxx" },
  stripePricePerSeat: { value: () => "price_per_seat_xxx" },
}));

import { handleCreateClubSubscription } from "./createClubSubscription";

function makeDb(state: {
  workspace?: Record<string, unknown> | null;
  members?: Array<{ uid: string }>;
}) {
  const updates: Record<string, Record<string, unknown>> = {};
  const wsPath = `artifacts/app-1/workspaces/ws-1`;
  const membersPath = `artifacts/app-1/workspaces/ws-1/members`;
  const db = {
    doc: (path: string) => ({
      path,
      get: async () =>
        path === wsPath && state.workspace
          ? { exists: true, data: () => state.workspace }
          : { exists: false, data: () => undefined },
      update: async (data: Record<string, unknown>) => {
        updates[path] = { ...(updates[path] ?? {}), ...data };
      },
    }),
    collection: (path: string) => ({
      get: async () =>
        path === membersPath
          ? { size: (state.members ?? []).length, docs: (state.members ?? []).map((m) => ({ id: m.uid })) }
          : { size: 0, docs: [] },
    }),
  };
  return { db, updates };
}

beforeEach(() => {
  stripeCustomersCreate.mockReset();
  stripeCheckoutCreate.mockReset();
  stripeCustomersCreate.mockResolvedValue({ id: "cus_new" });
  stripeCheckoutCreate.mockResolvedValue({ client_secret: "cs_secret_abc" });
});

describe("handleCreateClubSubscription", () => {
  it("inicia checkout B2B con quantity = members count y tier='b2b' en metadata", async () => {
    const { db, updates } = makeDb({
      workspace: { type: "club", ownerId: "uid-dt", name: "Mi Club", billing: null },
      members: [{ uid: "uid-dt" }, { uid: "uid-coach1" }, { uid: "uid-coach2" }],
    });
    const result = await handleCreateClubSubscription({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      auth: { uid: "uid-dt" },
      data: { wsId: "ws-1", appId: "app-1", priceId: "price_per_seat_xxx" },
    });
    expect(result).toEqual({ clientSecret: "cs_secret_abc", seatCount: 3 });
    expect(stripeCustomersCreate).toHaveBeenCalledOnce();
    expect(stripeCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_per_seat_xxx", quantity: 3 }],
        subscription_data: { metadata: { wsId: "ws-1", appId: "app-1", tier: "b2b" } },
      }),
    );
    expect(updates[`artifacts/app-1/workspaces/ws-1`]).toMatchObject({
      "billing.stripeCustomerId": "cus_new",
      "billing.tier": "b2b",
    });
  });

  it("reusa stripeCustomerId si workspace.billing.stripeCustomerId ya existe", async () => {
    const { db } = makeDb({
      workspace: {
        type: "club",
        ownerId: "uid-dt",
        billing: { stripeCustomerId: "cus_existing" },
      },
      members: [{ uid: "uid-dt" }],
    });
    await handleCreateClubSubscription({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      auth: { uid: "uid-dt" },
      data: { wsId: "ws-1", appId: "app-1", priceId: "price_per_seat_xxx" },
    });
    expect(stripeCustomersCreate).not.toHaveBeenCalled();
    expect(stripeCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing" }),
    );
  });

  it("rechaza si caller no es ownerId", async () => {
    const { db } = makeDb({
      workspace: { type: "club", ownerId: "uid-real-owner", billing: null },
      members: [{ uid: "uid-real-owner" }],
    });
    await expect(
      handleCreateClubSubscription({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        db: db as any,
        auth: { uid: "uid-imposter" },
        data: { wsId: "ws-1", appId: "app-1", priceId: "price_per_seat_xxx" },
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rechaza si workspace.type !== 'club'", async () => {
    const { db } = makeDb({
      workspace: { type: "personal", ownerId: "uid-1", billing: null },
      members: [{ uid: "uid-1" }],
    });
    await expect(
      handleCreateClubSubscription({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        db: db as any,
        auth: { uid: "uid-1" },
        data: { wsId: "ws-1", appId: "app-1", priceId: "price_per_seat_xxx" },
      }),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("rechaza priceId que no coincide con la allowlist", async () => {
    const { db } = makeDb({
      workspace: { type: "club", ownerId: "uid-dt", billing: null },
      members: [{ uid: "uid-dt" }],
    });
    await expect(
      handleCreateClubSubscription({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        db: db as any,
        auth: { uid: "uid-dt" },
        data: { wsId: "ws-1", appId: "app-1", priceId: "price_evil_1cent" },
      }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rechaza si workspace no existe", async () => {
    const { db } = makeDb({ workspace: null, members: [] });
    await expect(
      handleCreateClubSubscription({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        db: db as any,
        auth: { uid: "uid-dt" },
        data: { wsId: "ws-1", appId: "app-1", priceId: "price_per_seat_xxx" },
      }),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("falta de wsId/appId/priceId -> invalid-argument", async () => {
    const { db } = makeDb({ workspace: null });
    await expect(
      handleCreateClubSubscription({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        db: db as any,
        auth: { uid: "uid-dt" },
        data: { wsId: "", appId: "app-1", priceId: "price_per_seat_xxx" },
      }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });
});

// functions/src/billing/createCheckoutSession.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
import { handleCreateCheckoutSession } from "./createCheckoutSession";

const mockStripeCreate = vi.fn();
const mockCustomerCreate = vi.fn();

vi.mock("./stripeClient", () => ({
  getStripe: () => ({
    customers: { create: mockCustomerCreate },
    checkout: { sessions: { create: mockStripeCreate } },
  }),
  stripeSecretKey: {},
  stripePriceMonthly: { value: () => "price_monthly_test" },
  stripePriceAnnual: { value: () => "price_annual_test" },
}));

describe("handleCreateCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStripeCreate.mockResolvedValue({ client_secret: "cs_test_xyz" });
    mockCustomerCreate.mockResolvedValue({ id: "cus_new_xyz" });
  });

  it("creates customer when none exists, returns clientSecret, persists customerId", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const db = mockDb({ ownerId: "uid-1", billing: null }, update);
    const result = await handleCreateCheckoutSession({
      db,
      auth: { uid: "uid-1" },
      data: { wsId: "ws-1", appId: "app-1", priceId: "price_monthly_test" },
    });
    expect(result).toEqual({ clientSecret: "cs_test_xyz" });
    expect(mockCustomerCreate).toHaveBeenCalledWith({
      metadata: { wsId: "ws-1", appId: "app-1", uid: "uid-1" },
    });
    // Persisted customerId so we don't create dupes on the next call.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ "billing.stripeCustomerId": "cus_new_xyz" })
    );
  });

  it("reuses existing customer when billing.stripeCustomerId is set", async () => {
    const db = mockDb({
      ownerId: "uid-1",
      billing: { stripeCustomerId: "cus_existing", status: null },
    });
    await handleCreateCheckoutSession({
      db,
      auth: { uid: "uid-1" },
      data: { wsId: "ws-1", appId: "app-1", priceId: "price_monthly_test" },
    });
    expect(mockCustomerCreate).not.toHaveBeenCalled();
    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing" })
    );
  });

  it("passes subscription_data.metadata so webhook events resolve back to wsId", async () => {
    const db = mockDb({
      ownerId: "uid-1",
      billing: { stripeCustomerId: "cus_existing" },
    });
    await handleCreateCheckoutSession({
      db,
      auth: { uid: "uid-1" },
      data: { wsId: "ws-1", appId: "app-1", priceId: "price_annual_test" },
    });
    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_data: expect.objectContaining({
          metadata: { wsId: "ws-1", appId: "app-1" },
        }),
      })
    );
  });

  it("throws permission-denied when caller is not owner", async () => {
    const db = mockDb({ ownerId: "uid-1", billing: null });
    try {
      await handleCreateCheckoutSession({
        db,
        auth: { uid: "uid-2" },
        data: { wsId: "ws-1", appId: "app-1", priceId: "price_monthly_test" },
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpsError);
      expect((err as HttpsError).code).toBe("permission-denied");
    }
    expect(mockCustomerCreate).not.toHaveBeenCalled();
    expect(mockStripeCreate).not.toHaveBeenCalled();
  });

  it("throws not-found when workspace doesn't exist", async () => {
    const db = mockDb(null);
    await expect(
      handleCreateCheckoutSession({
        db,
        auth: { uid: "uid-1" },
        data: { wsId: "missing", appId: "app-1", priceId: "price_monthly_test" },
      })
    ).rejects.toThrow(/not found/i);
  });

  it("throws invalid-argument when priceId is not in allowlist", async () => {
    const db = mockDb({ ownerId: "uid-1", billing: null });
    await expect(
      handleCreateCheckoutSession({
        db,
        auth: { uid: "uid-1" },
        data: { wsId: "ws-1", appId: "app-1", priceId: "price_evil" },
      })
    ).rejects.toThrow(/invalid.*price/i);
    expect(mockCustomerCreate).not.toHaveBeenCalled();
  });

  it("throws invalid-argument when wsId or appId or priceId missing", async () => {
    const db = mockDb({ ownerId: "uid-1", billing: null });
    await expect(
      handleCreateCheckoutSession({
        db,
        auth: { uid: "uid-1" },
        data: { wsId: "", appId: "app-1", priceId: "price_monthly_test" },
      })
    ).rejects.toThrow(/missing/i);
  });
});

function mockDb(workspaceData: unknown, updateFn?: ReturnType<typeof vi.fn>) {
  const docMock = {
    get: vi.fn().mockResolvedValue({
      exists: workspaceData !== null,
      data: () => workspaceData,
    }),
    update: updateFn ?? vi.fn().mockResolvedValue(undefined),
  };
  return {
    doc: vi.fn().mockReturnValue(docMock),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

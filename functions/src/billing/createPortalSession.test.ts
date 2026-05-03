// functions/src/billing/createPortalSession.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
import { handleCreatePortalSession } from "./createPortalSession";

const mockPortalCreate = vi.fn();
vi.mock("./stripeClient", () => ({
  getStripe: () => ({ billingPortal: { sessions: { create: mockPortalCreate } } }),
  stripeSecretKey: {},
}));

describe("handleCreatePortalSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPortalCreate.mockResolvedValue({ url: "https://billing.stripe.com/p/session/abc" });
  });

  it("creates portal session for owner with existing customer", async () => {
    const db = mockDb({
      ownerId: "uid-1",
      billing: { stripeCustomerId: "cus_xyz" },
    });
    const result = await handleCreatePortalSession({
      db,
      auth: { uid: "uid-1" },
      data: { wsId: "ws-1", appId: "app-1", returnUrl: "https://app/home" },
    });
    expect(result).toEqual({ url: "https://billing.stripe.com/p/session/abc" });
    expect(mockPortalCreate).toHaveBeenCalledWith({
      customer: "cus_xyz",
      return_url: "https://app/home",
    });
  });

  it("throws failed-precondition when no Stripe customer", async () => {
    const db = mockDb({ ownerId: "uid-1", billing: null });
    try {
      await handleCreatePortalSession({
        db,
        auth: { uid: "uid-1" },
        data: { wsId: "ws-1", appId: "app-1", returnUrl: "https://app/home" },
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpsError);
      expect((err as HttpsError).code).toBe("failed-precondition");
    }
  });

  it("throws permission-denied when caller is not owner", async () => {
    const db = mockDb({
      ownerId: "uid-1",
      billing: { stripeCustomerId: "cus_xyz" },
    });
    try {
      await handleCreatePortalSession({
        db,
        auth: { uid: "uid-2" },
        data: { wsId: "ws-1", appId: "app-1", returnUrl: "https://app/home" },
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpsError);
      expect((err as HttpsError).code).toBe("permission-denied");
    }
    expect(mockPortalCreate).not.toHaveBeenCalled();
  });

  it("throws not-found when workspace doesn't exist", async () => {
    const db = mockDb(null);
    try {
      await handleCreatePortalSession({
        db,
        auth: { uid: "uid-1" },
        data: { wsId: "missing", appId: "app-1", returnUrl: "https://app/home" },
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpsError);
      expect((err as HttpsError).code).toBe("not-found");
    }
  });

  it("throws invalid-argument when args are missing", async () => {
    const db = mockDb({ ownerId: "uid-1", billing: { stripeCustomerId: "cus_xyz" } });
    try {
      await handleCreatePortalSession({
        db,
        auth: { uid: "uid-1" },
        data: { wsId: "ws-1", appId: "", returnUrl: "https://app/home" },
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpsError);
      expect((err as HttpsError).code).toBe("invalid-argument");
    }
  });
});

function mockDb(workspaceData: unknown) {
  return {
    doc: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({
        exists: workspaceData !== null,
        data: () => workspaceData,
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// functions/src/billing/handlers/checkoutCompleted.test.ts
import { describe, it, expect, vi } from "vitest";
import { handleCheckoutCompleted } from "./checkoutCompleted";

describe("handleCheckoutCompleted", () => {
  it("sets plan=pro and writes billing fields", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: "checkout.session.completed",
      id: "evt_1",
      data: {
        object: {
          metadata: { wsId: "ws-1", appId: "app-1" },
          customer: "cus_xyz",
          subscription: "sub_xyz",
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await handleCheckoutCompleted(db, event);

    expect(db.doc).toHaveBeenCalledWith("artifacts/app-1/workspaces/ws-1");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: "pro",
        "billing.stripeCustomerId": "cus_xyz",
        "billing.stripeSubscriptionId": "sub_xyz",
        "billing.status": "active",
      })
    );
  });

  it("sets billing.tier='b2b' when session metadata.tier='b2b'", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: "checkout.session.completed",
      id: "evt_b2b",
      data: {
        object: {
          metadata: { wsId: "ws-1", appId: "app-1", tier: "b2b" },
          customer: "cus_xyz",
          subscription: "sub_xyz",
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await handleCheckoutCompleted(db, event);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ "billing.tier": "b2b" }),
    );
  });

  it("defaults billing.tier='b2c' when metadata.tier is unset (legacy B2C checkouts)", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: "checkout.session.completed",
      id: "evt_b2c",
      data: {
        object: {
          metadata: { wsId: "ws-1", appId: "app-1" },
          customer: "cus_xyz",
          subscription: "sub_xyz",
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await handleCheckoutCompleted(db, event);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ "billing.tier": "b2c" }),
    );
  });

  it("does not write to Firestore when metadata.wsId is missing", async () => {
    const update = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: "checkout.session.completed",
      id: "evt_orphan",
      data: { object: { metadata: {}, customer: "cus_xyz" } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await handleCheckoutCompleted(db, event);

    expect(db.doc).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

// functions/src/billing/handlers/subscriptionUpdated.test.ts
import { describe, it, expect, vi } from "vitest";
import { handleSubscriptionUpdated } from "./subscriptionUpdated";

describe("handleSubscriptionUpdated", () => {
  it("updates billing.status, cancelAtPeriodEnd, currentPeriodEnd, priceId", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: "customer.subscription.updated",
      id: "evt_2",
      data: {
        object: {
          metadata: { wsId: "ws-1", appId: "app-1" },
          status: "active",
          cancel_at_period_end: true,
          current_period_end: 1735689600,
          items: { data: [{ price: { id: "price_pro_annual_xxx" } }] },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await handleSubscriptionUpdated(db, event);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        "billing.status": "active",
        "billing.cancelAtPeriodEnd": true,
        "billing.priceId": "price_pro_annual_xxx",
      })
    );
  });

  it("sets seatCount from items[0].quantity when tier='b2b'", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: "customer.subscription.updated",
      id: "evt_b2b_seat",
      data: {
        object: {
          metadata: { wsId: "ws-1", appId: "app-1", tier: "b2b" },
          status: "active",
          cancel_at_period_end: false,
          current_period_end: 1735689600,
          items: {
            data: [{ price: { id: "price_per_seat_xxx" }, quantity: 7 }],
          },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await handleSubscriptionUpdated(db, event);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        "billing.tier": "b2b",
        "billing.seatCount": 7,
      }),
    );
  });

  it("keeps seatCount=null when tier='b2c' even if Stripe item has quantity", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: "customer.subscription.updated",
      id: "evt_b2c_seat",
      data: {
        object: {
          metadata: { wsId: "ws-1", appId: "app-1" }, // tier ausente → default b2c
          status: "active",
          cancel_at_period_end: false,
          current_period_end: 1735689600,
          items: { data: [{ price: { id: "price_x" }, quantity: 1 }] },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await handleSubscriptionUpdated(db, event);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        "billing.tier": "b2c",
        "billing.seatCount": null,
      }),
    );
  });

  it("does not write when metadata is missing", async () => {
    const update = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: "customer.subscription.updated",
      id: "evt_orphan",
      data: { object: { metadata: {}, status: "active", items: { data: [] } } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await handleSubscriptionUpdated(db, event);
    expect(update).not.toHaveBeenCalled();
  });
});

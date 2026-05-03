// functions/src/billing/handlers/subscriptionDeleted.test.ts
import { describe, it, expect, vi } from "vitest";
import { handleSubscriptionDeleted } from "./subscriptionDeleted";

describe("handleSubscriptionDeleted", () => {
  it("downgrades plan to free and marks billing.status=canceled", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: "customer.subscription.deleted",
      id: "evt_3",
      data: { object: { metadata: { wsId: "ws-1", appId: "app-1" } } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await handleSubscriptionDeleted(db, event);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: "free",
        "billing.status": "canceled",
      })
    );
  });

  it("does not write when metadata is missing", async () => {
    const update = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: "customer.subscription.deleted",
      id: "evt_orphan",
      data: { object: { metadata: {} } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await handleSubscriptionDeleted(db, event);
    expect(update).not.toHaveBeenCalled();
  });
});

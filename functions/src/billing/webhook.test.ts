// functions/src/billing/webhook.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatchWebhook, type WebhookHandler } from "./webhook";

describe("dispatchWebhook", () => {
  let alreadyProcessed: boolean;
  let setMarker: ReturnType<typeof vi.fn>;
  let getMarker: ReturnType<typeof vi.fn>;
  let docFn: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  let calls: string[];
  let handlers: Record<string, WebhookHandler>;

  beforeEach(() => {
    alreadyProcessed = false;
    setMarker = vi.fn().mockResolvedValue(undefined);
    // Re-evaluate alreadyProcessed at .get() time so beforeEach mutations apply.
    getMarker = vi.fn().mockImplementation(() => Promise.resolve({ exists: alreadyProcessed }));
    docFn = vi.fn().mockReturnValue({ get: getMarker, set: setMarker });
    db = { doc: docFn };
    calls = [];
    handlers = {
      "checkout.session.completed": async () => {
        calls.push("checkoutCompleted");
      },
      "customer.subscription.updated": async () => {
        calls.push("subscriptionUpdated");
      },
    };
  });

  it("dispatches event to correct handler when not seen before", async () => {
    const event = {
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { metadata: { wsId: "ws-1" } } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await dispatchWebhook(db, "app-1", event, handlers);
    expect(calls).toEqual(["checkoutCompleted"]);
    expect(docFn).toHaveBeenCalledWith("artifacts/app-1/stripeEvents/evt_1");
    expect(setMarker).toHaveBeenCalledWith(
      expect.objectContaining({ type: "checkout.session.completed", wsId: "ws-1" })
    );
  });

  it("skips processing when event already in stripeEvents collection", async () => {
    alreadyProcessed = true;
    const event = {
      id: "evt_dup",
      type: "checkout.session.completed",
      data: { object: { metadata: {} } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await dispatchWebhook(db, "app-1", event, handlers);
    expect(calls).toEqual([]);
    expect(setMarker).not.toHaveBeenCalled();
  });

  it("ignores unknown event types but still records them as processed", async () => {
    const event = {
      id: "evt_unknown",
      type: "ping.unknown",
      data: { object: { metadata: {} } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await dispatchWebhook(db, "app-1", event, handlers);
    expect(calls).toEqual([]);
    expect(setMarker).toHaveBeenCalled();
  });

  it("does NOT mark event as processed when handler throws", async () => {
    const failingHandlers: Record<string, WebhookHandler> = {
      "checkout.session.completed": async () => {
        throw new Error("boom");
      },
    };
    const event = {
      id: "evt_fail",
      type: "checkout.session.completed",
      data: { object: { metadata: { wsId: "ws-1" } } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await expect(dispatchWebhook(db, "app-1", event, failingHandlers)).rejects.toThrow("boom");
    // Stripe must be allowed to retry — the marker write was suppressed.
    expect(setMarker).not.toHaveBeenCalled();
  });

  it("captures null wsId when event.data.object has no metadata", async () => {
    const event = {
      id: "evt_no_meta",
      type: "customer.subscription.updated",
      data: { object: {} },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await dispatchWebhook(db, "app-1", event, handlers);
    expect(setMarker).toHaveBeenCalledWith(expect.objectContaining({ wsId: null }));
  });
});

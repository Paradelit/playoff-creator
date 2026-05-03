// functions/src/billing/handlers/invoicePaymentSucceeded.test.ts
import { describe, it, expect, vi } from "vitest";
import { handleInvoicePaymentSucceeded } from "./invoicePaymentSucceeded";

describe("handleInvoicePaymentSucceeded", () => {
  it("reaffirms plan=pro and billing.status=active using top-level metadata", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: "invoice.payment_succeeded",
      id: "evt_4",
      data: { object: { metadata: { wsId: "ws-1", appId: "app-1" } } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await handleInvoicePaymentSucceeded(db, event);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: "pro",
        "billing.status": "active",
      })
    );
  });

  it("falls back to subscription_details.metadata when invoice metadata is empty", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: "invoice.payment_succeeded",
      id: "evt_4b",
      data: {
        object: {
          metadata: {},
          subscription_details: { metadata: { wsId: "ws-9", appId: "app-9" } },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await handleInvoicePaymentSucceeded(db, event);
    expect(db.doc).toHaveBeenCalledWith("artifacts/app-9/workspaces/ws-9");
  });

  it("does not write when neither metadata path resolves wsId", async () => {
    const update = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: "invoice.payment_succeeded",
      id: "evt_orphan",
      data: { object: { metadata: {} } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await handleInvoicePaymentSucceeded(db, event);
    expect(update).not.toHaveBeenCalled();
  });
});

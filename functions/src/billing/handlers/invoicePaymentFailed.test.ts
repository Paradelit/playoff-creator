// functions/src/billing/handlers/invoicePaymentFailed.test.ts
import { describe, it, expect, vi } from "vitest";
import { handleInvoicePaymentFailed } from "./invoicePaymentFailed";

describe("handleInvoicePaymentFailed", () => {
  it("sets billing.status=past_due but keeps plan=pro", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: "invoice.payment_failed",
      id: "evt_5",
      data: { object: { metadata: { wsId: "ws-1", appId: "app-1" } } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await handleInvoicePaymentFailed(db, event);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ "billing.status": "past_due" })
    );
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ plan: "free" }));
  });

  it("does not write when metadata is missing on both paths", async () => {
    const update = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = { doc: vi.fn().mockReturnValue({ update }) } as any;
    const event = {
      type: "invoice.payment_failed",
      id: "evt_orphan",
      data: { object: { metadata: {} } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await handleInvoicePaymentFailed(db, event);
    expect(update).not.toHaveBeenCalled();
  });
});

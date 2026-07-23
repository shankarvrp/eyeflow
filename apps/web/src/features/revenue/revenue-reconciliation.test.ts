import { describe, expect, it } from "vitest";
import { buildPatientMix, buildReconciliation } from "./revenue.server";

describe("collection reconciliation", () => {
  it("subtracts refunds and keeps manual collections separate", () => {
    expect(
      buildReconciliation(
        [
          { amount: "500.00", receiptType: "Bill", requiresReview: false },
          { amount: "80.00", receiptType: "Refund", requiresReview: true },
          { amount: "120.00", receiptType: "Unknown", requiresReview: true },
        ],
        [
          { amount: "500.00", discount: "0.00", emrReceiptId: "receipt-id" },
          { amount: "250.00", discount: "50.00", emrReceiptId: null },
        ],
      ),
    ).toEqual({
      importedGross: 700,
      importedNet: 420,
      manualNet: 200,
      refundTotal: 80,
      reviewLines: 1,
      sourceLines: 3,
    });
  });
});

describe("patient visit mix", () => {
  it("normalizes synchronized EMR visit types", () => {
    expect(
      buildPatientMix([
        { visitType: "New" },
        { visitType: "Re visit" },
        { visitType: "revisit" },
        { visitType: "Post OP" },
        { visitType: null },
      ]),
    ).toEqual({
      segments: [
        { count: 1, label: "New" },
        { count: 2, label: "Revisit" },
        { count: 1, label: "Post-op" },
        { count: 1, label: "Other" },
      ],
      total: 5,
    });
  });
});

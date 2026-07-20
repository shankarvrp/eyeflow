import { describe, expect, it } from "vitest";
import { mapEmrReceipt } from "./emr-receipt-mapping";

describe("mapEmrReceipt", () => {
  it("maps known departments and digital payment modes", () => {
    expect(
      mapEmrReceipt({
        paymentMode: "Google Pay",
        receiptType: "Bill",
        sourceDepartment: "Pharmacy",
      }),
    ).toEqual({
      department: "Pharmacy",
      mode: "online",
      providerOrMode: "Google Pay",
      requiresReview: false,
    });
  });

  it("maps surgery advances and IPD to OT", () => {
    expect(
      mapEmrReceipt({
        paymentMode: "Cash",
        receiptType: "Advance",
        remarks: "Surgery Advance",
        sourceDepartment: "OPD",
      }).department,
    ).toBe("OT");
  });

  it("flags unknown departments instead of guessing", () => {
    expect(
      mapEmrReceipt({
        paymentMode: "Cash",
        receiptType: "Bill",
        sourceDepartment: "Unmapped counter",
      }),
    ).toMatchObject({ department: null, requiresReview: true });
  });

  it("keeps refunds out of positive collection drafts", () => {
    expect(
      mapEmrReceipt({ paymentMode: "Cash", receiptType: "Refund", sourceDepartment: "Optical" }),
    ).toMatchObject({ department: null, requiresReview: true });
  });
});

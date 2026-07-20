import { describe, expect, it } from "vitest";
import { parseReceiptPage } from "./emr-receipt-parser";

describe("parseReceiptPage", () => {
  it("pairs a receipt row with its patient identifier line", () => {
    const row = (x: number, str: string, y = 477) => ({ str, x, y });
    const records = parseReceiptPage(
      [
        row(31, "1"),
        row(64, "09:48 am"),
        row(123, "Bill"),
        row(201, "Test Patient"),
        row(426, "MIR-INV-254334-01"),
        row(522, "Google Pay"),
        row(616, "-"),
        row(742, "OPD"),
        row(784, "300.00"),
        row(201, "MIR-PAT-116437", 465),
      ],
      "2026-07-18",
    );

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      amount: 300,
      externalPatientId: "MIR-PAT-116437",
      externalReceiptId: "MIR-INV-254334-01",
      patientName: "Test Patient",
      paymentMode: "Google Pay",
      receiptType: "Bill",
      sourceDepartment: "OPD",
    });
    expect(records[0]?.occurredAt.toISOString()).toBe("2026-07-18T04:18:00.000Z");
  });
});

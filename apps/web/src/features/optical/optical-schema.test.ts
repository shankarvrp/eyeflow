import { describe, expect, it } from "vitest";
import {
  opticalOrderStatuses,
  opticalOrderStatusLabels,
  updateOpticalOrderContactSchema,
  updateOpticalOrderSchema,
} from "./optical-schema";

describe("optical order workflow", () => {
  it("keeps every operational state in display order", () => {
    expect(opticalOrderStatuses.map((status) => opticalOrderStatusLabels[status])).toEqual([
      "Advanced",
      "Ordered",
      "Lens Arrived",
      "In Fitting",
      "Ready",
      "Delivered",
    ]);
  });

  it("rejects unsupported states", () => {
    expect(
      updateOpticalOrderSchema.safeParse({
        orderKey: "customer:1234:2026-07-24",
        status: "cancelled",
      }).success,
    ).toBe(false);
  });

  it("validates WhatsApp contact details without accepting arbitrary text", () => {
    expect(
      updateOpticalOrderContactSchema.safeParse({
        customerPhone: "+91 98765-43210",
        expectedDeliveryDate: "2026-08-15",
        orderKey: "customer:1234:2026-07-24",
      }).success,
    ).toBe(true);
    expect(
      updateOpticalOrderContactSchema.safeParse({
        customerPhone: "call reception",
        orderKey: "customer:1234:2026-07-24",
      }).success,
    ).toBe(false);
  });
});

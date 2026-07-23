import { describe, expect, it } from "vitest";
import {
  opticalOrderStatuses,
  opticalOrderStatusLabels,
  updateOpticalOrderSchema,
} from "./optical-schema";

describe("optical order workflow", () => {
  it("keeps every operational state in display order", () => {
    expect(opticalOrderStatuses.map((status) => opticalOrderStatusLabels[status])).toEqual([
      "Walk-In",
      "Advanced",
      "Ordered",
      "Lens Arrived",
      "Fitted",
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
});

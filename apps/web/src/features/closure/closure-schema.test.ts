import { describe, expect, it } from "vitest";
import { signOffCollectionSchema } from "./closure-schema";

describe("collection sign-off validation", () => {
  it("accepts a complete mid-day declaration", () => {
    expect(
      signOffCollectionSchema.safeParse({
        businessDate: "2026-07-22",
        declaredCash: 10_000,
        declaredCredit: 2_000,
        declaredDiscount: 500,
        declaredOnline: 5_000,
        note: "Cash drawer and terminals verified",
        period: "midday",
      }).success,
    ).toBe(true);
  });

  it("rejects negative declarations and unsupported periods", () => {
    expect(
      signOffCollectionSchema.safeParse({
        businessDate: "2026-07-22",
        declaredCash: -1,
        declaredCredit: 0,
        declaredDiscount: 0,
        declaredOnline: 0,
        note: "Invalid declaration",
        period: "night",
      }).success,
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { collectionSchema, toNewCollection } from "./collection-schema";

const validCollection = {
  amount: "1200",
  department: "OPD" as const,
  discount: "200",
  mode: "cash" as const,
  patient: "Anita Rao",
  providerOrMode: "",
};

describe("collection validation", () => {
  it("creates a typed transaction and calculates numeric values", () => {
    const result = toNewCollection(collectionSchema.parse(validCollection));
    expect(result).toMatchObject({ amount: 1200, discount: 200, providerOrMode: null });
  });

  it("rejects a discount greater than the amount", () => {
    const result = collectionSchema.safeParse({ ...validCollection, discount: "1201" });
    expect(result.success).toBe(false);
  });

  it("requires a provider for credit payments", () => {
    const result = collectionSchema.safeParse({ ...validCollection, mode: "credit" });
    expect(result.success).toBe(false);
  });
});

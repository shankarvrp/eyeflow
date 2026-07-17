import { describe, expect, it } from "vitest";
import {
  collectionBatchSchema,
  editCollectionSchema,
  emptyDepartmentCollection,
} from "./collection-schema";

describe("collectionBatchSchema", () => {
  it("accepts payments across several departments", () => {
    const result = collectionBatchSchema.safeParse({
      patient: "Anita Rao",
      departments: [
        { ...emptyDepartmentCollection("OPD"), cash: 500 },
        {
          ...emptyDepartmentCollection("Investigation"),
          online: 1200,
          onlineMode: "UPI",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("requires at least one payment", () => {
    const result = collectionBatchSchema.safeParse({
      patient: "Anita Rao",
      departments: [emptyDepartmentCollection("OPD")],
    });

    expect(result.success).toBe(false);
  });

  it("requires provider details for credit", () => {
    const result = collectionBatchSchema.safeParse({
      patient: "Anita Rao",
      departments: [{ ...emptyDepartmentCollection("OPD"), credit: 500 }],
    });

    expect(result.success).toBe(false);
  });
});

describe("editCollectionSchema", () => {
  it("does not allow discount above gross amount", () => {
    expect(
      editCollectionSchema.safeParse({
        amount: 100,
        discount: 200,
        id: "e75d2d85-58cf-4be2-8d1f-0de77f8519dc",
        providerOrMode: null,
      }).success,
    ).toBe(false);
  });
});

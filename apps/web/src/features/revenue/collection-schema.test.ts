import { describe, expect, it } from "vitest";
import {
  collectionBatchSchema,
  editCollectionSchema,
  patientWorkspaceUpdateSchema,
} from "./collection-schema";

describe("collectionBatchSchema", () => {
  it("accepts payments across several departments", () => {
    const result = collectionBatchSchema.safeParse({
      occurredOn: "2026-07-17",
      patient: "Anita Rao",
      payments: [
        { amount: 500, department: "OPD", discount: 0, mode: "cash", providerOrMode: null },
        {
          amount: 1200,
          department: "Investigation",
          discount: 0,
          mode: "online",
          providerOrMode: "UPI",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("requires at least one payment", () => {
    const result = collectionBatchSchema.safeParse({
      occurredOn: "2026-07-17",
      patient: "Anita Rao",
      payments: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects impossible collection dates", () => {
    const result = collectionBatchSchema.safeParse({
      occurredOn: "2026-02-31",
      patient: "Anita Rao",
      payments: [
        { amount: 500, department: "OPD", discount: 0, mode: "cash", providerOrMode: null },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("requires provider details for credit", () => {
    const result = collectionBatchSchema.safeParse({
      occurredOn: "2026-07-17",
      patient: "Anita Rao",
      payments: [
        {
          amount: 500,
          department: "OPD",
          discount: 0,
          mode: "credit",
          providerOrMode: null,
        },
      ],
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

describe("patientWorkspaceUpdateSchema", () => {
  it("accepts an atomic patient and multi-collection update", () => {
    const result = patientWorkspaceUpdateSchema.safeParse({
      collections: [
        {
          amount: 500,
          department: "OPD",
          discount: 50,
          id: "e75d2d85-58cf-4be2-8d1f-0de77f8519dc",
          mode: "cash",
          providerOrMode: null,
        },
        {
          amount: 1200,
          department: "Investigation",
          discount: 0,
          id: "97fa2dc9-46dd-4f93-8010-78dddb78db1d",
          mode: "online",
          providerOrMode: "UPI",
        },
      ],
      customerId: "56a9a5c2-e885-44a9-a77d-aabb7db984a3",
      newCollections: [],
      patient: "Anita Rao",
      reason: "Corrected payment entry",
    });

    expect(result.success).toBe(true);
  });

  it("rejects duplicate collection updates", () => {
    const collection = {
      amount: 500,
      department: "OPD",
      discount: 0,
      id: "e75d2d85-58cf-4be2-8d1f-0de77f8519dc",
      mode: "cash",
      providerOrMode: null,
    } as const;
    expect(
      patientWorkspaceUpdateSchema.safeParse({
        collections: [collection, collection],
        customerId: "56a9a5c2-e885-44a9-a77d-aabb7db984a3",
        newCollections: [],
        patient: "Anita Rao",
        reason: "Corrected payment entry",
      }).success,
    ).toBe(false);
  });

  it("accepts a new department payment from the patient workspace", () => {
    const result = patientWorkspaceUpdateSchema.safeParse({
      collections: [],
      customerId: "56a9a5c2-e885-44a9-a77d-aabb7db984a3",
      newCollections: [
        {
          amount: 1500,
          department: "Opticals",
          discount: 0,
          mode: "online",
          occurredOn: "2026-07-18",
          providerOrMode: "UPI",
        },
      ],
      patient: "Anita Rao",
      reason: "Added optical payment",
    });

    expect(result.success).toBe(true);
  });
});

import { departments } from "@eyeflow/shared";
import { describe, expect, it } from "vitest";
import {
  updateDepartmentTargetsSchema,
  updateRevenueTargetsSchema,
  updateUserAccessSchema,
} from "./administration-schema";

describe("administration access validation", () => {
  it("requires one permission record for every configured department", () => {
    const access = departments.map((department) => ({
      canCreate: true,
      canEditCurrent: true,
      canView: true,
      department,
    }));
    expect(
      updateUserAccessSchema.safeParse({
        access,
        reason: "Annual access review",
        role: "user",
        userId: "staff-id",
      }).success,
    ).toBe(true);
    expect(
      updateUserAccessSchema.safeParse({
        access: access.slice(1),
        reason: "Annual access review",
        role: "user",
        userId: "staff-id",
      }).success,
    ).toBe(false);
  });

  it("keeps clinic targets in ascending periods", () => {
    expect(
      updateRevenueTargetsSchema.safeParse({
        daily: 200_000,
        monthly: 5_000_000,
        reason: "Monthly planning review",
        weekly: 1_200_000,
      }).success,
    ).toBe(true);
    expect(
      updateRevenueTargetsSchema.safeParse({
        daily: 200_000,
        monthly: 500_000,
        reason: "Invalid target order",
        weekly: 1_200_000,
      }).success,
    ).toBe(false);
  });

  it("validates department targets and their audit reason", () => {
    expect(
      updateDepartmentTargetsSchema.safeParse({
        reason: "Department planning review",
        targets: [{ daily: 40_000, department: "OPD", monthly: 1_000_000, weekly: 240_000 }],
      }).success,
    ).toBe(true);
    expect(
      updateDepartmentTargetsSchema.safeParse({
        reason: "No",
        targets: [{ daily: 40_000, department: "OPD", monthly: 100_000, weekly: 240_000 }],
      }).success,
    ).toBe(false);
  });
});

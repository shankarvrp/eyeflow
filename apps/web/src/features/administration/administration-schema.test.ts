import { departments } from "@eyeflow/shared";
import { describe, expect, it } from "vitest";
import { updateUserAccessSchema } from "./administration-schema";

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
});

import { createServerFn } from "@tanstack/react-start";
import {
  isAdminRole,
  requireDepartmentPermission,
  requireRevenuePermission,
} from "../auth/auth.server";
import { assertCollectionDatesOpen } from "../closure/closure.server";
import { currentDayReportQuery } from "./operations-schema";
import { readOtSchedule, signOffOtPackagePayments, updateOtPackageAmount } from "./ot.server";
import { otScheduleQuerySchema, signOffOtPackageSchema, updateOtPackageSchema } from "./ot-schema";

function permissionForDate(businessDate: string): "edit-current" | "edit-history" {
  return businessDate === currentDayReportQuery().from ? "edit-current" : "edit-history";
}

export const getOtSchedule = createServerFn({ method: "GET" })
  .validator(otScheduleQuerySchema)
  .handler(async ({ data }) => {
    const session = await requireRevenuePermission("read");
    await requireDepartmentPermission(session.user.id, "OT", "view", session.user.role);
    return { session, schedule: await readOtSchedule(data.businessDate) };
  });

export const setOtPackageAmount = createServerFn({ method: "POST" })
  .validator(updateOtPackageSchema)
  .handler(async ({ data }) => {
    const session = await requireRevenuePermission("read");
    await requireDepartmentPermission(
      session.user.id,
      "OT",
      permissionForDate(data.businessDate),
      session.user.role,
    );
    await assertCollectionDatesOpen([data.businessDate]);
    return updateOtPackageAmount(
      data.caseId,
      data.businessDate,
      data.packageAmount,
      session.user.id,
    );
  });

export const signOffOtPackage = createServerFn({ method: "POST" })
  .validator(signOffOtPackageSchema)
  .handler(async ({ data }) => {
    const session = await requireRevenuePermission("read");
    await requireDepartmentPermission(
      session.user.id,
      "OT",
      permissionForDate(data.businessDate),
      session.user.role,
    );
    await assertCollectionDatesOpen([data.businessDate]);
    return signOffOtPackagePayments(
      data.businessDate,
      data.declaredAmount,
      data.note,
      session.user.id,
      isAdminRole(session.user.role) ? "admin" : "user",
    );
  });

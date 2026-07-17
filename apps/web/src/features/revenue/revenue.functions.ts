import { createServerFn } from "@tanstack/react-start";
import {
  getAccessibleDepartments,
  isAdminRole,
  requireDepartmentPermission,
  requireRevenuePermission,
} from "../auth/auth.server";
import { collectionBatchSchema, editCollectionSchema } from "./collection-schema";
import {
  findCollectionForAuthorization,
  insertCollectionBatch,
  isTodayInClinicTime,
  readDashboardData,
  updateCollection as updateCollectionRecord,
} from "./revenue.server";

export const getDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireRevenuePermission("read");
  const accessibleDepartments = await getAccessibleDepartments(session.user.id, session.user.role);
  return {
    dashboard: await readDashboardData(accessibleDepartments, isAdminRole(session.user.role)),
    session,
  };
});

export const createCollectionBatch = createServerFn({ method: "POST" })
  .validator(collectionBatchSchema)
  .handler(async ({ data }) => {
    const session = await requireRevenuePermission("create");
    const populatedDepartments = data.departments.filter(
      (department) => department.cash > 0 || department.credit > 0 || department.online > 0,
    );

    await Promise.all(
      populatedDepartments.map((department) =>
        requireDepartmentPermission(
          session.user.id,
          department.department,
          "create",
          session.user.role,
        ),
      ),
    );

    const accessibleDepartments = await getAccessibleDepartments(
      session.user.id,
      session.user.role,
    );
    return insertCollectionBatch(
      { ...data, departments: populatedDepartments },
      session.user.id,
      accessibleDepartments,
      isAdminRole(session.user.role),
    );
  });

export const updateCollection = createServerFn({ method: "POST" })
  .validator(editCollectionSchema)
  .handler(async ({ data }) => {
    const payment = await findCollectionForAuthorization(data.id);
    if (!payment) {
      throw new Response("Collection not found.", { status: 404 });
    }

    const action = isTodayInClinicTime(payment.occurredAt) ? "edit-current" : "edit-history";
    const session = await requireRevenuePermission(action);
    await requireDepartmentPermission(
      session.user.id,
      payment.department,
      action,
      session.user.role,
    );

    const accessibleDepartments = await getAccessibleDepartments(
      session.user.id,
      session.user.role,
    );
    return updateCollectionRecord(data, accessibleDepartments, isAdminRole(session.user.role));
  });

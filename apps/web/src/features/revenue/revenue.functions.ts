import { createServerFn } from "@tanstack/react-start";
import {
  getAccessibleDepartments,
  requireDepartmentPermission,
  requireRevenuePermission,
} from "../auth/auth.server";
import { newCollectionServerSchema } from "./collection-schema";
import { insertCollection, readDashboardData } from "./revenue.server";

export const getDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireRevenuePermission("read");
  const accessibleDepartments = await getAccessibleDepartments(session.user.id, session.user.role);
  return {
    dashboard: await readDashboardData(accessibleDepartments),
    session,
  };
});

export const createCollection = createServerFn({ method: "POST" })
  .validator(newCollectionServerSchema)
  .handler(async ({ data }) => {
    const session = await requireRevenuePermission("create");
    await requireDepartmentPermission(
      session.user.id,
      data.department,
      "create",
      session.user.role,
    );
    const accessibleDepartments = await getAccessibleDepartments(
      session.user.id,
      session.user.role,
    );
    return insertCollection(data, session.user.id, accessibleDepartments);
  });

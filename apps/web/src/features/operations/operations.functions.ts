import { createServerFn } from "@tanstack/react-start";
import {
  getAccessibleDepartments,
  isAdminRole,
  requireRevenuePermission,
} from "../auth/auth.server";
import { validateDashboardRange } from "../revenue/collection-query";
import { readPatientDirectory, readReportsData } from "./operations.server";
import { reportQuerySchema } from "./operations-schema";

export const getPatientDirectory = createServerFn({ method: "GET" })
  .validator(reportQuerySchema)
  .handler(async ({ data }) => {
    const session = await requireRevenuePermission("read");
    const isAdmin = isAdminRole(session.user.role);
    const validated = validateDashboardRange(
      { collectionPage: 1, pageSize: 50, patientPage: 1, ...data },
      isAdmin,
    );
    return {
      patients: await readPatientDirectory({ from: validated.from, to: validated.to }),
      session,
    };
  });

export const getReportsData = createServerFn({ method: "GET" })
  .validator(reportQuerySchema)
  .handler(async ({ data }) => {
    const session = await requireRevenuePermission("read");
    const isAdmin = isAdminRole(session.user.role);
    const validated = validateDashboardRange(
      { collectionPage: 1, pageSize: 50, patientPage: 1, ...data },
      isAdmin,
    );
    const accessibleDepartments = await getAccessibleDepartments(
      session.user.id,
      session.user.role,
    );
    return {
      reports: await readReportsData(
        { from: validated.from, to: validated.to },
        accessibleDepartments,
      ),
      session,
    };
  });

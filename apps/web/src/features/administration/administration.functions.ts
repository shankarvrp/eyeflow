import { createServerFn } from "@tanstack/react-start";
import { isAdminRole, requireSession } from "../auth/auth.server";
import {
  readAdministrationUsers,
  readDepartmentTargets,
  readRevenueTargets,
  updateAdministrationUser,
  updateDepartmentTargets,
  updateRevenueTargets,
} from "./administration.server";
import {
  updateDepartmentTargetsSchema,
  updateRevenueTargetsSchema,
  updateUserAccessSchema,
} from "./administration-schema";

async function requireAdministrator() {
  const session = await requireSession();
  if (!isAdminRole(session.user.role)) {
    throw new Response("Administration is restricted to administrators.", { status: 403 });
  }
  return session;
}

export const getAdministrationData = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireAdministrator();
  const [departmentTargets, targets, users] = await Promise.all([
    readDepartmentTargets(),
    readRevenueTargets(),
    readAdministrationUsers(),
  ]);
  return { departmentTargets, session, targets, users };
});

export const saveUserAccess = createServerFn({ method: "POST" })
  .validator(updateUserAccessSchema)
  .handler(async ({ data }) => {
    const session = await requireAdministrator();
    return updateAdministrationUser(data, session.user.id);
  });

export const saveRevenueTargets = createServerFn({ method: "POST" })
  .validator(updateRevenueTargetsSchema)
  .handler(async ({ data }) => {
    const session = await requireAdministrator();
    return updateRevenueTargets(data, session.user.id);
  });

export const saveDepartmentTargets = createServerFn({ method: "POST" })
  .validator(updateDepartmentTargetsSchema)
  .handler(async ({ data }) => {
    const session = await requireAdministrator();
    return updateDepartmentTargets(data, session.user.id);
  });

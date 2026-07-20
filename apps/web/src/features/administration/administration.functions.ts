import { createServerFn } from "@tanstack/react-start";
import { isAdminRole, requireSession } from "../auth/auth.server";
import {
  readAdministrationUsers,
  readRevenueTargets,
  updateAdministrationUser,
  updateRevenueTargets,
} from "./administration.server";
import { updateRevenueTargetsSchema, updateUserAccessSchema } from "./administration-schema";

async function requireAdministrator() {
  const session = await requireSession();
  if (!isAdminRole(session.user.role)) {
    throw new Response("Administration is restricted to administrators.", { status: 403 });
  }
  return session;
}

export const getAdministrationData = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireAdministrator();
  const [targets, users] = await Promise.all([readRevenueTargets(), readAdministrationUsers()]);
  return { session, targets, users };
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

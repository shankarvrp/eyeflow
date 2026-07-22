import { createServerFn } from "@tanstack/react-start";
import { getAccessibleDepartments, isAdminRole, requireSession } from "../auth/auth.server";
import { publishCollectionChanged } from "../revenue/collection-events.server";
import { closeBusinessDay, reopenBusinessDay, signOffCollectionPeriod } from "./closure.server";
import { closeDaySchema, reopenDaySchema, signOffCollectionSchema } from "./closure-schema";

async function requireAdministrator() {
  const session = await requireSession();
  if (!isAdminRole(session.user.role)) {
    throw new Response("Only administrators can close or reopen a business day.", { status: 403 });
  }
  return session;
}

export const closeDay = createServerFn({ method: "POST" })
  .validator(closeDaySchema)
  .handler(async ({ data }) => {
    const session = await requireAdministrator();
    const dashboard = await closeBusinessDay(data.businessDate, data.reason, session.user.id);
    publishCollectionChanged();
    return dashboard;
  });

export const reopenDay = createServerFn({ method: "POST" })
  .validator(reopenDaySchema)
  .handler(async ({ data }) => {
    const session = await requireAdministrator();
    const dashboard = await reopenBusinessDay(data.businessDate, data.reason, session.user.id);
    publishCollectionChanged();
    return dashboard;
  });

export const signOffCollection = createServerFn({ method: "POST" })
  .validator(signOffCollectionSchema)
  .handler(async ({ data }) => {
    const session = await requireSession();
    const signerRole = isAdminRole(session.user.role) ? "admin" : "user";
    const accessibleDepartments = await getAccessibleDepartments(
      session.user.id,
      session.user.role,
    );
    const dashboard = await signOffCollectionPeriod(
      data,
      session.user.id,
      signerRole,
      accessibleDepartments,
    );
    publishCollectionChanged();
    return dashboard;
  });

import { createServerFn } from "@tanstack/react-start";
import { isAdminRole, requireSession } from "../auth/auth.server";
import { publishCollectionChanged } from "../revenue/collection-events.server";
import { closeBusinessDay, reopenBusinessDay } from "./closure.server";
import { closeDaySchema, reopenDaySchema } from "./closure-schema";

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

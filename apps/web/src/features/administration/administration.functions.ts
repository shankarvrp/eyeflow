import { createServerFn } from "@tanstack/react-start";
import { isAdminRole, requireSession } from "../auth/auth.server";
import { readAdministrationUsers, updateAdministrationUser } from "./administration.server";
import { updateUserAccessSchema } from "./administration-schema";

async function requireAdministrator() {
  const session = await requireSession();
  if (!isAdminRole(session.user.role)) {
    throw new Response("Administration is restricted to administrators.", { status: 403 });
  }
  return session;
}

export const getAdministrationData = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireAdministrator();
  return { session, users: await readAdministrationUsers() };
});

export const saveUserAccess = createServerFn({ method: "POST" })
  .validator(updateUserAccessSchema)
  .handler(async ({ data }) => {
    const session = await requireAdministrator();
    return updateAdministrationUser(data, session.user.id);
  });

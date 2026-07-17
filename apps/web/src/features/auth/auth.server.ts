import { departments, userDepartmentAccess } from "@eyeflow/db/schema";
import { redirect } from "@tanstack/react-router";
import { getRequest, setResponseHeaders } from "@tanstack/react-start/server";
import { and, eq } from "drizzle-orm";
import { auth, authDatabase, type EyeFlowSession } from "../../lib/auth.server";

type RevenueAction = "create" | "edit-current" | "edit-history" | "read";
type RoleName = "admin" | "user";

function primaryRole(role: string | null | undefined): RoleName {
  const candidate = role?.split(",")[0];
  return candidate === "admin" ? "admin" : "user";
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role?.split(",").includes("admin") ?? false;
}

export async function getSession(): Promise<EyeFlowSession | null> {
  return auth.api.getSession({
    headers: getRequest().headers,
  });
}

export async function requireSession(): Promise<EyeFlowSession> {
  const session = await getSession();
  if (!session) {
    throw redirect({
      search: { redirect: getRequest().url },
      to: "/login",
    });
  }

  setResponseHeaders(
    new Headers({
      "Cache-Control": "no-store",
      Vary: "Cookie, Authorization",
    }),
  );
  return session;
}

export async function requireRevenuePermission(action: RevenueAction): Promise<EyeFlowSession> {
  const session = await requireSession();
  const permission = await auth.api.userHasPermission({
    body: {
      permissions: { revenue: [action] },
      role: primaryRole(session.user.role),
    },
  });

  if (!permission.success) {
    throw new Response("You do not have permission to perform this action.", { status: 403 });
  }

  return session;
}

export async function requireDepartmentPermission(
  userId: string,
  departmentName: string,
  action: "create" | "edit-current" | "edit-history" | "view",
  role: string | null | undefined,
): Promise<void> {
  if (isAdminRole(role)) return;

  const [access] = await authDatabase
    .select({
      canCreate: userDepartmentAccess.canCreate,
      canEditCurrent: userDepartmentAccess.canEditCurrent,
      canEditHistory: userDepartmentAccess.canEditHistory,
      canView: userDepartmentAccess.canView,
    })
    .from(userDepartmentAccess)
    .innerJoin(departments, eq(userDepartmentAccess.departmentId, departments.id))
    .where(and(eq(userDepartmentAccess.userId, userId), eq(departments.name, departmentName)))
    .limit(1);

  const allowed =
    action === "view"
      ? access?.canView
      : action === "create"
        ? access?.canCreate
        : action === "edit-current"
          ? access?.canEditCurrent
          : access?.canEditHistory;

  if (!allowed) {
    throw new Response(`Access to ${departmentName} is not permitted.`, { status: 403 });
  }
}

export async function getAccessibleDepartments(
  userId: string,
  role: string | null | undefined,
): Promise<string[] | null> {
  if (isAdminRole(role)) return null;

  const rows = await authDatabase
    .select({ name: departments.name })
    .from(userDepartmentAccess)
    .innerJoin(departments, eq(userDepartmentAccess.departmentId, departments.id))
    .where(
      and(
        eq(userDepartmentAccess.userId, userId),
        eq(userDepartmentAccess.canView, true),
        eq(departments.isActive, true),
      ),
    )
    .orderBy(departments.displayOrder);

  return rows.map((row) => row.name);
}

import { createDatabase } from "@eyeflow/db";
import { auditEvents, departments, user, userDepartmentAccess } from "@eyeflow/db/schema";
import type { DepartmentName } from "@eyeflow/shared";
import { asc, eq } from "drizzle-orm";
import type { UpdateUserAccess } from "./administration-schema";

let database: ReturnType<typeof createDatabase> | undefined;

function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for administration.");
  database ??= createDatabase(databaseUrl);
  return database;
}

export interface AdministrationUser {
  access: Array<{
    canCreate: boolean;
    canEditCurrent: boolean;
    canView: boolean;
    department: DepartmentName;
  }>;
  email: string;
  id: string;
  name: string;
  role: "admin" | "user";
}

export async function readAdministrationUsers(): Promise<AdministrationUser[]> {
  const db = getDatabase();
  const [users, accessRows, departmentRows] = await Promise.all([
    db
      .select({ email: user.email, id: user.id, name: user.name, role: user.role })
      .from(user)
      .orderBy(asc(user.name)),
    db
      .select({
        canCreate: userDepartmentAccess.canCreate,
        canEditCurrent: userDepartmentAccess.canEditCurrent,
        canView: userDepartmentAccess.canView,
        department: departments.name,
        userId: userDepartmentAccess.userId,
      })
      .from(userDepartmentAccess)
      .innerJoin(departments, eq(userDepartmentAccess.departmentId, departments.id)),
    db
      .select({ name: departments.name })
      .from(departments)
      .where(eq(departments.isActive, true))
      .orderBy(departments.displayOrder),
  ]);

  return users.map((entry) => ({
    access: departmentRows.map((department) => {
      const access = accessRows.find(
        (candidate) => candidate.userId === entry.id && candidate.department === department.name,
      );
      return {
        canCreate: access?.canCreate ?? false,
        canEditCurrent: access?.canEditCurrent ?? false,
        canView: access?.canView ?? false,
        department: department.name as DepartmentName,
      };
    }),
    email: entry.email,
    id: entry.id,
    name: entry.name,
    role: entry.role.split(",").includes("admin") ? "admin" : "user",
  }));
}

export async function updateAdministrationUser(
  input: UpdateUserAccess,
  actorUserId: string,
): Promise<AdministrationUser[]> {
  const db = getDatabase();
  const [target] = await db
    .select({ email: user.email, role: user.role })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1);
  if (!target) throw new Response("User not found.", { status: 404 });
  if (input.userId === actorUserId && input.role !== "admin") {
    throw new Response("You cannot remove your own administrator role.", { status: 409 });
  }
  const before = (await readAdministrationUsers()).find((entry) => entry.id === input.userId);

  await db.transaction(async (transaction) => {
    await transaction
      .update(user)
      .set({ role: input.role, updatedAt: new Date() })
      .where(eq(user.id, input.userId));

    const departmentRows = await transaction
      .select({ id: departments.id, name: departments.name })
      .from(departments);
    const departmentIds = new Map(departmentRows.map((entry) => [entry.name, entry.id]));
    for (const access of input.access) {
      const departmentId = departmentIds.get(access.department);
      if (!departmentId) throw new Error(`Unknown department: ${access.department}`);
      const canView = access.canView;
      await transaction
        .insert(userDepartmentAccess)
        .values({
          canCreate: canView && access.canCreate,
          canEditCurrent: canView && access.canEditCurrent,
          canEditHistory: false,
          canView,
          departmentId,
          userId: input.userId,
        })
        .onConflictDoUpdate({
          target: [userDepartmentAccess.userId, userDepartmentAccess.departmentId],
          set: {
            canCreate: canView && access.canCreate,
            canEditCurrent: canView && access.canEditCurrent,
            canEditHistory: false,
            canView,
            updatedAt: new Date(),
          },
        });
    }

    await transaction.insert(auditEvents).values({
      action: "administration.user-access.updated",
      actorUserId,
      after: input,
      before: before
        ? {
            access: before.access,
            email: before.email,
            id: before.id,
            name: before.name,
            role: before.role,
          }
        : { role: target.role },
      entityId: input.userId,
      entityType: "user",
      reason: input.reason,
    });
  });
  return readAdministrationUsers();
}

import { createDatabase } from "@eyeflow/db";
import {
  auditEvents,
  departments,
  departmentTargets,
  revenueTargets,
  user,
  userDepartmentAccess,
} from "@eyeflow/db/schema";
import type { DepartmentName } from "@eyeflow/shared";
import { asc, eq } from "drizzle-orm";
import type {
  UpdateDepartmentTargets,
  UpdateRevenueTargets,
  UpdateUserAccess,
} from "./administration-schema";

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

export interface RevenueTargetSettings {
  daily: number;
  monthly: number;
  weekly: number;
}

export interface DepartmentTargetSettings {
  daily: number;
  department: DepartmentName;
  monthly: number;
  weekly: number;
}

export async function readDepartmentTargets(): Promise<DepartmentTargetSettings[]> {
  const rows = await getDatabase()
    .select({
      daily: departmentTargets.dailyAmount,
      department: departments.name,
      monthly: departmentTargets.monthlyAmount,
      weekly: departmentTargets.weeklyAmount,
    })
    .from(departments)
    .leftJoin(departmentTargets, eq(departmentTargets.departmentId, departments.id))
    .where(eq(departments.isActive, true))
    .orderBy(departments.displayOrder);
  return rows.map((row) => ({
    daily: Number(row.daily ?? 0),
    department: row.department as DepartmentName,
    monthly: Number(row.monthly ?? 0),
    weekly: Number(row.weekly ?? 0),
  }));
}

export async function updateDepartmentTargets(
  input: UpdateDepartmentTargets,
  actorUserId: string,
): Promise<DepartmentTargetSettings[]> {
  const db = getDatabase();
  const before = await readDepartmentTargets();
  await db.transaction(async (transaction) => {
    const departmentRows = await transaction
      .select({ id: departments.id, name: departments.name })
      .from(departments);
    const departmentIds = new Map(departmentRows.map((entry) => [entry.name, entry.id]));
    for (const target of input.targets) {
      const departmentId = departmentIds.get(target.department);
      if (!departmentId) throw new Error(`Unknown department: ${target.department}`);
      await transaction
        .insert(departmentTargets)
        .values({
          dailyAmount: target.daily.toFixed(2),
          departmentId,
          monthlyAmount: target.monthly.toFixed(2),
          updatedByUserId: actorUserId,
          weeklyAmount: target.weekly.toFixed(2),
        })
        .onConflictDoUpdate({
          target: departmentTargets.departmentId,
          set: {
            dailyAmount: target.daily.toFixed(2),
            monthlyAmount: target.monthly.toFixed(2),
            updatedAt: new Date(),
            updatedByUserId: actorUserId,
            weeklyAmount: target.weekly.toFixed(2),
          },
        });
    }
    await transaction.insert(auditEvents).values({
      action: "administration.department-targets.updated",
      actorUserId,
      after: { targets: input.targets },
      before: { targets: before },
      entityId: "clinic",
      entityType: "department-targets",
      reason: input.reason,
    });
  });
  return readDepartmentTargets();
}

export async function readRevenueTargets(): Promise<RevenueTargetSettings> {
  const db = getDatabase();
  const [targets] = await db
    .select({
      daily: revenueTargets.dailyAmount,
      monthly: revenueTargets.monthlyAmount,
      weekly: revenueTargets.weeklyAmount,
    })
    .from(revenueTargets)
    .where(eq(revenueTargets.id, "clinic"))
    .limit(1);
  return {
    daily: Number(targets?.daily ?? 200_000),
    monthly: Number(targets?.monthly ?? 5_000_000),
    weekly: Number(targets?.weekly ?? 1_200_000),
  };
}

export async function updateRevenueTargets(
  input: UpdateRevenueTargets,
  actorUserId: string,
): Promise<RevenueTargetSettings> {
  const db = getDatabase();
  const before = await readRevenueTargets();
  const after = { daily: input.daily, monthly: input.monthly, weekly: input.weekly };
  await db.transaction(async (transaction) => {
    await transaction
      .insert(revenueTargets)
      .values({
        dailyAmount: input.daily.toFixed(2),
        id: "clinic",
        monthlyAmount: input.monthly.toFixed(2),
        updatedByUserId: actorUserId,
        weeklyAmount: input.weekly.toFixed(2),
      })
      .onConflictDoUpdate({
        target: revenueTargets.id,
        set: {
          dailyAmount: input.daily.toFixed(2),
          monthlyAmount: input.monthly.toFixed(2),
          updatedAt: new Date(),
          updatedByUserId: actorUserId,
          weeklyAmount: input.weekly.toFixed(2),
        },
      });
    await transaction.insert(auditEvents).values({
      action: "administration.revenue-targets.updated",
      actorUserId,
      after: { daily: after.daily, monthly: after.monthly, weekly: after.weekly },
      before: { daily: before.daily, monthly: before.monthly, weekly: before.weekly },
      entityId: "clinic",
      entityType: "revenue-targets",
      reason: input.reason,
    });
  });
  return after;
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

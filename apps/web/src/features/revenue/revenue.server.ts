import { createDatabase } from "@eyeflow/db";
import { auditEvents, customers, departments, payments } from "@eyeflow/db/schema";
import { desc, eq, ilike, inArray } from "drizzle-orm";
import type {
  DashboardData,
  DepartmentSummary,
  PatientCollectionSummary,
  RecentCollection,
} from "../dashboard/dashboard-data";
import {
  type EditCollection,
  type NewCollectionBatch,
  type PatientWorkspaceUpdate,
  paymentModeLabels,
} from "./collection-schema";

let database: ReturnType<typeof createDatabase> | undefined;

function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to use EyeFlow revenue persistence.");
  }
  database ??= createDatabase(databaseUrl);
  return database;
}

export async function readDashboardData(
  accessibleDepartmentNames: string[] | null = null,
  isAdmin = false,
): Promise<DashboardData> {
  const db = getDatabase();
  const paymentQuery = db
    .select({
      amount: payments.amount,
      customerId: customers.id,
      department: departments.name,
      discount: payments.discount,
      id: payments.id,
      kind: payments.kind,
      occurredAt: payments.occurredAt,
      patient: customers.name,
      providerOrMode: payments.providerOrMode,
    })
    .from(payments)
    .innerJoin(customers, eq(payments.customerId, customers.id))
    .innerJoin(departments, eq(payments.departmentId, departments.id));

  const paymentRows =
    accessibleDepartmentNames === null
      ? await paymentQuery.orderBy(desc(payments.occurredAt))
      : accessibleDepartmentNames.length === 0
        ? []
        : await paymentQuery
            .where(inArray(departments.name, accessibleDepartmentNames))
            .orderBy(desc(payments.occurredAt));

  const departmentQuery = db.select({ name: departments.name }).from(departments);
  const departmentRows =
    accessibleDepartmentNames === null
      ? await departmentQuery
          .where(eq(departments.isActive, true))
          .orderBy(departments.displayOrder)
      : accessibleDepartmentNames.length === 0
        ? []
        : await departmentQuery
            .where(inArray(departments.name, accessibleDepartmentNames))
            .orderBy(departments.displayOrder);

  const todayKey = dateKey(new Date());
  const weekStartKey = startOfWeekKey(new Date());
  const monthKey = todayKey.slice(0, 7);
  const todayRows = paymentRows.filter((payment) => dateKey(payment.occurredAt) === todayKey);
  const weeklyRows = paymentRows.filter((payment) => dateKey(payment.occurredAt) >= weekStartKey);
  const monthlyRows = paymentRows.filter((payment) =>
    dateKey(payment.occurredAt).startsWith(monthKey),
  );

  const totals = {
    cash: 0,
    credit: 0,
    discount: 0,
    online: 0,
    revenue: 0,
  };
  const departmentAmounts = new Map<string, number>();
  const patientIds = new Set<string>();

  for (const payment of todayRows) {
    const grossAmount = Number(payment.amount);
    const discount = Number(payment.discount);
    const netAmount = grossAmount - discount;
    totals[payment.kind] += netAmount;
    totals.discount += discount;
    totals.revenue += netAmount;
    patientIds.add(payment.customerId);
    departmentAmounts.set(
      payment.department,
      (departmentAmounts.get(payment.department) ?? 0) + netAmount,
    );
  }

  const colors = ["blue", "cyan", "green", "orange", "purple"] as const;
  const departmentSummaries: DepartmentSummary[] = departmentRows.map((department, index) => ({
    amount: departmentAmounts.get(department.name) ?? 0,
    change: 0,
    color: colors[index % colors.length] ?? "blue",
    name: department.name as DepartmentSummary["name"],
  }));

  const toRecentCollection = (payment: (typeof paymentRows)[number]): RecentCollection => ({
    amount: Number(payment.amount) - Number(payment.discount),
    canEdit: isAdmin || dateKey(payment.occurredAt) === todayKey,
    department: payment.department as RecentCollection["department"],
    discount: Number(payment.discount),
    id: payment.id,
    mode: paymentModeLabels[payment.kind],
    occurredAt: payment.occurredAt.toISOString(),
    patient: payment.patient,
    providerOrMode: payment.providerOrMode,
    time: payment.occurredAt.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  });
  const recentCollections = paymentRows.slice(0, 10).map(toRecentCollection);

  const patientGroups = new Map<string, PatientCollectionSummary>();
  for (const payment of paymentRows) {
    let group = patientGroups.get(payment.customerId);
    if (!group) {
      group = {
        canEdit: false,
        collections: [],
        customerId: payment.customerId,
        departments: [],
        lastCollectionAt: payment.occurredAt.toISOString(),
        patient: payment.patient,
        total: 0,
      };
      patientGroups.set(payment.customerId, group);
    }

    const collection = toRecentCollection(payment);
    group.collections.push(collection);
    group.canEdit ||= collection.canEdit;
    group.total += collection.amount;
    if (!group.departments.includes(collection.department)) {
      group.departments.push(collection.department);
    }
  }

  return {
    departments: departmentSummaries,
    patientCollections: [...patientGroups.values()],
    recentCollections,
    summary: {
      ...totals,
      patients: patientIds.size,
      transactions: todayRows.length,
    },
    targets: {
      daily: targetProgress("Daily", netRevenue(todayRows), 200_000),
      ...(isAdmin
        ? {
            monthly: targetProgress("Monthly", netRevenue(monthlyRows), 5_000_000),
            weekly: targetProgress("Weekly", netRevenue(weeklyRows), 1_200_000),
          }
        : {}),
    },
  };
}

export async function insertCollectionBatch(
  collection: NewCollectionBatch,
  actorUserId: string,
  accessibleDepartmentNames: string[] | null,
  isAdmin: boolean,
): Promise<DashboardData> {
  const db = getDatabase();

  await db.transaction(async (transaction) => {
    const [existingCustomer] = await transaction
      .select({ id: customers.id })
      .from(customers)
      .where(ilike(customers.name, collection.patient))
      .limit(1);

    const customerId =
      existingCustomer?.id ??
      (
        await transaction
          .insert(customers)
          .values({ name: collection.patient })
          .returning({ id: customers.id })
      )[0]?.id;

    if (!customerId) throw new Error("Unable to create or find the patient.");

    const departmentRows = await transaction
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(
        inArray(
          departments.name,
          collection.departments.map((entry) => entry.department),
        ),
      );
    const departmentIds = new Map(
      departmentRows.map((department) => [department.name, department.id]),
    );

    for (const entry of collection.departments) {
      const departmentId = departmentIds.get(entry.department);
      if (!departmentId) throw new Error(`Department is not configured: ${entry.department}`);

      const entries = [
        { amount: entry.cash, kind: "cash" as const, providerOrMode: null },
        {
          amount: entry.credit,
          kind: "credit" as const,
          providerOrMode: entry.creditProvider,
        },
        {
          amount: entry.online,
          kind: "online" as const,
          providerOrMode: entry.onlineMode,
        },
      ].filter((payment) => payment.amount > 0);

      let remainingDiscount = entry.discount;
      for (const payment of entries) {
        const paymentDiscount = Math.min(payment.amount, remainingDiscount);
        remainingDiscount -= paymentDiscount;
        await transaction.insert(payments).values({
          amount: payment.amount.toFixed(2),
          customerId,
          departmentId,
          discount: paymentDiscount.toFixed(2),
          kind: payment.kind,
          providerOrMode: payment.providerOrMode,
          createdByUserId: actorUserId,
        });
      }
    }
  });

  return readDashboardData(accessibleDepartmentNames, isAdmin);
}

export async function updateCollection(
  collection: EditCollection,
  accessibleDepartmentNames: string[] | null,
  isAdmin: boolean,
): Promise<DashboardData> {
  const db = getDatabase();
  await db
    .update(payments)
    .set({
      amount: collection.amount.toFixed(2),
      discount: collection.discount.toFixed(2),
      providerOrMode: collection.providerOrMode,
      updatedAt: new Date(),
    })
    .where(eq(payments.id, collection.id));

  return readDashboardData(accessibleDepartmentNames, isAdmin);
}

export async function updatePatientWorkspace(
  workspace: PatientWorkspaceUpdate,
  actorUserId: string,
  accessibleDepartmentNames: string[] | null,
  isAdmin: boolean,
): Promise<DashboardData> {
  const db = getDatabase();
  await db.transaction(async (transaction) => {
    const [beforeCustomer] = await transaction
      .select({ name: customers.name })
      .from(customers)
      .where(eq(customers.id, workspace.customerId))
      .limit(1);
    const beforeCollections = await transaction
      .select({
        amount: payments.amount,
        departmentId: payments.departmentId,
        discount: payments.discount,
        id: payments.id,
        kind: payments.kind,
        providerOrMode: payments.providerOrMode,
      })
      .from(payments)
      .where(
        inArray(
          payments.id,
          workspace.collections.map((collection) => collection.id),
        ),
      );

    await transaction
      .update(customers)
      .set({ name: workspace.patient, updatedAt: new Date() })
      .where(eq(customers.id, workspace.customerId));

    const departmentRows = await transaction
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(
        inArray(
          departments.name,
          workspace.collections.map((collection) => collection.department),
        ),
      );
    const departmentIds = new Map(
      departmentRows.map((department) => [department.name, department.id]),
    );

    for (const collection of workspace.collections) {
      const departmentId = departmentIds.get(collection.department);
      if (!departmentId) throw new Error(`Department is not configured: ${collection.department}`);
      await transaction
        .update(payments)
        .set({
          amount: collection.amount.toFixed(2),
          departmentId,
          discount: collection.discount.toFixed(2),
          kind: collection.mode,
          providerOrMode: collection.mode === "cash" ? null : collection.providerOrMode,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, collection.id));
    }

    await transaction.insert(auditEvents).values({
      action: "patient-collections.updated",
      actorUserId,
      after: {
        collections: workspace.collections,
        patient: workspace.patient,
      },
      before: {
        collections: beforeCollections,
        patient: beforeCustomer?.name ?? null,
      },
      entityId: workspace.customerId,
      entityType: "patient",
      reason: workspace.reason,
    });
  });

  return readDashboardData(accessibleDepartmentNames, isAdmin);
}

export async function findPatientCollectionsForAuthorization(
  customerId: string,
  paymentIds: string[],
) {
  if (paymentIds.length === 0) return [];
  const db = getDatabase();
  return db
    .select({
      customerId: payments.customerId,
      department: departments.name,
      id: payments.id,
      occurredAt: payments.occurredAt,
    })
    .from(payments)
    .innerJoin(departments, eq(payments.departmentId, departments.id))
    .where(inArray(payments.id, paymentIds))
    .then((rows) => rows.filter((row) => row.customerId === customerId));
}

export async function findCollectionForAuthorization(id: string) {
  const db = getDatabase();
  const [payment] = await db
    .select({
      department: departments.name,
      occurredAt: payments.occurredAt,
    })
    .from(payments)
    .innerJoin(departments, eq(payments.departmentId, departments.id))
    .where(eq(payments.id, id))
    .limit(1);
  return payment;
}

export function isTodayInClinicTime(date: Date): boolean {
  return dateKey(date) === dateKey(new Date());
}

function netRevenue(rows: { amount: string; discount: string }[]): number {
  return rows.reduce(
    (total, payment) => total + Number(payment.amount) - Number(payment.discount),
    0,
  );
}

function targetProgress(label: string, actual: number, target: number) {
  return { actual, label, target };
}

function dateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Kolkata",
    year: "numeric",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function startOfWeekKey(date: Date): string {
  const currentKey = dateKey(date);
  const [year, month, day] = currentKey.split("-").map(Number);
  const current = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  const dayOfWeek = current.getUTCDay();
  current.setUTCDate(current.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  return current.toISOString().slice(0, 10);
}

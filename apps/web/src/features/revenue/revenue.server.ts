import { createDatabase } from "@eyeflow/db";
import { customers, departments, payments } from "@eyeflow/db/schema";
import { desc, eq, ilike, inArray } from "drizzle-orm";
import type {
  DashboardData,
  DepartmentSummary,
  RecentCollection,
} from "../dashboard/dashboard-data";
import { type NewCollection, paymentModeLabels } from "./collection-schema";

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

  const totals = {
    cash: 0,
    credit: 0,
    discount: 0,
    online: 0,
    revenue: 0,
  };
  const departmentAmounts = new Map<string, number>();
  const patientIds = new Set<string>();

  for (const payment of paymentRows) {
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

  const recentCollections: RecentCollection[] = paymentRows.slice(0, 10).map((payment) => ({
    amount: Number(payment.amount) - Number(payment.discount),
    department: payment.department as RecentCollection["department"],
    id: payment.id,
    mode: paymentModeLabels[payment.kind],
    patient: payment.patient,
    time: payment.occurredAt.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  return {
    departments: departmentSummaries,
    recentCollections,
    summary: {
      ...totals,
      patients: patientIds.size,
      transactions: paymentRows.length,
    },
  };
}

export async function insertCollection(
  collection: NewCollection,
  actorUserId: string,
  accessibleDepartmentNames: string[] | null,
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

    const [department] = await transaction
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.name, collection.department))
      .limit(1);

    if (!department) throw new Error(`Department is not configured: ${collection.department}`);

    await transaction.insert(payments).values({
      amount: collection.amount.toFixed(2),
      customerId,
      departmentId: department.id,
      discount: collection.discount.toFixed(2),
      kind: collection.mode,
      providerOrMode: collection.providerOrMode,
      createdByUserId: actorUserId,
    });
  });

  return readDashboardData(accessibleDepartmentNames);
}

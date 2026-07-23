import { createDatabase } from "@eyeflow/db";
import {
  auditEvents,
  customers,
  departments,
  emrPatients,
  emrReceipts,
  opticalOrderStates,
  payments,
  user,
} from "@eyeflow/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  type OpticalOrder,
  type OpticalOrderStatus,
  type OpticalTrackerData,
  opticalOrderStatuses,
  type UpdateOpticalOrder,
} from "./optical-schema";

let database: ReturnType<typeof createDatabase> | undefined;

function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to use the optical tracker.");
  database ??= createDatabase(databaseUrl);
  return database;
}

interface MutableOpticalOrder {
  collectedAmount: number;
  orderDate: string;
  orderKey: string;
  patient: string;
  paymentCount: number;
}

function paymentDate(date: Date) {
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

function addOrder(
  orders: Map<string, MutableOpticalOrder>,
  input: Omit<MutableOpticalOrder, "collectedAmount" | "paymentCount"> & { amount: number },
) {
  const existing = orders.get(input.orderKey);
  if (existing) {
    existing.collectedAmount += input.amount;
    existing.paymentCount += 1;
    return;
  }
  orders.set(input.orderKey, {
    collectedAmount: input.amount,
    orderDate: input.orderDate,
    orderKey: input.orderKey,
    patient: input.patient,
    paymentCount: 1,
  });
}

async function readOpticalSourceOrders(): Promise<MutableOpticalOrder[]> {
  const db = getDatabase();
  const paymentRows = await db
    .select({
      amount: payments.amount,
      customerId: customers.id,
      emrPatientId: customers.emrPatientId,
      occurredAt: payments.occurredAt,
      patient: customers.name,
    })
    .from(payments)
    .innerJoin(customers, eq(payments.customerId, customers.id))
    .innerJoin(departments, eq(payments.departmentId, departments.id))
    .where(eq(departments.name, "Opticals"))
    .orderBy(desc(payments.occurredAt));

  const unlinkedReceiptRows = await db
    .select({
      amount: emrReceipts.amount,
      emrPatientId: emrReceipts.emrPatientId,
      orderDate: emrReceipts.receiptDate,
      patient: emrPatients.displayName,
    })
    .from(emrReceipts)
    .innerJoin(emrPatients, eq(emrReceipts.emrPatientId, emrPatients.id))
    .leftJoin(payments, eq(payments.emrReceiptId, emrReceipts.id))
    .where(
      and(
        eq(emrReceipts.mappedDepartment, "Opticals"),
        eq(emrReceipts.requiresReview, false),
        isNull(payments.id),
      ),
    )
    .orderBy(desc(emrReceipts.occurredAt));

  const orders = new Map<string, MutableOpticalOrder>();
  for (const row of paymentRows) {
    const orderDate = paymentDate(row.occurredAt);
    const patientKey = row.emrPatientId ? `emr:${row.emrPatientId}` : `customer:${row.customerId}`;
    addOrder(orders, {
      amount: Number(row.amount),
      orderDate,
      orderKey: `${patientKey}:${orderDate}`,
      patient: row.patient,
    });
  }
  for (const row of unlinkedReceiptRows) {
    addOrder(orders, {
      amount: Number(row.amount),
      orderDate: row.orderDate,
      orderKey: `emr:${row.emrPatientId}:${row.orderDate}`,
      patient: row.patient,
    });
  }
  return [...orders.values()].sort((left, right) => right.orderDate.localeCompare(left.orderDate));
}

export async function readOpticalTracker(): Promise<OpticalTrackerData> {
  const db = getDatabase();
  const [sourceOrders, states] = await Promise.all([
    readOpticalSourceOrders(),
    db
      .select({
        orderKey: opticalOrderStates.orderKey,
        status: opticalOrderStates.status,
        updatedAt: opticalOrderStates.updatedAt,
        updatedBy: user.name,
      })
      .from(opticalOrderStates)
      .innerJoin(user, eq(opticalOrderStates.updatedByUserId, user.id)),
  ]);
  const stateByKey = new Map(states.map((state) => [state.orderKey, state]));
  const orders: OpticalOrder[] = sourceOrders.map((order) => {
    const state = stateByKey.get(order.orderKey);
    return {
      ...order,
      collectedAmount: Math.round((order.collectedAmount + Number.EPSILON) * 100) / 100,
      status: state?.status ?? "advanced",
      updatedAt: state?.updatedAt.toISOString() ?? null,
      updatedBy: state?.updatedBy ?? null,
    };
  });
  return {
    orders,
    summary: opticalOrderStatuses.map((status) => ({
      count: orders.filter((order) => order.status === status).length,
      status,
    })),
    totalCollected:
      Math.round(
        (orders.reduce((total, order) => total + order.collectedAmount, 0) + Number.EPSILON) * 100,
      ) / 100,
    totalOrders: orders.length,
  };
}

export async function updateOpticalOrderStatus(
  input: UpdateOpticalOrder,
  actorUserId: string,
): Promise<OpticalTrackerData> {
  const db = getDatabase();
  const sourceOrder = (await readOpticalSourceOrders()).find(
    (order) => order.orderKey === input.orderKey,
  );
  if (!sourceOrder) throw new Error("This optical order no longer exists.");

  const [before] = await db
    .select({ status: opticalOrderStates.status })
    .from(opticalOrderStates)
    .where(eq(opticalOrderStates.orderKey, input.orderKey))
    .limit(1);
  const previousStatus: OpticalOrderStatus = before?.status ?? "advanced";
  if (previousStatus === input.status) return readOpticalTracker();

  const changedAt = new Date();
  await db.transaction(async (transaction) => {
    await transaction
      .insert(opticalOrderStates)
      .values({
        orderKey: input.orderKey,
        status: input.status,
        updatedAt: changedAt,
        updatedByUserId: actorUserId,
      })
      .onConflictDoUpdate({
        set: {
          status: input.status,
          updatedAt: changedAt,
          updatedByUserId: actorUserId,
        },
        target: opticalOrderStates.orderKey,
      });
    await transaction.insert(auditEvents).values({
      action: "optical-order.status-updated",
      actorUserId,
      after: { status: input.status },
      before: { status: previousStatus },
      entityId: input.orderKey,
      entityType: "optical-order",
      reason: `Optical order moved from ${previousStatus} to ${input.status}.`,
    });
  });
  return readOpticalTracker();
}

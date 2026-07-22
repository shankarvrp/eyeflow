import { createDatabase } from "@eyeflow/db";
import {
  customers,
  departments,
  emrAppointments,
  emrPatients,
  emrReceipts,
  payments,
} from "@eyeflow/db/schema";
import { and, asc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { readDepartmentTargets } from "../administration/administration.server";
import { clinicDateBounds } from "../revenue/collection-query";
import { paymentModeLabels } from "../revenue/collection-schema";
import { readCollectionExportRows } from "../revenue/revenue.server";
import type { ReportQuery } from "./operations-schema";

let database: ReturnType<typeof createDatabase> | undefined;

function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for operations reporting.");
  database ??= createDatabase(databaseUrl);
  return database;
}

export interface PatientDirectoryEntry {
  collections: Array<{
    amount: number;
    department: string;
    id: string;
    mode: string;
    occurredAt: string;
  }>;
  departments: string[];
  externalPatientId: string | null;
  id: string;
  lastActivityAt: string | null;
  name: string;
  source: "EMR" | "EyeFlow";
  totalCollected: number;
  visits: number;
}

export async function readPatientDirectory(query: ReportQuery): Promise<PatientDirectoryEntry[]> {
  const db = getDatabase();
  const bounds = clinicDateBounds(query.from, query.to);
  const [patientRows, customerRows, appointmentRows, receiptRows, paymentRows] = await Promise.all([
    db
      .select({
        externalPatientId: emrPatients.externalPatientId,
        id: emrPatients.id,
        name: emrPatients.displayName,
      })
      .from(emrPatients)
      .orderBy(asc(emrPatients.displayName)),
    db
      .select({ emrPatientId: customers.emrPatientId, id: customers.id, name: customers.name })
      .from(customers)
      .orderBy(asc(customers.name)),
    db
      .select({ emrPatientId: emrAppointments.emrPatientId })
      .from(emrAppointments)
      .where(inArray(emrAppointments.appointmentDate, dateKeys(query.from, query.to))),
    db
      .select({
        amount: emrReceipts.amount,
        department: emrReceipts.mappedDepartment,
        emrPatientId: emrReceipts.emrPatientId,
        id: emrReceipts.id,
        mode: emrReceipts.mappedMode,
        occurredAt: emrReceipts.occurredAt,
        paymentId: payments.id,
      })
      .from(emrReceipts)
      .leftJoin(payments, eq(payments.emrReceiptId, emrReceipts.id))
      .where(
        and(
          eq(emrReceipts.requiresReview, false),
          isNull(payments.id),
          gte(emrReceipts.occurredAt, bounds.start),
          lt(emrReceipts.occurredAt, bounds.end),
        ),
      ),
    db
      .select({
        amount: payments.amount,
        customerId: payments.customerId,
        department: departments.name,
        discount: payments.discount,
        id: payments.id,
        mode: payments.kind,
        occurredAt: payments.occurredAt,
      })
      .from(payments)
      .innerJoin(departments, eq(payments.departmentId, departments.id))
      .where(and(gte(payments.occurredAt, bounds.start), lt(payments.occurredAt, bounds.end))),
  ]);

  const directory = new Map<string, PatientDirectoryEntry>();
  for (const patient of patientRows) {
    directory.set(`emr:${patient.id}`, {
      collections: [],
      departments: [],
      externalPatientId: patient.externalPatientId,
      id: `emr:${patient.id}`,
      lastActivityAt: null,
      name: patient.name,
      source: "EMR",
      totalCollected: 0,
      visits: 0,
    });
  }
  const customerKeys = new Map<string, string>();
  for (const customer of customerRows) {
    const key = customer.emrPatientId ? `emr:${customer.emrPatientId}` : `customer:${customer.id}`;
    customerKeys.set(customer.id, key);
    if (!directory.has(key)) {
      directory.set(key, {
        collections: [],
        departments: [],
        externalPatientId: null,
        id: key,
        lastActivityAt: null,
        name: customer.name,
        source: "EyeFlow",
        totalCollected: 0,
        visits: 0,
      });
    }
  }
  for (const appointment of appointmentRows) {
    const entry = directory.get(`emr:${appointment.emrPatientId}`);
    if (entry) entry.visits += 1;
  }
  for (const receipt of receiptRows) {
    if (!receipt.department) continue;
    addPatientCollection(directory.get(`emr:${receipt.emrPatientId}`), {
      amount: Number(receipt.amount),
      department: receipt.department,
      id: `emr:${receipt.id}`,
      mode: paymentModeLabels[receipt.mode],
      occurredAt: receipt.occurredAt,
    });
  }
  for (const payment of paymentRows) {
    const key = customerKeys.get(payment.customerId);
    if (!key) continue;
    addPatientCollection(directory.get(key), {
      amount: Number(payment.amount) - Number(payment.discount),
      department: payment.department,
      id: `payment:${payment.id}`,
      mode: paymentModeLabels[payment.mode],
      occurredAt: payment.occurredAt,
    });
  }
  return [...directory.values()]
    .filter((entry) => entry.visits > 0 || entry.collections.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function addPatientCollection(
  entry: PatientDirectoryEntry | undefined,
  collection: { amount: number; department: string; id: string; mode: string; occurredAt: Date },
) {
  if (!entry) return;
  entry.collections.push({ ...collection, occurredAt: collection.occurredAt.toISOString() });
  entry.totalCollected += collection.amount;
  if (!entry.departments.includes(collection.department)) {
    entry.departments.push(collection.department);
  }
  if (!entry.lastActivityAt || collection.occurredAt > new Date(entry.lastActivityAt)) {
    entry.lastActivityAt = collection.occurredAt.toISOString();
  }
}

export interface ReportsData {
  collectionByDateDepartment: Array<{
    amount: number;
    date: string;
    department: string;
    transactions: number;
  }>;
  conversion: Array<{ converted: number; department: "Opticals" | "Pharmacy"; ratio: number }>;
  departmentTargets: Array<{
    daily: { actual: number; target: number };
    department: string;
    monthly: { actual: number; target: number };
    weekly: { actual: number; target: number };
  }>;
  filter: ReportQuery;
  patientTime: Array<{
    minutes: number;
    patient: string;
    scheduledAt: string;
    completedAt: string;
  }>;
}

export async function readReportsData(
  query: ReportQuery,
  accessibleDepartments: string[] | null,
): Promise<ReportsData> {
  const db = getDatabase();
  const rows = await readCollectionExportRows(accessibleDepartments, {
    collectionPage: 1,
    from: query.from,
    pageSize: 50,
    patientPage: 1,
    to: query.to,
  });
  const collectionGroups = new Map<string, ReportsData["collectionByDateDepartment"][number]>();
  for (const row of rows) {
    const date = clinicDate(row.occurredAt);
    const key = `${date}:${row.department}`;
    const group = collectionGroups.get(key) ?? {
      amount: 0,
      date,
      department: row.department,
      transactions: 0,
    };
    group.amount += row.amount - row.discount;
    group.transactions += 1;
    collectionGroups.set(key, group);
  }

  const bounds = clinicDateBounds(query.from, query.to);
  const [appointmentRows, receiptRows] = await Promise.all([
    db
      .select({
        emrPatientId: emrAppointments.emrPatientId,
        patient: emrPatients.displayName,
        scheduledAt: emrAppointments.scheduledAt,
      })
      .from(emrAppointments)
      .innerJoin(emrPatients, eq(emrAppointments.emrPatientId, emrPatients.id))
      .where(
        and(
          gte(emrAppointments.appointmentDate, query.from),
          inArray(emrAppointments.appointmentDate, dateKeys(query.from, query.to)),
        ),
      ),
    db
      .select({
        department: emrReceipts.mappedDepartment,
        emrPatientId: emrReceipts.emrPatientId,
        occurredAt: emrReceipts.occurredAt,
      })
      .from(emrReceipts)
      .where(
        and(gte(emrReceipts.occurredAt, bounds.start), lt(emrReceipts.occurredAt, bounds.end)),
      ),
  ]);
  const lastReceipt = new Map<string, Date>();
  const converted = { Opticals: new Set<string>(), Pharmacy: new Set<string>() };
  for (const receipt of receiptRows) {
    const current = lastReceipt.get(receipt.emrPatientId);
    if (!current || receipt.occurredAt > current)
      lastReceipt.set(receipt.emrPatientId, receipt.occurredAt);
    if (receipt.department === "Pharmacy" || receipt.department === "Opticals") {
      converted[receipt.department].add(receipt.emrPatientId);
    }
  }
  const appointmentPatients = new Set(appointmentRows.map((entry) => entry.emrPatientId));
  const convertedAppointmentPatients = {
    Opticals: new Set(
      [...converted.Opticals].filter((patientId) => appointmentPatients.has(patientId)),
    ),
    Pharmacy: new Set(
      [...converted.Pharmacy].filter((patientId) => appointmentPatients.has(patientId)),
    ),
  };
  const patientTime = appointmentRows
    .flatMap((appointment) => {
      const completedAt = lastReceipt.get(appointment.emrPatientId);
      if (!appointment.scheduledAt || !completedAt || completedAt <= appointment.scheduledAt)
        return [];
      return [
        {
          completedAt: completedAt.toISOString(),
          minutes: Math.round((completedAt.getTime() - appointment.scheduledAt.getTime()) / 60_000),
          patient: appointment.patient,
          scheduledAt: appointment.scheduledAt.toISOString(),
        },
      ];
    })
    .sort((left, right) => right.minutes - left.minutes);

  const departmentTargets = await buildDepartmentTargets(
    await readDepartmentTargets(),
    accessibleDepartments,
  );
  return {
    collectionByDateDepartment: [...collectionGroups.values()].sort(
      (left, right) =>
        right.date.localeCompare(left.date) || left.department.localeCompare(right.department),
    ),
    conversion: (["Pharmacy", "Opticals"] as const).map((department) => ({
      converted: convertedAppointmentPatients[department].size,
      department,
      ratio:
        appointmentPatients.size === 0
          ? 0
          : Math.round(
              (convertedAppointmentPatients[department].size / appointmentPatients.size) * 10_000,
            ) / 100,
    })),
    departmentTargets,
    filter: query,
    patientTime,
  };
}

async function buildDepartmentTargets(
  targets: Awaited<ReturnType<typeof readDepartmentTargets>>,
  accessibleDepartments: string[] | null,
) {
  const now = new Date();
  const today = clinicDate(now);
  const monthStart = `${today.slice(0, 7)}-01`;
  const day = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const weekStartKey = clinicDate(weekStart);
  const rows = await readCollectionExportRows(accessibleDepartments, {
    collectionPage: 1,
    from: monthStart < weekStartKey ? monthStart : weekStartKey,
    pageSize: 50,
    patientPage: 1,
    to: today,
  });
  return targets
    .filter(
      (target) =>
        accessibleDepartments === null || accessibleDepartments.includes(target.department),
    )
    .map((target) => {
      const departmentRows = rows.filter((row) => row.department === target.department);
      const actualMonth = departmentRows.reduce(
        (total, row) => total + row.amount - row.discount,
        0,
      );
      const actualWeek = departmentRows
        .filter((row) => clinicDate(row.occurredAt) >= weekStartKey)
        .reduce((total, row) => total + row.amount - row.discount, 0);
      const actualDay = departmentRows
        .filter((row) => clinicDate(row.occurredAt) === today)
        .reduce((total, row) => total + row.amount - row.discount, 0);
      return {
        daily: { actual: actualDay, target: target.daily },
        department: target.department,
        monthly: { actual: actualMonth, target: target.monthly },
        weekly: { actual: actualWeek, target: target.weekly },
      };
    });
}

function clinicDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Kolkata",
    year: "numeric",
  }).format(date);
}

function dateKeys(from: string, to: string) {
  const keys: string[] = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (cursor <= end && keys.length < 370) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

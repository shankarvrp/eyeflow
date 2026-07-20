import { createDatabase } from "@eyeflow/db";
import {
  auditEvents,
  customers,
  emrAppointments,
  emrPatients,
  emrReceipts,
  payments,
} from "@eyeflow/db/schema";
import { and, asc, count, countDistinct, eq, isNull, max } from "drizzle-orm";
import { mapEmrReceipt } from "./emr-receipt-mapping";
import type { EmrReceiptImport } from "./emr-receipt-parser";

let database: ReturnType<typeof createDatabase> | undefined;

function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to read EMR patients.");
  database ??= createDatabase(databaseUrl);
  return database;
}

export interface EmrPatientOption {
  displayName: string;
  externalPatientId: string;
  hasEyeFlowRecord: boolean;
  id: string;
  visitType: string | null;
}

export interface EmrAppointmentImport {
  appointmentDate: string;
  externalAppointmentId: string;
  externalPatientId: string;
  patientName: string;
  visitType: string | null;
}

export interface EmrSyncStatus {
  appointmentDate: string;
  autoSyncIntervalMinutes: number;
  connected: boolean;
  lastSyncedAt: string | null;
  patientCount: number;
  receiptCount: number;
}

export interface EmrReceiptDraft {
  amount: number;
  department: ReturnType<typeof mapEmrReceipt>["department"];
  externalReceiptId: string;
  mode: ReturnType<typeof mapEmrReceipt>["mode"];
  providerOrMode: string | null;
  receiptId: string;
  requiresReview: boolean;
  sourceDepartment: string;
}

export function emrAutoSyncIntervalMinutes(): number {
  const configured = Number(process.env.EMR_SYNC_INTERVAL_MINUTES ?? "15");
  if (!Number.isFinite(configured)) return 15;
  return Math.min(1_440, Math.max(1, Math.round(configured)));
}

export async function importEmrAppointments(
  records: EmrAppointmentImport[],
  actorUserId: string,
  appointmentDate = records[0]?.appointmentDate,
): Promise<number> {
  if (!appointmentDate) return 0;
  const db = getDatabase();
  await db.transaction(async (transaction) => {
    for (const record of records) {
      const [patient] = await transaction
        .insert(emrPatients)
        .values({
          displayName: record.patientName,
          externalPatientId: record.externalPatientId,
          source: "foss",
        })
        .onConflictDoUpdate({
          target: [emrPatients.source, emrPatients.externalPatientId],
          set: {
            displayName: record.patientName,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning({ id: emrPatients.id });
      if (!patient) continue;

      await transaction
        .insert(emrAppointments)
        .values({
          appointmentDate: record.appointmentDate,
          emrPatientId: patient.id,
          externalAppointmentId: record.externalAppointmentId,
          source: "foss",
          visitType: record.visitType,
        })
        .onConflictDoUpdate({
          target: [emrAppointments.source, emrAppointments.externalAppointmentId],
          set: {
            appointmentDate: record.appointmentDate,
            emrPatientId: patient.id,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
            visitType: record.visitType,
          },
        });
    }

    await transaction.insert(auditEvents).values({
      action: "emr.sync.completed",
      actorUserId,
      after: { appointmentDate, recordCount: records.length },
      before: {},
      entityId: appointmentDate,
      entityType: "emr-sync",
      reason: "Authorized FOSS EHR patient appointment synchronization",
    });
  });
  return records.length;
}

export async function importEmrReceipts(
  records: EmrReceiptImport[],
  actorUserId: string,
  receiptDate: string,
): Promise<number> {
  const db = getDatabase();
  await db.transaction(async (transaction) => {
    for (const record of records) {
      const mapping = mapEmrReceipt(record);
      const [patient] = await transaction
        .insert(emrPatients)
        .values({
          displayName: record.patientName,
          externalPatientId: record.externalPatientId,
          source: "foss",
        })
        .onConflictDoUpdate({
          target: [emrPatients.source, emrPatients.externalPatientId],
          set: {
            displayName: record.patientName,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning({ id: emrPatients.id });
      if (!patient) continue;

      await transaction
        .insert(emrReceipts)
        .values({
          amount: record.amount.toFixed(2),
          emrPatientId: patient.id,
          externalLineKey: record.externalLineKey,
          externalReceiptId: record.externalReceiptId,
          mappedDepartment: mapping.department,
          mappedMode: mapping.mode,
          mappedProviderOrMode: mapping.providerOrMode,
          occurredAt: record.occurredAt,
          paymentMode: record.paymentMode,
          receiptDate: record.receiptDate,
          receiptType: record.receiptType,
          requiresReview: mapping.requiresReview,
          source: "foss",
          sourceDepartment: record.sourceDepartment,
        })
        .onConflictDoUpdate({
          target: [emrReceipts.source, emrReceipts.externalLineKey],
          set: {
            amount: record.amount.toFixed(2),
            emrPatientId: patient.id,
            externalReceiptId: record.externalReceiptId,
            mappedDepartment: mapping.department,
            mappedMode: mapping.mode,
            mappedProviderOrMode: mapping.providerOrMode,
            occurredAt: record.occurredAt,
            paymentMode: record.paymentMode,
            receiptDate: record.receiptDate,
            receiptType: record.receiptType,
            requiresReview: mapping.requiresReview,
            sourceDepartment: record.sourceDepartment,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          },
        });
    }

    await transaction.insert(auditEvents).values({
      action: "emr.receipts.sync.completed",
      actorUserId,
      after: { receiptDate, recordCount: records.length },
      before: {},
      entityId: receiptDate,
      entityType: "emr-receipt-sync",
      reason: "Authorized FOSS EHR collection receipt synchronization",
    });
  });
  return records.length;
}

export async function readEmrSyncStatus(
  appointmentDate: string,
  connected: boolean,
): Promise<EmrSyncStatus> {
  const db = getDatabase();
  const [[summary], [receiptSummary], [sync]] = await Promise.all([
    db
      .select({ patientCount: countDistinct(emrAppointments.emrPatientId) })
      .from(emrAppointments)
      .where(
        and(
          eq(emrAppointments.source, "foss"),
          eq(emrAppointments.appointmentDate, appointmentDate),
        ),
      ),
    db
      .select({ receiptCount: count() })
      .from(emrReceipts)
      .where(and(eq(emrReceipts.source, "foss"), eq(emrReceipts.receiptDate, appointmentDate))),
    db
      .select({ lastSyncedAt: max(auditEvents.createdAt) })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.action, "emr.sync.completed"),
          eq(auditEvents.entityType, "emr-sync"),
          eq(auditEvents.entityId, appointmentDate),
        ),
      ),
  ]);

  return {
    appointmentDate,
    autoSyncIntervalMinutes: emrAutoSyncIntervalMinutes(),
    connected,
    lastSyncedAt: sync?.lastSyncedAt?.toISOString() ?? null,
    patientCount: Number(summary?.patientCount ?? 0),
    receiptCount: Number(receiptSummary?.receiptCount ?? 0),
  };
}

export async function readEmrPatientOptions(appointmentDate: string): Promise<EmrPatientOption[]> {
  const db = getDatabase();
  const rows = await db
    .select({
      customerId: customers.id,
      displayName: emrPatients.displayName,
      externalPatientId: emrPatients.externalPatientId,
      id: emrPatients.id,
      visitType: emrAppointments.visitType,
    })
    .from(emrAppointments)
    .innerJoin(emrPatients, eq(emrAppointments.emrPatientId, emrPatients.id))
    .leftJoin(customers, eq(customers.emrPatientId, emrPatients.id))
    .where(
      and(eq(emrAppointments.source, "foss"), eq(emrAppointments.appointmentDate, appointmentDate)),
    )
    .orderBy(asc(emrPatients.displayName));

  const receiptRows = await db
    .select({
      customerId: customers.id,
      displayName: emrPatients.displayName,
      externalPatientId: emrPatients.externalPatientId,
      id: emrPatients.id,
    })
    .from(emrReceipts)
    .innerJoin(emrPatients, eq(emrReceipts.emrPatientId, emrPatients.id))
    .leftJoin(customers, eq(customers.emrPatientId, emrPatients.id))
    .where(and(eq(emrReceipts.source, "foss"), eq(emrReceipts.receiptDate, appointmentDate)))
    .orderBy(asc(emrPatients.displayName));
  const options = new Map<string, EmrPatientOption>();
  for (const row of rows) {
    options.set(row.id, {
      displayName: row.displayName,
      externalPatientId: row.externalPatientId,
      hasEyeFlowRecord: Boolean(row.customerId),
      id: row.id,
      visitType: row.visitType,
    });
  }
  for (const row of receiptRows) {
    if (options.has(row.id)) continue;
    options.set(row.id, {
      displayName: row.displayName,
      externalPatientId: row.externalPatientId,
      hasEyeFlowRecord: Boolean(row.customerId),
      id: row.id,
      visitType: null,
    });
  }
  return [...options.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
}

export async function readEmrReceiptDrafts(
  receiptDate: string,
  emrPatientId: string,
): Promise<EmrReceiptDraft[]> {
  const db = getDatabase();
  const rows = await db
    .select({
      amount: emrReceipts.amount,
      externalReceiptId: emrReceipts.externalReceiptId,
      id: emrReceipts.id,
      mappedDepartment: emrReceipts.mappedDepartment,
      mappedMode: emrReceipts.mappedMode,
      mappedProviderOrMode: emrReceipts.mappedProviderOrMode,
      paymentId: payments.id,
      paymentMode: emrReceipts.paymentMode,
      receiptType: emrReceipts.receiptType,
      requiresReview: emrReceipts.requiresReview,
      sourceDepartment: emrReceipts.sourceDepartment,
    })
    .from(emrReceipts)
    .leftJoin(payments, eq(payments.emrReceiptId, emrReceipts.id))
    .where(
      and(
        eq(emrReceipts.source, "foss"),
        eq(emrReceipts.receiptDate, receiptDate),
        eq(emrReceipts.emrPatientId, emrPatientId),
        isNull(payments.id),
      ),
    )
    .orderBy(asc(emrReceipts.occurredAt));

  return rows.map((row) => ({
    amount: Number(row.amount),
    department: row.mappedDepartment as EmrReceiptDraft["department"],
    externalReceiptId: row.externalReceiptId,
    mode: row.mappedMode,
    providerOrMode: row.mappedProviderOrMode,
    receiptId: row.id,
    requiresReview: row.requiresReview,
    sourceDepartment: row.sourceDepartment,
  }));
}

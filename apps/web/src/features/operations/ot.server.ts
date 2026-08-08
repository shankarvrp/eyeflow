import { createDatabase } from "@eyeflow/db";
import {
  auditEvents,
  customers,
  departments,
  emrOtCases,
  emrPatients,
  emrReceipts,
  otPackageSignoffs,
  payments,
  user,
} from "@eyeflow/db/schema";
import { and, asc, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { clinicDateBounds } from "../revenue/collection-query";
import type { OtPackageSignoff, OtPaymentLine, OtScheduleCase, OtScheduleData } from "./ot-schema";

let database: ReturnType<typeof createDatabase> | undefined;

function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to use the OT schedule.");
  database ??= createDatabase(databaseUrl);
  return database;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function readOtPayments(businessDate: string): Promise<Map<string, OtPaymentLine[]>> {
  const db = getDatabase();
  const bounds = clinicDateBounds(businessDate, businessDate);
  const [paymentRows, receiptRows] = await Promise.all([
    db
      .select({
        amount: payments.amount,
        emrPatientId: customers.emrPatientId,
        kind: payments.kind,
        occurredAt: payments.occurredAt,
        providerOrMode: payments.providerOrMode,
      })
      .from(payments)
      .innerJoin(customers, eq(payments.customerId, customers.id))
      .innerJoin(departments, eq(payments.departmentId, departments.id))
      .where(
        and(
          eq(departments.name, "OT"),
          gte(payments.occurredAt, bounds.start),
          lt(payments.occurredAt, bounds.end),
        ),
      )
      .orderBy(asc(payments.occurredAt)),
    db
      .select({
        amount: emrReceipts.amount,
        emrPatientId: emrReceipts.emrPatientId,
        kind: emrReceipts.mappedMode,
        occurredAt: emrReceipts.occurredAt,
        providerOrMode: emrReceipts.mappedProviderOrMode,
      })
      .from(emrReceipts)
      .leftJoin(payments, eq(payments.emrReceiptId, emrReceipts.id))
      .where(
        and(
          eq(emrReceipts.mappedDepartment, "OT"),
          eq(emrReceipts.requiresReview, false),
          isNull(payments.id),
          gte(emrReceipts.occurredAt, bounds.start),
          lt(emrReceipts.occurredAt, bounds.end),
        ),
      )
      .orderBy(asc(emrReceipts.occurredAt)),
  ]);
  const byPatient = new Map<string, OtPaymentLine[]>();
  for (const row of [...paymentRows, ...receiptRows]) {
    if (!row.emrPatientId) continue;
    const lines = byPatient.get(row.emrPatientId) ?? [];
    lines.push({
      amount: Number(row.amount),
      kind: row.kind,
      occurredAt: row.occurredAt.toISOString(),
      providerOrMode: row.providerOrMode,
    });
    byPatient.set(row.emrPatientId, lines);
  }
  return byPatient;
}

export async function readOtSchedule(businessDate: string): Promise<OtScheduleData> {
  const db = getDatabase();
  const [rows, paymentMap, signoffRows] = await Promise.all([
    db
      .select({
        businessDate: emrOtCases.businessDate,
        externalPatientId: emrPatients.externalPatientId,
        id: emrOtCases.id,
        packageAmount: emrOtCases.packageAmount,
        packageUpdatedAt: emrOtCases.packageUpdatedAt,
        packageUpdatedBy: user.name,
        patientId: emrOtCases.emrPatientId,
        patientName: emrPatients.displayName,
        procedureName: emrOtCases.procedureName,
        scheduledAt: emrOtCases.scheduledAt,
        status: emrOtCases.status,
        surgeonName: emrOtCases.surgeonName,
      })
      .from(emrOtCases)
      .innerJoin(emrPatients, eq(emrOtCases.emrPatientId, emrPatients.id))
      .leftJoin(user, eq(emrOtCases.packageUpdatedByUserId, user.id))
      .where(and(eq(emrOtCases.source, "foss"), eq(emrOtCases.businessDate, businessDate)))
      .orderBy(asc(emrOtCases.scheduledAt), asc(emrPatients.displayName)),
    readOtPayments(businessDate),
    db
      .select({
        calculatedAmount: otPackageSignoffs.calculatedAmount,
        declaredAmount: otPackageSignoffs.declaredAmount,
        note: otPackageSignoffs.note,
        signedAt: otPackageSignoffs.signedAt,
        signedBy: user.name,
        signerRole: otPackageSignoffs.signerRole,
      })
      .from(otPackageSignoffs)
      .innerJoin(user, eq(otPackageSignoffs.signedByUserId, user.id))
      .where(eq(otPackageSignoffs.businessDate, businessDate))
      .orderBy(desc(otPackageSignoffs.signedAt)),
  ]);

  const cases: OtScheduleCase[] = rows.map((row) => {
    const paymentLines = paymentMap.get(row.patientId) ?? [];
    return {
      businessDate: row.businessDate,
      cashAmount: money(
        paymentLines
          .filter((line) => line.kind === "cash")
          .reduce((total, line) => total + line.amount, 0),
      ),
      collectedAmount: money(paymentLines.reduce((total, line) => total + line.amount, 0)),
      creditAmount: money(
        paymentLines
          .filter((line) => line.kind === "credit")
          .reduce((total, line) => total + line.amount, 0),
      ),
      externalPatientId: row.externalPatientId,
      id: row.id,
      packageAmount: row.packageAmount === null ? null : Number(row.packageAmount),
      packageUpdatedAt: row.packageUpdatedAt?.toISOString() ?? null,
      packageUpdatedBy: row.packageUpdatedBy ?? null,
      onlineAmount: money(
        paymentLines
          .filter((line) => line.kind === "online")
          .reduce((total, line) => total + line.amount, 0),
      ),
      patientName: row.patientName,
      payments: paymentLines,
      procedureName: row.procedureName,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      status: row.status === "discharged_today" ? "discharged_today" : "scheduled",
      surgeonName: row.surgeonName,
    };
  });
  const signoffs: OtPackageSignoff[] = signoffRows.flatMap((row) => {
    if (row.signerRole !== "admin" && row.signerRole !== "user") return [];
    const calculatedAmount = Number(row.calculatedAmount);
    const declaredAmount = Number(row.declaredAmount);
    return [
      {
        calculatedAmount,
        declaredAmount,
        matches: Math.abs(calculatedAmount - declaredAmount) < 0.01,
        note: row.note,
        signedAt: row.signedAt.toISOString(),
        signedBy: row.signedBy,
        signerRole: row.signerRole,
      },
    ];
  });
  const packageAmount = money(
    cases.reduce((total, otCase) => total + (otCase.packageAmount ?? 0), 0),
  );
  const collectedAmount = money(
    [...paymentMap.values()].flat().reduce((total, line) => total + line.amount, 0),
  );
  const paymentLines = [...paymentMap.values()].flat();
  return {
    cases,
    signoffs,
    summary: {
      cashAmount: money(
        paymentLines
          .filter((line) => line.kind === "cash")
          .reduce((total, line) => total + line.amount, 0),
      ),
      collectedAmount,
      creditAmount: money(
        paymentLines
          .filter((line) => line.kind === "credit")
          .reduce((total, line) => total + line.amount, 0),
      ),
      dischargedCount: cases.filter((otCase) => otCase.status === "discharged_today").length,
      onlineAmount: money(
        paymentLines
          .filter((line) => line.kind === "online")
          .reduce((total, line) => total + line.amount, 0),
      ),
      packageAmount,
      scheduledCount: cases.filter((otCase) => otCase.status === "scheduled").length,
      variance: money(packageAmount - collectedAmount),
    },
  };
}

export async function updateOtPackageAmount(
  caseId: string,
  businessDate: string,
  packageAmount: number,
  actorUserId: string,
): Promise<OtScheduleData> {
  const db = getDatabase();
  const [before] = await db
    .select({ amount: emrOtCases.packageAmount })
    .from(emrOtCases)
    .where(and(eq(emrOtCases.id, caseId), eq(emrOtCases.businessDate, businessDate)))
    .limit(1);
  if (!before) throw new Response("This OT case no longer exists.", { status: 404 });
  await db.transaction(async (transaction) => {
    await transaction
      .update(emrOtCases)
      .set({
        packageAmount: packageAmount.toFixed(2),
        packageUpdatedAt: new Date(),
        packageUpdatedByUserId: actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(emrOtCases.id, caseId));
    await transaction.insert(auditEvents).values({
      action: "ot.package-amount.updated",
      actorUserId,
      after: { businessDate, packageAmount },
      before: { packageAmount: before.amount === null ? null : Number(before.amount) },
      entityId: caseId,
      entityType: "ot-case",
      reason: "OT surgery package amount updated",
    });
  });
  return readOtSchedule(businessDate);
}

export async function signOffOtPackagePayments(
  businessDate: string,
  declaredAmount: number,
  note: string,
  actorUserId: string,
  signerRole: "admin" | "user",
): Promise<OtScheduleData> {
  const db = getDatabase();
  const calculatedAmount = (await readOtSchedule(businessDate)).summary.collectedAmount;
  const [before] = await db
    .select()
    .from(otPackageSignoffs)
    .where(
      and(
        eq(otPackageSignoffs.businessDate, businessDate),
        eq(otPackageSignoffs.signerRole, signerRole),
      ),
    )
    .limit(1);
  await db.transaction(async (transaction) => {
    await transaction
      .insert(otPackageSignoffs)
      .values({
        businessDate,
        calculatedAmount: calculatedAmount.toFixed(2),
        declaredAmount: declaredAmount.toFixed(2),
        note,
        signedByUserId: actorUserId,
        signerRole,
      })
      .onConflictDoUpdate({
        target: [otPackageSignoffs.businessDate, otPackageSignoffs.signerRole],
        set: {
          calculatedAmount: calculatedAmount.toFixed(2),
          declaredAmount: declaredAmount.toFixed(2),
          note,
          signedAt: new Date(),
          signedByUserId: actorUserId,
          updatedAt: new Date(),
        },
      });
    await transaction.insert(auditEvents).values({
      action: "ot.package-payments.signed-off",
      actorUserId,
      after: { businessDate, calculatedAmount, declaredAmount, note, signerRole },
      before: before ?? {},
      entityId: `${businessDate}:${signerRole}`,
      entityType: "ot-package-signoff",
      reason: note,
    });
  });
  return readOtSchedule(businessDate);
}

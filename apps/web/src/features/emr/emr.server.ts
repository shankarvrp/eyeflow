import { createDatabase } from "@eyeflow/db";
import { auditEvents, customers, emrAppointments, emrPatients } from "@eyeflow/db/schema";
import { and, asc, eq } from "drizzle-orm";

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

export async function importEmrAppointments(
  records: EmrAppointmentImport[],
  actorUserId: string,
): Promise<number> {
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
      after: { appointmentDate: records[0]?.appointmentDate ?? null, recordCount: records.length },
      before: {},
      entityId: records[0]?.appointmentDate ?? "unknown",
      entityType: "emr-sync",
      reason: "Authorized FOSS EHR patient appointment synchronization",
    });
  });
  return records.length;
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

  return rows.map((row) => ({
    displayName: row.displayName,
    externalPatientId: row.externalPatientId,
    hasEyeFlowRecord: Boolean(row.customerId),
    id: row.id,
    visitType: row.visitType,
  }));
}

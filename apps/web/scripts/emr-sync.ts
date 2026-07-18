import { stdout } from "node:process";
import { createDatabase } from "@eyeflow/db";
import { emrAppointments, emrPatients } from "@eyeflow/db/schema";
import { chromium } from "@playwright/test";
import { parseAppointmentListEntry, parseExternalPatientId } from "../src/features/emr/emr-scraper";
import {
  appointmentsUrl,
  clinicDateKey,
  emrBaseUrl,
  emrProfileDirectory,
  ensurePrivateProfileDirectory,
} from "./emr-config";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for EMR synchronization.");

const requestedDate = process.argv[2] ?? clinicDateKey();
if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
  throw new Error("Pass an optional synchronization date in YYYY-MM-DD format.");
}

await ensurePrivateProfileDirectory();
const context = await chromium.launchPersistentContext(emrProfileDirectory, { headless: true });
const page = context.pages()[0] ?? (await context.newPage());

try {
  await page.goto(appointmentsUrl(requestedDate), { waitUntil: "domcontentloaded" });
  if (!page.url().includes("/clinical/opd/appointments")) {
    throw new Error("The EMR session has expired. Run `pnpm emr:login` and sign in again.");
  }

  const rawAppointments = await page
    .locator('a[href^="/clinical/opd/appointments/"]')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        href: element.getAttribute("href") ?? "",
        text: (element as HTMLElement).innerText,
      })),
    );
  const appointmentMap = new Map(
    rawAppointments
      .map(({ href, text }) => parseAppointmentListEntry(href, text))
      .filter((entry) => entry !== null)
      .map((entry) => [entry.appointmentId, entry]),
  );

  const synchronized = [];
  for (const appointment of appointmentMap.values()) {
    await page.goto(new URL(appointment.href, emrBaseUrl).toString(), {
      waitUntil: "domcontentloaded",
    });
    const renderedText = await page.locator("body").innerText();
    const externalPatientId = parseExternalPatientId(renderedText);
    if (!externalPatientId) continue;
    synchronized.push({ ...appointment, externalPatientId });
  }

  const db = createDatabase(databaseUrl);
  await db.transaction(async (transaction) => {
    for (const record of synchronized) {
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
          appointmentDate: requestedDate,
          emrPatientId: patient.id,
          externalAppointmentId: record.appointmentId,
          source: "foss",
          visitType: record.visitType,
        })
        .onConflictDoUpdate({
          target: [emrAppointments.source, emrAppointments.externalAppointmentId],
          set: {
            appointmentDate: requestedDate,
            emrPatientId: patient.id,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
            visitType: record.visitType,
          },
        });
    }
  });

  const importedCount = synchronized.length;
  stdout.write(
    `Synchronized ${importedCount} EMR patient appointment${importedCount === 1 ? "" : "s"} for ${requestedDate}.\n`,
  );
} finally {
  await context.close();
}

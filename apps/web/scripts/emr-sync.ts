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
const allPatientFilterIds = ["all_occupied", "all_na", "all_completed"] as const;

try {
  await page.goto(appointmentsUrl(requestedDate), { waitUntil: "domcontentloaded" });
  if (!page.url().includes("/clinical/opd/appointments")) {
    throw new Error("The EMR session has expired. Run `pnpm emr:login` and sign in again.");
  }

  const appointmentMap = new Map<
    string,
    NonNullable<ReturnType<typeof parseAppointmentListEntry>>
  >();
  for (const filterId of allPatientFilterIds) {
    const controls = page.locator(`[data-table-id="${filterId}"]`).filter({ visible: true });
    await controls.waitFor({ state: "visible", timeout: 10_000 });
    if ((await controls.count()) !== 1) {
      throw new Error(`The EMR ${filterId} filter is unavailable or ambiguous.`);
    }
    await controls.click();
    await page.waitForFunction(
      (activeFilterId) =>
        document
          .querySelector(`[data-table-id="${activeFilterId}"]`)
          ?.classList.contains("active") ?? false,
      filterId,
    );
    await page.waitForTimeout(500);

    const rawAppointments = await page
      .locator('a[href^="/clinical/opd/appointments/"]')
      .filter({ visible: true })
      .evaluateAll((elements) =>
        elements.map((element) => ({
          href: element.getAttribute("href") ?? "",
          text: (element as HTMLElement).innerText,
        })),
      );
    for (const { href, text } of rawAppointments) {
      const appointment = parseAppointmentListEntry(href, text);
      if (appointment) appointmentMap.set(appointment.appointmentId, appointment);
    }
  }

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

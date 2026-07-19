import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";
import type { EmrAppointmentImport } from "./emr.server";
import {
  type AppointmentListEntry,
  parseAppointmentListEntry,
  parseExternalPatientId,
} from "./emr-scraper";

const sessionMarkerName = ".eyeflow-session";
let browserOperation: Promise<unknown> | undefined;

function baseUrl(): string {
  return (process.env.EMR_BASE_URL ?? "https://ehr.foss.health").replace(/\/$/, "");
}

function profileDirectory(): string {
  return path.resolve(process.cwd(), process.env.EMR_PROFILE_DIR ?? "../../.eyeflow/emr-profile");
}

function sessionMarkerPath(): string {
  return path.join(profileDirectory(), sessionMarkerName);
}

async function ensureProfileDirectory(): Promise<void> {
  await mkdir(profileDirectory(), { mode: 0o700, recursive: true });
}

function appointmentsUrl(date: string): string {
  const url = new URL("/clinical/opd/appointments", baseUrl());
  url.searchParams.set("current_date", date);
  return url.toString();
}

async function exclusiveBrowserOperation<T>(operation: () => Promise<T>): Promise<T> {
  if (browserOperation) throw new Error("An EMR browser operation is already running.");
  const pending = operation();
  browserOperation = pending;
  try {
    return await pending;
  } finally {
    browserOperation = undefined;
  }
}

export async function hasConnectedEmrSession(): Promise<boolean> {
  try {
    await access(sessionMarkerPath());
    return true;
  } catch {
    return false;
  }
}

export async function connectEmrBrowser(): Promise<void> {
  return exclusiveBrowserOperation(async () => {
    await ensureProfileDirectory();
    const { chromium } = await import("playwright");
    const context = await chromium.launchPersistentContext(profileDirectory(), { headless: false });
    const page = context.pages()[0] ?? (await context.newPage());
    try {
      await page.goto(appointmentsUrl(clinicDateKey()), { waitUntil: "domcontentloaded" });
      if (!page.url().includes("/clinical/opd/appointments")) {
        await page.waitForURL("**/clinical/opd/appointments**", { timeout: 5 * 60_000 });
      }
      await writeFile(sessionMarkerPath(), new Date().toISOString(), {
        encoding: "utf8",
        mode: 0o600,
      });
    } finally {
      await context.close();
    }
  });
}

export async function scrapeEmrAppointments(date: string): Promise<EmrAppointmentImport[]> {
  return exclusiveBrowserOperation(async () => {
    if (!(await hasConnectedEmrSession())) {
      throw new Error("EMR connection required. Ask an administrator to connect the EMR.");
    }
    const { chromium } = await import("playwright");
    const context = await chromium.launchPersistentContext(profileDirectory(), { headless: true });
    const page = context.pages()[0] ?? (await context.newPage());
    try {
      await page.goto(appointmentsUrl(date), { waitUntil: "domcontentloaded" });
      if (!page.url().includes("/clinical/opd/appointments")) {
        await invalidateSessionMarker();
        throw new Error("The EMR session expired. Ask an administrator to reconnect the EMR.");
      }

      const appointments = new Map<string, AppointmentListEntry>();
      for (const filter of ["Occupied", "Completed"] as const) {
        await selectAllPatientsFilter(page, filter);
        for (const appointment of await readVisibleAppointments(page)) {
          appointments.set(appointment.appointmentId, appointment);
        }
      }

      const records: EmrAppointmentImport[] = [];
      for (const appointment of appointments.values()) {
        await page.goto(new URL(appointment.href, baseUrl()).toString(), {
          waitUntil: "domcontentloaded",
        });
        await page.getByText("Patient ID", { exact: true }).waitFor({ timeout: 10_000 });
        const externalPatientId = parseExternalPatientId(await page.locator("body").innerText());
        if (!externalPatientId) continue;
        records.push({
          appointmentDate: date,
          externalAppointmentId: appointment.appointmentId,
          externalPatientId,
          patientName: appointment.patientName,
          visitType: appointment.visitType,
        });
      }

      await writeFile(sessionMarkerPath(), new Date().toISOString(), {
        encoding: "utf8",
        mode: 0o600,
      });
      return records;
    } finally {
      await context.close();
    }
  });
}

async function readVisibleAppointments(page: Page) {
  const rawAppointments = await page
    .locator('a[href^="/clinical/opd/appointments/"]')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        href: element.getAttribute("href") ?? "",
        text: (element as HTMLElement).innerText,
      })),
    );
  return rawAppointments
    .map(({ href, text }) => parseAppointmentListEntry(href, text))
    .filter((appointment) => appointment !== null);
}

async function selectAllPatientsFilter(page: Page, label: "Completed" | "Occupied") {
  const controls = page.getByText(label, { exact: true }).filter({ visible: true });
  const count = await controls.count();
  if (count === 0) throw new Error(`The EMR ${label} filter is unavailable.`);
  await controls.nth(count - 1).click();
  await page.waitForTimeout(300);
}

async function invalidateSessionMarker(): Promise<void> {
  try {
    await unlink(sessionMarkerPath());
  } catch {
    // Missing markers are already invalid.
  }
}

function clinicDateKey(date = new Date()): string {
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

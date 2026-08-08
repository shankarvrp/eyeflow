import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";
import type { EmrOtCaseImport, OtCaseStatus } from "../operations/ot-schema";
import { type OtTableSnapshot, parseOtTable } from "../operations/ot-scraper";
import type { EmrAppointmentImport } from "./emr.server";
import { type EmrReceiptImport, parseEmrReceiptPdf } from "./emr-receipt-parser";
import {
  type AppointmentListEntry,
  parseAppointmentListEntry,
  parseExternalPatientId,
} from "./emr-scraper";

const sessionMarkerName = ".eyeflow-session";
const allPatientFilterIds = ["all_occupied", "all_na", "all_completed"] as const;
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

function receiptsUrl(date: string): string {
  const url = new URL("/reports/daily_collection_report.pdf", baseUrl());
  url.searchParams.set("date", date);
  url.searchParams.set("location", "All Collection");
  return url.toString();
}

function configuredOtUrl(): string | null {
  const path = process.env.EMR_OT_PAGE_PATH?.trim();
  return path ? new URL(path, baseUrl()).toString() : null;
}

function isAppointmentsUrl(url: string): boolean {
  return url.includes("/clinical/opd/appointments");
}

function isLoginUrl(url: string): boolean {
  return url.includes("/users/login");
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
      const targetUrl = appointmentsUrl(clinicDateKey());
      await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

      if (isLoginUrl(page.url())) {
        await page.waitForURL((url) => !isLoginUrl(url.toString()), { timeout: 5 * 60_000 });
      }

      if (!isAppointmentsUrl(page.url())) {
        await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
      }

      if (!isAppointmentsUrl(page.url())) {
        throw new Error(
          "EMR login did not reach the appointments page. Please try connecting again.",
        );
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
      for (const filterId of allPatientFilterIds) {
        await selectAllPatientsFilter(page, filterId);
        for (const appointment of await readVisibleAppointments(page)) {
          appointments.set(appointment.appointmentId, appointment);
        }
      }

      const records: EmrAppointmentImport[] = [];
      for (const appointment of appointments.values()) {
        try {
          await page.goto(new URL(appointment.href, baseUrl()).toString(), {
            timeout: 20_000,
            waitUntil: "commit",
          });
          await page.getByText("Patient ID", { exact: true }).waitFor({ timeout: 15_000 });
          const externalPatientId = parseExternalPatientId(await page.locator("body").innerText());
          if (!externalPatientId) continue;
          records.push({
            appointmentDate: date,
            externalAppointmentId: appointment.appointmentId,
            externalPatientId,
            patientName: appointment.patientName,
            scheduledAt: new Date(`${date}T${appointment.scheduledTime}:00+05:30`).toISOString(),
            visitType: appointment.visitType,
          });
        } catch {
          // A single slow or malformed EMR appointment must not prevent the day's
          // receipt synchronization or the remaining patient list from completing.
        }
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

export async function scrapeEmrReceipts(date: string): Promise<EmrReceiptImport[]> {
  return exclusiveBrowserOperation(async () => {
    if (!(await hasConnectedEmrSession())) {
      throw new Error("EMR connection required. Ask an administrator to connect the EMR.");
    }
    const { chromium } = await import("playwright");
    const context = await chromium.launchPersistentContext(profileDirectory(), { headless: true });
    try {
      const response = await context.request.get(receiptsUrl(date));
      if (!response.ok() || !response.headers()["content-type"]?.includes("application/pdf")) {
        await invalidateSessionMarker();
        throw new Error("The EMR session expired or the collection report is unavailable.");
      }
      const records = await parseEmrReceiptPdf(new Uint8Array(await response.body()), date);
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

export async function scrapeEmrOtCases(date: string): Promise<EmrOtCaseImport[]> {
  return exclusiveBrowserOperation(async () => {
    if (!(await hasConnectedEmrSession())) {
      throw new Error("EMR connection required. Ask an administrator to connect the EMR.");
    }
    const { chromium } = await import("playwright");
    const context = await chromium.launchPersistentContext(profileDirectory(), { headless: true });
    const page = context.pages()[0] ?? (await context.newPage());
    try {
      await page.goto(appointmentsUrl(date), { waitUntil: "domcontentloaded" });
      if (isLoginUrl(page.url())) {
        await invalidateSessionMarker();
        throw new Error("The EMR session expired. Ask an administrator to reconnect the EMR.");
      }

      const otUrl = configuredOtUrl() ?? (await discoverOtPageUrl(page));
      await page.goto(otUrl, { waitUntil: "domcontentloaded" });
      if (isLoginUrl(page.url())) {
        await invalidateSessionMarker();
        throw new Error("The EMR session expired. Ask an administrator to reconnect the EMR.");
      }

      await selectOtDepartment(page);
      await setOtDate(page, date);
      const records = new Map<string, EmrOtCaseImport>();
      for (const status of ["scheduled", "discharged_today"] as const) {
        await selectOtStatus(page, status);
        const snapshot = await readOtTable(page);
        const parsed = parseOtTable(snapshot, date, status);
        for (const record of await enrichOtPatientIds(context, snapshot, parsed)) {
          const existing = records.get(record.externalCaseId);
          if (!existing || record.status === "discharged_today") {
            records.set(record.externalCaseId, record);
          }
        }
      }

      await writeFile(sessionMarkerPath(), new Date().toISOString(), {
        encoding: "utf8",
        mode: 0o600,
      });
      return [...records.values()];
    } finally {
      await context.close();
    }
  });
}

async function discoverOtPageUrl(page: Page): Promise<string> {
  const candidates = await page.locator("a[href]").evaluateAll((elements) =>
    elements.map((element) => ({
      href: element.getAttribute("href") ?? "",
      text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
    })),
  );
  const scored = candidates
    .map((candidate) => {
      const haystack = `${candidate.text} ${candidate.href}`.toLocaleLowerCase();
      let score = 0;
      if (/\boperation\s*theatre\b|\bot\b/.test(haystack)) score += 100;
      if (/surgery|theatre/.test(haystack)) score += 50;
      if (/appointment_managements/.test(haystack)) score += 20;
      if (!candidate.href || candidate.href.startsWith("#")) score = 0;
      return { ...candidate, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);
  const selected = scored[0];
  if (!selected) {
    throw new Error(
      "The FOSS OT page could not be found. Set EMR_OT_PAGE_PATH if the navigation label has changed.",
    );
  }
  return new URL(selected.href, baseUrl()).toString();
}

interface SelectDescription {
  index: number;
  options: Array<{ label: string; value: string }>;
}

async function describeSelects(page: Page): Promise<SelectDescription[]> {
  return page.locator("select").evaluateAll((elements) =>
    elements.map((element, index) => ({
      index,
      options: [...(element as HTMLSelectElement).options].map((option) => ({
        label: (option.textContent ?? "").replace(/\s+/g, " ").trim(),
        value: option.value,
      })),
    })),
  );
}

async function selectOtDepartment(page: Page): Promise<void> {
  const select = (await describeSelects(page)).find((description) =>
    description.options.some((option) =>
      /^(ot|operation theatre|operation theater)$/i.test(option.label),
    ),
  );
  if (!select) return;
  const option = select.options.find((candidate) =>
    /^(ot|operation theatre|operation theater)$/i.test(candidate.label),
  );
  if (!option) return;
  await page.locator("select").nth(select.index).selectOption(option.value);
  await page.waitForTimeout(500);
}

async function setOtDate(page: Page, date: string): Promise<void> {
  const controls = page.locator(
    'input[type="date"][name*="date" i], input[type="date"][id*="date" i]',
  );
  if ((await controls.count()) === 0) return;
  await controls.nth(0).fill(date);
  await controls.nth(0).press("Enter");
  await page.waitForTimeout(500);
}

async function selectOtStatus(page: Page, status: OtCaseStatus): Promise<void> {
  const expectedLabel = status === "scheduled" ? "scheduled" : "discharged today";
  const select = (await describeSelects(page)).find((description) =>
    description.options.some((option) => option.label.toLocaleLowerCase() === expectedLabel),
  );
  if (!select) throw new Error(`The FOSS OT ${expectedLabel} filter is unavailable.`);
  const option = select.options.find(
    (candidate) => candidate.label.toLocaleLowerCase() === expectedLabel,
  );
  if (!option) throw new Error(`The FOSS OT ${expectedLabel} option is unavailable.`);
  await page.locator("select").nth(select.index).selectOption(option.value);
  await page.waitForTimeout(750);
}

async function readOtTable(page: Page): Promise<OtTableSnapshot> {
  await expandOtTableRows(page);
  const tables = await page.locator("table").evaluateAll((elements) =>
    elements.map((element) => ({
      headers: [...element.querySelectorAll("thead th")].map((header) =>
        (header.textContent ?? "").replace(/\s+/g, " ").trim(),
      ),
      rows: [...element.querySelectorAll("tbody tr")]
        .filter((row) => (row as HTMLElement).offsetParent !== null)
        .map((row) => ({
          cells: [...row.querySelectorAll("td")].map((tableCell) =>
            (tableCell.textContent ?? "").replace(/\s+/g, " ").trim(),
          ),
          href: row.querySelector("a[href]")?.getAttribute("href") ?? null,
        })),
    })),
  );
  const table = tables.find((candidate) =>
    candidate.headers.some((header) => /patient|name/i.test(header)),
  );
  if (!table) {
    throw new Error(
      "The FOSS OT surgery table could not be found. The upstream page layout may have changed.",
    );
  }
  return table;
}

async function expandOtTableRows(page: Page): Promise<void> {
  const descriptions = await describeSelects(page);
  const pageLength = descriptions.find(
    (description) =>
      description.options.some((option) => /^all$/i.test(option.label)) &&
      description.options.filter((option) => /^\d+$/.test(option.label)).length >= 2,
  );
  if (!pageLength) return;
  const all = pageLength.options.find((option) => /^all$/i.test(option.label));
  if (!all) return;
  await page.locator("select").nth(pageLength.index).selectOption(all.value);
  await page.waitForTimeout(300);
}

async function enrichOtPatientIds(
  context: import("playwright").BrowserContext,
  snapshot: OtTableSnapshot,
  records: EmrOtCaseImport[],
): Promise<EmrOtCaseImport[]> {
  if (snapshot.headers.some((header) => /patient\s*(id|no)|uhid|mr\s*no/i.test(header))) {
    return records;
  }
  const detailPage = await context.newPage();
  try {
    const enriched: EmrOtCaseImport[] = [];
    for (const [index, record] of records.entries()) {
      const href = snapshot.rows[index]?.href;
      if (!href) continue;
      try {
        await detailPage.goto(new URL(href, baseUrl()).toString(), {
          timeout: 20_000,
          waitUntil: "domcontentloaded",
        });
        const externalPatientId = parseExternalPatientId(
          await detailPage.locator("body").innerText(),
        );
        if (externalPatientId) enriched.push({ ...record, externalPatientId });
      } catch {
        // One malformed case must not prevent the remaining OT list from syncing.
      }
    }
    return enriched;
  } finally {
    await detailPage.close();
  }
}

async function readVisibleAppointments(page: Page) {
  const rawAppointments = await page
    .locator('a[href^="/clinical/opd/appointments/"]')
    .filter({ visible: true })
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

async function selectAllPatientsFilter(page: Page, filterId: (typeof allPatientFilterIds)[number]) {
  const controls = page.locator(`[data-table-id="${filterId}"]`).filter({ visible: true });
  await controls.waitFor({ state: "visible", timeout: 10_000 });
  const count = await controls.count();
  if (count !== 1) throw new Error(`The EMR ${filterId} filter is unavailable or ambiguous.`);
  await controls.click();
  await page.waitForFunction(
    (activeFilterId) =>
      document.querySelector(`[data-table-id="${activeFilterId}"]`)?.classList.contains("active") ??
      false,
    filterId,
  );
  await page.waitForTimeout(500);
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

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), "../../.env"), quiet: true });

export const emrBaseUrl = (process.env.EMR_BASE_URL ?? "https://ehr.foss.health").replace(
  /\/$/,
  "",
);

export const emrProfileDirectory = path.resolve(
  process.cwd(),
  process.env.EMR_PROFILE_DIR ?? "../../.eyeflow/emr-profile",
);

export async function ensurePrivateProfileDirectory(): Promise<void> {
  await mkdir(emrProfileDirectory, { mode: 0o700, recursive: true });
}

export function appointmentsUrl(date: string): string {
  const url = new URL("/clinical/opd/appointments", emrBaseUrl);
  url.searchParams.set("current_date", date);
  return url.toString();
}

export function clinicDateKey(date = new Date()): string {
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

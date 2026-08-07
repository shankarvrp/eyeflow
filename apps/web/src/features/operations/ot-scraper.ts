import type { EmrOtCaseImport, OtCaseStatus } from "./ot-schema";

export interface OtTableSnapshot {
  headers: string[];
  rows: Array<{ cells: string[]; href: string | null }>;
}

const patientHeaderPattern = /patient|name/i;
const patientIdHeaderPattern = /patient\s*(id|no)|uhid|mr\s*no/i;
const procedureHeaderPattern = /procedure|surgery|operation/i;
const surgeonHeaderPattern = /surgeon|doctor|consultant/i;
const timeHeaderPattern = /scheduled|date|time/i;

function normalized(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function indexFor(headers: string[], pattern: RegExp): number {
  return headers.findIndex((header) => pattern.test(header));
}

function cell(cells: string[], index: number): string | null {
  if (index < 0) return null;
  const value = normalized(cells[index] ?? "");
  return value.length > 0 ? value : null;
}

function idFromHref(href: string | null): string | null {
  if (!href) return null;
  const path = href.split("?")[0] ?? "";
  const match = path.match(/\/([^/]+)$/);
  return match?.[1] ?? null;
}

function parseScheduledAt(value: string | null, businessDate: string): string | null {
  if (!value) return null;
  const time = value.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b/i);
  if (!time) return null;
  let hour = Number(time[1]);
  const minute = Number(time[2]);
  const suffix = time[3]?.toUpperCase();
  if (suffix === "PM" && hour < 12) hour += 12;
  if (suffix === "AM" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return new Date(
    `${businessDate}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00+05:30`,
  ).toISOString();
}

export function parseOtTable(
  snapshot: OtTableSnapshot,
  businessDate: string,
  status: OtCaseStatus,
): EmrOtCaseImport[] {
  const headers = snapshot.headers.map(normalized);
  const patientIndex = indexFor(headers, patientHeaderPattern);
  const patientIdIndex = indexFor(headers, patientIdHeaderPattern);
  const procedureIndex = indexFor(headers, procedureHeaderPattern);
  const surgeonIndex = indexFor(headers, surgeonHeaderPattern);
  const timeIndex = indexFor(headers, timeHeaderPattern);

  return snapshot.rows.flatMap((row, rowIndex) => {
    const patientName = cell(row.cells, patientIndex) ?? normalized(row.cells[0] ?? "");
    const externalPatientId = cell(row.cells, patientIdIndex) ?? idFromHref(row.href);
    if (!patientName || !externalPatientId) return [];
    const externalCaseId =
      idFromHref(row.href) ?? `${externalPatientId}:${businessDate}:${rowIndex}`;
    return [
      {
        businessDate,
        externalCaseId,
        externalPatientId,
        patientName,
        procedureName: cell(row.cells, procedureIndex),
        scheduledAt: parseScheduledAt(cell(row.cells, timeIndex), businessDate),
        status,
        surgeonName: cell(row.cells, surgeonIndex),
      },
    ];
  });
}

const appointmentPathPattern = /\/clinical\/opd\/appointments\/([a-z0-9]+)(?:\?|$)/i;
const patientIdPattern = /Patient\s+ID\s+([A-Z0-9-]+)/i;
const visitTypes = ["New", "Re visit", "Post OP"] as const;

export interface AppointmentListEntry {
  appointmentId: string;
  href: string;
  patientName: string;
  visitType: string | null;
}

export function parseAppointmentListEntry(
  href: string,
  renderedText: string,
): AppointmentListEntry | null {
  const appointmentId = href.match(appointmentPathPattern)?.[1];
  const lines = renderedText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!appointmentId || lines.length < 2 || !/^\d{1,2}:\d{2}$/.test(lines[0] ?? "")) {
    return null;
  }

  const patientName = lines[1];
  if (!patientName) return null;

  return {
    appointmentId,
    href,
    patientName,
    visitType: visitTypes.find((visitType) => lines.includes(visitType)) ?? null,
  };
}

export function parseExternalPatientId(renderedText: string): string | null {
  return renderedText.replace(/\s+/g, " ").match(patientIdPattern)?.[1] ?? null;
}

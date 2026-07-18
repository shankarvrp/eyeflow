import { describe, expect, it } from "vitest";
import { parseAppointmentListEntry, parseExternalPatientId } from "./emr-scraper";

describe("EMR scraper parsing", () => {
  it("extracts an appointment without retaining clinical details", () => {
    expect(
      parseAppointmentListEntry(
        "/clinical/opd/appointments/abc123?current_date=2026-07-18",
        "11:48\nExample Patient\nFemale\n12 yr\n01:07\nNew\nW /Clinician",
      ),
    ).toEqual({
      appointmentId: "abc123",
      href: "/clinical/opd/appointments/abc123?current_date=2026-07-18",
      patientName: "Example Patient",
      visitType: "New",
    });
  });

  it("extracts the stable patient number from a detail page", () => {
    expect(parseExternalPatientId("Patient ID\nMIR-PAT-000001\nReferral\nNone")).toBe(
      "MIR-PAT-000001",
    );
  });

  it("rejects navigation links that are not appointment records", () => {
    expect(
      parseAppointmentListEntry("/clinical/opd/appointments/search_patient?id=new", "Appointment"),
    ).toBeNull();
  });
});

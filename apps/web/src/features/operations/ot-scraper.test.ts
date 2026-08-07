import { describe, expect, it } from "vitest";
import { parseOtTable } from "./ot-scraper";

describe("parseOtTable", () => {
  it("maps a scheduled OT row using its patient and case identifiers", () => {
    expect(
      parseOtTable(
        {
          headers: ["Patient Name", "Patient ID", "Procedure", "Surgeon", "Scheduled Time"],
          rows: [
            {
              cells: ["Asha N", "P-120", "Cataract", "Dr Rao", "10:30 AM"],
              href: "/clinical/ot/schedules/CASE-45",
            },
          ],
        },
        "2026-08-07",
        "scheduled",
      ),
    ).toEqual([
      expect.objectContaining({
        externalCaseId: "CASE-45",
        externalPatientId: "P-120",
        patientName: "Asha N",
        procedureName: "Cataract",
        status: "scheduled",
        surgeonName: "Dr Rao",
      }),
    ]);
  });

  it("uses the detail link identifier when the table has no patient id column", () => {
    const [record] = parseOtTable(
      {
        headers: ["Patient", "Operation"],
        rows: [{ cells: ["Mohan K", "Retina"], href: "/patients/P-501" }],
      },
      "2026-08-07",
      "discharged_today",
    );
    expect(record).toMatchObject({
      externalPatientId: "P-501",
      patientName: "Mohan K",
      status: "discharged_today",
    });
  });
});

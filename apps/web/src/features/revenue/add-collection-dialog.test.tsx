import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EmrPatientOption } from "../emr/emr.server";
import { AddCollectionDialog } from "./add-collection-dialog";

describe("AddCollectionDialog EMR picker", () => {
  it("shows every synchronized patient without truncating the list", async () => {
    const patientOptions: EmrPatientOption[] = Array.from({ length: 30 }, (_, index) => ({
      displayName: `Patient ${String(index + 1).padStart(2, "0")}`,
      externalPatientId: `EF-${index + 1}`,
      hasEyeFlowRecord: false,
      id: `patient-${index + 1}`,
      visitType: "New",
    }));

    render(
      <AddCollectionDialog
        allowedDepartments={["OPD", "Pharmacy"]}
        canChooseDate
        defaultOccurredOn="2026-07-18"
        loadPatientOptions={vi.fn(async () => patientOptions)}
        onAdd={vi.fn(async () => undefined)}
        onOpenChange={vi.fn()}
        open
      />,
    );

    await screen.findByText("30 synchronized patients · 2026-07-18");
    await waitFor(() =>
      expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(30),
    );
  });
});

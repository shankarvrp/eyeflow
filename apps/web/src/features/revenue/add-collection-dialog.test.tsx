import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EmrPatientOption, EmrReceiptDraft } from "../emr/emr.server";
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
        loadReceiptDrafts={vi.fn(async () => [])}
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

  it("prefills mapped receipt drafts while keeping them editable", async () => {
    render(
      <AddCollectionDialog
        allowedDepartments={["OPD", "Pharmacy", "OT"]}
        canChooseDate
        defaultOccurredOn="2026-07-18"
        loadPatientOptions={vi.fn(async () => [
          {
            displayName: "Receipt Patient",
            externalPatientId: "MIR-PAT-1",
            hasEyeFlowRecord: false,
            id: "85e5fbd0-e420-4f80-9a93-f5dac9190af8",
            visitType: "New",
          },
        ])}
        loadReceiptDrafts={vi.fn(
          async (): Promise<EmrReceiptDraft[]> => [
            {
              amount: 750,
              department: "Pharmacy",
              externalReceiptId: "MIR-INV-1-01",
              mode: "online",
              providerOrMode: "Google Pay",
              receiptId: "4a199461-fb2c-4c9f-aa37-ca776d4bb1e7",
              requiresReview: false,
              sourceDepartment: "Pharmacy",
            },
          ],
        )}
        onAdd={vi.fn(async () => undefined)}
        onOpenChange={vi.fn()}
        open
      />,
    );

    fireEvent.click(await screen.findByRole("option", { name: /Receipt Patient/ }));
    expect(await screen.findByText("1 receipt prefilled")).toBeInTheDocument();
    expect(screen.getByText("EMR · MIR-INV-1-01")).toBeInTheDocument();
    expect(
      screen
        .getAllByLabelText("Pharmacy payment 1 amount")
        .some((element) => (element as HTMLInputElement).value === "750"),
    ).toBe(true);
    expect(
      screen
        .getAllByLabelText("Pharmacy payment 1 mode")
        .some((element) => (element as HTMLSelectElement).value === "online"),
    ).toBe(true);
  });
});

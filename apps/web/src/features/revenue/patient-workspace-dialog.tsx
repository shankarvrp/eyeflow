import type { DepartmentName } from "@eyeflow/shared";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@eyeflow/ui";
import { Check, Eye, IndianRupee, LockKeyhole } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PatientCollectionSummary, RecentCollection } from "../dashboard/dashboard-data";
import {
  creditProviders,
  onlineModes,
  type PatientCollectionUpdate,
  type PatientWorkspaceUpdate,
  patientWorkspaceUpdateSchema,
} from "./collection-schema";

interface PatientWorkspaceDialogProps {
  allowedDepartments: readonly DepartmentName[];
  onOpenChange: (open: boolean) => void;
  onSave: (workspace: PatientWorkspaceUpdate) => Promise<void>;
  open: boolean;
  workspace: PatientCollectionSummary | null;
}

interface EditableCollection extends PatientCollectionUpdate {
  canEdit: boolean;
  occurredAt: string;
}

const modeValues = {
  Cash: "cash",
  Credit: "credit",
  Online: "online",
} as const;

export function PatientWorkspaceDialog({
  allowedDepartments,
  onOpenChange,
  onSave,
  open,
  workspace,
}: PatientWorkspaceDialogProps) {
  const [patient, setPatient] = useState("");
  const [collections, setCollections] = useState<EditableCollection[]>([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  useEffect(() => {
    if (!workspace) return;
    setPatient(workspace.patient);
    setCollections(workspace.collections.map(toEditableCollection));
    setReason("");
    setSubmitError(undefined);
  }, [workspace]);

  const editableCollections = useMemo(
    () => collections.filter((collection) => collection.canEdit),
    [collections],
  );
  const total = collections.reduce(
    (sum, collection) => sum + collection.amount - collection.discount,
    0,
  );

  const updateCollection = (
    id: string,
    update: (collection: EditableCollection) => EditableCollection,
  ) => {
    setCollections((current) =>
      current.map((collection) => (collection.id === id ? update(collection) : collection)),
    );
  };

  const submit = async () => {
    if (!workspace) return;
    const parsed = patientWorkspaceUpdateSchema.safeParse({
      collections: editableCollections.map(
        ({ canEdit: _canEdit, occurredAt: _occurredAt, ...row }) => row,
      ),
      customerId: workspace.customerId,
      patient,
      reason,
    });
    if (!parsed.success) {
      setSubmitError(parsed.error.issues[0]?.message ?? "Review the patient collections.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(undefined);
      await onSave(parsed.data);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to update the patient collections.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Patient collection workspace</DialogTitle>
          <DialogDescription>
            Review every payment together. Editable rows follow your role and collection date.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5 p-5 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <label>
              <span className="form-label">Patient name</span>
              <input
                className="form-control"
                disabled={editableCollections.length === 0}
                maxLength={120}
                onChange={(event) => setPatient(event.target.value)}
                value={patient}
              />
            </label>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--subtle-panel)] px-5 py-3">
              <p className="text-xs text-[var(--muted)]">Consolidated total</p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(total)}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
            <table className="w-full min-w-[1000px] text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--subtle-panel)] text-xs uppercase tracking-wider text-[var(--muted)]">
                  <th className="px-4 py-3 font-semibold">Date / status</th>
                  <th className="px-3 py-3 font-semibold">Department</th>
                  <th className="px-3 py-3 font-semibold">Mode</th>
                  <th className="px-3 py-3 font-semibold">Provider / mode</th>
                  <th className="px-3 py-3 font-semibold">Gross</th>
                  <th className="px-3 py-3 font-semibold">Discount</th>
                  <th className="px-4 py-3 text-right font-semibold">Final</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((collection) => {
                  const options = collection.mode === "credit" ? creditProviders : onlineModes;
                  return (
                    <tr
                      className="border-b border-[var(--border)] last:border-0"
                      key={collection.id}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{formatDate(collection.occurredAt)}</p>
                        <span className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--muted)]">
                          {collection.canEdit ? <Eye size={12} /> : <LockKeyhole size={12} />}
                          {collection.canEdit ? "Editable" : "Locked"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          aria-label={`${workspace?.patient ?? "Patient"} department ${collection.id}`}
                          className="form-control min-w-36"
                          disabled={!collection.canEdit}
                          onChange={(event) =>
                            updateCollection(collection.id, (current) => ({
                              ...current,
                              department: event.target.value as DepartmentName,
                            }))
                          }
                          value={collection.department}
                        >
                          {allowedDepartments.map((department) => (
                            <option key={department}>{department}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          aria-label={`${workspace?.patient ?? "Patient"} payment mode ${collection.id}`}
                          className="form-control min-w-28"
                          disabled={!collection.canEdit}
                          onChange={(event) =>
                            updateCollection(collection.id, (current) => ({
                              ...current,
                              mode: event.target.value as PatientCollectionUpdate["mode"],
                              providerOrMode: event.target.value === "cash" ? null : "",
                            }))
                          }
                          value={collection.mode}
                        >
                          <option value="cash">Cash</option>
                          <option value="credit">Credit</option>
                          <option value="online">Online</option>
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        {collection.mode === "cash" ? (
                          <span className="px-3 text-sm text-[var(--muted)]">Not required</span>
                        ) : (
                          <select
                            aria-label={`${workspace?.patient ?? "Patient"} provider or mode ${collection.id}`}
                            className="form-control min-w-36"
                            disabled={!collection.canEdit}
                            onChange={(event) =>
                              updateCollection(collection.id, (current) => ({
                                ...current,
                                providerOrMode: event.target.value || null,
                              }))
                            }
                            value={collection.providerOrMode ?? ""}
                          >
                            <option value="">Select</option>
                            {options.map((option) => (
                              <option key={option}>{option}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <MoneyInput
                          collection={collection}
                          field="amount"
                          onChange={updateCollection}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <MoneyInput
                          collection={collection}
                          field="discount"
                          onChange={updateCollection}
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold">
                        {formatCurrency(collection.amount - collection.discount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {editableCollections.length > 0 ? (
            <label>
              <span className="form-label">Reason for changes</span>
              <input
                className="form-control"
                maxLength={240}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Corrected payment entry"
                value={reason}
              />
            </label>
          ) : null}

          {submitError ? (
            <p
              className="rounded-xl border border-rose-500/20 bg-rose-500/[0.07] px-4 py-3 text-sm font-medium text-rose-600 dark:text-rose-300"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-5">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Close
              </Button>
            </DialogClose>
            {editableCollections.length > 0 ? (
              <Button disabled={submitting} type="submit">
                <Check size={17} />
                {submitting ? "Saving…" : "Save patient changes"}
              </Button>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toEditableCollection(collection: RecentCollection): EditableCollection {
  return {
    amount: collection.amount + collection.discount,
    canEdit: collection.canEdit,
    department: collection.department,
    discount: collection.discount,
    id: collection.id,
    mode: modeValues[collection.mode],
    occurredAt: collection.occurredAt,
    providerOrMode: collection.providerOrMode,
  };
}

function MoneyInput({
  collection,
  field,
  onChange,
}: {
  collection: EditableCollection;
  field: "amount" | "discount";
  onChange: (id: string, update: (collection: EditableCollection) => EditableCollection) => void;
}) {
  return (
    <div className="relative min-w-28">
      <IndianRupee
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        size={14}
      />
      <input
        aria-label={`Patient ${field} ${collection.id}`}
        className="form-control pl-8"
        disabled={!collection.canEdit}
        min="0"
        onChange={(event) =>
          onChange(collection.id, (current) => ({
            ...current,
            [field]: Math.max(0, Number(event.target.value || 0)),
          }))
        }
        step="0.01"
        type="number"
        value={collection[field]}
      />
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Math.max(0, value));
}

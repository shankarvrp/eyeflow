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
import { Check, IndianRupee } from "lucide-react";
import { useMemo, useState } from "react";
import {
  collectionBatchSchema,
  creditProviders,
  type DepartmentCollection,
  emptyDepartmentCollection,
  type NewCollectionBatch,
  onlineModes,
} from "./collection-schema";

interface AddCollectionDialogProps {
  allowedDepartments: readonly DepartmentName[];
  onAdd: (collection: NewCollectionBatch) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AmountField = "cash" | "credit" | "discount" | "online";

export function AddCollectionDialog({
  allowedDepartments,
  onAdd,
  onOpenChange,
  open,
}: AddCollectionDialogProps) {
  const createRows = () => allowedDepartments.map(emptyDepartmentCollection);
  const [patient, setPatient] = useState("");
  const [rows, setRows] = useState<DepartmentCollection[]>(createRows);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const totals = useMemo(
    () =>
      rows.reduce(
        (result, row) => ({
          discount: result.discount + row.discount,
          gross: result.gross + row.cash + row.credit + row.online,
          net: result.net + row.cash + row.credit + row.online - row.discount,
          payments:
            result.payments +
            Number(row.cash > 0) +
            Number(row.credit > 0) +
            Number(row.online > 0),
        }),
        { discount: 0, gross: 0, net: 0, payments: 0 },
      ),
    [rows],
  );

  const reset = () => {
    setPatient("");
    setRows(createRows());
    setSubmitError(undefined);
  };

  const updateRow = (
    department: DepartmentName,
    update: (row: DepartmentCollection) => DepartmentCollection,
  ) => {
    setRows((current) => current.map((row) => (row.department === department ? update(row) : row)));
  };

  const submit = async () => {
    const parsed = collectionBatchSchema.safeParse({ departments: rows, patient });
    if (!parsed.success) {
      setSubmitError(parsed.error.issues[0]?.message ?? "Review the collection amounts.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(undefined);
      await onAdd(parsed.data);
      onOpenChange(false);
      reset();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save these collections.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Add patient collections</DialogTitle>
          <DialogDescription>
            Enter every department payment for this patient, then save them together.
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
                autoComplete="off"
                autoFocus
                className="form-control"
                maxLength={120}
                onChange={(event) => setPatient(event.target.value)}
                placeholder="e.g. Anita Rao"
                value={patient}
              />
            </label>
            <div className="flex min-h-11 items-center gap-5 rounded-xl border border-[var(--border)] bg-[var(--subtle-panel)] px-4">
              <SummaryValue label="Payments" value={String(totals.payments)} />
              <SummaryValue label="Discount" value={formatCurrency(totals.discount)} />
              <SummaryValue label="Final total" value={formatCurrency(totals.net)} strong />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
            <table className="w-full min-w-[1000px] text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--subtle-panel)] text-xs uppercase tracking-wider text-[var(--muted)]">
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-3 py-3 font-semibold">Cash</th>
                  <th className="px-3 py-3 font-semibold">Credit</th>
                  <th className="px-3 py-3 font-semibold">Provider</th>
                  <th className="px-3 py-3 font-semibold">Online</th>
                  <th className="px-3 py-3 font-semibold">Mode</th>
                  <th className="px-3 py-3 font-semibold">Discount</th>
                  <th className="px-4 py-3 text-right font-semibold">Final</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const gross = row.cash + row.credit + row.online;
                  const invalidDiscount = row.discount > gross;
                  return (
                    <tr
                      className="border-b border-[var(--border)] last:border-0"
                      key={row.department}
                    >
                      <td className="px-4 py-4">
                        <span className="font-semibold">{row.department}</span>
                      </td>
                      <td className="px-3 py-3">
                        <GridMoneyInput
                          department={row.department}
                          field="cash"
                          onChange={updateRow}
                          value={row.cash}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <GridMoneyInput
                          department={row.department}
                          field="credit"
                          onChange={updateRow}
                          value={row.credit}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <select
                          aria-label={`${row.department} credit provider`}
                          className="form-control min-w-32"
                          disabled={row.credit === 0}
                          onChange={(event) =>
                            updateRow(row.department, (current) => ({
                              ...current,
                              creditProvider: event.target.value || null,
                            }))
                          }
                          value={row.creditProvider ?? ""}
                        >
                          <option value="">Select</option>
                          {creditProviders.map((provider) => (
                            <option key={provider}>{provider}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <GridMoneyInput
                          department={row.department}
                          field="online"
                          onChange={updateRow}
                          value={row.online}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <select
                          aria-label={`${row.department} online mode`}
                          className="form-control min-w-28"
                          disabled={row.online === 0}
                          onChange={(event) =>
                            updateRow(row.department, (current) => ({
                              ...current,
                              onlineMode: event.target.value || null,
                            }))
                          }
                          value={row.onlineMode ?? ""}
                        >
                          <option value="">Select</option>
                          {onlineModes.map((mode) => (
                            <option key={mode}>{mode}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <GridMoneyInput
                          department={row.department}
                          field="discount"
                          invalid={invalidDiscount}
                          onChange={updateRow}
                          value={row.discount}
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold">
                        {formatCurrency(Math.max(0, gross - row.discount))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
                Cancel
              </Button>
            </DialogClose>
            <Button disabled={submitting} type="submit">
              {submitting ? (
                "Saving…"
              ) : (
                <>
                  <Check size={17} />
                  {`Add ${totals.payments || ""} payment${totals.payments === 1 ? "" : "s"}`}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface GridMoneyInputProps {
  department: DepartmentName;
  field: AmountField;
  invalid?: boolean;
  onChange: (
    department: DepartmentName,
    update: (row: DepartmentCollection) => DepartmentCollection,
  ) => void;
  value: number;
}

function GridMoneyInput({
  department,
  field,
  invalid = false,
  onChange,
  value,
}: GridMoneyInputProps) {
  return (
    <div className="relative min-w-28">
      <IndianRupee
        aria-hidden="true"
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        size={14}
      />
      <input
        aria-invalid={invalid}
        aria-label={`${department} ${field}`}
        className="form-control pl-8"
        inputMode="decimal"
        min="0"
        onChange={(event) => {
          const amount = Math.max(0, Number(event.target.value || 0));
          onChange(department, (row) => ({
            ...row,
            [field]: Number.isFinite(amount) ? amount : 0,
          }));
        }}
        step="0.01"
        type="number"
        value={value || ""}
      />
    </div>
  );
}

function SummaryValue({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{label}</p>
      <p className={strong ? "font-bold text-emerald-600 dark:text-emerald-300" : "font-semibold"}>
        {value}
      </p>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

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
import { CalendarDays, Check, IndianRupee, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EmrPatientOption } from "../emr/emr.server";
import {
  collectionBatchSchema,
  creditProviders,
  emptyPaymentLine,
  type NewCollectionBatch,
  type NewPaymentLine,
  onlineModes,
} from "./collection-schema";

interface AddCollectionDialogProps {
  allowedDepartments: readonly DepartmentName[];
  canChooseDate: boolean;
  defaultOccurredOn: string;
  loadPatientOptions: (appointmentDate: string) => Promise<EmrPatientOption[]>;
  onAdd: (collection: NewCollectionBatch) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EntryLine extends NewPaymentLine {
  key: string;
}

export function AddCollectionDialog({
  allowedDepartments,
  canChooseDate,
  defaultOccurredOn,
  loadPatientOptions,
  onAdd,
  onOpenChange,
  open,
}: AddCollectionDialogProps) {
  const nextKey = useRef(0);
  const primaryDepartments = allowedDepartments.filter(
    (department) => department === "OPD" || department === "Pharmacy",
  );
  const initialDepartments =
    primaryDepartments.length > 0 ? primaryDepartments : allowedDepartments.slice(0, 1);
  const createRows = () =>
    initialDepartments.flatMap((department) => [
      { ...emptyPaymentLine(department), key: `${department}-initial` },
    ]);
  const [patient, setPatient] = useState("");
  const [emrPatientId, setEmrPatientId] = useState<string | null>(null);
  const [patientOptions, setPatientOptions] = useState<EmrPatientOption[]>([]);
  const [patientOptionsLoading, setPatientOptionsLoading] = useState(false);
  const [patientPickerOpen, setPatientPickerOpen] = useState(false);
  const [occurredOn, setOccurredOn] = useState(defaultOccurredOn);
  const [rows, setRows] = useState<EntryLine[]>(createRows);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  useEffect(() => {
    if (open) setOccurredOn(defaultOccurredOn);
  }, [defaultOccurredOn, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPatientOptionsLoading(true);
    void loadPatientOptions(occurredOn)
      .then((options) => {
        if (!cancelled) setPatientOptions(options);
      })
      .catch(() => {
        if (!cancelled) setPatientOptions([]);
      })
      .finally(() => {
        if (!cancelled) setPatientOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadPatientOptions, occurredOn, open]);

  const populatedRows = rows.filter((row) => row.amount > 0);
  const activeDepartments = allowedDepartments.filter((department) =>
    rows.some((row) => row.department === department),
  );
  const availableDepartments = allowedDepartments.filter(
    (department) => !activeDepartments.includes(department),
  );
  const matchingPatientOptions = patientOptions.filter((option) => {
    const search = patient.trim().toLocaleLowerCase("en-IN");
    return (
      search.length === 0 ||
      option.displayName.toLocaleLowerCase("en-IN").includes(search) ||
      option.externalPatientId.toLocaleLowerCase("en-IN").includes(search)
    );
  });
  const totals = useMemo(
    () =>
      populatedRows.reduce(
        (result, row) => ({
          discount: result.discount + row.discount,
          gross: result.gross + row.amount,
          net: result.net + row.amount - row.discount,
        }),
        { discount: 0, gross: 0, net: 0 },
      ),
    [populatedRows],
  );

  const reset = () => {
    setPatient("");
    setEmrPatientId(null);
    setPatientPickerOpen(false);
    setOccurredOn(defaultOccurredOn);
    setRows(createRows());
    setSubmitError(undefined);
  };

  const updateRow = (key: string, update: (row: EntryLine) => EntryLine) => {
    setRows((current) => current.map((row) => (row.key === key ? update(row) : row)));
  };

  const addPayment = (department: DepartmentName) => {
    nextKey.current += 1;
    setRows((current) => [
      ...current,
      { ...emptyPaymentLine(department), key: `${department}-${nextKey.current}` },
    ]);
  };

  const addDepartment = (department: DepartmentName) => addPayment(department);

  const removePayment = (key: string, department: DepartmentName) => {
    setRows((current) => {
      const departmentRows = current.filter((row) => row.department === department);
      if (departmentRows.length === 1) {
        return current.map((row) =>
          row.key === key ? { ...emptyPaymentLine(department), key: row.key } : row,
        );
      }
      return current.filter((row) => row.key !== key);
    });
  };

  const submit = async () => {
    const parsed = collectionBatchSchema.safeParse({
      emrPatientId,
      occurredOn,
      patient,
      payments: populatedRows.map(({ key: _key, ...row }) => row),
    });
    if (!parsed.success) {
      setSubmitError(parsed.error.issues[0]?.message ?? "Review the payment entries.");
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
            Add as many payments as needed under each department and save them together.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5 p-5 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_auto] lg:items-end">
            <label className="relative">
              <span className="form-label">Patient name</span>
              <input
                aria-autocomplete="list"
                aria-controls="emr-patient-options"
                aria-expanded={patientPickerOpen}
                autoComplete="off"
                autoFocus
                className="form-control"
                maxLength={120}
                onBlur={() => setPatientPickerOpen(false)}
                onChange={(event) => {
                  setPatient(event.target.value);
                  setEmrPatientId(null);
                  setPatientPickerOpen(true);
                }}
                onFocus={() => setPatientPickerOpen(true)}
                placeholder="Search today’s EMR patients or type a name"
                role="combobox"
                value={patient}
              />
              {patientPickerOpen ? (
                <div
                  className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-2 shadow-2xl"
                  id="emr-patient-options"
                  role="listbox"
                >
                  {patientOptionsLoading ? (
                    <p className="px-3 py-4 text-sm text-[var(--muted)]">Loading EMR patients…</p>
                  ) : matchingPatientOptions.length > 0 ? (
                    <>
                      <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl bg-[var(--panel)] px-3 py-2 text-xs text-[var(--muted)]">
                        <span>
                          {matchingPatientOptions.length} synchronized patients · {occurredOn}
                        </span>
                        {matchingPatientOptions.length > 6 ? <span>Scroll for more</span> : null}
                      </div>
                      {matchingPatientOptions.map((option) => (
                        <button
                          className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--subtle-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                          key={option.id}
                          onClick={() => {
                            setPatient(option.displayName);
                            setEmrPatientId(option.id);
                            setPatientPickerOpen(false);
                          }}
                          onMouseDown={(event) => event.preventDefault()}
                          role="option"
                          type="button"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">
                              {option.displayName}
                            </span>
                            <span className="block text-xs text-[var(--muted)]">
                              {option.externalPatientId}
                              {option.visitType ? ` · ${option.visitType}` : ""}
                            </span>
                          </span>
                          {option.hasEyeFlowRecord ? (
                            <span className="rounded-full bg-slate-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-strong)]">
                              Existing
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-500/12 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                              New
                            </span>
                          )}
                        </button>
                      ))}
                    </>
                  ) : (
                    <p className="px-3 py-4 text-sm text-[var(--muted)]">
                      No synchronized EMR patients for this date. You can still enter a name.
                    </p>
                  )}
                </div>
              ) : null}
            </label>
            <label>
              <span className="form-label">Collection date</span>
              <span className="relative block">
                <CalendarDays
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                  size={16}
                />
                <input
                  className="form-control pl-10"
                  disabled={!canChooseDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setOccurredOn(event.target.value)}
                  type="date"
                  value={occurredOn}
                />
              </span>
            </label>
            <div className="flex min-h-11 items-center gap-5 rounded-xl border border-[var(--border)] bg-[var(--subtle-panel)] px-4">
              <SummaryValue label="Payments" value={String(populatedRows.length)} />
              <SummaryValue label="Discount" value={formatCurrency(totals.discount)} />
              <SummaryValue label="Final" value={formatCurrency(totals.net)} strong />
            </div>
          </div>

          <div className="space-y-3">
            {availableDepartments.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--subtle-panel)] px-4 py-3">
                <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Add department
                </span>
                {availableDepartments.map((department) => (
                  <Button
                    aria-label={`Add ${department} department`}
                    key={department}
                    onClick={() => addDepartment(department)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Plus size={14} />
                    {department}
                  </Button>
                ))}
              </div>
            ) : null}
            {activeDepartments.map((department) => {
              const departmentRows = rows.filter((row) => row.department === department);
              const departmentTotal = departmentRows.reduce(
                (sum, row) => sum + row.amount - row.discount,
                0,
              );
              return (
                <section
                  className="overflow-hidden rounded-2xl border border-[var(--border)]"
                  key={department}
                >
                  <div className="flex items-center justify-between bg-[var(--subtle-panel)] px-4 py-3">
                    <div>
                      <h3 className="text-sm font-bold">{department}</h3>
                      <p className="text-xs text-[var(--muted)]">
                        {departmentRows.filter((row) => row.amount > 0).length} payments ·{" "}
                        {formatCurrency(departmentTotal)}
                      </p>
                    </div>
                    <Button
                      aria-label={`Add ${department} payment`}
                      onClick={() => addPayment(department)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Plus size={14} />
                      Add payment
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-left">
                      <thead>
                        <tr className="border-y border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted)]">
                          <th className="px-4 py-2 font-semibold">Mode</th>
                          <th className="px-3 py-2 font-semibold">Amount</th>
                          <th className="px-3 py-2 font-semibold">Provider / mode</th>
                          <th className="px-3 py-2 font-semibold">Discount</th>
                          <th className="px-3 py-2 text-right font-semibold">Final</th>
                          <th className="px-3 py-2 text-right font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {departmentRows.map((row, index) => (
                          <PaymentEntryRow
                            index={index}
                            key={row.key}
                            onRemove={() => removePayment(row.key, department)}
                            onUpdate={(update) => updateRow(row.key, update)}
                            row={row}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
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
                  Save {populatedRows.length || ""} payment
                  {populatedRows.length === 1 ? "" : "s"}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentEntryRow({
  index,
  onRemove,
  onUpdate,
  row,
}: {
  index: number;
  onRemove: () => void;
  onUpdate: (update: (row: EntryLine) => EntryLine) => void;
  row: EntryLine;
}) {
  const options = row.mode === "credit" ? creditProviders : onlineModes;
  return (
    <tr className="border-b border-[var(--border)] last:border-0">
      <td className="px-4 py-3">
        <select
          aria-label={`${row.department} payment ${index + 1} mode`}
          className="form-control min-w-28"
          onChange={(event) =>
            onUpdate((current) => ({
              ...current,
              mode: event.target.value as NewPaymentLine["mode"],
              providerOrMode: event.target.value === "cash" ? null : "",
            }))
          }
          value={row.mode}
        >
          <option value="cash">Cash</option>
          <option value="credit">Credit</option>
          <option value="online">Online</option>
        </select>
      </td>
      <td className="px-3 py-3">
        <MoneyInput
          label={`${row.department} payment ${index + 1} amount`}
          onChange={(amount) => onUpdate((current) => ({ ...current, amount }))}
          value={row.amount}
        />
      </td>
      <td className="px-3 py-3">
        {row.mode === "cash" ? (
          <span className="px-3 text-sm text-[var(--muted)]">Not required</span>
        ) : (
          <select
            aria-label={`${row.department} payment ${index + 1} provider or mode`}
            className="form-control min-w-36"
            onChange={(event) =>
              onUpdate((current) => ({
                ...current,
                providerOrMode: event.target.value || null,
              }))
            }
            value={row.providerOrMode ?? ""}
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
          invalid={row.discount > row.amount}
          label={`${row.department} payment ${index + 1} discount`}
          onChange={(discount) => onUpdate((current) => ({ ...current, discount }))}
          value={row.discount}
        />
      </td>
      <td className="px-3 py-3 text-right text-sm font-bold">
        {formatCurrency(row.amount - row.discount)}
      </td>
      <td className="px-3 py-3 text-right">
        <Button
          aria-label={`Remove ${row.department} payment ${index + 1}`}
          onClick={onRemove}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Trash2 size={14} />
        </Button>
      </td>
    </tr>
  );
}

function MoneyInput({
  invalid = false,
  label,
  onChange,
  value,
}: {
  invalid?: boolean;
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <div className="relative min-w-28">
      <IndianRupee
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        size={14}
      />
      <input
        aria-invalid={invalid}
        aria-label={label}
        className="form-control pl-8"
        min="0"
        onChange={(event) => onChange(Math.max(0, Number(event.target.value || 0)))}
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
  }).format(Math.max(0, value));
}

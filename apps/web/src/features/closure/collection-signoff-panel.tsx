import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@eyeflow/ui";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  IndianRupee,
  LockKeyhole,
  Scale,
  UnlockKeyhole,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { DashboardData, DashboardSummary } from "../dashboard/dashboard-data";
import type { SignOffCollection } from "./closure-schema";

interface CollectionSignoffPanelProps {
  businessDate: string;
  closure: DashboardData["closure"];
  closureError: string | undefined;
  closureOperation: boolean;
  closureReason: string;
  disabled: boolean;
  onChangeClosure: () => Promise<void>;
  onClosureReasonChange: (reason: string) => void;
  onSignOff: (input: SignOffCollection) => Promise<void>;
  reconciliation: NonNullable<DashboardData["reconciliation"]>;
  signoffs: NonNullable<DashboardData["signoffs"]>;
  summary: DashboardSummary;
}

type SignoffPeriod = SignOffCollection["period"];
type Draft = Omit<SignOffCollection, "businessDate" | "period">;

const emptyDraft: Draft = {
  declaredCash: 0,
  declaredCredit: 0,
  declaredDiscount: 0,
  declaredOnline: 0,
  note: "",
};

export function CollectionSignoffPanel({
  businessDate,
  closure,
  closureError,
  closureOperation,
  closureReason,
  disabled,
  onChangeClosure,
  onClosureReasonChange,
  onSignOff,
  reconciliation,
  signoffs,
  summary,
}: CollectionSignoffPanelProps) {
  const [activePeriod, setActivePeriod] = useState<SignoffPeriod>();
  const [drafts, setDrafts] = useState<Record<SignoffPeriod, Draft>>({
    endofday: emptyDraft,
    midday: emptyDraft,
  });
  const [saving, setSaving] = useState<SignoffPeriod>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const existingMidday = signoffs.periods.find((period) => period.period === "midday");
    const existingEnd = signoffs.periods.find((period) => period.period === "endofday");
    setDrafts({
      midday: existingMidday
        ? {
            declaredCash: existingMidday.declaredCash,
            declaredCredit: existingMidday.declaredCredit,
            declaredDiscount: existingMidday.declaredDiscount,
            declaredOnline: existingMidday.declaredOnline,
            note: existingMidday.note,
          }
        : {
            declaredCash: roundCurrency(summary.cash),
            declaredCredit: roundCurrency(summary.credit),
            declaredDiscount: roundCurrency(summary.discount),
            declaredOnline: roundCurrency(summary.online),
            note: "",
          },
      endofday: existingEnd
        ? {
            declaredCash: existingEnd.declaredCash,
            declaredCredit: existingEnd.declaredCredit,
            declaredDiscount: existingEnd.declaredDiscount,
            declaredOnline: existingEnd.declaredOnline,
            note: existingEnd.note,
          }
        : emptyDraft,
    });
  }, [signoffs.periods, summary.cash, summary.credit, summary.discount, summary.online]);

  const save = async (period: SignoffPeriod) => {
    try {
      setSaving(period);
      setError(undefined);
      await onSignOff({ businessDate, period, ...drafts[period] });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this handover.");
    } finally {
      setSaving(undefined);
    }
  };

  const update = (period: SignoffPeriod, change: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [period]: { ...current[period], ...change } }));

  const closeReady =
    signoffs.periods.length === 2 &&
    Math.abs(signoffs.variance) < 0.01 &&
    Math.abs(
      signoffs.periods.reduce((total, period) => total + period.calculatedNet, 0) - summary.revenue,
    ) < 0.01;

  const activeSaved = signoffs.periods.find((period) => period.period === activePeriod);
  const activeDraft = activePeriod ? drafts[activePeriod] : undefined;
  const middaySaved = signoffs.periods.find((period) => period.period === "midday");
  const expectedCaptured = activeSaved
    ? activeSaved.calculatedNet
    : activePeriod === "midday"
      ? summary.revenue
      : Math.max(0, summary.revenue - (middaySaved?.calculatedNet ?? summary.revenue));

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="metric-icon metric-icon-blue">
            <Scale size={17} />
          </div>
          <div>
            <p className="text-sm font-bold">Collection handover</p>
            <p className="text-xs text-[var(--muted)]">
              Open a status badge to reconcile and sign off.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["midday", "endofday"] as const).map((period) => (
            <HandoverBadge
              closureStatus={closure?.status}
              key={period}
              onClick={() => setActivePeriod(period)}
              period={period}
              saved={signoffs.periods.find((entry) => entry.period === period)}
            />
          ))}
        </div>
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setActivePeriod(undefined);
            setError(undefined);
          }
        }}
        open={activePeriod !== undefined}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {activePeriod === "midday" ? "Mid-day" : "End-of-day"} collection handover
            </DialogTitle>
            <DialogDescription>
              Reconcile the captured collection, declare the handover, and record verification.
            </DialogDescription>
          </DialogHeader>

          {activePeriod && activeDraft ? (
            <div className="space-y-5 p-6">
              <section className="rounded-2xl border border-[var(--border)] bg-[var(--subtle-panel)] p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold">Collection reconciliation</h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {reconciliation.sourceLines} EMR receipt lines compared with EyeFlow entries.
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold",
                      Math.abs(signoffs.variance) < 0.01 && signoffs.periods.length === 2
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                    )}
                  >
                    Day total {formatCurrency(signoffs.overallTotal)}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <ReconciliationValue
                    label="EMR gross receipts"
                    value={reconciliation.importedGross}
                  />
                  <ReconciliationValue label="Refunds" value={-reconciliation.refundTotal} />
                  <ReconciliationValue label="EMR net" value={reconciliation.importedNet} />
                  <ReconciliationValue label="Manual net" value={reconciliation.manualNet} />
                </dl>
                {reconciliation.reviewLines > 0 ? (
                  <p className="mt-4 text-xs font-medium text-amber-700 dark:text-amber-300">
                    {reconciliation.reviewLines} receipt line
                    {reconciliation.reviewLines === 1 ? " requires" : "s require"} mapping review.
                  </p>
                ) : null}
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {activeSaved ? (
                      <CheckCircle2 className="text-emerald-500" size={18} />
                    ) : (
                      <Clock3 className="text-amber-500" size={18} />
                    )}
                    <h3 className="text-sm font-bold">Declare collection</h3>
                  </div>
                  <span className="text-xs text-[var(--muted)]">
                    Captured {formatCurrency(expectedCaptured)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(
                    [
                      ["declaredCash", "Cash"],
                      ["declaredOnline", "Online"],
                      ["declaredCredit", "Credit"],
                      ["declaredDiscount", "Discount"],
                    ] as const
                  ).map(([field, label]) => (
                    <label key={field}>
                      <span className="form-label">{label}</span>
                      <span className="relative block">
                        <IndianRupee
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                          size={13}
                        />
                        <input
                          aria-label={`${activePeriod} ${label}`}
                          className="form-control pl-7"
                          disabled={disabled}
                          min="0"
                          onChange={(event) =>
                            update(activePeriod, { [field]: Number(event.target.value || 0) })
                          }
                          step="0.01"
                          type="number"
                          value={activeDraft[field]}
                        />
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex-1">
                    <span className="form-label">Verification note</span>
                    <input
                      aria-label={`${activePeriod} verification note`}
                      className="form-control w-full"
                      disabled={disabled}
                      onChange={(event) => update(activePeriod, { note: event.target.value })}
                      placeholder="Cash drawer and terminals verified"
                      value={activeDraft.note}
                    />
                  </label>
                  <Button
                    disabled={
                      disabled || saving !== undefined || activeDraft.note.trim().length < 3
                    }
                    onClick={() => void save(activePeriod)}
                    variant={activeSaved ? "outline" : "default"}
                  >
                    {saving === activePeriod
                      ? "Saving…"
                      : activeSaved
                        ? "Update handover"
                        : "Verify and hand over"}
                  </Button>
                </div>
              </section>

              {activePeriod === "endofday" ? (
                <section className="flex flex-col gap-3 border-t border-[var(--border)] pt-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-bold">
                      {closure?.status === "closed" ? (
                        <LockKeyhole className="text-amber-500" size={15} />
                      ) : (
                        <UnlockKeyhole className="text-emerald-500" size={15} />
                      )}
                      {closure?.status === "closed" ? "Day closed" : "Day open"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Both handovers must match the overall collection before closing.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label>
                      <span className="form-label">
                        {closure?.status === "closed" ? "Reopen reason" : "Closure note"}
                      </span>
                      <input
                        className="form-control w-full sm:w-72"
                        onChange={(event) => onClosureReasonChange(event.target.value)}
                        placeholder="Verified against cash drawer"
                        value={closureReason}
                      />
                    </label>
                    <Button
                      disabled={
                        closureOperation ||
                        closureReason.trim().length < 3 ||
                        (closure?.status !== "closed" && !closeReady)
                      }
                      onClick={() => void onChangeClosure()}
                      variant={closure?.status === "closed" ? "outline" : "default"}
                    >
                      {closure?.status === "closed" ? (
                        <UnlockKeyhole size={15} />
                      ) : (
                        <LockKeyhole size={15} />
                      )}
                      {closureOperation
                        ? "Saving…"
                        : closure?.status === "closed"
                          ? "Reopen day"
                          : "Close day"}
                    </Button>
                  </div>
                </section>
              ) : null}

              {error || closureError ? (
                <p className="text-xs font-medium text-rose-700 dark:text-rose-300">
                  {error ?? closureError}
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface HandoverBadgeProps {
  closureStatus: "closed" | "open" | undefined;
  onClick: () => void;
  period: SignoffPeriod;
  saved: NonNullable<DashboardData["signoffs"]>["periods"][number] | undefined;
}

function HandoverBadge({ closureStatus, onClick, period, saved }: HandoverBadgeProps) {
  const variance = saved ? saved.declaredNet - saved.calculatedNet : undefined;
  const isClosed = period === "endofday" && closureStatus === "closed";
  const isMismatch = variance !== undefined && Math.abs(variance) >= 0.01;
  const label = period === "midday" ? "Mid-day" : "End-of-day";
  const status = isClosed ? "Closed" : isMismatch ? "Mismatch" : saved ? "Handed over" : "Pending";
  const Icon =
    isClosed || (saved && !isMismatch) ? CheckCircle2 : isMismatch ? AlertCircle : Clock3;

  return (
    <button
      aria-label={`Open ${label} reconciliation: ${status}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60",
        isClosed || (saved && !isMismatch)
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : isMismatch
            ? "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300"
            : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      )}
      onClick={onClick}
      type="button"
    >
      <Icon size={14} />
      <span>{label}</span>
      <span className="font-medium opacity-75">· {status}</span>
    </button>
  );
}

function ReconciliationValue({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-bold tabular-nums">{formatCurrency(value)}</dd>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

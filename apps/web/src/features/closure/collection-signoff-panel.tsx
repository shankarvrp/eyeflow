import { Button, cn } from "@eyeflow/ui";
import { CheckCircle2, Clock3, IndianRupee } from "lucide-react";
import { useEffect, useState } from "react";
import type { DashboardData, DashboardSummary } from "../dashboard/dashboard-data";
import type { SignOffCollection } from "./closure-schema";

interface CollectionSignoffPanelProps {
  businessDate: string;
  disabled: boolean;
  onSignOff: (input: SignOffCollection) => Promise<void>;
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
  disabled,
  onSignOff,
  signoffs,
  summary,
}: CollectionSignoffPanelProps) {
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
            declaredCash: summary.cash,
            declaredCredit: summary.credit,
            declaredDiscount: summary.discount,
            declaredOnline: summary.online,
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
      setError(saveError instanceof Error ? saveError.message : "Unable to save this sign-off.");
    } finally {
      setSaving(undefined);
    }
  };

  const update = (period: SignoffPeriod, change: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [period]: { ...current[period], ...change } }));

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">Two-stage collection sign-off</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Declare once mid-day and once later. Both declarations must tally with the day total.
          </p>
        </div>
        <div
          className={cn(
            "rounded-full px-3 py-1 text-xs font-bold",
            Math.abs(signoffs.variance) < 0.01 && signoffs.periods.length === 2
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
          )}
        >
          Declared {formatCurrency(signoffs.declaredTotal)} · Overall{" "}
          {formatCurrency(signoffs.overallTotal)} · Variance {formatCurrency(signoffs.variance)}
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {(["midday", "endofday"] as const).map((period) => {
          const saved = signoffs.periods.find((entry) => entry.period === period);
          const draft = drafts[period];
          return (
            <section
              className="rounded-2xl border border-[var(--border)] bg-[var(--subtle-panel)] p-4"
              key={period}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {saved ? (
                    <CheckCircle2 className="text-emerald-500" size={17} />
                  ) : (
                    <Clock3 className="text-amber-500" size={17} />
                  )}
                  <h4 className="text-sm font-bold">
                    {period === "midday" ? "Mid-day" : "Later / end-day"} sign-off
                  </h4>
                </div>
                <span className="text-xs text-[var(--muted)]">
                  Captured {formatCurrency(saved?.calculatedNet ?? 0)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                        aria-label={`${period} ${label}`}
                        className="form-control pl-7"
                        disabled={disabled}
                        min="0"
                        onChange={(event) =>
                          update(period, { [field]: Number(event.target.value || 0) })
                        }
                        step="0.01"
                        type="number"
                        value={draft[field]}
                      />
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="flex-1">
                  <span className="form-label">Verification note</span>
                  <input
                    aria-label={`${period} verification note`}
                    className="form-control w-full"
                    disabled={disabled}
                    onChange={(event) => update(period, { note: event.target.value })}
                    placeholder="Cash drawer and terminals verified"
                    value={draft.note}
                  />
                </label>
                <Button
                  disabled={disabled || saving !== undefined || draft.note.trim().length < 3}
                  onClick={() => void save(period)}
                  size="sm"
                  variant={saved ? "outline" : "default"}
                >
                  {saving === period ? "Saving…" : saved ? "Update sign-off" : "Sign off"}
                </Button>
              </div>
            </section>
          );
        })}
      </div>
      {error ? <p className="mt-3 text-xs font-medium text-rose-600">{error}</p> : null}
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

import { Button, cn } from "@eyeflow/ui";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  CircleDollarSign,
  IndianRupee,
  Link2,
  RefreshCw,
  Save,
  Scissors,
  ShieldCheck,
  Stethoscope,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "../components/app-shell";
import { formatCurrency } from "../features/dashboard/dashboard-data";
import { connectEmrForOt, getEmrSyncStatus, syncEmrOtNow } from "../features/emr/emr.functions";
import { currentDayReportQuery } from "../features/operations/operations-schema";
import {
  getOtSchedule,
  setOtPackageAmount,
  signOffOtPackage,
} from "../features/operations/ot.functions";
import type {
  OtPackageSignoff,
  OtScheduleCase,
  OtScheduleData,
} from "../features/operations/ot-schema";

const today = currentDayReportQuery().from;

export const Route = createFileRoute("/ot-schedule")({
  component: OtSchedule,
  loaderDeps: ({ search }) => ({ businessDate: search.date }),
  loader: async ({ deps }) => {
    const [ot, emrStatus] = await Promise.all([
      getOtSchedule({ data: { businessDate: deps.businessDate } }),
      getEmrSyncStatus({ data: { appointmentDate: deps.businessDate } }),
    ]);
    return { ...ot, businessDate: deps.businessDate, emrStatus };
  },
  validateSearch: (search: Record<string, unknown>) => ({
    date:
      typeof search.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.date)
        ? search.date
        : today,
  }),
});

function OtSchedule() {
  const loaderData = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const [businessDate, setBusinessDate] = useState(loaderData.businessDate);
  const [schedule, setSchedule] = useState(loaderData.schedule);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => packageDrafts(schedule));
  const [loading, setLoading] = useState(false);
  const [savingCase, setSavingCase] = useState<string>();
  const [error, setError] = useState<string>();
  const [signoffOpen, setSignoffOpen] = useState(false);
  const [connected, setConnected] = useState(loaderData.emrStatus.connected);
  const isAdmin = loaderData.session.user.role?.split(",").includes("admin") ?? false;

  const replaceSchedule = (next: OtScheduleData) => {
    setSchedule(next);
    setDrafts(packageDrafts(next));
  };

  const loadDate = async (date: string) => {
    try {
      setLoading(true);
      setError(undefined);
      const result = await getOtSchedule({ data: { businessDate: date } });
      setBusinessDate(date);
      replaceSchedule(result.schedule);
      await navigate({ replace: true, search: { date } });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the OT schedule.");
    } finally {
      setLoading(false);
    }
  };

  const synchronize = async () => {
    try {
      setLoading(true);
      setError(undefined);
      await syncEmrOtNow({ data: { appointmentDate: businessDate } });
      setConnected(true);
      const result = await getOtSchedule({ data: { businessDate } });
      replaceSchedule(result.schedule);
    } catch (syncError) {
      if (
        syncError instanceof Error &&
        /session|connection|required|reconnect/i.test(syncError.message)
      ) {
        setConnected(false);
      }
      setError(
        syncError instanceof Error ? syncError.message : "Unable to synchronize the FOSS OT list.",
      );
    } finally {
      setLoading(false);
    }
  };

  const connect = async () => {
    try {
      setLoading(true);
      setError(undefined);
      await connectEmrForOt({ data: { appointmentDate: businessDate } });
      setConnected(true);
      const result = await getOtSchedule({ data: { businessDate } });
      replaceSchedule(result.schedule);
    } catch (connectError) {
      setError(
        connectError instanceof Error ? connectError.message : "Unable to connect the FOSS EMR.",
      );
    } finally {
      setLoading(false);
    }
  };

  const savePackage = async (otCase: OtScheduleCase) => {
    const packageAmount = Number(drafts[otCase.id] ?? "");
    if (!Number.isFinite(packageAmount) || packageAmount < 0) {
      setError("Enter a valid surgery package amount.");
      return;
    }
    if (otCase.packageAmount === packageAmount) return;
    try {
      setSavingCase(otCase.id);
      setError(undefined);
      replaceSchedule(
        await setOtPackageAmount({ data: { businessDate, caseId: otCase.id, packageAmount } }),
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save the package amount.",
      );
    } finally {
      setSavingCase(undefined);
    }
  };

  return (
    <AppShell user={loaderData.session.user}>
      <section className="animate-in space-y-5">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
              Theatre operations
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em]">OT Schedule</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted-strong)]">
              FOSS scheduled and discharged patients, package values, collections, and daily
              handover in one view.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3">
            <label>
              <span className="form-label">Surgery date</span>
              <input
                className="form-control"
                max={today}
                onChange={(event) => void loadDate(event.target.value)}
                type="date"
                value={businessDate}
              />
            </label>
            {!connected && isAdmin ? (
              <Button disabled={loading} onClick={() => void connect()} variant="outline">
                <Link2 size={16} /> {loading ? "Connecting…" : "Connect FOSS EHR"}
              </Button>
            ) : (
              <Button
                disabled={loading || !connected}
                onClick={() => void synchronize()}
                variant="outline"
              >
                <RefreshCw className={loading ? "animate-spin" : undefined} size={16} />
                {loading ? "Syncing…" : "Sync FOSS OT"}
              </Button>
            )}
            <HandoverBadge onClick={() => setSignoffOpen(true)} signoffs={schedule.signoffs} />
          </div>
        </header>

        {error ? (
          <p
            className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-700 dark:text-rose-300"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-7">
          <Metric icon={CalendarDays} label="Scheduled" value={schedule.summary.scheduledCount} />
          <Metric icon={Check} label="Discharged today" value={schedule.summary.dischargedCount} />
          <Metric
            icon={Scissors}
            label="Package value"
            value={formatCurrency(schedule.summary.packageAmount)}
          />
          <Metric
            icon={CircleDollarSign}
            label="Cash collection"
            value={formatCurrency(schedule.summary.cashAmount)}
          />
          <Metric
            icon={CircleDollarSign}
            label="Online collection"
            value={formatCurrency(schedule.summary.onlineAmount)}
          />
          <Metric
            accent="success"
            icon={CircleDollarSign}
            label="Total collection"
            value={formatCurrency(schedule.summary.collectedAmount)}
          />
          <Metric
            accent={schedule.summary.variance > 0 ? "warning" : "success"}
            icon={IndianRupee}
            label="Package balance"
            value={formatCurrency(schedule.summary.variance)}
          />
        </div>

        <article className="panel overflow-hidden">
          <div className="border-b border-[var(--border)] p-5">
            <h2 className="panel-title">Surgery list</h2>
            <p className="panel-subtitle">
              {schedule.cases.length} cases · package amounts remain editable until the day closes
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px] text-left text-sm">
              <thead className="bg-[var(--subtle-panel)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Patient</th>
                  <th className="px-5 py-3.5 font-semibold">Surgery</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold">Package amount</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Cash</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Online</th>
                  <th className="px-5 py-3.5 font-semibold">Total</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {schedule.cases.map((otCase) => (
                  <tr className="align-top transition hover:bg-[var(--hover)]" key={otCase.id}>
                    <td className="px-5 py-4">
                      <p className="font-bold">{otCase.patientName}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {otCase.externalPatientId}
                        {otCase.scheduledAt ? ` · ${formatTime(otCase.scheduledAt)}` : ""}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold">
                        {otCase.procedureName ?? "Surgery not specified"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {otCase.surgeonName ?? "Surgeon not specified"}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-bold",
                          otCase.status === "discharged_today"
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300",
                        )}
                      >
                        {otCase.status === "discharged_today" ? "Discharged today" : "Scheduled"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex max-w-52 gap-2">
                        <input
                          aria-label={`Package amount for ${otCase.patientName}`}
                          className="form-control min-w-0 text-right font-bold tabular-nums"
                          min="0"
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [otCase.id]: event.target.value,
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void savePackage(otCase);
                          }}
                          placeholder="0.00"
                          step="0.01"
                          type="number"
                          value={drafts[otCase.id] ?? ""}
                        />
                        <Button
                          aria-label={`Save package amount for ${otCase.patientName}`}
                          disabled={savingCase === otCase.id}
                          onClick={() => void savePackage(otCase)}
                          size="icon"
                          variant="outline"
                        >
                          <Save size={15} />
                        </Button>
                      </div>
                      <p className="mt-1 text-[10px] text-[var(--muted)]">
                        {otCase.packageUpdatedBy
                          ? `Updated by ${otCase.packageUpdatedBy}`
                          : "Awaiting package value"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-right font-bold tabular-nums">
                      {formatCurrency(otCase.cashAmount)}
                    </td>
                    <td className="px-5 py-4 text-right font-bold tabular-nums">
                      {formatCurrency(otCase.onlineAmount)}
                    </td>
                    <td className="px-5 py-4">
                      <PaymentDetails otCase={otCase} />
                    </td>
                    <td className="px-5 py-4 text-right font-black tabular-nums">
                      {otCase.packageAmount === null
                        ? "—"
                        : formatCurrency(otCase.packageAmount - otCase.collectedAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {schedule.cases.length === 0 ? (
            <div className="grid min-h-56 place-items-center p-8 text-center">
              <div>
                <Stethoscope className="mx-auto text-orange-500" size={30} />
                <p className="mt-3 font-bold">No OT cases synchronized for this date</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {connected
                    ? "No Scheduled or Discharged Today cases were returned by FOSS for this date."
                    : isAdmin
                      ? "Connect FOSS EHR above, complete the login, and the OT list will synchronize."
                      : "The EMR connection has expired. Ask an administrator to reconnect it."}
                </p>
              </div>
            </div>
          ) : null}
        </article>
      </section>

      {signoffOpen ? (
        <OtSignoffDialog
          businessDate={businessDate}
          isAdmin={isAdmin}
          onClose={() => setSignoffOpen(false)}
          onError={setError}
          onSaved={(next) => {
            replaceSchedule(next);
            setSignoffOpen(false);
          }}
          schedule={schedule}
        />
      ) : null}
    </AppShell>
  );
}

function Metric({
  accent = "default",
  icon: Icon,
  label,
  value,
}: {
  accent?: "default" | "success" | "warning";
  icon: typeof CalendarDays;
  label: string;
  value: number | string;
}) {
  return (
    <article className="metric-card">
      <Icon
        className={cn(
          accent === "warning"
            ? "text-rose-500"
            : accent === "success"
              ? "text-emerald-500"
              : "text-orange-500",
        )}
        size={19}
      />
      <p className="mt-4 text-xs font-semibold text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
    </article>
  );
}

function PaymentDetails({ otCase }: { otCase: OtScheduleCase }) {
  if (otCase.payments.length === 0) {
    return (
      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">No payment</span>
    );
  }
  return (
    <details>
      <summary className="cursor-pointer font-bold">
        {formatCurrency(otCase.collectedAmount)} · {otCase.payments.length} payment
        {otCase.payments.length === 1 ? "" : "s"}
      </summary>
      {otCase.creditAmount > 0 ? (
        <p className="mt-1 text-[10px] font-semibold text-[var(--muted)]">
          Includes {formatCurrency(otCase.creditAmount)} credit
        </p>
      ) : null}
      <div className="mt-2 space-y-1.5">
        {otCase.payments.map((payment) => (
          <div
            className="flex max-w-72 items-center justify-between gap-4 rounded-lg bg-[var(--subtle-panel)] px-2.5 py-1.5 text-xs"
            key={`${payment.occurredAt}:${payment.kind}:${payment.amount}`}
          >
            <span className="capitalize">
              {payment.kind}
              {payment.providerOrMode ? ` · ${payment.providerOrMode}` : ""}
            </span>
            <span className="font-bold">{formatCurrency(payment.amount)}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function HandoverBadge({
  onClick,
  signoffs,
}: {
  onClick: () => void;
  signoffs: OtPackageSignoff[];
}) {
  const user = signoffs.find((signoff) => signoff.signerRole === "user");
  const admin = signoffs.find((signoff) => signoff.signerRole === "admin");
  return (
    <button
      className="flex h-10 overflow-hidden rounded-xl border border-[var(--border)] text-xs font-bold shadow-sm"
      onClick={onClick}
      title="Open OT package payment handover"
      type="button"
    >
      <span
        className={cn(
          "grid place-items-center px-3",
          user?.matches ? "bg-emerald-500 text-white" : "bg-rose-500/12 text-rose-600",
        )}
      >
        User {user?.matches ? "✓" : "!"}
      </span>
      <span
        className={cn(
          "grid place-items-center border-l border-white/20 px-3",
          admin?.matches ? "bg-emerald-500 text-white" : "bg-rose-500/12 text-rose-600",
        )}
      >
        Admin {admin?.matches ? "✓" : "!"}
      </span>
    </button>
  );
}

function OtSignoffDialog({
  businessDate,
  isAdmin,
  onClose,
  onError,
  onSaved,
  schedule,
}: {
  businessDate: string;
  isAdmin: boolean;
  onClose: () => void;
  onError: (message: string) => void;
  onSaved: (schedule: OtScheduleData) => void;
  schedule: OtScheduleData;
}) {
  const role = isAdmin ? "admin" : "user";
  const current = schedule.signoffs.find((signoff) => signoff.signerRole === role);
  const [declaredAmount, setDeclaredAmount] = useState(
    (current?.declaredAmount ?? schedule.summary.collectedAmount).toFixed(2),
  );
  const [note, setNote] = useState(current?.note ?? "OT surgery package payment handover");
  const [saving, setSaving] = useState(false);
  const difference = useMemo(
    () => Number(declaredAmount || 0) - schedule.summary.collectedAmount,
    [declaredAmount, schedule.summary.collectedAmount],
  );
  const save = async () => {
    try {
      setSaving(true);
      onError("");
      onSaved(
        await signOffOtPackage({
          data: { businessDate, declaredAmount: Number(declaredAmount), note },
        }),
      );
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : "Unable to sign off OT payments.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <article className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-orange-600">
              <ShieldCheck size={17} /> {isAdmin ? "Administrator" : "User"} sign-off
            </p>
            <h2 className="mt-2 text-2xl font-black">OT package payment handover</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{formatDate(businessDate)}</p>
          </div>
          <Button aria-label="Close handover" onClick={onClose} size="icon" variant="ghost">
            <X size={18} />
          </Button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[var(--subtle-panel)] p-4">
            <p className="text-xs font-semibold text-[var(--muted)]">System OT collection</p>
            <p className="mt-1 text-xl font-black">
              {formatCurrency(schedule.summary.collectedAmount)}
            </p>
          </div>
          <div
            className={cn(
              "rounded-2xl p-4",
              Math.abs(difference) < 0.01 ? "bg-emerald-500/10" : "bg-rose-500/10",
            )}
          >
            <p className="text-xs font-semibold text-[var(--muted)]">Difference</p>
            <p className="mt-1 text-xl font-black">{formatCurrency(difference)}</p>
          </div>
        </div>
        <label className="mt-5 block">
          <span className="form-label">Declared OT amount</span>
          <input
            className="form-control w-full text-right text-lg font-black"
            min="0"
            onChange={(event) => setDeclaredAmount(event.target.value)}
            step="0.01"
            type="number"
            value={declaredAmount}
          />
        </label>
        <label className="mt-4 block">
          <span className="form-label">Handover note</span>
          <textarea
            className="form-control min-h-24 w-full"
            onChange={(event) => setNote(event.target.value)}
            value={note}
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button disabled={saving || note.trim().length < 3} onClick={() => void save()}>
            <ShieldCheck size={16} /> {saving ? "Signing…" : `Sign as ${role}`}
          </Button>
        </div>
      </article>
    </div>
  );
}

function packageDrafts(schedule: OtScheduleData): Record<string, string> {
  return Object.fromEntries(
    schedule.cases.map((otCase) => [
      otCase.id,
      otCase.packageAmount === null ? "" : otCase.packageAmount.toFixed(2),
    ]),
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

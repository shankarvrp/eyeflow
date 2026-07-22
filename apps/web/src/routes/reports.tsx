import { Button } from "@eyeflow/ui";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Clock3, FileSpreadsheet, FileText, Gauge, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "../components/app-shell";
import { formatCurrency } from "../features/dashboard/dashboard-data";
import { getReportsData } from "../features/operations/operations.functions";
import { currentMonthReportQuery } from "../features/operations/operations-schema";

const initialQuery = currentMonthReportQuery();

export const Route = createFileRoute("/reports")({
  component: Reports,
  loader: () => getReportsData({ data: initialQuery }),
});

function Reports() {
  const loaderData = Route.useLoaderData();
  const [reports, setReports] = useState(loaderData.reports);
  const [from, setFrom] = useState(initialQuery.from);
  const [to, setTo] = useState(initialQuery.to);
  const [loading, setLoading] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<"monthly" | "today" | "weekly">("today");
  const isAdmin = loaderData.session.user.role?.split(",").includes("admin") ?? false;
  const exportRange = useMemo(
    () => currentExportRange(exportPeriod, initialQuery.to, isAdmin),
    [exportPeriod, isAdmin],
  );
  const exportHref = (format: "pdf" | "xlsx") => {
    const params = new URLSearchParams({ format, ...exportRange });
    return `/api/exports/collections?${params.toString()}`;
  };
  const apply = async () => {
    setLoading(true);
    try {
      setReports((await getReportsData({ data: { from, to } })).reports);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell user={loaderData.session.user}>
      <section className="animate-in space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              Analytics
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em]">Reports</h1>
            <p className="mt-2 text-sm text-[var(--muted-strong)]">
              Collections, target gaps, patient time, and retail conversion.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3">
            <label>
              <span className="form-label">From</span>
              <input
                className="form-control"
                onChange={(event) => setFrom(event.target.value)}
                type="date"
                value={from}
              />
            </label>
            <label>
              <span className="form-label">To</span>
              <input
                className="form-control"
                onChange={(event) => setTo(event.target.value)}
                type="date"
                value={to}
              />
            </label>
            <Button disabled={loading || from > to} onClick={() => void apply()}>
              {loading ? "Loading…" : "Apply"}
            </Button>
          </div>
        </header>

        <article className="panel flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold">Export collection report</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {exportRange.from} to {exportRange.to}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <fieldset className="flex flex-wrap gap-1 rounded-xl bg-[var(--track)] p-1">
              <legend className="sr-only">Export period</legend>
              {(["today", "weekly", "monthly"] as const).map((period) => (
                <label
                  className={`cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold capitalize transition ${
                    exportPeriod === period
                      ? "bg-[var(--panel)] text-[var(--foreground)] shadow-sm"
                      : "text-[var(--muted)]"
                  }`}
                  key={period}
                >
                  <input
                    checked={exportPeriod === period}
                    className="sr-only"
                    name="export-period"
                    onChange={() => setExportPeriod(period)}
                    type="radio"
                    value={period}
                  />
                  {period === "today" ? "Today" : period === "weekly" ? "This week" : "This month"}
                </label>
              ))}
            </fieldset>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <a download href={exportHref("xlsx")}>
                  <FileSpreadsheet size={16} /> Excel
                </a>
              </Button>
              <Button asChild variant="outline">
                <a download href={exportHref("pdf")}>
                  <FileText size={16} /> PDF
                </a>
              </Button>
            </div>
          </div>
        </article>

        <div className="grid gap-4 md:grid-cols-2">
          {reports.conversion.map((conversion) => (
            <article className="metric-card" key={conversion.department}>
              <ShoppingBag className="text-emerald-500" size={20} />
              <p className="mt-5 text-sm font-semibold">{conversion.department} conversion</p>
              <p className="mt-1 text-3xl font-bold">{conversion.ratio}%</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {conversion.converted} appointment patients converted
              </p>
            </article>
          ))}
        </div>

        <article className="panel overflow-hidden">
          <div className="p-5">
            <h2 className="panel-title flex items-center gap-2">
              <BarChart3 size={18} /> Department and date-wise collection
            </h2>
          </div>
          <ReportTable headers={["Date", "Department", "Transactions", "Net collection"]}>
            {reports.collectionByDateDepartment.map((row) => (
              <tr key={`${row.date}:${row.department}`}>
                <td className="px-5 py-3">{row.date}</td>
                <td className="px-5 py-3 font-semibold">{row.department}</td>
                <td className="px-5 py-3">{row.transactions}</td>
                <td className="px-5 py-3 text-right font-bold">{formatCurrency(row.amount)}</td>
              </tr>
            ))}
          </ReportTable>
        </article>

        {isAdmin ? <ClinicTargetPulse targets={reports.departmentTargets} /> : null}

        <article className="panel p-5 sm:p-6">
          <div>
            <h2 className="panel-title flex items-center gap-2">
              <Gauge size={18} /> Department target meters
            </h2>
            <p className="panel-subtitle">
              Today, current week, and current month · configured by administrators
            </p>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {reports.departmentTargets.map((target) => (
              <div
                className="rounded-2xl border border-[var(--border)] bg-[var(--subtle-panel)] p-4"
                key={target.department}
              >
                <p className="font-bold">{target.department}</p>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <TargetMeter label="Daily" progress={target.daily} />
                  <TargetMeter label="Weekly" progress={target.weekly} />
                  <TargetMeter label="Monthly" progress={target.monthly} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel overflow-hidden">
          <div className="p-5">
            <h2 className="panel-title flex items-center gap-2">
              <Clock3 size={18} /> Patient time spent
            </h2>
            <p className="panel-subtitle">
              Longest to shortest, using synchronized appointment and last receipt times
            </p>
          </div>
          <ReportTable headers={["Patient", "Appointment", "Last receipt", "Observed time"]}>
            {reports.patientTime.map((row) => (
              <tr key={`${row.patient}:${row.scheduledAt}`}>
                <td className="px-5 py-3 font-semibold">{row.patient}</td>
                <td className="px-5 py-3">{formatTime(row.scheduledAt)}</td>
                <td className="px-5 py-3">{formatTime(row.completedAt)}</td>
                <td className="px-5 py-3 text-right font-bold">{row.minutes} min</td>
              </tr>
            ))}
          </ReportTable>
          {reports.patientTime.length === 0 ? (
            <p className="p-5 text-sm text-[var(--muted)]">
              Run EMR Sync to populate appointment timing for this report.
            </p>
          ) : null}
        </article>
      </section>
    </AppShell>
  );
}

interface TargetProgressValue {
  actual: number;
  target: number;
}

function ClinicTargetPulse({
  targets,
}: {
  targets: Array<{
    daily: TargetProgressValue;
    monthly: TargetProgressValue;
    weekly: TargetProgressValue;
  }>;
}) {
  const total = (period: "daily" | "monthly" | "weekly") =>
    targets.reduce(
      (summary, target) => ({
        actual: summary.actual + target[period].actual,
        target: summary.target + target[period].target,
      }),
      { actual: 0, target: 0 },
    );
  return (
    <article className="overflow-hidden rounded-[26px] bg-slate-950 p-5 text-white sm:p-6">
      <div>
        <p className="text-sm font-bold text-emerald-300">Administrator view</p>
        <h2 className="mt-1 text-xl font-bold">Clinic target pulse</h2>
        <p className="mt-1 text-sm text-slate-400">Combined performance across all departments</p>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <TargetMeter dark label="Daily" progress={total("daily")} />
        <TargetMeter dark label="Weekly" progress={total("weekly")} />
        <TargetMeter dark label="Monthly" progress={total("monthly")} />
      </div>
    </article>
  );
}

function TargetMeter({
  dark = false,
  label,
  progress,
}: {
  dark?: boolean;
  label: string;
  progress: TargetProgressValue;
}) {
  const percentage =
    progress.target === 0
      ? 0
      : Math.min(100, Math.round((progress.actual / progress.target) * 100));
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <meter className="sr-only" max={100} min={0} value={percentage}>
        {label} target {percentage}% complete
      </meter>
      <div
        aria-hidden="true"
        className="grid size-20 place-items-center rounded-full sm:size-24"
        style={{
          background: `conic-gradient(rgb(16 185 129) ${percentage * 3.6}deg, ${dark ? "rgb(255 255 255 / 0.12)" : "var(--track)"} 0deg)`,
        }}
      >
        <div
          className={`grid size-14 place-items-center rounded-full text-sm font-black sm:size-[4.25rem] ${
            dark ? "bg-slate-950" : "bg-[var(--panel)]"
          }`}
        >
          {percentage}%
        </div>
      </div>
      <p className={`mt-2 text-xs font-bold ${dark ? "text-slate-200" : ""}`}>{label}</p>
      <p className={`mt-1 truncate text-[10px] ${dark ? "text-slate-400" : "text-[var(--muted)]"}`}>
        {formatCurrency(progress.actual)} / {formatCurrency(progress.target)}
      </p>
    </div>
  );
}

function currentExportRange(
  period: "monthly" | "today" | "weekly",
  today: string,
  isAdmin: boolean,
) {
  if (period === "today") return { from: today, to: today };
  if (period === "monthly") return { from: `${today.slice(0, 7)}-01`, to: today };
  const current = new Date(`${today}T12:00:00Z`);
  const weekday = current.getUTCDay();
  current.setUTCDate(current.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  const weekStart = current.toISOString().slice(0, 10);
  return {
    from: isAdmin
      ? weekStart
      : weekStart < `${today.slice(0, 7)}-01`
        ? `${today.slice(0, 7)}-01`
        : weekStart,
    to: today,
  };
}

function ReportTable({ children, headers }: { children: React.ReactNode; headers: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="border-y border-[var(--border)] bg-[var(--subtle-panel)] text-xs text-[var(--muted)]">
          <tr>
            {headers.map((header) => (
              <th className="px-5 py-3 font-semibold last:text-right" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">{children}</tbody>
      </table>
    </div>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

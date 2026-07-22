import { Button } from "@eyeflow/ui";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Clock3, Gauge, ShoppingBag } from "lucide-react";
import { useState } from "react";
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
  const isAdmin = loaderData.session.user.role?.split(",").includes("admin") ?? false;
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

        {isAdmin && reports.targetGaps ? (
          <article className="panel overflow-hidden">
            <div className="p-5">
              <h2 className="panel-title flex items-center gap-2">
                <Gauge size={18} /> Missing weekly and monthly targets
              </h2>
              <p className="panel-subtitle">Configured by department in Administration</p>
            </div>
            <ReportTable
              headers={[
                "Department",
                "Weekly actual",
                "Weekly gap",
                "Monthly actual",
                "Monthly gap",
              ]}
            >
              {reports.targetGaps.map((row) => (
                <tr key={row.department}>
                  <td className="px-5 py-3 font-semibold">{row.department}</td>
                  <td className="px-5 py-3">{formatCurrency(row.actualWeek)}</td>
                  <td className="px-5 py-3 font-bold text-amber-600">
                    {formatCurrency(row.weeklyGap)}
                  </td>
                  <td className="px-5 py-3">{formatCurrency(row.actualMonth)}</td>
                  <td className="px-5 py-3 font-bold text-amber-600">
                    {formatCurrency(row.monthlyGap)}
                  </td>
                </tr>
              ))}
            </ReportTable>
          </article>
        ) : null}

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

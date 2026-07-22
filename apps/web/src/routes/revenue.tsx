import { createFileRoute } from "@tanstack/react-router";
import { Banknote, CreditCard, ReceiptIndianRupee, Smartphone } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { formatCurrency } from "../features/dashboard/dashboard-data";
import { getDashboardData, initialDashboardQuery } from "../features/revenue/revenue.functions";

export const Route = createFileRoute("/revenue")({
  component: Revenue,
  loader: () => getDashboardData({ data: { ...initialDashboardQuery, pageSize: 50 } }),
});

function Revenue() {
  const { dashboard, session } = Route.useLoaderData();
  const channels = [
    { icon: Banknote, label: "Cash", value: dashboard.summary.cash },
    { icon: Smartphone, label: "Online", value: dashboard.summary.online },
    { icon: CreditCard, label: "Credit", value: dashboard.summary.credit },
  ];
  return (
    <AppShell user={session.user}>
      <section className="animate-in space-y-5">
        <header>
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            Revenue operations
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em]">Revenue workspace</h1>
          <p className="mt-2 text-sm text-[var(--muted-strong)]">
            Department performance, payment channels, and the complete daily transaction ledger.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <article className="rounded-[24px] bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/10">
            <ReceiptIndianRupee className="text-emerald-400" size={22} />
            <p className="mt-8 text-sm text-slate-400">Net collection</p>
            <p className="mt-1 text-4xl font-bold">{formatCurrency(dashboard.summary.revenue)}</p>
            <p className="mt-3 text-xs text-slate-400">
              {dashboard.summary.transactions} transactions · {dashboard.summary.patients} patients
            </p>
          </article>
          {channels.map(({ icon: Icon, label, value }) => (
            <article className="metric-card" key={label}>
              <Icon className="text-emerald-500" size={20} />
              <p className="mt-8 text-xs font-semibold text-[var(--muted)]">{label}</p>
              <p className="mt-1 text-2xl font-bold">{formatCurrency(value)}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <article className="panel p-5">
            <h2 className="panel-title">Department contribution</h2>
            <p className="panel-subtitle">Net collections for the selected day</p>
            <div className="mt-5 space-y-4">
              {dashboard.departments.map((department) => {
                const share = dashboard.summary.revenue
                  ? Math.round((department.amount / dashboard.summary.revenue) * 100)
                  : 0;
                return (
                  <div key={department.name}>
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">{department.name}</span>
                      <span className="tabular-nums">{formatCurrency(department.amount)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--track)]">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="panel overflow-hidden">
            <div className="p-5">
              <h2 className="panel-title">Transaction ledger</h2>
              <p className="panel-subtitle">Latest 50 collections across accessible departments</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-y border-[var(--border)] bg-[var(--subtle-panel)] text-xs text-[var(--muted)]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Patient</th>
                    <th className="px-5 py-3 font-semibold">Department</th>
                    <th className="px-5 py-3 font-semibold">Mode</th>
                    <th className="px-5 py-3 font-semibold">Time</th>
                    <th className="px-5 py-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {dashboard.recentCollections.map((collection) => (
                    <tr key={`${collection.source}:${collection.id}`}>
                      <td className="px-5 py-3 font-semibold">{collection.patient}</td>
                      <td className="px-5 py-3">{collection.department}</td>
                      <td className="px-5 py-3">{collection.mode}</td>
                      <td className="px-5 py-3 text-[var(--muted)]">{collection.time}</td>
                      <td className="px-5 py-3 text-right font-bold tabular-nums">
                        {formatCurrency(collection.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </section>
    </AppShell>
  );
}

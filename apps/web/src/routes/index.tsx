import { Button, cn } from "@eyeflow/ui";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarDays,
  CircleGauge,
  CreditCard,
  Download,
  IndianRupee,
  Plus,
  Radio,
  ReceiptText,
  Smartphone,
  Users,
} from "lucide-react";
import { useState } from "react";
import { AppShell } from "../components/app-shell";
import {
  departmentSummaries,
  formatCurrency,
  initialDashboardSummary,
  recentCollections,
} from "../features/dashboard/dashboard-data";
import { AddCollectionDialog } from "../features/revenue/add-collection-dialog";
import { type NewCollection, paymentModeLabels } from "../features/revenue/collection-schema";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const [addCollectionOpen, setAddCollectionOpen] = useState(false);
  const [summary, setSummary] = useState(initialDashboardSummary);
  const [departments, setDepartments] = useState(departmentSummaries);
  const [collections, setCollections] = useState(recentCollections);
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(new Date());

  const headlineMetrics = [
    { label: "Cash", amount: summary.cash, icon: Banknote, accent: "emerald" },
    { label: "Online", amount: summary.online, icon: Smartphone, accent: "blue" },
    { label: "Credit", amount: summary.credit, icon: CreditCard, accent: "amber" },
    { label: "Discount", amount: summary.discount, icon: ReceiptText, accent: "rose" },
  ] as const;

  const addCollection = (collection: NewCollection) => {
    const netAmount = collection.amount - collection.discount;
    const now = new Date();
    setCollections((current) => [
      {
        amount: netAmount,
        department: collection.department,
        id: crypto.randomUUID(),
        mode: paymentModeLabels[collection.mode],
        patient: collection.patient,
        time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      },
      ...current,
    ]);
    setDepartments((current) =>
      current.map((department) =>
        department.name === collection.department
          ? { ...department, amount: department.amount + netAmount }
          : department,
      ),
    );
    setSummary((current) => ({
      ...current,
      [collection.mode]: current[collection.mode] + netAmount,
      discount: current.discount + collection.discount,
      patients: current.patients + 1,
      revenue: current.revenue + netAmount,
      transactions: current.transactions + 1,
    }));
  };

  return (
    <AppShell>
      <section className="animate-in">
        <div className="mb-8 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-500" />
              {todayLabel}
            </div>
            <h1 className="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
              Good morning, Dr. Shankar
            </h1>
            <p className="mt-2 text-[var(--muted-strong)]">
              Here’s how your clinic is performing today.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">
              <Download size={16} />
              Export report
            </Button>
            <Button onClick={() => setAddCollectionOpen(true)}>
              <Plus size={17} />
              Add collection
            </Button>
          </div>
        </div>

        <div className="mb-5 grid gap-5 xl:grid-cols-[1.25fr_2fr]">
          <article className="relative overflow-hidden rounded-[26px] bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/10 sm:p-7">
            <div className="absolute -right-16 -top-20 size-56 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-300">Today's revenue</p>
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs text-emerald-300">
                  <Radio size={12} />
                  Live
                </span>
              </div>
              <p className="mt-5 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
                {formatCurrency(summary.revenue)}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <span className="flex items-center gap-1 rounded-lg bg-emerald-400/15 px-2 py-1 font-semibold text-emerald-300">
                  <ArrowUpRight size={14} />
                  12.8%
                </span>
                <span className="text-slate-400">vs. yesterday</span>
              </div>
              <div className="mt-9 grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
                <div>
                  <p className="text-xs text-slate-400">Transactions</p>
                  <p className="mt-1 text-lg font-semibold">{summary.transactions}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Avg. collection</p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatCurrency(Math.round(summary.revenue / summary.transactions))}
                  </p>
                </div>
              </div>
            </div>
          </article>

          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {headlineMetrics.map(({ accent, amount, icon: Icon, label }) => (
              <article className="metric-card" key={label}>
                <div className={cn("metric-icon", `metric-icon-${accent}`)}>
                  <Icon size={19} />
                </div>
                <p className="mt-6 text-sm font-medium text-[var(--muted)]">{label}</p>
                <p className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
                  {formatCurrency(amount)}
                </p>
                <p className="mt-3 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <ArrowUpRight size={13} />
                  8.2% today
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="mb-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <article className="panel p-5 sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="panel-title">Department performance</h2>
                <p className="panel-subtitle">Collection split across all departments</p>
              </div>
              <Button size="sm" variant="ghost">
                View report
                <ArrowRight size={15} />
              </Button>
            </div>
            <div className="space-y-5">
              {departments.map((department) => {
                const width = `${Math.max(20, Math.round((department.amount / 50_000) * 100))}%`;
                return (
                  <div key={department.name}>
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <span className={cn("department-dot", `department-${department.color}`)} />
                        <span className="text-sm font-semibold">{department.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold">
                          {formatCurrency(department.amount)}
                        </span>
                        <span
                          className={cn(
                            "flex min-w-14 items-center justify-end text-xs font-medium",
                            department.change >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-500",
                          )}
                        >
                          {department.change >= 0 ? (
                            <ArrowUpRight size={13} />
                          ) : (
                            <ArrowDownRight size={13} />
                          )}
                          {Math.abs(department.change)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--track)]">
                      <div
                        className={cn("h-full rounded-full", `bar-${department.color}`)}
                        style={{ width }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="panel p-5 sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="panel-title">Today at a glance</h2>
                <p className="panel-subtitle">Operational pulse</p>
              </div>
              <CalendarDays className="text-[var(--muted)]" size={20} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <QuickStat icon={Users} label="Patients" value={String(summary.patients)} />
              <QuickStat icon={CircleGauge} label="Payments" value={String(summary.transactions)} />
              <QuickStat icon={Building2} label="Departments" value="5" />
              <QuickStat icon={IndianRupee} label="Pending" value="₹18.4K" />
            </div>
            <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    Daily target
                  </p>
                  <p className="mt-1 text-xs text-emerald-700/70 dark:text-emerald-300/70">
                    84% of ₹2,00,000
                  </p>
                </div>
                <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                  84%
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-emerald-950/10">
                <div className="h-full w-[84%] rounded-full bg-emerald-500" />
              </div>
            </div>
          </article>
        </div>

        <article className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] p-5 sm:px-6">
            <div>
              <h2 className="panel-title">Recent collections</h2>
              <p className="panel-subtitle">Latest payments across the clinic</p>
            </div>
            <Button size="sm" variant="outline">
              View all
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--muted)]">
                  <th className="px-6 py-3.5 font-semibold">Patient</th>
                  <th className="px-4 py-3.5 font-semibold">Department</th>
                  <th className="px-4 py-3.5 font-semibold">Mode</th>
                  <th className="px-4 py-3.5 font-semibold">Time</th>
                  <th className="px-6 py-3.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((collection) => (
                  <tr
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--hover)]"
                    key={collection.id}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-xl bg-[var(--track)] text-xs font-bold">
                          {collection.patient
                            .split(" ")
                            .map((part) => part[0])
                            .join("")}
                        </span>
                        <span className="text-sm font-semibold">{collection.patient}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-lg bg-[var(--track)] px-2.5 py-1.5 text-xs font-medium">
                        {collection.department}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--muted-strong)]">
                      {collection.mode}
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{collection.time}</td>
                    <td className="px-6 py-4 text-right text-sm font-bold">
                      {formatCurrency(collection.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
      <AddCollectionDialog
        onAdd={addCollection}
        onOpenChange={setAddCollectionOpen}
        open={addCollectionOpen}
      />
    </AppShell>
  );
}

interface QuickStatProps {
  icon: typeof Users;
  label: string;
  value: string;
}

function QuickStat({ icon: Icon, label, value }: QuickStatProps) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--subtle-panel)] p-4">
      <Icon className="mb-4 text-[var(--muted)]" size={18} />
      <p className="text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{label}</p>
    </div>
  );
}

import { cn } from "@eyeflow/ui";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Glasses, IndianRupee, PackageCheck, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "../components/app-shell";
import { formatCurrency } from "../features/dashboard/dashboard-data";
import { getOpticalTracker, setOpticalOrderStatus } from "../features/optical/optical.functions";
import {
  type OpticalOrderStatus,
  opticalOrderStatuses,
  opticalOrderStatusLabels,
} from "../features/optical/optical-schema";

export const Route = createFileRoute("/optical-tracker")({
  component: OpticalTracker,
  loader: () => getOpticalTracker(),
});

const statusStyles: Record<OpticalOrderStatus, string> = {
  advanced: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  delivered: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  fitted: "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  lens_arrived: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  ordered: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  walk_in: "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

function OpticalTracker() {
  const loaderData = Route.useLoaderData();
  const [tracker, setTracker] = useState(loaderData.tracker);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OpticalOrderStatus>("all");
  const [savingOrder, setSavingOrder] = useState<string>();
  const [error, setError] = useState<string>();
  const visibleOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return tracker.orders.filter(
      (order) =>
        (statusFilter === "all" || order.status === statusFilter) &&
        (term.length === 0 || order.patient.toLocaleLowerCase().includes(term)),
    );
  }, [search, statusFilter, tracker.orders]);

  const changeStatus = async (orderKey: string, status: OpticalOrderStatus) => {
    try {
      setSavingOrder(orderKey);
      setError(undefined);
      const updated = await setOpticalOrderStatus({ data: { orderKey, status } });
      setTracker(updated);
    } catch (changeError) {
      setError(
        changeError instanceof Error ? changeError.message : "Unable to update this optical order.",
      );
    } finally {
      setSavingOrder(undefined);
    }
  };

  return (
    <AppShell user={loaderData.session.user}>
      <section className="animate-in space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-600 dark:text-cyan-400">
              Optical operations
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em]">Optical Tracker</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted-strong)]">
              Track every Opticals order from the first advance through fitting and delivery.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.07] px-4 py-3">
            <div className="grid size-10 place-items-center rounded-xl bg-cyan-500 text-white">
              <Glasses size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--muted)]">Tracked orders</p>
              <p className="text-xl font-black">{tracker.totalOrders}</p>
            </div>
            <div className="ml-3 border-l border-cyan-500/20 pl-4">
              <p className="text-xs font-semibold text-[var(--muted)]">Collected</p>
              <p className="text-xl font-black">{formatCurrency(tracker.totalCollected)}</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {tracker.summary.map(({ count, status }) => (
            <button
              aria-pressed={statusFilter === status}
              className={cn(
                "rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm",
                statusStyles[status],
                statusFilter === status && "ring-2 ring-current/25",
              )}
              key={status}
              onClick={() => setStatusFilter((current) => (current === status ? "all" : status))}
              type="button"
            >
              <p className="text-xs font-bold">{opticalOrderStatusLabels[status]}</p>
              <p className="mt-2 text-3xl font-black tabular-nums">{count}</p>
            </button>
          ))}
        </div>

        <article className="panel overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="panel-title">All optical orders</h2>
              <p className="panel-subtitle">
                {visibleOrders.length} of {tracker.totalOrders} orders shown
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                  size={16}
                />
                <input
                  aria-label="Search optical orders"
                  className="form-control min-w-64 pl-9"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search patient"
                  value={search}
                />
              </label>
              <select
                aria-label="Filter optical orders by status"
                className="form-control min-w-44"
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | OpticalOrderStatus)
                }
                value={statusFilter}
              >
                <option value="all">All states</option>
                {opticalOrderStatuses.map((status) => (
                  <option key={status} value={status}>
                    {opticalOrderStatusLabels[status]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error ? (
            <p
              className="border-b border-rose-500/20 bg-rose-500/10 px-5 py-3 text-sm font-semibold text-rose-700 dark:text-rose-300"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-[var(--subtle-panel)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Patient</th>
                  <th className="px-5 py-3.5 font-semibold">Order date</th>
                  <th className="px-5 py-3.5 font-semibold">Payments</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Collected</th>
                  <th className="px-5 py-3.5 font-semibold">Current state</th>
                  <th className="px-5 py-3.5 font-semibold">Last updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {visibleOrders.map((order) => (
                  <tr className="transition hover:bg-[var(--hover)]" key={order.orderKey}>
                    <td className="px-5 py-4">
                      <p className="font-bold">{order.patient}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {order.status === "delivered" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={12} />
                            Completed
                          </span>
                        ) : (
                          "In progress"
                        )}
                      </p>
                    </td>
                    <td className="px-5 py-4 font-medium">{formatDate(order.orderDate)}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5">
                        <PackageCheck size={15} />
                        {order.paymentCount}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-bold tabular-nums">
                      <span className="inline-flex items-center">
                        <IndianRupee size={13} />
                        {new Intl.NumberFormat("en-IN", {
                          maximumFractionDigits: 2,
                        }).format(order.collectedAmount)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <select
                        aria-label={`Status for ${order.patient} ${order.orderDate}`}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-xs font-bold outline-none",
                          statusStyles[order.status],
                        )}
                        disabled={savingOrder === order.orderKey}
                        onChange={(event) =>
                          void changeStatus(
                            order.orderKey,
                            event.target.value as OpticalOrderStatus,
                          )
                        }
                        value={order.status}
                      >
                        {opticalOrderStatuses.map((status) => (
                          <option key={status} value={status}>
                            {opticalOrderStatusLabels[status]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4 text-xs text-[var(--muted)]">
                      {savingOrder === order.orderKey
                        ? "Saving…"
                        : order.updatedAt
                          ? `${formatTimestamp(order.updatedAt)} · ${order.updatedBy}`
                          : "Imported · not updated"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleOrders.length === 0 ? (
            <div className="grid min-h-56 place-items-center p-8 text-center">
              <div>
                <Glasses className="mx-auto text-cyan-500" size={28} />
                <p className="mt-3 font-bold">No optical orders match this view</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Opticals collections and mapped EMR receipts appear here automatically.
                </p>
              </div>
            </div>
          ) : null}
        </article>
      </section>
    </AppShell>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

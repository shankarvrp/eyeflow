import { Button, cn } from "@eyeflow/ui";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  CreditCard,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  Pencil,
  Plus,
  Radio,
  ReceiptText,
  Smartphone,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../components/app-shell";
import {
  formatCurrency,
  type PatientCollectionSummary,
  type RecentCollection,
  type TargetProgress,
} from "../features/dashboard/dashboard-data";
import { AddCollectionDialog } from "../features/revenue/add-collection-dialog";
import { type DashboardQuery, shiftDateKey } from "../features/revenue/collection-query";
import type {
  EditCollection,
  NewCollectionBatch,
  PatientWorkspaceUpdate,
} from "../features/revenue/collection-schema";
import { EditCollectionDialog } from "../features/revenue/edit-collection-dialog";
import { PatientWorkspaceDialog } from "../features/revenue/patient-workspace-dialog";
import {
  createCollectionBatch,
  getDashboardData,
  initialDashboardQuery,
  updateCollection,
  updatePatientWorkspace,
} from "../features/revenue/revenue.functions";

export const Route = createFileRoute("/")({
  component: Dashboard,
  loader: () => getDashboardData({ data: initialDashboardQuery }),
});

function Dashboard() {
  const loaderData = Route.useLoaderData();
  const [addCollectionOpen, setAddCollectionOpen] = useState(false);
  const [collectionTab, setCollectionTab] = useState<"patients" | "recent">("recent");
  const [editCollectionOpen, setEditCollectionOpen] = useState(false);
  const [patientWorkspaceOpen, setPatientWorkspaceOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<RecentCollection | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientCollectionSummary | null>(null);
  const [ready, setReady] = useState(false);
  const [summary, setSummary] = useState(loaderData.dashboard.summary);
  const [departments, setDepartments] = useState(loaderData.dashboard.departments);
  const [collections, setCollections] = useState(loaderData.dashboard.recentCollections);
  const [patientCollections, setPatientCollections] = useState(
    loaderData.dashboard.patientCollections,
  );
  const [pagination, setPagination] = useState(loaderData.dashboard.pagination);
  const [targets, setTargets] = useState(loaderData.dashboard.targets);
  const [query, setQuery] = useState<DashboardQuery>(initialDashboardQuery);
  const [draftFrom, setDraftFrom] = useState(initialDashboardQuery.from);
  const [draftTo, setDraftTo] = useState(initialDashboardQuery.to);
  const [loadingRange, setLoadingRange] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"connected" | "reconnecting">("reconnecting");
  const [rangeError, setRangeError] = useState<string>();
  const isAdmin = loaderData.session.user.role?.split(",").includes("admin") ?? false;
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(new Date());
  const activePage = collectionTab === "recent" ? query.collectionPage : query.patientPage;
  const activeTotal =
    collectionTab === "recent" ? pagination.totalCollections : pagination.totalPatients;
  const displayedTotal =
    collectionTab === "recent"
      ? collections.length === 0
        ? 0
        : (query.collectionPage - 1) * query.pageSize + collections.length
      : patientCollections.length === 0
        ? 0
        : (query.patientPage - 1) * query.pageSize + patientCollections.length;

  const applyDashboard = useCallback((updatedDashboard: typeof loaderData.dashboard) => {
    setCollections(updatedDashboard.recentCollections);
    setPatientCollections(updatedDashboard.patientCollections);
    setDepartments(updatedDashboard.departments);
    setSummary(updatedDashboard.summary);
    setTargets(updatedDashboard.targets);
    setPagination(updatedDashboard.pagination);
  }, []);

  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (!isAdmin || !liveEnabled) return;
    const events = new EventSource("/api/live/collections");
    events.onopen = () => setLiveStatus("connected");
    events.onerror = () => setLiveStatus("reconnecting");
    events.onmessage = () => {
      void getDashboardData({ data: query }).then((result) => applyDashboard(result.dashboard));
    };
    return () => events.close();
  }, [applyDashboard, isAdmin, liveEnabled, query]);

  const headlineMetrics = [
    { label: "Cash", amount: summary.cash, icon: Banknote, accent: "emerald" },
    { label: "Online", amount: summary.online, icon: Smartphone, accent: "blue" },
    { label: "Credit", amount: summary.credit, icon: CreditCard, accent: "amber" },
    { label: "Discount", amount: summary.discount, icon: ReceiptText, accent: "rose" },
  ] as const;

  const loadDashboard = async (nextQuery: DashboardQuery) => {
    try {
      setLoadingRange(true);
      setRangeError(undefined);
      const result = await getDashboardData({ data: nextQuery });
      setQuery(nextQuery);
      setDraftFrom(nextQuery.from);
      setDraftTo(nextQuery.to);
      applyDashboard(result.dashboard);
    } catch (error) {
      setRangeError(error instanceof Error ? error.message : "Unable to load that date range.");
    } finally {
      setLoadingRange(false);
    }
  };

  const addCollection = async (collection: NewCollectionBatch) => {
    await createCollectionBatch({ data: collection });
    await loadDashboard({ ...query, collectionPage: 1, patientPage: 1 });
  };

  const saveCollection = async (collection: EditCollection) => {
    await updateCollection({ data: collection });
    await loadDashboard(query);
  };

  const savePatientWorkspace = async (workspace: PatientWorkspaceUpdate) => {
    await updatePatientWorkspace({ data: workspace });
    await loadDashboard(query);
  };

  const moveOneDay = (days: number) => {
    const nextDate = shiftDateKey(query.from, days);
    void loadDashboard({
      ...query,
      collectionPage: 1,
      from: nextDate,
      patientPage: 1,
      to: nextDate,
    });
  };

  const exportHref = (format: "pdf" | "xlsx") => {
    const params = new URLSearchParams({ format, from: query.from, to: query.to });
    return `/api/exports/collections?${params.toString()}`;
  };

  return (
    <AppShell user={loaderData.session.user}>
      <section className="animate-in">
        <div className="mb-8 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-500" />
              {todayLabel}
            </div>
            <h1 className="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
              Good morning, {loaderData.session.user.name}
            </h1>
            <p className="mt-2 text-[var(--muted-strong)]">
              {query.from === query.to
                ? "Here’s how your clinic performed on the selected day."
                : "Here’s how your clinic performed across the selected period."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a download href={exportHref("xlsx")}>
                <FileSpreadsheet size={16} />
                Excel
              </a>
            </Button>
            <Button asChild variant="outline">
              <a download href={exportHref("pdf")}>
                <FileText size={16} />
                PDF
              </a>
            </Button>
            <Button disabled={!ready} onClick={() => setAddCollectionOpen(true)}>
              <Plus size={17} />
              Add collection
            </Button>
          </div>
        </div>

        <div className="panel mb-5 flex flex-col gap-4 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-2">
            <Button
              aria-label="Previous day"
              disabled={loadingRange || (!isAdmin && query.from <= `${query.to.slice(0, 7)}-01`)}
              onClick={() => moveOneDay(-1)}
              size="sm"
              variant="outline"
            >
              <ChevronLeft size={16} />
            </Button>
            <label>
              <span className="form-label">From</span>
              <input
                className="form-control w-40"
                max={initialDashboardQuery.to}
                min={isAdmin ? undefined : `${initialDashboardQuery.to.slice(0, 7)}-01`}
                onChange={(event) => setDraftFrom(event.target.value)}
                type="date"
                value={draftFrom}
              />
            </label>
            <label>
              <span className="form-label">To</span>
              <input
                className="form-control w-40"
                max={initialDashboardQuery.to}
                min={isAdmin ? undefined : `${initialDashboardQuery.to.slice(0, 7)}-01`}
                onChange={(event) => setDraftTo(event.target.value)}
                type="date"
                value={draftTo}
              />
            </label>
            <Button
              disabled={loadingRange}
              onClick={() =>
                void loadDashboard({
                  ...query,
                  collectionPage: 1,
                  from: draftFrom,
                  patientPage: 1,
                  to: draftTo,
                })
              }
              size="sm"
            >
              {loadingRange ? "Loading…" : "Apply range"}
            </Button>
            <Button
              disabled={loadingRange}
              onClick={() => void loadDashboard(initialDashboardQuery)}
              size="sm"
              variant="ghost"
            >
              Today
            </Button>
            <Button
              aria-label="Next day"
              disabled={loadingRange || query.to >= initialDashboardQuery.to}
              onClick={() => moveOneDay(1)}
              size="sm"
              variant="outline"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
          <div className="flex items-center gap-3 text-sm text-[var(--muted-strong)]">
            <CalendarDays size={17} />
            <span>{query.from === query.to ? query.from : `${query.from} to ${query.to}`}</span>
            <select
              aria-label="Rows per page"
              className="form-control w-24"
              onChange={(event) =>
                void loadDashboard({
                  ...query,
                  collectionPage: 1,
                  pageSize: Number(event.target.value),
                  patientPage: 1,
                })
              }
              value={query.pageSize}
            >
              <option value="10">10 rows</option>
              <option value="25">25 rows</option>
              <option value="50">50 rows</option>
            </select>
          </div>
        </div>
        {rangeError ? (
          <div
            className="mb-5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300"
            role="alert"
          >
            {rangeError}
          </div>
        ) : null}

        <div className="mb-5 grid gap-5 xl:grid-cols-[1.25fr_2fr]">
          <article className="relative overflow-hidden rounded-[26px] bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/10 sm:p-7">
            <div className="absolute -right-16 -top-20 size-56 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-300">
                  {query.from === query.to ? "Collection revenue" : "Range revenue"}
                </p>
                {isAdmin ? (
                  <button
                    aria-pressed={liveEnabled}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition",
                      liveEnabled
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-white/10 text-slate-300 hover:bg-white/15",
                    )}
                    onClick={() => setLiveEnabled((current) => !current)}
                    type="button"
                  >
                    <Radio size={12} />
                    {liveEnabled
                      ? liveStatus === "connected"
                        ? "Live on"
                        : "Connecting…"
                      : "Enable live"}
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-300">
                    <Radio size={12} />
                    Updated
                  </span>
                )}
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
                    {formatCurrency(
                      summary.transactions === 0
                        ? 0
                        : Math.round(summary.revenue / summary.transactions),
                    )}
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
                <h2 className="panel-title">
                  {query.from === query.to ? "Selected day at a glance" : "Period at a glance"}
                </h2>
                <p className="panel-subtitle">Operational pulse for the active filter</p>
              </div>
              <CalendarDays className="text-[var(--muted)]" size={20} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <QuickStat icon={Users} label="Patients" value={String(summary.patients)} />
              <QuickStat icon={CircleGauge} label="Payments" value={String(summary.transactions)} />
              <QuickStat icon={Building2} label="Departments" value="5" />
              <QuickStat icon={IndianRupee} label="Pending" value="₹18.4K" />
            </div>
            <div className="mt-5 space-y-3">
              <TargetCard target={targets.daily} />
              {targets.weekly ? <TargetCard target={targets.weekly} /> : null}
              {targets.monthly ? <TargetCard target={targets.monthly} /> : null}
            </div>
          </article>
        </div>

        <article className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] p-5 sm:px-6">
            <div>
              <div
                className="flex items-center gap-1 rounded-xl bg-[var(--track)] p-1"
                role="tablist"
              >
                <button
                  aria-selected={collectionTab === "recent"}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-semibold transition",
                    collectionTab === "recent"
                      ? "bg-[var(--panel)] text-[var(--foreground)] shadow-sm"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]",
                  )}
                  onClick={() => setCollectionTab("recent")}
                  role="tab"
                  type="button"
                >
                  Recent collections
                </button>
                <button
                  aria-selected={collectionTab === "patients"}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-semibold transition",
                    collectionTab === "patients"
                      ? "bg-[var(--panel)] text-[var(--foreground)] shadow-sm"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]",
                  )}
                  onClick={() => setCollectionTab("patients")}
                  role="tab"
                  type="button"
                >
                  Patient-wise
                </button>
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {collectionTab === "recent"
                  ? "Latest payments across the clinic"
                  : "Consolidated collections and editing by patient"}
              </p>
            </div>
            <span className="text-xs font-medium text-[var(--muted)]">
              Showing {displayedTotal} of {activeTotal}
            </span>
          </div>
          {collectionTab === "recent" ? (
            <div className="overflow-x-auto" role="tabpanel">
              <table className="w-full min-w-[700px] text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--muted)]">
                    <th className="px-6 py-3.5 font-semibold">Patient</th>
                    <th className="px-4 py-3.5 font-semibold">Department</th>
                    <th className="px-4 py-3.5 font-semibold">Mode</th>
                    <th className="px-4 py-3.5 font-semibold">Time</th>
                    <th className="px-6 py-3.5 text-right font-semibold">Amount</th>
                    <th className="px-6 py-3.5 text-right font-semibold">Actions</th>
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
                      <td className="px-6 py-4 text-right">
                        {collection.canEdit ? (
                          <Button
                            aria-label={`Edit ${collection.patient} ${collection.department} ${collection.mode}`}
                            onClick={() => {
                              setSelectedCollection(collection);
                              setEditCollectionOpen(true);
                            }}
                            size="sm"
                            variant="ghost"
                          >
                            <Pencil size={14} />
                            Edit
                          </Button>
                        ) : (
                          <span className="text-xs font-medium text-[var(--muted)]">Locked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto" role="tabpanel">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--muted)]">
                    <th className="px-6 py-3.5 font-semibold">Patient</th>
                    <th className="px-4 py-3.5 font-semibold">Departments</th>
                    <th className="px-4 py-3.5 font-semibold">Payments</th>
                    <th className="px-4 py-3.5 font-semibold">Last collection</th>
                    <th className="px-4 py-3.5 text-right font-semibold">Total</th>
                    <th className="px-6 py-3.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patientCollections.map((patient) => (
                    <tr
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--hover)]"
                      key={patient.customerId}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 place-items-center rounded-xl bg-[var(--track)] text-xs font-bold">
                            {patient.patient
                              .split(" ")
                              .map((part) => part[0])
                              .join("")}
                          </span>
                          <span className="text-sm font-semibold">{patient.patient}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {patient.departments.map((department) => (
                            <span
                              className="rounded-lg bg-[var(--track)] px-2 py-1 text-xs font-medium"
                              key={department}
                            >
                              {department}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-[var(--muted-strong)]">
                        {patient.collections.length}
                      </td>
                      <td className="px-4 py-4 text-sm text-[var(--muted)]">
                        {new Intl.DateTimeFormat("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(patient.lastCollectionAt))}
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-bold">
                        {formatCurrency(patient.total)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          aria-label={`Open patient ${patient.patient}`}
                          onClick={() => {
                            setSelectedPatient(patient);
                            setPatientWorkspaceOpen(true);
                          }}
                          size="sm"
                          variant="ghost"
                        >
                          {patient.canEdit ? <Pencil size={14} /> : <Users size={14} />}
                          {patient.canEdit ? "View / edit" : "View"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-4 sm:px-6">
            <p className="text-xs text-[var(--muted)]">
              Page {activePage} of {Math.max(1, Math.ceil(activeTotal / query.pageSize))}
            </p>
            <div className="flex gap-2">
              <Button
                disabled={loadingRange || activePage <= 1}
                onClick={() =>
                  void loadDashboard({
                    ...query,
                    ...(collectionTab === "recent"
                      ? { collectionPage: activePage - 1 }
                      : { patientPage: activePage - 1 }),
                  })
                }
                size="sm"
                variant="outline"
              >
                <ChevronLeft size={14} />
                Previous
              </Button>
              <Button
                disabled={
                  loadingRange || activePage >= Math.max(1, Math.ceil(activeTotal / query.pageSize))
                }
                onClick={() =>
                  void loadDashboard({
                    ...query,
                    ...(collectionTab === "recent"
                      ? { collectionPage: activePage + 1 }
                      : { patientPage: activePage + 1 }),
                  })
                }
                size="sm"
                variant="outline"
              >
                Next
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </article>
      </section>
      <AddCollectionDialog
        allowedDepartments={departments.map((department) => department.name)}
        canChooseDate={isAdmin}
        defaultOccurredOn={
          isAdmin && query.from === query.to ? query.from : initialDashboardQuery.from
        }
        onAdd={addCollection}
        onOpenChange={setAddCollectionOpen}
        open={addCollectionOpen}
      />
      <EditCollectionDialog
        collection={selectedCollection}
        onOpenChange={(open) => {
          setEditCollectionOpen(open);
          if (!open) setSelectedCollection(null);
        }}
        onSave={saveCollection}
        open={editCollectionOpen}
      />
      <PatientWorkspaceDialog
        allowedDepartments={departments.map((department) => department.name)}
        onOpenChange={(open) => {
          setPatientWorkspaceOpen(open);
          if (!open) setSelectedPatient(null);
        }}
        onSave={savePatientWorkspace}
        open={patientWorkspaceOpen}
        workspace={selectedPatient}
      />
    </AppShell>
  );
}

function TargetCard({ target }: { target: TargetProgress }) {
  const percentage =
    target.target === 0 ? 0 : Math.min(100, Math.round((target.actual / target.target) * 100));
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            {target.label} target
          </p>
          <p className="mt-1 text-xs text-emerald-700/70 dark:text-emerald-300/70">
            {formatCurrency(target.actual)} of {formatCurrency(target.target)}
          </p>
        </div>
        <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
          {percentage}%
        </span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-emerald-950/10">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
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

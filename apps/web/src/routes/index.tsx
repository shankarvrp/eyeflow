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
  Link2,
  LockKeyhole,
  Pencil,
  Plus,
  Radio,
  ReceiptText,
  RefreshCw,
  Scale,
  Smartphone,
  UnlockKeyhole,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "../components/app-shell";
import { closeDay, reopenDay, signOffCollection } from "../features/closure/closure.functions";
import type { SignOffCollection } from "../features/closure/closure-schema";
import { CollectionSignoffPanel } from "../features/closure/collection-signoff-panel";
import {
  formatCurrency,
  type PatientCollectionSummary,
  type RecentCollection,
  type TargetProgress,
} from "../features/dashboard/dashboard-data";
import {
  connectEmr,
  getEmrPatientOptions,
  getEmrReceiptDrafts,
  getEmrSyncStatus,
  syncEmrNow,
} from "../features/emr/emr.functions";
import { AddCollectionDialog } from "../features/revenue/add-collection-dialog";
import { type DashboardQuery, shiftDateKey } from "../features/revenue/collection-query";
import type {
  NewCollectionBatch,
  PatientWorkspaceUpdate,
} from "../features/revenue/collection-schema";
import { PatientWorkspaceDialog } from "../features/revenue/patient-workspace-dialog";
import {
  createCollectionBatch,
  getDashboardData,
  initialDashboardQuery,
  updatePatientWorkspace,
} from "../features/revenue/revenue.functions";

export const Route = createFileRoute("/")({
  component: Dashboard,
  loader: async () => {
    const [dashboardData, emrStatus] = await Promise.all([
      getDashboardData({ data: initialDashboardQuery }),
      getEmrSyncStatus({ data: { appointmentDate: initialDashboardQuery.to } }),
    ]);
    return { ...dashboardData, emrStatus };
  },
});

function Dashboard() {
  const loaderData = Route.useLoaderData();
  const [addCollectionOpen, setAddCollectionOpen] = useState(false);
  const [collectionTab, setCollectionTab] = useState<"patients" | "recent">("recent");
  const [patientWorkspaceOpen, setPatientWorkspaceOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientCollectionSummary | null>(null);
  const [prefillEmrPatient, setPrefillEmrPatient] = useState<{
    displayName: string;
    id: string;
  } | null>(null);
  const [ready, setReady] = useState(false);
  const [summary, setSummary] = useState(loaderData.dashboard.summary);
  const [departments, setDepartments] = useState(loaderData.dashboard.departments);
  const [collections, setCollections] = useState(loaderData.dashboard.recentCollections);
  const [patientCollections, setPatientCollections] = useState(
    loaderData.dashboard.patientCollections,
  );
  const [pagination, setPagination] = useState(loaderData.dashboard.pagination);
  const [targets, setTargets] = useState(loaderData.dashboard.targets);
  const [reconciliation, setReconciliation] = useState(loaderData.dashboard.reconciliation);
  const [closure, setClosure] = useState(loaderData.dashboard.closure);
  const [signoffs, setSignoffs] = useState(loaderData.dashboard.signoffs);
  const [closureReason, setClosureReason] = useState("");
  const [closureOperation, setClosureOperation] = useState(false);
  const [closureError, setClosureError] = useState<string>();
  const [query, setQuery] = useState<DashboardQuery>(initialDashboardQuery);
  const [draftFrom, setDraftFrom] = useState(initialDashboardQuery.from);
  const [draftTo, setDraftTo] = useState(initialDashboardQuery.to);
  const [loadingRange, setLoadingRange] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"connected" | "reconnecting">("reconnecting");
  const [rangeError, setRangeError] = useState<string>();
  const [emrStatus, setEmrStatus] = useState(loaderData.emrStatus);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncReady, setAutoSyncReady] = useState(false);
  const [emrOperation, setEmrOperation] = useState<"connecting" | "idle" | "syncing">("idle");
  const [emrMessage, setEmrMessage] = useState<string>();
  const initialEmrSyncStarted = useRef(false);
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
  const allowedDepartmentNames = useMemo(
    () => departments.map((department) => department.name),
    [departments],
  );

  const applyDashboard = useCallback((updatedDashboard: typeof loaderData.dashboard) => {
    setCollections(updatedDashboard.recentCollections);
    setPatientCollections(updatedDashboard.patientCollections);
    setDepartments(updatedDashboard.departments);
    setSummary(updatedDashboard.summary);
    setTargets(updatedDashboard.targets);
    setReconciliation(updatedDashboard.reconciliation);
    setClosure(updatedDashboard.closure);
    setSignoffs(updatedDashboard.signoffs);
    setPagination(updatedDashboard.pagination);
  }, []);
  const loadEmrPatientOptions = useCallback(
    (appointmentDate: string) => getEmrPatientOptions({ data: { appointmentDate } }),
    [],
  );
  const loadEmrReceiptDrafts = useCallback(
    (appointmentDate: string, emrPatientId: string) =>
      getEmrReceiptDrafts({ data: { appointmentDate, emrPatientId } }),
    [],
  );

  const synchronizeEmr = useCallback(
    async (appointmentDate: string, scheduled = false) => {
      try {
        setEmrOperation("syncing");
        if (!scheduled) setEmrMessage(undefined);
        const status = await syncEmrNow({ data: { appointmentDate } });
        const refreshedDashboard = await getDashboardData({ data: query });
        setEmrStatus(status);
        applyDashboard(refreshedDashboard.dashboard);
        setEmrMessage(
          `${status.patientCount} patient${status.patientCount === 1 ? "" : "s"} and ${status.receiptCount} receipt${status.receiptCount === 1 ? "" : "s"} synchronized for ${appointmentDate}.`,
        );
      } catch (error) {
        setEmrMessage(error instanceof Error ? error.message : "Unable to synchronize the EMR.");
      } finally {
        setEmrOperation("idle");
      }
    },
    [applyDashboard, query],
  );

  const connectToEmr = useCallback(async () => {
    try {
      setEmrOperation("connecting");
      setEmrMessage("Complete the EMR sign-in in the secure browser window that opened.");
      const status = await connectEmr({
        data: { appointmentDate: initialDashboardQuery.to },
      });
      setEmrStatus(status);
      setEmrMessage(
        `EMR connected. ${status.patientCount} patient${status.patientCount === 1 ? "" : "s"} and ${status.receiptCount} receipt${status.receiptCount === 1 ? "" : "s"} synchronized for today.`,
      );
    } catch (error) {
      setEmrMessage(error instanceof Error ? error.message : "Unable to connect the EMR.");
    } finally {
      setEmrOperation("idle");
    }
  }, []);

  useEffect(() => {
    setReady(true);
    setAutoSyncEnabled(window.localStorage.getItem("eyeflow.emr-auto-sync") === "enabled");
    setAutoSyncReady(true);
  }, []);

  useEffect(() => {
    if (
      !ready ||
      !autoSyncReady ||
      !autoSyncEnabled ||
      !emrStatus.connected ||
      initialEmrSyncStarted.current
    )
      return;
    initialEmrSyncStarted.current = true;
    void synchronizeEmr(initialDashboardQuery.to, true);
  }, [autoSyncEnabled, autoSyncReady, emrStatus.connected, ready, synchronizeEmr]);

  useEffect(() => {
    if (!ready || !autoSyncReady || !autoSyncEnabled || !emrStatus.connected) return;
    const timer = window.setInterval(
      () => void synchronizeEmr(initialDashboardQuery.to, true),
      emrStatus.autoSyncIntervalMinutes * 60_000,
    );
    return () => window.clearInterval(timer);
  }, [
    autoSyncEnabled,
    autoSyncReady,
    emrStatus.autoSyncIntervalMinutes,
    emrStatus.connected,
    ready,
    synchronizeEmr,
  ]);

  const changeAutoSync = (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    initialEmrSyncStarted.current = false;
    window.localStorage.setItem("eyeflow.emr-auto-sync", enabled ? "enabled" : "disabled");
  };

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

  const savePatientWorkspace = async (workspace: PatientWorkspaceUpdate) => {
    await updatePatientWorkspace({ data: workspace });
    await loadDashboard(query);
  };

  const openCollectionEditor = (collection: RecentCollection) => {
    if (collection.source === "emr") {
      setPrefillEmrPatient({
        displayName: collection.patient,
        id: collection.customerId.replace(/^emr:/, ""),
      });
      setAddCollectionOpen(true);
      return;
    }
    const matchingCollections = collections.filter(
      (candidate) => candidate.customerId === collection.customerId,
    );
    setSelectedPatient({
      canEdit: matchingCollections.some((candidate) => candidate.canEdit),
      collections: matchingCollections,
      customerId: collection.customerId,
      departments: [...new Set(matchingCollections.map((candidate) => candidate.department))],
      lastCollectionAt: collection.occurredAt,
      patient: collection.patient,
      total: matchingCollections.reduce((total, candidate) => total + candidate.amount, 0),
    });
    setPatientWorkspaceOpen(true);
  };

  const openPatientEditor = (patient: PatientCollectionSummary) => {
    if (patient.customerId.startsWith("emr:")) {
      setPrefillEmrPatient({
        displayName: patient.patient,
        id: patient.customerId.replace(/^emr:/, ""),
      });
      setAddCollectionOpen(true);
      return;
    }
    setSelectedPatient(patient);
    setPatientWorkspaceOpen(true);
  };

  const changeClosure = async () => {
    if (query.from !== query.to || closureReason.trim().length < 3) {
      setClosureError("Enter a reason of at least 3 characters for a single selected day.");
      return;
    }
    try {
      setClosureOperation(true);
      setClosureError(undefined);
      const updatedDashboard =
        closure?.status === "closed"
          ? await reopenDay({ data: { businessDate: query.from, reason: closureReason } })
          : await closeDay({ data: { businessDate: query.from, reason: closureReason } });
      applyDashboard(updatedDashboard);
      setClosureReason("");
    } catch (error) {
      setClosureError(error instanceof Error ? error.message : "Unable to update daily closure.");
    } finally {
      setClosureOperation(false);
    }
  };

  const saveSignoff = async (input: SignOffCollection) => {
    const updatedDashboard = await signOffCollection({ data: input });
    applyDashboard(updatedDashboard);
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
            {isAdmin && !emrStatus.connected ? (
              <Button
                disabled={!ready || emrOperation !== "idle"}
                onClick={() => void connectToEmr()}
                variant="outline"
              >
                <Link2 size={16} />
                {emrOperation === "connecting" ? "Waiting for EMR login…" : "Connect EMR"}
              </Button>
            ) : null}
            <Button
              disabled={!ready || !emrStatus.connected || emrOperation !== "idle"}
              onClick={() => void synchronizeEmr(query.to)}
              variant="outline"
            >
              <RefreshCw
                className={emrOperation === "syncing" ? "animate-spin" : undefined}
                size={16}
              />
              {emrOperation === "syncing" ? "Syncing EMR…" : "Sync EMR"}
            </Button>
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

        <output
          className={cn(
            "mb-5 flex flex-col gap-2 rounded-2xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
            emrStatus.connected
              ? "border-emerald-500/20 bg-emerald-500/[0.06]"
              : "border-amber-500/25 bg-amber-500/[0.08]",
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 rounded-full",
                emrStatus.connected ? "bg-emerald-500" : "bg-amber-500",
              )}
            />
            <span className="font-semibold">
              {emrStatus.connected ? "FOSS EHR connected" : "FOSS EHR not connected"}
            </span>
            <span className="text-[var(--muted-strong)]">
              {emrStatus.connected
                ? `${emrStatus.patientCount} patients · ${emrStatus.receiptCount} receipts for ${emrStatus.appointmentDate}`
                : isAdmin
                  ? "Connect once to enable patient synchronization."
                  : "An administrator must connect the EMR."}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-[var(--muted)]">
            <span>
              {emrStatus.lastSyncedAt
                ? `Last synced ${new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(emrStatus.lastSyncedAt))}`
                : "Not synchronized yet"}
            </span>
            {emrStatus.connected ? (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 font-semibold text-[var(--muted-strong)]">
                <input
                  aria-label="Enable automatic EMR sync"
                  checked={autoSyncEnabled}
                  className="size-4 accent-emerald-500"
                  onChange={(event) => changeAutoSync(event.target.checked)}
                  type="checkbox"
                />
                Auto-sync every {emrStatus.autoSyncIntervalMinutes} min
              </label>
            ) : null}
          </div>
          {emrMessage ? <p className="basis-full text-xs font-medium">{emrMessage}</p> : null}
        </output>

        {isAdmin && reconciliation ? (
          <article className="panel mb-5 p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-3">
                <div className="metric-icon metric-icon-blue mt-0.5">
                  <Scale size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold">Collection reconciliation</h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {reconciliation.sourceLines} EMR receipt lines compared with EyeFlow entries for
                    the active period.
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
                <ReconciliationValue
                  label="EMR gross receipts"
                  value={reconciliation.importedGross}
                />
                <ReconciliationValue label="Refunds deducted" value={-reconciliation.refundTotal} />
                <ReconciliationValue label="EMR net" value={reconciliation.importedNet} />
                <ReconciliationValue label="Manual net" value={reconciliation.manualNet} />
              </dl>
            </div>
            {signoffs && query.from === query.to ? (
              <CollectionSignoffPanel
                businessDate={query.from}
                disabled={closure?.status === "closed"}
                onSignOff={saveSignoff}
                signoffs={signoffs}
                summary={summary}
              />
            ) : null}
            <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold">
                  {closure?.status === "closed" ? (
                    <LockKeyhole className="text-amber-500" size={14} />
                  ) : (
                    <UnlockKeyhole className="text-emerald-500" size={14} />
                  )}
                  {closure?.status === "closed" ? "Day closed and entries locked" : "Day open"}
                </p>
                {closure?.reason ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">Reason: {closure.reason}</p>
                ) : null}
              </div>
              {query.from === query.to ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label>
                    <span className="form-label">
                      {closure?.status === "closed" ? "Reopen reason" : "Closure note"}
                    </span>
                    <input
                      className="form-control w-full sm:w-72"
                      onChange={(event) => setClosureReason(event.target.value)}
                      placeholder="Verified against cash drawer"
                      value={closureReason}
                    />
                  </label>
                  <Button
                    disabled={
                      closureOperation ||
                      closureReason.trim().length < 3 ||
                      (closure?.status !== "closed" &&
                        (!signoffs ||
                          signoffs.periods.length !== 2 ||
                          Math.abs(signoffs.variance) >= 0.01 ||
                          Math.abs(
                            signoffs.periods.reduce(
                              (total, period) => total + period.calculatedNet,
                              0,
                            ) - summary.revenue,
                          ) >= 0.01))
                    }
                    onClick={() => void changeClosure()}
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
              ) : null}
            </div>
            {closureError ? (
              <p className="mt-3 text-xs font-medium text-rose-700 dark:text-rose-300">
                {closureError}
              </p>
            ) : null}
            {reconciliation.reviewLines > 0 ? (
              <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">
                {reconciliation.reviewLines} non-refund receipt line
                {reconciliation.reviewLines === 1 ? " requires" : "s require"} mapping review and is
                not included in the collection total.
              </p>
            ) : null}
          </article>
        ) : null}

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
                    disabled={!ready}
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
                          <span>
                            <span className="block text-sm font-semibold">
                              {collection.patient}
                            </span>
                            {collection.source === "emr" ? (
                              <span className="mt-1 inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                Synced receipt
                              </span>
                            ) : null}
                          </span>
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
                        {collection.source === "emr" || collection.canEdit ? (
                          <Button
                            aria-label={`Edit ${collection.patient} ${collection.department} ${collection.mode}`}
                            onClick={() => openCollectionEditor(collection)}
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
                          onClick={() => openPatientEditor(patient)}
                          size="sm"
                          variant="ghost"
                        >
                          {patient.canEdit || patient.customerId.startsWith("emr:") ? (
                            <Pencil size={14} />
                          ) : (
                            <Users size={14} />
                          )}
                          {patient.canEdit || patient.customerId.startsWith("emr:")
                            ? "View / edit"
                            : "View"}
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
        allowedDepartments={allowedDepartmentNames}
        canChooseDate={isAdmin}
        defaultOccurredOn={
          isAdmin && query.from === query.to ? query.from : initialDashboardQuery.from
        }
        initialEmrPatient={prefillEmrPatient}
        loadPatientOptions={loadEmrPatientOptions}
        loadReceiptDrafts={loadEmrReceiptDrafts}
        onAdd={addCollection}
        onOpenChange={(open) => {
          setAddCollectionOpen(open);
          if (!open) setPrefillEmrPatient(null);
        }}
        open={addCollectionOpen}
      />
      <PatientWorkspaceDialog
        allowedDepartments={allowedDepartmentNames}
        canChooseDate={isAdmin}
        defaultOccurredOn={
          isAdmin && query.from === query.to ? query.from : initialDashboardQuery.from
        }
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

function ReconciliationValue({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-bold tabular-nums">{formatCurrency(value)}</dd>
    </div>
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

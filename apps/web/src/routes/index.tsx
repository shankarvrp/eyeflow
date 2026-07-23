import { Button, cn } from "@eyeflow/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Link2,
  Pencil,
  Plus,
  Radio,
  ReceiptText,
  RefreshCw,
  Smartphone,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "../components/app-shell";
import { closeDay, reopenDay, signOffCollection } from "../features/closure/closure.functions";
import type { SignOffCollection } from "../features/closure/closure-schema";
import { CollectionSignoffPanel } from "../features/closure/collection-signoff-panel";
import {
  type DashboardData,
  formatCurrency,
  type PatientCollectionSummary,
  type RecentCollection,
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
  const [patientMix, setPatientMix] = useState(loaderData.dashboard.patientMix);
  const [collections, setCollections] = useState(loaderData.dashboard.recentCollections);
  const [patientCollections, setPatientCollections] = useState(
    loaderData.dashboard.patientCollections,
  );
  const [pagination, setPagination] = useState(loaderData.dashboard.pagination);
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
  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  });
  const headingDate =
    query.from === query.to
      ? dateFormatter.format(new Date(`${query.from}T12:00:00`))
      : `${dateFormatter.format(new Date(`${query.from}T12:00:00`))} – ${dateFormatter.format(new Date(`${query.to}T12:00:00`))}`;
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
  const sortedDepartments = useMemo(
    () => [...departments].sort((left, right) => right.amount - left.amount),
    [departments],
  );

  const applyDashboard = useCallback((updatedDashboard: typeof loaderData.dashboard) => {
    setCollections(updatedDashboard.recentCollections);
    setPatientCollections(updatedDashboard.patientCollections);
    setDepartments(updatedDashboard.departments);
    setPatientMix(updatedDashboard.patientMix);
    setSummary(updatedDashboard.summary);
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
        const status = await getEmrSyncStatus({ data: { appointmentDate } });
        setEmrStatus(status);
        const message = error instanceof Error ? error.message : "Unable to synchronize the EMR.";
        setEmrMessage(
          status.connected
            ? message
            : isAdmin
              ? `${message} Select Connect EMR to sign in again.`
              : `${message} Sign in as an administrator to reconnect the EMR.`,
        );
      } finally {
        setEmrOperation("idle");
      }
    },
    [applyDashboard, isAdmin, query],
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
    const openCollectionOnEnter = (event: KeyboardEvent) => {
      if (
        event.key !== "Enter" ||
        event.repeat ||
        !ready ||
        addCollectionOpen ||
        patientWorkspaceOpen
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(
          "input, textarea, select, button, a, [role='dialog'], [contenteditable='true']",
        )
      )
        return;
      event.preventDefault();
      setPrefillEmrPatient(null);
      setAddCollectionOpen(true);
    };
    window.addEventListener("keydown", openCollectionOnEnter);
    return () => window.removeEventListener("keydown", openCollectionOnEnter);
  }, [addCollectionOpen, patientWorkspaceOpen, ready]);

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

  const collectionShare = (amount: number) =>
    summary.revenue === 0 ? 0 : Math.round((amount / summary.revenue) * 100);
  const headlineMetrics = [
    {
      accent: "emerald",
      amount: summary.cash,
      detail: `${collectionShare(summary.cash)}% of collected`,
      icon: Banknote,
      label: "Cash",
    },
    {
      accent: "blue",
      amount: summary.online,
      detail: `${collectionShare(summary.online)}% of collected`,
      icon: Smartphone,
      label: "Online",
    },
    {
      accent: "amber",
      amount: summary.credit,
      detail: `${collectionShare(summary.credit)}% of collected`,
      icon: CreditCard,
      label: "Credit",
    },
    {
      accent: "rose",
      amount: summary.discount,
      detail: "Recorded adjustments",
      icon: ReceiptText,
      label: "Discount",
    },
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

  const selectFromDate = (from: string) => {
    const to = from > draftTo ? from : draftTo;
    setDraftFrom(from);
    setDraftTo(to);
    void loadDashboard({
      ...query,
      collectionPage: 1,
      from,
      patientPage: 1,
      to,
    });
  };

  const selectToDate = (to: string) => {
    const from = to < draftFrom ? to : draftFrom;
    setDraftFrom(from);
    setDraftTo(to);
    void loadDashboard({
      ...query,
      collectionPage: 1,
      from,
      patientPage: 1,
      to,
    });
  };

  return (
    <AppShell user={loaderData.session.user}>
      <section className="animate-in">
        <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">{headingDate}</h1>
          </div>
          <div className="flex w-full flex-col gap-2 xl:w-auto xl:items-end">
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <section
                aria-label="EMR synchronization"
                className={cn(
                  "flex flex-wrap items-center gap-2 rounded-xl border px-2.5 py-2 text-xs",
                  emrStatus.connected
                    ? "border-emerald-500/20 bg-emerald-500/[0.06]"
                    : "border-amber-500/25 bg-amber-500/[0.08]",
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    emrStatus.connected ? "bg-emerald-500" : "bg-amber-500",
                  )}
                />
                <span className="font-bold">
                  {emrStatus.connected ? "EMR connected" : "EMR not connected"}
                </span>
                <span className="hidden text-[var(--muted)] 2xl:inline">
                  {emrStatus.connected
                    ? `${emrStatus.patientCount} patients · synced ${
                        emrStatus.lastSyncedAt
                          ? new Intl.DateTimeFormat("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(emrStatus.lastSyncedAt))
                          : "never"
                      }`
                    : "Connection required"}
                </span>
                {isAdmin && !emrStatus.connected ? (
                  <Button
                    disabled={!ready || emrOperation !== "idle"}
                    onClick={() => void connectToEmr()}
                    size="sm"
                    variant="outline"
                  >
                    <Link2 size={14} />
                    {emrOperation === "connecting" ? "Waiting for login…" : "Connect EMR"}
                  </Button>
                ) : !emrStatus.connected ? (
                  <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 font-bold text-amber-700 dark:text-amber-300">
                    Administrator connection required
                  </span>
                ) : null}
                <Button
                  disabled={!ready || !emrStatus.connected || emrOperation !== "idle"}
                  onClick={() => void synchronizeEmr(query.to)}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw
                    className={emrOperation === "syncing" ? "animate-spin" : undefined}
                    size={14}
                  />
                  {emrOperation === "syncing" ? "Syncing…" : "Sync EMR"}
                </Button>
                {emrStatus.connected ? (
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 font-semibold text-[var(--muted-strong)]">
                    <input
                      aria-label="Enable automatic EMR sync"
                      checked={autoSyncEnabled}
                      className="size-4 accent-emerald-500"
                      onChange={(event) => changeAutoSync(event.target.checked)}
                      type="checkbox"
                    />
                    Auto
                  </label>
                ) : null}
              </section>
              <Button
                className="ml-auto bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 hover:bg-cyan-400"
                disabled={!ready}
                onClick={() => setAddCollectionOpen(true)}
              >
                <Plus size={17} />
                Add collection
              </Button>
            </div>
            {emrMessage ? (
              <p className="max-w-2xl text-right text-xs font-medium">{emrMessage}</p>
            ) : null}
          </div>
        </div>

        {reconciliation && signoffs && query.from === query.to ? (
          <CollectionSignoffPanel
            businessDate={query.from}
            closure={closure}
            closureError={closureError}
            closureOperation={closureOperation}
            closureReason={closureReason}
            currentRole={isAdmin ? "admin" : "user"}
            disabled={closure?.status === "closed"}
            isAdmin={isAdmin}
            onChangeClosure={changeClosure}
            onClosureReasonChange={setClosureReason}
            onSignOff={saveSignoff}
            reconciliation={reconciliation}
            signoffs={signoffs}
            summary={summary}
          />
        ) : null}

        <div className="panel mb-5 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-3">
            <div>
              <p className="text-sm font-bold">Collection period</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Viewing {headingDate}</p>
            </div>
            <label>
              <span className="form-label">Table size</span>
              <select
                aria-label="Rows per page"
                className="form-control w-28"
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
            </label>
          </div>
          <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
            <label className="min-w-0">
              <span className="form-label">From</span>
              <input
                className="form-control w-full"
                max={initialDashboardQuery.to}
                min={isAdmin ? undefined : `${initialDashboardQuery.to.slice(0, 7)}-01`}
                onChange={(event) => selectFromDate(event.target.value)}
                type="date"
                value={draftFrom}
              />
            </label>
            <label className="min-w-0">
              <span className="form-label">To</span>
              <input
                className="form-control w-full"
                max={initialDashboardQuery.to}
                min={isAdmin ? undefined : `${initialDashboardQuery.to.slice(0, 7)}-01`}
                onChange={(event) => selectToDate(event.target.value)}
                type="date"
                value={draftTo}
              />
            </label>
            <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
              <Button
                aria-label="Previous day"
                disabled={loadingRange || (!isAdmin && query.from <= `${query.to.slice(0, 7)}-01`)}
                onClick={() => moveOneDay(-1)}
                size="sm"
                variant="outline"
              >
                <ChevronLeft size={16} />
                Previous
              </Button>
              <Button
                aria-label="Next day"
                disabled={loadingRange || query.to >= initialDashboardQuery.to}
                onClick={() => moveOneDay(1)}
                size="sm"
                variant="outline"
              >
                Next
                <ChevronRight size={16} />
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
                disabled={loadingRange || draftFrom > draftTo}
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
            </div>
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
                  {query.from === query.to ? "Today's collection pulse" : "Collection pulse"}
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
              <div className="mt-9 grid grid-cols-3 gap-4 border-t border-white/10 pt-5">
                <div>
                  <p className="text-xs text-slate-400">Patients</p>
                  <p className="mt-1 text-2xl font-black sm:text-3xl" data-testid="patient-count">
                    {summary.patients}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Payments</p>
                  <p className="mt-1 text-2xl font-black sm:text-3xl" data-testid="payment-count">
                    {summary.transactions}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Active departments</p>
                  <p
                    className="mt-1 text-2xl font-black sm:text-3xl"
                    data-testid="department-count"
                  >
                    {departments.filter((department) => department.amount > 0).length}
                  </p>
                </div>
              </div>
            </div>
          </article>

          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {headlineMetrics.map(({ accent, amount, detail, icon: Icon, label }) => (
              <article className="metric-card" key={label}>
                <div className={cn("metric-icon", `metric-icon-${accent}`)}>
                  <Icon size={19} />
                </div>
                <p className="mt-6 text-sm font-medium text-[var(--muted)]">{label}</p>
                <p className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
                  {formatCurrency(amount)}
                </p>
                <p className="mt-3 text-xs text-[var(--muted)]">{detail}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mb-5 grid gap-5 xl:grid-cols-[1.5fr_0.8fr]">
          <article className="panel p-5 sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="panel-title">Department performance</h2>
                <p className="panel-subtitle">Collection split across all departments</p>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link to="/reports">
                  View report
                  <ArrowRight size={15} />
                </Link>
              </Button>
            </div>
            <div className="space-y-5">
              {sortedDepartments.map((department) => {
                const share =
                  summary.revenue === 0
                    ? 0
                    : Math.round((department.amount / summary.revenue) * 100);
                const width = `${Math.min(100, Math.max(department.amount > 0 ? 4 : 0, share))}%`;
                return (
                  <div
                    data-department-amount={department.amount}
                    data-testid="department-performance-row"
                    key={department.name}
                  >
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <span className={cn("department-dot", `department-${department.color}`)} />
                        <span className="text-sm font-semibold">{department.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold">
                          {formatCurrency(department.amount)}
                        </span>
                        <span className="min-w-14 text-right text-xs font-medium text-[var(--muted)]">
                          {share}% share
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
          <PatientMixCard patientMix={patientMix} />
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

const patientMixColors: Record<
  DashboardData["patientMix"]["segments"][number]["label"],
  { dot: string; value: string }
> = {
  New: { dot: "bg-emerald-500", value: "rgb(16 185 129)" },
  Other: { dot: "bg-slate-400", value: "rgb(148 163 184)" },
  "Post-op": { dot: "bg-violet-500", value: "rgb(139 92 246)" },
  Revisit: { dot: "bg-blue-500", value: "rgb(59 130 246)" },
};

function PatientMixCard({ patientMix }: { patientMix: DashboardData["patientMix"] }) {
  let accumulated = 0;
  const stops = patientMix.segments.map((segment) => {
    const start = patientMix.total === 0 ? 0 : (accumulated / patientMix.total) * 360;
    accumulated += segment.count;
    const end = patientMix.total === 0 ? 0 : (accumulated / patientMix.total) * 360;
    return `${patientMixColors[segment.label].value} ${start}deg ${end}deg`;
  });
  const background =
    patientMix.total === 0 ? "var(--track)" : `conic-gradient(${stops.join(", ")})`;

  return (
    <article className="panel p-5 sm:p-6">
      <div>
        <h2 className="panel-title">Patient mix</h2>
        <p className="panel-subtitle">EMR visit types for the selected period</p>
      </div>
      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row xl:flex-col 2xl:flex-row">
        <div
          aria-label={patientMix.segments
            .map((segment) => `${segment.label} ${segment.count}`)
            .join(", ")}
          className="grid size-40 shrink-0 place-items-center rounded-full"
          role="img"
          style={{ background }}
        >
          <div className="grid size-28 place-items-center rounded-full bg-[var(--panel)] text-center shadow-inner">
            <div>
              <p className="text-3xl font-black">{patientMix.total}</p>
              <p className="text-[11px] font-semibold text-[var(--muted)]">appointments</p>
            </div>
          </div>
        </div>
        <div className="w-full space-y-3">
          {patientMix.segments.map((segment) => {
            const percentage =
              patientMix.total === 0 ? 0 : Math.round((segment.count / patientMix.total) * 100);
            return (
              <div className="flex items-center justify-between gap-4" key={segment.label}>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span
                    className={cn("size-2.5 rounded-full", patientMixColors[segment.label].dot)}
                  />
                  {segment.label}
                </span>
                <span className="text-right">
                  <b className="text-sm tabular-nums">{segment.count}</b>
                  <span className="ml-2 text-xs text-[var(--muted)]">{percentage}%</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}

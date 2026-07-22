import { Button, cn } from "@eyeflow/ui";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Search, UserRound, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "../components/app-shell";
import { formatCurrency } from "../features/dashboard/dashboard-data";
import { getPatientDirectory } from "../features/operations/operations.functions";

export const Route = createFileRoute("/patients")({
  component: Patients,
  loader: () => getPatientDirectory(),
});

function Patients() {
  const { patients, session } = Route.useLoaderData();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string>();
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter(
      (patient) =>
        patient.name.toLowerCase().includes(query) ||
        patient.externalPatientId?.toLowerCase().includes(query),
    );
  }, [patients, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visiblePatients = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <AppShell user={session.user}>
      <section className="animate-in space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              Patient directory
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em]">All patients</h1>
            <p className="mt-2 text-sm text-[var(--muted-strong)]">
              An exhaustive EMR and EyeFlow view with expandable collection history.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
            <p className="text-2xl font-bold">{patients.length}</p>
            <p className="text-xs text-[var(--muted)]">Synchronized patients</p>
          </div>
        </header>

        <article className="panel overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Users size={17} /> Patient-wise expanded view
            </div>
            <label className="relative w-full sm:w-80">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                size={16}
              />
              <input
                aria-label="Search all patients"
                className="form-control pl-9"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Name or patient ID"
                value={search}
              />
            </label>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {visiblePatients.map((patient) => {
              const isExpanded = expanded === patient.id;
              return (
                <div key={patient.id}>
                  <button
                    aria-expanded={isExpanded}
                    className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-[var(--hover)] sm:grid-cols-[1.5fr_0.7fr_0.7fr_0.7fr_auto] sm:items-center"
                    onClick={() => setExpanded(isExpanded ? undefined : patient.id)}
                    type="button"
                  >
                    <span className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                        <UserRound size={18} />
                      </span>
                      <span>
                        <span className="block text-sm font-bold">{patient.name}</span>
                        <span className="block text-xs text-[var(--muted)]">
                          {patient.externalPatientId ?? "EyeFlow patient"} · {patient.source}
                        </span>
                      </span>
                    </span>
                    <span className="text-sm">
                      <b>{patient.visits}</b> visits
                    </span>
                    <span className="text-sm">
                      <b>{patient.collections.length}</b> payments
                    </span>
                    <span className="text-sm font-bold tabular-nums">
                      {formatCurrency(patient.totalCollected)}
                    </span>
                    <ChevronDown
                      className={cn("transition", isExpanded && "rotate-180")}
                      size={17}
                    />
                  </button>
                  {isExpanded ? (
                    <div className="bg-[var(--subtle-panel)] px-5 py-4">
                      {patient.collections.length ? (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[560px] text-left text-sm">
                            <thead className="text-xs text-[var(--muted)]">
                              <tr>
                                <th className="pb-2">Date</th>
                                <th className="pb-2">Department</th>
                                <th className="pb-2">Mode</th>
                                <th className="pb-2 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                              {patient.collections
                                .slice()
                                .sort((left, right) =>
                                  right.occurredAt.localeCompare(left.occurredAt),
                                )
                                .map((collection) => (
                                  <tr key={collection.id}>
                                    <td className="py-2">
                                      {new Intl.DateTimeFormat("en-IN", {
                                        dateStyle: "medium",
                                      }).format(new Date(collection.occurredAt))}
                                    </td>
                                    <td className="py-2">{collection.department}</td>
                                    <td className="py-2">{collection.mode}</td>
                                    <td className="py-2 text-right font-semibold">
                                      {formatCurrency(collection.amount)}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--muted)]">No collection history yet.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-[var(--muted)]">
                No patients match this search.
              </div>
            ) : null}
          </div>
          {filtered.length > 0 ? (
            <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-4">
              <p className="text-xs text-[var(--muted)]">
                Page {page} of {pageCount} · {filtered.length} patients
              </p>
              <div className="flex gap-2">
                <Button
                  disabled={page === 1}
                  onClick={() => setPage((value) => value - 1)}
                  size="sm"
                  variant="outline"
                >
                  Previous
                </Button>
                <Button
                  disabled={page === pageCount}
                  onClick={() => setPage((value) => value + 1)}
                  size="sm"
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </article>
      </section>
    </AppShell>
  );
}

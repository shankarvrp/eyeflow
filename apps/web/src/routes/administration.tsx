import { Button, cn } from "@eyeflow/ui";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Gauge, Save, ShieldCheck, UserRoundCog, Users } from "lucide-react";
import { useState } from "react";
import { AppShell } from "../components/app-shell";
import {
  getAdministrationData,
  saveRevenueTargets,
  saveUserAccess,
} from "../features/administration/administration.functions";
import type { AdministrationUser } from "../features/administration/administration.server";

export const Route = createFileRoute("/administration")({
  component: Administration,
  loader: () => getAdministrationData(),
});

function Administration() {
  const loaderData = Route.useLoaderData();
  const [users, setUsers] = useState(loaderData.users);
  const [selectedId, setSelectedId] = useState(loaderData.users[0]?.id ?? "");
  const [draft, setDraft] = useState<AdministrationUser | undefined>(loaderData.users[0]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [targets, setTargets] = useState(loaderData.targets);
  const [targetReason, setTargetReason] = useState("");
  const [targetMessage, setTargetMessage] = useState<string>();
  const [savingTargets, setSavingTargets] = useState(false);

  const selectUser = (id: string) => {
    const selected = users.find((entry) => entry.id === id);
    setSelectedId(id);
    setDraft(
      selected
        ? { ...selected, access: selected.access.map((entry) => ({ ...entry })) }
        : undefined,
    );
    setReason("");
    setMessage(undefined);
  };

  const save = async () => {
    if (!draft) return;
    try {
      setSaving(true);
      setMessage(undefined);
      const updated = await saveUserAccess({
        data: {
          access: draft.access,
          reason,
          role: draft.role,
          userId: draft.id,
        },
      });
      setUsers(updated);
      const selected = updated.find((entry) => entry.id === draft.id);
      setDraft(selected);
      setReason("");
      setMessage("Role and department permissions saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save permissions.");
    } finally {
      setSaving(false);
    }
  };

  const saveTargets = async () => {
    try {
      setSavingTargets(true);
      setTargetMessage(undefined);
      const updated = await saveRevenueTargets({ data: { ...targets, reason: targetReason } });
      setTargets(updated);
      setTargetReason("");
      setTargetMessage("Revenue targets saved and applied to the dashboard.");
    } catch (error) {
      setTargetMessage(error instanceof Error ? error.message : "Unable to save revenue targets.");
    } finally {
      setSavingTargets(false);
    }
  };

  return (
    <AppShell user={loaderData.session.user}>
      <section>
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck size={14} />
              Administrator workspace
            </div>
            <h1 className="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">Access control</h1>
            <p className="mt-2 text-[var(--muted-strong)]">
              Manage the two supported roles and department-level collection permissions.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-right">
            <p className="text-2xl font-bold">{users.length}</p>
            <p className="text-xs text-[var(--muted)]">Active users</p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <article className="panel overflow-hidden">
            <div className="border-b border-[var(--border)] p-5">
              <h2 className="panel-title flex items-center gap-2">
                <Users size={18} /> Users
              </h2>
              <p className="panel-subtitle">Select a staff account to manage</p>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {users.map((entry) => (
                <button
                  className={cn(
                    "flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-[var(--hover)]",
                    selectedId === entry.id && "bg-emerald-500/[0.08]",
                  )}
                  key={entry.id}
                  onClick={() => selectUser(entry.id)}
                  type="button"
                >
                  <div className="grid size-10 place-items-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                    {initials(entry.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{entry.name}</p>
                    <p className="truncate text-xs text-[var(--muted)]">{entry.email}</p>
                  </div>
                  <span className="ml-auto rounded-full bg-[var(--track)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide">
                    {entry.role}
                  </span>
                </button>
              ))}
            </div>
          </article>

          <article className="panel p-5 sm:p-6">
            {draft ? (
              <>
                <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="panel-title flex items-center gap-2">
                      <UserRoundCog size={18} /> {draft.name}
                    </h2>
                    <p className="panel-subtitle">{draft.email}</p>
                  </div>
                  <label>
                    <span className="form-label">Role</span>
                    <select
                      className="form-control w-40"
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          role: event.target.value === "admin" ? "admin" : "user",
                        })
                      }
                      value={draft.role}
                    >
                      <option value="user">User</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </label>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left">
                    <thead className="text-xs text-[var(--muted)]">
                      <tr>
                        <th className="pb-3 font-semibold">Department</th>
                        <th className="pb-3 text-center font-semibold">View</th>
                        <th className="pb-3 text-center font-semibold">Add</th>
                        <th className="pb-3 text-center font-semibold">Edit today</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {draft.access.map((access, index) => (
                        <tr key={access.department}>
                          <td className="py-4 text-sm font-semibold">{access.department}</td>
                          {(["canView", "canCreate", "canEditCurrent"] as const).map(
                            (permission) => (
                              <td className="py-4 text-center" key={permission}>
                                <input
                                  aria-label={`${draft.name} ${access.department} ${permission}`}
                                  checked={draft.role === "admin" || access[permission]}
                                  className="size-4 accent-emerald-500"
                                  disabled={draft.role === "admin"}
                                  onChange={(event) => {
                                    const updated = draft.access.map((entry, entryIndex) =>
                                      entryIndex === index
                                        ? { ...entry, [permission]: event.target.checked }
                                        : entry,
                                    );
                                    setDraft({ ...draft, access: updated });
                                  }}
                                  type="checkbox"
                                />
                              </td>
                            ),
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-end sm:justify-between">
                  <label className="w-full sm:max-w-lg">
                    <span className="form-label">Audit reason</span>
                    <input
                      className="form-control w-full"
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="New staff assignment or access review"
                      value={reason}
                    />
                  </label>
                  <Button disabled={saving || reason.trim().length < 3} onClick={() => void save()}>
                    {saving ? (
                      <span className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <Save size={16} />
                    )}
                    {saving ? "Saving…" : "Save access"}
                  </Button>
                </div>
                {message ? (
                  <p className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <Check size={14} /> {message}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-[var(--muted)]">No user selected.</p>
            )}
          </article>
        </div>

        <article className="panel mt-5 p-5 sm:p-6">
          <div className="flex flex-col gap-2 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="panel-title flex items-center gap-2">
                <Gauge size={18} /> Revenue targets
              </h2>
              <p className="panel-subtitle">
                Daily is visible to all staff. Weekly and monthly remain administrator-only.
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              Clinic-wide
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {(
              [
                ["daily", "Daily target"],
                ["weekly", "Weekly target"],
                ["monthly", "Monthly target"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                <span className="form-label">{label}</span>
                <span className="relative block">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--muted)]">
                    ₹
                  </span>
                  <input
                    aria-label={label}
                    className="form-control pl-8"
                    min="1"
                    onChange={(event) =>
                      setTargets({ ...targets, [key]: Number(event.target.value || 0) })
                    }
                    step="1000"
                    type="number"
                    value={targets[key]}
                  />
                </span>
              </label>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-end sm:justify-between">
            <label className="w-full sm:max-w-lg">
              <span className="form-label">Audit reason</span>
              <input
                className="form-control w-full"
                onChange={(event) => setTargetReason(event.target.value)}
                placeholder="Monthly planning review"
                value={targetReason}
              />
            </label>
            <Button
              disabled={savingTargets || targetReason.trim().length < 3}
              onClick={() => void saveTargets()}
            >
              <Save size={16} />
              {savingTargets ? "Saving…" : "Save targets"}
            </Button>
          </div>
          {targetMessage ? (
            <p className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <Check size={14} /> {targetMessage}
            </p>
          ) : null}
        </article>
      </section>
    </AppShell>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

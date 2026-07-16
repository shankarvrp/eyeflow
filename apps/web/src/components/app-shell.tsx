import { Button, cn } from "@eyeflow/ui";
import {
  Activity,
  BarChart3,
  Bell,
  CircleHelp,
  Command,
  LayoutDashboard,
  Menu,
  ReceiptIndianRupee,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { authClient } from "../lib/auth-client";
import { ThemeToggle } from "./theme-toggle";

const navigation = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Revenue", icon: ReceiptIndianRupee, active: false },
  { label: "Patients", icon: Users, active: false },
  { label: "Reports", icon: BarChart3, active: false },
];

interface AppShellProps {
  children: ReactNode;
  user: {
    email: string;
    name: string;
    role?: string | null | undefined;
  };
}

export function AppShell({ children, user }: AppShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const roleLabel = user.role?.split(",")[0] ?? "viewer";

  const signOut = async () => {
    await authClient.signOut();
    window.location.assign("/login");
  };

  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--foreground)]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] p-5 transition-transform lg:translate-x-0",
          mobileNavigationOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-8 flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
              <Sparkles aria-hidden="true" size={20} strokeWidth={2.3} />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">EyeFlow</div>
              <div className="text-xs text-[var(--muted)]">Clinic operations</div>
            </div>
          </div>
          <Button
            className="lg:hidden"
            onClick={() => setMobileNavigationOpen(false)}
            size="icon"
            variant="ghost"
          >
            <X aria-label="Close navigation" size={18} />
          </Button>
        </div>

        <nav aria-label="Primary navigation" className="space-y-1">
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
            Workspace
          </p>
          {navigation.map(({ active, icon: Icon, label }) => (
            <button
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                  : "text-[var(--muted-strong)] hover:bg-[var(--hover)] hover:text-[var(--foreground)]",
              )}
              key={label}
              type="button"
            >
              <Icon aria-hidden="true" size={18} />
              {label}
              {active ? <span className="ml-auto size-1.5 rounded-full bg-emerald-500" /> : null}
            </button>
          ))}
        </nav>

        <div className="mt-8 space-y-1">
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
            Manage
          </p>
          <button className="sidebar-link" type="button">
            <ShieldCheck size={18} />
            Administration
          </button>
          <button className="sidebar-link" type="button">
            <Settings size={18} />
            Settings
          </button>
        </div>

        <div className="mt-auto rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Activity className="text-emerald-500" size={17} />
            System healthy
          </div>
          <p className="text-xs leading-5 text-[var(--muted-strong)]">
            Live collections are connected. Last sync just now.
          </p>
        </div>
      </aside>

      {mobileNavigationOpen ? (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNavigationOpen(false)}
          type="button"
        />
      ) : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-20 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-translucent)] px-4 backdrop-blur-xl sm:px-8">
          <Button
            className="lg:hidden"
            onClick={() => setMobileNavigationOpen(true)}
            size="icon"
            variant="ghost"
          >
            <Menu aria-label="Open navigation" size={20} />
          </Button>
          <button
            className="hidden min-w-80 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3.5 py-2.5 text-sm text-[var(--muted)] shadow-sm transition hover:border-emerald-500/35 md:flex"
            type="button"
          >
            <Search size={17} />
            Search patients, payments, reports…
            <span className="ml-auto flex items-center gap-1 rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[10px]">
              <Command size={10} />K
            </span>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <Button aria-label="Help" size="icon" variant="ghost">
              <CircleHelp size={18} />
            </Button>
            <Button aria-label="Notifications" className="relative" size="icon" variant="ghost">
              <Bell size={18} />
              <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-rose-500 ring-2 ring-[var(--surface)]" />
            </Button>
            <ThemeToggle />
            <button
              className="ml-2 hidden items-center gap-3 border-l border-[var(--border)] pl-4 text-left sm:flex"
              onClick={() => void signOut()}
              title={`Signed in as ${user.email}. Click to sign out.`}
              type="button"
            >
              <div className="grid size-9 place-items-center rounded-xl bg-slate-900 text-sm font-semibold text-white">
                {initials}
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold">{user.name}</p>
                <p className="text-xs capitalize text-[var(--muted)]">{roleLabel}</p>
              </div>
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}

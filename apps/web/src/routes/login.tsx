import { Button } from "@eyeflow/ui";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff, LockKeyhole, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  const signIn = async () => {
    setSubmitting(true);
    setError(undefined);

    const result = await authClient.signIn.email({
      email,
      password,
    });

    if (result.error) {
      setError(result.error.message ?? "Unable to sign in with those credentials.");
      setSubmitting(false);
      return;
    }

    window.location.assign("/");
  };

  return (
    <main className="grid min-h-screen bg-[var(--surface)] lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -left-24 top-1/3 size-80 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -right-20 top-8 size-72 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/25">
            <Sparkles size={21} />
          </div>
          <div>
            <p className="text-xl font-bold">EyeFlow</p>
            <p className="text-xs text-slate-400">Modern eye care operations</p>
          </div>
        </div>
        <div className="relative my-auto max-w-xl">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Revenue clarity, every day
          </p>
          <h1 className="text-5xl font-bold leading-[1.08] tracking-[-0.045em]">
            One calm workspace for every clinic collection.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
            Secure, department-aware access keeps your team focused while administrators retain
            complete oversight.
          </p>
        </div>
        <p className="relative text-sm text-slate-500">Private by design · Auditable by default</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-9 lg:hidden">
            <div className="mb-4 grid size-11 place-items-center rounded-2xl bg-emerald-500 text-white">
              <Sparkles size={21} />
            </div>
            <p className="text-xl font-bold">EyeFlow</p>
          </div>
          <div className="mb-8">
            <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
              <LockKeyhole size={22} />
            </div>
            <h2 className="text-3xl font-bold tracking-[-0.035em]">Welcome back</h2>
            <p className="mt-2 text-[var(--muted-strong)]">
              Sign in to open your EyeFlow workspace.
            </p>
          </div>

          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void signIn();
            }}
          >
            <div>
              <label className="form-label" htmlFor="email">
                Email address
              </label>
              <input
                autoComplete="username"
                className="form-control"
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <span className="relative block">
                <input
                  autoComplete="current-password"
                  className="form-control pr-12"
                  id="password"
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center text-[var(--muted)]"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </div>

            {error ? (
              <p
                className="rounded-xl border border-rose-500/20 bg-rose-500/[0.07] px-4 py-3 text-sm text-rose-600 dark:text-rose-300"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <Button className="h-12 w-full" disabled={!ready || submitting} type="submit">
              {submitting ? "Signing in…" : "Sign in securely"}
            </Button>
          </form>
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 text-xs leading-5 text-[var(--muted-strong)]">
            Development administrator: <strong>admin@eyeflow.local</strong>. Change the seeded
            password before using EyeFlow with real clinic data.
          </div>
        </div>
      </section>
    </main>
  );
}

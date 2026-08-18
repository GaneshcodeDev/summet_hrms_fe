"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { AlertTriangle, Eye, EyeOff, Info, Lock, ShieldCheck, Users2 } from "lucide-react";
import { login } from "@/lib/auth";
import { DEMO_PASSWORD } from "@/lib/rbac-data";
import { accountsStore, rolesStore } from "@/lib/rbac-store";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

function formatCountdown(lockedUntil: string) {
  const ms = new Date(lockedUntil).getTime() - Date.now();
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect") || "/dashboard";
  const expiredReason = searchParams.get("reason") === "expired";

  const accounts = useSyncExternalStore(accountsStore.subscribe, accountsStore.getSnapshot, accountsStore.getServerSnapshot);
  const roles = useSyncExternalStore(rolesStore.subscribe, rolesStore.getSnapshot, rolesStore.getServerSnapshot);

  const [email, setEmail] = useState("ganesh.pandey@company.com");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);

  const demoAccounts = useMemo(
    () =>
      accounts
        .map((a) => ({ account: a, roleName: roles.find((r) => a.roleIds.includes(r.id))?.name ?? "No Role" }))
        .sort((a, b) => a.account.name.localeCompare(b.account.name)),
    [accounts, roles],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLockedUntil(null);
    setLoading(true);

    const result = await login(email, password, remember);
    if (!result.ok) {
      setLoading(false);
      if (result.error === "locked") {
        setLockedUntil(result.lockedUntil ?? null);
      } else if (result.error === "inactive") {
        setError("This account has been deactivated. Contact your administrator.");
      } else {
        setError("Incorrect email or password. Please try again.");
      }
      return;
    }

    setTimeout(() => {
      router.replace(redirectTarget);
    }, 250);
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-white lg:grid-cols-2 dark:bg-slate-950">
      <div className="relative flex flex-col justify-center px-8 py-12 sm:px-16 lg:px-24">
        <div className="absolute right-6 top-6">
          <ThemeToggle />
        </div>
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
              <Users2 className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">HRMS</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome Back!</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Sign in to continue your account
          </p>

          {expiredReason && !error && !lockedUntil && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Your session expired. Please sign in again.
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {lockedUntil && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              Too many failed attempts. This account is locked for about {formatCountdown(lockedUntil)}.
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@company.com"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <a href="/forgot-password" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                  Forgot Password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
              />
              Remember me for 30 days
            </label>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-xs text-slate-400 dark:text-slate-500">demo access</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>

          <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-700">
            <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Every seeded account shares the password <code className="rounded bg-slate-100 px-1 py-0.5 font-mono dark:bg-slate-800">{DEMO_PASSWORD}</code>.
                Pick a persona to test how access changes by role.
              </span>
            </div>
            <select
              className="mt-2.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              defaultValue=""
              onChange={(e) => {
                const account = demoAccounts.find((d) => d.account.id === e.target.value)?.account;
                if (account) {
                  setEmail(account.email);
                  setPassword(DEMO_PASSWORD);
                  setError(null);
                  setLockedUntil(null);
                }
              }}
            >
              <option value="" disabled>
                Sign in as…
              </option>
              {demoAccounts.map(({ account, roleName }) => (
                <option key={account.id} value={account.id}>
                  {account.name} — {roleName} {account.status === "Inactive" ? "(inactive)" : ""}
                </option>
              ))}
            </select>
          </div>

          <p className="mt-10 text-center text-xs text-slate-400 dark:text-slate-500">
            © 2024 HRMS. All rights reserved.
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 lg:flex lg:items-center lg:justify-center">
        <div className="absolute -left-16 -top-16 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 -right-10 h-96 w-96 rounded-full bg-white/10" />
        <div className="absolute right-16 top-24 h-24 w-24 rounded-full bg-white/10" />

        <div className="relative z-10 flex flex-col items-center gap-8 px-12 text-center">
          <div className="flex h-44 w-44 items-center justify-center rounded-full bg-white/10 backdrop-blur">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/15">
              <Users2 className="h-14 w-14 text-white" strokeWidth={1.5} />
            </div>
          </div>
          <div className="absolute -right-4 top-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg">
            <ShieldCheck className="h-7 w-7 text-indigo-600" />
          </div>
          <div className="absolute -left-8 bottom-24 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg">
            <Lock className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">
              Manage Your Workforce
            </h2>
            <p className="mt-3 max-w-xs text-sm text-indigo-100">
              All-in-one platform to manage employees, attendance, payroll and
              performance — effortlessly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

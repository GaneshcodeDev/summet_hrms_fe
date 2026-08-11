"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Eye, EyeOff, ShieldAlert, Users2 } from "lucide-react";
import { resetPassword, verifyResetToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "One letter", test: (v) => /[a-zA-Z]/.test(v) },
  { label: "One number", test: (v) => /[0-9]/.test(v) },
  { label: "One special character", test: (v) => /[^a-zA-Z0-9]/.test(v) },
];

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  // Resolved after mount (not during render) — verifyResetToken reads localStorage,
  // which isn't available during server rendering and would otherwise cause a
  // hydration mismatch between the server-rendered and client-rendered branch.
  const [tokenCheck, setTokenCheck] = useState<{ valid: boolean; email?: string } | null>(null);
  useEffect(() => {
    // One-time read of the (client-only) reset-token store on mount/token change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTokenCheck(verifyResetToken(token));
  }, [token]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const rulesPassed = RULES.every((r) => r.test(password));
  const matches = password.length > 0 && password === confirm;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!rulesPassed) {
      setError("Password doesn't meet the requirements below.");
      return;
    }
    if (!matches) {
      setError("Passwords don't match.");
      return;
    }
    const result = resetPassword(token, password);
    if (!result.ok) {
      setError("This reset link is invalid or has expired.");
      return;
    }
    setDone(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 py-12 dark:bg-slate-950">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
            <Users2 className="h-5 w-5 text-white" strokeWidth={2.25} />
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-white">HRMS</span>
        </div>

        {tokenCheck === null ? (
          <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Verifying link…</div>
        ) : !tokenCheck.valid ? (
          <>
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-500/10">
              <ShieldAlert className="h-6 w-6 text-rose-600 dark:text-rose-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Link expired</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              This password reset link is invalid or has expired. Request a new one to continue.
            </p>
            <Link href="/forgot-password">
              <Button className="mt-6">Request New Link</Button>
            </Link>
          </>
        ) : done ? (
          <>
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Password updated</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Your password has been reset. You can now sign in with your new password.
            </p>
            <Button className="mt-6" onClick={() => router.replace("/login")}>
              Back to Sign In
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Set a new password</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Resetting password for <span className="font-medium text-slate-700 dark:text-slate-200">{tokenCheck.email}</span>
            </p>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 pr-10 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-indigo-500/20"
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

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-indigo-500/20"
                />
              </div>

              <ul className="space-y-1">
                {RULES.map((rule) => {
                  const passed = rule.test(password);
                  return (
                    <li
                      key={rule.label}
                      className={cn(
                        "flex items-center gap-1.5 text-xs",
                        passed ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500",
                      )}
                    >
                      <Check className="h-3.5 w-3.5" /> {rule.label}
                    </li>
                  );
                })}
              </ul>

              <Button type="submit" className="w-full">
                Reset Password
              </Button>
            </form>
          </>
        )}

        <Link
          href="/login"
          className="mt-8 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Info, KeyRound, Users2 } from "lucide-react";
import { requestPasswordReset } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const { token } = requestPasswordReset(email);
    setDevResetLink(token ? `/reset-password?token=${token}` : null);
    setSubmitted(true);
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

        {!submitted ? (
          <>
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
              <KeyRound className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Forgot password?</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Enter the email associated with your account and we&apos;ll send you a link to reset your password.
            </p>

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
              <Button type="submit" className="w-full">
                Send Reset Link
              </Button>
            </form>
          </>
        ) : (
          <>
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Check your email</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              If an account exists for <span className="font-medium text-slate-700 dark:text-slate-200">{email}</span>, a
              password reset link has been sent and will expire in 30 minutes.
            </p>

            {devResetLink && (
              <div className="mt-5 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/60 p-3.5 text-xs text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                <div className="mb-1 flex items-center gap-1.5 font-medium">
                  <Info className="h-3.5 w-3.5" /> Development note
                </div>
                This demo has no email server, so here&apos;s the link that would normally be emailed:
                <Link href={devResetLink} className="mt-1.5 block truncate font-mono underline">
                  {devResetLink}
                </Link>
              </div>
            )}
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

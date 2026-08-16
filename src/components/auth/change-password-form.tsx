"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, Check, Lock } from "lucide-react";
import { Field, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { changePassword } from "@/lib/auth";

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (next.length < 8 || !/[a-zA-Z]/.test(next) || !/[0-9]/.test(next) || !/[^a-zA-Z0-9]/.test(next)) {
      setMessage({ tone: "error", text: "New password must be 8+ characters with a letter, number and symbol." });
      return;
    }
    if (next !== confirm) {
      setMessage({ tone: "error", text: "New password and confirmation don't match." });
      return;
    }
    const result = changePassword(current, next);
    if (!result.ok) {
      setMessage({
        tone: "error",
        text:
          result.error === "invalid_current_password"
            ? "Current password is incorrect."
            : result.error === "same_as_current"
              ? "New password must be different from your current password."
              : "Unable to change password right now.",
      });
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setMessage({ tone: "success", text: "Password changed successfully." });
  }

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <Lock className="h-4 w-4" /> Change Password
      </h3>
      {message && (
        <div
          className={`mb-3 flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm ${
            message.tone === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
          }`}
        >
          {message.tone === "success" ? <Check className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {message.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Current Password">
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </Field>
        <Field label="New Password">
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </Field>
        <Field label="Confirm New Password">
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        <div className="sm:col-span-3">
          <Button type="submit" size="sm">
            Update Password
          </Button>
        </div>
      </form>
    </div>
  );
}

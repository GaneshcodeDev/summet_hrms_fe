"use client";

import { FormEvent, useState } from "react";
import { Check, Info, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { useSettings } from "@/lib/settings-context";
import { useAccessControl } from "@/lib/access-control-context";
import { notificationCatalog } from "@/lib/settings-data";
import type { SmtpEncryption } from "@/lib/types";

export function EmailSection() {
  const { settings, updateEmail, toggleNotification, sendTestEmail } = useSettings();
  const { canFeature } = useAccessControl();
  const canEdit = canFeature("settings.organization", "edit");

  const [form, setForm] = useState(settings.email);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    updateEmail(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleSendTest() {
    updateEmail(form);
    setTestResult(sendTestEmail());
  }

  return (
    <div>
      <form onSubmit={handleSave} className="space-y-5 p-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Email Settings (SMTP)</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="SMTP Host">
            <Input value={form.smtpHost} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))} placeholder="smtp.example.com" />
          </Field>
          <Field label="SMTP Port">
            <Input value={form.smtpPort} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, smtpPort: e.target.value }))} placeholder="587" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="SMTP Username">
            <Input value={form.smtpUsername} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, smtpUsername: e.target.value }))} />
          </Field>
          <Field label="SMTP Password">
            <Input type="password" value={form.smtpPassword} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, smtpPassword: e.target.value }))} placeholder="••••••••" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="From Name">
            <Input value={form.fromName} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))} />
          </Field>
          <Field label="From Email">
            <Input type="email" value={form.fromEmail} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))} />
          </Field>
        </div>

        <Field label="Encryption">
          <Select
            value={form.encryption}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, encryption: e.target.value as SmtpEncryption }))}
            className="w-auto min-w-[160px]"
          >
            <option value="TLS">TLS</option>
            <option value="SSL">SSL</option>
            <option value="None">None</option>
          </Select>
        </Field>

        {testResult && (
          <div
            className={`flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-sm ${
              testResult.ok
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
            }`}
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" /> {testResult.message}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
          {canEdit && (
            <Button type="button" variant="outline" onClick={handleSendTest}>
              <Send className="h-4 w-4" /> Send Test Email
            </Button>
          )}
          {canEdit ? (
            <div className="flex items-center gap-3">
              {saved && (
                <span className="flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="h-4 w-4" /> Saved
                </span>
              )}
              <Button type="submit">Save Changes</Button>
            </div>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500">You have view-only access to Email Settings.</p>
          )}
        </div>
      </form>

      <div className="border-t border-slate-100 p-6 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notification Emails</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Choose which automated emails the system sends.</p>
        <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {notificationCatalog.map((n) => (
            <label key={n.key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{n.label}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{n.description}</p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(settings.email.notifications[n.key])}
                disabled={!canEdit}
                onChange={() => toggleNotification(n.key)}
                className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

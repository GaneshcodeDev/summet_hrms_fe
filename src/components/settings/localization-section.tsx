"use client";

import { FormEvent, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";
import { useSettings } from "@/lib/settings-context";
import { useAccessControl } from "@/lib/access-control-context";
import { languageOptions, numberFormatOptions, timezoneOptions, weekStartOptions } from "@/lib/settings-data";

export function LocalizationSection() {
  const { settings, updateLocalization } = useSettings();
  const { canFeature } = useAccessControl();
  const canEdit = canFeature("settings.organization", "edit");

  const [form, setForm] = useState(settings.localization);
  const [saved, setSaved] = useState(false);

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    updateLocalization(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSave} className="space-y-5 p-6">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">Localization</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Timezone">
          <Select value={form.timezone} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}>
            {timezoneOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
        <Field label="Language">
          <Select value={form.language} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}>
            {languageOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date Format">
          <Select value={form.dateFormat} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, dateFormat: e.target.value }))}>
            <option>DD MMM YYYY</option>
            <option>MM/DD/YYYY</option>
            <option>DD/MM/YYYY</option>
          </Select>
        </Field>
        <Field label="Time Format">
          <Select value={form.timeFormat} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, timeFormat: e.target.value }))}>
            <option>12 Hour</option>
            <option>24 Hour</option>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Number Format">
          <Select value={form.numberFormat} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, numberFormat: e.target.value }))}>
            {numberFormatOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
        <Field label="Week Starts On">
          <Select value={form.weekStart} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, weekStart: e.target.value }))}>
            {weekStartOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Currency">
        <Select value={form.currency} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
          <option>INR (₹) - Indian Rupee</option>
          <option>USD ($) - US Dollar</option>
          <option>EUR (€) - Euro</option>
          <option>GBP (£) - British Pound</option>
        </Select>
      </Field>

      {canEdit ? (
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
          {saved && (
            <span className="flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" /> Saved
            </span>
          )}
          <Button type="submit">Save Changes</Button>
        </div>
      ) : (
        <p className="border-t border-slate-100 pt-5 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
          You have view-only access to Localization settings.
        </p>
      )}
    </form>
  );
}

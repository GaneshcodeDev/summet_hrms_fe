"use client";

import { FormEvent, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useSettings } from "@/lib/settings-context";
import { useAccessControl } from "@/lib/access-control-context";
import { companySizeOptions, fiscalYearMonths, industryOptions } from "@/lib/settings-data";

export function OrganizationSection() {
  const { settings, updateOrganization } = useSettings();
  const { canFeature } = useAccessControl();
  const canEdit = canFeature("settings.organization", "edit");

  const [form, setForm] = useState(settings.organization);
  const [saved, setSaved] = useState(false);

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    updateOrganization(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSave} className="space-y-5 p-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Organization Profile</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Legal and registration details for this company. Looking for departments, business units or the reporting
          structure instead? That lives in the{" "}
          <a href="/organization" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Organization module
          </a>
          .
        </p>
      </div>

      <Field label="Legal Name">
        <Input value={form.legalName} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))} required />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Registration / CIN Number">
          <Input value={form.registrationNumber} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))} />
        </Field>
        <Field label="Tax ID (PAN / GSTIN)">
          <Input value={form.taxId} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Industry">
          <Select value={form.industry} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}>
            {industryOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
        <Field label="Company Size">
          <Select value={form.companySize} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, companySize: e.target.value }))}>
            {companySizeOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Website">
          <Input type="url" value={form.website} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://" />
        </Field>
        <Field label="Fiscal Year Starts">
          <Select value={form.fiscalYearStartMonth} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, fiscalYearStartMonth: e.target.value }))}>
            {fiscalYearMonths.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Registered Address">
        <Textarea rows={2} value={form.address} disabled={!canEdit} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
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
          You have view-only access to the Organization profile.
        </p>
      )}
    </form>
  );
}

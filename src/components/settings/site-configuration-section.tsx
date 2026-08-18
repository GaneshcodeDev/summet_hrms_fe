"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useAccessControl } from "@/lib/access-control-context";
import { useSite } from "@/lib/site-context";
import { useSiteConfig } from "@/lib/site-config-context";
import { leaveTypes } from "@/lib/leave-data";
import type { LeaveApprovalMode, PayFrequency, SiteOnboardingConfig } from "@/lib/types";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const payFrequencies: PayFrequency[] = ["Monthly", "Bi-Weekly", "Weekly"];
const approvalModes: LeaveApprovalMode[] = ["Manager", "HR", "Manager then HR"];
const componentOptions = ["Basic Salary", "HRA", "Special Allowance", "Provident Fund", "Professional Tax", "Income Tax"];

function emptyConfig(siteId: string): SiteOnboardingConfig {
  return {
    siteId,
    attendance: {
      workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      weeklyOff: ["Sat", "Sun"],
      gracePeriodMinutes: 10,
      lateComingRule: "Flag as late arrival after the grace period",
      earlyGoingRule: "Flag as early departure if leaving 30+ minutes before shift end",
      overtimeEnabled: true,
    },
    leave: { enabledLeaveTypes: [...leaveTypes], approvalMode: "Manager", carryForwardEnabled: true, carryForwardMaxDays: 5 },
    payroll: { frequency: "Monthly", payCycleStartDay: 1, processingDay: 25, defaultComponents: [...componentOptions] },
    holiday: { calendarName: "", holidays: [] },
    updatedOn: new Date().toISOString().slice(0, 10),
  };
}

/**
 * Edits the SiteOnboardingConfig captured by Step 4 of the site onboarding
 * wizard — until this section existed, that data had a create path
 * (site-onboarding-wizard.tsx) but no edit path at all (Phase 17 gap: "Site
 * should contain real configurable values... Settings should consume the
 * existing SiteConfig/Master architecture" — this reuses saveSiteConfig()
 * rather than inventing a second configuration store).
 */
export function SiteConfigurationSection() {
  const { canFeature } = useAccessControl();
  const { sites, mappedSites, isSuperAdmin, currentSiteId } = useSite();
  const { configForSite, saveSiteConfig, refreshConfig } = useSiteConfig();
  const canEdit = canFeature("settings.organization", "edit") || canFeature("organization.structure", "edit");

  const scopedSites = isSuperAdmin ? sites : mappedSites;
  const [siteId, setSiteId] = useState(scopedSites.some((s) => s.id === currentSiteId) ? currentSiteId : scopedSites[0]?.id ?? "");
  const [form, setForm] = useState<SiteOnboardingConfig>(() => configForSite(siteId) ?? emptyConfig(siteId));
  const [saved, setSaved] = useState(false);
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState("");

  useEffect(() => {
    void refreshConfig(siteId);
  }, [siteId, refreshConfig]);

  useEffect(() => {
    setForm(configForSite(siteId) ?? emptyConfig(siteId));
  }, [siteId, configForSite]);

  function toggleInList(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await saveSiteConfig({ ...form, siteId, updatedOn: new Date().toISOString().slice(0, 10) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addHoliday() {
    if (!newHolidayName.trim() || !newHolidayDate) return;
    setForm((f) => ({ ...f, holiday: { ...f.holiday, holidays: [...f.holiday.holidays, { name: newHolidayName.trim(), date: newHolidayDate }] } }));
    setNewHolidayName("");
    setNewHolidayDate("");
  }

  function removeHoliday(index: number) {
    setForm((f) => ({ ...f, holiday: { ...f.holiday, holidays: f.holiday.holidays.filter((_, i) => i !== index) } }));
  }

  if (scopedSites.length === 0) {
    return <p className="p-6 text-sm text-slate-400 dark:text-slate-500">No sites configured yet.</p>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Site Configuration</h2>
        <Field label="">
          <Select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="w-auto">
            {scopedSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Attendance</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Working Days</span>
            <div className="flex flex-wrap gap-2">
              {weekDays.map((d) => (
                <button
                  type="button"
                  key={d}
                  disabled={!canEdit}
                  onClick={() => setForm((f) => ({ ...f, attendance: { ...f.attendance, workingDays: toggleInList(f.attendance.workingDays, d) } }))}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${form.attendance.workingDays.includes(d) ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300" : "border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <Field label="Grace Period (minutes)">
            <Input
              type="number"
              min={0}
              disabled={!canEdit}
              value={form.attendance.gracePeriodMinutes}
              onChange={(e) => setForm((f) => ({ ...f, attendance: { ...f.attendance, gracePeriodMinutes: Number(e.target.value) } }))}
            />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={form.attendance.overtimeEnabled}
            onChange={(e) => setForm((f) => ({ ...f, attendance: { ...f.attendance, overtimeEnabled: e.target.checked } }))}
            className="h-4 w-4 rounded border-slate-300"
          />
          Overtime tracking enabled
        </label>
      </div>

      <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Leave</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Approval Mode">
            <Select
              disabled={!canEdit}
              value={form.leave.approvalMode}
              onChange={(e) => setForm((f) => ({ ...f, leave: { ...f.leave, approvalMode: e.target.value as LeaveApprovalMode } }))}
            >
              {approvalModes.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label="Carry Forward Max Days">
            <Input
              type="number"
              min={0}
              disabled={!canEdit || !form.leave.carryForwardEnabled}
              value={form.leave.carryForwardMaxDays}
              onChange={(e) => setForm((f) => ({ ...f, leave: { ...f.leave, carryForwardMaxDays: Number(e.target.value) } }))}
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {leaveTypes.map((t) => (
            <button
              type="button"
              key={t}
              disabled={!canEdit}
              onClick={() => setForm((f) => ({ ...f, leave: { ...f.leave, enabledLeaveTypes: toggleInList(f.leave.enabledLeaveTypes, t) } }))}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${form.leave.enabledLeaveTypes.includes(t) ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300" : "border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Payroll</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Pay Frequency">
            <Select disabled={!canEdit} value={form.payroll.frequency} onChange={(e) => setForm((f) => ({ ...f, payroll: { ...f.payroll, frequency: e.target.value as PayFrequency } }))}>
              {payFrequencies.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
          <Field label="Pay Cycle Start Day">
            <Input type="number" min={1} max={28} disabled={!canEdit} value={form.payroll.payCycleStartDay} onChange={(e) => setForm((f) => ({ ...f, payroll: { ...f.payroll, payCycleStartDay: Number(e.target.value) } }))} />
          </Field>
          <Field label="Processing Day">
            <Input type="number" min={1} max={28} disabled={!canEdit} value={form.payroll.processingDay} onChange={(e) => setForm((f) => ({ ...f, payroll: { ...f.payroll, processingDay: Number(e.target.value) } }))} />
          </Field>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Holidays</h3>
        <div className="space-y-2">
          {form.holiday.holidays.map((h, i) => (
            <div key={`${h.name}-${h.date}`} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-200">
                {h.name} — {h.date}
              </span>
              {canEdit && (
                <button type="button" onClick={() => removeHoliday(i)} className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400">
                  Remove
                </button>
              )}
            </div>
          ))}
          {form.holiday.holidays.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No holidays configured.</p>}
        </div>
        {canEdit && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label="Holiday Name">
              <Input value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} placeholder="e.g. Diwali" />
            </Field>
            <Field label="Date">
              <Input type="date" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} />
            </Field>
            <Button type="button" variant="outline" onClick={addHoliday}>
              Add Holiday
            </Button>
          </div>
        )}
      </div>

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
          You have view-only access to Site Configuration.
        </p>
      )}
    </form>
  );
}

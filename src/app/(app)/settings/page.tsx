"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Check, Globe, KeyRound, Mail, Plug, Settings as SettingsIcon, Shield } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { organizationSettings } from "@/lib/mock-data";

const sections = [
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "organization", label: "Organization", icon: Building2 },
  { id: "localization", label: "Localization", icon: Globe },
  { id: "roles", label: "Roles & Permissions", icon: Shield },
  { id: "email", label: "Email Settings", icon: Mail },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "backup", label: "Backup", icon: KeyRound },
];

export default function SettingsPage() {
  const [active, setActive] = useState("general");
  const [form, setForm] = useState(organizationSettings);
  const [saved, setSaved] = useState(false);

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <PageHeader title="Settings" description="Manage organization preferences" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Card className="h-fit p-2 lg:col-span-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                active === s.id
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                  : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800",
              )}
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </button>
          ))}
        </Card>

        <Card className="lg:col-span-3">
          {active === "general" ? (
            <form onSubmit={handleSave} className="space-y-5 p-6">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">General Settings</h2>

              <Field label="Organization Name">
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </Field>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Organization Logo
                </span>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
                    Logo
                  </div>
                  <Button type="button" variant="outline" size="sm">
                    No file chosen
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Date Format">
                  <Select
                    value={form.dateFormat}
                    onChange={(e) => setForm((f) => ({ ...f, dateFormat: e.target.value }))}
                  >
                    <option>DD MMM YYYY</option>
                    <option>MM/DD/YYYY</option>
                    <option>DD/MM/YYYY</option>
                  </Select>
                </Field>
                <Field label="Time Format">
                  <Select
                    value={form.timeFormat}
                    onChange={(e) => setForm((f) => ({ ...f, timeFormat: e.target.value }))}
                  >
                    <option>12 Hour</option>
                    <option>24 Hour</option>
                  </Select>
                </Field>
              </div>

              <Field label="Currency">
                <Select
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                >
                  <option>INR (₹) - Indian Rupee</option>
                  <option>USD ($) - US Dollar</option>
                  <option>EUR (€) - Euro</option>
                </Select>
              </Field>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
                {saved && (
                  <span className="flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    <Check className="h-4 w-4" /> Saved
                  </span>
                )}
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          ) : active === "roles" ? (
            <div className="flex flex-col items-center gap-4 p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
                <Shield className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Roles &amp; Permissions moved</h2>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                  User accounts, configurable roles, the module/feature/action permission matrix and the security
                  audit log now live in their own Access Control module.
                </p>
              </div>
              <Link href="/access-control">
                <Button>
                  Open Access Control <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-slate-400 dark:text-slate-500">
              {sections.find((s) => s.id === active)?.label} settings coming soon.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

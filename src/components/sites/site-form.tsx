"use client";

import { Check } from "lucide-react";
import { FormEvent, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { SiteLogo } from "@/components/ui/site-logo";
import { cn } from "@/lib/utils";
import { packageFeatures, siteStatuses } from "@/lib/mock-data";
import type { PackagePlan, Site, SiteStatus } from "@/lib/types";

const logoColors = ["#4f46e5", "#0ea5e9", "#f59e0b", "#10b981", "#e11d48", "#7c3aed"];

interface SiteFormProps {
  initial?: Site;
  onSubmit: (site: Site) => void;
  submitLabel: string;
}

export function SiteForm({ initial, onSubmit, submitLabel }: SiteFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [logoColor, setLogoColor] = useState(initial?.logoColor ?? logoColors[0]);
  const [pkg, setPkg] = useState<PackagePlan>(initial?.package ?? "Professional");
  const [status, setStatus] = useState<SiteStatus>(initial?.status ?? "Trial");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const site: Site = {
      id: initial?.id ?? `site-${Date.now()}`,
      name,
      code: String(form.get("code") ?? ""),
      logoColor,
      addressLine1: String(form.get("addressLine1") ?? ""),
      city: String(form.get("city") ?? ""),
      state: String(form.get("state") ?? ""),
      pincode: String(form.get("pincode") ?? ""),
      country: String(form.get("country") ?? "India"),
      package: pkg,
      status,
      adminName: String(form.get("adminName") ?? ""),
      adminEmail: String(form.get("adminEmail") ?? ""),
      adminPhone: String(form.get("adminPhone") ?? ""),
      createdOn: initial?.createdOn ?? new Date().toISOString().slice(0, 10),
    };
    onSubmit(site);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Site Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center gap-4">
            <SiteLogo name={name || "New Site"} color={logoColor} size="lg" />
            <div className="flex gap-2">
              {logoColors.map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => setLogoColor(color)}
                  className={cn(
                    "h-7 w-7 rounded-full ring-offset-2 dark:ring-offset-slate-900",
                    logoColor === color && "ring-2 ring-slate-400",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Site Name">
              <Input
                name="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pune Innovation Center"
              />
            </Field>
            <Field label="Site Code">
              <Input name="code" required defaultValue={initial?.code} placeholder="e.g. PUN-01" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 pt-0 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Address Line 1">
              <Input name="addressLine1" required defaultValue={initial?.addressLine1} placeholder="Building, street" />
            </Field>
          </div>
          <Field label="City">
            <Input name="city" required defaultValue={initial?.city} />
          </Field>
          <Field label="State">
            <Input name="state" required defaultValue={initial?.state} />
          </Field>
          <Field label="Pincode">
            <Input name="pincode" required defaultValue={initial?.pincode} />
          </Field>
          <Field label="Country">
            <Input name="country" required defaultValue={initial?.country ?? "India"} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Package &amp; Billing</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 pt-0 sm:grid-cols-3">
          {(Object.keys(packageFeatures) as PackagePlan[]).map((plan) => (
            <button
              type="button"
              key={plan}
              onClick={() => setPkg(plan)}
              className={cn(
                "relative rounded-xl border p-4 text-left transition-colors",
                pkg === plan
                  ? "border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-200 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:ring-indigo-500/30"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600",
              )}
            >
              {pkg === plan && (
                <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              <p className="font-semibold text-slate-900 dark:text-white">{plan}</p>
              <p className="mt-1 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                {packageFeatures[plan].price}
              </p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{packageFeatures[plan].employeeLimit}</p>
              <ul className="mt-3 space-y-1">
                {packageFeatures[plan].features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500 dark:text-emerald-400" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Site Administrator</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 pt-0 sm:grid-cols-2">
          <Field label="Admin Name">
            <Input name="adminName" required defaultValue={initial?.adminName} placeholder="e.g. Kavya Reddy" />
          </Field>
          <Field label="Admin Email">
            <Input name="adminEmail" type="email" required defaultValue={initial?.adminEmail} placeholder="admin@company.com" />
          </Field>
          <Field label="Admin Phone">
            <Input name="adminPhone" required defaultValue={initial?.adminPhone} placeholder="+91 90000 00000" />
          </Field>
          <Field label="Site Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as SiteStatus)}>
              {siteStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}

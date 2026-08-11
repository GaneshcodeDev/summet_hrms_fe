"use client";

import Link from "next/link";
import { Boxes, CheckCircle2, History, Layers, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { useOrg } from "@/lib/org-context";
import { useSite } from "@/lib/site-context";
import { orgUnitTypeList } from "@/lib/org-data";

const auditActionLabel: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  activated: "Activated",
  deactivated: "Deactivated",
};

const auditActionTone: Record<string, "emerald" | "indigo" | "rose"> = {
  created: "emerald",
  updated: "indigo",
  activated: "emerald",
  deactivated: "rose",
};

export default function OrganizationDashboardPage() {
  const { orgUnits, auditEntries } = useOrg();
  const { currentSiteId, isAllSites } = useSite();

  const scopedUnits = isAllSites ? orgUnits : orgUnits.filter((u) => u.siteId === currentSiteId);
  const activeCount = scopedUnits.filter((u) => u.status === "Active").length;
  const inactiveCount = scopedUnits.length - activeCount;
  const companyCount = scopedUnits.filter((u) => u.type === "Company").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Org Units" value={String(scopedUnits.length)} icon={Boxes} tone="indigo" />
        <StatCard label="Companies" value={String(companyCount)} icon={Layers} tone="indigo" />
        <StatCard label="Active" value={String(activeCount)} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Inactive" value={String(inactiveCount)} icon={XCircle} tone="rose" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entity Types</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-2 xl:grid-cols-3">
          {orgUnitTypeList.map((config) => {
            const count = scopedUnits.filter((u) => u.type === config.type).length;
            const active = scopedUnits.filter((u) => u.type === config.type && u.status === "Active").length;
            const Icon = config.icon;
            return (
              <Link
                key={config.type}
                href={`/organization/units/${config.slug}`}
                className="flex items-center gap-3 rounded-xl border border-slate-100 p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-slate-800 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{config.pluralLabel}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {count} total &middot; {active} active
                  </p>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Recent Structural Changes
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {auditEntries.slice(0, 8).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    {entry.orgUnitName}
                    <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">
                      {entry.orgUnitType}
                    </span>
                  </p>
                  <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                    {entry.detail} &middot; by {entry.actorName}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={auditActionTone[entry.action]}>{auditActionLabel[entry.action]}</Badge>
                  <span className="hidden text-xs text-slate-400 dark:text-slate-500 sm:inline">
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
            {auditEntries.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No changes recorded yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

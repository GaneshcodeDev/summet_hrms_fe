"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, History, ListTree, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { useMasters } from "@/lib/master-context";
import { useSite } from "@/lib/site-context";
import { masterGroupOrder, masterTypeList } from "@/lib/master-data";

const auditActionLabel: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  activated: "Activated",
  deactivated: "Deactivated",
  imported: "Imported",
};
const auditActionTone: Record<string, "emerald" | "indigo" | "rose" | "sky"> = {
  created: "emerald",
  updated: "indigo",
  activated: "emerald",
  deactivated: "rose",
  imported: "sky",
};

export default function MastersDirectoryPage() {
  const { records, auditEntries } = useMasters();
  const { currentSiteId, isAllSites } = useSite();

  const ownedTypes = masterTypeList.filter((c) => !c.managedExternally);
  const externalTypes = masterTypeList.filter((c) => c.managedExternally);

  function countsFor(typeConfig: (typeof masterTypeList)[number]) {
    const scoped = records.filter(
      (r) => r.masterType === typeConfig.type && (typeConfig.scope === "global" || isAllSites || r.siteId === currentSiteId),
    );
    return { total: scoped.length, active: scoped.filter((r) => r.status === "Active").length };
  }

  const totalOwnedRecords = ownedTypes.reduce((sum, c) => sum + countsFor(c).total, 0);
  const totalActive = ownedTypes.reduce((sum, c) => sum + countsFor(c).active, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Master Types" value={String(masterTypeList.length)} icon={ListTree} tone="indigo" />
        <StatCard label="Total Records" value={String(totalOwnedRecords)} icon={ListTree} tone="indigo" />
        <StatCard label="Active" value={String(totalActive)} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Inactive" value={String(totalOwnedRecords - totalActive)} icon={XCircle} tone="rose" />
      </div>

      {masterGroupOrder.map((group) => {
        const groupTypes = masterTypeList.filter((c) => c.group === group);
        if (groupTypes.length === 0) return null;
        return (
          <Card key={group}>
            <CardHeader>
              <CardTitle>{group}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-2 xl:grid-cols-3">
              {groupTypes.map((config) => {
                const Icon = config.icon;
                if (config.managedExternally) {
                  return (
                    <Link
                      key={config.type}
                      href={config.managedExternally.href}
                      className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-slate-700 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/5"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-100">
                          {config.pluralLabel} <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          Managed in {config.managedExternally.moduleLabel}
                        </p>
                      </div>
                    </Link>
                  );
                }
                const { total, active } = countsFor(config);
                return (
                  <Link
                    key={config.type}
                    href={`/masters/${config.slug}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-slate-800 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{config.pluralLabel}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {total} total &middot; {active} active
                        {config.scope === "global" && (
                          <Badge tone="sky" className="ml-1.5 px-1.5 py-0 text-[10px]">
                            Global
                          </Badge>
                        )}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Recent Master Data Changes
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {auditEntries.slice(0, 8).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    {entry.recordName}
                    <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">{entry.masterType}</span>
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

      {externalTypes.length > 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Department, Location, Plant, Cost Center and Profit Center are structural entities defined once in the
          Organization module — Masters links to them rather than duplicating their definitions.
        </p>
      )}
    </div>
  );
}

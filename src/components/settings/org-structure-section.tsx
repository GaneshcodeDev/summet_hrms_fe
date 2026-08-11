"use client";

import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { orgUnitTypeList } from "@/lib/org-data";
import { useOrg } from "@/lib/org-context";
import { useSite } from "@/lib/site-context";
import { useAccessControl } from "@/lib/access-control-context";

export function OrgStructureSection() {
  const { sites, currentSiteId, isAllSites } = useSite();
  const { isUnitTypeEnabled, setUnitTypeEnabled, orgStructureConfig } = useOrg();
  const { canFeature } = useAccessControl();
  const canEdit = canFeature("organization.structure", "manage");

  const [selectedSiteId, setSelectedSiteId] = useState(
    isAllSites ? (sites[0]?.id ?? "") : currentSiteId,
  );
  const selectedSite = sites.find((s) => s.id === selectedSiteId);
  const config = orgStructureConfig[selectedSiteId];

  const enabledCount = useMemo(
    () => orgUnitTypeList.filter((c) => isUnitTypeEnabled(selectedSiteId, c.type)).length,
    [selectedSiteId, isUnitTypeEnabled],
  );

  if (sites.length === 0) {
    return (
      <div className="p-6 text-sm text-slate-400 dark:text-slate-500">
        Onboard a site first to configure its organization structure.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">Organization Structure</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Choose which structure levels this site actually uses. Disabled levels are hidden from the{" "}
        <a href="/organization" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Organization module
        </a>{" "}
        for this site — existing records of that type are kept, not deleted.
      </p>

      <div className="mt-5 max-w-xs">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Configuring structure for
          </span>
          <Select value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="mt-5 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
        <span>
          {enabledCount} of {orgUnitTypeList.length} levels enabled for {selectedSite?.name ?? "this site"}
        </span>
        {config?.updatedOn && (
          <>
            <span>&middot;</span>
            <span>
              Last updated by {config.updatedBy} on {new Date(config.updatedOn).toLocaleString()}
            </span>
          </>
        )}
      </div>

      <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
        {orgUnitTypeList.map((c) => {
          const isCompany = c.type === "Company";
          const enabled = isUnitTypeEnabled(selectedSiteId, c.type);
          return (
            <label
              key={c.type}
              className="flex items-center justify-between gap-4 py-3.5"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  <c.icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{c.pluralLabel}</p>
                    {isCompany && (
                      <Badge tone="slate">
                        <Lock className="h-3 w-3" /> Required
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{c.description}</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                disabled={isCompany || !canEdit}
                onChange={(e) => setUnitTypeEnabled(selectedSiteId, c.type, e.target.checked)}
                className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
          );
        })}
      </div>

      {!canEdit && (
        <p className="mt-5 border-t border-slate-100 pt-5 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
          You have view-only access to Organization Structure settings.
        </p>
      )}
    </div>
  );
}

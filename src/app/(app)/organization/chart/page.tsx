"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { TreeChart } from "@/components/organization/tree-chart";
import { useOrg } from "@/lib/org-context";
import { useSite } from "@/lib/site-context";
import { useEmployees } from "@/lib/employee-context";
import { buildOrgUnitTree } from "@/lib/org-utils";

export default function OrganizationChartPage() {
  const { orgUnits } = useOrg();
  const { sites, currentSiteId, isAllSites } = useSite();
  const { getEmployeeByEmployeeId } = useEmployees();

  const companies = useMemo(
    () => orgUnits.filter((u) => u.type === "Company" && (isAllSites || u.siteId === currentSiteId)),
    [orgUnits, isAllSites, currentSiteId],
  );

  const [rootId, setRootId] = useState<string | undefined>(undefined);
  const activeRootId = rootId && companies.some((c) => c.id === rootId) ? rootId : companies[0]?.id;
  const tree = activeRootId ? buildOrgUnitTree(orgUnits, activeRootId, getEmployeeByEmployeeId) : null;

  return (
    <div className="space-y-4">
      {companies.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Company</span>
          <Select value={activeRootId} onChange={(e) => setRootId(e.target.value)} className="w-auto min-w-[240px]">
            {companies.map((c) => {
              const site = sites.find((s) => s.id === c.siteId);
              return (
                <option key={c.id} value={c.id}>
                  {c.name} {site ? `(${site.name})` : ""}
                </option>
              );
            })}
          </Select>
        </div>
      )}

      <Card className="overflow-x-auto p-10">
        <p className="mb-6 text-center text-xs text-slate-400 dark:text-slate-500">
          Full structural hierarchy under this company — business units, divisions, departments, branches, plants,
          locations and cost/profit centers
        </p>
        <div className="flex min-w-max justify-center">
          {tree ? (
            <TreeChart node={tree} />
          ) : (
            <p className="py-10 text-sm text-slate-400 dark:text-slate-500">No company found for this site yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

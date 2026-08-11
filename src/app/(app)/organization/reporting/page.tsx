"use client";

import { Card } from "@/components/ui/card";
import { TreeChart } from "@/components/organization/tree-chart";
import { employees } from "@/lib/mock-data";
import { buildReportingTree } from "@/lib/org-utils";

export default function OrganizationReportingPage() {
  const tree = buildReportingTree(employees);

  return (
    <Card className="overflow-x-auto p-10">
      <p className="mb-6 text-center text-xs text-slate-400 dark:text-slate-500">
        Who reports to whom, computed live from each employee&apos;s reporting manager — not filtered by site
      </p>
      <div className="flex min-w-max justify-center">
        {tree ? (
          <TreeChart node={tree} />
        ) : (
          <p className="py-10 text-sm text-slate-400 dark:text-slate-500">No reporting relationships found.</p>
        )}
      </div>
    </Card>
  );
}

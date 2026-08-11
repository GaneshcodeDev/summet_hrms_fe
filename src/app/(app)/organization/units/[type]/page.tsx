"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Layers } from "lucide-react";
import { OrgUnitManager } from "@/components/organization/org-unit-manager";
import { orgUnitTypeBySlug } from "@/lib/org-data";
import { useOrg } from "@/lib/org-context";
import { useSite } from "@/lib/site-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function OrgUnitTypePage(props: PageProps<"/organization/units/[type]">) {
  const { type: slug } = use(props.params);
  const config = orgUnitTypeBySlug(slug);
  if (!config) notFound();

  const { isAllSites, currentSiteId, currentSite } = useSite();
  const { isUnitTypeEnabled } = useOrg();

  if (!isAllSites && !isUnitTypeEnabled(currentSiteId, config.type)) {
    return (
      <Card className="flex flex-col items-center gap-4 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
          <Layers className="h-6 w-6 text-slate-400 dark:text-slate-500" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {config.pluralLabel} is disabled for {currentSite?.name}
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            This structure level was turned off for this site in Settings. Existing records aren&apos;t deleted —
            re-enable it to manage them here again.
          </p>
        </div>
        <Link href="/settings">
          <Button variant="outline">Open Settings</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Suspense fallback={null}>
      <OrgUnitManager type={config.type} />
    </Suspense>
  );
}

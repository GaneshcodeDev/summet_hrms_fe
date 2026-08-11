"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { SiteLogo } from "@/components/ui/site-logo";
import { useSite } from "@/lib/site-context";
import { employees } from "@/lib/mock-data";

export default function SitesPage() {
  const { sites, setCurrentSiteId } = useSite();

  return (
    <div>
      <PageHeader
        title="Sites"
        description="Manage every tenant site onboarded to this platform"
        action={
          <Link href="/sites/new">
            <Button>
              <Plus className="h-4 w-4" /> Onboard New Site
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sites.map((site) => {
          const siteEmployeeCount = employees.filter((e) => e.siteId === site.id).length;
          return (
            <Card key={site.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <SiteLogo name={site.name} color={site.logoColor} size="lg" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{site.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{site.code}</p>
                  </div>
                </div>
                <StatusBadge status={site.status} />
              </div>

              <div className="mt-4 space-y-1.5 text-sm text-slate-500 dark:text-slate-400">
                <p>
                  {site.city}, {site.state}
                </p>
                <p>{site.adminName} &middot; {site.adminEmail}</p>
                <div className="flex items-center gap-2 pt-1">
                  <Badge tone="indigo">{site.package}</Badge>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{siteEmployeeCount} employees</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  onClick={() => setCurrentSiteId(site.id)}
                  className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  View Data
                </button>
                <span className="text-slate-300 dark:text-slate-700">&middot;</span>
                <Link
                  href={`/sites/${site.id}/edit`}
                  className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Edit
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Building2, Plus, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { SiteLogo } from "@/components/ui/site-logo";
import { useSite } from "@/lib/site-context";
import { useEmployees } from "@/lib/employee-context";
import { isDemoDataEnabled, loadDemoData } from "@/lib/demo-seed";

export default function SitesPage() {
  const { sites, setCurrentSiteId } = useSite();
  const { employees } = useEmployees();

  if (sites.length === 0) {
    return (
      <div>
        <PageHeader title="Sites" description="Manage every tenant site onboarded to this platform" />
        <Card className="flex flex-col items-center gap-4 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <Building2 className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Welcome to your HRMS</h2>
            <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              You haven&apos;t onboarded any sites yet. Create your first site to start adding organization structure,
              employees and a Site Admin.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/sites/new">
              <Button>
                <Plus className="h-4 w-4" /> Create Your First Site
              </Button>
            </Link>
            {isDemoDataEnabled && (
              <Button
                variant="outline"
                onClick={() => {
                  loadDemoData();
                  window.location.reload();
                }}
              >
                <Sparkles className="h-4 w-4" /> Load Demo Data
              </Button>
            )}
          </div>
          {isDemoDataEnabled && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Load Demo Data hydrates the platform with a sample multi-site dataset for development/testing.
            </p>
          )}
        </Card>
      </div>
    );
  }

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
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {siteEmployeeCount} employee{siteEmployeeCount === 1 ? "" : "s"}
                  </span>
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

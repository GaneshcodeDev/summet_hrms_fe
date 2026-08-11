"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, ChevronDown, Globe } from "lucide-react";
import { SiteLogo } from "@/components/ui/site-logo";
import { StatusBadge } from "@/components/ui/status-badge";
import { ALL_SITES_ID, useSite } from "@/lib/site-context";

export function SiteSwitcher() {
  const { sites, currentSiteId, currentSite, isAllSites, setCurrentSiteId, isSuperAdmin, mappedSites } =
    useSite();
  const [open, setOpen] = useState(false);

  // Super Admin can switch across every tenant (plus an "All Sites" aggregate view).
  // Any other user only sees this switcher when they're mapped to more than one site,
  // and can only switch between the sites they're actually mapped to.
  if (!isSuperAdmin && mappedSites.length <= 1) return null;

  const options = isSuperAdmin ? sites : mappedSites;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 py-1.5 pl-2 pr-3 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        {isAllSites || !currentSite ? (
          <>
            <Globe className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <span className="hidden font-medium text-slate-700 sm:inline dark:text-slate-200">
              {isSuperAdmin ? "All Sites" : "Select Site"}
            </span>
          </>
        ) : (
          <>
            <SiteLogo name={currentSite.name} color={currentSite.logoColor} size="sm" />
            <span className="hidden max-w-[140px] truncate font-medium text-slate-700 sm:inline dark:text-slate-200">
              {currentSite.name}
            </span>
          </>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-2 w-72 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
            {!isSuperAdmin && (
              <p className="px-3.5 pb-1.5 pt-2 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                You&apos;re mapped to {mappedSites.length} sites
              </p>
            )}

            {isSuperAdmin && (
              <>
                <button
                  onClick={() => {
                    setCurrentSiteId(ALL_SITES_ID);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${
                    currentSiteId === ALL_SITES_ID
                      ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    <Globe className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="font-medium">All Sites</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Aggregate view across all tenants</p>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              </>
            )}

            {options.map((site) => (
              <button
                key={site.id}
                onClick={() => {
                  setCurrentSiteId(site.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${
                  currentSiteId === site.id
                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              >
                <SiteLogo name={site.name} color={site.logoColor} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{site.name}</p>
                  <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                    {site.city} &middot; {site.code}
                  </p>
                </div>
                <StatusBadge status={site.status} />
              </button>
            ))}

            {isSuperAdmin && (
              <>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <Link
                  href="/sites"
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                >
                  <Building2 className="h-4 w-4" /> Manage Sites
                </Link>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

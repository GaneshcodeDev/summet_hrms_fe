"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Users, Building2, Laptop, Receipt } from "lucide-react";
import { useAccessControl } from "@/lib/access-control-context";
import { useSite, useSiteFilter } from "@/lib/site-context";
import { useEmployees } from "@/lib/employee-context";
import { useAssets } from "@/lib/asset-context";
import { useExpense } from "@/lib/expense-context";

interface SearchResult {
  id: string;
  label: string;
  sublabel: string;
  href: string;
  icon: typeof Users;
}

/**
 * Simple scoped global search (section 20) — every category is filtered
 * through the SAME site-scoping (useSiteFilter) and RBAC checks (canFeature)
 * each module's own list page already applies, so search can never surface
 * a record the user couldn't otherwise reach. Deliberately narrow: Leave/
 * Payroll/Candidates aren't indexed here (their scoping chains are more
 * involved — Candidate visibility depends on Application→Opening→site — and
 * getting that wrong would leak cross-site data, worse than not searching
 * it at all). Reach an employee's Leave/Payroll via their profile instead.
 */
export function GlobalSearch() {
  const router = useRouter();
  const { canFeature, canModule } = useAccessControl();
  const { sites } = useSite();
  const { employees } = useEmployees();
  const { assets } = useAssets();
  const { expenseClaims, travelRequests } = useExpense();

  const scopedEmployees = useSiteFilter(employees);
  const scopedAssets = useSiteFilter(assets);
  const scopedClaims = useSiteFilter(expenseClaims);
  const scopedTravel = useSiteFilter(travelRequests);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const canSeeEmployees = canFeature("employees.directory", "view");
  const canSeeSites = canModule("Sites", "view");
  const canSeeAssets = canFeature("assets.inventory", "view");
  const canSeeExpenses = canFeature("expenses.claims", "view") || canFeature("expenses.travel", "view");

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: SearchResult[] = [];

    if (canSeeEmployees) {
      for (const e of scopedEmployees) {
        if (e.name.toLowerCase().includes(q) || e.employeeId.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)) {
          out.push({ id: `emp-${e.id}`, label: e.name, sublabel: `${e.designation} · ${e.employeeId}`, href: `/employees/${e.employeeId}`, icon: Users });
        }
      }
    }
    if (canSeeSites) {
      for (const s of sites) {
        if (s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)) {
          out.push({ id: `site-${s.id}`, label: s.name, sublabel: `Site · ${s.code}`, href: `/sites/${s.id}/edit`, icon: Building2 });
        }
      }
    }
    if (canSeeAssets) {
      for (const a of scopedAssets) {
        if (a.name.toLowerCase().includes(q) || a.assetCode.toLowerCase().includes(q)) {
          out.push({ id: `asset-${a.id}`, label: a.name, sublabel: `Asset · ${a.assetCode}`, href: `/assets/${a.id}`, icon: Laptop });
        }
      }
    }
    if (canSeeExpenses) {
      for (const c of scopedClaims) {
        if (c.title.toLowerCase().includes(q)) {
          out.push({ id: `claim-${c.id}`, label: c.title, sublabel: `Expense Claim · ${c.id}`, href: `/expenses/claims/${c.id}`, icon: Receipt });
        }
      }
      for (const r of scopedTravel) {
        if (r.purpose.toLowerCase().includes(q) || r.destination.toLowerCase().includes(q)) {
          out.push({ id: `travel-${r.id}`, label: r.purpose, sublabel: `Travel Request · ${r.destination}`, href: `/expenses/travel/${r.id}`, icon: Receipt });
        }
      }
    }
    return out.slice(0, 20);
  }, [query, canSeeEmployees, canSeeSites, canSeeAssets, canSeeExpenses, scopedEmployees, sites, scopedAssets, scopedClaims, scopedTravel]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <div className="relative max-w-md flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search employees, sites, assets, expenses..."
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
      />
      {open && query.trim().length >= 2 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-100 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
            {results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">No matches for &quot;{query}&quot;.</p>
            ) : (
              results.map((r) => (
                <Link
                  key={r.id}
                  href={r.href}
                  onClick={() => go(r.href)}
                  className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    <r.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{r.label}</p>
                    <p className="truncate text-xs text-slate-400 dark:text-slate-500">{r.sublabel}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

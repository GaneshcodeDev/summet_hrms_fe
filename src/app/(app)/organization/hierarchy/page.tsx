"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { useOrg } from "@/lib/org-context";
import { useSite } from "@/lib/site-context";
import { orgUnitTypeConfig } from "@/lib/org-data";
import { getEmployeeById } from "@/lib/mock-data";
import type { OrgUnit } from "@/lib/types";

function matchesQuery(unit: OrgUnit, query: string) {
  const q = query.toLowerCase();
  return unit.name.toLowerCase().includes(q) || unit.code.toLowerCase().includes(q);
}

function Row({
  unit,
  depth,
  childrenOf,
  visibleIds,
  expanded,
  toggle,
}: {
  unit: OrgUnit;
  depth: number;
  childrenOf: (parentId: string) => OrgUnit[];
  visibleIds: Set<string> | null;
  expanded: Set<string>;
  toggle: (id: string) => void;
}) {
  const allChildren = childrenOf(unit.id);
  const children = visibleIds ? allChildren.filter((c) => visibleIds.has(c.id)) : allChildren;
  const hasChildren = children.length > 0;
  const isOpen = expanded.has(unit.id) || Boolean(visibleIds);
  const config = orgUnitTypeConfig[unit.type];
  const Icon = config.icon;
  const head = unit.headEmployeeId ? getEmployeeById(unit.headEmployeeId) : undefined;

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-lg py-2 pr-3 hover:bg-slate-50 dark:hover:bg-slate-800/60"
        style={{ paddingLeft: `${depth * 22 + 8}px` }}
      >
        <button
          onClick={() => hasChildren && toggle(unit.id)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 dark:text-slate-500 ${!hasChildren && "invisible"}`}
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <Icon className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
        <Link
          href={`/organization/units/${config.slug}?focus=${unit.id}`}
          className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 hover:underline dark:text-slate-100"
        >
          {unit.name}
        </Link>
        <span className="hidden shrink-0 text-xs text-slate-400 dark:text-slate-500 sm:inline">{unit.code}</span>
        <Badge tone="slate" className="hidden shrink-0 sm:inline-flex">
          {config.label}
        </Badge>
        {head && <span className="hidden shrink-0 truncate text-xs text-slate-400 dark:text-slate-500 md:inline">{head.name}</span>}
        <StatusBadge status={unit.status} />
      </div>
      {hasChildren && isOpen && (
        <div>
          {children.map((child) => (
            <Row
              key={child.id}
              unit={child}
              depth={depth + 1}
              childrenOf={childrenOf}
              visibleIds={visibleIds}
              expanded={expanded}
              toggle={toggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrganizationHierarchyPage() {
  const { orgUnits } = useOrg();
  const { currentSiteId, isAllSites } = useSite();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const scopedUnits = useMemo(
    () =>
      orgUnits.filter(
        (u) => (isAllSites || u.siteId === currentSiteId) && (statusFilter === "All Status" || u.status === statusFilter),
      ),
    [orgUnits, isAllSites, currentSiteId, statusFilter],
  );

  const childrenOf = (parentId: string) => scopedUnits.filter((u) => u.parentId === parentId);

  const visibleIds = useMemo(() => {
    if (!search.trim()) return null;
    const matches = scopedUnits.filter((u) => matchesQuery(u, search));
    const visible = new Set<string>();
    const byId = new Map(scopedUnits.map((u) => [u.id, u]));
    for (const m of matches) {
      let current: OrgUnit | undefined = m;
      while (current) {
        visible.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
    }
    return visible;
  }, [scopedUnits, search]);

  const roots = scopedUnits
    .filter((u) => u.parentId === null)
    .filter((u) => !visibleIds || visibleIds.has(u.id));

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search units by name or code..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
          </Select>
        </div>

        <div className="p-2">
          {roots.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-400 dark:text-slate-500">
              No organization units match your filters.
            </p>
          )}
          {roots.map((root) => (
            <Row
              key={root.id}
              unit={root}
              depth={0}
              childrenOf={childrenOf}
              visibleIds={visibleIds}
              expanded={expanded}
              toggle={toggle}
            />
          ))}
        </div>
      </Card>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Click a unit to open it in its management screen. Use search to trace where a unit sits in the hierarchy — matching
        branches expand automatically.
      </p>
    </div>
  );
}

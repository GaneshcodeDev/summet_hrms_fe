"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveMenuIcon } from "@/lib/menu-data";
import { useMenu } from "@/lib/menu-context";
import { SiteLogo } from "@/components/ui/site-logo";
import { useSite } from "@/lib/site-context";

export function Sidebar() {
  const pathname = usePathname();
  const { currentSite, isAllSites } = useSite();
  const { visibleTopLevel, visibleChildrenOf } = useMenu();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-100 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-16 items-center gap-2 px-6">
        {isAllSites || !currentSite ? (
          <>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <Users2 className="h-4.5 w-4.5 text-white" strokeWidth={2.25} />
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white">HRMS</span>
          </>
        ) : (
          <>
            <SiteLogo name={currentSite.name} color={currentSite.logoColor} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-slate-900 dark:text-white">
                {currentSite.name}
              </p>
              <p className="truncate text-[11px] leading-tight text-slate-400 dark:text-slate-500">{currentSite.code}</p>
            </div>
          </>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {visibleTopLevel().map((item) => {
          const children = visibleChildrenOf(item.id);
          const Icon = resolveMenuIcon(item.icon);
          const active = isActive(item.href);
          const childActive = children.some((c) => isActive(c.href));
          const isOpen = expanded.has(item.id) || childActive;

          if (children.length === 0) {
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
                )}
              >
                <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                {item.label}
              </Link>
            );
          }

          return (
            <div key={item.id}>
              <button
                onClick={() => toggle(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  childActive
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
                <span className="flex-1">{item.label}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-100 pl-3 dark:border-slate-800">
                  {children.map((child) => {
                    const ChildIcon = resolveMenuIcon(child.icon);
                    const childIsActive = isActive(child.href);
                    return (
                      <Link
                        key={child.id}
                        href={child.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          childIsActive
                            ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
                        )}
                      >
                        <ChildIcon className="h-4 w-4" strokeWidth={2} />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

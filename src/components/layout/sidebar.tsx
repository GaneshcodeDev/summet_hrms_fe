"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "@/components/layout/nav-items";
import { SiteLogo } from "@/components/ui/site-logo";
import { useSite } from "@/lib/site-context";
import { useAccessControl } from "@/lib/access-control-context";

export function Sidebar() {
  const pathname = usePathname();
  const { currentSite, isAllSites } = useSite();
  const { canModule } = useAccessControl();

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
        {navItems
          .filter((item) => canModule(item.module, "view"))
          .map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
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
          })}
      </nav>
    </aside>
  );
}

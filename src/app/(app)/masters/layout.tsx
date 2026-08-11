"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { masterGroupOrder, masterTypeList } from "@/lib/master-data";

export default function MastersLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div>
      <PageHeader
        title="Masters"
        description="Centralized, configurable reference data shared across every module"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Card className="h-fit max-h-[calc(100vh-160px)] space-y-0.5 overflow-y-auto p-2 lg:col-span-1">
          <Link
            href="/masters/directory"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
              isActive("/masters/directory")
                ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800",
            )}
          >
            <LayoutGrid className="h-4 w-4 shrink-0" />
            Directory
          </Link>

          {masterGroupOrder.map((group) => (
            <div key={group}>
              <p className="mt-3 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {group}
              </p>
              {masterTypeList
                .filter((c) => c.group === group)
                .map((c) => {
                  const href = `/masters/${c.slug}`;
                  const Icon = c.icon;
                  return (
                    <Link
                      key={c.type}
                      href={href}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                        isActive(href)
                          ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                          : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{c.pluralLabel}</span>
                    </Link>
                  );
                })}
            </div>
          ))}
        </Card>

        <div className="lg:col-span-3">{children}</div>
      </div>
    </div>
  );
}

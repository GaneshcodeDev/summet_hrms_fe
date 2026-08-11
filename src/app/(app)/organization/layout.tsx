"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitCommitHorizontal, IdCard, LayoutDashboard, Network, UsersRound, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { orgUnitTypeList } from "@/lib/org-data";

interface Section {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

const overviewSections: Section[] = [
  { id: "dashboard", label: "Dashboard", href: "/organization/dashboard", icon: LayoutDashboard },
  { id: "hierarchy", label: "Hierarchy", href: "/organization/hierarchy", icon: Network },
  { id: "chart", label: "Org Chart", href: "/organization/chart", icon: GitCommitHorizontal },
  { id: "reporting", label: "Reporting Structure", href: "/organization/reporting", icon: UsersRound },
];

const unitSections: Section[] = orgUnitTypeList.map((c) => ({
  id: c.slug,
  label: c.pluralLabel,
  href: `/organization/units/${c.slug}`,
  icon: c.icon,
}));

const designationSection: Section = {
  id: "designations",
  label: "Designations",
  href: "/organization/designations",
  icon: IdCard,
};

function SectionLink({ section, active }: { section: Section; active: boolean }) {
  return (
    <Link
      href={section.href}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
        active
          ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
          : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800",
      )}
    >
      <section.icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{section.label}</span>
    </Link>
  );
}

export default function OrganizationLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div>
      <PageHeader
        title="Organization"
        description="Company structure, hierarchy, org chart and reporting relationships"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Card className="h-fit space-y-0.5 p-2 lg:col-span-1">
          {overviewSections.map((s) => (
            <SectionLink key={s.id} section={s} active={isActive(s.href)} />
          ))}

          <p className="mt-3 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Manage Entities
          </p>
          {unitSections.map((s) => (
            <SectionLink key={s.id} section={s} active={isActive(s.href)} />
          ))}

          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <SectionLink section={designationSection} active={isActive(designationSection.href)} />
        </Card>

        <div className="lg:col-span-3">{children}</div>
      </div>
    </div>
  );
}

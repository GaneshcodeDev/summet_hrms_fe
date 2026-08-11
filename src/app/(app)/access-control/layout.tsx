"use client";

import { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs } from "@/components/ui/tabs";

const sections = [
  { id: "users", label: "Users", href: "/access-control/users" },
  { id: "roles", label: "Roles", href: "/access-control/roles" },
  { id: "permissions", label: "Permission Matrix", href: "/access-control/permissions" },
  { id: "menu", label: "Menu Management", href: "/access-control/menu" },
  { id: "security", label: "Security & Audit", href: "/access-control/security" },
];

export default function AccessControlLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = sections.find((s) => pathname.startsWith(s.href))?.id ?? "users";

  return (
    <div>
      <PageHeader
        title="Access Control"
        description="Manage users, configurable roles, granular permissions and security across the organization"
      />
      <Tabs
        tabs={sections.map((s) => ({ id: s.id, label: s.label }))}
        active={active}
        onChange={(id) => {
          const target = sections.find((s) => s.id === id);
          if (target) router.push(target.href);
        }}
        className="mb-6"
      />
      {children}
    </div>
  );
}

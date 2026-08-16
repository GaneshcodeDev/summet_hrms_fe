"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, Building2, CalendarClock, Globe, KeyRound, Layers, Mail, Plug, Settings as SettingsIcon, Shield } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GeneralSection } from "@/components/settings/general-section";
import { OrganizationSection } from "@/components/settings/organization-section";
import { OrgStructureSection } from "@/components/settings/org-structure-section";
import { LocalizationSection } from "@/components/settings/localization-section";
import { SiteConfigurationSection } from "@/components/settings/site-configuration-section";
import { EmailSection } from "@/components/settings/email-section";
import { IntegrationsSection } from "@/components/settings/integrations-section";
import { BackupSection } from "@/components/settings/backup-section";

const sections = [
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "organization", label: "Organization", icon: Building2 },
  { id: "org-structure", label: "Organization Structure", icon: Layers },
  { id: "site-configuration", label: "Attendance, Leave & Payroll", icon: CalendarClock },
  { id: "localization", label: "Localization", icon: Globe },
  { id: "roles", label: "Roles & Permissions", icon: Shield },
  { id: "security", label: "Security", icon: KeyRound },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "email", label: "Email Settings", icon: Mail },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "backup", label: "Backup", icon: KeyRound },
];

export default function SettingsPage() {
  const [active, setActive] = useState("general");

  return (
    <div>
      <PageHeader title="Settings" description="Manage organization preferences" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Card className="h-fit p-2 lg:col-span-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                active === s.id
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                  : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800",
              )}
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </button>
          ))}
        </Card>

        <Card className="lg:col-span-3">
          {active === "general" && <GeneralSection />}
          {active === "organization" && <OrganizationSection />}
          {active === "org-structure" && <OrgStructureSection />}
          {active === "site-configuration" && <SiteConfigurationSection />}
          {active === "localization" && <LocalizationSection />}
          {active === "email" && <EmailSection />}
          {active === "integrations" && <IntegrationsSection />}
          {active === "backup" && <BackupSection />}
          {(active === "roles" || active === "security") && (
            <div className="flex flex-col items-center gap-4 p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
                <Shield className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {active === "security" ? "Security lives in Access Control" : "Roles & Permissions moved"}
                </h2>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                  {active === "security"
                    ? "Locked accounts, the login/security audit log, and account unlocking now live in Access Control."
                    : "User accounts, configurable roles, the module/feature/action permission matrix and the security audit log now live in their own Access Control module."}
                </p>
              </div>
              <Link href={active === "security" ? "/access-control/security" : "/access-control"}>
                <Button>
                  Open Access Control <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
          {active === "notifications" && (
            <div className="flex flex-col items-center gap-4 p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
                <Bell className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">In-app notifications only</h2>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                  Leave, expense, training and asset events raise a real notification in the bell at the top of every
                  page. There&apos;s no email/SMS provider connected in this phase — that&apos;s a deliberate scope
                  boundary, not a missing setting (see docs/production-readiness.md).
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

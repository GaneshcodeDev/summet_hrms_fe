"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Globe, KeyRound, Layers, Mail, Plug, Settings as SettingsIcon, Shield } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GeneralSection } from "@/components/settings/general-section";
import { OrganizationSection } from "@/components/settings/organization-section";
import { OrgStructureSection } from "@/components/settings/org-structure-section";
import { LocalizationSection } from "@/components/settings/localization-section";
import { EmailSection } from "@/components/settings/email-section";
import { IntegrationsSection } from "@/components/settings/integrations-section";
import { BackupSection } from "@/components/settings/backup-section";

const sections = [
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "organization", label: "Organization", icon: Building2 },
  { id: "org-structure", label: "Organization Structure", icon: Layers },
  { id: "localization", label: "Localization", icon: Globe },
  { id: "roles", label: "Roles & Permissions", icon: Shield },
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
          {active === "localization" && <LocalizationSection />}
          {active === "email" && <EmailSection />}
          {active === "integrations" && <IntegrationsSection />}
          {active === "backup" && <BackupSection />}
          {active === "roles" && (
            <div className="flex flex-col items-center gap-4 p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
                <Shield className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Roles &amp; Permissions moved</h2>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                  User accounts, configurable roles, the module/feature/action permission matrix and the security
                  audit log now live in their own Access Control module.
                </p>
              </div>
              <Link href="/access-control">
                <Button>
                  Open Access Control <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

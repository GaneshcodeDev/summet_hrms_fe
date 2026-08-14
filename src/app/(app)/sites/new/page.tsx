"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { SiteOnboardingWizard } from "@/components/sites/site-onboarding-wizard";

export default function NewSitePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/sites"
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Sites
      </Link>
      <PageHeader title="Onboard New Site" description="Set up a new tenant site — organization, admin access and initial configuration" />
      <SiteOnboardingWizard />
    </div>
  );
}

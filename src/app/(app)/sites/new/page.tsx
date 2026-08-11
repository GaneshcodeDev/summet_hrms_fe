"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { SiteForm } from "@/components/sites/site-form";
import { useSite } from "@/lib/site-context";
import type { Site } from "@/lib/types";

export default function NewSitePage() {
  const router = useRouter();
  const { addSite, setCurrentSiteId } = useSite();

  function handleSubmit(site: Site) {
    addSite(site);
    setCurrentSiteId(site.id);
    router.push("/sites");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/sites"
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Sites
      </Link>
      <PageHeader title="Onboard New Site" description="Add a new tenant site to the platform" />
      <SiteForm onSubmit={handleSubmit} submitLabel="Onboard Site" />
    </div>
  );
}

"use client";

import { use } from "react";
import { useRouter, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { SiteForm } from "@/components/sites/site-form";
import { useSite } from "@/lib/site-context";
import type { Site } from "@/lib/types";

export default function EditSitePage(props: PageProps<"/sites/[id]/edit">) {
  const { id } = use(props.params);
  const router = useRouter();
  const { sites, updateSite } = useSite();

  const site = sites.find((s) => s.id === id);
  if (!site) notFound();

  async function handleSubmit(updated: Site) {
    await updateSite(id, updated);
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
      <PageHeader title="Edit Site" description={`Update details for ${site.name}`} />
      <SiteForm initial={site} onSubmit={handleSubmit} submitLabel="Save Changes" />
    </div>
  );
}

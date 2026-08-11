"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { orgUnitTypeBySlug } from "@/lib/org-data";
import { SiteProfileDetail } from "@/components/organization/site-profile-detail";

export default function OrgUnitDetailPage(props: PageProps<"/organization/units/[type]/[id]">) {
  const { type: slug, id } = use(props.params);
  const config = orgUnitTypeBySlug(slug);
  if (!config) notFound();
  if (config.type !== "CostCenter" && config.type !== "ProfitCenter") notFound();

  return <SiteProfileDetail type={config.type} orgUnitId={id} />;
}

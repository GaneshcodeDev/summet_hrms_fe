"use client";

import { Suspense, use } from "react";
import { notFound } from "next/navigation";
import { OrgUnitManager } from "@/components/organization/org-unit-manager";
import { orgUnitTypeBySlug } from "@/lib/org-data";

export default function OrgUnitTypePage(props: PageProps<"/organization/units/[type]">) {
  const { type: slug } = use(props.params);
  const config = orgUnitTypeBySlug(slug);
  if (!config) notFound();

  return (
    <Suspense fallback={null}>
      <OrgUnitManager type={config.type} />
    </Suspense>
  );
}

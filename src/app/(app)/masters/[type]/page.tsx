"use client";

import { Suspense, use, useEffect } from "react";
import { notFound, useRouter } from "next/navigation";
import { MasterManager } from "@/components/masters/master-manager";
import { masterTypeBySlug } from "@/lib/master-data";

function ExternallyManagedRedirect({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
  }, [router, href]);
  return null;
}

export default function MasterTypePage(props: PageProps<"/masters/[type]">) {
  const { type: slug } = use(props.params);
  const config = masterTypeBySlug(slug);
  if (!config) notFound();

  if (config.managedExternally) {
    return <ExternallyManagedRedirect href={config.managedExternally.href} />;
  }

  return (
    <Suspense fallback={null}>
      <MasterManager type={config.type} />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { moduleLabel } from "@/lib/route-permissions";
import type { PermissionModule } from "@/lib/types";

export function Forbidden({ module }: { module?: PermissionModule }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Access Restricted</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {module
            ? `Your role doesn't include permission to view the ${moduleLabel(module)} module. Contact your administrator if you believe this is a mistake.`
            : "You don't have permission to view this page."}
        </p>
        <Link href="/dashboard">
          <Button className="mt-6">Back to Dashboard</Button>
        </Link>
      </Card>
    </div>
  );
}

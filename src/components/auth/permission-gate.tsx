"use client";

import type { ReactNode } from "react";
import { useAccessControl } from "@/lib/access-control-context";
import type { PermissionAction, PermissionModule } from "@/lib/types";

interface CanProps {
  /** Broad module check — true if the user has `action` on any feature within the module. */
  module?: PermissionModule;
  /** Fine-grained check against a single feature id from the permission catalog. */
  feature?: string;
  action: PermissionAction;
  fallback?: ReactNode;
  children: ReactNode;
}

/** Action-level UI gate: hides (or swaps in a fallback for) controls the current role can't use. */
export function Can({ module, feature, action, fallback = null, children }: CanProps) {
  const { canFeature, canModule } = useAccessControl();
  const allowed = feature ? canFeature(feature, action) : module ? canModule(module, action) : false;
  return <>{allowed ? children : fallback}</>;
}

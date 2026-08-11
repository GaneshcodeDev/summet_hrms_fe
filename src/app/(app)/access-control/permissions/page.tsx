"use client";

import { Fragment, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useAccessControl } from "@/lib/access-control-context";
import { actionsGrantedFor, featureCatalog } from "@/lib/rbac-data";
import { permissionActions, permissionModules } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { PermissionAction, PermissionFeature } from "@/lib/types";

const actionLabels: Record<PermissionAction, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  approve: "Approve",
  reject: "Reject",
  export: "Export",
  import: "Import",
  manage: "Manage",
};

function PermissionsMatrix() {
  const searchParams = useSearchParams();
  const { roles, rolePermissions, setRoleFeatureActions } = useAccessControl();

  const [roleId, setRoleId] = useState(searchParams.get("role") ?? roles[0]?.id ?? "");
  const role = roles.find((r) => r.id === roleId) ?? roles[0];
  const isSuperAdmin = role?.name === "Super Admin";
  const roleMap = role ? rolePermissions[role.id] ?? {} : {};

  const featuresByModule = useMemo(
    () =>
      permissionModules.reduce<Record<string, PermissionFeature[]>>((acc, m) => {
        acc[m] = featureCatalog.filter((f) => f.module === m);
        return acc;
      }, {}),
    [],
  );

  function toggle(feature: PermissionFeature, action: PermissionAction) {
    if (!role || isSuperAdmin) return;
    const current = roleMap[feature.id] ?? [];
    const effective = new Set(actionsGrantedFor(roleMap, feature.id));

    let next: PermissionAction[];
    if (action === "manage") {
      next = effective.has("manage") ? [] : ["manage"];
    } else if (effective.has("manage")) {
      next = feature.actions.filter((a) => a !== "manage" && a !== action);
    } else {
      next = effective.has(action) ? current.filter((a) => a !== action) : [...current, action];
    }
    setRoleFeatureActions(role.id, feature.id, next);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</span>
        <Select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-auto min-w-[220px]">
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        {role && <Badge tone={role.status === "Active" ? "emerald" : "slate"}>{role.status}</Badge>}
        {isSuperAdmin && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <Lock className="h-3.5 w-3.5" /> Super Admin always has full access — permissions can&apos;t be edited.
          </span>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-500">
                <th className="sticky left-0 z-10 min-w-[220px] bg-slate-50 px-4 py-3 font-medium dark:bg-slate-800/60">
                  Module / Feature
                </th>
                {permissionActions.map((action) => (
                  <th key={action} className="min-w-[84px] px-2 py-3 text-center font-medium">
                    {actionLabels[action]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissionModules.map((moduleName) => {
                const features = featuresByModule[moduleName];
                if (!features?.length) return null;
                return (
                  <Fragment key={moduleName}>
                    <tr className="bg-slate-50/70 dark:bg-slate-800/30">
                      <td
                        colSpan={permissionActions.length + 1}
                        className="sticky left-0 bg-slate-50/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/30 dark:text-slate-400"
                      >
                        {moduleName}
                      </td>
                    </tr>
                    {features.map((feature) => {
                      const effective = new Set(actionsGrantedFor(roleMap, feature.id));
                      return (
                        <tr key={feature.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                          <td className="sticky left-0 bg-white px-4 py-2.5 dark:bg-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-700 dark:text-slate-200">{feature.label}</span>
                              {feature.sensitive && (
                                <Badge tone="rose" className="px-1.5 py-0.5 text-[10px]">
                                  Sensitive
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 dark:text-slate-500">{feature.description}</p>
                          </td>
                          {permissionActions.map((action) => {
                            const applicable = feature.actions.includes(action);
                            const checked = effective.has(action);
                            return (
                              <td key={action} className="px-2 py-2.5 text-center">
                                {applicable ? (
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={isSuperAdmin}
                                    onChange={() => toggle(feature, action)}
                                    className={cn(
                                      "h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800",
                                      isSuperAdmin && "cursor-not-allowed opacity-60",
                                    )}
                                  />
                                ) : (
                                  <span className="text-slate-200 dark:text-slate-700">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function AccessControlPermissionsPage() {
  return (
    <Suspense fallback={null}>
      <PermissionsMatrix />
    </Suspense>
  );
}

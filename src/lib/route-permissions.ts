import type { PermissionModule } from "@/lib/types";

const routeModuleMap: Array<{ prefix: string; module: PermissionModule }> = [
  { prefix: "/dashboard", module: "Dashboard" },
  { prefix: "/access-control", module: "AccessControl" },
  { prefix: "/sites", module: "Sites" },
  { prefix: "/employees", module: "Employees" },
  { prefix: "/organization", module: "Organization" },
  { prefix: "/attendance", module: "Attendance" },
  { prefix: "/leave", module: "Leave" },
  { prefix: "/payroll", module: "Payroll" },
  { prefix: "/recruitment", module: "Recruitment" },
  { prefix: "/performance", module: "Performance" },
  { prefix: "/training", module: "Training" },
  { prefix: "/assets", module: "Assets" },
  { prefix: "/reports", module: "Reports" },
  { prefix: "/settings", module: "Settings" },
];

/** Maps a pathname to the module that governs page-level access to it. */
export function moduleForPath(pathname: string): PermissionModule | undefined {
  return routeModuleMap.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`))?.module;
}

const moduleLabels: Partial<Record<PermissionModule, string>> = {
  AccessControl: "Access Control",
};

/** Human-friendly display name for a module (most are already one word). */
export function moduleLabel(module: PermissionModule): string {
  return moduleLabels[module] ?? module;
}

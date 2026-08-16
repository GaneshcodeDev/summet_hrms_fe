import {
  LayoutDashboard,
  Network,
  Users,
  CalendarCheck,
  CalendarDays,
  Wallet,
  TrendingUp,
  Briefcase,
  GraduationCap,
  Laptop,
  BarChart3,
  Settings,
  Building2,
  ShieldCheck,
  Database,
  Calendar,
  FolderTree,
  UserPlus,
  UserMinus,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import type { MenuItem } from "@/lib/types";

/** String -> component registry so MenuItem.icon can be stored as plain, admin-editable text. */
export const menuIconRegistry: Record<string, LucideIcon> = {
  LayoutDashboard,
  Network,
  Users,
  CalendarCheck,
  CalendarDays,
  Wallet,
  TrendingUp,
  Briefcase,
  GraduationCap,
  Laptop,
  BarChart3,
  Settings,
  Building2,
  ShieldCheck,
  Database,
  Calendar,
  FolderTree,
  UserPlus,
  UserMinus,
  Receipt,
};

export const menuIconNames = Object.keys(menuIconRegistry);

export function resolveMenuIcon(name: string): LucideIcon {
  return menuIconRegistry[name] ?? FolderTree;
}

/**
 * Seeded 1:1 from the previous static nav-items.ts, all top-level (no
 * submenus, no roleIds override) so the Sidebar renders identically to
 * before until an admin actually edits something in Menu Management.
 */
export const seedMenuItems: MenuItem[] = [
  { id: "menu-dashboard", label: "Dashboard", icon: "LayoutDashboard", href: "/dashboard", parentId: null, order: 1, module: "Dashboard" },
  { id: "menu-sites", label: "Sites", icon: "Building2", href: "/sites", parentId: null, order: 2, module: "Sites" },
  { id: "menu-organization", label: "Organization", icon: "Network", href: "/organization", parentId: null, order: 3, module: "Organization" },
  { id: "menu-masters", label: "Masters", icon: "Database", href: "/masters", parentId: null, order: 4, module: "Masters" },
  { id: "menu-employees", label: "Employees", icon: "Users", href: "/employees", parentId: null, order: 5, module: "Employees" },
  { id: "menu-attendance", label: "Attendance", icon: "CalendarCheck", href: "/attendance", parentId: null, order: 6, module: "Attendance" },
  { id: "menu-leave", label: "Leave", icon: "CalendarDays", href: "/leave", parentId: null, order: 7, module: "Leave" },
  { id: "menu-payroll", label: "Payroll", icon: "Wallet", href: "/payroll", parentId: null, order: 8, module: "Payroll" },
  { id: "menu-expenses", label: "Expenses", icon: "Receipt", href: "/expenses", parentId: null, order: 9, module: "Expenses" },
  { id: "menu-performance", label: "Performance", icon: "TrendingUp", href: "/performance", parentId: null, order: 10, module: "Performance" },
  { id: "menu-recruitment", label: "Recruitment", icon: "Briefcase", href: "/recruitment", parentId: null, order: 11, module: "Recruitment" },
  { id: "menu-onboarding", label: "Onboarding", icon: "UserPlus", href: "/onboarding", parentId: null, order: 12, module: "Onboarding" },
  { id: "menu-offboarding", label: "Offboarding", icon: "UserMinus", href: "/offboarding", parentId: null, order: 13, module: "Offboarding" },
  { id: "menu-training", label: "Training", icon: "GraduationCap", href: "/training", parentId: null, order: 14, module: "Training" },
  { id: "menu-assets", label: "Assets", icon: "Laptop", href: "/assets", parentId: null, order: 15, module: "Assets" },
  { id: "menu-reports", label: "Reports", icon: "BarChart3", href: "/reports", parentId: null, order: 16, module: "Reports" },
  { id: "menu-events", label: "Events", icon: "Calendar", href: "/events", parentId: null, order: 17, module: "Events" },
  { id: "menu-access-control", label: "Access Control", icon: "ShieldCheck", href: "/access-control", parentId: null, order: 18, module: "AccessControl" },
  { id: "menu-settings", label: "Settings", icon: "Settings", href: "/settings", parentId: null, order: 19, module: "Settings" },
];

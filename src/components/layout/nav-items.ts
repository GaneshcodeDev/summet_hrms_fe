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
  type LucideIcon,
} from "lucide-react";
import type { PermissionModule } from "@/lib/types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** The module that governs this item's visibility — hidden unless the signed-in role can view it. */
  module: PermissionModule;
}

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, module: "Dashboard" },
  { label: "Sites", href: "/sites", icon: Building2, module: "Sites" },
  { label: "Organization", href: "/organization", icon: Network, module: "Organization" },
  { label: "Employees", href: "/employees", icon: Users, module: "Employees" },
  { label: "Attendance", href: "/attendance", icon: CalendarCheck, module: "Attendance" },
  { label: "Leave", href: "/leave", icon: CalendarDays, module: "Leave" },
  { label: "Payroll", href: "/payroll", icon: Wallet, module: "Payroll" },
  { label: "Performance", href: "/performance", icon: TrendingUp, module: "Performance" },
  { label: "Recruitment", href: "/recruitment", icon: Briefcase, module: "Recruitment" },
  { label: "Training", href: "/training", icon: GraduationCap, module: "Training" },
  { label: "Assets", href: "/assets", icon: Laptop, module: "Assets" },
  { label: "Reports", href: "/reports", icon: BarChart3, module: "Reports" },
  { label: "Access Control", href: "/access-control", icon: ShieldCheck, module: "AccessControl" },
  { label: "Settings", href: "/settings", icon: Settings, module: "Settings" },
];

import type {
  DeviceSession,
  PermissionAction,
  PermissionFeature,
  Role,
  RolePermissionMap,
  SecurityEvent,
  UserAccount,
} from "@/lib/types";
import { employees } from "@/lib/mock-data";

/**
 * Demo-only password store. There is no backend in this project (see
 * AGENTS.md — the whole app runs on mock/localStorage data), so this
 * obfuscates rather than cryptographically hashes. A real deployment must
 * verify credentials and issue sessions server-side, never in client JS.
 */
export const DEMO_PASSWORD = "Password@123";

export function hashPassword(password: string): string {
  return `mock$${btoa(unescape(encodeURIComponent(password)))}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/* ------------------------------------------------------------------ */
/* Feature catalog: Module -> Feature -> supported Actions             */
/* ------------------------------------------------------------------ */

export const featureCatalog: PermissionFeature[] = [
  { id: "dashboard.overview", module: "Dashboard", label: "Overview", description: "Company-wide KPIs and widgets", actions: ["view"] },

  { id: "access-control.users", module: "AccessControl", label: "User Management", description: "Create accounts, assign roles, activate/deactivate", actions: ["view", "create", "edit", "delete", "manage"] },
  { id: "access-control.roles", module: "AccessControl", label: "Role Management", description: "Define configurable roles", actions: ["view", "create", "edit", "delete", "manage"] },
  { id: "access-control.permissions", module: "AccessControl", label: "Permission Matrix", description: "Grant module/feature/action permissions to roles", actions: ["view", "edit", "manage"] },
  { id: "access-control.security", module: "AccessControl", label: "Security & Audit Log", description: "Login activity, lockouts, unlock accounts", actions: ["view", "export", "manage"] },

  { id: "sites.tenants", module: "Sites", label: "Tenant Sites", description: "Onboard and manage tenant sites", actions: ["view", "create", "edit", "delete", "manage"] },

  { id: "employees.directory", module: "Employees", label: "Employee Directory", description: "Employee records", actions: ["view", "create", "edit", "delete", "export", "import", "manage"] },
  { id: "employees.documents", module: "Employees", label: "Employee Documents", description: "ID proofs, offer/relieving letters", actions: ["view", "edit", "manage"] },

  { id: "organization.structure", module: "Organization", label: "Org Structure", description: "Company hierarchy, org chart and reporting structure", actions: ["view", "create", "edit", "delete", "manage"] },

  { id: "masters.records", module: "Masters", label: "Master Data", description: "Configurable reference data shared across every module", actions: ["view", "create", "edit", "export", "import", "manage"] },

  { id: "attendance.records", module: "Attendance", label: "Attendance Records", description: "Daily attendance and reports", actions: ["view", "create", "edit", "export", "manage"] },

  { id: "leave.requests", module: "Leave", label: "Leave Requests", description: "Apply for and approve leave", actions: ["view", "create", "edit", "approve", "reject", "manage"] },

  { id: "payroll.payslips", module: "Payroll", label: "Payslips", description: "Monthly payslips", actions: ["view", "export", "manage"], sensitive: true },
  { id: "payroll.salary", module: "Payroll", label: "Salary Structure", description: "CTC, earnings and deductions", actions: ["view", "edit", "manage"], sensitive: true },
  { id: "payroll.bank", module: "Payroll", label: "Bank Details", description: "Bank account and PAN/UAN", actions: ["view", "edit", "manage"], sensitive: true },

  { id: "recruitment.openings", module: "Recruitment", label: "Job Openings", description: "Requisitions and applicants", actions: ["view", "create", "edit", "delete", "manage"] },

  { id: "performance.reviews", module: "Performance", label: "Performance Reviews", description: "Review cycles and ratings", actions: ["view", "create", "edit", "approve", "manage"] },

  { id: "training.programs", module: "Training", label: "Training Programs", description: "Enrollment and schedules", actions: ["view", "create", "edit", "delete", "manage"] },

  { id: "assets.inventory", module: "Assets", label: "Asset Inventory", description: "Company asset assignment", actions: ["view", "create", "edit", "delete", "manage"] },

  { id: "reports.analytics", module: "Reports", label: "Reports & Analytics", description: "Cross-module reporting", actions: ["view", "export", "manage"] },

  { id: "settings.organization", module: "Settings", label: "Organization Settings", description: "General, localization, integrations", actions: ["view", "edit", "manage"] },
];

export const featuresByModule = featureCatalog.reduce<Record<string, PermissionFeature[]>>((acc, f) => {
  (acc[f.module] ??= []).push(f);
  return acc;
}, {});

function grant(...featureIds: string[]): RolePermissionMap {
  return Object.fromEntries(featureIds.map((id) => [id, ["manage"] as PermissionAction[]]));
}

function grantActions(map: Record<string, PermissionAction[]>): RolePermissionMap {
  return map;
}

const ALL_FEATURE_IDS = featureCatalog.map((f) => f.id);

/* ------------------------------------------------------------------ */
/* Configurable roles (seed data — editable at runtime via the Roles UI) */
/* ------------------------------------------------------------------ */

export const seedRoles: Role[] = [
  { id: "role-super-admin", name: "Super Admin", description: "Full platform access across every tenant site.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
  { id: "role-hr-admin", name: "HR Admin", description: "Manages HR configuration, employees and access across the org.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
  { id: "role-hr-manager", name: "HR Manager", description: "Runs day-to-day HR operations: employees, attendance, leave, recruitment.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
  { id: "role-payroll-admin", name: "Payroll Admin", description: "Owns payroll processing and payslip distribution.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
  { id: "role-finance", name: "Finance", description: "Views payroll costs and financial reports.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
  { id: "role-department-head", name: "Department Head", description: "Oversees a department's people, leave and performance.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
  { id: "role-manager", name: "Manager", description: "Manages a direct-reporting team.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
  { id: "role-employee", name: "Employee", description: "Self-service access to own profile, attendance and leave.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
  { id: "role-auditor", name: "Auditor", description: "Read-only access across modules for compliance review.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
];

export const seedRolePermissions: Record<string, RolePermissionMap> = {
  "role-super-admin": grant(...ALL_FEATURE_IDS),

  "role-hr-admin": {
    ...grant(
      "employees.directory",
      "employees.documents",
      "organization.structure",
      "masters.records",
      "attendance.records",
      "recruitment.openings",
      "performance.reviews",
      "training.programs",
      "access-control.users",
    ),
    ...grantActions({
      "dashboard.overview": ["view"],
      "leave.requests": ["view", "edit", "approve", "reject"],
      "payroll.payslips": ["view", "export"],
      "assets.inventory": ["view", "edit"],
      "reports.analytics": ["view", "export"],
      "settings.organization": ["view", "edit"],
      "access-control.roles": ["view"],
      "access-control.permissions": ["view"],
      "access-control.security": ["view"],
    }),
  },

  "role-hr-manager": grantActions({
    "dashboard.overview": ["view"],
    "employees.directory": ["view", "create", "edit", "export"],
    "employees.documents": ["view", "edit"],
    "organization.structure": ["view", "edit"],
    "masters.records": ["view", "edit"],
    "attendance.records": ["view", "edit", "export"],
    "leave.requests": ["view", "edit", "approve", "reject"],
    "payroll.payslips": ["view"],
    "recruitment.openings": ["view", "create", "edit"],
    "performance.reviews": ["view", "create", "edit"],
    "training.programs": ["view", "create", "edit"],
    "reports.analytics": ["view", "export"],
  }),

  "role-payroll-admin": grantActions({
    "dashboard.overview": ["view"],
    "employees.directory": ["view"],
    "masters.records": ["view", "edit"],
    "payroll.payslips": ["view", "export", "manage"],
    "payroll.salary": ["view", "edit", "manage"],
    "payroll.bank": ["view", "edit", "manage"],
    "reports.analytics": ["view", "export"],
  }),

  "role-finance": grantActions({
    "dashboard.overview": ["view"],
    "attendance.records": ["view"],
    "leave.requests": ["view"],
    "payroll.payslips": ["view", "export"],
    "payroll.salary": ["view"],
    "reports.analytics": ["view", "export"],
  }),

  "role-department-head": grantActions({
    "dashboard.overview": ["view"],
    "employees.directory": ["view"],
    "organization.structure": ["view"],
    "attendance.records": ["view", "edit"],
    "leave.requests": ["view", "approve", "reject"],
    "performance.reviews": ["view", "create", "edit", "approve"],
    "reports.analytics": ["view"],
  }),

  "role-manager": grantActions({
    "dashboard.overview": ["view"],
    "employees.directory": ["view"],
    "attendance.records": ["view"],
    "leave.requests": ["view", "approve", "reject"],
    "performance.reviews": ["view", "edit"],
  }),

  "role-employee": grantActions({
    "dashboard.overview": ["view"],
    "employees.directory": ["view"],
    "organization.structure": ["view"],
    "attendance.records": ["view", "create"],
    "leave.requests": ["view", "create"],
    "performance.reviews": ["view"],
    "training.programs": ["view"],
  }),

  "role-auditor": grantActions({
    "dashboard.overview": ["view"],
    "employees.directory": ["view"],
    "masters.records": ["view"],
    "attendance.records": ["view"],
    "leave.requests": ["view"],
    "payroll.payslips": ["view"],
    "recruitment.openings": ["view"],
    "performance.reviews": ["view"],
    "reports.analytics": ["view", "export"],
    "access-control.security": ["view", "export"],
  }),
};

/* ------------------------------------------------------------------ */
/* Seed user accounts — one per existing mock employee                 */
/* ------------------------------------------------------------------ */

const roleByEmployeeId: Record<string, string> = {
  EMP001: "role-super-admin",
  EMP002: "role-employee",
  EMP003: "role-department-head",
  EMP004: "role-hr-manager",
  EMP005: "role-hr-admin",
  EMP006: "role-manager",
  EMP007: "role-finance",
  EMP008: "role-employee",
  EMP009: "role-employee",
  EMP010: "role-payroll-admin",
};

export const seedUserAccounts: UserAccount[] = employees.map((emp, i) => ({
  id: `account-${emp.employeeId}`,
  employeeId: emp.employeeId,
  name: emp.name,
  email: emp.email,
  roleIds: [roleByEmployeeId[emp.employeeId] ?? "role-employee"],
  status: emp.status,
  siteIds: emp.employeeId === "EMP001" ? ["site-1", "site-2", "site-3", "site-4"] : (emp.siteIds ?? [emp.siteId]),
  passwordHash: hashPassword(DEMO_PASSWORD),
  failedLoginAttempts: 0,
  lastLogin: i < 6 ? new Date(Date.now() - (i + 1) * 36e5 * 7).toISOString() : undefined,
  createdOn: emp.dateOfJoining,
}));

export const seedDeviceSessions: DeviceSession[] = [
  {
    id: "session-seed-1",
    accountId: "account-EMP001",
    device: "MacBook Pro · macOS",
    browser: "Chrome 128",
    location: "Noida, India",
    ip: "203.0.113.42",
    createdAt: new Date(Date.now() - 6 * 24 * 3600e3).toISOString(),
    lastActiveAt: new Date(Date.now() - 2 * 3600e3).toISOString(),
    remember: true,
  },
  {
    id: "session-seed-2",
    accountId: "account-EMP001",
    device: "iPhone 15 · iOS",
    browser: "Safari Mobile",
    location: "Noida, India",
    ip: "203.0.113.87",
    createdAt: new Date(Date.now() - 2 * 24 * 3600e3).toISOString(),
    lastActiveAt: new Date(Date.now() - 20 * 60e3).toISOString(),
    remember: false,
  },
];

export const seedSecurityEvents: SecurityEvent[] = [
  {
    id: "evt-1",
    type: "login_success",
    accountId: "account-EMP001",
    actorName: "Ganesh Pandey",
    detail: "Signed in successfully",
    ip: "203.0.113.42",
    timestamp: new Date(Date.now() - 2 * 3600e3).toISOString(),
  },
  {
    id: "evt-2",
    type: "login_failed",
    accountId: "account-EMP008",
    actorName: "Rahul Mehta",
    detail: "Invalid password (attempt 1 of 5)",
    ip: "198.51.100.23",
    timestamp: new Date(Date.now() - 26 * 3600e3).toISOString(),
  },
  {
    id: "evt-3",
    type: "role_permissions_updated",
    actorName: "Ganesh Pandey",
    detail: "Updated permissions for role 'HR Manager'",
    ip: "203.0.113.42",
    timestamp: new Date(Date.now() - 3 * 24 * 3600e3).toISOString(),
  },
  {
    id: "evt-4",
    type: "password_changed",
    accountId: "account-EMP004",
    actorName: "Neha Verma",
    detail: "Password changed by user",
    ip: "203.0.113.19",
    timestamp: new Date(Date.now() - 9 * 24 * 3600e3).toISOString(),
  },
];

/** `manage` on a feature implies every other action on that feature. */
export function actionsGrantedFor(map: RolePermissionMap | undefined, featureId: string): PermissionAction[] {
  const granted = map?.[featureId];
  if (!granted) return [];
  if (granted.includes("manage")) {
    const feature = featureCatalog.find((f) => f.id === featureId);
    return feature ? feature.actions : granted;
  }
  return granted;
}

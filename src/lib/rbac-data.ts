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
  { id: "access-control.menu", module: "AccessControl", label: "Menu Management", description: "Sidebar menus/submenus and which roles see them", actions: ["view", "create", "edit", "delete", "manage"] },

  { id: "sites.tenants", module: "Sites", label: "Tenant Sites", description: "Onboard and manage tenant sites", actions: ["view", "create", "edit", "delete", "manage"] },

  { id: "employees.directory", module: "Employees", label: "Employee Directory", description: "Employee records", actions: ["view", "create", "edit", "delete", "export", "import", "manage"] },
  { id: "employees.documents", module: "Employees", label: "Employee Documents", description: "ID proofs, offer/relieving letters", actions: ["view", "edit", "manage"] },
  { id: "employees.lifecycle", module: "Employees", label: "Employee Lifecycle", description: "Confirmation, transfer, promotion, manager and shift changes", actions: ["view", "create", "edit", "manage"], sensitive: true },
  { id: "employees.skills", module: "Employees", label: "Employee Skills", description: "Skill records, levels and assessments", actions: ["view", "create", "edit", "manage"] },

  { id: "onboarding.cases", module: "Onboarding", label: "Onboarding Cases", description: "Pre-boarding checklist, document collection and e-signature for new joiners", actions: ["view", "create", "edit", "manage"] },

  { id: "offboarding.cases", module: "Offboarding", label: "Separation Cases", description: "Resignation/termination workflow, clearance, exit interview and full & final settlement", actions: ["view", "create", "edit", "approve", "reject", "manage"], sensitive: true },

  { id: "organization.structure", module: "Organization", label: "Org Structure", description: "Company hierarchy, org chart and reporting structure", actions: ["view", "create", "edit", "delete", "manage"] },
  { id: "organization.site-mapping", module: "Organization", label: "Employee Site Mapping", description: "Map employees to a Cost Center / Profit Center", actions: ["view", "edit", "manage"] },

  { id: "masters.records", module: "Masters", label: "Master Data", description: "Configurable reference data shared across every module", actions: ["view", "create", "edit", "export", "import", "manage"] },

  { id: "attendance.records", module: "Attendance", label: "Attendance Records", description: "Daily attendance and reports", actions: ["view", "create", "edit", "approve", "reject", "export", "manage"] },

  { id: "leave.requests", module: "Leave", label: "Leave Requests", description: "Apply for and approve leave", actions: ["view", "create", "edit", "approve", "reject", "manage"] },

  { id: "payroll.payslips", module: "Payroll", label: "Payslips", description: "Monthly payslips", actions: ["view", "export", "manage"], sensitive: true },
  { id: "payroll.salary", module: "Payroll", label: "Salary Structure", description: "CTC, earnings and deductions", actions: ["view", "edit", "manage"], sensitive: true },
  { id: "payroll.bank", module: "Payroll", label: "Bank Details", description: "Bank account and PAN/UAN", actions: ["view", "edit", "manage"], sensitive: true },
  { id: "payroll.loans", module: "Payroll", label: "Employee Loans", description: "Salary advances and loan repayments", actions: ["view", "create", "approve", "reject", "manage"], sensitive: true },
  { id: "payroll.tax", module: "Payroll", label: "Tax Declarations", description: "Investment declarations and regime selection", actions: ["view", "create", "edit", "manage"], sensitive: true },

  { id: "expenses.claims", module: "Expenses", label: "Expense Claims", description: "Expense claims and reimbursements", actions: ["view", "create", "edit", "approve", "reject", "manage"] },
  { id: "expenses.travel", module: "Expenses", label: "Travel Requests", description: "Pre-trip travel approval", actions: ["view", "create", "approve", "reject", "manage"] },

  { id: "recruitment.requisitions", module: "Recruitment", label: "Job Requisitions", description: "Manpower requests and their approval", actions: ["view", "create", "edit", "approve", "reject", "manage"] },
  { id: "recruitment.openings", module: "Recruitment", label: "Job Openings", description: "Postings created from an approved requisition (or directly)", actions: ["view", "create", "edit", "delete", "manage"] },
  { id: "recruitment.pipeline", module: "Recruitment", label: "Hiring Pipeline", description: "Candidates, applications, interviews and offers", actions: ["view", "create", "edit", "manage"] },

  { id: "performance.cycles", module: "Performance", label: "Performance Cycles", description: "Create and run review cycles (site-scoped)", actions: ["view", "create", "edit", "manage"] },
  { id: "performance.reviews", module: "Performance", label: "Goals & Reviews", description: "Goal assignment, self/manager/HR review stages and ratings", actions: ["view", "create", "edit", "approve", "manage"] },
  { id: "performance.appraisal", module: "Performance", label: "Appraisal Decisions", description: "Final rating, salary revision and promotion recommendations arising from a review cycle", actions: ["view", "create", "approve", "reject", "manage"], sensitive: true },

  { id: "training.programs", module: "Training", label: "Training Programs", description: "Programs, sessions, enrollment, attendance and assessment", actions: ["view", "create", "edit", "delete", "manage"] },
  { id: "training.requests", module: "Training", label: "Training Requests", description: "Employee-initiated training requests and their approval", actions: ["view", "create", "approve", "reject", "manage"] },

  { id: "assets.inventory", module: "Assets", label: "Asset Inventory", description: "Asset records, assignment, return, transfer, maintenance and disposal", actions: ["view", "create", "edit", "delete", "manage"] },
  { id: "assets.requests", module: "Assets", label: "Asset Requests", description: "Employee-initiated asset requests and their approval", actions: ["view", "create", "approve", "reject", "manage"] },

  { id: "reports.analytics", module: "Reports", label: "Reports & Analytics", description: "Cross-module reporting", actions: ["view", "export", "manage"] },

  { id: "events.calendar", module: "Events", label: "Company Events", description: "Meetings, training, holidays and announcements", actions: ["view", "create", "edit", "delete", "manage"] },

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
  { id: "role-site-admin", name: "Site Admin", description: "Full administrative access within their own site only — cannot see or switch to other sites.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
  { id: "role-hr-admin", name: "HR Admin", description: "Manages HR configuration, employees and access across the org.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
  { id: "role-hr-manager", name: "HR Manager", description: "Runs day-to-day HR operations: employees, attendance, leave, recruitment.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
  { id: "role-payroll-admin", name: "Payroll Admin", description: "Owns payroll processing and payslip distribution.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
  { id: "role-finance", name: "Finance", description: "Views payroll costs and financial reports.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
  { id: "role-department-head", name: "Department Head", description: "Oversees a department's people, leave and performance.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
  { id: "role-manager", name: "Manager", description: "Manages a direct-reporting team.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
  { id: "role-recruiter", name: "Recruiter", description: "Runs the hiring pipeline: openings, candidates, interviews and offers. No payroll or employee salary/bank access.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
  { id: "role-hiring-manager", name: "Hiring Manager", description: "Raises and approves requisitions for their own team; views candidates and interviews for their open roles.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
  { id: "role-employee", name: "Employee", description: "Self-service access to own profile, attendance and leave.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
  { id: "role-auditor", name: "Auditor", description: "Read-only access across modules for compliance review.", isSystem: true, status: "Active", createdOn: "2018-01-10" },
];

export const seedRolePermissions: Record<string, RolePermissionMap> = {
  "role-super-admin": grant(...ALL_FEATURE_IDS),

  // Full control within their own site — everything Super Admin has except
  // platform-wide concerns (Sites/tenant management, role & permission
  // definitions, global org settings). Site scoping itself is enforced by
  // the Site Context data layer, not by this permission map.
  "role-site-admin": {
    ...grant(
      "employees.directory",
      "employees.documents",
      "employees.lifecycle",
      "employees.skills",
      "organization.structure",
      "organization.site-mapping",
      "masters.records",
      "attendance.records",
      "leave.requests",
      "payroll.payslips",
      "payroll.salary",
      "payroll.bank",
      "payroll.loans",
      "payroll.tax",
      "onboarding.cases",
      "offboarding.cases",
      "recruitment.requisitions",
      "recruitment.openings",
      "recruitment.pipeline",
      "performance.cycles",
      "performance.reviews",
      "performance.appraisal",
      "training.programs",
      "training.requests",
      "assets.inventory",
      "assets.requests",
      "expenses.claims",
      "expenses.travel",
      "access-control.users",
      "events.calendar",
    ),
    ...grantActions({
      "dashboard.overview": ["view"],
      "reports.analytics": ["view", "export"],
      "access-control.menu": ["view"],
      "access-control.security": ["view"],
    }),
  },

  "role-hr-admin": {
    ...grant(
      "employees.directory",
      "employees.documents",
      "employees.lifecycle",
      "employees.skills",
      "organization.structure",
      "masters.records",
      "attendance.records",
      "recruitment.requisitions",
      "recruitment.openings",
      "recruitment.pipeline",
      "performance.cycles",
      "performance.reviews",
      "performance.appraisal",
      "training.programs",
      "training.requests",
      "assets.inventory",
      "assets.requests",
      "access-control.users",
      "onboarding.cases",
      "offboarding.cases",
    ),
    ...grantActions({
      "dashboard.overview": ["view"],
      "leave.requests": ["view", "edit", "approve", "reject"],
      "payroll.payslips": ["view", "export"],
      "payroll.loans": ["view", "approve", "reject"],
      "payroll.tax": ["view", "edit"],
      "expenses.claims": ["view", "create", "approve", "reject"],
      "expenses.travel": ["view", "create", "approve", "reject"],
      "reports.analytics": ["view", "export"],
      "settings.organization": ["view", "edit"],
      "access-control.roles": ["view"],
      "access-control.permissions": ["view"],
      "access-control.security": ["view"],
      "access-control.menu": ["view", "edit"],
      "organization.site-mapping": ["view", "edit"],
      "events.calendar": ["view", "create", "edit", "delete"],
    }),
  },

  "role-hr-manager": grantActions({
    "dashboard.overview": ["view"],
    "employees.directory": ["view", "create", "edit", "export"],
    "employees.documents": ["view", "edit"],
    "employees.lifecycle": ["view", "create", "edit"],
    "employees.skills": ["view", "create", "edit"],
    "organization.structure": ["view", "edit"],
    "masters.records": ["view", "edit"],
    "attendance.records": ["view", "edit", "approve", "reject", "export"],
    "leave.requests": ["view", "edit", "approve", "reject"],
    "payroll.payslips": ["view"],
    "onboarding.cases": ["view", "create", "edit"],
    "offboarding.cases": ["view", "create", "edit"],
    "recruitment.requisitions": ["view", "create", "edit", "approve", "reject"],
    "recruitment.openings": ["view", "create", "edit"],
    "recruitment.pipeline": ["view", "create", "edit"],
    "performance.cycles": ["view", "create", "edit"],
    "performance.reviews": ["view", "create", "edit", "approve"],
    "performance.appraisal": ["view", "create"],
    "training.programs": ["view", "create", "edit"],
    "training.requests": ["view", "create", "edit", "approve", "reject"],
    "assets.inventory": ["view", "create", "edit"],
    "assets.requests": ["view", "approve", "reject"],
    "expenses.claims": ["view", "create", "approve", "reject"],
    "expenses.travel": ["view", "create", "approve", "reject"],
    "reports.analytics": ["view", "export"],
    "organization.site-mapping": ["view", "edit"],
    "events.calendar": ["view", "create", "edit"],
  }),

  "role-payroll-admin": grantActions({
    "dashboard.overview": ["view"],
    "employees.directory": ["view"],
    "masters.records": ["view", "edit"],
    "payroll.payslips": ["view", "export", "manage"],
    "payroll.salary": ["view", "edit", "manage"],
    "payroll.bank": ["view", "edit", "manage"],
    "payroll.loans": ["view", "approve", "reject", "manage"],
    "payroll.tax": ["view", "edit", "manage"],
    "offboarding.cases": ["view", "edit", "manage"],
    "reports.analytics": ["view", "export"],
  }),

  "role-finance": grantActions({
    "dashboard.overview": ["view"],
    "attendance.records": ["view"],
    "leave.requests": ["view"],
    "payroll.payslips": ["view", "export"],
    "payroll.salary": ["view"],
    "payroll.loans": ["view"],
    "payroll.tax": ["view"],
    "offboarding.cases": ["view"],
    "expenses.claims": ["view", "create", "approve", "reject", "manage"],
    "expenses.travel": ["view", "create", "approve"],
    "reports.analytics": ["view", "export"],
  }),

  "role-department-head": grantActions({
    "dashboard.overview": ["view"],
    "employees.directory": ["view"],
    "employees.lifecycle": ["view"],
    "employees.skills": ["view", "edit"],
    "organization.structure": ["view"],
    "attendance.records": ["view", "edit", "approve", "reject"],
    "leave.requests": ["view", "approve", "reject"],
    "onboarding.cases": ["view", "edit"],
    "offboarding.cases": ["view"],
    "recruitment.requisitions": ["view", "create", "approve"],
    "recruitment.pipeline": ["view"],
    "expenses.claims": ["view", "create", "approve", "reject"],
    "expenses.travel": ["view", "create", "approve", "reject"],
    "performance.cycles": ["view"],
    "performance.reviews": ["view", "create", "edit", "approve"],
    "training.programs": ["view"],
    "training.requests": ["view", "approve", "reject"],
    "assets.inventory": ["view"],
    "assets.requests": ["view", "approve", "reject"],
    "reports.analytics": ["view"],
    "events.calendar": ["view"],
  }),

  "role-manager": grantActions({
    "dashboard.overview": ["view"],
    "employees.directory": ["view"],
    "employees.lifecycle": ["view"],
    "employees.skills": ["view", "edit"],
    "attendance.records": ["view", "approve", "reject"],
    "leave.requests": ["view", "approve", "reject"],
    "onboarding.cases": ["view", "edit"],
    "offboarding.cases": ["view"],
    "recruitment.requisitions": ["view", "create", "approve"],
    "recruitment.pipeline": ["view"],
    "expenses.claims": ["view", "create", "approve", "reject"],
    "expenses.travel": ["view", "create", "approve", "reject"],
    "performance.cycles": ["view"],
    "performance.reviews": ["view", "edit"],
    "training.programs": ["view"],
    "training.requests": ["view", "approve", "reject"],
    "assets.inventory": ["view"],
    "assets.requests": ["view", "approve", "reject"],
    "reports.analytics": ["view"],
    "events.calendar": ["view"],
  }),

  "role-recruiter": grantActions({
    "dashboard.overview": ["view"],
    "employees.directory": ["view"],
    "organization.structure": ["view"],
    "recruitment.requisitions": ["view", "create"],
    "recruitment.openings": ["view", "create", "edit", "manage"],
    "recruitment.pipeline": ["view", "create", "edit", "manage"],
    "onboarding.cases": ["view", "create"],
    "expenses.claims": ["view", "create"],
    "expenses.travel": ["view", "create"],
    "reports.analytics": ["view"],
    "events.calendar": ["view"],
  }),

  "role-hiring-manager": grantActions({
    "dashboard.overview": ["view"],
    "employees.directory": ["view"],
    "recruitment.requisitions": ["view", "create", "approve"],
    "recruitment.pipeline": ["view"],
    "onboarding.cases": ["view"],
    "expenses.claims": ["view", "create"],
    "expenses.travel": ["view", "create"],
    "reports.analytics": ["view"],
    "events.calendar": ["view"],
  }),

  "role-employee": grantActions({
    "dashboard.overview": ["view"],
    "employees.directory": ["view"],
    "organization.structure": ["view"],
    "attendance.records": ["view", "create"],
    "leave.requests": ["view", "create"],
    "onboarding.cases": ["view"],
    "offboarding.cases": ["view", "create"],
    "payroll.loans": ["view", "create"],
    "payroll.tax": ["view", "create", "edit"],
    "expenses.claims": ["view", "create"],
    "expenses.travel": ["view", "create"],
    "performance.reviews": ["view", "create", "edit"],
    "employees.skills": ["view"],
    "training.programs": ["view"],
    "training.requests": ["view", "create"],
    "assets.inventory": ["view"],
    "assets.requests": ["view", "create"],
    "reports.analytics": ["view"],
    "events.calendar": ["view"],
  }),

  "role-auditor": grantActions({
    "dashboard.overview": ["view"],
    "employees.directory": ["view"],
    "employees.lifecycle": ["view"],
    "employees.skills": ["view"],
    "masters.records": ["view"],
    "attendance.records": ["view"],
    "leave.requests": ["view"],
    "payroll.payslips": ["view"],
    "payroll.loans": ["view"],
    "payroll.tax": ["view"],
    "onboarding.cases": ["view"],
    "offboarding.cases": ["view"],
    "expenses.claims": ["view"],
    "expenses.travel": ["view"],
    "recruitment.requisitions": ["view"],
    "recruitment.openings": ["view"],
    "recruitment.pipeline": ["view"],
    "performance.cycles": ["view"],
    "performance.reviews": ["view"],
    "performance.appraisal": ["view"],
    "training.programs": ["view"],
    "training.requests": ["view"],
    "assets.inventory": ["view"],
    "assets.requests": ["view"],
    "reports.analytics": ["view", "export"],
    "organization.site-mapping": ["view"],
    "events.calendar": ["view"],
    "access-control.menu": ["view"],
    "access-control.security": ["view", "export"],
  }),
};

/* ------------------------------------------------------------------ */
/* Accounts                                                             */
/*                                                                       */
/* The platform always starts with exactly one account: the Super       */
/* Admin. It intentionally has a stable id (not derived from an         */
/* employee) so the current session survives loading/clearing demo      */
/* data. Demo accounts (one per seed employee, including a richer       */
/* EMP001 identity) are a separate, opt-in dataset — see demo-seed.ts.  */
/* ------------------------------------------------------------------ */

export const SUPER_ADMIN_ACCOUNT_ID = "account-superadmin";

export const superAdminAccount: UserAccount = {
  id: SUPER_ADMIN_ACCOUNT_ID,
  // Deliberately not "EMP001": the empty-state employee store starts blank,
  // so the very first real employee ever created would also be auto-numbered
  // EMP001 — colliding with this account's employeeId and silently blocking
  // that person's own account creation (accounts must have a unique
  // employeeId). This sentinel can never collide with an auto-generated
  // EMP### code. Demo mode replaces this account wholesale (see
  // demoUserAccounts below) with a real EMP001-linked identity.
  employeeId: "SUPERADMIN",
  name: "Ganesh Pandey",
  email: "ganesh.pandey@company.com",
  roleIds: ["role-super-admin"],
  status: "Active",
  siteIds: [],
  passwordHash: hashPassword(DEMO_PASSWORD),
  failedLoginAttempts: 0,
  createdOn: "2018-01-10",
};

export const BACKEND_BRIDGE_ACCOUNT_ID = "account-backend-bridge";

/**
 * Phase 18B: logging in tries the real backend (summet_hrms_be) first and
 * falls through to this local mock system on failure (see lib/auth.ts).
 * Almost no local demo account exists as a real backend User — seeding
 * demo/business data into the backend is explicitly out of scope — so this
 * one extra default account exists purely so the bridging path is actually
 * exercisable out of the box: its email/password match the platform Super
 * Admin seeded by `summet_hrms_be`'s `prisma/seed.ts` (see that repo's
 * README), so signing in with these credentials succeeds on BOTH sides —
 * real Sites/Organization/Masters data from the API, everything else
 * (Employees, Attendance, ...) from local mock data as always.
 */
export const backendBridgeAccount: UserAccount = {
  id: BACKEND_BRIDGE_ACCOUNT_ID,
  employeeId: "BACKENDBRIDGE",
  name: "Platform Super Admin",
  email: "superadmin@summet-hrms.dev",
  roleIds: ["role-super-admin"],
  status: "Active",
  siteIds: [],
  passwordHash: hashPassword("ChangeMe@123"),
  failedLoginAttempts: 0,
  createdOn: "2018-01-10",
};

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

/** Demo-only accounts, one per seed employee — loaded via "Load Demo Data", never on a normal empty start. */
export const demoUserAccounts: UserAccount[] = employees.map((emp, i) => ({
  // EMP001's demo account reuses the stable Super Admin id, so a session
  // started before "Load Demo Data" is clicked stays valid afterward.
  id: emp.employeeId === "EMP001" ? SUPER_ADMIN_ACCOUNT_ID : `account-${emp.employeeId}`,
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
    accountId: SUPER_ADMIN_ACCOUNT_ID,
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
    accountId: SUPER_ADMIN_ACCOUNT_ID,
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
    accountId: SUPER_ADMIN_ACCOUNT_ID,
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

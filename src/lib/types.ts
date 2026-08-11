export type EmployeeStatus = "Active" | "Inactive";

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  status: EmployeeStatus;
  reportingTo?: string;
  location: string;
  dateOfJoining: string;
  skills?: string[];
  education?: { degree: string; school: string; years: string }[];
  siteId: string;
  /** Additional sites this employee is mapped to and can switch between, beyond their home siteId. */
  siteIds?: string[];
  /**
   * Structural associations into the Organization module's unit hierarchy
   * (see OrgUnit in this file). Optional and additive — existing display
   * fields (`department`, `location`, `reportingTo`) keep working unchanged
   * for employees that haven't been mapped into the new structure yet.
   */
  reportingManagerId?: string;
  companyId?: string;
  businessUnitId?: string;
  departmentId?: string;
  locationId?: string;
  plantId?: string;
  costCenterId?: string;
}

export type SiteStatus = "Active" | "Trial" | "Suspended";
export type PackagePlan = "Starter" | "Professional" | "Enterprise";

export interface Site {
  id: string;
  name: string;
  code: string;
  logoColor: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  package: PackagePlan;
  status: SiteStatus;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  createdOn: string;
}


export interface Department {
  id: string;
  name: string;
  code: string;
  head: string;
  employeeCount: number;
  status: "Active" | "Inactive";
  siteId: string;
}

export interface Designation {
  id: string;
  name: string;
  department: string;
  grade: string;
  employeeCount: number;
  status: "Active" | "Inactive";
  siteId: string;
}

/* ------------------------------------------------------------------ */
/* Organization structure (Company -> ... -> Profit Center)            */
/* ------------------------------------------------------------------ */

export const orgUnitTypes = [
  "Company",
  "BusinessUnit",
  "Division",
  "Department",
  "SubDepartment",
  "Branch",
  "Plant",
  "Location",
  "CostCenter",
  "ProfitCenter",
] as const;

export type OrgUnitType = (typeof orgUnitTypes)[number];

/** Only meaningful when `type === "Location"` — Location nests Block > Building > Floor > Location. */
export const locationKinds = ["Block", "Building", "Floor", "Location"] as const;
export type LocationKind = (typeof locationKinds)[number];

export interface OrgUnit {
  id: string;
  type: OrgUnitType;
  name: string;
  code: string;
  /** null only for a root Company. */
  parentId: string | null;
  /** Tenant scoping, same Site model used across the rest of the app. */
  siteId: string;
  headEmployeeId?: string;
  status: "Active" | "Inactive";
  description?: string;
  locationKind?: LocationKind;
  createdOn: string;
  updatedOn: string;
}

export type OrgAuditAction = "created" | "updated" | "activated" | "deactivated";

export interface OrgAuditEntry {
  id: string;
  orgUnitId: string;
  orgUnitType: OrgUnitType;
  orgUnitName: string;
  action: OrgAuditAction;
  actorName: string;
  detail: string;
  timestamp: string;
}

export type LeaveStatus = "Approved" | "Pending" | "Rejected";

export interface LeaveRequest {
  id: string;
  employee: string;
  type: "Casual Leave" | "Sick Leave" | "Earned Leave" | "Comp Off";
  from: string;
  to: string;
  days: number;
  status: LeaveStatus;
  reason: string;
  siteId?: string;
}

export type AttendanceStatus =
  | "Present"
  | "Absent"
  | "Half Day"
  | "On Leave"
  | "Holiday"
  | "Weekend";

export interface AttendanceDay {
  date: number;
  status: AttendanceStatus;
}

export interface AttendanceReportRow {
  employee: string;
  department: string;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  onLeave: number;
  attendancePct: number;
  siteId: string;
}

export interface Payslip {
  id: string;
  month: string;
  employee: string;
  employeeId: string;
  designation: string;
  paymentDate: string;
  bankName: string;
  bankAccount: string;
  earnings: { label: string; amount: number }[];
  deductions: { label: string; amount: number }[];
}

export type JobStatus = "Active" | "Closed" | "On Hold";

export interface JobOpening {
  id: string;
  title: string;
  department: string;
  location: string;
  applicants: number;
  status: JobStatus;
  siteId: string;
}

export type ReviewStatus = "Completed" | "In Progress" | "Pending";

export interface PerformanceReview {
  id: string;
  employee: string;
  period: string;
  status: ReviewStatus;
  rating?: number;
  siteId: string;
}

export interface Activity {
  id: string;
  name: string;
  action: string;
  time: string;
}

/* ------------------------------------------------------------------ */
/* Authentication, Authorization, RBAC & Security                      */
/* ------------------------------------------------------------------ */

export const permissionActions = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "reject",
  "export",
  "import",
  "manage",
] as const;

/** `manage` implies full control over a feature (all other actions). */
export type PermissionAction = (typeof permissionActions)[number];

export const permissionModules = [
  "Dashboard",
  "AccessControl",
  "Sites",
  "Employees",
  "Organization",
  "Attendance",
  "Leave",
  "Payroll",
  "Recruitment",
  "Performance",
  "Training",
  "Assets",
  "Reports",
  "Settings",
] as const;

export type PermissionModule = (typeof permissionModules)[number];

/** A single addressable capability within a module, e.g. Payroll -> Payslips. */
export interface PermissionFeature {
  id: string;
  module: PermissionModule;
  label: string;
  description: string;
  actions: PermissionAction[];
  /** Sensitive HR/payroll data — flagged for audit/reporting emphasis. */
  sensitive?: boolean;
}

/** featureId -> granted actions for a role. */
export type RolePermissionMap = Record<string, PermissionAction[]>;

export interface Role {
  id: string;
  name: string;
  description: string;
  /** System roles ship with the product and cannot be deleted (but can be re-permissioned). */
  isSystem: boolean;
  status: "Active" | "Inactive";
  createdOn: string;
}

export type AccountStatus = "Active" | "Inactive";

export interface UserAccount {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  roleIds: string[];
  status: AccountStatus;
  /** Tenants (sites) this account may operate in. */
  siteIds: string[];
  passwordHash: string;
  mustChangePassword?: boolean;
  failedLoginAttempts: number;
  lockedUntil?: string;
  lastLogin?: string;
  createdOn: string;
}

export interface DeviceSession {
  id: string;
  accountId: string;
  device: string;
  browser: string;
  location: string;
  ip: string;
  createdAt: string;
  lastActiveAt: string;
  remember: boolean;
}

export type SecurityEventType =
  | "login_success"
  | "login_failed"
  | "logout"
  | "account_locked"
  | "account_unlocked"
  | "password_changed"
  | "password_reset_requested"
  | "password_reset_completed"
  | "role_assigned"
  | "role_created"
  | "role_permissions_updated"
  | "user_status_changed"
  | "access_denied";

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  accountId?: string;
  actorName: string;
  detail: string;
  ip: string;
  timestamp: string;
}

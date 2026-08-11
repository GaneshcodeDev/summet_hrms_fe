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
  profitCenterId?: string;
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

/**
 * Per-site toggle for which levels of the org structure a tenant actually uses.
 * Missing entries default to enabled so existing sites/org units keep working
 * unchanged. "Company" is always enabled — every structure needs a root.
 */
export interface OrgStructureConfig {
  enabledTypes: Partial<Record<OrgUnitType, boolean>>;
  updatedBy?: string;
  updatedOn?: string;
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

/* ------------------------------------------------------------------ */
/* Cost Center / Profit Center extended site profile                   */
/* Only meaningful for OrgUnit.type === "CostCenter" | "ProfitCenter" — */
/* kept in its own store, keyed by orgUnitId, so the other 8 unit types */
/* (Company, Branch, Department, ...) are completely unaffected.       */
/* ------------------------------------------------------------------ */

export interface SiteShift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

export interface SiteHoliday {
  id: string;
  name: string;
  date: string;
}

export interface SiteProfile {
  orgUnitId: string;
  category: string;
  currency: string;
  segment: string;
  subSegment: string;
  assetBarcodePrefix: string;
  activationDateTime: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  contact: {
    name: string;
    phone: string;
    email: string;
  };
  physicalLocationNote: string;
  /** Roles considered "under" this site — e.g. who can approve costs/spend routed through it. */
  roleIds: string[];
  shifts: SiteShift[];
  holidays: SiteHoliday[];
  updatedBy?: string;
  updatedOn?: string;
}

/* ------------------------------------------------------------------ */
/* Employee <-> Cost Center / Profit Center mapping                    */
/* Overlay on top of Employee.costCenterId/profitCenterId so the       */
/* (still mock-data-backed) Employees module doesn't need to change.   */
/* ------------------------------------------------------------------ */

export interface EmployeeSiteMapping {
  employeeId: string;
  costCenterId?: string;
  profitCenterId?: string;
  updatedBy?: string;
  updatedOn?: string;
}

/* ------------------------------------------------------------------ */
/* Events                                                               */
/* ------------------------------------------------------------------ */

export type EventType = "Meeting" | "Training" | "Holiday" | "Company Event" | "Festival" | "Announcement";
export type EventStatus = "Scheduled" | "Cancelled" | "Completed";

export interface CompanyEvent {
  id: string;
  title: string;
  description: string;
  type: EventType;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  location: string;
  siteId?: string;
  /** Roles this event is visible to. Empty = visible to everyone. */
  roleIds: string[];
  status: EventStatus;
  createdBy: string;
  createdOn: string;
}

/* ------------------------------------------------------------------ */
/* Dynamic Menu / Submenu navigation + Role-Menu mapping                */
/* Presentation layer only — actual route access is still enforced by  */
/* PermissionModule/canModule. This controls what appears in the       */
/* sidebar and to whom, without weakening the real security boundary.  */
/* ------------------------------------------------------------------ */

export interface MenuItem {
  id: string;
  label: string;
  /** Lucide icon name, resolved via the icon registry in nav-items.ts. */
  icon: string;
  href: string;
  parentId: string | null;
  order: number;
  /** Optional link to a real RBAC module — if set, the item still requires canModule(module, "view") too. */
  module?: PermissionModule;
  /**
   * Roles allowed to see this item. `undefined` = fall back to the linked
   * module's normal RBAC check (today's default behavior, unchanged).
   * An explicit array (even empty) overrides that and is used as-is.
   */
  roleIds?: string[];
}

/* ------------------------------------------------------------------ */
/* Masters — centralized configurable reference data                   */
/* ------------------------------------------------------------------ */

export const masterTypes = [
  "Department",
  "Designation",
  "JobGrade",
  "EmploymentType",
  "EmployeeType",
  "Location",
  "Plant",
  "Shift",
  "ShiftType",
  "LeaveType",
  "HolidayType",
  "SalaryComponent",
  "Allowance",
  "Deduction",
  "Qualification",
  "Skill",
  "DocumentType",
  "SeparationReason",
  "RecruitmentSource",
  "CostCenter",
  "ProfitCenter",
  "Bank",
  "Country",
  "State",
  "City",
] as const;

export type MasterType = (typeof masterTypes)[number];

export type MasterFieldType = "text" | "number" | "boolean" | "select" | "time";

/** A record's extra type-specific attributes, e.g. State.countryId, Shift.startTime. */
export type MasterAttributes = Record<string, string | number | boolean | undefined>;

export interface MasterRecord {
  id: string;
  masterType: MasterType;
  name: string;
  code: string;
  description?: string;
  status: "Active" | "Inactive";
  /** Present only for tenant-scoped masters; global masters (Country, Bank, ...) omit it. */
  siteId?: string;
  attributes: MasterAttributes;
  createdOn: string;
  updatedOn: string;
}

export type MasterAuditAction = "created" | "updated" | "activated" | "deactivated" | "imported";

export interface MasterAuditEntry {
  id: string;
  masterType: MasterType;
  recordId: string;
  recordName: string;
  action: MasterAuditAction;
  actorName: string;
  detail: string;
  timestamp: string;
}

export type LeaveStatus = "Approved" | "Pending" | "Rejected";
export type LeaveType = "Casual Leave" | "Sick Leave" | "Earned Leave" | "Comp Off";

export interface LeaveRequest {
  id: string;
  /** Canonical link to Employee.employeeId — `employee` is kept as a display-name convenience. */
  employeeId: string;
  employee: string;
  type: LeaveType;
  from: string;
  to: string;
  days: number;
  status: LeaveStatus;
  reason: string;
  siteId?: string;
  appliedOn: string;
  approverId?: string;
  approverName?: string;
  /** Required on reject; an optional note on approve. */
  decisionReason?: string;
  decidedOn?: string;
}

export interface LeaveBalance {
  employeeId: string;
  type: LeaveType;
  used: number;
  total: number;
}

export type LeaveAuditAction = "applied" | "approved" | "rejected";

export interface LeaveAuditEntry {
  id: string;
  leaveRequestId: string;
  employeeName: string;
  action: LeaveAuditAction;
  actorName: string;
  detail: string;
  timestamp: string;
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

/* ------------------------------------------------------------------ */
/* Attendance Regularization                                           */
/* ------------------------------------------------------------------ */

export type RegularizationStatus = "Pending" | "Approved" | "Rejected";

export interface AttendanceRegularization {
  id: string;
  employeeId: string;
  employee: string;
  date: string;
  currentStatus: AttendanceStatus;
  requestedStatus: AttendanceStatus;
  reason: string;
  status: RegularizationStatus;
  siteId?: string;
  appliedOn: string;
  approverId?: string;
  approverName?: string;
  decisionReason?: string;
  decidedOn?: string;
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

/* ------------------------------------------------------------------ */
/* Payroll — Loans & Tax Declarations                                  */
/* ------------------------------------------------------------------ */

export type LoanType = "Salary Advance" | "Personal Loan" | "Vehicle Loan" | "Home Loan";
export type LoanStatus = "Pending" | "Approved" | "Rejected" | "Active" | "Closed";

export interface EmployeeLoan {
  id: string;
  employeeId: string;
  employee: string;
  type: LoanType;
  principalAmount: number;
  emiAmount: number;
  tenureMonths: number;
  outstandingAmount: number;
  status: LoanStatus;
  reason: string;
  siteId?: string;
  appliedOn: string;
  approverId?: string;
  approverName?: string;
  decisionReason?: string;
  decidedOn?: string;
}

export type TaxRegime = "Old Regime" | "New Regime";
export type TaxDeclarationStatus = "Draft" | "Submitted" | "Verified" | "Rejected";

export interface TaxDeclaration {
  id: string;
  employeeId: string;
  employee: string;
  financialYear: string;
  regime: TaxRegime;
  section80C: number;
  section80D: number;
  hraExemptionClaimed: number;
  otherExemptions: number;
  status: TaxDeclarationStatus;
  siteId?: string;
  submittedOn?: string;
  verifiedBy?: string;
  verifiedOn?: string;
  decisionReason?: string;
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
  "Masters",
  "Attendance",
  "Leave",
  "Payroll",
  "Recruitment",
  "Performance",
  "Training",
  "Assets",
  "Reports",
  "Events",
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

/* ------------------------------------------------------------------ */
/* Application Settings                                                */
/* ------------------------------------------------------------------ */

export interface GeneralSettings {
  name: string;
  logoDataUrl?: string;
}

export interface OrganizationProfileSettings {
  legalName: string;
  registrationNumber: string;
  taxId: string;
  industry: string;
  companySize: string;
  website: string;
  address: string;
  fiscalYearStartMonth: string;
}

export interface LocalizationSettings {
  timezone: string;
  language: string;
  country: string;
  dateFormat: string;
  timeFormat: string;
  numberFormat: string;
  currency: string;
  weekStart: string;
}

export type SmtpEncryption = "None" | "SSL" | "TLS";

export interface EmailSettings {
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string;
  fromName: string;
  fromEmail: string;
  encryption: SmtpEncryption;
  notifications: Record<string, boolean>;
}

export interface BackupSettings {
  autoBackupEnabled: boolean;
  frequency: "Daily" | "Weekly" | "Monthly";
  retentionDays: number;
  lastBackupAt?: string;
}

export interface AppSettings {
  general: GeneralSettings;
  organization: OrganizationProfileSettings;
  localization: LocalizationSettings;
  email: EmailSettings;
  integrations: Record<string, boolean>;
  backup: BackupSettings;
}

export interface BackupHistoryEntry {
  id: string;
  timestamp: string;
  sizeLabel: string;
  triggeredBy: string;
  type: "Manual" | "Automatic";
}

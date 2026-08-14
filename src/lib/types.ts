export type EmployeeStatus = "Active" | "Inactive";

/**
 * Finer-grained lifecycle stage, additive alongside `status` — `status`
 * stays the binary flag every existing eligibility check (attendance,
 * payroll, dropdowns) already relies on; this captures the HR-visible detail
 * without changing what "Active" means anywhere that already reads it.
 */
export type EmploymentStage = "Probation" | "Confirmed" | "On Notice" | "Exited";

export type Gender = "Male" | "Female" | "Other";
export type MaritalStatus = "Single" | "Married" | "Other";

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  alternatePhone?: string;
  address?: string;
}

export interface Nominee {
  id: string;
  name: string;
  relationship: string;
  dateOfBirth?: string;
  /** % share of benefits — the Nominee tab validates these sum to 100 across an employee's nominees. */
  percentage: number;
  contact?: string;
}

export interface WorkExperience {
  id: string;
  company: string;
  designation: string;
  startDate: string;
  endDate?: string;
  responsibilities?: string;
}

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
  /** Optional — no current form captures this yet, so it's typically unset. */
  dateOfBirth?: string;
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
  subDepartmentId?: string;
  designationId?: string;
  gradeId?: string;
  locationId?: string;
  plantId?: string;
  costCenterId?: string;
  profitCenterId?: string;
  shiftId?: string;
  /** References the EmploymentType / EmployeeType Masters (see master-data.ts) — resolved on demand, no duplicate string field. */
  employmentTypeId?: string;
  employeeTypeId?: string;
  /**
   * True for employee records that exist only to back an administrative
   * login (e.g. a Site Admin created during site onboarding) rather than a
   * real headcount hire. Excluded from employee directory lists/counts by
   * default (see employee-context.tsx) but still fully resolvable by id for
   * login/profile purposes — mirrors how Super Admin isn't a site employee
   * at all.
   */
  isAdminAccount?: boolean;

  /* ---------------- Personal information (all optional/additive) ------- */
  firstName?: string;
  lastName?: string;
  profilePhotoUrl?: string;
  gender?: Gender;
  maritalStatus?: MaritalStatus;
  personalEmail?: string;
  alternatePhone?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;

  /* ---------------- Employment lifecycle -------------------------------- */
  employmentStage?: EmploymentStage;
  confirmationDate?: string;
  probationPeriodMonths?: number;

  /* ---------------- Statutory (storage only — no calculations here) ----- */
  pan?: string;
  pfNumber?: string;
  uan?: string;
  esiNumber?: string;

  /* ---------------- Repeatable records ----------------------------------- */
  emergencyContacts?: EmergencyContact[];
  nominees?: Nominee[];
  previousExperience?: WorkExperience[];
}

/* ------------------------------------------------------------------ */
/* Employee bank details — one record per employee, real store-backed  */
/* (not the old shared mock helper). Sensitive: gated by payroll.bank. */
/* ------------------------------------------------------------------ */

export type BankAccountType = "Savings" | "Current";

export interface EmployeeBankDetail {
  id: string;
  employeeId: string;
  siteId: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  accountType: BankAccountType;
  updatedOn: string;
  updatedBy?: string;
}

/* ------------------------------------------------------------------ */
/* Employee documents — real per-employee records, not the mock        */
/* generator. Always keyed by employeeId + siteId.                     */
/* ------------------------------------------------------------------ */

export type EmployeeDocumentStatus = "Pending" | "Verified" | "Rejected";

export interface EmployeeDocumentRecord {
  id: string;
  employeeId: string;
  siteId: string;
  documentType: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  /** Filename/reference only — no real file upload/storage in this mock environment. */
  fileRef?: string;
  status: EmployeeDocumentStatus;
  uploadedOn: string;
  verifiedBy?: string;
  verifiedOn?: string;
}

export type SiteStatus = "Active" | "Trial" | "Suspended";
export type PackagePlan = "Starter" | "Professional" | "Enterprise";

export const siteTypes = [
  "Corporate Office",
  "Manufacturing Plant",
  "Branch Office",
  "Warehouse",
  "Retail Outlet",
  "Other",
] as const;
export type SiteType = (typeof siteTypes)[number];

export interface Site {
  id: string;
  name: string;
  code: string;
  /** Registered legal entity name, if different from the trading/site name. */
  legalName?: string;
  siteType?: SiteType;
  industry?: string;
  email?: string;
  phone?: string;
  timezone?: string;
  currency?: string;
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
  /** Set once the 5-step onboarding wizard has been completed for this site. */
  onboardingCompletedOn?: string;
}

/* ------------------------------------------------------------------ */
/* Site onboarding — initial per-site operational configuration        */
/* Captured in Step 4 of the onboarding wizard. Distinct from the       */
/* global AppSettings (organization branding/email/integrations) —     */
/* this is day-to-day HR configuration scoped to a single site.        */
/* ------------------------------------------------------------------ */

export type PayFrequency = "Monthly" | "Bi-Weekly" | "Weekly";
export type LeaveApprovalMode = "Manager" | "HR" | "Manager then HR";

export interface SiteAttendanceConfig {
  workingDays: string[];
  weeklyOff: string[];
  defaultShiftId?: string;
  gracePeriodMinutes: number;
  lateComingRule: string;
  earlyGoingRule: string;
  overtimeEnabled: boolean;
}

export interface SiteLeaveConfig {
  enabledLeaveTypes: string[];
  approvalMode: LeaveApprovalMode;
  carryForwardEnabled: boolean;
  carryForwardMaxDays: number;
}

export interface SitePayrollConfig {
  frequency: PayFrequency;
  payCycleStartDay: number;
  processingDay: number;
  defaultComponents: string[];
}

export interface SiteHolidayConfig {
  calendarName: string;
  holidays: { name: string; date: string }[];
}

export interface SiteOnboardingConfig {
  siteId: string;
  attendance: SiteAttendanceConfig;
  leave: SiteLeaveConfig;
  payroll: SitePayrollConfig;
  holiday: SiteHolidayConfig;
  updatedOn: string;
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

export type LeaveStatus = "Approved" | "Pending" | "Rejected" | "Cancelled";
/**
 * Historically a fixed 4-value union; widened to `string` so it can hold any
 * site-configured "LeaveType" Master record name (see master-data.ts). Kept
 * as a plain string (display convenience, mirrors `employee` alongside
 * `employeeId`) — `leaveTypeId` below is the canonical reference.
 */
export type LeaveType = string;
export type HalfDayPortion = "First Half" | "Second Half";

export interface LeaveRequest {
  id: string;
  /** Canonical link to Employee.employeeId — `employee` is kept as a display-name convenience. */
  employeeId: string;
  employee: string;
  type: LeaveType;
  /** Canonical link to the site-scoped "LeaveType" Master record — resolves paid/unpaid and other policy fields. Optional for backward compatibility with pre-Phase-8 records. */
  leaveTypeId?: string;
  from: string;
  to: string;
  /** Only meaningful when `from === to` — a single half-day request. */
  halfDay?: HalfDayPortion;
  days: number;
  status: LeaveStatus;
  reason: string;
  contactDuringLeave?: string;
  emergencyContact?: string;
  attachmentRef?: string;
  siteId?: string;
  appliedOn: string;
  approverId?: string;
  approverName?: string;
  /** Required on reject; an optional note on approve. */
  decisionReason?: string;
  decidedOn?: string;
  cancelledBy?: string;
  cancelledOn?: string;
  cancellationReason?: string;
}

export interface LeaveBalance {
  employeeId: string;
  type: LeaveType;
  leaveTypeId?: string;
  used: number;
  /** Base annual entitlement — unchanged meaning from the pre-Phase-8 model. */
  total: number;
  /** Explicit opening balance for the current cycle; defaults to `total` when unset. */
  opening?: number;
  /** Additional days accrued mid-cycle (e.g. monthly accrual policies), on top of `opening`. */
  accrued?: number;
  /** Days carried forward from the previous cycle, on top of `opening`. */
  carryForward?: number;
}

export type LeaveAuditAction = "applied" | "approved" | "rejected" | "cancelled";

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
  | "Late"
  | "On Leave"
  | "Weekend"
  | "Holiday"
  | "Missing Punch";

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
/* Attendance records                                                   */
/* One row per employee per date. Site-isolated via siteId; always      */
/* resolved through employeeId (never by name) — see employee-store.ts. */
/* ------------------------------------------------------------------ */

export type AttendanceSource = "MANUAL" | "BIOMETRIC" | "MOBILE" | "IMPORT" | "API" | "SYSTEM";

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  siteId: string;
  date: string;
  punchIn?: string;
  punchOut?: string;
  status: AttendanceStatus;
  shiftId?: string;
  workedHours: number;
  overtimeHours: number;
  lateMinutes: number;
  earlyLeavingMinutes: number;
  source: AttendanceSource;
  remarks?: string;
  /** Set only when this record was created or overwritten by the Leave module's approval sync — see leave-context.tsx. Lets a later cancellation revert exactly what it touched. */
  leaveRequestId?: string;
  /** Snapshot of this record's state immediately before a leave sync overwrote it, so cancelling the leave can restore real attendance data instead of destroying it. Absent when the sync created the record from scratch (cancel then deletes it). */
  preLeaveSnapshot?: Pick<AttendanceRecord, "status" | "punchIn" | "punchOut" | "workedHours" | "overtimeHours" | "lateMinutes" | "earlyLeavingMinutes">;
  createdOn: string;
  updatedOn: string;
  updatedBy?: string;
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
  /** The specific attendance record this request would correct, once one exists for the date. */
  attendanceRecordId?: string;
  requestedPunchIn?: string;
  requestedPunchOut?: string;
  reason: string;
  status: RegularizationStatus;
  siteId?: string;
  appliedOn: string;
  approverId?: string;
  approverName?: string;
  decisionReason?: string;
  decidedOn?: string;
}

/* ------------------------------------------------------------------ */
/* Payroll — salary structure, monthly runs and generated payslips     */
/* Reuses Employee (source of truth), AttendanceRecord (LOP/overtime), */
/* EmployeeLoan (EMI deductions) and SalaryComponent masters (rates) — */
/* no parallel data source. Site-isolated via siteId throughout.       */
/* ------------------------------------------------------------------ */

export interface SalaryLine {
  componentId: string;
  label: string;
  amount: number;
}

export interface EmployeeSalaryStructure {
  id: string;
  employeeId: string;
  siteId: string;
  effectiveFrom: string;
  ctcAnnual: number;
  /** Monthly recurring earnings (Basic, HRA, allowances) — LOP/overtime are computed per payroll run, not stored here. */
  earnings: SalaryLine[];
  /** Monthly recurring deductions (PF, Professional Tax, ...) — loan EMI is computed per run from the Loans store. */
  deductions: SalaryLine[];
  grossMonthly: number;
  updatedOn: string;
  updatedBy?: string;
}

export type PayrollRunStatus = "Processing" | "Approved" | "Locked";

export interface PayrollRun {
  id: string;
  siteId: string;
  /** YYYY-MM */
  month: string;
  status: PayrollRunStatus;
  employeeCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  createdOn: string;
  createdBy: string;
  approvedOn?: string;
  approvedBy?: string;
  lockedOn?: string;
  lockedBy?: string;
}

export interface PayrollPayslip {
  id: string;
  runId: string;
  employeeId: string;
  siteId: string;
  month: string;
  earnings: SalaryLine[];
  deductions: SalaryLine[];
  workingDays: number;
  paidDays: number;
  lopDays: number;
  overtimeHours: number;
  overtimeAmount: number;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  generatedOn: string;
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
  "Onboarding",
  "Offboarding",
  "Organization",
  "Masters",
  "Attendance",
  "Leave",
  "Payroll",
  "Expenses",
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

/* ------------------------------------------------------------------ */
/* Onboarding — pre-boarding checklist, documents & e-signature        */
/* ------------------------------------------------------------------ */

export type OnboardingTaskCategory = "HR" | "IT" | "Admin" | "Manager" | "Employee";
export type OnboardingTaskStatus = "Pending" | "In Progress" | "Completed" | "Not Applicable";

export interface OnboardingTask {
  id: string;
  title: string;
  category: OnboardingTaskCategory;
  mandatory: boolean;
  status: OnboardingTaskStatus;
  completedBy?: string;
  completedOn?: string;
  note?: string;
}

export type DocumentStatus = "Pending" | "Uploaded" | "Verified" | "Rejected";
export type SignatureStatus = "Not Required" | "Not Sent" | "Sent" | "Viewed" | "Signed" | "Declined";

export interface OnboardingDocument {
  id: string;
  docType: string;
  status: DocumentStatus;
  fileName?: string;
  uploadedOn?: string;
  verifiedBy?: string;
  verifiedOn?: string;
  rejectionReason?: string;
  signatureStatus: SignatureStatus;
  signedOn?: string;
}

export type OnboardingCaseStatus = "Pre-boarding" | "In Progress" | "Completed" | "Cancelled";

export interface OnboardingCase {
  id: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  designation: string;
  department: string;
  siteId: string;
  /** Set once the candidate has a real Employee record (usually from day one). */
  employeeId?: string;
  buddyId?: string;
  joiningDate: string;
  status: OnboardingCaseStatus;
  tasks: OnboardingTask[];
  documents: OnboardingDocument[];
  createdOn: string;
  completedOn?: string;
  cancelledReason?: string;
}

export type OnboardingAuditAction =
  | "created"
  | "task_updated"
  | "document_uploaded"
  | "document_verified"
  | "document_rejected"
  | "signature_sent"
  | "signature_signed"
  | "completed"
  | "cancelled";

export interface OnboardingAuditEntry {
  id: string;
  caseId: string;
  candidateName: string;
  action: OnboardingAuditAction;
  actorName: string;
  detail: string;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/* Offboarding — resignation/termination, clearance, exit & F&F        */
/* ------------------------------------------------------------------ */

export type SeparationType = "Resignation" | "Termination" | "Retirement" | "Absconding";
export type SeparationStatus =
  | "Pending Approval"
  | "Approved"
  | "Clearance In Progress"
  | "Settlement Pending"
  | "Completed"
  | "Rejected"
  | "Withdrawn";

export type ClearanceDepartment = "IT" | "Admin" | "Finance" | "HR";
export type ClearanceItemStatus = "Pending" | "Cleared" | "Flagged";

export interface ClearanceItem {
  id: string;
  department: ClearanceDepartment;
  title: string;
  status: ClearanceItemStatus;
  clearedBy?: string;
  clearedOn?: string;
  remarks?: string;
}

export type ExitInterviewStatus = "Not Scheduled" | "Scheduled" | "Completed" | "Skipped";

export interface ExitInterview {
  status: ExitInterviewStatus;
  scheduledOn?: string;
  conductedBy?: string;
  primaryReason?: string;
  feedbackNotes?: string;
  wouldRehire?: boolean;
  rating?: number;
}

export type FnFLineItemType = "Earning" | "Deduction";

export interface FnFLineItem {
  id: string;
  label: string;
  type: FnFLineItemType;
  amount: number;
  autoComputed: boolean;
}

export type SettlementStatus = "Pending" | "Processing" | "Paid";

export interface FullAndFinalSettlement {
  lineItems: FnFLineItem[];
  netPayable: number;
  status: SettlementStatus;
  computedOn?: string;
  paidOn?: string;
  reference?: string;
}

export type LetterStatus = "Not Generated" | "Generated" | "Sent";

export interface SeparationCase {
  id: string;
  employeeId: string;
  employee: string;
  designation: string;
  department: string;
  siteId?: string;
  type: SeparationType;
  reason: string;
  resignationDate: string;
  lastWorkingDay: string;
  noticePeriodDays: number;
  status: SeparationStatus;
  initiatedBy: string;
  approverId?: string;
  approverName?: string;
  decisionReason?: string;
  decidedOn?: string;
  clearanceItems: ClearanceItem[];
  exitInterview: ExitInterview;
  settlement: FullAndFinalSettlement;
  relievingLetterStatus: LetterStatus;
  experienceLetterStatus: LetterStatus;
  completedOn?: string;
}

export type OffboardingAuditAction =
  | "initiated"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "clearance_updated"
  | "exit_interview_scheduled"
  | "exit_interview_completed"
  | "settlement_computed"
  | "settlement_paid"
  | "document_generated"
  | "completed";

export interface OffboardingAuditEntry {
  id: string;
  caseId: string;
  employeeName: string;
  action: OffboardingAuditAction;
  actorName: string;
  detail: string;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/* Expense & Travel management                                         */
/* ------------------------------------------------------------------ */

export type TravelMode = "Flight" | "Train" | "Bus" | "Cab" | "Self";
export type TravelRequestStatus = "Pending" | "Approved" | "Rejected" | "Completed";

export interface TravelRequest {
  id: string;
  employeeId: string;
  employee: string;
  purpose: string;
  destination: string;
  mode: TravelMode;
  fromDate: string;
  toDate: string;
  estimatedCost: number;
  status: TravelRequestStatus;
  siteId?: string;
  appliedOn: string;
  approverId?: string;
  approverName?: string;
  decisionReason?: string;
  decidedOn?: string;
}

export type ExpenseCategory =
  | "Travel"
  | "Accommodation"
  | "Food"
  | "Fuel"
  | "Internet & Phone"
  | "Client Entertainment"
  | "Other";

export interface ExpenseItem {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  hasReceipt: boolean;
  overLimitNote?: string;
}

export type ExpenseClaimStatus =
  | "Draft"
  | "Submitted"
  | "Manager Approved"
  | "Finance Approved"
  | "Rejected"
  | "Reimbursed";

export interface ExpenseClaim {
  id: string;
  employeeId: string;
  employee: string;
  title: string;
  travelRequestId?: string;
  items: ExpenseItem[];
  totalAmount: number;
  status: ExpenseClaimStatus;
  siteId?: string;
  submittedOn?: string;
  managerId?: string;
  managerName?: string;
  managerDecisionReason?: string;
  managerDecidedOn?: string;
  financeName?: string;
  financeDecisionReason?: string;
  financeDecidedOn?: string;
  reimbursedOn?: string;
  reimbursementReference?: string;
}

export type ExpenseAuditAction =
  | "created"
  | "submitted"
  | "manager_approved"
  | "manager_rejected"
  | "finance_approved"
  | "finance_rejected"
  | "reimbursed"
  | "cancelled"
  | "travel_requested"
  | "travel_decided";

export interface ExpenseAuditEntry {
  id: string;
  refId: string;
  employeeName: string;
  action: ExpenseAuditAction;
  actorName: string;
  detail: string;
  timestamp: string;
}

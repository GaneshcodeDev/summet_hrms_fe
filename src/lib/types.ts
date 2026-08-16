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
/* Employee lifecycle history — one reusable event log for every        */
/* post-hire change (Confirmed/Promoted/Transferred/Manager Changed/    */
/* Shift Changed/Salary Revised/Notice Started/Exit Completed/...).     */
/* Every writer (employee-lifecycle-context.tsx, offboarding-context.tsx,*/
/* recruitment-context.tsx's Hired transition) logs into this ONE store  */
/* via logLifecycleEvent — never a per-feature history table.           */
/* ------------------------------------------------------------------ */

export type LifecycleEventType =
  | "Joined"
  | "Confirmed"
  | "Promoted"
  | "Transferred"
  | "Department Changed"
  | "Site Changed"
  | "Manager Changed"
  | "Shift Changed"
  | "Salary Revised"
  | "Notice Started"
  | "Exit Completed";

export interface EmployeeLifecycleEvent {
  id: string;
  employeeId: string;
  siteId: string;
  eventType: LifecycleEventType;
  previousValue?: string;
  newValue?: string;
  actorName: string;
  date: string;
  comment?: string;
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
  "GoalCategory",
  "PerformanceRating",
  "SkillLevel",
  "TrainingCategory",
  "AssetType",
  "ExpenseCategory",
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
  /**
   * The date this specific version takes effect — the real versioning key.
   * Multiple EmployeeSalaryStructure records may exist per employeeId, one
   * per revision; payroll processing for month X picks the entry with the
   * latest effectiveFrom that is still <= month X (see
   * payroll-engine.ts's selectSalaryStructureForMonth), so a revision saved
   * today with a future effectiveFrom never touches payroll already run for
   * earlier months.
   */
  effectiveFrom: string;
  ctcAnnual: number;
  /** Monthly recurring earnings (Basic, HRA, allowances) — LOP/overtime are computed per payroll run, not stored here. */
  earnings: SalaryLine[];
  /** Monthly recurring deductions (PF, Professional Tax, ...) — loan EMI is computed per run from the Loans store. */
  deductions: SalaryLine[];
  grossMonthly: number;
  updatedOn: string;
  updatedBy?: string;
  /** Why this revision was made (e.g. "Annual increment", "Promotion") — optional, shown in Salary History. */
  reason?: string;
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

/* ------------------------------------------------------------------ */
/* Recruitment — Manpower Requirement -> Requisition -> Approval ->    */
/* Job Opening -> Candidate -> Application -> Screening -> Interview ->*/
/* Selection -> Offer -> Offer Accepted -> Onboarding -> Employee.     */
/* Requisitions/Openings/Offers use OrgUnit/Masters FK ids (never a    */
/* second department/designation text field) — see report-selectors.ts*/
/* buildReportEmployeeRows for the identical id->name resolution       */
/* pattern this module follows. Requisition approval reuses the Phase  */
/* 9 Approval Engine (see approvalModules below) — no separate gate.   */
/* ------------------------------------------------------------------ */

export type RequisitionPriority = "Low" | "Medium" | "High" | "Urgent";
export type RequisitionStatus = "Draft" | "Pending Approval" | "Approved" | "Rejected" | "Cancelled" | "Closed";

export interface JobRequisition {
  id: string;
  siteId: string;
  departmentId?: string;
  subDepartmentId?: string;
  designationId?: string;
  gradeId?: string;
  employmentTypeId?: string;
  employeeTypeId?: string;
  positions: number;
  hiringManagerId?: string;
  requiredSkills?: string[];
  minExperienceYears?: number;
  maxExperienceYears?: number;
  salaryRangeMin?: number;
  salaryRangeMax?: number;
  priority: RequisitionPriority;
  targetJoiningDate?: string;
  reasonForHiring: string;
  status: RequisitionStatus;
  requestedBy: string;
  requestedByName: string;
  createdOn: string;
}

export type JobOpeningStatus = "Draft" | "Open" | "On Hold" | "Closed" | "Cancelled";

export interface JobOpening {
  id: string;
  requisitionId?: string;
  siteId: string;
  departmentId?: string;
  designationId?: string;
  employmentTypeId?: string;
  title: string;
  description?: string;
  requiredSkills?: string[];
  minExperienceYears?: number;
  maxExperienceYears?: number;
  salaryRangeMin?: number;
  salaryRangeMax?: number;
  location: string;
  openings: number;
  status: JobOpeningStatus;
  openDate: string;
  closeDate?: string;
  createdBy: string;
  createdOn: string;
}

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  dateOfBirth?: string;
  location?: string;
  currentCompany?: string;
  currentDesignation?: string;
  totalExperienceYears?: number;
  relevantExperienceYears?: number;
  currentSalary?: number;
  expectedSalary?: number;
  noticePeriodDays?: number;
  skills?: string[];
  resumeFileName?: string;
  /** RecruitmentSource master id. */
  sourceId?: string;
  /** Originating site — a candidate can still apply to openings at other sites; each Application carries its own siteId for isolation. */
  siteId: string;
  createdOn: string;
  createdBy: string;
}

export type ApplicationStage =
  | "Applied"
  | "Screening"
  | "Interview"
  | "Selected"
  | "Offer"
  | "Offer Accepted"
  | "Hired"
  | "Rejected"
  | "Withdrawn";

export interface Application {
  id: string;
  candidateId: string;
  jobOpeningId: string;
  siteId: string;
  appliedDate: string;
  sourceId?: string;
  recruiterId?: string;
  stage: ApplicationStage;
  rejectedBy?: string;
  rejectedOn?: string;
  rejectionReason?: string;
  withdrawnOn?: string;
  withdrawnReason?: string;
}

export type InterviewMode = "In-Person" | "Video" | "Phone";
export type InterviewStatus = "Scheduled" | "Completed" | "Cancelled" | "No-Show";
export type InterviewRecommendation = "Strong Hire" | "Hire" | "No Hire" | "Strong No Hire";

export interface InterviewFeedback {
  technicalSkills?: number;
  communication?: number;
  problemSolving?: number;
  cultureFit?: number;
  overallRating?: number;
  recommendation?: InterviewRecommendation;
  comments?: string;
  submittedBy?: string;
  submittedOn?: string;
}

export interface Interview {
  id: string;
  applicationId: string;
  candidateId: string;
  siteId: string;
  round: number;
  roundLabel: string;
  interviewerIds: string[];
  scheduledDate: string;
  scheduledTime: string;
  mode: InterviewMode;
  locationOrLink?: string;
  status: InterviewStatus;
  feedback?: InterviewFeedback;
  createdOn: string;
}

export type OfferStatus = "Draft" | "Sent" | "Accepted" | "Rejected" | "Expired" | "Withdrawn";

export interface Offer {
  id: string;
  applicationId: string;
  candidateId: string;
  siteId: string;
  designationId?: string;
  departmentId?: string;
  employmentTypeId?: string;
  joiningDate: string;
  ctcAnnual: number;
  /** Reuses Payroll's SalaryLine shape — carried into EmployeeSalaryStructure as-is on hire, never a parallel salary model. */
  earnings: SalaryLine[];
  deductions: SalaryLine[];
  probationPeriodMonths?: number;
  offerDate: string;
  expiryDate?: string;
  status: OfferStatus;
  createdBy: string;
  createdOn: string;
  decidedOn?: string;
  decisionReason?: string;
}

export type RecruitmentRecordType = "Requisition" | "Opening" | "Candidate" | "Application" | "Interview" | "Offer";
export type RecruitmentAuditAction =
  | "requisition_created"
  | "requisition_approved"
  | "requisition_rejected"
  | "requisition_cancelled"
  | "opening_created"
  | "opening_status_changed"
  | "candidate_created"
  | "application_created"
  | "stage_changed"
  | "interview_scheduled"
  | "interview_feedback_submitted"
  | "offer_created"
  | "offer_sent"
  | "offer_accepted"
  | "offer_rejected"
  | "offer_expired"
  | "offer_withdrawn"
  | "onboarding_started";

export interface RecruitmentAuditEntry {
  id: string;
  recordType: RecruitmentRecordType;
  recordId: string;
  siteId: string;
  action: RecruitmentAuditAction;
  actorName: string;
  detail: string;
  timestamp: string;
}

export type ReviewStatus = "Completed" | "In Progress" | "Pending";

/* ------------------------------------------------------------------ */
/* Performance Management, Goals & Appraisal (Phase 13)                */
/* Reuses: Employee/Org/Site/RBAC/Approval Engine/Employee Lifecycle/   */
/* Payroll Salary Structure — see performance-context.tsx.              */
/* ------------------------------------------------------------------ */

/**
 * Mirrors the app's existing Title Case status convention (SeparationCase,
 * ApprovalInstanceStatus, OnboardingCase, ...) rather than introducing a new
 * SCREAMING_SNAKE_CASE style. One status per cycle, gating which stage's
 * actions are globally open; an individual PerformanceReviewCase can lag
 * behind (e.g. still "Self Review" while the cycle has moved to "HR Review")
 * but can never skip ahead of it — see performance-engine.ts.
 */
export const performanceCycleStatuses = ["Draft", "Open", "Self Review", "Manager Review", "HR Review", "Completed", "Closed"] as const;
export type PerformanceCycleStatus = (typeof performanceCycleStatuses)[number];

export interface PerformanceCycle {
  id: string;
  siteId: string;
  name: string;
  startDate: string;
  endDate: string;
  reviewStartDate: string;
  reviewEndDate: string;
  status: PerformanceCycleStatus;
  /** Whether this cycle's reviews route through an HR Review stage before Completed, or finalize straight from Manager Review — section 10/15. */
  requiresHRReview: boolean;
  createdBy: string;
  createdOn: string;
}

export type GoalScope = "Individual" | "Department" | "Team" | "Organization";
export type GoalStatus = "Not Started" | "In Progress" | "Completed" | "Missed";

export interface PerformanceGoal {
  id: string;
  /** Canonical link to Employee.employeeId — never trust a display name for authorization (Phase 12 convention). */
  employeeId: string;
  siteId: string;
  cycleId: string;
  scope: GoalScope;
  title: string;
  description?: string;
  /** References a "GoalCategory" Master record — configurable, not hardcoded (section 4). */
  categoryId?: string;
  kpi: string;
  target: string;
  measurement: string;
  /** Percentage weight within the employee's goal set for this cycle — validated to sum to 100 (section 5). */
  weight: number;
  dueDate: string;
  status: GoalStatus;
  /** Employee-reported progress against the target, 0-100. */
  achievement: number;
  employeeComment?: string;
  managerComment?: string;
  /** 1..5 (or whatever range the "PerformanceRating" Master is configured with) — set during Manager Review, section 9. */
  managerRating?: number;
  createdBy: string;
  createdOn: string;
}

export type PerformanceReviewStage = "Draft" | "Goals Assigned" | "Self Review" | "Manager Review" | "HR Review" | "Completed";

/** One employee's review within one cycle — the case-level record goals roll up into. */
export interface PerformanceReviewCase {
  id: string;
  employeeId: string;
  siteId: string;
  cycleId: string;
  stage: PerformanceReviewStage;
  selfReviewSubmittedOn?: string;
  managerReviewSubmittedOn?: string;
  managerReviewedBy?: string;
  hrReviewSubmittedOn?: string;
  hrReviewedBy?: string;
  hrComment?: string;
  /** Weighted average of each goal's managerRating (performance-engine.ts) — null until Manager Review is submitted. */
  finalScore?: number;
  completedOn?: string;
}

export type AppraisalStatus = "Draft" | "Pending Approval" | "Approved" | "Rejected" | "Applied";

export interface AppraisalDecision {
  id: string;
  employeeId: string;
  siteId: string;
  cycleId: string;
  reviewCaseId: string;
  finalRating: number;
  previousCtcAnnual?: number;
  proposedCtcAnnual?: number;
  incrementPercent: number;
  proposedDesignationId?: string;
  proposedGradeId?: string;
  promotion: boolean;
  effectiveDate: string;
  comments?: string;
  status: AppraisalStatus;
  createdBy: string;
  createdOn: string;
  decidedBy?: string;
  decidedOn?: string;
  appliedOn?: string;
}

export type PerformanceAuditAction =
  | "cycle_created"
  | "cycle_status_changed"
  | "goals_assigned"
  | "self_review_submitted"
  | "manager_review_submitted"
  | "hr_review_submitted"
  | "appraisal_created"
  | "appraisal_decided"
  | "appraisal_applied";

export interface PerformanceAuditEntry {
  id: string;
  action: PerformanceAuditAction;
  employeeId?: string;
  cycleId?: string;
  actorName: string;
  detail: string;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/* Skills & Training, Learning Management (Phase 14)                    */
/* Reuses: Employee/Site/Organization/Masters/Performance/RBAC/Approval */
/* Engine — see skills-context.tsx / training-context.tsx.              */
/* Employee.skills (plain string[], Phase 7) is untouched — this is a   */
/* parallel, richer model, not a replacement.                           */
/* ------------------------------------------------------------------ */

export type SkillSource = "Self-Reported" | "Manager Assessed" | "HR Assessed" | "Training Completion";

/**
 * Append-only, exactly like EmployeeSalaryStructure (Phase 12): "current"
 * level is always the latest record for an employeeId+skillId pair, and
 * every prior record stays on file untouched — see selectCurrentSkill /
 * skill-engine.ts. A single "assess a skill" action IS what creates a new
 * version; there's no separate SkillAssessment entity duplicating the same
 * fields (section 18's Skill Assessment and section 19's Skill History are
 * both just reads over this one versioned list).
 */
export interface EmployeeSkill {
  id: string;
  employeeId: string;
  siteId: string;
  /** "Skill" Master record id. */
  skillId: string;
  /** "SkillLevel" Master record id — its `value` attribute is the ordinal used for gap math. */
  skillLevelId: string;
  yearsOfExperience?: number;
  lastAssessedDate: string;
  source: SkillSource;
  assessedBy: string;
  comment?: string;
  createdOn: string;
}

export type SkillUpdateProposalStatus = "Pending" | "Approved" | "Rejected";

/**
 * A training-completion-triggered skill bump is never applied silently
 * (section 17) — it lands here first, and only decideSkillUpdateProposal
 * (HR/manager) actually appends the new EmployeeSkill version.
 */
export interface SkillUpdateProposal {
  id: string;
  employeeId: string;
  siteId: string;
  skillId: string;
  currentSkillLevelId?: string;
  proposedSkillLevelId: string;
  sourceEnrollmentId: string;
  reason: string;
  status: SkillUpdateProposalStatus;
  createdOn: string;
  decidedBy?: string;
  decidedOn?: string;
}

export type TrainingMode = "Classroom" | "Online" | "Hybrid" | "On-the-job";

export const trainingProgramStatuses = ["Draft", "Published", "In Progress", "Completed", "Cancelled"] as const;
export type TrainingProgramStatus = (typeof trainingProgramStatuses)[number];

export interface TrainingProgram {
  id: string;
  siteId: string;
  name: string;
  description?: string;
  /** "TrainingCategory" Master record id. */
  categoryId?: string;
  /** The trainer IS an Employee — no second person model (section 27). */
  trainerId?: string;
  durationHours?: number;
  mode: TrainingMode;
  startDate: string;
  endDate: string;
  capacity: number;
  status: TrainingProgramStatus;
  /** Optional link so completing this program can propose a skill bump (section 17) and so it can be recommended from a skill gap (section 9). */
  relatedSkillId?: string;
  targetSkillLevelId?: string;
  /** Only ever set by whoever creates the program — never fabricated (section 29). */
  programCost?: number;
  perEmployeeCost?: number;
  vendorCost?: number;
  createdBy: string;
  createdOn: string;
}

export type TrainingRequirementScope = "Employee" | "Department" | "Designation" | "Grade" | "Skill";

/**
 * A rule, not a hierarchy (section 8) — targetId is an existing id
 * (Employee.employeeId / OrgUnit.id / a "Designation" or "JobGrade" or
 * "Skill" Master id) depending on `scope`; no parallel org tree.
 */
export interface TrainingRequirement {
  id: string;
  siteId: string;
  scope: TrainingRequirementScope;
  targetId: string;
  requiredSkillId: string;
  requiredSkillLevelId: string;
  requiredTrainingProgramId?: string;
  createdBy: string;
  createdOn: string;
}

export const trainingEnrollmentStatuses = ["Registered", "Approved", "In Progress", "Completed", "Failed", "Cancelled", "No Show"] as const;
export type TrainingEnrollmentStatus = (typeof trainingEnrollmentStatuses)[number];
export type TrainingResult = "Passed" | "Failed" | "Not Attempted";

/** employeeId + siteId + trainingProgramId identifies an enrollment — assessment/completion fields live here directly rather than in a separate 1:1 table (section 11/15/16). */
export interface TrainingEnrollment {
  id: string;
  employeeId: string;
  siteId: string;
  trainingProgramId: string;
  status: TrainingEnrollmentStatus;
  /** Set when this enrollment originated from an approved TrainingRequest. */
  requestId?: string;
  registeredOn: string;
  registeredBy: string;
  score?: number;
  result?: TrainingResult;
  trainerFeedback?: string;
  assessmentDate?: string;
  completionDate?: string;
  /** A reference string HR/the trainer types in — never a generated/fake URL (section 16). */
  certificateReference?: string;
}

export interface TrainingSession {
  id: string;
  trainingProgramId: string;
  siteId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  trainerId?: string;
  location?: string;
  createdBy: string;
  createdOn: string;
}

export type TrainingAttendanceStatus = "Present" | "Absent" | "Late" | "No Show";

/** A separate domain from Employee Attendance (section 14) — never writes to AttendanceRecord. */
export interface TrainingAttendance {
  id: string;
  sessionId: string;
  enrollmentId: string;
  employeeId: string;
  siteId: string;
  status: TrainingAttendanceStatus;
  markedBy: string;
  markedOn: string;
}

export const trainingRequestStatuses = ["Pending", "Approved", "Rejected", "Completed", "Cancelled"] as const;
export type TrainingRequestStatus = (typeof trainingRequestStatuses)[number];

export interface TrainingRequest {
  id: string;
  employeeId: string;
  siteId: string;
  trainingProgramId: string;
  reason: string;
  requestedDate: string;
  status: TrainingRequestStatus;
  decidedBy?: string;
  decidedOn?: string;
  comment?: string;
}

/* ------------------------------------------------------------------ */
/* Asset Management & Employee Asset Lifecycle (Phase 15)               */
/* Reuses: Employee/Site/Masters/RBAC/Approval Engine/Offboarding — see  */
/* asset-context.tsx. Employee display names are always resolved from    */
/* the Employee Store, never stored as the source of truth here.         */
/* ------------------------------------------------------------------ */

export const assetStatuses = ["Available", "Assigned", "Under Maintenance", "Lost", "Damaged", "Retired", "Disposed"] as const;
export type AssetStatus = (typeof assetStatuses)[number];

/**
 * A small, fixed condition scale — kept a plain union rather than a Master
 * (unlike SkillLevel, nothing here needs a configurable numeric ordinal;
 * matches the existing precedent of TrainingMode/TrainingResult staying
 * plain unions for the same reason).
 */
export type AssetCondition = "New" | "Good" | "Fair" | "Damaged";

export interface Asset {
  id: string;
  /** Human-facing identifier, e.g. "L001" — distinct from the internal id. */
  assetCode: string;
  siteId: string;
  /** "AssetType" Master record id — Category is resolved from that record's own `category` attribute, never duplicated onto the Asset itself. */
  assetTypeId: string;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  warrantyExpiry?: string;
  vendor?: string;
  /** Free-text physical location (e.g. "Noida — IT Storage Room") — distinct from the Organization "Location" master, which represents office/branch locations. */
  location?: string;
  condition: AssetCondition;
  status: AssetStatus;
  remarks?: string;
  createdBy: string;
  createdOn: string;
}

/**
 * Append-only, exactly like EmployeeSalaryStructure/EmployeeSkill: the
 * "current" assignment for an asset is always just "the one with no
 * returnedDate", and every prior assignment stays on file untouched — see
 * asset-engine.ts. A transfer closes one record (stamping
 * transferredToEmployeeId instead of a plain return) and opens a new one in
 * the same transaction, so employeeId is never mutated in place.
 */
export interface AssetAssignment {
  id: string;
  assetId: string;
  employeeId: string;
  siteId: string;
  assignedDate: string;
  assignedBy: string;
  conditionAtAssignment: AssetCondition;
  remarks?: string;
  returnedDate?: string;
  returnedBy?: string;
  conditionAtReturn?: AssetCondition;
  returnRemarks?: string;
  damageNotes?: string;
  /** Set instead of a plain return when this assignment was closed by a transfer to another employee. */
  transferredToEmployeeId?: string;
  /** Full ISO timestamp — the real ordering key for history/current-assignment resolution (assignedDate is only day-precision and can tie, same lesson as EmployeeSkill in Phase 14). */
  createdOn: string;
}

export type AssetMaintenanceStatus = "Reported" | "In Progress" | "Completed";

export interface AssetMaintenance {
  id: string;
  assetId: string;
  siteId: string;
  issue: string;
  reportedDate: string;
  maintenanceStart?: string;
  maintenanceEnd?: string;
  /** Undefined means genuinely not recorded — displayed as "Not recorded", never defaulted to 0 (section 15). */
  cost?: number;
  vendor?: string;
  remarks?: string;
  status: AssetMaintenanceStatus;
  createdBy: string;
  createdOn: string;
}

export interface AssetDisposal {
  id: string;
  assetId: string;
  siteId: string;
  disposalDate: string;
  reason: string;
  approvedBy: string;
  remarks?: string;
  createdOn: string;
}

export type AssetAuditAction =
  | "created"
  | "assigned"
  | "returned"
  | "transferred"
  | "maintenance_started"
  | "maintenance_completed"
  | "marked_damaged"
  | "retired"
  | "disposed";

export interface AssetAuditEntry {
  id: string;
  assetId: string;
  action: AssetAuditAction;
  actorName: string;
  detail: string;
  timestamp: string;
}

export const assetRequestStatuses = ["Pending", "Approved", "Rejected", "Assigned", "Cancelled"] as const;
export type AssetRequestStatus = (typeof assetRequestStatuses)[number];

/** What the employee wants (an AssetType, not a specific unit) — mirrors TrainingRequest's shape exactly. */
export interface AssetRequest {
  id: string;
  employeeId: string;
  siteId: string;
  assetTypeId: string;
  reason: string;
  requestedDate: string;
  status: AssetRequestStatus;
  decidedBy?: string;
  decidedOn?: string;
  comment?: string;
  /** Set once an actual Asset unit is assigned to fulfill this request. */
  assignedAssetId?: string;
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

  /**
   * Set only when this case originated from an accepted Recruitment Offer
   * (see recruitment-context.tsx). Denormalized here — rather than looked
   * up live from Recruitment at completion time — because OnboardingProvider
   * is not (and shouldn't need to be) mounted as a descendant of
   * RecruitmentProvider; this is the one hand-off point between the two
   * modules. All optional/additive: a case HR creates manually today keeps
   * working exactly as before, with Employee creation falling back to the
   * plain department/designation text fields.
   */
  recruitmentApplicationId?: string;
  departmentId?: string;
  subDepartmentId?: string;
  designationId?: string;
  gradeId?: string;
  employmentTypeId?: string;
  employeeTypeId?: string;
  reportingManagerId?: string;
  probationPeriodMonths?: number;
  /** Carried from the accepted Offer so Employee creation can also seed a real EmployeeSalaryStructure — see payroll-context.tsx saveSalaryStructure. */
  offerCtcAnnual?: number;
  offerEarnings?: SalaryLine[];
  offerDeductions?: SalaryLine[];
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
export type TravelType = "Domestic" | "International";
export type TravelRequestStatus = "Pending" | "Approved" | "Rejected" | "Cancelled" | "Completed";

/**
 * A pre-travel approval request — distinct from ExpenseClaim (Phase 16,
 * section: "Travel Request is a pre-travel approval process; Expense Claim
 * is an actual reimbursement process after an expense occurs" — never
 * merged, never auto-converted one into the other).
 */
export interface TravelRequest {
  id: string;
  employeeId: string;
  /** Denormalized for seed/legacy convenience only — always resolve the live name from the Employee Store for display. */
  employee: string;
  siteId: string;
  purpose: string;
  travelType: TravelType;
  /** Origin location. */
  from: string;
  /** Destination location. */
  destination: string;
  mode: TravelMode;
  fromDate: string;
  toDate: string;
  estimatedCost: number;
  advanceRequired: boolean;
  advanceAmount?: number;
  accommodationRequired: boolean;
  transportRequired: boolean;
  remarks?: string;
  status: TravelRequestStatus;
  appliedOn: string;
  approverId?: string;
  approverName?: string;
  decisionReason?: string;
  decidedOn?: string;
}

export interface ExpenseItem {
  id: string;
  date: string;
  /** "ExpenseCategory" Master record id — Masters-backed, not a hardcoded union (section 8). */
  categoryId: string;
  amount: number;
  description: string;
  /** Filename/reference only, matching EmployeeDocumentRecord.fileRef — no real file upload/storage in this mock environment. */
  receiptReference?: string;
  overLimitNote?: string;
}

export type ExpenseClaimStatus =
  | "Draft"
  | "Submitted"
  | "Manager Approved"
  | "Finance Approved"
  | "Rejected"
  | "Cancelled"
  | "Reimbursed";

/**
 * An actual post-spend reimbursement claim, with one or more ExpenseItem
 * lines. totalAmount is always derived from items (section 9) — never a
 * manually entered source of truth.
 */
export interface ExpenseClaim {
  id: string;
  employeeId: string;
  /** Denormalized for seed/legacy convenience only — always resolve the live name from the Employee Store for display. */
  employee: string;
  siteId: string;
  title: string;
  /** Optional link to a pre-travel TravelRequest — non-travel expenses are equally valid (section 17). */
  travelRequestId?: string;
  items: ExpenseItem[];
  totalAmount: number;
  status: ExpenseClaimStatus;
  submittedOn?: string;
  managerId?: string;
  managerName?: string;
  managerDecisionReason?: string;
  managerDecidedOn?: string;
  financeName?: string;
  financeDecisionReason?: string;
  financeDecidedOn?: string;
  /** Set at Finance approval — defaults to totalAmount, editable down for a genuine partial approval (section 15). */
  approvedAmount?: number;
  reimbursedOn?: string;
  /** Set at reimbursement — defaults to approvedAmount, editable down for a genuine partial reimbursement (section 15). */
  reimbursedAmount?: number;
  reimbursementReference?: string;
  reimbursementMethod?: string;
  reimbursedBy?: string;
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
  | "travel_edited"
  | "travel_decided"
  | "travel_cancelled";

export interface ExpenseAuditEntry {
  id: string;
  refId: string;
  employeeName: string;
  action: ExpenseAuditAction;
  actorName: string;
  detail: string;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/* Reusable Approval Workflow (Phase 9)                                 */
/*                                                                      */
/* A generic, module-agnostic approval abstraction that existing        */
/* per-module approve/reject logic (Leave, Regularization, Expense,     */
/* Loan, Payroll) can gradually record itself against. It does not      */
/* replace those modules' own status fields/authorization checks —      */
/* each module remains the source of truth for its own business rules;  */
/* this only adds a shared, cross-module audit trail and (for Leave's   */
/* Manager-then-HR mode) a real multi-step gate. See approval-engine.ts /*
/* approval-context.tsx.                                                */
/* ------------------------------------------------------------------ */

export const approvalModules = ["Leave", "Regularization", "Expense", "Loan", "Payroll", "Requisition", "Employee", "Offboarding", "Performance", "Appraisal", "Training", "Asset"] as const;
export type ApprovalModule = (typeof approvalModules)[number];

export const approverTypes = [
  "REPORTING_MANAGER",
  "DEPARTMENT_HEAD",
  "HR",
  "SITE_ADMIN",
  "PAYROLL_ADMIN",
  "SPECIFIC_USER",
] as const;
export type ApproverType = (typeof approverTypes)[number];

export interface WorkflowStep {
  order: number;
  approverType: ApproverType;
  /** Only meaningful when approverType is SPECIFIC_USER. */
  specificEmployeeId?: string;
  required: boolean;
}

/** A resolved chain of steps for one instance — not persisted as a separate "WorkflowDefinition" record; see resolveWorkflowSteps in approval-engine.ts for how each module's existing config (SiteLeaveConfig.approvalMode, etc.) produces this. */
export type WorkflowStepChain = WorkflowStep[];

export type ApprovalInstanceStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";
export type ApprovalActionType = "APPLY" | "APPROVE" | "REJECT" | "CANCEL";

export interface ApprovalAction {
  id: string;
  stepOrder: number;
  approverType: ApproverType;
  actorEmployeeId?: string;
  actorName: string;
  action: ApprovalActionType;
  previousStatus: ApprovalInstanceStatus;
  newStatus: ApprovalInstanceStatus;
  comment?: string;
  timestamp: string;
}

export interface ApprovalInstance {
  id: string;
  siteId: string;
  module: ApprovalModule;
  /** The id of the record this instance governs (e.g. a LeaveRequest.id) — never trust a caller-supplied recordId without also checking siteId/requestedBy server-side-equivalent (see approval-context.tsx). */
  recordId: string;
  steps: WorkflowStepChain;
  currentStep: number;
  status: ApprovalInstanceStatus;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  completedAt?: string;
  actions: ApprovalAction[];
}

/* ------------------------------------------------------------------ */
/* In-app Notifications (Phase 17)                                      */
/*                                                                      */
/* Foundation only — no email/SMS provider. Every notification targets  */
/* exactly one employeeId, so RBAC/site scoping is automatic: a user    */
/* only ever queries their own notifications (see notification-        */
/* context.tsx). Modules call notify() from their own action functions  */
/* the same way they call recordMirroredAction() — this never replaces  */
/* a module's own status field or audit trail.                          */
/* ------------------------------------------------------------------ */

export type NotificationType = "info" | "success" | "warning" | "action_required";

export interface AppNotification {
  id: string;
  /** Recipient — always a real employeeId, never a role/site broadcast (keeps scoping trivial and correct). */
  employeeId: string;
  type: NotificationType;
  title: string;
  message: string;
  module: string;
  /** The record this notification is about, if any — used to build `href`. */
  recordId?: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

/**
 * Pure Reports selector layer — no store access, no React. Every function
 * takes already-fetched, already-scoped data (mirrors payroll-engine.ts /
 * leave-engine.ts / dashboard-selectors.ts / approval-engine.ts) and returns
 * derived report data. Reports pages are the only callers that touch
 * stores/hooks — they fetch via the existing contexts, scope by site/role,
 * then hand arrays in here.
 *
 * Calculation logic already owned elsewhere is reused, never re-derived:
 *  - Attendance aggregates: summarizeAttendance (attendance-context.tsx)
 *  - Working-day/holiday-aware date counting: calculateLeaveDays (leave-engine.ts)
 *  - Leave balance formula: computeLeaveBalanceSummary (leave-engine.ts)
 *  - Leave activity rollup: getLeaveSummary (leave-engine.ts)
 *  - Payroll figures: read directly off finalized PayrollPayslip — never recomputed
 */
import { summarizeAttendance } from "@/lib/attendance-context";
import { calculateLeaveDays, computeLeaveBalanceSummary, getLeaveSummary, type LeaveBalanceSummary } from "@/lib/leave-engine";
import type {
  AppraisalDecision,
  Application,
  ApprovalInstance,
  Asset,
  AssetAssignment,
  AttendanceRecord,
  Candidate,
  Employee,
  EmployeeLifecycleEvent,
  EmployeeSkill,
  ExpenseClaim,
  TravelRequest,
  Interview,
  JobOpening,
  JobRequisition,
  LeaveBalance,
  LeaveRequest,
  MasterRecord,
  Offer,
  OrgUnit,
  PayrollPayslip,
  PayrollRun,
  PerformanceGoal,
  PerformanceReviewCase,
  SeparationCase,
  Site,
  TrainingEnrollment,
  TrainingProgram,
} from "@/lib/types";
import { activeEnrollments } from "@/lib/training-engine";
import { selectCurrentSkills } from "@/lib/skill-engine";
import { getAssetInventorySummary } from "@/lib/asset-engine";
import { getExpenseSummary, getTravelSummary } from "@/lib/expense-engine";

const round = (n: number, digits = 0) => Math.round(n * 10 ** digits) / 10 ** digits;

export interface CountRow {
  label: string;
  count: number;
}

function countBy<T>(items: T[], keyFn: (item: T) => string | undefined): CountRow[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item)?.trim() || "Unassigned";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/* ------------------------------------------------------------------ */
/* Denormalized employee row — built once, reused by every selector    */
/* below that needs to break attendance/leave/payroll data down by     */
/* department/designation/grade/etc. Employee.department/designation/  */
/* location are used directly (already plain-text on the Employee      */
/* record); subDepartment/grade/employmentType/employeeType/plant      */
/* resolve through the existing Organization/Masters records — no      */
/* second name lookup invented.                                        */
/* ------------------------------------------------------------------ */

export interface ReportEmployeeRow {
  employeeId: string;
  id: string;
  name: string;
  status: Employee["status"];
  siteId: string;
  siteName: string;
  department: string;
  subDepartment: string;
  designation: string;
  grade: string;
  employmentType: string;
  employeeType: string;
  location: string;
  plant: string;
  shift: string;
  dateOfJoining: string;
  reportingManagerId?: string;
}

export function buildReportEmployeeRows(
  employees: Employee[],
  sites: Site[],
  orgUnits: OrgUnit[],
  masters: MasterRecord[],
): ReportEmployeeRow[] {
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const orgUnitName = new Map(orgUnits.map((u) => [u.id, u.name]));
  const masterName = new Map(masters.map((m) => [m.id, m.name]));
  return employees
    .filter((e) => !e.isAdminAccount)
    .map((e) => ({
      employeeId: e.employeeId,
      id: e.id,
      name: e.name,
      status: e.status,
      siteId: e.siteId,
      siteName: siteName.get(e.siteId) ?? e.siteId,
      department: e.department || "Unassigned",
      subDepartment: (e.subDepartmentId && orgUnitName.get(e.subDepartmentId)) || "Unassigned",
      designation: e.designation || "Unassigned",
      grade: (e.gradeId && masterName.get(e.gradeId)) || "Unassigned",
      employmentType: (e.employmentTypeId && masterName.get(e.employmentTypeId)) || "Unassigned",
      employeeType: (e.employeeTypeId && masterName.get(e.employeeTypeId)) || "Unassigned",
      location: e.location || "Unassigned",
      plant: (e.plantId && orgUnitName.get(e.plantId)) || "Unassigned",
      shift: (e.shiftId && masterName.get(e.shiftId)) || "Unassigned",
      dateOfJoining: e.dateOfJoining,
      reportingManagerId: e.reportingManagerId,
    }));
}

/* ------------------------------------------------------------------ */
/* Headcount                                                            */
/* ------------------------------------------------------------------ */

export interface HeadcountReport {
  total: number;
  active: number;
  inactive: number;
  newJoiners: number;
  exits: number;
  bySite: CountRow[];
  byDepartment: CountRow[];
  bySubDepartment: CountRow[];
  byDesignation: CountRow[];
  byGrade: CountRow[];
  byEmploymentType: CountRow[];
  byEmployeeType: CountRow[];
  byLocation: CountRow[];
  byPlant: CountRow[];
}

export function getHeadcountReport(
  rows: ReportEmployeeRow[],
  newJoinerRange?: { from: string; to: string },
  exitCount = 0,
): HeadcountReport {
  const active = rows.filter((r) => r.status === "Active");
  const inactive = rows.filter((r) => r.status === "Inactive");
  const newJoiners = newJoinerRange
    ? rows.filter((r) => r.dateOfJoining >= newJoinerRange.from && r.dateOfJoining <= newJoinerRange.to).length
    : 0;
  return {
    total: rows.length,
    active: active.length,
    inactive: inactive.length,
    newJoiners,
    exits: exitCount,
    bySite: countBy(rows, (r) => r.siteName),
    byDepartment: countBy(rows, (r) => r.department),
    bySubDepartment: countBy(rows, (r) => r.subDepartment),
    byDesignation: countBy(rows, (r) => r.designation),
    byGrade: countBy(rows, (r) => r.grade),
    byEmploymentType: countBy(rows, (r) => r.employmentType),
    byEmployeeType: countBy(rows, (r) => r.employeeType),
    byLocation: countBy(rows, (r) => r.location),
    byPlant: countBy(rows, (r) => r.plant),
  };
}

/* ------------------------------------------------------------------ */
/* Attendance / Absenteeism / Late Coming / Overtime                    */
/* ------------------------------------------------------------------ */

export interface AttendanceMetrics {
  recordCount: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  onLeave: number;
  missingPunch: number;
  weekend: number;
  holiday: number;
  overtimeHours: number;
  avgWorkedHours: number;
}

export function getAttendanceReport(records: AttendanceRecord[]): AttendanceMetrics {
  const summary = summarizeAttendance(records);
  const avgWorkedHours = records.length ? round(records.reduce((s, r) => s + r.workedHours, 0) / records.length, 2) : 0;
  return { recordCount: records.length, ...summary, avgWorkedHours };
}

export interface AttendanceBreakdownRow {
  label: string;
  employeeCount: number;
  metrics: AttendanceMetrics;
}

/** Breaks attendance down by any employee dimension (department/site/shift/location/plant/employee) via the ReportEmployeeRow join. */
export function getAttendanceBreakdown(
  records: AttendanceRecord[],
  rows: ReportEmployeeRow[],
  dimension: (row: ReportEmployeeRow) => string,
): AttendanceBreakdownRow[] {
  const rowByEmployeeId = new Map(rows.map((r) => [r.employeeId, r]));
  const grouped = new Map<string, AttendanceRecord[]>();
  for (const rec of records) {
    const empRow = rowByEmployeeId.get(rec.employeeId);
    const key = (empRow ? dimension(empRow) : undefined) || "Unassigned";
    grouped.set(key, [...(grouped.get(key) ?? []), rec]);
  }
  return Array.from(grouped.entries())
    .map(([label, recs]) => ({
      label,
      employeeCount: new Set(recs.map((r) => r.employeeId)).size,
      metrics: getAttendanceReport(recs),
    }))
    .sort((a, b) => b.metrics.recordCount - a.metrics.recordCount);
}

export interface AbsenteeismReport {
  absentDays: number;
  applicableWorkingDays: number;
  absenteeismPct: number;
}

/**
 * Absenteeism % = Absent working days ÷ applicable working days × 100.
 * `applicableWorkingDays` is (working days in range, per calculateLeaveDays —
 * excludes weekly-offs/holidays) × number of employees in scope, so it never
 * penalizes anyone for days their site wasn't even open.
 */
export function getAbsenteeismReport(
  records: AttendanceRecord[],
  employeeCount: number,
  range: { from: string; to: string },
  workingDays: string[],
  holidays: string[],
): AbsenteeismReport {
  const absentDays = records.filter((r) => r.status === "Absent").length;
  const { applicableDates } = calculateLeaveDays(range.from, range.to, workingDays, holidays);
  const applicableWorkingDays = applicableDates.length * employeeCount;
  return {
    absentDays,
    applicableWorkingDays,
    absenteeismPct: applicableWorkingDays > 0 ? round((absentDays / applicableWorkingDays) * 100, 1) : 0,
  };
}

export interface LateComingReport {
  lateEmployees: number;
  lateInstances: number;
  totalLateMinutes: number;
  avgLateMinutes: number;
}

export function getLateComingReport(records: AttendanceRecord[]): LateComingReport {
  const lateRecords = records.filter((r) => r.lateMinutes > 0);
  const totalLateMinutes = lateRecords.reduce((s, r) => s + r.lateMinutes, 0);
  return {
    lateEmployees: new Set(lateRecords.map((r) => r.employeeId)).size,
    lateInstances: lateRecords.length,
    totalLateMinutes,
    avgLateMinutes: lateRecords.length ? round(totalLateMinutes / lateRecords.length, 1) : 0,
  };
}

export interface LateComingBreakdownRow {
  label: string;
  report: LateComingReport;
}

/** Groups the exact same late-coming math (getLateComingReport) by any employee dimension — no second formula. */
export function getLateComingBreakdown(
  records: AttendanceRecord[],
  rows: ReportEmployeeRow[],
  dimension: (row: ReportEmployeeRow) => string,
): LateComingBreakdownRow[] {
  const rowByEmployeeId = new Map(rows.map((r) => [r.employeeId, r]));
  const grouped = new Map<string, AttendanceRecord[]>();
  for (const rec of records) {
    const empRow = rowByEmployeeId.get(rec.employeeId);
    const key = (empRow ? dimension(empRow) : undefined) || "Unassigned";
    grouped.set(key, [...(grouped.get(key) ?? []), rec]);
  }
  return Array.from(grouped.entries())
    .map(([label, recs]) => ({ label, report: getLateComingReport(recs) }))
    .filter((r) => r.report.lateInstances > 0)
    .sort((a, b) => b.report.lateInstances - a.report.lateInstances);
}

export interface OvertimeReport {
  totalOvertimeHours: number;
  byEmployee: CountRow[];
}

export function getOvertimeReport(records: AttendanceRecord[]): OvertimeReport {
  const hoursByEmployee = new Map<string, number>();
  for (const r of records) {
    if (r.overtimeHours <= 0) continue;
    hoursByEmployee.set(r.employeeId, (hoursByEmployee.get(r.employeeId) ?? 0) + r.overtimeHours);
  }
  return {
    totalOvertimeHours: round(records.reduce((s, r) => s + r.overtimeHours, 0), 2),
    byEmployee: Array.from(hoursByEmployee.entries())
      .map(([label, count]) => ({ label, count: round(count, 2) }))
      .sort((a, b) => b.count - a.count),
  };
}

/* ------------------------------------------------------------------ */
/* Leave                                                                */
/* ------------------------------------------------------------------ */

export interface LeaveBreakdownRow {
  label: string;
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  approvedDays: number;
}

/** Groups leave requests by any dimension — status semantics are exactly LeaveRequest.status (final-approved-only, cancelled excluded from "active"), no re-derivation. */
export function getLeaveBreakdown(
  requests: LeaveRequest[],
  rows: ReportEmployeeRow[],
  dimension: (row: ReportEmployeeRow) => string,
): LeaveBreakdownRow[] {
  const rowByEmployeeId = new Map(rows.map((r) => [r.employeeId, r]));
  const grouped = new Map<string, LeaveRequest[]>();
  for (const req of requests) {
    const empRow = rowByEmployeeId.get(req.employeeId);
    const key = (empRow ? dimension(empRow) : req.type) || "Unassigned";
    grouped.set(key, [...(grouped.get(key) ?? []), req]);
  }
  return Array.from(grouped.entries())
    .map(([label, reqs]) => ({
      label,
      total: reqs.length,
      pending: reqs.filter((r) => r.status === "Pending").length,
      approved: reqs.filter((r) => r.status === "Approved").length,
      rejected: reqs.filter((r) => r.status === "Rejected").length,
      cancelled: reqs.filter((r) => r.status === "Cancelled").length,
      approvedDays: round(
        reqs.filter((r) => r.status === "Approved").reduce((s, r) => s + r.days, 0),
        1,
      ),
    }))
    .sort((a, b) => b.total - a.total);
}

export interface LeaveUtilizationRow {
  employeeId: string;
  employeeName: string;
  type: string;
  summary: LeaveBalanceSummary;
  utilizationPct: number;
}

/** Per-employee-per-type utilization, built entirely from leave-engine.ts's own formula — no second balance calculation. */
export function getLeaveUtilizationReport(
  balances: LeaveBalance[],
  requests: LeaveRequest[],
  rows: ReportEmployeeRow[],
): LeaveUtilizationRow[] {
  const nameByEmployeeId = new Map(rows.map((r) => [r.employeeId, r.name]));
  return balances.map((b) => {
    const pendingDays = requests
      .filter((r) => r.employeeId === b.employeeId && r.type === b.type && r.status === "Pending")
      .reduce((s, r) => s + r.days, 0);
    const summary = computeLeaveBalanceSummary(b, b.total, pendingDays);
    const entitlement = summary.opening + summary.accrued + summary.carryForward;
    return {
      employeeId: b.employeeId,
      employeeName: nameByEmployeeId.get(b.employeeId) ?? b.employeeId,
      type: b.type,
      summary,
      utilizationPct: entitlement > 0 ? round((summary.used / entitlement) * 100, 1) : 0,
    };
  });
}

export { getLeaveSummary };

/* ------------------------------------------------------------------ */
/* Payroll / LOP                                                       */
/* ------------------------------------------------------------------ */

export interface PayrollReport {
  employeeCount: number;
  grossPayroll: number;
  totalDeductions: number;
  netPayroll: number;
  lopAmount: number;
  overtimeAmount: number;
}

function lopAmountOf(p: PayrollPayslip): number {
  return p.deductions.find((d) => d.componentId === "lop")?.amount ?? 0;
}

/** Reads figures straight off finalized payslips — payroll is never recalculated in Reports. */
export function getPayrollReport(payslips: PayrollPayslip[]): PayrollReport {
  return {
    employeeCount: payslips.length,
    grossPayroll: round(payslips.reduce((s, p) => s + p.grossEarnings, 0)),
    totalDeductions: round(payslips.reduce((s, p) => s + p.totalDeductions, 0)),
    netPayroll: round(payslips.reduce((s, p) => s + p.netPay, 0)),
    lopAmount: round(payslips.reduce((s, p) => s + lopAmountOf(p), 0)),
    overtimeAmount: round(payslips.reduce((s, p) => s + p.overtimeAmount, 0)),
  };
}

export interface PayrollBreakdownRow {
  label: string;
  employeeCount: number;
  gross: number;
  deductions: number;
  net: number;
  lop: number;
  overtime: number;
}

/**
 * Breaks payslips down by a current employee dimension (e.g. current
 * department) for "as of now" cost views. Historical payslip amounts
 * themselves are never touched — only the join label uses current
 * Employee data, exactly mirroring how the Employee Profile's Payroll tab
 * already treats historical payroll as an immutable snapshot.
 */
export function getPayrollBreakdown(
  payslips: PayrollPayslip[],
  rows: ReportEmployeeRow[],
  dimension: (row: ReportEmployeeRow) => string,
): PayrollBreakdownRow[] {
  const rowByEmployeeId = new Map(rows.map((r) => [r.employeeId, r]));
  const grouped = new Map<string, PayrollPayslip[]>();
  for (const p of payslips) {
    const empRow = rowByEmployeeId.get(p.employeeId);
    const key = (empRow ? dimension(empRow) : undefined) || "Unassigned";
    grouped.set(key, [...(grouped.get(key) ?? []), p]);
  }
  return Array.from(grouped.entries())
    .map(([label, slips]) => ({
      label,
      employeeCount: slips.length,
      gross: round(slips.reduce((s, p) => s + p.grossEarnings, 0)),
      deductions: round(slips.reduce((s, p) => s + p.totalDeductions, 0)),
      net: round(slips.reduce((s, p) => s + p.netPay, 0)),
      lop: round(slips.reduce((s, p) => s + lopAmountOf(p), 0)),
      overtime: round(slips.reduce((s, p) => s + p.overtimeAmount, 0)),
    }))
    .sort((a, b) => b.net - a.net);
}

export interface LopReport {
  lopEmployees: number;
  lopDays: number;
  lopAmount: number;
}

export function getLopReport(payslips: PayrollPayslip[]): LopReport {
  const withLop = payslips.filter((p) => p.lopDays > 0);
  return {
    lopEmployees: withLop.length,
    lopDays: round(
      withLop.reduce((s, p) => s + p.lopDays, 0),
      1,
    ),
    lopAmount: round(withLop.reduce((s, p) => s + lopAmountOf(p), 0)),
  };
}

/** LOP by employee/department/site — reuses getPayrollBreakdown's own lop/employeeCount fields, only filters to rows that actually had LOP. */
export function getLopBreakdown(payslips: PayrollPayslip[], rows: ReportEmployeeRow[], dimension: (row: ReportEmployeeRow) => string): PayrollBreakdownRow[] {
  return getPayrollBreakdown(
    payslips.filter((p) => p.lopDays > 0),
    rows,
    dimension,
  ).filter((r) => r.lop > 0);
}

/** LOP amount trend by payroll month — only months with a processed payslip that actually carried LOP, never padded. */
export function getLopMonthlyTrend(payslips: PayrollPayslip[]): MonthlyTrendPoint[] {
  return getMonthlyTrend(
    payslips.filter((p) => p.lopDays > 0),
    (p) => p.month,
    (slips) => round(slips.reduce((s, p) => s + lopAmountOf(p), 0)),
  );
}

/* ------------------------------------------------------------------ */
/* Approvals                                                            */
/* ------------------------------------------------------------------ */

export interface ApprovalReport {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  hasTimingData: boolean;
  avgApprovalMs?: number;
  fastestMs?: number;
  longestMs?: number;
}

/** Approval Time = final decision timestamp − request timestamp, only over instances that actually reached a final decision — never a synthetic SLA. */
export function getApprovalReport(instances: ApprovalInstance[]): ApprovalReport {
  const completed = instances.filter((i) => i.completedAt);
  const times = completed.map((i) => new Date(i.completedAt!).getTime() - new Date(i.requestedAt).getTime());
  return {
    total: instances.length,
    pending: instances.filter((i) => i.status === "Pending").length,
    approved: instances.filter((i) => i.status === "Approved").length,
    rejected: instances.filter((i) => i.status === "Rejected").length,
    cancelled: instances.filter((i) => i.status === "Cancelled").length,
    hasTimingData: times.length > 0,
    avgApprovalMs: times.length ? times.reduce((s, t) => s + t, 0) / times.length : undefined,
    fastestMs: times.length ? Math.min(...times) : undefined,
    longestMs: times.length ? Math.max(...times) : undefined,
  };
}

export function getApprovalBreakdownByModule(instances: ApprovalInstance[]): CountRow[] {
  return countBy(instances, (i) => i.module);
}

export interface ApprovalSlaRow {
  module: string;
  report: ApprovalReport;
}

/** Same getApprovalReport timing math, split per module — no separate SLA formula. */
export function getApprovalSlaByModule(instances: ApprovalInstance[]): ApprovalSlaRow[] {
  const modules = Array.from(new Set(instances.map((i) => i.module)));
  return modules
    .map((module) => ({ module, report: getApprovalReport(instances.filter((i) => i.module === module)) }))
    .sort((a, b) => a.module.localeCompare(b.module));
}

export function formatDuration(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(ms / 60_000)} min`;
  if (hours < 48) return `${round(hours, 1)} hr`;
  return `${round(hours / 24, 1)} day(s)`;
}

/* ------------------------------------------------------------------ */
/* Joiners / Exits                                                     */
/* ------------------------------------------------------------------ */

export function getJoinersReport(rows: ReportEmployeeRow[], range: { from: string; to: string }): ReportEmployeeRow[] {
  return rows
    .filter((r) => r.dateOfJoining >= range.from && r.dateOfJoining <= range.to)
    .sort((a, b) => (a.dateOfJoining < b.dateOfJoining ? 1 : -1));
}

export interface ExitRow {
  employeeId: string;
  employee: string;
  department: string;
  siteId: string;
  lastWorkingDay: string;
  reason: string;
}

/** Only genuinely completed separations count as an "exit" — nothing is inferred from Employee.status alone, which can be Inactive for other reasons too. */
export function getExitReport(cases: SeparationCase[], range?: { from: string; to: string }): ExitRow[] {
  return cases
    .filter((c) => c.status === "Completed")
    .filter((c) => !range || (c.lastWorkingDay >= range.from && c.lastWorkingDay <= range.to))
    .map((c) => ({
      employeeId: c.employeeId,
      employee: c.employee,
      department: c.department,
      siteId: c.siteId ?? "",
      lastWorkingDay: c.lastWorkingDay,
      reason: c.reason,
    }))
    .sort((a, b) => (a.lastWorkingDay < b.lastWorkingDay ? 1 : -1));
}

/* ------------------------------------------------------------------ */
/* Monthly trends — only months with real records, never padded         */
/* ------------------------------------------------------------------ */

export interface MonthlyTrendPoint {
  month: string;
  value: number;
}

export function getMonthlyTrend<T>(items: T[], monthOf: (item: T) => string | undefined, reduce: (items: T[]) => number): MonthlyTrendPoint[] {
  const byMonth = new Map<string, T[]>();
  for (const item of items) {
    const month = monthOf(item);
    if (!month) continue;
    byMonth.set(month, [...(byMonth.get(month) ?? []), item]);
  }
  return Array.from(byMonth.entries())
    .map(([month, its]) => ({ month, value: reduce(its) }))
    .sort((a, b) => (a.month < b.month ? -1 : 1));
}

/* ------------------------------------------------------------------ */
/* Site comparison (Super Admin)                                       */
/* ------------------------------------------------------------------ */

export interface SiteComparisonRow {
  siteId: string;
  siteName: string;
  employeeCount: number;
  activeEmployees: number;
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
  payrollCost: number;
  overtimeHours: number;
  lopAmount: number;
}

export function getSiteComparisonReport(
  sites: Site[],
  rows: ReportEmployeeRow[],
  todayRecords: AttendanceRecord[],
  latestPayslipsBySite: Map<string, PayrollPayslip[]>,
): SiteComparisonRow[] {
  return sites.map((site) => {
    const siteRows = rows.filter((r) => r.siteId === site.id);
    const siteToday = todayRecords.filter((r) => r.siteId === site.id);
    const summary = summarizeAttendance(siteToday);
    const payslips = latestPayslipsBySite.get(site.id) ?? [];
    return {
      siteId: site.id,
      siteName: site.name,
      employeeCount: siteRows.length,
      activeEmployees: siteRows.filter((r) => r.status === "Active").length,
      presentToday: summary.present,
      absentToday: summary.absent,
      onLeaveToday: summary.onLeave,
      payrollCost: round(payslips.reduce((s, p) => s + p.netPay, 0)),
      overtimeHours: round(siteToday.reduce((s, r) => s + r.overtimeHours, 0), 1),
      lopAmount: round(payslips.reduce((s, p) => s + lopAmountOf(p), 0)),
    };
  });
}

export function latestRunPerSite(runs: PayrollRun[]): Map<string, PayrollRun> {
  const latest = new Map<string, PayrollRun>();
  for (const run of runs) {
    const current = latest.get(run.siteId);
    if (!current || run.month > current.month) latest.set(run.siteId, run);
  }
  return latest;
}

/* ------------------------------------------------------------------ */
/* Recruitment — reads Application.stage as the single source of truth  */
/* for pipeline state (never re-derives "hired"/"active" from anywhere  */
/* else); Offer/Requisition figures are read directly off their own     */
/* stored fields, exactly like Payroll figures above.                   */
/* ------------------------------------------------------------------ */

export interface RecruitmentFunnelReport {
  openPositions: number;
  activeCandidates: number;
  offersPending: number;
  offersAccepted: number;
  positionsFilled: number;
}

export function getRecruitmentFunnelReport(openings: JobOpening[], applications: Application[], offers: Offer[]): RecruitmentFunnelReport {
  const activeStages = new Set(["Applied", "Screening", "Interview", "Selected", "Offer", "Offer Accepted"]);
  return {
    openPositions: openings.filter((o) => o.status === "Open").reduce((s, o) => s + o.openings, 0),
    activeCandidates: new Set(applications.filter((a) => activeStages.has(a.stage)).map((a) => a.candidateId)).size,
    offersPending: offers.filter((o) => o.status === "Sent").length,
    offersAccepted: offers.filter((o) => o.status === "Accepted").length,
    positionsFilled: applications.filter((a) => a.stage === "Hired").length,
  };
}

/** Interviews scheduled for a given date (YYYY-MM-DD) — no timezone math beyond string equality, same convention attendance/leave date filters already use. */
export function getInterviewsOnDate(interviews: Interview[], date: string): Interview[] {
  return interviews.filter((i) => i.scheduledDate === date && i.status === "Scheduled");
}

export interface RequisitionReport {
  total: number;
  pendingApproval: number;
  approved: number;
  rejected: number;
  positionsRequested: number;
  positionsApproved: number;
}

export function getRequisitionReport(requisitions: JobRequisition[]): RequisitionReport {
  return {
    total: requisitions.length,
    pendingApproval: requisitions.filter((r) => r.status === "Pending Approval").length,
    approved: requisitions.filter((r) => r.status === "Approved").length,
    rejected: requisitions.filter((r) => r.status === "Rejected").length,
    positionsRequested: requisitions.reduce((s, r) => s + r.positions, 0),
    positionsApproved: requisitions.filter((r) => r.status === "Approved").reduce((s, r) => s + r.positions, 0),
  };
}

/** Hired-application counts by department/site — resolved through the JobOpening each application belongs to, never a second department field on Application itself. */
export function getHiringBreakdown(applications: Application[], openings: JobOpening[], dimension: (opening: JobOpening) => string | undefined): CountRow[] {
  const openingById = new Map(openings.map((o) => [o.id, o]));
  const hired = applications.filter((a) => a.stage === "Hired");
  return countBy(hired, (a) => {
    const opening = openingById.get(a.jobOpeningId);
    return opening ? dimension(opening) : undefined;
  });
}

/** Hired-application counts by candidate source (RecruitmentSource master) — resolved through Candidate.sourceId, never duplicated onto Application. */
export function getSourceWiseHiring(applications: Application[], candidates: Candidate[]): CountRow[] {
  const candidateById = new Map(candidates.map((c) => [c.id, c]));
  const hired = applications.filter((a) => a.stage === "Hired");
  return countBy(hired, (a) => candidateById.get(a.candidateId)?.sourceId);
}

export interface ConversionReport {
  total: number;
  advanced: number;
  conversionPct: number;
}

/** Generic "how many of X moved past Y" — used for both interview-to-selected and offer-to-accepted conversion so the math is written once. */
function getConversionReport<T>(items: T[], countedAs: (item: T) => boolean): ConversionReport {
  const advanced = items.filter(countedAs).length;
  return { total: items.length, advanced, conversionPct: items.length > 0 ? round((advanced / items.length) * 100, 1) : 0 };
}

export function getInterviewConversionReport(interviews: Interview[]): ConversionReport {
  return getConversionReport(
    interviews.filter((i) => i.status === "Completed"),
    (i) => i.feedback?.recommendation === "Hire" || i.feedback?.recommendation === "Strong Hire",
  );
}

export function getOfferConversionReport(offers: Offer[]): ConversionReport {
  return getConversionReport(
    offers.filter((o) => o.status !== "Draft"),
    (o) => o.status === "Accepted",
  );
}

/* ------------------------------------------------------------------ */
/* Employee Lifecycle — Confirmations/Transfers/Promotions/Salary        */
/* Revisions/Manager Changes/Shift Changes all read the SAME event log   */
/* (EmployeeLifecycleEvent, written by employee-lifecycle-context.tsx),         */
/* filtered by eventType — one generic selector, not one per event type. */
/* ------------------------------------------------------------------ */

/** Events of one type within a date range, most recent first — the shared basis for every lifecycle report (Confirmations/Transfers/Promotions/Salary Revisions/...). */
export function getEmployeeLifecycleEventsByType(
  events: EmployeeLifecycleEvent[],
  eventType: EmployeeLifecycleEvent["eventType"],
  range: { from: string; to: string },
): EmployeeLifecycleEvent[] {
  return events
    .filter((e) => e.eventType === eventType && e.date >= range.from && e.date <= range.to)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/* ------------------------------------------------------------------ */
/* Performance — real numbers off PerformanceReviewCase/PerformanceGoal/ */
/* AppraisalDecision (performance-context.tsx); joins to department/site */
/* through the same ReportEmployeeRow dimension pattern every other      */
/* breakdown here already uses.                                          */
/* ------------------------------------------------------------------ */

export interface PerformanceCompletionReport {
  totalCases: number;
  completed: number;
  completionPct: number;
  averageRating: number;
}

/** Average is over completed cases only (finalScore is undefined until Manager Review is submitted) — never over the full case list. */
export function getPerformanceCompletionReport(cases: PerformanceReviewCase[]): PerformanceCompletionReport {
  const completed = cases.filter((c) => c.stage === "Completed" && c.finalScore !== undefined);
  const averageRating = completed.length > 0 ? round(completed.reduce((sum, c) => sum + (c.finalScore ?? 0), 0) / completed.length, 2) : 0;
  return {
    totalCases: cases.length,
    completed: completed.length,
    completionPct: cases.length > 0 ? round((completed.length / cases.length) * 100) : 0,
    averageRating,
  };
}

export interface GoalCompletionReport {
  total: number;
  completed: number;
  pending: number;
}

export function getGoalCompletionReport(goals: PerformanceGoal[]): GoalCompletionReport {
  const completed = goals.filter((g) => g.status === "Completed").length;
  return { total: goals.length, completed, pending: goals.length - completed };
}

export interface RatingDistributionRow {
  rating: number;
  count: number;
}

/** Whole-number buckets (1-5) of every rated case's rounded finalScore. */
export function getRatingDistribution(cases: PerformanceReviewCase[]): RatingDistributionRow[] {
  const rated = cases.filter((c) => c.finalScore !== undefined);
  const buckets = new Map<number, number>([1, 2, 3, 4, 5].map((r) => [r, 0]));
  for (const c of rated) {
    const bucket = Math.min(5, Math.max(1, Math.round(c.finalScore!)));
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([rating, count]) => ({ rating, count }));
}

export interface DimensionRatingRow {
  name: string;
  averageRating: number;
  count: number;
}

/** Average finalScore grouped by any employee dimension (department/site/...) via the same ReportEmployeeRow join every other breakdown here uses. */
export function getPerformanceRatingBreakdown(
  cases: PerformanceReviewCase[],
  rows: ReportEmployeeRow[],
  dimension: (row: ReportEmployeeRow) => string,
): DimensionRatingRow[] {
  const rowByEmployeeId = new Map(rows.map((r) => [r.employeeId, r]));
  const groups = new Map<string, number[]>();
  for (const c of cases) {
    if (c.finalScore === undefined) continue;
    const row = rowByEmployeeId.get(c.employeeId);
    if (!row) continue;
    const key = dimension(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c.finalScore);
  }
  return Array.from(groups.entries())
    .map(([name, scores]) => ({ name, averageRating: round(scores.reduce((a, b) => a + b, 0) / scores.length, 2), count: scores.length }))
    .sort((a, b) => b.averageRating - a.averageRating);
}

/** Approved-or-later appraisals recommending a promotion, most recent first — "recommendation" here means an appraisal decision that has actually cleared approval, not every draft. */
export function getPromotionRecommendations(appraisals: AppraisalDecision[]): AppraisalDecision[] {
  return appraisals
    .filter((a) => a.promotion && (a.status === "Approved" || a.status === "Applied"))
    .sort((a, b) => (a.effectiveDate < b.effectiveDate ? 1 : -1));
}

/** Approved-or-later appraisals carrying a real CTC change — same "cleared approval" bar as promotions. */
export function getSalaryRevisionRecommendations(appraisals: AppraisalDecision[]): AppraisalDecision[] {
  return appraisals
    .filter((a) => (a.status === "Approved" || a.status === "Applied") && a.proposedCtcAnnual !== undefined && a.proposedCtcAnnual !== a.previousCtcAnnual)
    .sort((a, b) => (a.effectiveDate < b.effectiveDate ? 1 : -1));
}

/* ------------------------------------------------------------------ */
/* Training — real numbers off TrainingProgram/TrainingEnrollment       */
/* (training-context.tsx); joins to department/site through the same    */
/* ReportEmployeeRow dimension pattern every other breakdown here uses.  */
/* ------------------------------------------------------------------ */

export interface TrainingProgramReport {
  totalPrograms: number;
  employeesTrained: number;
  completionRatePct: number;
  totalTrainingHours: number;
  failed: number;
  noShow: number;
  /** undefined when no program in scope has ever had a cost figure entered — never a fabricated total (section 23/29). */
  totalCost?: number;
}

export function getTrainingProgramReport(programs: TrainingProgram[], enrollments: TrainingEnrollment[]): TrainingProgramReport {
  const active = activeEnrollments(enrollments);
  const completed = active.filter((e) => e.status === "Completed");
  const programById = new Map(programs.map((p) => [p.id, p]));
  const totalTrainingHours = completed.reduce((sum, e) => sum + (programById.get(e.trainingProgramId)?.durationHours ?? 0), 0);
  const employeesTrained = new Set(completed.map((e) => e.employeeId)).size;
  const anyCostEntered = programs.some((p) => p.programCost !== undefined || p.perEmployeeCost !== undefined || p.vendorCost !== undefined);
  const totalCost = anyCostEntered
    ? programs.reduce((sum, p) => sum + (p.programCost ?? 0) + (p.vendorCost ?? 0), 0) +
      active.reduce((sum, e) => sum + (programById.get(e.trainingProgramId)?.perEmployeeCost ?? 0), 0)
    : undefined;
  return {
    totalPrograms: programs.length,
    employeesTrained,
    completionRatePct: active.length > 0 ? round((completed.length / active.length) * 100) : 0,
    totalTrainingHours,
    failed: active.filter((e) => e.status === "Failed").length,
    noShow: active.filter((e) => e.status === "No Show").length,
    totalCost,
  };
}

export interface DimensionCountRow {
  name: string;
  count: number;
}

/** Completed-enrollment counts grouped by any employee dimension (department/site/...) via the same ReportEmployeeRow join every other breakdown here uses. */
export function getTrainingBreakdown(enrollments: TrainingEnrollment[], rows: ReportEmployeeRow[], dimension: (row: ReportEmployeeRow) => string): DimensionCountRow[] {
  const rowByEmployeeId = new Map(rows.map((r) => [r.employeeId, r]));
  const completed = activeEnrollments(enrollments).filter((e) => e.status === "Completed");
  const counts = new Map<string, number>();
  for (const e of completed) {
    const row = rowByEmployeeId.get(e.employeeId);
    if (!row) continue;
    const key = dimension(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export interface SkillDistributionRow {
  skillId: string;
  levelId: string;
  count: number;
}

/** How many employees (in scope) currently sit at each skill/level pair — each employee's LATEST record only, never historical duplicates. */
export function getSkillDistribution(skills: EmployeeSkill[], employeeIds: string[]): SkillDistributionRow[] {
  const idSet = new Set(employeeIds);
  const current = employeeIds.flatMap((id) => selectCurrentSkills(skills, id));
  const scoped = current.filter((s) => idSet.has(s.employeeId));
  const counts = new Map<string, number>();
  for (const s of scoped) {
    const key = `${s.skillId}::${s.skillLevelId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([key, count]) => {
    const [skillId, levelId] = key.split("::");
    return { skillId, levelId, count };
  });
}

/* ------------------------------------------------------------------ */
/* Assets — real numbers off Asset/AssetAssignment (asset-context.tsx);  */
/* joins to department/site/employee through the same ReportEmployeeRow  */
/* dimension pattern every other breakdown here uses.                    */
/* ------------------------------------------------------------------ */

export interface AssetReport {
  total: number;
  assigned: number;
  available: number;
  maintenance: number;
  damaged: number;
  retired: number;
  pendingReturns: number;
  /** undefined when no asset in scope has ever had a purchase cost entered — never a fabricated total (section 21/29). */
  totalValue?: number;
}

export function getAssetReport(assets: Asset[], assignments: AssetAssignment[], employeeIdsOnNotice: string[]): AssetReport {
  const summary = getAssetInventorySummary(assets);
  const noticeSet = new Set(employeeIdsOnNotice);
  const pendingReturns = assignments.filter((a) => !a.returnedDate && noticeSet.has(a.employeeId)).length;
  const anyCostEntered = assets.some((a) => a.purchaseCost !== undefined);
  const totalValue = anyCostEntered ? assets.reduce((sum, a) => sum + (a.purchaseCost ?? 0), 0) : undefined;
  return {
    total: summary.total,
    assigned: summary.assigned,
    available: summary.available,
    maintenance: summary.maintenance,
    damaged: summary.damaged,
    retired: summary.retired,
    pendingReturns,
    totalValue,
  };
}

export interface AssetTypeCountRow {
  assetTypeId: string;
  count: number;
}

export function getAssetsByType(assets: Asset[]): AssetTypeCountRow[] {
  const counts = new Map<string, number>();
  for (const a of assets) counts.set(a.assetTypeId, (counts.get(a.assetTypeId) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([assetTypeId, count]) => ({ assetTypeId, count }))
    .sort((a, b) => b.count - a.count);
}

/** Currently-active-assignment counts grouped by any employee dimension (department/site/...) via the same ReportEmployeeRow join every other breakdown here uses. */
export function getAssetsByDimension(assignments: AssetAssignment[], rows: ReportEmployeeRow[], dimension: (row: ReportEmployeeRow) => string): DimensionCountRow[] {
  const rowByEmployeeId = new Map(rows.map((r) => [r.employeeId, r]));
  const active = assignments.filter((a) => !a.returnedDate);
  const counts = new Map<string, number>();
  for (const a of active) {
    const row = rowByEmployeeId.get(a.employeeId);
    if (!row) continue;
    const key = dimension(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export interface EmployeeAssetCountRow {
  employeeId: string;
  name: string;
  count: number;
}

/** Employees currently holding the most active assets, most first. */
export function getAssetsByEmployee(assignments: AssetAssignment[], rows: ReportEmployeeRow[]): EmployeeAssetCountRow[] {
  const rowByEmployeeId = new Map(rows.map((r) => [r.employeeId, r]));
  const active = assignments.filter((a) => !a.returnedDate);
  const counts = new Map<string, number>();
  for (const a of active) counts.set(a.employeeId, (counts.get(a.employeeId) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([employeeId, count]) => ({ employeeId, name: rowByEmployeeId.get(employeeId)?.name ?? employeeId, count }))
    .sort((a, b) => b.count - a.count);
}

/* ------------------------------------------------------------------ */
/* Expenses & Travel (Phase 16)                                        */
/* ------------------------------------------------------------------ */

export interface ExpenseReport {
  totalClaims: number;
  claimedAmount: number;
  approvedAmount: number;
  reimbursedAmount: number;
  outstandingAmount: number;
}

/** Reuses expense-engine's getExpenseSummary — never a second calculation of the same totals. */
export function getExpenseReport(claims: ExpenseClaim[]): ExpenseReport {
  const summary = getExpenseSummary(claims);
  return {
    totalClaims: summary.totalClaims,
    claimedAmount: summary.claimedAmount,
    approvedAmount: summary.approvedAmount,
    reimbursedAmount: summary.reimbursedAmount,
    outstandingAmount: summary.outstandingAmount,
  };
}

export interface TravelReport {
  totalRequests: number;
  approved: number;
  rejected: number;
  estimatedCost: number;
}

export function getTravelReport(requests: TravelRequest[]): TravelReport {
  const summary = getTravelSummary(requests);
  return { totalRequests: summary.total, approved: summary.approved, rejected: summary.rejected, estimatedCost: summary.estimatedCost };
}

/** Only claims that actually left Draft count as real spend activity — a Draft is scratch state, not data (section 21/23). */
function decidedClaims(claims: ExpenseClaim[]): ExpenseClaim[] {
  return claims.filter((c) => c.status !== "Draft" && c.status !== "Cancelled");
}

export interface CategoryAmountRow {
  categoryId: string;
  claimedAmount: number;
}

/** Claimed amount grouped by ExpenseCategory master id — category names are resolved by the caller (never duplicated here). */
export function getExpensesByCategory(claims: ExpenseClaim[]): CategoryAmountRow[] {
  const totals = new Map<string, number>();
  for (const c of decidedClaims(claims)) {
    for (const item of c.items) totals.set(item.categoryId, (totals.get(item.categoryId) ?? 0) + item.amount);
  }
  return Array.from(totals.entries())
    .map(([categoryId, claimedAmount]) => ({ categoryId, claimedAmount }))
    .sort((a, b) => b.claimedAmount - a.claimedAmount);
}

/** Claimed amount grouped by any employee dimension (department/site/...) via the same ReportEmployeeRow join every other breakdown here uses. */
export function getExpensesByDimension(claims: ExpenseClaim[], rows: ReportEmployeeRow[], dimension: (row: ReportEmployeeRow) => string): DimensionCountRow[] {
  const rowByEmployeeId = new Map(rows.map((r) => [r.employeeId, r]));
  const totals = new Map<string, number>();
  for (const c of decidedClaims(claims)) {
    const row = rowByEmployeeId.get(c.employeeId);
    if (!row) continue;
    const key = dimension(row);
    totals.set(key, (totals.get(key) ?? 0) + c.totalAmount);
  }
  return Array.from(totals.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export interface EmployeeExpenseAmountRow {
  employeeId: string;
  name: string;
  claimedAmount: number;
}

export function getExpensesByEmployee(claims: ExpenseClaim[], rows: ReportEmployeeRow[]): EmployeeExpenseAmountRow[] {
  const rowByEmployeeId = new Map(rows.map((r) => [r.employeeId, r]));
  const totals = new Map<string, number>();
  for (const c of decidedClaims(claims)) totals.set(c.employeeId, (totals.get(c.employeeId) ?? 0) + c.totalAmount);
  return Array.from(totals.entries())
    .map(([employeeId, claimedAmount]) => ({ employeeId, name: rowByEmployeeId.get(employeeId)?.name ?? employeeId, claimedAmount }))
    .sort((a, b) => b.claimedAmount - a.claimedAmount);
}

export interface TravelTypeCountRow {
  travelType: string;
  count: number;
}

export function getTravelByType(requests: TravelRequest[]): TravelTypeCountRow[] {
  const counts = new Map<string, number>();
  for (const r of requests) counts.set(r.travelType, (counts.get(r.travelType) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([travelType, count]) => ({ travelType, count }))
    .sort((a, b) => b.count - a.count);
}

export interface MonthlyExpenseTrendPoint {
  month: string;
  claimed: number;
  approved: number;
  reimbursed: number;
}

/** Only months with an actual submitted claim appear — never a fabricated zero-filled history (section 23). */
export function getMonthlyExpenseTrend(claims: ExpenseClaim[]): MonthlyExpenseTrendPoint[] {
  const byMonth = new Map<string, { claimed: number; approved: number; reimbursed: number }>();
  for (const c of decidedClaims(claims)) {
    const month = (c.submittedOn ?? "").slice(0, 7);
    if (!month) continue;
    const bucket = byMonth.get(month) ?? { claimed: 0, approved: 0, reimbursed: 0 };
    bucket.claimed += c.totalAmount;
    bucket.approved += c.approvedAmount ?? 0;
    bucket.reimbursed += c.reimbursedAmount ?? 0;
    byMonth.set(month, bucket);
  }
  return Array.from(byMonth.entries())
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => (a.month < b.month ? -1 : 1));
}

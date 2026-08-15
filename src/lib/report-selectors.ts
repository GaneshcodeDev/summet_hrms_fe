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
  ApprovalInstance,
  AttendanceRecord,
  Employee,
  LeaveBalance,
  LeaveRequest,
  MasterRecord,
  OrgUnit,
  PayrollPayslip,
  PayrollRun,
  SeparationCase,
  Site,
} from "@/lib/types";

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

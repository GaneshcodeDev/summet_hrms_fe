/**
 * Pure payroll calculation engine — no store access, no React. Every
 * function takes already-fetched, already-scoped data and returns derived
 * numbers, mirroring the dashboard-selectors.ts pattern from Phase 5. This
 * is deliberately generic (driven by whatever rates a site has configured
 * in Masters) rather than hardcoding statutory PF/ESI/TDS logic — see
 * resolveComponentRates for the one place default rates live, and they're
 * always overridable per-site via the existing Masters CRUD.
 */
import type { AttendanceRecord, EmployeeLoan, EmployeeSalaryStructure, MasterRecord, SalaryLine } from "@/lib/types";
import type { PayrollLeaveDay } from "@/lib/leave-engine";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** All calendar dates in `month` (YYYY-MM) that fall on one of the site's configured working days, capped at `upTo` if given. */
export function listWorkingDaysInMonth(month: string, workingDays: string[], upTo?: string): string[] {
  const [year, mo] = month.split("-").map(Number);
  const daysInMonth = new Date(year, mo, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, mo - 1, d).getDay();
    if (!workingDays.includes(dayNames[dow])) continue;
    const dateStr = `${year}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (upTo && dateStr > upTo) continue;
    dates.push(dateStr);
  }
  return dates;
}

export interface AttendanceForPayroll {
  workingDays: number;
  paidDays: number;
  lopDays: number;
  overtimeHours: number;
}

/**
 * A working day with no attendance record is treated as Loss of Pay, same
 * as an explicit Absent — this only ever applies to days up to today
 * (listWorkingDaysInMonth's `upTo` keeps future days out of the count for
 * an in-progress month), so nobody is docked for days that haven't happened.
 *
 * `leaveByDate` (from leave-engine.ts's computeLeaveDaysForPayroll) is
 * authoritative when present for a date — an approved PAID leave day is
 * never LOP even with no/an Absent attendance record underneath it, and an
 * approved UNPAID leave day always contributes to LOP, regardless of
 * whatever Attendance status happens to be recorded for it. This is the one
 * place Leave and Attendance are reconciled for payroll — see leave-context.tsx
 * for the separate (display-only) Attendance sync on leave approval.
 */
export function computeAttendanceForPayroll(
  records: AttendanceRecord[],
  workingDayDates: string[],
  leaveByDate?: Map<string, PayrollLeaveDay>,
): AttendanceForPayroll {
  const byDate = new Map(records.map((r) => [r.date, r]));
  let lop = 0;
  let overtimeHours = 0;
  for (const date of workingDayDates) {
    const leave = leaveByDate?.get(date);
    if (leave) {
      if (!leave.isPaid) lop += leave.portion;
      continue;
    }
    const r = byDate.get(date);
    if (!r) {
      lop += 1;
      continue;
    }
    if (r.status === "Absent" || r.status === "Missing Punch") lop += 1;
    else if (r.status === "Half Day") lop += 0.5;
    overtimeHours += r.overtimeHours;
  }
  const workingDays = workingDayDates.length;
  return { workingDays, paidDays: Math.max(0, workingDays - lop), lopDays: lop, overtimeHours };
}

export interface ComponentRates {
  basicRateOfGross: number; // % of monthly-equivalent CTC
  hraRateOfBasic: number; // % of Basic
  otherAllowanceAmount: number; // fixed ₹/month
  pfRateOfBasic: number; // % of Basic
  professionalTaxAmount: number; // fixed ₹/month
}

/** Defaults mirror the pre-Phase-6 demo convention (getEmployeeSalaryStructure) — always overridable per site via Masters. */
const defaultRates: ComponentRates = {
  basicRateOfGross: 50,
  hraRateOfBasic: 40,
  otherAllowanceAmount: 5000,
  pfRateOfBasic: 12,
  professionalTaxAmount: 200,
};

function attrNumber(record: MasterRecord | undefined, key: "rate" | "amount"): number | undefined {
  const v = record?.attributes[key];
  return typeof v === "number" ? v : undefined;
}

/** Reads site-configured SalaryComponent master rates where present, falling back to sensible defaults otherwise. */
export function resolveComponentRates(salaryComponents: MasterRecord[]): ComponentRates {
  const byCode = new Map(salaryComponents.map((c) => [c.code, c]));
  return {
    basicRateOfGross: attrNumber(byCode.get("BASIC"), "rate") ?? defaultRates.basicRateOfGross,
    hraRateOfBasic: attrNumber(byCode.get("HRA"), "rate") ?? defaultRates.hraRateOfBasic,
    otherAllowanceAmount: attrNumber(byCode.get("OALW"), "amount") ?? defaultRates.otherAllowanceAmount,
    pfRateOfBasic: attrNumber(byCode.get("PF"), "rate") ?? defaultRates.pfRateOfBasic,
    professionalTaxAmount: attrNumber(byCode.get("PT"), "amount") ?? defaultRates.professionalTaxAmount,
  };
}

/** Splits an annual CTC into a starter set of monthly earning/deduction lines using the resolved rates. Fully editable afterward. */
export function buildDefaultSalaryLines(ctcAnnual: number, rates: ComponentRates): { earnings: SalaryLine[]; deductions: SalaryLine[]; grossMonthly: number } {
  const monthlyGross = Math.round(ctcAnnual / 12);
  const basic = Math.round((monthlyGross * rates.basicRateOfGross) / 100);
  const hra = Math.round((basic * rates.hraRateOfBasic) / 100);
  const otherAllowance = Math.min(rates.otherAllowanceAmount, Math.max(0, monthlyGross - basic - hra));
  const specialAllowance = Math.max(0, monthlyGross - basic - hra - otherAllowance);
  const pf = Math.round((basic * rates.pfRateOfBasic) / 100);

  const earnings: SalaryLine[] = [
    { componentId: "salcomp-basic", label: "Basic Salary", amount: basic },
    { componentId: "salcomp-hra", label: "HRA", amount: hra },
    { componentId: "salcomp-special", label: "Special Allowance", amount: specialAllowance },
    ...(otherAllowance > 0 ? [{ componentId: "salcomp-other-allow", label: "Other Allowance", amount: otherAllowance }] : []),
  ];
  const deductions: SalaryLine[] = [
    { componentId: "salcomp-pf", label: "Provident Fund", amount: pf },
    { componentId: "salcomp-pt", label: "Professional Tax", amount: rates.professionalTaxAmount },
  ];
  const grossMonthly = earnings.reduce((sum, e) => sum + e.amount, 0);
  return { earnings, deductions, grossMonthly };
}

export interface PayslipCalcInput {
  salaryStructure: EmployeeSalaryStructure;
  attendance: AttendanceForPayroll;
  activeLoans: EmployeeLoan[];
}

export interface PayslipCalcResult {
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
}

/** Standard 1.5x overtime multiplier on the per-hour Basic rate — not a statutory calculation, just the common convention. */
export function calculatePayslip(input: PayslipCalcInput): PayslipCalcResult {
  const { salaryStructure, attendance, activeLoans } = input;
  const basicLine = salaryStructure.earnings.find((e) => e.componentId === "salcomp-basic");
  const perHourRate = basicLine && attendance.workingDays > 0 ? basicLine.amount / (attendance.workingDays * 8) : 0;
  const overtimeAmount = Math.round(perHourRate * 1.5 * attendance.overtimeHours);

  const perDayGross = attendance.workingDays > 0 ? salaryStructure.grossMonthly / attendance.workingDays : 0;
  const lopDeduction = Math.round(perDayGross * attendance.lopDays);

  const loanDeduction = activeLoans.reduce((sum, l) => sum + Math.min(l.emiAmount, l.outstandingAmount), 0);

  const earnings: SalaryLine[] = [...salaryStructure.earnings];
  if (overtimeAmount > 0) earnings.push({ componentId: "overtime", label: "Overtime", amount: overtimeAmount });

  const deductions: SalaryLine[] = [...salaryStructure.deductions];
  if (lopDeduction > 0) {
    deductions.push({ componentId: "lop", label: `Loss of Pay (${attendance.lopDays} day${attendance.lopDays === 1 ? "" : "s"})`, amount: lopDeduction });
  }
  if (loanDeduction > 0) deductions.push({ componentId: "loan-emi", label: "Loan EMI", amount: loanDeduction });

  const grossEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);

  return {
    earnings,
    deductions,
    workingDays: attendance.workingDays,
    paidDays: attendance.paidDays,
    lopDays: attendance.lopDays,
    overtimeHours: attendance.overtimeHours,
    overtimeAmount,
    grossEarnings,
    totalDeductions,
    netPay: grossEarnings - totalDeductions,
  };
}

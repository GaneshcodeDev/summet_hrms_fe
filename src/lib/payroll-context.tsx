"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  employeeLoansStore,
  payrollRunsStore,
  payslipsStore,
  salaryStructuresStore,
  taxDeclarationsStore,
} from "@/lib/payroll-store";
import {
  buildDefaultSalaryLines,
  calculatePayslip,
  computeAttendanceForPayroll,
  listWorkingDaysInMonth,
  resolveComponentRates,
} from "@/lib/payroll-engine";
import { useAccessControl } from "@/lib/access-control-context";
import { useEmployees } from "@/lib/employee-context";
import { useAttendance } from "@/lib/attendance-context";
import { useMasters } from "@/lib/master-context";
import { useSiteConfig } from "@/lib/site-config-context";
import { useLeave } from "@/lib/leave-context";
import { computeLeaveDaysForPayroll } from "@/lib/leave-engine";
import type {
  EmployeeLoan,
  EmployeeSalaryStructure,
  LoanStatus,
  LoanType,
  PayrollPayslip,
  PayrollRun,
  SalaryLine,
  TaxDeclaration,
  TaxRegime,
} from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

interface ApplyLoanInput {
  type: LoanType;
  principalAmount: number;
  tenureMonths: number;
  reason: string;
}

interface SubmitTaxDeclarationInput {
  financialYear: string;
  regime: TaxRegime;
  section80C: number;
  section80D: number;
  hraExemptionClaimed: number;
  otherExemptions: number;
}

export interface PayrollPreviewRow {
  employeeId: string;
  employeeName: string;
  hasSalaryStructure: boolean;
  result?: ReturnType<typeof calculatePayslip>;
}

interface PayrollContextValue {
  loans: EmployeeLoan[];
  taxDeclarations: TaxDeclaration[];
  loansFor: (employeeId: string) => EmployeeLoan[];
  visibleLoans: () => EmployeeLoan[];
  canDecideLoans: boolean;
  applyLoan: (input: ApplyLoanInput) => ActionResult;
  decideLoan: (id: string, status: LoanStatus, reason?: string) => ActionResult;
  taxDeclarationsFor: (employeeId: string) => TaxDeclaration[];
  visibleTaxDeclarations: () => TaxDeclaration[];
  canVerifyTax: boolean;
  submitTaxDeclaration: (input: SubmitTaxDeclarationInput) => ActionResult;
  decideTaxDeclaration: (id: string, status: "Verified" | "Rejected", reason?: string) => ActionResult;

  // Salary structure
  salaryStructures: EmployeeSalaryStructure[];
  salaryStructureFor: (employeeId: string) => EmployeeSalaryStructure | undefined;
  canManageSalary: boolean;
  defaultSalaryLinesFor: (siteId: string, ctcAnnual: number) => { earnings: SalaryLine[]; deductions: SalaryLine[]; grossMonthly: number };
  saveSalaryStructure: (input: {
    employeeId: string;
    siteId: string;
    ctcAnnual: number;
    earnings: SalaryLine[];
    deductions: SalaryLine[];
  }) => ActionResult;

  // Payroll runs / payslips
  payrollRuns: PayrollRun[];
  payslips: PayrollPayslip[];
  runsForSite: (siteId: string) => PayrollRun[];
  runForMonth: (siteId: string, month: string) => PayrollRun | undefined;
  payslipsForRun: (runId: string) => PayrollPayslip[];
  payslipsForEmployee: (employeeId: string) => PayrollPayslip[];
  latestPayslipFor: (employeeId: string) => PayrollPayslip | undefined;
  canProcessPayroll: boolean;
  canApprovePayroll: boolean;
  previewPayrollRun: (siteId: string, month: string) => PayrollPreviewRow[];
  processPayrollRun: (siteId: string, month: string) => ActionResult & { run?: PayrollRun };
  approvePayrollRun: (id: string) => ActionResult;
  lockPayrollRun: (id: string) => ActionResult;
}

const PayrollContext = createContext<PayrollContextValue | undefined>(undefined);

export function PayrollProvider({ children }: { children: ReactNode }) {
  const { currentUser, canFeature } = useAccessControl();

  const loans = useSyncExternalStore(
    employeeLoansStore.subscribe,
    employeeLoansStore.getSnapshot,
    employeeLoansStore.getServerSnapshot,
  );
  const taxDeclarations = useSyncExternalStore(
    taxDeclarationsStore.subscribe,
    taxDeclarationsStore.getSnapshot,
    taxDeclarationsStore.getServerSnapshot,
  );

  const canDecideLoans =
    canFeature("payroll.loans", "approve") || canFeature("payroll.loans", "reject") || canFeature("payroll.loans", "manage");
  const canVerifyTax = canFeature("payroll.tax", "edit") || canFeature("payroll.tax", "manage");

  const loansFor = useCallback((employeeId: string) => loans.filter((l) => l.employeeId === employeeId), [loans]);
  const visibleLoans = useCallback(
    () => (canDecideLoans ? loans : loansFor(currentUser.employeeId)),
    [canDecideLoans, loans, loansFor, currentUser.employeeId],
  );

  const taxDeclarationsFor = useCallback(
    (employeeId: string) => taxDeclarations.filter((t) => t.employeeId === employeeId),
    [taxDeclarations],
  );
  const visibleTaxDeclarations = useCallback(
    () => (canVerifyTax ? taxDeclarations : taxDeclarationsFor(currentUser.employeeId)),
    [canVerifyTax, taxDeclarations, taxDeclarationsFor, currentUser.employeeId],
  );

  const applyLoan = useCallback(
    (input: ApplyLoanInput): ActionResult => {
      if (input.principalAmount <= 0) return { ok: false, message: "Loan amount must be greater than zero." };
      const openLoan = employeeLoansStore
        .getSnapshot()
        .find((l) => l.employeeId === currentUser.employeeId && l.status === "Pending");
      if (openLoan) {
        return { ok: false, message: `You already have an active ${openLoan.type.toLowerCase()} request in progress.` };
      }
      const emiAmount = Math.round(input.principalAmount / input.tenureMonths);
      const loan: EmployeeLoan = {
        id: `loan-${Date.now().toString(36)}`,
        employeeId: currentUser.employeeId,
        employee: currentUser.name,
        type: input.type,
        principalAmount: input.principalAmount,
        emiAmount,
        tenureMonths: input.tenureMonths,
        outstandingAmount: input.principalAmount,
        status: "Pending",
        reason: input.reason,
        siteId: currentUser.siteId,
        appliedOn: new Date().toISOString().slice(0, 10),
      };
      employeeLoansStore.set([loan, ...employeeLoansStore.getSnapshot()]);
      return { ok: true, message: `${input.type} request for ₹${input.principalAmount.toLocaleString("en-IN")} submitted.` };
    },
    [currentUser.employeeId, currentUser.name, currentUser.siteId],
  );

  const decideLoan = useCallback(
    (id: string, status: LoanStatus, reason?: string): ActionResult => {
      const loan = employeeLoansStore.getSnapshot().find((l) => l.id === id);
      if (!loan) return { ok: false, message: "Loan request not found." };
      if (loan.status !== "Pending") return { ok: false, message: "This request has already been decided." };
      if (!canDecideLoans) return { ok: false, message: "You're not authorized to decide loan requests." };
      if (status === "Rejected" && !reason?.trim()) {
        return { ok: false, message: "A reason is required to reject a loan request." };
      }
      employeeLoansStore.set(
        employeeLoansStore.getSnapshot().map((l) =>
          l.id === id
            ? {
                ...l,
                status: status === "Approved" ? "Active" : "Rejected",
                approverId: currentUser.employeeId,
                approverName: currentUser.name,
                decisionReason: reason?.trim() || undefined,
                decidedOn: new Date().toISOString().slice(0, 10),
              }
            : l,
        ),
      );
      return {
        ok: true,
        message:
          status === "Approved"
            ? `Approved ${loan.employee}'s ${loan.type} request.`
            : `Rejected ${loan.employee}'s ${loan.type} request.`,
      };
    },
    [canDecideLoans, currentUser.employeeId, currentUser.name],
  );

  const submitTaxDeclaration = useCallback(
    (input: SubmitTaxDeclarationInput): ActionResult => {
      const existing = taxDeclarationsStore
        .getSnapshot()
        .find((t) => t.employeeId === currentUser.employeeId && t.financialYear === input.financialYear);
      const record: TaxDeclaration = {
        id: existing?.id ?? `tax-${Date.now().toString(36)}`,
        employeeId: currentUser.employeeId,
        employee: currentUser.name,
        financialYear: input.financialYear,
        regime: input.regime,
        section80C: input.section80C,
        section80D: input.section80D,
        hraExemptionClaimed: input.hraExemptionClaimed,
        otherExemptions: input.otherExemptions,
        status: "Submitted",
        siteId: currentUser.siteId,
        submittedOn: new Date().toISOString().slice(0, 10),
      };
      if (existing) {
        taxDeclarationsStore.set(taxDeclarationsStore.getSnapshot().map((t) => (t.id === existing.id ? record : t)));
      } else {
        taxDeclarationsStore.set([record, ...taxDeclarationsStore.getSnapshot()]);
      }
      return { ok: true, message: `Tax declaration for FY ${input.financialYear} submitted for verification.` };
    },
    [currentUser.employeeId, currentUser.name, currentUser.siteId],
  );

  const decideTaxDeclaration = useCallback(
    (id: string, status: "Verified" | "Rejected", reason?: string): ActionResult => {
      const declaration = taxDeclarationsStore.getSnapshot().find((t) => t.id === id);
      if (!declaration) return { ok: false, message: "Tax declaration not found." };
      if (!canVerifyTax) return { ok: false, message: "You're not authorized to verify tax declarations." };
      if (status === "Rejected" && !reason?.trim()) {
        return { ok: false, message: "A reason is required to reject a tax declaration." };
      }
      taxDeclarationsStore.set(
        taxDeclarationsStore.getSnapshot().map((t) =>
          t.id === id
            ? {
                ...t,
                status,
                verifiedBy: currentUser.name,
                verifiedOn: new Date().toISOString().slice(0, 10),
                decisionReason: reason?.trim() || undefined,
              }
            : t,
        ),
      );
      return {
        ok: true,
        message:
          status === "Verified"
            ? `Verified ${declaration.employee}'s tax declaration.`
            : `Rejected ${declaration.employee}'s tax declaration.`,
      };
    },
    [canVerifyTax, currentUser.name],
  );

  // --------------------------------------------------------------
  // Salary structure — reuses Employee (for site/name) and Masters
  // (SalaryComponent rates) rather than a parallel data source.
  // --------------------------------------------------------------
  const { employees } = useEmployees();
  const { attendance } = useAttendance();
  const { recordsOfType } = useMasters();
  const { configForSite } = useSiteConfig();
  const { leaveRequests } = useLeave();

  const salaryStructures = useSyncExternalStore(
    salaryStructuresStore.subscribe,
    salaryStructuresStore.getSnapshot,
    salaryStructuresStore.getServerSnapshot,
  );
  const payrollRuns = useSyncExternalStore(
    payrollRunsStore.subscribe,
    payrollRunsStore.getSnapshot,
    payrollRunsStore.getServerSnapshot,
  );
  const payslips = useSyncExternalStore(payslipsStore.subscribe, payslipsStore.getSnapshot, payslipsStore.getServerSnapshot);

  const canManageSalary = canFeature("payroll.salary", "edit") || canFeature("payroll.salary", "manage");
  const canProcessPayroll = canFeature("payroll.payslips", "manage");
  const canApprovePayroll = canFeature("payroll.payslips", "manage");

  const salaryStructureFor = useCallback(
    (employeeId: string) => salaryStructures.find((s) => s.employeeId === employeeId),
    [salaryStructures],
  );

  const defaultSalaryLinesFor = useCallback(
    (siteId: string, ctcAnnual: number) => {
      const siteComponents = recordsOfType("SalaryComponent").filter((c) => c.siteId === siteId);
      const rates = resolveComponentRates(siteComponents);
      return buildDefaultSalaryLines(ctcAnnual, rates);
    },
    [recordsOfType],
  );

  const saveSalaryStructure = useCallback(
    (input: { employeeId: string; siteId: string; ctcAnnual: number; earnings: SalaryLine[]; deductions: SalaryLine[] }): ActionResult => {
      if (!canManageSalary) return { ok: false, message: "You're not authorized to manage salary structures." };
      if (input.ctcAnnual <= 0) return { ok: false, message: "Annual CTC must be greater than zero." };
      const grossMonthly = input.earnings.reduce((sum, e) => sum + e.amount, 0);
      const existing = salaryStructuresStore.getSnapshot().find((s) => s.employeeId === input.employeeId);
      const record: EmployeeSalaryStructure = {
        id: existing?.id ?? `salary-${input.employeeId}-${Date.now().toString(36)}`,
        employeeId: input.employeeId,
        siteId: input.siteId,
        effectiveFrom: existing?.effectiveFrom ?? new Date().toISOString().slice(0, 10),
        ctcAnnual: input.ctcAnnual,
        earnings: input.earnings,
        deductions: input.deductions,
        grossMonthly,
        updatedOn: new Date().toISOString(),
        updatedBy: currentUser.name,
      };
      salaryStructuresStore.set(
        existing
          ? salaryStructuresStore.getSnapshot().map((s) => (s.id === existing.id ? record : s))
          : [record, ...salaryStructuresStore.getSnapshot()],
      );
      return { ok: true, message: "Salary structure saved." };
    },
    [canManageSalary, currentUser.name],
  );

  // --------------------------------------------------------------
  // Payroll runs / payslips
  // --------------------------------------------------------------
  const runsForSite = useCallback((siteId: string) => payrollRuns.filter((r) => r.siteId === siteId), [payrollRuns]);
  const runForMonth = useCallback(
    (siteId: string, month: string) => payrollRuns.find((r) => r.siteId === siteId && r.month === month),
    [payrollRuns],
  );
  const payslipsForRun = useCallback((runId: string) => payslips.filter((p) => p.runId === runId), [payslips]);
  const payslipsForEmployee = useCallback(
    (employeeId: string) => payslips.filter((p) => p.employeeId === employeeId),
    [payslips],
  );
  const latestPayslipFor = useCallback(
    (employeeId: string) =>
      payslipsForEmployee(employeeId)
        .filter((p) => {
          const run = payrollRuns.find((r) => r.id === p.runId);
          return run && run.status !== "Processing"; // only Approved/Locked runs are visible as "official"
        })
        .sort((a, b) => (a.month < b.month ? 1 : -1))[0],
    [payslipsForEmployee, payrollRuns],
  );

  /** Computes what a run WOULD produce, without persisting anything. */
  const previewPayrollRun = useCallback(
    (siteId: string, month: string): PayrollPreviewRow[] => {
      const siteEmployees = employees.filter((e) => e.siteId === siteId);
      const siteConfig = configForSite(siteId);
      const workingDays = siteConfig?.attendance.workingDays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"];
      const today = new Date().toISOString().slice(0, 10);
      const workingDayDates = listWorkingDaysInMonth(month, workingDays, today);

      const siteLeaveTypes = recordsOfType("LeaveType").filter((r) => r.siteId === siteId);
      const isPaidLeaveType = (request: { type: string }) => {
        const rec = siteLeaveTypes.find((r) => r.name === request.type);
        return rec ? rec.attributes.paid !== false : true;
      };
      const approvedLeaveInMonth = leaveRequests.filter(
        (r) => r.siteId === siteId && r.status === "Approved" && r.from <= (workingDayDates.at(-1) ?? month) && r.to >= (workingDayDates[0] ?? month),
      );

      return siteEmployees.map((emp) => {
        const structure = salaryStructures.find((s) => s.employeeId === emp.employeeId);
        if (!structure) {
          return { employeeId: emp.employeeId, employeeName: emp.name, hasSalaryStructure: false };
        }
        const monthRecords = attendance.filter((r) => r.employeeId === emp.employeeId && r.date.startsWith(month));
        const empApprovedLeave = approvedLeaveInMonth.filter((r) => r.employeeId === emp.employeeId);
        const leaveByDate = computeLeaveDaysForPayroll(empApprovedLeave, workingDayDates, isPaidLeaveType);
        const attendanceStats = computeAttendanceForPayroll(monthRecords, workingDayDates, leaveByDate);
        const activeLoans = loans.filter((l) => l.employeeId === emp.employeeId && l.status === "Active");
        const result = calculatePayslip({ salaryStructure: structure, attendance: attendanceStats, activeLoans });
        return { employeeId: emp.employeeId, employeeName: emp.name, hasSalaryStructure: true, result };
      });
    },
    [employees, configForSite, attendance, salaryStructures, loans, recordsOfType, leaveRequests],
  );

  const processPayrollRun = useCallback(
    (siteId: string, month: string): ActionResult & { run?: PayrollRun } => {
      if (!canProcessPayroll) return { ok: false, message: "You're not authorized to process payroll." };
      if (payrollRunsStore.getSnapshot().some((r) => r.siteId === siteId && r.month === month)) {
        return { ok: false, message: `A payroll run for ${month} already exists for this site.` };
      }
      const rows = previewPayrollRun(siteId, month).filter((r) => r.hasSalaryStructure && r.result);
      if (rows.length === 0) {
        return { ok: false, message: "No employees with a salary structure configured — nothing to process." };
      }
      const now = new Date().toISOString();
      const runId = `run-${siteId}-${month}-${Date.now().toString(36)}`;
      const newPayslips: PayrollPayslip[] = rows.map((r) => ({
        id: `payslip-${r.employeeId}-${month}`,
        runId,
        employeeId: r.employeeId,
        siteId,
        month,
        earnings: r.result!.earnings,
        deductions: r.result!.deductions,
        workingDays: r.result!.workingDays,
        paidDays: r.result!.paidDays,
        lopDays: r.result!.lopDays,
        overtimeHours: r.result!.overtimeHours,
        overtimeAmount: r.result!.overtimeAmount,
        grossEarnings: r.result!.grossEarnings,
        totalDeductions: r.result!.totalDeductions,
        netPay: r.result!.netPay,
        generatedOn: now,
      }));
      const run: PayrollRun = {
        id: runId,
        siteId,
        month,
        status: "Processing",
        employeeCount: newPayslips.length,
        totalGross: newPayslips.reduce((sum, p) => sum + p.grossEarnings, 0),
        totalDeductions: newPayslips.reduce((sum, p) => sum + p.totalDeductions, 0),
        totalNet: newPayslips.reduce((sum, p) => sum + p.netPay, 0),
        createdOn: now,
        createdBy: currentUser.name,
      };
      payslipsStore.set([...newPayslips, ...payslipsStore.getSnapshot()]);
      payrollRunsStore.set([run, ...payrollRunsStore.getSnapshot()]);
      return { ok: true, message: `Payroll processed for ${month} — ${newPayslips.length} payslip(s) generated.`, run };
    },
    [canProcessPayroll, previewPayrollRun, currentUser.name],
  );

  const approvePayrollRun = useCallback(
    (id: string): ActionResult => {
      if (!canApprovePayroll) return { ok: false, message: "You're not authorized to approve payroll." };
      const run = payrollRunsStore.getSnapshot().find((r) => r.id === id);
      if (!run) return { ok: false, message: "Payroll run not found." };
      if (run.status !== "Processing") return { ok: false, message: "Only a run in Processing can be approved." };
      payrollRunsStore.set(
        payrollRunsStore
          .getSnapshot()
          .map((r) => (r.id === id ? { ...r, status: "Approved" as const, approvedOn: new Date().toISOString(), approvedBy: currentUser.name } : r)),
      );
      return { ok: true, message: `Payroll run for ${run.month} approved.` };
    },
    [canApprovePayroll, currentUser.name],
  );

  const lockPayrollRun = useCallback(
    (id: string): ActionResult => {
      if (!canApprovePayroll) return { ok: false, message: "You're not authorized to lock payroll." };
      const run = payrollRunsStore.getSnapshot().find((r) => r.id === id);
      if (!run) return { ok: false, message: "Payroll run not found." };
      if (run.status !== "Approved") return { ok: false, message: "Only an Approved run can be locked." };

      // Commit loan EMI deductions from this run's payslips against outstanding balances.
      const runPayslips = payslipsStore.getSnapshot().filter((p) => p.runId === id);
      let updatedLoans = employeeLoansStore.getSnapshot();
      for (const slip of runPayslips) {
        const emiLine = slip.deductions.find((d) => d.componentId === "loan-emi");
        if (!emiLine) continue;
        const employeeActiveLoans = updatedLoans.filter((l) => l.employeeId === slip.employeeId && l.status === "Active");
        let remaining = emiLine.amount;
        updatedLoans = updatedLoans.map((l) => {
          if (l.employeeId !== slip.employeeId || l.status !== "Active" || remaining <= 0) return l;
          if (!employeeActiveLoans.includes(l)) return l;
          const applied = Math.min(remaining, l.outstandingAmount);
          remaining -= applied;
          const newOutstanding = l.outstandingAmount - applied;
          return { ...l, outstandingAmount: newOutstanding, status: newOutstanding <= 0 ? ("Closed" as const) : l.status };
        });
      }
      employeeLoansStore.set(updatedLoans);

      payrollRunsStore.set(
        payrollRunsStore
          .getSnapshot()
          .map((r) => (r.id === id ? { ...r, status: "Locked" as const, lockedOn: new Date().toISOString(), lockedBy: currentUser.name } : r)),
      );
      return { ok: true, message: `Payroll run for ${run.month} locked. Loan balances updated.` };
    },
    [canApprovePayroll, currentUser.name],
  );

  const value = useMemo<PayrollContextValue>(
    () => ({
      loans,
      taxDeclarations,
      loansFor,
      visibleLoans,
      canDecideLoans,
      applyLoan,
      decideLoan,
      taxDeclarationsFor,
      visibleTaxDeclarations,
      canVerifyTax,
      submitTaxDeclaration,
      decideTaxDeclaration,
      salaryStructures,
      salaryStructureFor,
      canManageSalary,
      defaultSalaryLinesFor,
      saveSalaryStructure,
      payrollRuns,
      payslips,
      runsForSite,
      runForMonth,
      payslipsForRun,
      payslipsForEmployee,
      latestPayslipFor,
      canProcessPayroll,
      canApprovePayroll,
      previewPayrollRun,
      processPayrollRun,
      approvePayrollRun,
      lockPayrollRun,
    }),
    [
      loans,
      taxDeclarations,
      loansFor,
      visibleLoans,
      canDecideLoans,
      applyLoan,
      decideLoan,
      taxDeclarationsFor,
      visibleTaxDeclarations,
      canVerifyTax,
      submitTaxDeclaration,
      decideTaxDeclaration,
      salaryStructures,
      salaryStructureFor,
      canManageSalary,
      defaultSalaryLinesFor,
      saveSalaryStructure,
      payrollRuns,
      payslips,
      runsForSite,
      runForMonth,
      payslipsForRun,
      payslipsForEmployee,
      latestPayslipFor,
      canProcessPayroll,
      canApprovePayroll,
      previewPayrollRun,
      processPayrollRun,
      approvePayrollRun,
      lockPayrollRun,
    ],
  );

  return <PayrollContext.Provider value={value}>{children}</PayrollContext.Provider>;
}

export function usePayroll() {
  const ctx = useContext(PayrollContext);
  if (!ctx) throw new Error("usePayroll must be used within a PayrollProvider");
  return ctx;
}

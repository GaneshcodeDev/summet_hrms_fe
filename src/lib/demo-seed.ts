"use client";

/**
 * Optional developer/demo data loader. The real product starts empty — 1
 * Super Admin, 0 sites, 0 employees, 0 of everything else (see the Phase 2
 * architecture note in AGENTS.md). This is the explicit opt-in path to
 * hydrate every store with the original rich multi-site demo dataset in one
 * action, for development/testing/demos. Never called automatically.
 */
import { sites } from "@/lib/mock-data";
import { sitesStore } from "@/lib/site-context";
import { demoUserAccounts, seedDeviceSessions, seedSecurityEvents } from "@/lib/rbac-data";
import { accountsStore, deviceSessionsStore, securityEventsStore } from "@/lib/rbac-store";
import { bankDetailsStore, demoEmployeeSeed, employeeDocumentsStore, employeesStore } from "@/lib/employee-store";
import { seedOrgAuditEntries, seedOrgUnits } from "@/lib/org-data";
import { orgAuditStore, orgUnitsStore } from "@/lib/org-store";
import { seedMasterRecords } from "@/lib/master-data";
import { masterRecordsStore } from "@/lib/master-store";
import { seedLeaveAuditEntries, seedLeaveBalances, seedLeaveRequests } from "@/lib/leave-data";
import { leaveAuditStore, leaveBalancesStore, leaveRequestsStore } from "@/lib/leave-store";
import { seedEmployeeLoans, seedTaxDeclarations } from "@/lib/payroll-data";
import { employeeLoansStore, taxDeclarationsStore } from "@/lib/payroll-store";
import { seedRegularizations } from "@/lib/regularization-data";
import { regularizationsStore } from "@/lib/regularization-store";
import { attendanceStore } from "@/lib/attendance-store";
import { seedOnboardingAudit, seedOnboardingCases } from "@/lib/onboarding-data";
import { onboardingAuditStore, onboardingCasesStore } from "@/lib/onboarding-store";
import { seedOffboardingAudit, seedSeparationCases } from "@/lib/offboarding-data";
import { offboardingAuditStore, separationCasesStore } from "@/lib/offboarding-store";
import { salaryStructuresStore, payrollRunsStore, payslipsStore } from "@/lib/payroll-store";
import {
  buildDefaultSalaryLines,
  calculatePayslip,
  listWorkingDaysInMonth,
  resolveComponentRates,
} from "@/lib/payroll-engine";
import type {
  AttendanceRecord,
  AttendanceStatus,
  Employee,
  EmployeeBankDetail,
  EmployeeDocumentRecord,
  EmployeeLoan,
  EmployeeSalaryStructure,
  MasterRecord,
  PayrollPayslip,
  PayrollRun,
} from "@/lib/types";

/**
 * Generates attendance for the last 10 working days for real employees —
 * never a static array, and never for employees that don't exist. Rebuilt
 * from today's date each time demo data is (re)loaded, so it's never stuck
 * on a stale hardcoded month.
 */
function generateDemoAttendance(employees: Employee[]): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const now = new Date();
  let daysCollected = 0;
  let cursor = 0;

  while (daysCollected < 10 && cursor < 30) {
    const day = new Date(now);
    day.setDate(day.getDate() - cursor);
    cursor += 1;
    const dow = day.getDay(); // 0 = Sunday, 6 = Saturday
    if (dow === 0 || dow === 6) continue; // demo default: Sat/Sun off
    daysCollected += 1;
    const dateStr = day.toISOString().slice(0, 10);

    employees.forEach((emp, i) => {
      const seed = (emp.employeeId.charCodeAt(emp.employeeId.length - 1) + i + cursor) % 10;
      const nowIso = new Date().toISOString();
      let status: AttendanceStatus = "Present";
      let punchIn = "09:0" + (seed % 6);
      let punchOut = "18:0" + ((seed + 2) % 6);
      let lateMinutes = 0;
      if (seed === 7) {
        status = "Absent";
        punchIn = "";
        punchOut = "";
      } else if (seed === 8) {
        status = "On Leave";
        punchIn = "";
        punchOut = "";
      } else if (seed === 9) {
        status = "Late";
        punchIn = "09:45";
        lateMinutes = 30;
      }
      records.push({
        id: `att-${emp.employeeId}-${dateStr}`,
        employeeId: emp.employeeId,
        siteId: emp.siteId,
        date: dateStr,
        punchIn: punchIn || undefined,
        punchOut: punchOut || undefined,
        status,
        shiftId: emp.shiftId,
        workedHours: punchIn && punchOut ? 8.5 : 0,
        overtimeHours: 0,
        lateMinutes,
        earlyLeavingMinutes: 0,
        source: "MANUAL",
        createdOn: nowIso,
        updatedOn: nowIso,
      });
    });
  }
  return records;
}

/** One salary structure per demo employee, built through the same engine every real site uses. */
function generateDemoSalaryStructures(employees: Employee[], masterRecords: MasterRecord[]): EmployeeSalaryStructure[] {
  const now = new Date().toISOString();
  return employees.map((emp, i) => {
    const seed = (emp.employeeId.charCodeAt(emp.employeeId.length - 1) + i) % 5;
    const ctcAnnual = 400000 + seed * 60000;
    const siteComponents = masterRecords.filter((r) => r.masterType === "SalaryComponent" && r.siteId === emp.siteId);
    const rates = resolveComponentRates(siteComponents);
    const { earnings, deductions, grossMonthly } = buildDefaultSalaryLines(ctcAnnual, rates);
    return {
      id: `salary-${emp.employeeId}`,
      employeeId: emp.employeeId,
      siteId: emp.siteId,
      effectiveFrom: emp.dateOfJoining,
      ctcAnnual,
      earnings,
      deductions,
      grossMonthly,
      updatedOn: now,
      updatedBy: "Demo Seed",
    };
  });
}

/** A fully Locked payroll run for last month, so "My Latest Payslip" has something real to show right after loading demo data. */
function generateDemoPayrollRun(
  employees: Employee[],
  salaryStructures: EmployeeSalaryStructure[],
  loans: EmployeeLoan[],
): { runs: PayrollRun[]; payslips: PayrollPayslip[] } {
  const now = new Date();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const workingDayDates = listWorkingDaysInMonth(month, ["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const workingDays = workingDayDates.length;

  const runs: PayrollRun[] = [];
  const payslips: PayrollPayslip[] = [];
  const siteIds = Array.from(new Set(employees.map((e) => e.siteId)));

  for (const siteId of siteIds) {
    const siteEmployees = employees.filter((e) => e.siteId === siteId);
    const runPayslips: PayrollPayslip[] = [];
    const runId = `run-${siteId}-${month}-demo`;

    for (const emp of siteEmployees) {
      const structure = salaryStructures.find((s) => s.employeeId === emp.employeeId);
      if (!structure) continue;
      const activeLoans = loans.filter((l) => l.employeeId === emp.employeeId && l.status === "Active");
      // Demo history assumes full attendance for the closed month (no LOP/overtime) — keeps the seed simple and honest.
      const result = calculatePayslip({
        salaryStructure: structure,
        attendance: { workingDays, paidDays: workingDays, lopDays: 0, overtimeHours: 0 },
        activeLoans,
      });
      runPayslips.push({
        id: `payslip-${emp.employeeId}-${month}`,
        runId,
        employeeId: emp.employeeId,
        siteId,
        month,
        earnings: result.earnings,
        deductions: result.deductions,
        workingDays: result.workingDays,
        paidDays: result.paidDays,
        lopDays: result.lopDays,
        overtimeHours: result.overtimeHours,
        overtimeAmount: result.overtimeAmount,
        grossEarnings: result.grossEarnings,
        totalDeductions: result.totalDeductions,
        netPay: result.netPay,
        generatedOn: now.toISOString(),
      });
    }

    if (runPayslips.length === 0) continue;
    runs.push({
      id: runId,
      siteId,
      month,
      status: "Locked",
      employeeCount: runPayslips.length,
      totalGross: runPayslips.reduce((sum, p) => sum + p.grossEarnings, 0),
      totalDeductions: runPayslips.reduce((sum, p) => sum + p.totalDeductions, 0),
      totalNet: runPayslips.reduce((sum, p) => sum + p.netPay, 0),
      createdOn: now.toISOString(),
      createdBy: "Demo Seed",
      approvedOn: now.toISOString(),
      approvedBy: "Demo Seed",
      lockedOn: now.toISOString(),
      lockedBy: "Demo Seed",
    });
    payslips.push(...runPayslips);
  }

  return { runs, payslips };
}

const demoBanks = ["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Mahindra Bank"];

/** One bank record per demo employee — deterministic per employee, not random. */
function generateDemoBankDetails(employees: Employee[]): EmployeeBankDetail[] {
  const now = new Date().toISOString();
  return employees.map((emp, i) => ({
    id: `bank-${emp.employeeId}`,
    employeeId: emp.employeeId,
    siteId: emp.siteId,
    accountHolderName: emp.name,
    bankName: demoBanks[i % demoBanks.length],
    accountNumber: `XXXX XXXX ${String(1000 + i * 37).slice(-4)}`,
    ifsc: `${demoBanks[i % demoBanks.length].slice(0, 4).toUpperCase().replace(/\s/g, "")}0${String(100000 + i).slice(-6)}`,
    branch: emp.location || "Head Office",
    accountType: i % 4 === 0 ? "Current" : "Savings",
    updatedOn: now,
    updatedBy: "Demo Seed",
  }));
}

const demoDocumentTypes = ["Aadhar Card", "PAN Card", "Offer Letter", "Educational Certificate"];

/** A handful of identity/employment documents per demo employee. */
function generateDemoDocuments(employees: Employee[]): EmployeeDocumentRecord[] {
  const records: EmployeeDocumentRecord[] = [];
  employees.forEach((emp) => {
    demoDocumentTypes.forEach((type, i) => {
      records.push({
        id: `doc-${emp.employeeId}-${i}`,
        employeeId: emp.employeeId,
        siteId: emp.siteId,
        documentType: type,
        status: i === demoDocumentTypes.length - 1 ? "Pending" : "Verified",
        uploadedOn: emp.dateOfJoining,
        verifiedBy: i === demoDocumentTypes.length - 1 ? undefined : "HR Admin",
        verifiedOn: i === demoDocumentTypes.length - 1 ? undefined : emp.dateOfJoining,
      });
    });
  });
  return records;
}

/** Overwrites every store with the full rich demo dataset (4 sites, 10 employees, ...). */
export function loadDemoData() {
  sitesStore.set(sites);
  employeesStore.set(demoEmployeeSeed);
  accountsStore.set(demoUserAccounts);
  deviceSessionsStore.set(seedDeviceSessions);
  securityEventsStore.set(seedSecurityEvents);
  orgUnitsStore.set(seedOrgUnits);
  orgAuditStore.set(seedOrgAuditEntries);
  masterRecordsStore.set(seedMasterRecords);
  leaveRequestsStore.set(seedLeaveRequests);
  leaveBalancesStore.set(seedLeaveBalances);
  leaveAuditStore.set(seedLeaveAuditEntries);
  employeeLoansStore.set(seedEmployeeLoans);
  taxDeclarationsStore.set(seedTaxDeclarations);
  regularizationsStore.set(seedRegularizations);
  attendanceStore.set(generateDemoAttendance(demoEmployeeSeed));
  bankDetailsStore.set(generateDemoBankDetails(demoEmployeeSeed));
  employeeDocumentsStore.set(generateDemoDocuments(demoEmployeeSeed));
  onboardingCasesStore.set(seedOnboardingCases);
  onboardingAuditStore.set(seedOnboardingAudit);
  separationCasesStore.set(seedSeparationCases);
  offboardingAuditStore.set(seedOffboardingAudit);

  const salaryStructures = generateDemoSalaryStructures(demoEmployeeSeed, seedMasterRecords);
  salaryStructuresStore.set(salaryStructures);
  const { runs, payslips } = generateDemoPayrollRun(demoEmployeeSeed, salaryStructures, seedEmployeeLoans);
  payrollRunsStore.set(runs);
  payslipsStore.set(payslips);
}

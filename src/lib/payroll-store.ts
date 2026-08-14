"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import type { EmployeeLoan, EmployeeSalaryStructure, PayrollPayslip, PayrollRun, TaxDeclaration } from "@/lib/types";

// Real product starts with zero payroll records — see demo-seed.ts for the optional rich dataset.
export const employeeLoansStore = createLocalStorageStore<EmployeeLoan[]>("hrms_employee_loans", []);
export const taxDeclarationsStore = createLocalStorageStore<TaxDeclaration[]>("hrms_tax_declarations", []);
export const salaryStructuresStore = createLocalStorageStore<EmployeeSalaryStructure[]>("hrms_salary_structures", []);
export const payrollRunsStore = createLocalStorageStore<PayrollRun[]>("hrms_payroll_runs", []);
export const payslipsStore = createLocalStorageStore<PayrollPayslip[]>("hrms_payslips", []);

export function findSalaryStructure(employeeId: string): EmployeeSalaryStructure | undefined {
  return salaryStructuresStore.getSnapshot().find((s) => s.employeeId === employeeId);
}

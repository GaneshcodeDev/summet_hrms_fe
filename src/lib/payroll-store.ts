"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import { seedEmployeeLoans, seedTaxDeclarations } from "@/lib/payroll-data";
import type { EmployeeLoan, TaxDeclaration } from "@/lib/types";

export const employeeLoansStore = createLocalStorageStore<EmployeeLoan[]>("hrms_employee_loans", seedEmployeeLoans);
export const taxDeclarationsStore = createLocalStorageStore<TaxDeclaration[]>(
  "hrms_tax_declarations",
  seedTaxDeclarations,
);

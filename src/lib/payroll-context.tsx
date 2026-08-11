"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { employeeLoansStore, taxDeclarationsStore } from "@/lib/payroll-store";
import { useAccessControl } from "@/lib/access-control-context";
import type { EmployeeLoan, LoanStatus, LoanType, TaxDeclaration, TaxRegime } from "@/lib/types";

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
    ],
  );

  return <PayrollContext.Provider value={value}>{children}</PayrollContext.Provider>;
}

export function usePayroll() {
  const ctx = useContext(PayrollContext);
  if (!ctx) throw new Error("usePayroll must be used within a PayrollProvider");
  return ctx;
}

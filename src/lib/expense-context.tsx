"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { expenseAuditStore, expenseClaimsStore, logExpenseAudit, travelRequestsStore } from "@/lib/expense-store";
import { expenseCategoryConfig } from "@/lib/expense-data";
import { employees } from "@/lib/mock-data";
import { useAccessControl } from "@/lib/access-control-context";
import { useApprovals } from "@/lib/approval-context";
import type {
  ExpenseClaim,
  ExpenseClaimStatus,
  ExpenseItem,
  ExpenseAuditEntry,
  TravelMode,
  TravelRequest,
  TravelRequestStatus,
} from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

interface CreateTravelInput {
  purpose: string;
  destination: string;
  mode: TravelMode;
  fromDate: string;
  toDate: string;
  estimatedCost: number;
}

interface AddItemInput {
  date: string;
  category: ExpenseItem["category"];
  amount: number;
  description: string;
  hasReceipt: boolean;
  overLimitNote?: string;
}

interface ExpenseContextValue {
  travelRequests: TravelRequest[];
  expenseClaims: ExpenseClaim[];
  auditEntries: ExpenseAuditEntry[];
  hasBroadTravelScope: boolean;
  hasBroadClaimScope: boolean;
  canApproveTravel: boolean;
  canApproveClaims: boolean;
  requestsFor: (employeeId: string) => TravelRequest[];
  claimsFor: (employeeId: string) => ExpenseClaim[];
  visibleTeamTravelRequests: () => TravelRequest[];
  visibleTeamClaims: () => ExpenseClaim[];
  canDecideTravel: (request: TravelRequest) => boolean;
  canManagerDecide: (claim: ExpenseClaim) => boolean;
  canFinanceDecide: (claim: ExpenseClaim) => boolean;
  createTravelRequest: (input: CreateTravelInput) => ActionResult;
  decideTravelRequest: (id: string, status: TravelRequestStatus, reason?: string) => ActionResult;
  createExpenseClaim: (title: string, travelRequestId?: string) => ActionResult;
  addExpenseItem: (claimId: string, input: AddItemInput) => ActionResult;
  removeExpenseItem: (claimId: string, itemId: string) => ActionResult;
  submitClaim: (claimId: string) => ActionResult;
  managerDecideClaim: (claimId: string, status: "Manager Approved" | "Rejected", reason?: string) => ActionResult;
  financeDecideClaim: (claimId: string, status: "Finance Approved" | "Rejected", reason?: string) => ActionResult;
  markReimbursed: (claimId: string, reference: string) => ActionResult;
  cancelClaim: (claimId: string) => ActionResult;
}

const ExpenseContext = createContext<ExpenseContextValue | undefined>(undefined);

function itemsTotal(items: ExpenseItem[]) {
  return items.reduce((sum, i) => sum + i.amount, 0);
}

export function ExpenseProvider({ children }: { children: ReactNode }) {
  const { currentUser, canFeature } = useAccessControl();
  const { recordMirroredAction } = useApprovals();

  const travelRequests = useSyncExternalStore(
    travelRequestsStore.subscribe,
    travelRequestsStore.getSnapshot,
    travelRequestsStore.getServerSnapshot,
  );
  const expenseClaims = useSyncExternalStore(
    expenseClaimsStore.subscribe,
    expenseClaimsStore.getSnapshot,
    expenseClaimsStore.getServerSnapshot,
  );
  const auditEntries = useSyncExternalStore(
    expenseAuditStore.subscribe,
    expenseAuditStore.getSnapshot,
    expenseAuditStore.getServerSnapshot,
  );

  const hasBroadTravelScope = canFeature("expenses.travel", "edit") || canFeature("expenses.travel", "manage");
  const hasBroadClaimScope = canFeature("expenses.claims", "edit") || canFeature("expenses.claims", "manage");
  const canApproveTravel = canFeature("expenses.travel", "approve") || canFeature("expenses.travel", "reject") || hasBroadTravelScope;
  const canApproveClaims = canFeature("expenses.claims", "approve") || canFeature("expenses.claims", "reject") || hasBroadClaimScope;

  const isDirectManagerOf = useCallback(
    (employeeId: string) => employees.find((e) => e.employeeId === employeeId)?.reportingManagerId === currentUser.employeeId,
    [currentUser.employeeId],
  );

  const requestsFor = useCallback((employeeId: string) => travelRequests.filter((r) => r.employeeId === employeeId), [travelRequests]);
  const claimsFor = useCallback((employeeId: string) => expenseClaims.filter((c) => c.employeeId === employeeId), [expenseClaims]);

  const visibleTeamTravelRequests = useCallback(() => {
    if (!canApproveTravel) return [];
    if (hasBroadTravelScope) return travelRequests.filter((r) => r.employeeId !== currentUser.employeeId);
    return travelRequests.filter((r) => isDirectManagerOf(r.employeeId));
  }, [canApproveTravel, hasBroadTravelScope, travelRequests, currentUser.employeeId, isDirectManagerOf]);

  const visibleTeamClaims = useCallback(() => {
    if (!canApproveClaims) return [];
    if (hasBroadClaimScope) {
      return expenseClaims.filter((c) => c.employeeId !== currentUser.employeeId && (c.status === "Submitted" || c.status === "Manager Approved"));
    }
    return expenseClaims.filter((c) => c.status === "Submitted" && isDirectManagerOf(c.employeeId));
  }, [canApproveClaims, hasBroadClaimScope, expenseClaims, currentUser.employeeId, isDirectManagerOf]);

  const canDecideTravel = useCallback(
    (request: TravelRequest) => {
      if (request.employeeId === currentUser.employeeId) return false;
      if (!canApproveTravel) return false;
      return hasBroadTravelScope || isDirectManagerOf(request.employeeId);
    },
    [currentUser.employeeId, canApproveTravel, hasBroadTravelScope, isDirectManagerOf],
  );

  const canManagerDecide = useCallback(
    (claim: ExpenseClaim) => {
      if (claim.status !== "Submitted" || claim.employeeId === currentUser.employeeId) return false;
      if (!canApproveClaims) return false;
      return hasBroadClaimScope || isDirectManagerOf(claim.employeeId);
    },
    [currentUser.employeeId, canApproveClaims, hasBroadClaimScope, isDirectManagerOf],
  );

  const canFinanceDecide = useCallback(
    (claim: ExpenseClaim) => claim.status === "Manager Approved" && hasBroadClaimScope,
    [hasBroadClaimScope],
  );

  const mutateClaim = useCallback((claimId: string, fn: (c: ExpenseClaim) => ExpenseClaim) => {
    expenseClaimsStore.set(expenseClaimsStore.getSnapshot().map((c) => (c.id === claimId ? fn(c) : c)));
  }, []);

  const createTravelRequest = useCallback(
    (input: CreateTravelInput): ActionResult => {
      if (!canFeature("expenses.travel", "create") && !hasBroadTravelScope) {
        return { ok: false, message: "You're not authorized to submit travel requests." };
      }
      if (input.estimatedCost <= 0) return { ok: false, message: "Estimated cost must be greater than zero." };
      const request: TravelRequest = {
        id: `tr-${Date.now().toString(36)}`,
        employeeId: currentUser.employeeId,
        employee: currentUser.name,
        purpose: input.purpose,
        destination: input.destination,
        mode: input.mode,
        fromDate: input.fromDate,
        toDate: input.toDate,
        estimatedCost: input.estimatedCost,
        status: "Pending",
        siteId: currentUser.siteId,
        appliedOn: new Date().toISOString().slice(0, 10),
      };
      travelRequestsStore.set([request, ...travelRequestsStore.getSnapshot()]);
      logExpenseAudit({ refId: request.id, employeeName: currentUser.name, action: "travel_requested", actorName: currentUser.name, detail: `Travel request submitted for ${input.destination}` });
      return { ok: true, message: "Travel request submitted for approval." };
    },
    [canFeature, hasBroadTravelScope, currentUser.employeeId, currentUser.name, currentUser.siteId],
  );

  const decideTravelRequest = useCallback(
    (id: string, status: TravelRequestStatus, reason?: string): ActionResult => {
      const request = travelRequestsStore.getSnapshot().find((r) => r.id === id);
      if (!request) return { ok: false, message: "Travel request not found." };
      if (request.status !== "Pending") return { ok: false, message: "This request has already been decided." };
      if (!canDecideTravel(request)) return { ok: false, message: "You're not authorized to decide this request." };
      if (status === "Rejected" && !reason?.trim()) return { ok: false, message: "A reason is required to reject a travel request." };

      travelRequestsStore.set(
        travelRequestsStore.getSnapshot().map((r) =>
          r.id === id
            ? { ...r, status, approverId: currentUser.employeeId, approverName: currentUser.name, decisionReason: reason?.trim() || undefined, decidedOn: new Date().toISOString().slice(0, 10) }
            : r,
        ),
      );
      logExpenseAudit({ refId: id, employeeName: request.employee, action: "travel_decided", actorName: currentUser.name, detail: `Travel request ${status.toLowerCase()}${reason ? ` — ${reason}` : ""}` });
      recordMirroredAction({
        siteId: request.siteId ?? currentUser.siteId,
        module: "Expense",
        recordId: id,
        recordOwnerEmployeeId: request.employeeId,
        recordOwnerName: request.employee,
        approverType: hasBroadTravelScope ? "HR" : "REPORTING_MANAGER",
        action: status === "Approved" ? "APPROVE" : "REJECT",
        newStatus: status === "Approved" ? "Approved" : "Rejected",
        comment: reason,
      });
      return { ok: true, message: `Travel request ${status.toLowerCase()}.` };
    },
    [canDecideTravel, currentUser.employeeId, currentUser.name, currentUser.siteId, hasBroadTravelScope, recordMirroredAction],
  );

  const createExpenseClaim = useCallback(
    (title: string, travelRequestId?: string): ActionResult => {
      if (!title.trim()) return { ok: false, message: "Give the claim a title." };
      const claim: ExpenseClaim = {
        id: `ec-${Date.now().toString(36)}`,
        employeeId: currentUser.employeeId,
        employee: currentUser.name,
        title: title.trim(),
        travelRequestId,
        items: [],
        totalAmount: 0,
        status: "Draft",
        siteId: currentUser.siteId,
      };
      expenseClaimsStore.set([claim, ...expenseClaimsStore.getSnapshot()]);
      logExpenseAudit({ refId: claim.id, employeeName: currentUser.name, action: "created", actorName: currentUser.name, detail: `Expense claim "${title.trim()}" created` });
      return { ok: true, message: "Expense claim created as a draft." };
    },
    [currentUser.employeeId, currentUser.name, currentUser.siteId],
  );

  const addExpenseItem = useCallback(
    (claimId: string, input: AddItemInput): ActionResult => {
      const claim = expenseClaimsStore.getSnapshot().find((c) => c.id === claimId);
      if (!claim) return { ok: false, message: "Expense claim not found." };
      if (claim.employeeId !== currentUser.employeeId) return { ok: false, message: "You can only edit your own claims." };
      if (claim.status !== "Draft") return { ok: false, message: "Only draft claims can be edited." };
      if (input.amount <= 0) return { ok: false, message: "Amount must be greater than zero." };
      const limit = expenseCategoryConfig[input.category].claimLimit;
      if (input.amount > limit && !input.overLimitNote?.trim()) {
        return { ok: false, message: `${input.category} claims over ₹${limit.toLocaleString("en-IN")} need a justification note.` };
      }

      const newItem: ExpenseItem = { id: `exi-${Date.now().toString(36)}`, ...input };
      mutateClaim(claimId, (c) => {
        const items = [...c.items, newItem];
        return { ...c, items, totalAmount: itemsTotal(items) };
      });
      return { ok: true, message: "Expense item added." };
    },
    [currentUser.employeeId, mutateClaim],
  );

  const removeExpenseItem = useCallback(
    (claimId: string, itemId: string): ActionResult => {
      const claim = expenseClaimsStore.getSnapshot().find((c) => c.id === claimId);
      if (!claim) return { ok: false, message: "Expense claim not found." };
      if (claim.employeeId !== currentUser.employeeId) return { ok: false, message: "You can only edit your own claims." };
      if (claim.status !== "Draft") return { ok: false, message: "Only draft claims can be edited." };

      mutateClaim(claimId, (c) => {
        const items = c.items.filter((i) => i.id !== itemId);
        return { ...c, items, totalAmount: itemsTotal(items) };
      });
      return { ok: true, message: "Item removed." };
    },
    [currentUser.employeeId, mutateClaim],
  );

  const submitClaim = useCallback(
    (claimId: string): ActionResult => {
      const claim = expenseClaimsStore.getSnapshot().find((c) => c.id === claimId);
      if (!claim) return { ok: false, message: "Expense claim not found." };
      if (claim.employeeId !== currentUser.employeeId) return { ok: false, message: "You can only submit your own claims." };
      if (claim.status !== "Draft") return { ok: false, message: "This claim has already been submitted." };
      if (claim.items.length === 0) return { ok: false, message: "Add at least one expense item before submitting." };

      mutateClaim(claimId, (c) => ({ ...c, status: "Submitted", submittedOn: new Date().toISOString().slice(0, 10) }));
      logExpenseAudit({ refId: claimId, employeeName: claim.employee, action: "submitted", actorName: currentUser.name, detail: `Claim submitted for ₹${claim.totalAmount.toLocaleString("en-IN")}` });
      // Expense Claims' existing flow is genuinely two-step (Manager, then
      // Finance) — declare both steps up front so the shared Approval
      // History attributes each decision correctly; still purely a mirror,
      // this module's own canManagerDecide/canFinanceDecide keep gating.
      recordMirroredAction({
        siteId: claim.siteId ?? currentUser.siteId,
        module: "Expense",
        recordId: claimId,
        recordOwnerEmployeeId: claim.employeeId,
        recordOwnerName: claim.employee,
        approverType: "REPORTING_MANAGER",
        action: "APPLY",
        newStatus: "Pending",
        steps: [
          { order: 0, approverType: "REPORTING_MANAGER", required: true },
          { order: 1, approverType: "HR", required: true },
        ],
      });
      return { ok: true, message: "Expense claim submitted for approval." };
    },
    [currentUser.employeeId, currentUser.name, currentUser.siteId, mutateClaim, recordMirroredAction],
  );

  const managerDecideClaim = useCallback(
    (claimId: string, status: "Manager Approved" | "Rejected", reason?: string): ActionResult => {
      const claim = expenseClaimsStore.getSnapshot().find((c) => c.id === claimId);
      if (!claim) return { ok: false, message: "Expense claim not found." };
      if (!canManagerDecide(claim)) return { ok: false, message: "You're not authorized to decide this claim." };
      if (status === "Rejected" && !reason?.trim()) return { ok: false, message: "A reason is required to reject a claim." };

      mutateClaim(claimId, (c) => ({
        ...c,
        status,
        managerId: currentUser.employeeId,
        managerName: currentUser.name,
        managerDecisionReason: reason?.trim() || undefined,
        managerDecidedOn: new Date().toISOString().slice(0, 10),
      }));
      logExpenseAudit({
        refId: claimId,
        employeeName: claim.employee,
        action: status === "Manager Approved" ? "manager_approved" : "manager_rejected",
        actorName: currentUser.name,
        detail: status === "Manager Approved" ? "Manager approved" : `Manager rejected — ${reason}`,
      });
      recordMirroredAction({
        siteId: claim.siteId ?? currentUser.siteId,
        module: "Expense",
        recordId: claimId,
        recordOwnerEmployeeId: claim.employeeId,
        recordOwnerName: claim.employee,
        approverType: "REPORTING_MANAGER",
        action: status === "Manager Approved" ? "APPROVE" : "REJECT",
        newStatus: status === "Manager Approved" ? "Pending" : "Rejected",
        comment: reason,
        stepOrder: 0,
        advanceToNextStep: status === "Manager Approved",
      });
      return { ok: true, message: status === "Manager Approved" ? "Claim approved and sent to Finance." : "Claim rejected." };
    },
    [canManagerDecide, currentUser.employeeId, currentUser.name, currentUser.siteId, mutateClaim, recordMirroredAction],
  );

  const financeDecideClaim = useCallback(
    (claimId: string, status: "Finance Approved" | "Rejected", reason?: string): ActionResult => {
      const claim = expenseClaimsStore.getSnapshot().find((c) => c.id === claimId);
      if (!claim) return { ok: false, message: "Expense claim not found." };
      if (!canFinanceDecide(claim)) return { ok: false, message: "You're not authorized to decide this claim." };
      if (status === "Rejected" && !reason?.trim()) return { ok: false, message: "A reason is required to reject a claim." };

      mutateClaim(claimId, (c) => ({
        ...c,
        status,
        financeName: currentUser.name,
        financeDecisionReason: reason?.trim() || undefined,
        financeDecidedOn: new Date().toISOString().slice(0, 10),
      }));
      logExpenseAudit({
        refId: claimId,
        employeeName: claim.employee,
        action: status === "Finance Approved" ? "finance_approved" : "finance_rejected",
        actorName: currentUser.name,
        detail: status === "Finance Approved" ? "Finance approved — ready for reimbursement" : `Finance rejected — ${reason}`,
      });
      recordMirroredAction({
        siteId: claim.siteId ?? currentUser.siteId,
        module: "Expense",
        recordId: claimId,
        recordOwnerEmployeeId: claim.employeeId,
        recordOwnerName: claim.employee,
        approverType: "HR",
        action: status === "Finance Approved" ? "APPROVE" : "REJECT",
        newStatus: status === "Finance Approved" ? "Approved" : "Rejected",
        comment: reason,
        stepOrder: 1,
      });
      return { ok: true, message: status === "Finance Approved" ? "Claim approved for reimbursement." : "Claim rejected." };
    },
    [canFinanceDecide, currentUser.name, currentUser.siteId, mutateClaim, recordMirroredAction],
  );

  const markReimbursed = useCallback(
    (claimId: string, reference: string): ActionResult => {
      const claim = expenseClaimsStore.getSnapshot().find((c) => c.id === claimId);
      if (!claim) return { ok: false, message: "Expense claim not found." };
      if (!hasBroadClaimScope) return { ok: false, message: "You're not authorized to reimburse claims." };
      if (claim.status !== "Finance Approved") return { ok: false, message: "Only finance-approved claims can be reimbursed." };
      if (!reference.trim()) return { ok: false, message: "A payment reference is required." };

      mutateClaim(claimId, (c) => ({ ...c, status: "Reimbursed", reimbursedOn: new Date().toISOString().slice(0, 10), reimbursementReference: reference.trim() }));
      logExpenseAudit({ refId: claimId, employeeName: claim.employee, action: "reimbursed", actorName: currentUser.name, detail: `Reimbursed — ref ${reference.trim()}` });
      return { ok: true, message: "Claim marked as reimbursed." };
    },
    [hasBroadClaimScope, currentUser.name, mutateClaim],
  );

  const cancelClaim = useCallback(
    (claimId: string): ActionResult => {
      const claim = expenseClaimsStore.getSnapshot().find((c) => c.id === claimId);
      if (!claim) return { ok: false, message: "Expense claim not found." };
      if (claim.employeeId !== currentUser.employeeId) return { ok: false, message: "You can only cancel your own claims." };
      if (claim.status !== "Draft") return { ok: false, message: "Only draft claims can be cancelled." };

      expenseClaimsStore.set(expenseClaimsStore.getSnapshot().filter((c) => c.id !== claimId));
      logExpenseAudit({ refId: claimId, employeeName: claim.employee, action: "cancelled", actorName: currentUser.name, detail: "Draft claim discarded" });
      return { ok: true, message: "Draft claim discarded." };
    },
    [currentUser.employeeId, currentUser.name],
  );

  const value = useMemo<ExpenseContextValue>(
    () => ({
      travelRequests,
      expenseClaims,
      auditEntries,
      hasBroadTravelScope,
      hasBroadClaimScope,
      canApproveTravel,
      canApproveClaims,
      requestsFor,
      claimsFor,
      visibleTeamTravelRequests,
      visibleTeamClaims,
      canDecideTravel,
      canManagerDecide,
      canFinanceDecide,
      createTravelRequest,
      decideTravelRequest,
      createExpenseClaim,
      addExpenseItem,
      removeExpenseItem,
      submitClaim,
      managerDecideClaim,
      financeDecideClaim,
      markReimbursed,
      cancelClaim,
    }),
    [
      travelRequests,
      expenseClaims,
      auditEntries,
      hasBroadTravelScope,
      hasBroadClaimScope,
      canApproveTravel,
      canApproveClaims,
      requestsFor,
      claimsFor,
      visibleTeamTravelRequests,
      visibleTeamClaims,
      canDecideTravel,
      canManagerDecide,
      canFinanceDecide,
      createTravelRequest,
      decideTravelRequest,
      createExpenseClaim,
      addExpenseItem,
      removeExpenseItem,
      submitClaim,
      managerDecideClaim,
      financeDecideClaim,
      markReimbursed,
      cancelClaim,
    ],
  );

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
}

export function useExpense() {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error("useExpense must be used within an ExpenseProvider");
  return ctx;
}

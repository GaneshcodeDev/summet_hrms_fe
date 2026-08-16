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
  expenseAuditStore,
  expenseClaimsStore,
  logExpenseAudit,
  nextExpenseClaimId,
  nextTravelRequestId,
  travelRequestsStore,
} from "@/lib/expense-store";
import { itemsTotal, getTravelSettlement, type TravelSettlement } from "@/lib/expense-engine";
import { useAccessControl } from "@/lib/access-control-context";
import { useApprovals } from "@/lib/approval-context";
import { useNotifications } from "@/lib/notification-context";
import { useEmployees } from "@/lib/employee-context";
import { useMasters } from "@/lib/master-context";
import type {
  ExpenseClaim,
  ExpenseClaimStatus,
  ExpenseItem,
  ExpenseAuditEntry,
  TravelMode,
  TravelRequest,
  TravelRequestStatus,
  TravelType,
} from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

interface CreateTravelInput {
  purpose: string;
  travelType: TravelType;
  from: string;
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
}

type EditTravelInput = Partial<CreateTravelInput>;

interface AddItemInput {
  date: string;
  categoryId: string;
  amount: number;
  description: string;
  receiptReference?: string;
  overLimitNote?: string;
}

interface ReimburseInput {
  reference: string;
  amount?: number;
  method?: string;
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
  canEditTravel: (request: TravelRequest) => boolean;
  canManagerDecide: (claim: ExpenseClaim) => boolean;
  canFinanceDecide: (claim: ExpenseClaim) => boolean;
  categoryLimit: (categoryId: string) => number | undefined;
  categoryRequiresReceipt: (categoryId: string) => boolean;
  travelSettlementFor: (requestId: string) => TravelSettlement | undefined;
  createTravelRequest: (input: CreateTravelInput) => ActionResult;
  editTravelRequest: (id: string, patch: EditTravelInput) => ActionResult;
  decideTravelRequest: (id: string, status: TravelRequestStatus, reason?: string) => ActionResult;
  cancelTravelRequest: (id: string) => ActionResult;
  createExpenseClaim: (title: string, travelRequestId?: string) => ActionResult & { claim?: ExpenseClaim };
  addExpenseItem: (claimId: string, input: AddItemInput) => ActionResult;
  removeExpenseItem: (claimId: string, itemId: string) => ActionResult;
  submitClaim: (claimId: string) => ActionResult;
  managerDecideClaim: (claimId: string, status: "Manager Approved" | "Rejected", reason?: string) => ActionResult;
  financeDecideClaim: (claimId: string, status: "Finance Approved" | "Rejected", reason?: string, approvedAmount?: number) => ActionResult;
  markReimbursed: (claimId: string, input: ReimburseInput) => ActionResult;
  cancelClaim: (claimId: string) => ActionResult;
}

const ExpenseContext = createContext<ExpenseContextValue | undefined>(undefined);

export function ExpenseProvider({ children }: { children: ReactNode }) {
  const { currentUser, canFeature } = useAccessControl();
  const { recordMirroredAction } = useApprovals();
  const { notify } = useNotifications();
  const { getEmployeeByEmployeeId } = useEmployees();
  const { recordsOfType } = useMasters();

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

  // "manage" only — NOT "edit". "Edit" on this feature means "an employee may
  // edit their own Draft claim's line items" (a self-service action gated
  // by ownership + Draft status directly in addExpenseItem/removeExpenseItem,
  // never by this flag); it must never be read as org-wide Finance/HR reach.
  const hasBroadTravelScope = canFeature("expenses.travel", "manage");
  const hasBroadClaimScope = canFeature("expenses.claims", "manage");
  const canApproveTravel = canFeature("expenses.travel", "approve") || canFeature("expenses.travel", "reject") || hasBroadTravelScope;
  const canApproveClaims = canFeature("expenses.claims", "approve") || canFeature("expenses.claims", "reject") || hasBroadClaimScope;

  const isDirectManagerOf = useCallback(
    (employeeId: string) => {
      const target = getEmployeeByEmployeeId(employeeId);
      return !!target && target.reportingManagerId === currentUser.employeeId;
    },
    [getEmployeeByEmployeeId, currentUser.employeeId],
  );

  const categoryLimit = useCallback(
    (categoryId: string) => {
      const raw = recordsOfType("ExpenseCategory").find((r) => r.id === categoryId)?.attributes.claimLimit;
      return typeof raw === "number" ? raw : undefined;
    },
    [recordsOfType],
  );
  const categoryRequiresReceipt = useCallback(
    (categoryId: string) => Boolean(recordsOfType("ExpenseCategory").find((r) => r.id === categoryId)?.attributes.requiresReceipt),
    [recordsOfType],
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

  const canEditTravel = useCallback(
    (request: TravelRequest) => request.employeeId === currentUser.employeeId && request.status === "Pending",
    [currentUser.employeeId],
  );

  const canManagerDecide = useCallback(
    (claim: ExpenseClaim) => {
      if (claim.status !== "Submitted" || claim.employeeId === currentUser.employeeId) return false;
      if (!canApproveClaims) return false;
      return hasBroadClaimScope || isDirectManagerOf(claim.employeeId);
    },
    [currentUser.employeeId, canApproveClaims, hasBroadClaimScope, isDirectManagerOf],
  );

  // Unconditional self-check — a Finance/HR user can never finance-approve
  // their own claim, even though hasBroadClaimScope would otherwise let them
  // finance-decide anyone's claim (section 28, defense-in-depth beyond the UI).
  const canFinanceDecide = useCallback(
    (claim: ExpenseClaim) => claim.status === "Manager Approved" && claim.employeeId !== currentUser.employeeId && hasBroadClaimScope,
    [hasBroadClaimScope, currentUser.employeeId],
  );

  const travelSettlementFor = useCallback(
    (requestId: string) => {
      const request = travelRequests.find((r) => r.id === requestId);
      return request ? getTravelSettlement(request, expenseClaims) : undefined;
    },
    [travelRequests, expenseClaims],
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
      if (input.toDate < input.fromDate) return { ok: false, message: "End date can't be before the start date." };
      const request: TravelRequest = {
        id: nextTravelRequestId(),
        employeeId: currentUser.employeeId,
        employee: currentUser.name,
        siteId: currentUser.siteId,
        purpose: input.purpose,
        travelType: input.travelType,
        from: input.from,
        destination: input.destination,
        mode: input.mode,
        fromDate: input.fromDate,
        toDate: input.toDate,
        estimatedCost: input.estimatedCost,
        advanceRequired: input.advanceRequired,
        advanceAmount: input.advanceRequired ? input.advanceAmount : undefined,
        accommodationRequired: input.accommodationRequired,
        transportRequired: input.transportRequired,
        remarks: input.remarks?.trim() || undefined,
        status: "Pending",
        appliedOn: new Date().toISOString().slice(0, 10),
      };
      travelRequestsStore.set([request, ...travelRequestsStore.getSnapshot()]);
      logExpenseAudit({ refId: request.id, employeeName: currentUser.name, action: "travel_requested", actorName: currentUser.name, detail: `Travel request submitted for ${input.destination}` });
      recordMirroredAction({
        siteId: request.siteId,
        module: "Expense",
        recordId: request.id,
        recordOwnerEmployeeId: request.employeeId,
        recordOwnerName: request.employee,
        approverType: "REPORTING_MANAGER",
        action: "APPLY",
        newStatus: "Pending",
      });
      return { ok: true, message: "Travel request submitted for approval." };
    },
    [canFeature, hasBroadTravelScope, currentUser.employeeId, currentUser.name, currentUser.siteId, recordMirroredAction],
  );

  const editTravelRequest = useCallback(
    (id: string, patch: EditTravelInput): ActionResult => {
      const request = travelRequestsStore.getSnapshot().find((r) => r.id === id);
      if (!request) return { ok: false, message: "Travel request not found." };
      if (!canEditTravel(request)) return { ok: false, message: "Only your own pending request can be edited." };
      if (patch.estimatedCost !== undefined && patch.estimatedCost <= 0) return { ok: false, message: "Estimated cost must be greater than zero." };
      travelRequestsStore.set(
        travelRequestsStore.getSnapshot().map((r) =>
          r.id === id
            ? { ...r, ...patch, advanceAmount: (patch.advanceRequired ?? r.advanceRequired) ? (patch.advanceAmount ?? r.advanceAmount) : undefined }
            : r,
        ),
      );
      logExpenseAudit({ refId: id, employeeName: request.employee, action: "travel_edited", actorName: currentUser.name, detail: "Travel request updated" });
      return { ok: true, message: "Travel request updated." };
    },
    [canEditTravel, currentUser.name],
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
        siteId: request.siteId,
        module: "Expense",
        recordId: id,
        recordOwnerEmployeeId: request.employeeId,
        recordOwnerName: request.employee,
        approverType: hasBroadTravelScope ? "HR" : "REPORTING_MANAGER",
        action: status === "Approved" ? "APPROVE" : "REJECT",
        newStatus: status === "Approved" ? "Approved" : "Rejected",
        comment: reason,
      });
      notify({
        employeeId: request.employeeId,
        type: status === "Approved" ? "success" : "warning",
        title: `Travel request ${status.toLowerCase()}`,
        message: `Your trip to ${request.destination} was ${status.toLowerCase()}${reason ? ` — ${reason}` : ""}.`,
        module: "Expense",
        recordId: id,
        href: `/expenses/travel/${id}`,
      });
      return { ok: true, message: `Travel request ${status.toLowerCase()}.` };
    },
    [canDecideTravel, currentUser.employeeId, currentUser.name, hasBroadTravelScope, recordMirroredAction, notify],
  );

  const cancelTravelRequest = useCallback(
    (id: string): ActionResult => {
      const request = travelRequestsStore.getSnapshot().find((r) => r.id === id);
      if (!request) return { ok: false, message: "Travel request not found." };
      if (request.employeeId !== currentUser.employeeId) return { ok: false, message: "You can only cancel your own travel request." };
      if (request.status !== "Pending") return { ok: false, message: "Only a pending travel request can be cancelled." };

      travelRequestsStore.set(travelRequestsStore.getSnapshot().map((r) => (r.id === id ? { ...r, status: "Cancelled" as const, decidedOn: new Date().toISOString().slice(0, 10) } : r)));
      logExpenseAudit({ refId: id, employeeName: request.employee, action: "travel_cancelled", actorName: currentUser.name, detail: "Travel request cancelled by employee" });
      return { ok: true, message: "Travel request cancelled." };
    },
    [currentUser.employeeId, currentUser.name],
  );

  const createExpenseClaim = useCallback(
    (title: string, travelRequestId?: string): ActionResult & { claim?: ExpenseClaim } => {
      if (!canFeature("expenses.claims", "create") && !hasBroadClaimScope) {
        return { ok: false, message: "You're not authorized to create expense claims." };
      }
      if (!title.trim()) return { ok: false, message: "Give the claim a title." };
      const claim: ExpenseClaim = {
        id: nextExpenseClaimId(),
        employeeId: currentUser.employeeId,
        employee: currentUser.name,
        siteId: currentUser.siteId,
        title: title.trim(),
        travelRequestId,
        items: [],
        totalAmount: 0,
        status: "Draft",
      };
      expenseClaimsStore.set([claim, ...expenseClaimsStore.getSnapshot()]);
      logExpenseAudit({ refId: claim.id, employeeName: currentUser.name, action: "created", actorName: currentUser.name, detail: `Expense claim "${title.trim()}" created` });
      return { ok: true, message: "Expense claim created as a draft.", claim };
    },
    [canFeature, hasBroadClaimScope, currentUser.employeeId, currentUser.name, currentUser.siteId],
  );

  const addExpenseItem = useCallback(
    (claimId: string, input: AddItemInput): ActionResult => {
      const claim = expenseClaimsStore.getSnapshot().find((c) => c.id === claimId);
      if (!claim) return { ok: false, message: "Expense claim not found." };
      if (claim.employeeId !== currentUser.employeeId) return { ok: false, message: "You can only edit your own claims." };
      if (claim.status !== "Draft") return { ok: false, message: "Only draft claims can be edited." };
      if (input.amount <= 0) return { ok: false, message: "Amount must be greater than zero." };
      const limit = categoryLimit(input.categoryId);
      if (limit !== undefined && input.amount > limit && !input.overLimitNote?.trim()) {
        return { ok: false, message: `This category's claims over ₹${limit.toLocaleString("en-IN")} need a justification note.` };
      }
      if (categoryRequiresReceipt(input.categoryId) && !input.receiptReference?.trim()) {
        return { ok: false, message: "This category requires a receipt reference." };
      }

      const newItem: ExpenseItem = { id: `exi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, ...input };
      mutateClaim(claimId, (c) => {
        const items = [...c.items, newItem];
        return { ...c, items, totalAmount: itemsTotal(items) };
      });
      return { ok: true, message: "Expense item added." };
    },
    [currentUser.employeeId, mutateClaim, categoryLimit, categoryRequiresReceipt],
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
      // Expense Claims' genuine two-step flow (Manager, then Finance/HR) —
      // declare both steps up front so shared Approval History attributes
      // each decision correctly; this module's own canManagerDecide/
      // canFinanceDecide keep gating who can actually act.
      recordMirroredAction({
        siteId: claim.siteId,
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
    [currentUser.employeeId, currentUser.name, mutateClaim, recordMirroredAction],
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
        siteId: claim.siteId,
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
      notify({
        employeeId: claim.employeeId,
        type: status === "Manager Approved" ? "info" : "warning",
        title: status === "Manager Approved" ? "Claim approved by manager" : "Claim rejected",
        message:
          status === "Manager Approved"
            ? `Your claim "${claim.title}" was approved by your manager and sent to Finance.`
            : `Your claim "${claim.title}" was rejected — ${reason}.`,
        module: "Expense",
        recordId: claimId,
        href: `/expenses/claims/${claimId}`,
      });
      return { ok: true, message: status === "Manager Approved" ? "Claim approved and sent to Finance." : "Claim rejected." };
    },
    [canManagerDecide, currentUser.employeeId, currentUser.name, mutateClaim, recordMirroredAction, notify],
  );

  const financeDecideClaim = useCallback(
    (claimId: string, status: "Finance Approved" | "Rejected", reason?: string, approvedAmount?: number): ActionResult => {
      const claim = expenseClaimsStore.getSnapshot().find((c) => c.id === claimId);
      if (!claim) return { ok: false, message: "Expense claim not found." };
      // canFinanceDecide already includes the self-approval guard, but the
      // check is repeated explicitly here so this stays safe even if a
      // future caller stops routing through canFinanceDecide first.
      if (claim.employeeId === currentUser.employeeId) return { ok: false, message: "You cannot decide your own expense claim." };
      if (!canFinanceDecide(claim)) return { ok: false, message: "You're not authorized to decide this claim." };
      if (status === "Rejected" && !reason?.trim()) return { ok: false, message: "A reason is required to reject a claim." };
      const finalApprovedAmount = status === "Finance Approved" ? Math.min(approvedAmount ?? claim.totalAmount, claim.totalAmount) : undefined;
      if (status === "Finance Approved" && finalApprovedAmount !== undefined && finalApprovedAmount <= 0) {
        return { ok: false, message: "Approved amount must be greater than zero." };
      }

      mutateClaim(claimId, (c) => ({
        ...c,
        status,
        financeName: currentUser.name,
        financeDecisionReason: reason?.trim() || undefined,
        financeDecidedOn: new Date().toISOString().slice(0, 10),
        approvedAmount: finalApprovedAmount,
      }));
      logExpenseAudit({
        refId: claimId,
        employeeName: claim.employee,
        action: status === "Finance Approved" ? "finance_approved" : "finance_rejected",
        actorName: currentUser.name,
        detail:
          status === "Finance Approved"
            ? `Finance approved ₹${(finalApprovedAmount ?? claim.totalAmount).toLocaleString("en-IN")} — ready for reimbursement`
            : `Finance rejected — ${reason}`,
      });
      recordMirroredAction({
        siteId: claim.siteId,
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
      notify({
        employeeId: claim.employeeId,
        type: status === "Finance Approved" ? "success" : "warning",
        title: status === "Finance Approved" ? "Claim approved for reimbursement" : "Claim rejected",
        message:
          status === "Finance Approved"
            ? `Your claim "${claim.title}" was approved by Finance and is ready for reimbursement.`
            : `Your claim "${claim.title}" was rejected by Finance — ${reason}.`,
        module: "Expense",
        recordId: claimId,
        href: `/expenses/claims/${claimId}`,
      });
      return { ok: true, message: status === "Finance Approved" ? "Claim approved for reimbursement." : "Claim rejected." };
    },
    [canFinanceDecide, currentUser.employeeId, currentUser.name, mutateClaim, recordMirroredAction, notify],
  );

  const markReimbursed = useCallback(
    (claimId: string, input: ReimburseInput): ActionResult => {
      const claim = expenseClaimsStore.getSnapshot().find((c) => c.id === claimId);
      if (!claim) return { ok: false, message: "Expense claim not found." };
      if (!hasBroadClaimScope) return { ok: false, message: "You're not authorized to reimburse claims." };
      if (claim.status !== "Finance Approved") return { ok: false, message: "Only finance-approved claims can be reimbursed." };
      if (!input.reference.trim()) return { ok: false, message: "A payment reference is required." };
      const cap = claim.approvedAmount ?? claim.totalAmount;
      const amount = Math.min(input.amount ?? cap, cap);
      if (amount <= 0) return { ok: false, message: "Reimbursed amount must be greater than zero." };

      mutateClaim(claimId, (c) => ({
        ...c,
        status: "Reimbursed",
        reimbursedOn: new Date().toISOString().slice(0, 10),
        reimbursedAmount: amount,
        reimbursementReference: input.reference.trim(),
        reimbursementMethod: input.method?.trim() || undefined,
        reimbursedBy: currentUser.name,
      }));
      logExpenseAudit({ refId: claimId, employeeName: claim.employee, action: "reimbursed", actorName: currentUser.name, detail: `Reimbursed ₹${amount.toLocaleString("en-IN")} — ref ${input.reference.trim()}` });
      notify({
        employeeId: claim.employeeId,
        type: "success",
        title: "Claim reimbursed",
        message: `₹${amount.toLocaleString("en-IN")} for "${claim.title}" was reimbursed — ref ${input.reference.trim()}.`,
        module: "Expense",
        recordId: claimId,
        href: `/expenses/claims/${claimId}`,
      });
      return { ok: true, message: "Claim marked as reimbursed." };
    },
    [hasBroadClaimScope, currentUser.name, mutateClaim, notify],
  );

  const cancelClaim = useCallback(
    (claimId: string): ActionResult => {
      const claim = expenseClaimsStore.getSnapshot().find((c) => c.id === claimId);
      if (!claim) return { ok: false, message: "Expense claim not found." };
      if (claim.employeeId !== currentUser.employeeId) return { ok: false, message: "You can only cancel your own claims." };
      if (claim.status !== "Draft") return { ok: false, message: "Only draft claims can be cancelled." };

      // Marked Cancelled, never deleted — the audit trail (and the claim
      // itself) stays a real historical record (section 31).
      mutateClaim(claimId, (c) => ({ ...c, status: "Cancelled" }));
      logExpenseAudit({ refId: claimId, employeeName: claim.employee, action: "cancelled", actorName: currentUser.name, detail: "Draft claim cancelled" });
      return { ok: true, message: "Draft claim cancelled." };
    },
    [currentUser.employeeId, currentUser.name, mutateClaim],
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
      canEditTravel,
      canManagerDecide,
      canFinanceDecide,
      categoryLimit,
      categoryRequiresReceipt,
      travelSettlementFor,
      createTravelRequest,
      editTravelRequest,
      decideTravelRequest,
      cancelTravelRequest,
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
      canEditTravel,
      canManagerDecide,
      canFinanceDecide,
      categoryLimit,
      categoryRequiresReceipt,
      travelSettlementFor,
      createTravelRequest,
      editTravelRequest,
      decideTravelRequest,
      cancelTravelRequest,
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

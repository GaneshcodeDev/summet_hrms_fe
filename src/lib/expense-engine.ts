import type { ExpenseClaim, ExpenseItem, TravelRequest } from "@/lib/types";

/** The single source of truth for a claim's total — never a manually entered field (section 9). */
export function itemsTotal(items: ExpenseItem[]): number {
  return items.reduce((sum, i) => sum + i.amount, 0);
}

export interface TravelSettlement {
  estimated: number;
  claimed: number;
  approved: number;
  reimbursed: number;
  outstanding: number;
  claims: ExpenseClaim[];
}

/**
 * Estimated (from the Travel Request) vs actual spend, derived live from
 * whatever ExpenseClaims reference this travelRequestId — never a fake or
 * separately-stored settlement figure (section 18).
 */
export function getTravelSettlement(request: TravelRequest, claims: ExpenseClaim[]): TravelSettlement {
  const linked = claims.filter((c) => c.travelRequestId === request.id);
  const claimed = linked.reduce((sum, c) => sum + c.totalAmount, 0);
  const approved = linked.reduce((sum, c) => sum + (c.approvedAmount ?? (c.status === "Reimbursed" ? c.totalAmount : 0)), 0);
  const reimbursed = linked.reduce((sum, c) => sum + (c.reimbursedAmount ?? 0), 0);
  return { estimated: request.estimatedCost, claimed, approved, reimbursed, outstanding: approved - reimbursed, claims: linked };
}

export interface ExpenseSummary {
  totalClaims: number;
  pendingApproval: number;
  approvedForReimbursement: number;
  reimbursed: number;
  claimedAmount: number;
  approvedAmount: number;
  reimbursedAmount: number;
  outstandingAmount: number;
}

/** Real, derived counts for dashboard/report cards — never a fabricated total (sections 20/21). */
export function getExpenseSummary(claims: ExpenseClaim[]): ExpenseSummary {
  const decided = claims.filter((c) => c.status !== "Draft" && c.status !== "Cancelled");
  const approvedAmount = decided.reduce((sum, c) => sum + (c.approvedAmount ?? 0), 0);
  const reimbursedAmount = decided.reduce((sum, c) => sum + (c.reimbursedAmount ?? 0), 0);
  return {
    totalClaims: claims.length,
    pendingApproval: claims.filter((c) => c.status === "Submitted" || c.status === "Manager Approved").length,
    approvedForReimbursement: claims.filter((c) => c.status === "Finance Approved").length,
    reimbursed: claims.filter((c) => c.status === "Reimbursed").length,
    claimedAmount: decided.reduce((sum, c) => sum + c.totalAmount, 0),
    approvedAmount,
    reimbursedAmount,
    outstandingAmount: approvedAmount - reimbursedAmount,
  };
}

export interface TravelSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  estimatedCost: number;
}

export function getTravelSummary(requests: TravelRequest[]): TravelSummary {
  return {
    total: requests.length,
    pending: requests.filter((r) => r.status === "Pending").length,
    approved: requests.filter((r) => r.status === "Approved" || r.status === "Completed").length,
    rejected: requests.filter((r) => r.status === "Rejected").length,
    estimatedCost: requests.filter((r) => r.status === "Approved" || r.status === "Completed").reduce((sum, r) => sum + r.estimatedCost, 0),
  };
}

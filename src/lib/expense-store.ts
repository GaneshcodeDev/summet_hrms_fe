"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import { seedExpenseAudit, seedExpenseClaims, seedTravelRequests } from "@/lib/expense-data";
import type { ExpenseAuditEntry, ExpenseClaim, TravelRequest } from "@/lib/types";

export const travelRequestsStore = createLocalStorageStore<TravelRequest[]>("hrms_travel_requests", seedTravelRequests);
export const expenseClaimsStore = createLocalStorageStore<ExpenseClaim[]>("hrms_expense_claims", seedExpenseClaims);
export const expenseAuditStore = createLocalStorageStore<ExpenseAuditEntry[]>("hrms_expense_audit", seedExpenseAudit);

export function logExpenseAudit(entry: Omit<ExpenseAuditEntry, "id" | "timestamp">) {
  const record: ExpenseAuditEntry = {
    ...entry,
    id: `exp-evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  expenseAuditStore.update((events) => [record, ...events].slice(0, 500));
  return record;
}

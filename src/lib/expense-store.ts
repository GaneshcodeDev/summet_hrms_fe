"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import type { ExpenseAuditEntry, ExpenseClaim, TravelRequest } from "@/lib/types";

// Real product starts with zero travel/expense records — see demo-seed.ts for the optional rich dataset.
export const travelRequestsStore = createLocalStorageStore<TravelRequest[]>("hrms_travel_requests", []);
export const expenseClaimsStore = createLocalStorageStore<ExpenseClaim[]>("hrms_expense_claims", []);
export const expenseAuditStore = createLocalStorageStore<ExpenseAuditEntry[]>("hrms_expense_audit", []);

export function logExpenseAudit(entry: Omit<ExpenseAuditEntry, "id" | "timestamp">) {
  const record: ExpenseAuditEntry = {
    ...entry,
    id: `exp-evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  expenseAuditStore.update((events) => [record, ...events].slice(0, 500));
  return record;
}

function nextSeqId(prefix: string, existingIds: string[]): string {
  const numbers = existingIds
    .map((id) => Number(id.replace(new RegExp(`^${prefix}`, "i"), "")))
    .filter((n) => Number.isFinite(n));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export function nextTravelRequestId(): string {
  return nextSeqId("TR-", travelRequestsStore.getSnapshot().map((r) => r.id));
}
export function nextExpenseClaimId(): string {
  return nextSeqId("EC-", expenseClaimsStore.getSnapshot().map((c) => c.id));
}

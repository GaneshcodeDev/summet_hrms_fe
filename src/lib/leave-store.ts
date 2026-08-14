"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import type { LeaveAuditEntry, LeaveBalance, LeaveRequest } from "@/lib/types";

/**
 * Plain (non-React) persistence for leave requests, balances and their audit
 * trail, mirroring org-store.ts / rbac-store.ts. Real product starts with
 * zero leave records — see demo-seed.ts for the optional rich dataset.
 */
export const leaveRequestsStore = createLocalStorageStore<LeaveRequest[]>("hrms_leave_requests", []);
export const leaveBalancesStore = createLocalStorageStore<LeaveBalance[]>("hrms_leave_balances", []);
export const leaveAuditStore = createLocalStorageStore<LeaveAuditEntry[]>("hrms_leave_audit", []);

export function logLeaveAudit(entry: Omit<LeaveAuditEntry, "id" | "timestamp">) {
  const record: LeaveAuditEntry = {
    ...entry,
    id: `leave-evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  leaveAuditStore.update((events) => [record, ...events].slice(0, 500));
  return record;
}

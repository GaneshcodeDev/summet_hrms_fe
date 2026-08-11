"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { leaveAuditStore, leaveBalancesStore, leaveRequestsStore, logLeaveAudit } from "@/lib/leave-store";
import { leaveTypeConfig } from "@/lib/leave-data";
import { employees } from "@/lib/mock-data";
import { useAccessControl } from "@/lib/access-control-context";
import type { LeaveAuditEntry, LeaveBalance, LeaveRequest, LeaveType } from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

interface ApplyLeaveInput {
  type: LeaveType;
  from: string;
  to: string;
  reason: string;
}

interface LeaveContextValue {
  leaveRequests: LeaveRequest[];
  leaveBalances: LeaveBalance[];
  auditEntries: LeaveAuditEntry[];
  balancesFor: (employeeId: string) => LeaveBalance[];
  requestsFor: (employeeId: string) => LeaveRequest[];
  /** Requests the signed-in user is entitled to see/act on for their team, scoped by RBAC + reporting hierarchy (not site — apply useSiteFilter on top). */
  visibleTeamRequests: () => LeaveRequest[];
  canDecide: (request: LeaveRequest) => boolean;
  applyLeave: (input: ApplyLeaveInput) => ActionResult;
  approveLeave: (id: string, note?: string) => ActionResult;
  rejectLeave: (id: string, reason: string) => ActionResult;
  cancelLeave: (id: string) => ActionResult;
}

const LeaveContext = createContext<LeaveContextValue | undefined>(undefined);

function daysBetween(from: string, to: string) {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  const days = Math.round(ms / 86_400_000) + 1;
  return Number.isFinite(days) && days > 0 ? days : 1;
}

export function LeaveProvider({ children }: { children: ReactNode }) {
  const { currentUser, canFeature } = useAccessControl();

  const leaveRequests = useSyncExternalStore(
    leaveRequestsStore.subscribe,
    leaveRequestsStore.getSnapshot,
    leaveRequestsStore.getServerSnapshot,
  );
  const leaveBalances = useSyncExternalStore(
    leaveBalancesStore.subscribe,
    leaveBalancesStore.getSnapshot,
    leaveBalancesStore.getServerSnapshot,
  );
  const auditEntries = useSyncExternalStore(
    leaveAuditStore.subscribe,
    leaveAuditStore.getSnapshot,
    leaveAuditStore.getServerSnapshot,
  );

  const balancesFor = useCallback(
    (employeeId: string) => leaveBalances.filter((b) => b.employeeId === employeeId),
    [leaveBalances],
  );

  const requestsFor = useCallback(
    (employeeId: string) => leaveRequests.filter((r) => r.employeeId === employeeId),
    [leaveRequests],
  );

  // HR Admin/HR Manager hold "edit" on leave.requests (broad site-wide scope in the
  // permission matrix); Department Head/Manager only hold "approve"/"reject" and are
  // limited to their direct reports below.
  const hasBroadScope = canFeature("leave.requests", "edit") || canFeature("leave.requests", "manage");

  const canDecide = useCallback(
    (request: LeaveRequest) => {
      if (request.employeeId === currentUser.employeeId) return false; // no self-approval
      if (!canFeature("leave.requests", "approve") && !canFeature("leave.requests", "reject")) return false;
      if (hasBroadScope) return true;
      const requester = employees.find((e) => e.employeeId === request.employeeId);
      return requester?.reportingManagerId === currentUser.employeeId;
    },
    [currentUser.employeeId, canFeature, hasBroadScope],
  );

  const visibleTeamRequests = useCallback(() => {
    if (hasBroadScope) return leaveRequests.filter((r) => r.employeeId !== currentUser.employeeId);
    if (!canFeature("leave.requests", "approve") && !canFeature("leave.requests", "reject")) return [];
    const directReportIds = new Set(
      employees.filter((e) => e.reportingManagerId === currentUser.employeeId).map((e) => e.employeeId),
    );
    return leaveRequests.filter((r) => directReportIds.has(r.employeeId));
  }, [leaveRequests, currentUser.employeeId, hasBroadScope, canFeature]);

  const applyLeave = useCallback(
    (input: ApplyLeaveInput): ActionResult => {
      const days = daysBetween(input.from, input.to);
      const bal = leaveBalancesStore
        .getSnapshot()
        .find((b) => b.employeeId === currentUser.employeeId && b.type === input.type);
      const available = bal ? bal.total - bal.used : leaveTypeConfig[input.type].annualQuota;
      if (days > available) {
        return {
          ok: false,
          message: `Insufficient ${input.type} balance — you have ${available} day(s) left but requested ${days}.`,
        };
      }

      const request: LeaveRequest = {
        id: `lv-${Date.now().toString(36)}`,
        employeeId: currentUser.employeeId,
        employee: currentUser.name,
        type: input.type,
        from: input.from,
        to: input.to,
        days,
        status: "Pending",
        reason: input.reason,
        siteId: currentUser.siteId,
        appliedOn: new Date().toISOString().slice(0, 10),
      };
      leaveRequestsStore.set([request, ...leaveRequestsStore.getSnapshot()]);
      logLeaveAudit({
        leaveRequestId: request.id,
        employeeName: request.employee,
        action: "applied",
        actorName: currentUser.name,
        detail: `${input.type} requested for ${days} day(s)`,
      });
      return { ok: true, message: `Leave request submitted for approval (${days} day${days > 1 ? "s" : ""}).` };
    },
    [currentUser.employeeId, currentUser.name, currentUser.siteId],
  );

  const decide = useCallback(
    (id: string, status: "Approved" | "Rejected", decisionReason?: string): ActionResult => {
      const request = leaveRequestsStore.getSnapshot().find((r) => r.id === id);
      if (!request) return { ok: false, message: "Leave request not found." };
      if (request.status !== "Pending") return { ok: false, message: "This request has already been decided." };
      if (!canDecide(request)) return { ok: false, message: "You're not authorized to decide this request." };
      if (status === "Rejected" && !decisionReason?.trim()) {
        return { ok: false, message: "A reason is required to reject a leave request." };
      }

      leaveRequestsStore.set(
        leaveRequestsStore.getSnapshot().map((r) =>
          r.id === id
            ? {
                ...r,
                status,
                approverId: currentUser.employeeId,
                approverName: currentUser.name,
                decisionReason: decisionReason?.trim() || undefined,
                decidedOn: new Date().toISOString().slice(0, 10),
              }
            : r,
        ),
      );

      if (status === "Approved") {
        leaveBalancesStore.set(
          leaveBalancesStore.getSnapshot().map((b) =>
            b.employeeId === request.employeeId && b.type === request.type
              ? { ...b, used: b.used + request.days }
              : b,
          ),
        );
      }

      logLeaveAudit({
        leaveRequestId: id,
        employeeName: request.employee,
        action: status === "Approved" ? "approved" : "rejected",
        actorName: currentUser.name,
        detail:
          status === "Approved"
            ? `${request.type} approved for ${request.days} day(s)${decisionReason ? ` — ${decisionReason}` : ""}`
            : `${request.type} rejected — ${decisionReason}`,
      });

      return {
        ok: true,
        message:
          status === "Approved"
            ? `Approved ${request.employee}'s ${request.type} request.`
            : `Rejected ${request.employee}'s ${request.type} request.`,
      };
    },
    [canDecide, currentUser.employeeId, currentUser.name],
  );

  const approveLeave = useCallback((id: string, note?: string) => decide(id, "Approved", note), [decide]);
  const rejectLeave = useCallback((id: string, reason: string) => decide(id, "Rejected", reason), [decide]);

  const cancelLeave = useCallback(
    (id: string): ActionResult => {
      const request = leaveRequestsStore.getSnapshot().find((r) => r.id === id);
      if (!request) return { ok: false, message: "Leave request not found." };
      if (request.employeeId !== currentUser.employeeId) {
        return { ok: false, message: "You can only cancel your own leave requests." };
      }
      if (request.status !== "Pending") return { ok: false, message: "Only pending requests can be cancelled." };
      leaveRequestsStore.set(leaveRequestsStore.getSnapshot().filter((r) => r.id !== id));
      logLeaveAudit({
        leaveRequestId: id,
        employeeName: request.employee,
        action: "rejected",
        actorName: currentUser.name,
        detail: `${request.type} request withdrawn by the employee`,
      });
      return { ok: true, message: "Leave request withdrawn." };
    },
    [currentUser.employeeId, currentUser.name],
  );

  const value = useMemo<LeaveContextValue>(
    () => ({
      leaveRequests,
      leaveBalances,
      auditEntries,
      balancesFor,
      requestsFor,
      visibleTeamRequests,
      canDecide,
      applyLeave,
      approveLeave,
      rejectLeave,
      cancelLeave,
    }),
    [
      leaveRequests,
      leaveBalances,
      auditEntries,
      balancesFor,
      requestsFor,
      visibleTeamRequests,
      canDecide,
      applyLeave,
      approveLeave,
      rejectLeave,
      cancelLeave,
    ],
  );

  return <LeaveContext.Provider value={value}>{children}</LeaveContext.Provider>;
}

export function useLeave() {
  const ctx = useContext(LeaveContext);
  if (!ctx) throw new Error("useLeave must be used within a LeaveProvider");
  return ctx;
}

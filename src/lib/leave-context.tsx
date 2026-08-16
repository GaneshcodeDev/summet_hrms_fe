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
import { employeesStore } from "@/lib/employee-store";
import { attendanceStore } from "@/lib/attendance-store";
import { useAccessControl } from "@/lib/access-control-context";
import { useMasters } from "@/lib/master-context";
import { useSiteConfig } from "@/lib/site-config-context";
import { useApprovals } from "@/lib/approval-context";
import { useNotifications } from "@/lib/notification-context";
import { resolveLeaveWorkflowSteps } from "@/lib/approval-engine";
import {
  calculateLeaveDays,
  computeLeaveBalanceSummary,
  getApprovedLeaveForDate,
  getEmployeeLeaveBalance,
  getLeaveRequestsForSite,
  getLeaveSummary,
  getPendingLeaveRequests,
  hasOverlap,
  type LeaveBalanceSummary,
  type LeaveDayCalc,
} from "@/lib/leave-engine";
import type {
  ApprovalInstance,
  AttendanceRecord,
  HalfDayPortion,
  LeaveAuditEntry,
  LeaveBalance,
  LeaveRequest,
  LeaveStatus,
  MasterRecord,
} from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

const DEFAULT_WORKING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

interface ApplyLeaveInput {
  leaveTypeId: string;
  from: string;
  to: string;
  halfDay?: HalfDayPortion;
  reason: string;
  contactDuringLeave?: string;
  emergencyContact?: string;
  attachmentRef?: string;
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
  /** Real, site-scoped, active Leave Type Master records — [] means the site has no leave policy configured yet. */
  leaveTypesForSite: (siteId: string) => MasterRecord[];
  /** Live day-count preview (working-day + holiday aware) for the Apply Leave form, before submitting. */
  previewDays: (siteId: string, from: string, to: string, halfDay?: HalfDayPortion) => LeaveDayCalc;
  /** Real balance summary for one employee+leave-type — undefined only when that leave type isn't configured for the site. */
  balanceSummaryFor: (employeeId: string, siteId: string, leaveTypeName: string) => LeaveBalanceSummary | undefined;
  applyLeave: (input: ApplyLeaveInput) => ActionResult;
  approveLeave: (id: string, note?: string) => ActionResult;
  rejectLeave: (id: string, reason: string) => ActionResult;
  /** Employee: own Pending or future-dated Approved requests. HR/broad-scope: any request in scope. */
  canCancel: (request: LeaveRequest) => boolean;
  cancelLeave: (id: string, reason?: string) => ActionResult;
  /** The approval workflow instance backing this request, if one was recorded — see approval-context.tsx. */
  approvalInstanceFor: (requestId: string) => ApprovalInstance | undefined;
}

const LeaveContext = createContext<LeaveContextValue | undefined>(undefined);

/**
 * Marks the applicable dates ON_LEAVE in Attendance. Writes attendanceStore
 * directly rather than going through useAttendance().markAttendance — this
 * is a system-triggered side effect of an already-authorized leave
 * decision, not the approver personally "marking attendance", so it
 * shouldn't be gated behind attendance.records permissions a Manager/HR
 * approver may not individually hold. Never touches dates outside this
 * request, or other employees' records. Module-level (not a hook) since it
 * only touches the plain attendanceStore and needs no component state.
 */
function syncAttendanceForApproval(request: LeaveRequest, siteId: string, applicableDates: string[]) {
  const now = new Date().toISOString();
  const snapshot = attendanceStore.getSnapshot();
  const byKey = new Map(snapshot.map((r) => [`${r.employeeId}|${r.date}`, r]));
  const next = [...snapshot];
  for (const date of applicableDates) {
    const key = `${request.employeeId}|${date}`;
    const existing = byKey.get(key);
    if (!existing) {
      next.push({
        id: `att-${request.employeeId}-${date}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        employeeId: request.employeeId,
        siteId,
        date,
        status: "On Leave",
        workedHours: 0,
        overtimeHours: 0,
        lateMinutes: 0,
        earlyLeavingMinutes: 0,
        source: "SYSTEM",
        leaveRequestId: request.id,
        remarks: `Auto-marked from approved ${request.type} leave`,
        createdOn: now,
        updatedOn: now,
        updatedBy: "Leave Approval",
      });
    } else if (existing.status !== "On Leave") {
      const idx = next.findIndex((r) => r.id === existing.id);
      next[idx] = {
        ...existing,
        status: "On Leave",
        punchIn: undefined,
        punchOut: undefined,
        workedHours: 0,
        overtimeHours: 0,
        lateMinutes: 0,
        earlyLeavingMinutes: 0,
        leaveRequestId: request.id,
        preLeaveSnapshot: {
          status: existing.status,
          punchIn: existing.punchIn,
          punchOut: existing.punchOut,
          workedHours: existing.workedHours,
          overtimeHours: existing.overtimeHours,
          lateMinutes: existing.lateMinutes,
          earlyLeavingMinutes: existing.earlyLeavingMinutes,
        },
        updatedOn: now,
        updatedBy: "Leave Approval",
      };
    }
  }
  attendanceStore.set(next);
}

/** Reverts exactly what syncAttendanceForApproval touched for this request — restores real attendance data it overwrote, deletes records it created from scratch. */
function revertAttendanceForRequest(requestId: string) {
  const snapshot = attendanceStore.getSnapshot();
  const next: AttendanceRecord[] = [];
  for (const r of snapshot) {
    if (r.leaveRequestId !== requestId) {
      next.push(r);
      continue;
    }
    if (r.preLeaveSnapshot) {
      const { preLeaveSnapshot, ...rest } = r;
      next.push({ ...rest, ...preLeaveSnapshot, leaveRequestId: undefined, updatedOn: new Date().toISOString(), updatedBy: "Leave Cancellation" });
    }
    // else: this record was created fresh by the leave sync — drop it, reverting the date to "no record".
  }
  attendanceStore.set(next);
}

/** Updates the balance and syncs attendance for a newly-approved request — shared by manual decide() and auto-approval in applyLeave(). */
function finalizeApproval(
  request: LeaveRequest,
  siteId: string,
  applicableDates: string[],
  leaveTypesForSite: (siteId: string) => MasterRecord[],
) {
  const existing = leaveBalancesStore.getSnapshot().find((b) => b.employeeId === request.employeeId && b.type === request.type);
  if (existing) {
    leaveBalancesStore.set(
      leaveBalancesStore.getSnapshot().map((b) => (b === existing ? { ...b, used: b.used + request.days } : b)),
    );
  } else {
    const leaveType = leaveTypesForSite(siteId).find((r) => r.name === request.type);
    const opening = typeof leaveType?.attributes.maxDaysPerYear === "number" ? leaveType.attributes.maxDaysPerYear : 0;
    const newBalance: LeaveBalance = {
      employeeId: request.employeeId,
      type: request.type,
      leaveTypeId: request.leaveTypeId,
      used: request.days,
      total: opening,
      opening,
    };
    leaveBalancesStore.set([...leaveBalancesStore.getSnapshot(), newBalance]);
  }
  syncAttendanceForApproval(request, siteId, applicableDates);
}

export function LeaveProvider({ children }: { children: ReactNode }) {
  const { currentUser, canFeature } = useAccessControl();
  const { recordsOfType } = useMasters();
  const { configForSite } = useSiteConfig();
  const { instanceFor, canAct: canActOnInstance, createInstance, act: actOnInstance, recordMirroredAction } = useApprovals();
  const { notify } = useNotifications();

  const leaveRequests = useSyncExternalStore(
    leaveRequestsStore.subscribe,
    leaveRequestsStore.getSnapshot,
    leaveRequestsStore.getServerSnapshot,
  );
  // Plain-module subscription (no EmployeeProvider dependency needed — see
  // employee-store.ts), same pattern as access-control-context.tsx and
  // regularization-context.tsx, so reporting-line scoping stays live.
  const employees = useSyncExternalStore(
    employeesStore.subscribe,
    employeesStore.getSnapshot,
    employeesStore.getServerSnapshot,
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

  const leaveTypesForSite = useCallback(
    (siteId: string) => recordsOfType("LeaveType").filter((r) => r.siteId === siteId && r.status === "Active"),
    [recordsOfType],
  );

  const workingConfigFor = useCallback(
    (siteId: string) => {
      const cfg = configForSite(siteId);
      return {
        workingDays: cfg?.attendance.workingDays ?? DEFAULT_WORKING_DAYS,
        holidays: (cfg?.holiday.holidays ?? []).map((h) => h.date),
      };
    },
    [configForSite],
  );

  const previewDays = useCallback(
    (siteId: string, from: string, to: string, halfDay?: HalfDayPortion) => {
      if (!from || !to || from > to) return { days: 0, applicableDates: [] };
      const { workingDays, holidays } = workingConfigFor(siteId);
      return calculateLeaveDays(from, to, workingDays, holidays, halfDay);
    },
    [workingConfigFor],
  );

  const balanceSummaryFor = useCallback(
    (employeeId: string, siteId: string, leaveTypeName: string): LeaveBalanceSummary | undefined => {
      const leaveType = leaveTypesForSite(siteId).find((r) => r.name === leaveTypeName);
      if (!leaveType) return undefined;
      const fallbackOpening = typeof leaveType.attributes.maxDaysPerYear === "number" ? leaveType.attributes.maxDaysPerYear : 0;
      const balance = leaveBalances.find((b) => b.employeeId === employeeId && b.type === leaveTypeName);
      const pendingDays = leaveRequests
        .filter((r) => r.employeeId === employeeId && r.type === leaveTypeName && r.status === "Pending")
        .reduce((sum, r) => sum + r.days, 0);
      return computeLeaveBalanceSummary(balance, fallbackOpening, pendingDays);
    },
    [leaveTypesForSite, leaveBalances, leaveRequests],
  );

  // HR Admin/HR Manager hold "edit" on leave.requests (broad site-wide scope in the
  // permission matrix); Department Head/Manager only hold "approve"/"reject" and are
  // limited to their direct reports below.
  const hasBroadScope = canFeature("leave.requests", "edit") || canFeature("leave.requests", "manage");

  const canDecide = useCallback(
    (request: LeaveRequest) => {
      if (request.employeeId === currentUser.employeeId) return false; // no self-approval
      if (!canFeature("leave.requests", "approve") && !canFeature("leave.requests", "reject")) return false;
      // Genuinely multi-step (Manager then HR) requests defer entirely to the
      // workflow engine's per-step gate — whose turn it is right now, not
      // just "am I the manager or HR at all".
      const instance = instanceFor("Leave", request.id);
      if (instance && instance.steps.length > 1) {
        return canActOnInstance(instance, "leave.requests");
      }
      if (hasBroadScope) return true;
      const requester = employees.find((e) => e.employeeId === request.employeeId);
      return requester?.reportingManagerId === currentUser.employeeId;
    },
    [currentUser.employeeId, canFeature, hasBroadScope, employees, instanceFor, canActOnInstance],
  );

  const canCancel = useCallback(
    (request: LeaveRequest) => {
      if (request.status !== "Pending" && request.status !== "Approved") return false;
      const isSelf = request.employeeId === currentUser.employeeId;
      if (!isSelf && !hasBroadScope) return false;
      if (request.status === "Approved") {
        const today = new Date().toISOString().slice(0, 10);
        if (request.from <= today) return false; // already started/completed
      }
      return true;
    },
    [currentUser.employeeId, hasBroadScope],
  );

  const visibleTeamRequests = useCallback(() => {
    if (hasBroadScope) return leaveRequests.filter((r) => r.employeeId !== currentUser.employeeId);
    if (!canFeature("leave.requests", "approve") && !canFeature("leave.requests", "reject")) return [];
    const directReportIds = new Set(
      employees.filter((e) => e.reportingManagerId === currentUser.employeeId).map((e) => e.employeeId),
    );
    return leaveRequests.filter((r) => directReportIds.has(r.employeeId));
  }, [leaveRequests, currentUser.employeeId, hasBroadScope, canFeature, employees]);

  const applyLeave = useCallback(
    (input: ApplyLeaveInput): ActionResult => {
      const siteId = currentUser.siteId;
      const leaveType = leaveTypesForSite(siteId).find((r) => r.id === input.leaveTypeId);
      if (!leaveType) return { ok: false, message: "Select a valid, active leave type for your site." };
      if (!input.from || !input.to || input.from > input.to) {
        return { ok: false, message: "From date must be on or before the To date." };
      }

      const { workingDays, holidays } = workingConfigFor(siteId);
      const { days, applicableDates } = calculateLeaveDays(input.from, input.to, workingDays, holidays, input.halfDay);
      if (days <= 0) {
        return { ok: false, message: "The selected dates don't include any working day for your site — nothing to apply for." };
      }

      const maxConsecutive = typeof leaveType.attributes.maxConsecutiveDays === "number" ? leaveType.attributes.maxConsecutiveDays : undefined;
      if (maxConsecutive && applicableDates.length > maxConsecutive) {
        return { ok: false, message: `${leaveType.name} allows a maximum of ${maxConsecutive} consecutive day(s) — this request is ${applicableDates.length}.` };
      }

      const minNotice = typeof leaveType.attributes.minNoticeDays === "number" ? leaveType.attributes.minNoticeDays : undefined;
      if (minNotice) {
        const today = new Date().toISOString().slice(0, 10);
        const noticeDays = Math.round((new Date(`${input.from}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000);
        if (noticeDays < minNotice) {
          return { ok: false, message: `${leaveType.name} requires at least ${minNotice} day(s) notice.` };
        }
      }

      if (leaveType.attributes.requiresDocument && !input.attachmentRef?.trim()) {
        return { ok: false, message: `${leaveType.name} requires a supporting document reference.` };
      }

      const myRequests = leaveRequestsStore.getSnapshot().filter((r) => r.employeeId === currentUser.employeeId);
      if (hasOverlap(myRequests, input.from, input.to)) {
        return { ok: false, message: "You already have a pending or approved leave request that overlaps these dates." };
      }

      const isPaid = leaveType.attributes.paid !== false;
      if (isPaid) {
        const bal = leaveBalancesStore.getSnapshot().find((b) => b.employeeId === currentUser.employeeId && b.type === leaveType.name);
        const fallbackOpening = typeof leaveType.attributes.maxDaysPerYear === "number" ? leaveType.attributes.maxDaysPerYear : 0;
        const pendingDays = myRequests.filter((r) => r.type === leaveType.name && r.status === "Pending").reduce((sum, r) => sum + r.days, 0);
        const summary = computeLeaveBalanceSummary(bal, fallbackOpening, pendingDays);
        if (days > summary.available) {
          return {
            ok: false,
            message: `Insufficient ${leaveType.name} balance — ${summary.available} day(s) available (after ${summary.pending} pending), but requested ${days}.`,
          };
        }
      } // unpaid leave: no balance ceiling — allowed per policy (section 7)

      const autoApprove = leaveType.attributes.requiresApproval === false;
      const now = new Date().toISOString().slice(0, 10);
      const request: LeaveRequest = {
        id: `lv-${Date.now().toString(36)}`,
        employeeId: currentUser.employeeId,
        employee: currentUser.name,
        type: leaveType.name,
        leaveTypeId: leaveType.id,
        from: input.from,
        to: input.to,
        halfDay: input.halfDay,
        days,
        status: autoApprove ? "Approved" : "Pending",
        reason: input.reason,
        contactDuringLeave: input.contactDuringLeave?.trim() || undefined,
        emergencyContact: input.emergencyContact?.trim() || undefined,
        attachmentRef: input.attachmentRef?.trim() || undefined,
        siteId,
        appliedOn: now,
        ...(autoApprove
          ? { approverId: "SYSTEM", approverName: "Auto-approved (no approval required)", decidedOn: now }
          : {}),
      };
      leaveRequestsStore.set([request, ...leaveRequestsStore.getSnapshot()]);
      logLeaveAudit({
        leaveRequestId: request.id,
        employeeName: request.employee,
        action: "applied",
        actorName: currentUser.name,
        detail: `${leaveType.name} requested for ${days} day(s)`,
      });
      // Records a real workflow instance for every request (even single-step
      // ones) so the shared Approval History UI has something to show — only
      // "Manager then HR" mode actually GATES on it (see canDecide/decide below).
      const approvalMode = configForSite(siteId)?.leave.approvalMode ?? "Manager";
      createInstance({
        siteId,
        module: "Leave",
        recordId: request.id,
        steps: autoApprove ? [] : resolveLeaveWorkflowSteps(approvalMode),
      });
      if (autoApprove) {
        finalizeApproval(request, siteId, applicableDates, leaveTypesForSite);
        logLeaveAudit({
          leaveRequestId: request.id,
          employeeName: request.employee,
          action: "approved",
          actorName: "System",
          detail: `${leaveType.name} auto-approved for ${days} day(s) — this leave type doesn't require approval`,
        });
      }
      return {
        ok: true,
        message: autoApprove
          ? `Leave request auto-approved (${days} day${days !== 1 ? "s" : ""}).`
          : `Leave request submitted for approval (${days} day${days !== 1 ? "s" : ""}).`,
      };
    },
    [currentUser.employeeId, currentUser.name, currentUser.siteId, leaveTypesForSite, workingConfigFor, configForSite, createInstance],
  );

  const decide = useCallback(
    (id: string, status: "Approved" | "Rejected", decisionReason?: string): ActionResult => {
      const request = leaveRequestsStore.getSnapshot().find((r) => r.id === id);
      if (!request) return { ok: false, message: "Leave request not found." };
      if (request.status !== "Pending") return { ok: false, message: "This request has already been decided." };
      if (status === "Rejected" && !decisionReason?.trim()) {
        return { ok: false, message: "A reason is required to reject a leave request." };
      }

      const instance = instanceFor("Leave", id);
      const isMultiStep = Boolean(instance && instance.steps.length > 1);

      if (isMultiStep && instance) {
        // Manager-then-HR (or any future multi-step mode): the workflow
        // engine owns authorization for "whose turn is it" — reject here
        // never reaches Approved without every step signing off, and an
        // intermediate approval must NOT flip the leave to Approved (no
        // Attendance/Payroll effect) until the final step does.
        const result = actOnInstance("Leave", id, status === "Approved" ? "APPROVE" : "REJECT", "leave.requests", decisionReason);
        if (!result.ok) return { ok: false, message: result.message };

        if (!result.completed) {
          logLeaveAudit({
            leaveRequestId: id,
            employeeName: request.employee,
            action: "approved",
            actorName: currentUser.name,
            detail: `${request.type} approved at the ${instance.steps[instance.currentStep].approverType} step — awaiting the next approver`,
          });
          return { ok: true, message: result.message };
        }

        const finalStatus: LeaveStatus = result.finalStatus === "Approved" ? "Approved" : "Rejected";
        leaveRequestsStore.set(
          leaveRequestsStore.getSnapshot().map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: finalStatus,
                  approverId: currentUser.employeeId,
                  approverName: currentUser.name,
                  decisionReason: decisionReason?.trim() || undefined,
                  decidedOn: new Date().toISOString().slice(0, 10),
                }
              : r,
          ),
        );
        if (finalStatus === "Approved") {
          const siteId = request.siteId ?? currentUser.siteId;
          const { workingDays, holidays } = workingConfigFor(siteId);
          const { applicableDates } = calculateLeaveDays(request.from, request.to, workingDays, holidays, request.halfDay);
          finalizeApproval(request, siteId, applicableDates, leaveTypesForSite);
        }
        logLeaveAudit({
          leaveRequestId: id,
          employeeName: request.employee,
          action: finalStatus === "Approved" ? "approved" : "rejected",
          actorName: currentUser.name,
          detail:
            finalStatus === "Approved"
              ? `${request.type} fully approved for ${request.days} day(s)${decisionReason ? ` — ${decisionReason}` : ""}`
              : `${request.type} rejected — ${decisionReason}`,
        });
        notify({
          employeeId: request.employeeId,
          type: finalStatus === "Approved" ? "success" : "warning",
          title: `Leave ${finalStatus.toLowerCase()}`,
          message: `Your ${request.type} request (${request.from} to ${request.to}) was ${finalStatus.toLowerCase()}${decisionReason ? ` — ${decisionReason}` : ""}.`,
          module: "Leave",
          recordId: id,
          href: "/leave",
        });
        return {
          ok: true,
          message:
            finalStatus === "Approved"
              ? `Approved ${request.employee}'s ${request.type} request.`
              : `Rejected ${request.employee}'s ${request.type} request.`,
        };
      }

      // Single-step (Manager / HR / auto-approve modes) — unchanged from Phase 8.
      if (!canDecide(request)) return { ok: false, message: "You're not authorized to decide this request." };

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
        const siteId = request.siteId ?? currentUser.siteId;
        const { workingDays, holidays } = workingConfigFor(siteId);
        const { applicableDates } = calculateLeaveDays(request.from, request.to, workingDays, holidays, request.halfDay);
        finalizeApproval(request, siteId, applicableDates, leaveTypesForSite);
      }

      if (instance) {
        recordMirroredAction({
          siteId: request.siteId ?? currentUser.siteId,
          module: "Leave",
          recordId: id,
          recordOwnerEmployeeId: request.employeeId,
          recordOwnerName: request.employee,
          approverType: instance.steps[0]?.approverType ?? "REPORTING_MANAGER",
          action: status === "Approved" ? "APPROVE" : "REJECT",
          newStatus: status,
          comment: decisionReason,
        });
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
      notify({
        employeeId: request.employeeId,
        type: status === "Approved" ? "success" : "warning",
        title: `Leave ${status.toLowerCase()}`,
        message: `Your ${request.type} request (${request.from} to ${request.to}) was ${status.toLowerCase()}${decisionReason ? ` — ${decisionReason}` : ""}.`,
        module: "Leave",
        recordId: id,
        href: "/leave",
      });

      return {
        ok: true,
        message:
          status === "Approved"
            ? `Approved ${request.employee}'s ${request.type} request.`
            : `Rejected ${request.employee}'s ${request.type} request.`,
      };
    },
    [
      canDecide,
      currentUser.employeeId,
      currentUser.name,
      currentUser.siteId,
      workingConfigFor,
      leaveTypesForSite,
      instanceFor,
      actOnInstance,
      recordMirroredAction,
      notify,
    ],
  );

  const approveLeave = useCallback((id: string, note?: string) => decide(id, "Approved", note), [decide]);
  const rejectLeave = useCallback((id: string, reason: string) => decide(id, "Rejected", reason), [decide]);

  const cancelLeave = useCallback(
    (id: string, reason?: string): ActionResult => {
      const request = leaveRequestsStore.getSnapshot().find((r) => r.id === id);
      if (!request) return { ok: false, message: "Leave request not found." };
      if (!canCancel(request)) {
        return {
          ok: false,
          message:
            request.status === "Approved"
              ? "This leave has already started or completed — it can no longer be cancelled."
              : "You're not authorized to cancel this request.",
        };
      }

      if (request.status === "Approved") {
        leaveBalancesStore.set(
          leaveBalancesStore.getSnapshot().map((b) =>
            b.employeeId === request.employeeId && b.type === request.type
              ? { ...b, used: Math.max(0, b.used - request.days) }
              : b,
          ),
        );
        revertAttendanceForRequest(request.id);
      }

      leaveRequestsStore.set(
        leaveRequestsStore.getSnapshot().map((r) =>
          r.id === id
            ? {
                ...r,
                status: "Cancelled" as LeaveStatus,
                cancelledBy: currentUser.name,
                cancelledOn: new Date().toISOString().slice(0, 10),
                cancellationReason: reason?.trim() || undefined,
              }
            : r,
        ),
      );
      // canCancel() above is already the authoritative gate (self, or
      // HR/broad-scope) — mirror the outcome into the instance rather than
      // re-authorizing through actOnInstance's stricter per-step check,
      // which doesn't know about the "HR can always cancel" fallback.
      const instance = instanceFor("Leave", id);
      if (instance && instance.status !== "Cancelled") {
        recordMirroredAction({
          siteId: request.siteId ?? currentUser.siteId,
          module: "Leave",
          recordId: id,
          recordOwnerEmployeeId: request.employeeId,
          recordOwnerName: request.employee,
          approverType: instance.steps[instance.currentStep]?.approverType ?? instance.steps[0]?.approverType ?? "REPORTING_MANAGER",
          action: "CANCEL",
          newStatus: "Cancelled",
          comment: reason,
        });
      }

      logLeaveAudit({
        leaveRequestId: id,
        employeeName: request.employee,
        action: "cancelled",
        actorName: currentUser.name,
        detail: `${request.type} request cancelled${reason ? ` — ${reason}` : ""}`,
      });
      return { ok: true, message: "Leave request cancelled." };
    },
    [canCancel, currentUser.name, currentUser.siteId, instanceFor, recordMirroredAction],
  );

  const approvalInstanceFor = useCallback((requestId: string) => instanceFor("Leave", requestId), [instanceFor]);

  const value = useMemo<LeaveContextValue>(
    () => ({
      leaveRequests,
      leaveBalances,
      auditEntries,
      balancesFor,
      requestsFor,
      visibleTeamRequests,
      canDecide,
      leaveTypesForSite,
      previewDays,
      balanceSummaryFor,
      applyLeave,
      approveLeave,
      rejectLeave,
      canCancel,
      cancelLeave,
      approvalInstanceFor,
    }),
    [
      leaveRequests,
      leaveBalances,
      auditEntries,
      balancesFor,
      requestsFor,
      visibleTeamRequests,
      canDecide,
      leaveTypesForSite,
      previewDays,
      balanceSummaryFor,
      applyLeave,
      approveLeave,
      rejectLeave,
      canCancel,
      cancelLeave,
      approvalInstanceFor,
    ],
  );

  return <LeaveContext.Provider value={value}>{children}</LeaveContext.Provider>;
}

export function useLeave() {
  const ctx = useContext(LeaveContext);
  if (!ctx) throw new Error("useLeave must be used within a LeaveProvider");
  return ctx;
}

// Re-exported so pages can use the same site-scoped selectors leave-context
// itself is built on, without duplicating filtering logic — see leave-engine.ts.
export { getApprovedLeaveForDate, getEmployeeLeaveBalance, getLeaveRequestsForSite, getLeaveSummary, getPendingLeaveRequests };

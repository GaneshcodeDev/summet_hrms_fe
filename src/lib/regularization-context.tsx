"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ApiError } from "@/lib/api/api-client";
import {
  applyRegularizationApi,
  cancelRegularizationApi,
  decideRegularizationApi,
  listRegularizations,
} from "@/lib/api/regularization-api";
import {
  apiAttendanceToAttendance,
  apiRegularizationToRegularization,
  attendanceStatusToApi,
} from "@/lib/api/mappers";
import { getAttendance } from "@/lib/api/attendance-api";
import { isBackendConnected } from "@/lib/api/token-store";
import { regularizationsStore } from "@/lib/regularization-store";
import { attendanceStore, findAttendanceRecord } from "@/lib/attendance-store";
import { employeesStore } from "@/lib/employee-store";
import { useAccessControl } from "@/lib/access-control-context";
import { useSite } from "@/lib/site-context";
import { useApprovals } from "@/lib/approval-context";
import type { AttendanceRegularization, AttendanceStatus } from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

interface ApplyRegularizationInput {
  date: string;
  currentStatus: AttendanceStatus;
  requestedStatus: AttendanceStatus;
  requestedPunchIn?: string;
  requestedPunchOut?: string;
  reason: string;
}

interface RegularizationContextValue {
  regularizations: AttendanceRegularization[];
  isBackendConnected: boolean;
  requestsFor: (employeeId: string) => AttendanceRegularization[];
  /** Requests the signed-in user can act on for their team, scoped by RBAC + reporting hierarchy (not site). */
  visibleTeamRequests: () => AttendanceRegularization[];
  canDecide: (request: AttendanceRegularization) => boolean;
  applyRegularization: (input: ApplyRegularizationInput) => Promise<ActionResult>;
  approveRegularization: (id: string, note?: string) => Promise<ActionResult>;
  rejectRegularization: (id: string, reason: string) => Promise<ActionResult>;
  cancelRegularization: (id: string) => Promise<ActionResult>;
}

const RegularizationContext = createContext<RegularizationContextValue | undefined>(undefined);

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function RegularizationProvider({ children }: { children: ReactNode }) {
  const { currentUser, canFeature } = useAccessControl();
  const { currentSiteId, isAllSites, isSuperAdmin } = useSite();
  const { recordMirroredAction } = useApprovals();

  const regularizations = useSyncExternalStore(
    regularizationsStore.subscribe,
    regularizationsStore.getSnapshot,
    regularizationsStore.getServerSnapshot,
  );
  // Plain-module subscription (no EmployeeProvider dependency needed — see
  // employee-store.ts), so reporting-line scoping stays live without a
  // provider cycle, the same pattern used in access-control-context.tsx.
  const employees = useSyncExternalStore(
    employeesStore.subscribe,
    employeesStore.getSnapshot,
    employeesStore.getServerSnapshot,
  );

  const [connected, setConnected] = useState(false);

  // Backend-authoritative once connected (Phase 18D) — the backend
  // resolves visibility (self / direct reports / site / global) itself
  // (spec Step 9/10), so this mirrors attendance-context.tsx's fetch scope
  // exactly: the selected site, or global for Super Admin's "All Sites".
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      if (!isBackendConnected()) {
        setConnected(false);
        return;
      }
      setConnected(true);
      if (!isAllSites && !currentSiteId) return;
      if (isAllSites && !isSuperAdmin) return;
      try {
        const apiRequests = await listRegularizations(isAllSites ? {} : { siteId: currentSiteId });
        if (cancelled) return;
        regularizationsStore.set(apiRequests.map((r) => apiRegularizationToRegularization(r, employees)));
      } catch {
        // Leave the existing cache in place — a transient failure shouldn't blank the page.
      }
    }
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [currentSiteId, isAllSites, isSuperAdmin, employees]);

  const requestsFor = useCallback(
    (employeeId: string) => regularizations.filter((r) => r.employeeId === employeeId),
    [regularizations],
  );

  // HR Admin/HR Manager hold "edit" on attendance.records (broad site-wide scope);
  // Department Head/Manager only hold "approve"/"reject" and are limited to their
  // direct reports below — mirrors the Leave module's exact same scoping rule.
  const hasBroadScope = canFeature("attendance.records", "edit") || canFeature("attendance.records", "manage");

  const canDecide = useCallback(
    (request: AttendanceRegularization) => {
      if (request.employeeId === currentUser.employeeId) return false; // no self-approval
      if (!canFeature("attendance.records", "approve") && !canFeature("attendance.records", "reject")) return false;
      if (hasBroadScope) return true;
      const requester = employees.find((e) => e.employeeId === request.employeeId);
      return requester?.reportingManagerId === currentUser.employeeId;
    },
    [currentUser.employeeId, canFeature, hasBroadScope, employees],
  );

  const visibleTeamRequests = useCallback(() => {
    if (hasBroadScope) return regularizations.filter((r) => r.employeeId !== currentUser.employeeId);
    if (!canFeature("attendance.records", "approve") && !canFeature("attendance.records", "reject")) return [];
    const directReportIds = new Set(
      employees.filter((e) => e.reportingManagerId === currentUser.employeeId).map((e) => e.employeeId),
    );
    return regularizations.filter((r) => directReportIds.has(r.employeeId));
  }, [regularizations, currentUser.employeeId, hasBroadScope, canFeature, employees]);

  const applyRegularization = useCallback(
    async (input: ApplyRegularizationInput): Promise<ActionResult> => {
      if (input.currentStatus === input.requestedStatus) {
        return { ok: false, message: "Requested status must be different from the current status." };
      }
      const alreadyPending = regularizationsStore
        .getSnapshot()
        .find((r) => r.employeeId === currentUser.employeeId && r.date === input.date && r.status === "Pending");
      if (alreadyPending) {
        return { ok: false, message: `A regularization request for ${input.date} is already pending.` };
      }

      if (isBackendConnected()) {
        try {
          // currentStatus is derived server-side from the real attendance
          // record (more authoritative than the client's guess) — not sent.
          const created = await applyRegularizationApi({
            date: input.date,
            requestedStatus: attendanceStatusToApi(input.requestedStatus),
            requestedPunchIn: input.requestedPunchIn,
            requestedPunchOut: input.requestedPunchOut,
            reason: input.reason,
          });
          const request = apiRegularizationToRegularization(created, employees);
          regularizationsStore.set([request, ...regularizationsStore.getSnapshot().filter((r) => r.id !== request.id)]);
          recordMirroredAction({
            siteId: request.siteId ?? currentUser.siteId,
            module: "Regularization",
            recordId: request.id,
            recordOwnerEmployeeId: request.employeeId,
            recordOwnerName: request.employee,
            approverType: "REPORTING_MANAGER",
            action: "APPLY",
            newStatus: "Pending",
            timestamp: new Date().toISOString(),
          });
          return { ok: true, message: `Regularization request submitted for ${input.date}.` };
        } catch (error) {
          return { ok: false, message: errorMessage(error, "Failed to submit regularization request.") };
        }
      }

      const existingRecord = findAttendanceRecord(currentUser.employeeId, input.date);
      const request: AttendanceRegularization = {
        id: `reg-${Date.now().toString(36)}`,
        employeeId: currentUser.employeeId,
        employee: currentUser.name,
        date: input.date,
        currentStatus: input.currentStatus,
        requestedStatus: input.requestedStatus,
        attendanceRecordId: existingRecord?.id,
        requestedPunchIn: input.requestedPunchIn,
        requestedPunchOut: input.requestedPunchOut,
        reason: input.reason,
        status: "Pending",
        siteId: currentUser.siteId,
        appliedOn: new Date().toISOString().slice(0, 10),
      };
      regularizationsStore.set([request, ...regularizationsStore.getSnapshot()]);
      // Mirror into the shared approval instance/audit trail (Phase 9) —
      // purely observational, this module keeps its own authorization above.
      recordMirroredAction({
        siteId: request.siteId ?? currentUser.siteId,
        module: "Regularization",
        recordId: request.id,
        recordOwnerEmployeeId: request.employeeId,
        recordOwnerName: request.employee,
        approverType: "REPORTING_MANAGER",
        action: "APPLY",
        newStatus: "Pending",
        timestamp: new Date().toISOString(),
      });
      return { ok: true, message: `Regularization request submitted for ${input.date}.` };
    },
    [currentUser.employeeId, currentUser.name, currentUser.siteId, recordMirroredAction, employees],
  );

  const decide = useCallback(
    async (id: string, status: "Approved" | "Rejected", decisionReason?: string): Promise<ActionResult> => {
      const request = regularizationsStore.getSnapshot().find((r) => r.id === id);
      if (!request) return { ok: false, message: "Regularization request not found." };
      if (request.status !== "Pending") return { ok: false, message: "This request has already been decided." };
      if (!canDecide(request)) return { ok: false, message: "You're not authorized to decide this request." };
      if (status === "Rejected" && !decisionReason?.trim()) {
        return { ok: false, message: "A reason is required to reject a regularization request." };
      }

      if (isBackendConnected()) {
        try {
          const decided = await decideRegularizationApi(id, status, decisionReason);
          const updatedRequest = apiRegularizationToRegularization(decided, employees);
          regularizationsStore.set(
            regularizationsStore.getSnapshot().map((r) => (r.id === id ? updatedRequest : r)),
          );
          // Approval writes through to the real AttendanceRecord server-side
          // (full recalculation, spec Step 11) — refresh our local cache of
          // it so the Attendance page/dashboard reflect it immediately.
          if (updatedRequest.attendanceRecordId) {
            try {
              const record = await getAttendance(updatedRequest.attendanceRecordId);
              const mapped = apiAttendanceToAttendance(record, employees);
              attendanceStore.set([mapped, ...attendanceStore.getSnapshot().filter((r) => r.id !== mapped.id)]);
            } catch {
              // Non-fatal — the decision itself already succeeded.
            }
          }
          recordMirroredAction({
            siteId: request.siteId ?? currentUser.siteId,
            module: "Regularization",
            recordId: id,
            recordOwnerEmployeeId: request.employeeId,
            recordOwnerName: request.employee,
            approverType: hasBroadScope ? "HR" : "REPORTING_MANAGER",
            action: status === "Approved" ? "APPROVE" : "REJECT",
            newStatus: status,
            comment: decisionReason,
          });
          return {
            ok: true,
            message:
              status === "Approved"
                ? `Approved ${request.employee}'s regularization for ${request.date}.`
                : `Rejected ${request.employee}'s regularization for ${request.date}.`,
          };
        } catch (error) {
          return { ok: false, message: errorMessage(error, "Failed to decide regularization request.") };
        }
      }

      if (status === "Approved") {
        const now = new Date().toISOString();
        const existing = attendanceStore.getSnapshot().find((r) => r.id === request.attendanceRecordId) ??
          findAttendanceRecord(request.employeeId, request.date);
        if (existing) {
          attendanceStore.set(
            attendanceStore.getSnapshot().map((r) =>
              r.id === existing.id
                ? {
                    ...r,
                    status: request.requestedStatus,
                    punchIn: request.requestedPunchIn ?? r.punchIn,
                    punchOut: request.requestedPunchOut ?? r.punchOut,
                    remarks: `Corrected via regularization: ${request.reason}`,
                    updatedOn: now,
                    updatedBy: currentUser.name,
                  }
                : r,
            ),
          );
        } else if (request.siteId) {
          attendanceStore.set([
            {
              id: `att-${request.employeeId}-${request.date}-${Date.now().toString(36)}`,
              employeeId: request.employeeId,
              siteId: request.siteId,
              date: request.date,
              punchIn: request.requestedPunchIn,
              punchOut: request.requestedPunchOut,
              status: request.requestedStatus,
              workedHours: 0,
              overtimeHours: 0,
              lateMinutes: 0,
              earlyLeavingMinutes: 0,
              source: "MANUAL",
              remarks: `Created via regularization: ${request.reason}`,
              createdOn: now,
              updatedOn: now,
              updatedBy: currentUser.name,
            },
            ...attendanceStore.getSnapshot(),
          ]);
        }
      }

      regularizationsStore.set(
        regularizationsStore.getSnapshot().map((r) =>
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

      recordMirroredAction({
        siteId: request.siteId ?? currentUser.siteId,
        module: "Regularization",
        recordId: id,
        recordOwnerEmployeeId: request.employeeId,
        recordOwnerName: request.employee,
        approverType: hasBroadScope ? "HR" : "REPORTING_MANAGER",
        action: status === "Approved" ? "APPROVE" : "REJECT",
        newStatus: status,
        comment: decisionReason,
      });

      return {
        ok: true,
        message:
          status === "Approved"
            ? `Approved ${request.employee}'s regularization for ${request.date}.`
            : `Rejected ${request.employee}'s regularization for ${request.date}.`,
      };
    },
    [canDecide, currentUser.employeeId, currentUser.name, currentUser.siteId, hasBroadScope, recordMirroredAction, employees],
  );

  const approveRegularization = useCallback((id: string, note?: string) => decide(id, "Approved", note), [decide]);
  const rejectRegularization = useCallback((id: string, reason: string) => decide(id, "Rejected", reason), [decide]);

  const cancelRegularization = useCallback(
    async (id: string): Promise<ActionResult> => {
      const request = regularizationsStore.getSnapshot().find((r) => r.id === id);
      if (!request) return { ok: false, message: "Regularization request not found." };
      if (request.employeeId !== currentUser.employeeId) {
        return { ok: false, message: "You can only withdraw your own requests." };
      }
      if (request.status !== "Pending") return { ok: false, message: "Only pending requests can be withdrawn." };

      if (isBackendConnected()) {
        try {
          await cancelRegularizationApi(id);
          regularizationsStore.set(regularizationsStore.getSnapshot().filter((r) => r.id !== id));
          return { ok: true, message: "Regularization request withdrawn." };
        } catch (error) {
          return { ok: false, message: errorMessage(error, "Failed to withdraw regularization request.") };
        }
      }

      regularizationsStore.set(regularizationsStore.getSnapshot().filter((r) => r.id !== id));
      return { ok: true, message: "Regularization request withdrawn." };
    },
    [currentUser.employeeId],
  );

  const value = useMemo<RegularizationContextValue>(
    () => ({
      regularizations,
      isBackendConnected: connected,
      requestsFor,
      visibleTeamRequests,
      canDecide,
      applyRegularization,
      approveRegularization,
      rejectRegularization,
      cancelRegularization,
    }),
    [
      regularizations,
      connected,
      requestsFor,
      visibleTeamRequests,
      canDecide,
      applyRegularization,
      approveRegularization,
      rejectRegularization,
      cancelRegularization,
    ],
  );

  return <RegularizationContext.Provider value={value}>{children}</RegularizationContext.Provider>;
}

export function useRegularization() {
  const ctx = useContext(RegularizationContext);
  if (!ctx) throw new Error("useRegularization must be used within a RegularizationProvider");
  return ctx;
}

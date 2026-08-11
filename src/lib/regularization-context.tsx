"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { regularizationsStore } from "@/lib/regularization-store";
import { employees } from "@/lib/mock-data";
import { useAccessControl } from "@/lib/access-control-context";
import type { AttendanceRegularization, AttendanceStatus } from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

interface ApplyRegularizationInput {
  date: string;
  currentStatus: AttendanceStatus;
  requestedStatus: AttendanceStatus;
  reason: string;
}

interface RegularizationContextValue {
  regularizations: AttendanceRegularization[];
  requestsFor: (employeeId: string) => AttendanceRegularization[];
  /** Requests the signed-in user can act on for their team, scoped by RBAC + reporting hierarchy (not site). */
  visibleTeamRequests: () => AttendanceRegularization[];
  canDecide: (request: AttendanceRegularization) => boolean;
  applyRegularization: (input: ApplyRegularizationInput) => ActionResult;
  approveRegularization: (id: string, note?: string) => ActionResult;
  rejectRegularization: (id: string, reason: string) => ActionResult;
  cancelRegularization: (id: string) => ActionResult;
}

const RegularizationContext = createContext<RegularizationContextValue | undefined>(undefined);

export function RegularizationProvider({ children }: { children: ReactNode }) {
  const { currentUser, canFeature } = useAccessControl();

  const regularizations = useSyncExternalStore(
    regularizationsStore.subscribe,
    regularizationsStore.getSnapshot,
    regularizationsStore.getServerSnapshot,
  );

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
    [currentUser.employeeId, canFeature, hasBroadScope],
  );

  const visibleTeamRequests = useCallback(() => {
    if (hasBroadScope) return regularizations.filter((r) => r.employeeId !== currentUser.employeeId);
    if (!canFeature("attendance.records", "approve") && !canFeature("attendance.records", "reject")) return [];
    const directReportIds = new Set(
      employees.filter((e) => e.reportingManagerId === currentUser.employeeId).map((e) => e.employeeId),
    );
    return regularizations.filter((r) => directReportIds.has(r.employeeId));
  }, [regularizations, currentUser.employeeId, hasBroadScope, canFeature]);

  const applyRegularization = useCallback(
    (input: ApplyRegularizationInput): ActionResult => {
      if (input.currentStatus === input.requestedStatus) {
        return { ok: false, message: "Requested status must be different from the current status." };
      }
      const alreadyPending = regularizationsStore
        .getSnapshot()
        .find((r) => r.employeeId === currentUser.employeeId && r.date === input.date && r.status === "Pending");
      if (alreadyPending) {
        return { ok: false, message: `A regularization request for ${input.date} is already pending.` };
      }
      const request: AttendanceRegularization = {
        id: `reg-${Date.now().toString(36)}`,
        employeeId: currentUser.employeeId,
        employee: currentUser.name,
        date: input.date,
        currentStatus: input.currentStatus,
        requestedStatus: input.requestedStatus,
        reason: input.reason,
        status: "Pending",
        siteId: currentUser.siteId,
        appliedOn: new Date().toISOString().slice(0, 10),
      };
      regularizationsStore.set([request, ...regularizationsStore.getSnapshot()]);
      return { ok: true, message: `Regularization request submitted for ${input.date}.` };
    },
    [currentUser.employeeId, currentUser.name, currentUser.siteId],
  );

  const decide = useCallback(
    (id: string, status: "Approved" | "Rejected", decisionReason?: string): ActionResult => {
      const request = regularizationsStore.getSnapshot().find((r) => r.id === id);
      if (!request) return { ok: false, message: "Regularization request not found." };
      if (request.status !== "Pending") return { ok: false, message: "This request has already been decided." };
      if (!canDecide(request)) return { ok: false, message: "You're not authorized to decide this request." };
      if (status === "Rejected" && !decisionReason?.trim()) {
        return { ok: false, message: "A reason is required to reject a regularization request." };
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

      return {
        ok: true,
        message:
          status === "Approved"
            ? `Approved ${request.employee}'s regularization for ${request.date}.`
            : `Rejected ${request.employee}'s regularization for ${request.date}.`,
      };
    },
    [canDecide, currentUser.employeeId, currentUser.name],
  );

  const approveRegularization = useCallback((id: string, note?: string) => decide(id, "Approved", note), [decide]);
  const rejectRegularization = useCallback((id: string, reason: string) => decide(id, "Rejected", reason), [decide]);

  const cancelRegularization = useCallback(
    (id: string): ActionResult => {
      const request = regularizationsStore.getSnapshot().find((r) => r.id === id);
      if (!request) return { ok: false, message: "Regularization request not found." };
      if (request.employeeId !== currentUser.employeeId) {
        return { ok: false, message: "You can only withdraw your own requests." };
      }
      if (request.status !== "Pending") return { ok: false, message: "Only pending requests can be withdrawn." };
      regularizationsStore.set(regularizationsStore.getSnapshot().filter((r) => r.id !== id));
      return { ok: true, message: "Regularization request withdrawn." };
    },
    [currentUser.employeeId],
  );

  const value = useMemo<RegularizationContextValue>(
    () => ({
      regularizations,
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

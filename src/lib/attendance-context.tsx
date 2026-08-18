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
import { createAttendanceApi, listAttendance, updateAttendanceApi } from "@/lib/api/attendance-api";
import {
  apiAttendanceToAttendance,
  attendanceSourceToApi,
  attendanceStatusToApi,
  resolveEmployeeDbId,
} from "@/lib/api/mappers";
import { isBackendConnected } from "@/lib/api/token-store";
import { attendanceStore } from "@/lib/attendance-store";
import { employeesStore } from "@/lib/employee-store";
import { useAccessControl } from "@/lib/access-control-context";
import { useSite } from "@/lib/site-context";
import type { AttendanceRecord, AttendanceSource, AttendanceStatus } from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

const NO_PUNCH_STATUSES: AttendanceStatus[] = ["Absent", "On Leave", "Weekend", "Holiday"];

export interface MarkAttendanceInput {
  employeeId: string;
  siteId: string;
  date: string;
  punchIn?: string;
  punchOut?: string;
  status?: AttendanceStatus;
  shiftId?: string;
  remarks?: string;
  source?: AttendanceSource;
  /** Shift start/end (HH:mm) and grace period, when known, used to derive status/late/overtime. */
  shiftStart?: string;
  shiftEnd?: string;
  gracePeriodMinutes?: number;
}

export type UpdateAttendanceInput = Partial<
  Pick<AttendanceRecord, "punchIn" | "punchOut" | "status" | "shiftId" | "remarks">
> & { shiftStart?: string; shiftEnd?: string; gracePeriodMinutes?: number };

function toMinutes(hhmm: string): number | undefined {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return undefined;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Derives status/workedHours/overtimeHours/lateMinutes from punch times +
 * shift/grace period. Manual status always wins if explicitly provided.
 * Kept here (rather than deleted) as the fallback calculation used when
 * the backend isn't connected (see markAttendance/updateAttendanceRecord
 * below) — once connected, the SAME logic runs server-side
 * (summet_hrms_be/src/attendance/attendance-engine.ts, ported verbatim)
 * so both paths agree.
 */
function deriveFields(input: {
  punchIn?: string;
  punchOut?: string;
  status?: AttendanceStatus;
  shiftStart?: string;
  shiftEnd?: string;
  gracePeriodMinutes?: number;
}) {
  const { punchIn, punchOut, shiftStart, shiftEnd, gracePeriodMinutes = 0 } = input;

  if (input.status && (NO_PUNCH_STATUSES.includes(input.status) || !punchIn)) {
    return {
      status: input.status,
      workedHours: 0,
      overtimeHours: 0,
      lateMinutes: 0,
      earlyLeavingMinutes: 0,
    };
  }

  if (!punchIn) {
    return { status: "Absent" as AttendanceStatus, workedHours: 0, overtimeHours: 0, lateMinutes: 0, earlyLeavingMinutes: 0 };
  }

  const inMin = toMinutes(punchIn);
  const outMin = punchOut ? toMinutes(punchOut) : undefined;
  const shiftStartMin = shiftStart ? toMinutes(shiftStart) : undefined;
  const shiftEndMin = shiftEnd ? toMinutes(shiftEnd) : undefined;

  const lateMinutes =
    inMin !== undefined && shiftStartMin !== undefined
      ? Math.max(0, inMin - shiftStartMin - gracePeriodMinutes)
      : 0;
  const earlyLeavingMinutes =
    outMin !== undefined && shiftEndMin !== undefined ? Math.max(0, shiftEndMin - outMin) : 0;

  const workedHours =
    inMin !== undefined && outMin !== undefined
      ? Math.max(0, Math.round(((outMin >= inMin ? outMin - inMin : outMin + 24 * 60 - inMin) / 60) * 100) / 100)
      : 0;
  const standardHours =
    shiftStartMin !== undefined && shiftEndMin !== undefined
      ? Math.max(0, (shiftEndMin >= shiftStartMin ? shiftEndMin - shiftStartMin : shiftEndMin + 24 * 60 - shiftStartMin) / 60)
      : 8;
  const overtimeHours = outMin !== undefined ? Math.max(0, Math.round((workedHours - standardHours) * 100) / 100) : 0;

  let status: AttendanceStatus = input.status ?? "Present";
  if (!input.status) {
    if (!outMin) status = "Missing Punch";
    else if (lateMinutes > 0) status = "Late";
    else if (workedHours > 0 && workedHours < standardHours / 2) status = "Half Day";
  }

  return { status, workedHours, overtimeHours, lateMinutes, earlyLeavingMinutes };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

interface AttendanceContextValue {
  attendance: AttendanceRecord[];
  isBackendConnected: boolean;
  recordFor: (employeeId: string, date: string) => AttendanceRecord | undefined;
  recordsForEmployee: (employeeId: string) => AttendanceRecord[];
  canMark: boolean;
  canEdit: boolean;
  canApprove: boolean;
  markAttendance: (input: MarkAttendanceInput) => Promise<ActionResult & { record?: AttendanceRecord }>;
  updateAttendanceRecord: (id: string, patch: UpdateAttendanceInput, actorName?: string) => Promise<ActionResult>;
}

const AttendanceContext = createContext<AttendanceContextValue | undefined>(undefined);

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const { canFeature, currentUser } = useAccessControl();
  const { currentSiteId, isAllSites, isSuperAdmin } = useSite();

  const attendance = useSyncExternalStore(
    attendanceStore.subscribe,
    attendanceStore.getSnapshot,
    attendanceStore.getServerSnapshot,
  );
  const employees = useSyncExternalStore(
    employeesStore.subscribe,
    employeesStore.getSnapshot,
    employeesStore.getServerSnapshot,
  );

  const [connected, setConnected] = useState(false);

  // Backend-authoritative once connected (Phase 18D) — the backend itself
  // resolves visibility (self / direct reports / site / global) per spec
  // Step 7, so this just mirrors employee-context.tsx's directory fetch:
  // scoped to the selected site, or global for Super Admin's "All Sites".
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
        const apiRecords = await listAttendance(isAllSites ? {} : { siteId: currentSiteId });
        if (cancelled) return;
        attendanceStore.set(apiRecords.map((r) => apiAttendanceToAttendance(r, employees)));
      } catch {
        // Leave the existing cache in place — a transient failure shouldn't blank the page.
      }
    }
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [currentSiteId, isAllSites, isSuperAdmin, employees]);

  const recordFor = useCallback(
    (employeeId: string, date: string) => attendance.find((r) => r.employeeId === employeeId && r.date === date),
    [attendance],
  );
  const recordsForEmployee = useCallback(
    (employeeId: string) => attendance.filter((r) => r.employeeId === employeeId),
    [attendance],
  );

  const canMark = canFeature("attendance.records", "create") || canFeature("attendance.records", "manage");
  const canEdit = canFeature("attendance.records", "edit") || canFeature("attendance.records", "manage");
  const canApprove = canFeature("attendance.records", "approve") || canFeature("attendance.records", "manage");

  const markAttendance = useCallback(
    async (input: MarkAttendanceInput): Promise<ActionResult & { record?: AttendanceRecord }> => {
      if (!canMark) return { ok: false, message: "You're not authorized to mark attendance." };
      const existing = attendanceStore.getSnapshot().find((r) => r.employeeId === input.employeeId && r.date === input.date);
      if (existing) {
        return { ok: false, message: "An attendance record already exists for this employee on this date — edit it instead." };
      }

      if (isBackendConnected()) {
        const employeeDbId = resolveEmployeeDbId(input.employeeId, employees);
        if (!employeeDbId) return { ok: false, message: "Employee not found." };
        try {
          const created = await createAttendanceApi({
            employeeId: employeeDbId,
            date: input.date,
            punchIn: input.punchIn,
            punchOut: input.punchOut,
            status: input.status ? attendanceStatusToApi(input.status) : undefined,
            shiftId: input.shiftId,
            source: input.source ? attendanceSourceToApi(input.source) : undefined,
            remarks: input.remarks,
          });
          const record = apiAttendanceToAttendance(created, employees);
          attendanceStore.set([record, ...attendanceStore.getSnapshot().filter((r) => r.id !== record.id)]);
          return { ok: true, message: `Attendance marked for ${input.date}.`, record };
        } catch (error) {
          return { ok: false, message: errorMessage(error, "Failed to mark attendance.") };
        }
      }

      const derived = deriveFields(input);
      const now = new Date().toISOString();
      const record: AttendanceRecord = {
        id: `att-${input.employeeId}-${input.date}-${Date.now().toString(36)}`,
        employeeId: input.employeeId,
        siteId: input.siteId,
        date: input.date,
        punchIn: NO_PUNCH_STATUSES.includes(derived.status) ? undefined : input.punchIn,
        punchOut: NO_PUNCH_STATUSES.includes(derived.status) ? undefined : input.punchOut,
        status: derived.status,
        shiftId: input.shiftId,
        workedHours: derived.workedHours,
        overtimeHours: derived.overtimeHours,
        lateMinutes: derived.lateMinutes,
        earlyLeavingMinutes: derived.earlyLeavingMinutes,
        source: input.source ?? "MANUAL",
        remarks: input.remarks?.trim() || undefined,
        createdOn: now,
        updatedOn: now,
        updatedBy: currentUser.name,
      };
      attendanceStore.set([record, ...attendanceStore.getSnapshot()]);
      return { ok: true, message: `Attendance marked for ${input.date}.`, record };
    },
    [canMark, currentUser.name, employees],
  );

  const updateAttendanceRecord = useCallback(
    async (id: string, patch: UpdateAttendanceInput, actorName?: string): Promise<ActionResult> => {
      if (!canEdit) return { ok: false, message: "You're not authorized to edit attendance." };
      const existing = attendanceStore.getSnapshot().find((r) => r.id === id);
      if (!existing) return { ok: false, message: "Attendance record not found." };

      if (isBackendConnected()) {
        try {
          const updated = await updateAttendanceApi(id, {
            punchIn: patch.punchIn !== undefined ? patch.punchIn || "" : undefined,
            punchOut: patch.punchOut !== undefined ? patch.punchOut || "" : undefined,
            status: patch.status ? attendanceStatusToApi(patch.status) : undefined,
            shiftId: patch.shiftId,
            remarks: patch.remarks,
          });
          const record = apiAttendanceToAttendance(updated, employees);
          attendanceStore.set(attendanceStore.getSnapshot().map((r) => (r.id === id ? record : r)));
          return { ok: true, message: `Attendance for ${existing.date} updated.` };
        } catch (error) {
          return { ok: false, message: errorMessage(error, "Failed to update attendance.") };
        }
      }

      const merged = {
        punchIn: patch.punchIn !== undefined ? patch.punchIn : existing.punchIn,
        punchOut: patch.punchOut !== undefined ? patch.punchOut : existing.punchOut,
        status: patch.status ?? existing.status,
        shiftStart: patch.shiftStart,
        shiftEnd: patch.shiftEnd,
        gracePeriodMinutes: patch.gracePeriodMinutes,
      };
      const derived = deriveFields({ ...merged, status: patch.status ?? undefined });
      attendanceStore.set(
        attendanceStore.getSnapshot().map((r) =>
          r.id === id
            ? {
                ...r,
                punchIn: NO_PUNCH_STATUSES.includes(derived.status) ? undefined : merged.punchIn,
                punchOut: NO_PUNCH_STATUSES.includes(derived.status) ? undefined : merged.punchOut,
                status: derived.status,
                shiftId: patch.shiftId ?? r.shiftId,
                workedHours: derived.workedHours,
                overtimeHours: derived.overtimeHours,
                lateMinutes: derived.lateMinutes,
                earlyLeavingMinutes: derived.earlyLeavingMinutes,
                remarks: patch.remarks !== undefined ? patch.remarks.trim() || undefined : r.remarks,
                updatedOn: new Date().toISOString(),
                updatedBy: actorName ?? currentUser.name,
              }
            : r,
        ),
      );
      return { ok: true, message: `Attendance for ${existing.date} updated.` };
    },
    [canEdit, currentUser.name, employees],
  );

  const value = useMemo<AttendanceContextValue>(
    () => ({
      attendance,
      isBackendConnected: connected,
      recordFor,
      recordsForEmployee,
      canMark,
      canEdit,
      canApprove,
      markAttendance,
      updateAttendanceRecord,
    }),
    [attendance, connected, recordFor, recordsForEmployee, canMark, canEdit, canApprove, markAttendance, updateAttendanceRecord],
  );

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error("useAttendance must be used within an AttendanceProvider");
  return ctx;
}

/** Pure aggregate helper — reused by the Attendance page today and by Dashboard in a later phase. */
export function summarizeAttendance(records: AttendanceRecord[]) {
  return {
    present: records.filter((r) => r.status === "Present").length,
    absent: records.filter((r) => r.status === "Absent").length,
    onLeave: records.filter((r) => r.status === "On Leave").length,
    late: records.filter((r) => r.status === "Late").length,
    halfDay: records.filter((r) => r.status === "Half Day").length,
    missingPunch: records.filter((r) => r.status === "Missing Punch").length,
    weekend: records.filter((r) => r.status === "Weekend").length,
    holiday: records.filter((r) => r.status === "Holiday").length,
    overtimeHours: Math.round(records.reduce((sum, r) => sum + r.overtimeHours, 0) * 100) / 100,
  };
}

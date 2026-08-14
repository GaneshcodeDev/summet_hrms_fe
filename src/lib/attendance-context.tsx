"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { attendanceStore } from "@/lib/attendance-store";
import { useAccessControl } from "@/lib/access-control-context";
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

/** Derives status/workedHours/overtimeHours/lateMinutes from punch times + shift/grace period. Manual status always wins if explicitly provided. */
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

interface AttendanceContextValue {
  attendance: AttendanceRecord[];
  recordFor: (employeeId: string, date: string) => AttendanceRecord | undefined;
  recordsForEmployee: (employeeId: string) => AttendanceRecord[];
  canMark: boolean;
  canEdit: boolean;
  canApprove: boolean;
  markAttendance: (input: MarkAttendanceInput) => ActionResult & { record?: AttendanceRecord };
  updateAttendanceRecord: (id: string, patch: UpdateAttendanceInput, actorName?: string) => ActionResult;
}

const AttendanceContext = createContext<AttendanceContextValue | undefined>(undefined);

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const { canFeature, currentUser } = useAccessControl();

  const attendance = useSyncExternalStore(
    attendanceStore.subscribe,
    attendanceStore.getSnapshot,
    attendanceStore.getServerSnapshot,
  );

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
    (input: MarkAttendanceInput): ActionResult & { record?: AttendanceRecord } => {
      if (!canMark) return { ok: false, message: "You're not authorized to mark attendance." };
      const existing = attendanceStore.getSnapshot().find((r) => r.employeeId === input.employeeId && r.date === input.date);
      if (existing) {
        return { ok: false, message: "An attendance record already exists for this employee on this date — edit it instead." };
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
    [canMark, currentUser.name],
  );

  const updateAttendanceRecord = useCallback(
    (id: string, patch: UpdateAttendanceInput, actorName?: string): ActionResult => {
      if (!canEdit) return { ok: false, message: "You're not authorized to edit attendance." };
      const existing = attendanceStore.getSnapshot().find((r) => r.id === id);
      if (!existing) return { ok: false, message: "Attendance record not found." };
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
    [canEdit, currentUser.name],
  );

  const value = useMemo<AttendanceContextValue>(
    () => ({
      attendance,
      recordFor,
      recordsForEmployee,
      canMark,
      canEdit,
      canApprove,
      markAttendance,
      updateAttendanceRecord,
    }),
    [attendance, recordFor, recordsForEmployee, canMark, canEdit, canApprove, markAttendance, updateAttendanceRecord],
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

"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import type { AttendanceRecord } from "@/lib/types";

/**
 * Plain (non-React) persistence for attendance records, mirroring
 * employee-store.ts / org-store.ts. One row per employee per date, always
 * keyed by employeeId + siteId (never by name). Real product starts empty —
 * see demo-seed.ts for the optional demo dataset, generated from actual
 * demo employees rather than a static array.
 */
export const attendanceStore = createLocalStorageStore<AttendanceRecord[]>("hrms_attendance", []);

export function findAttendanceRecord(employeeId: string, date: string): AttendanceRecord | undefined {
  return attendanceStore.getSnapshot().find((r) => r.employeeId === employeeId && r.date === date);
}

export function recordsForEmployee(employeeId: string): AttendanceRecord[] {
  return attendanceStore.getSnapshot().filter((r) => r.employeeId === employeeId);
}

export function recordsForSite(siteId: string): AttendanceRecord[] {
  return attendanceStore.getSnapshot().filter((r) => r.siteId === siteId);
}

"use client";

import { apiFetch } from "./api-client";

/**
 * Shape as returned by summet_hrms_be — see prisma/schema.prisma
 * AttendanceRecord model. `employeeId`/`siteId`/`shiftId` are the real
 * backend ids (UUIDs) — NOT the frontend's display `employeeId` (which is
 * actually Employee.employeeCode, see mappers.ts's apiEmployeeToEmployee).
 * apiAttendanceToAttendance() bridges the two.
 */
export interface ApiAttendanceRecord {
  id: string;
  employeeId: string;
  siteId: string;
  date: string;
  punchIn: string | null;
  punchOut: string | null;
  status: "Present" | "Absent" | "HalfDay" | "Late" | "OnLeave" | "Weekend" | "Holiday" | "MissingPunch";
  shiftId: string | null;
  workedHours: number;
  overtimeHours: number;
  lateMinutes: number;
  earlyLeavingMinutes: number;
  source: "Manual" | "Biometric" | "Mobile" | "Import" | "Api" | "System";
  remarks: string | null;
  leaveRequestId: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceQuery {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  employeeId?: string;
  siteId?: string;
  departmentId?: string;
  shiftId?: string;
  status?: ApiAttendanceRecord["status"];
}

function toQueryString(query: AttendanceQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listAttendance(query: AttendanceQuery = {}): Promise<ApiAttendanceRecord[]> {
  return apiFetch<ApiAttendanceRecord[]>(`/attendance${toQueryString(query)}`);
}

export function getAttendance(id: string): Promise<ApiAttendanceRecord> {
  return apiFetch<ApiAttendanceRecord>(`/attendance/${id}`);
}

export interface CreateAttendancePayload {
  employeeId: string;
  date: string;
  punchIn?: string;
  punchOut?: string;
  status?: ApiAttendanceRecord["status"];
  shiftId?: string;
  source?: ApiAttendanceRecord["source"];
  remarks?: string;
}

export function createAttendanceApi(payload: CreateAttendancePayload): Promise<ApiAttendanceRecord> {
  return apiFetch<ApiAttendanceRecord>("/attendance", { method: "POST", body: payload });
}

export interface UpdateAttendancePayload {
  punchIn?: string;
  punchOut?: string;
  status?: ApiAttendanceRecord["status"];
  shiftId?: string;
  source?: ApiAttendanceRecord["source"];
  remarks?: string;
}

export function updateAttendanceApi(id: string, payload: UpdateAttendancePayload): Promise<ApiAttendanceRecord> {
  return apiFetch<ApiAttendanceRecord>(`/attendance/${id}`, { method: "PATCH", body: payload });
}

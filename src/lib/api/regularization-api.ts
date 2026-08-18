"use client";

import { apiFetch } from "./api-client";
import type { ApiAttendanceRecord } from "./attendance-api";

/**
 * Shape as returned by summet_hrms_be — see prisma/schema.prisma
 * AttendanceRegularization model. `requestedBy`/`decidedBy`/`siteId`/
 * `attendanceRecordId` are real backend ids (UUIDs) — bridged to the
 * frontend's display ids by apiRegularizationToRegularization() in
 * mappers.ts.
 */
export interface ApiAttendanceRegularization {
  id: string;
  requestedBy: string;
  siteId: string;
  date: string;
  attendanceRecordId: string | null;
  currentStatus: ApiAttendanceRecord["status"];
  requestedStatus: ApiAttendanceRecord["status"];
  requestedPunchIn: string | null;
  requestedPunchOut: string | null;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  decidedBy: string | null;
  decisionReason: string | null;
  decidedOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegularizationQuery {
  employeeId?: string;
  siteId?: string;
  status?: ApiAttendanceRegularization["status"];
}

function toQueryString(query: RegularizationQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listRegularizations(query: RegularizationQuery = {}): Promise<ApiAttendanceRegularization[]> {
  return apiFetch<ApiAttendanceRegularization[]>(`/regularization${toQueryString(query)}`);
}

export function getRegularization(id: string): Promise<ApiAttendanceRegularization> {
  return apiFetch<ApiAttendanceRegularization>(`/regularization/${id}`);
}

export interface ApplyRegularizationPayload {
  date: string;
  requestedStatus: ApiAttendanceRecord["status"];
  requestedPunchIn?: string;
  requestedPunchOut?: string;
  reason: string;
}

export function applyRegularizationApi(
  payload: ApplyRegularizationPayload,
): Promise<ApiAttendanceRegularization> {
  return apiFetch<ApiAttendanceRegularization>("/regularization", { method: "POST", body: payload });
}

export function decideRegularizationApi(
  id: string,
  status: "Approved" | "Rejected",
  decisionReason?: string,
): Promise<ApiAttendanceRegularization> {
  return apiFetch<ApiAttendanceRegularization>(`/regularization/${id}/decide`, {
    method: "PATCH",
    body: { status, decisionReason },
  });
}

export function cancelRegularizationApi(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/regularization/${id}/cancel`, { method: "PATCH" });
}

"use client";

import { apiFetch } from "./api-client";

/** Shape as returned by summet_hrms_be — see prisma/schema.prisma MasterRecord model. */
export interface ApiMasterRecord {
  id: string;
  masterType: string;
  name: string;
  code: string;
  description: string | null;
  status: "Active" | "Inactive";
  siteId: string | null;
  attributes: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

/** siteId omitted entirely for global-scope types — never send an empty string, the backend rejects any siteId on those. */
export function listMasterRecords(masterType: string, siteId?: string): Promise<ApiMasterRecord[]> {
  const query = new URLSearchParams({ type: masterType });
  if (siteId) query.set("siteId", siteId);
  return apiFetch<ApiMasterRecord[]>(`/masters?${query.toString()}`);
}

export function getMasterRecord(id: string): Promise<ApiMasterRecord> {
  return apiFetch<ApiMasterRecord>(`/masters/${id}`);
}

export interface CreateMasterRecordPayload {
  masterType: string;
  name: string;
  code: string;
  description?: string;
  siteId?: string;
  attributes?: Record<string, string | number | boolean | undefined>;
}

export function createMasterRecord(payload: CreateMasterRecordPayload): Promise<ApiMasterRecord> {
  return apiFetch<ApiMasterRecord>("/masters", { method: "POST", body: payload });
}

export interface UpdateMasterRecordPayload {
  name?: string;
  code?: string;
  description?: string;
  attributes?: Record<string, string | number | boolean | undefined>;
}

export function updateMasterRecord(id: string, payload: UpdateMasterRecordPayload): Promise<ApiMasterRecord> {
  return apiFetch<ApiMasterRecord>(`/masters/${id}`, { method: "PATCH", body: payload });
}

export function setMasterRecordStatus(id: string, status: ApiMasterRecord["status"]): Promise<ApiMasterRecord> {
  return apiFetch<ApiMasterRecord>(`/masters/${id}/status`, { method: "PATCH", body: { status } });
}

"use client";

import { apiFetch } from "./api-client";

/** Shape as returned by summet_hrms_be — see prisma/schema.prisma OrgUnit model. */
export interface ApiOrgUnit {
  id: string;
  siteId: string;
  type: "Company" | "BusinessUnit" | "Division" | "Department" | "SubDepartment" | "Branch" | "Plant" | "Location" | "CostCenter" | "ProfitCenter";
  name: string;
  code: string;
  parentId: string | null;
  headEmployeeId: string | null;
  status: "Active" | "Inactive";
  description: string | null;
  locationKind: "Block" | "Building" | "Floor" | "Location" | null;
  createdAt: string;
  updatedAt: string;
}

export function listOrgUnits(siteId: string): Promise<ApiOrgUnit[]> {
  return apiFetch<ApiOrgUnit[]>(`/org-units?siteId=${encodeURIComponent(siteId)}`);
}

export function getOrgUnit(id: string): Promise<ApiOrgUnit> {
  return apiFetch<ApiOrgUnit>(`/org-units/${id}`);
}

export interface CreateOrgUnitPayload {
  siteId: string;
  type: ApiOrgUnit["type"];
  name: string;
  code: string;
  parentId?: string | null;
  headEmployeeId?: string;
  description?: string;
  locationKind?: ApiOrgUnit["locationKind"];
}

export function createOrgUnit(payload: CreateOrgUnitPayload): Promise<ApiOrgUnit> {
  return apiFetch<ApiOrgUnit>("/org-units", { method: "POST", body: payload });
}

export interface UpdateOrgUnitPayload {
  name?: string;
  code?: string;
  parentId?: string | null;
  headEmployeeId?: string;
  description?: string;
  locationKind?: ApiOrgUnit["locationKind"];
}

export function updateOrgUnit(id: string, payload: UpdateOrgUnitPayload): Promise<ApiOrgUnit> {
  return apiFetch<ApiOrgUnit>(`/org-units/${id}`, { method: "PATCH", body: payload });
}

export function setOrgUnitStatus(id: string, status: ApiOrgUnit["status"]): Promise<ApiOrgUnit> {
  return apiFetch<ApiOrgUnit>(`/org-units/${id}/status`, { method: "PATCH", body: { status } });
}

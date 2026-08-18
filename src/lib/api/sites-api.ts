"use client";

import { apiFetch } from "./api-client";

/** Shape as returned by summet_hrms_be — see prisma/schema.prisma Site model. */
export interface ApiSite {
  id: string;
  code: string;
  name: string;
  legalName: string | null;
  siteType: ApiSiteType | null;
  industry: string | null;
  email: string | null;
  phone: string | null;
  timezone: string | null;
  currency: string | null;
  isActive: boolean;
  logoColor: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  package: "Starter" | "Professional" | "Enterprise";
  status: "Active" | "Trial" | "Suspended";
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  onboardingCompletedOn: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Backend enum identifiers (no spaces) — see prisma/schema.prisma SiteTypeCatalog. */
export type ApiSiteType = "CorporateOffice" | "ManufacturingPlant" | "BranchOffice" | "Warehouse" | "RetailOutlet" | "Other";

export function listSites(): Promise<ApiSite[]> {
  return apiFetch<ApiSite[]>("/sites");
}

export function getSite(id: string): Promise<ApiSite> {
  return apiFetch<ApiSite>(`/sites/${id}`);
}

export type CreateSitePayload = Omit<ApiSite, "id" | "isActive" | "onboardingCompletedOn" | "createdAt" | "updatedAt">;

export function updateSite(id: string, payload: Partial<CreateSitePayload>): Promise<ApiSite> {
  return apiFetch<ApiSite>(`/sites/${id}`, { method: "PATCH", body: payload });
}

export function setSiteStatus(id: string, status: ApiSite["status"]): Promise<ApiSite> {
  return apiFetch<ApiSite>(`/sites/${id}/status`, { method: "PATCH", body: { status } });
}

export interface OnboardSitePayload {
  basic: {
    name: string;
    code: string;
    legalName?: string;
    siteType?: ApiSiteType;
    industry?: string;
    email?: string;
    phone?: string;
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    timezone?: string;
    currency?: string;
    status: ApiSite["status"];
    package: ApiSite["package"];
    logoColor: string;
  };
  orgSetup: Partial<{
    businessUnits: string[];
    plants: string[];
    locations: string[];
    costCenters: string[];
    profitCenters: string[];
    departments: string[];
    subDepartments: string[];
    designations: string[];
    grades: string[];
    employmentTypes: string[];
    employeeTypes: string[];
  }>;
  admin: { fullName: string; email: string; password: string };
  config: {
    attendance: {
      workingDays: string[];
      weeklyOff: string[];
      defaultShiftId?: string;
      gracePeriodMinutes: number;
      lateComingRule: string;
      earlyGoingRule: string;
      overtimeEnabled: boolean;
    };
    leave: {
      enabledLeaveTypes: { name: string; maxDaysPerYear: number }[];
      approvalMode: "Manager" | "HR" | "Manager then HR";
      carryForwardEnabled: boolean;
      carryForwardMaxDays: number;
    };
    payroll: {
      frequency: "Monthly" | "Bi-Weekly" | "Weekly";
      payCycleStartDay: number;
      processingDay: number;
      defaultComponents: string[];
    };
    holiday: { calendarName: string; holidays: { name: string; date: string }[] };
  };
}

export interface OnboardSiteResponse {
  site: ApiSite;
  admin: { id: string; email: string; fullName: string };
}

export function onboardSite(payload: OnboardSitePayload): Promise<OnboardSiteResponse> {
  return apiFetch<OnboardSiteResponse>("/sites/onboarding", { method: "POST", body: payload });
}

/** Shape as returned by summet_hrms_be — see prisma/schema.prisma SiteConfig model. */
export interface ApiSiteConfig {
  id: string;
  siteId: string;
  attendance: Record<string, unknown>;
  leave: Record<string, unknown>;
  payroll: Record<string, unknown>;
  holiday: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export function getSiteConfig(siteId: string): Promise<ApiSiteConfig> {
  return apiFetch<ApiSiteConfig>(`/sites/${siteId}/config`);
}

export interface SetSiteConfigPayload {
  attendance: Record<string, unknown>;
  leave: Record<string, unknown>;
  payroll: Record<string, unknown>;
  holiday: Record<string, unknown>;
}

export function setSiteConfig(siteId: string, payload: SetSiteConfigPayload): Promise<ApiSiteConfig> {
  return apiFetch<ApiSiteConfig>(`/sites/${siteId}/config`, { method: "PATCH", body: payload });
}

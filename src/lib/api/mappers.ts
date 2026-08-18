import type { MasterRecord, MasterType, OrgUnit, Site, SiteType } from "@/lib/types";
import type { ApiMasterRecord } from "./masters-api";
import type { ApiOrgUnit } from "./organization-api";
import type { ApiSite, ApiSiteType, CreateSitePayload } from "./sites-api";

/**
 * The frontend's SiteType catalog uses spaced display labels ("Corporate
 * Office"); the backend's Prisma enum can't contain spaces
 * (CorporateOffice) — this is the one place that difference is bridged so
 * every other file keeps working with the frontend's existing labels.
 */
const SITE_TYPE_TO_API: Record<SiteType, ApiSiteType> = {
  "Corporate Office": "CorporateOffice",
  "Manufacturing Plant": "ManufacturingPlant",
  "Branch Office": "BranchOffice",
  Warehouse: "Warehouse",
  "Retail Outlet": "RetailOutlet",
  Other: "Other",
};
const SITE_TYPE_FROM_API: Record<ApiSiteType, SiteType> = {
  CorporateOffice: "Corporate Office",
  ManufacturingPlant: "Manufacturing Plant",
  BranchOffice: "Branch Office",
  Warehouse: "Warehouse",
  RetailOutlet: "Retail Outlet",
  Other: "Other",
};

export function apiSiteTypeToSiteType(value: ApiSiteType | null | undefined): SiteType | undefined {
  return value ? SITE_TYPE_FROM_API[value] : undefined;
}

export function siteTypeToApiSiteType(value: SiteType | null | undefined): ApiSiteType | undefined {
  return value ? SITE_TYPE_TO_API[value] : undefined;
}

export function apiSiteToSite(apiSite: ApiSite): Site {
  return {
    id: apiSite.id,
    name: apiSite.name,
    code: apiSite.code,
    legalName: apiSite.legalName ?? undefined,
    siteType: apiSiteTypeToSiteType(apiSite.siteType),
    industry: apiSite.industry ?? undefined,
    email: apiSite.email ?? undefined,
    phone: apiSite.phone ?? undefined,
    timezone: apiSite.timezone ?? undefined,
    currency: apiSite.currency ?? undefined,
    logoColor: apiSite.logoColor,
    addressLine1: apiSite.addressLine1,
    city: apiSite.city,
    state: apiSite.state,
    pincode: apiSite.pincode,
    country: apiSite.country,
    package: apiSite.package,
    status: apiSite.status,
    adminName: apiSite.adminName,
    adminEmail: apiSite.adminEmail,
    adminPhone: apiSite.adminPhone,
    createdOn: apiSite.createdAt,
    onboardingCompletedOn: apiSite.onboardingCompletedOn ?? undefined,
  };
}

/** For PATCH /sites/:id — `code` is technically editable server-side but callers should treat it as immutable in practice. */
export function siteToApiUpdatePayload(site: Partial<Site>): Partial<CreateSitePayload> {
  const payload: Partial<CreateSitePayload> = {};
  if (site.name !== undefined) payload.name = site.name;
  if (site.code !== undefined) payload.code = site.code;
  if (site.legalName !== undefined) payload.legalName = site.legalName;
  if (site.siteType !== undefined) payload.siteType = siteTypeToApiSiteType(site.siteType);
  if (site.industry !== undefined) payload.industry = site.industry;
  if (site.email !== undefined) payload.email = site.email;
  if (site.phone !== undefined) payload.phone = site.phone;
  if (site.timezone !== undefined) payload.timezone = site.timezone;
  if (site.currency !== undefined) payload.currency = site.currency;
  if (site.logoColor !== undefined) payload.logoColor = site.logoColor;
  if (site.addressLine1 !== undefined) payload.addressLine1 = site.addressLine1;
  if (site.city !== undefined) payload.city = site.city;
  if (site.state !== undefined) payload.state = site.state;
  if (site.pincode !== undefined) payload.pincode = site.pincode;
  if (site.country !== undefined) payload.country = site.country;
  if (site.package !== undefined) payload.package = site.package;
  if (site.status !== undefined) payload.status = site.status;
  if (site.adminName !== undefined) payload.adminName = site.adminName;
  if (site.adminEmail !== undefined) payload.adminEmail = site.adminEmail;
  if (site.adminPhone !== undefined) payload.adminPhone = site.adminPhone;
  return payload;
}

export function apiOrgUnitToOrgUnit(apiUnit: ApiOrgUnit): OrgUnit {
  return {
    id: apiUnit.id,
    type: apiUnit.type,
    name: apiUnit.name,
    code: apiUnit.code,
    parentId: apiUnit.parentId,
    siteId: apiUnit.siteId,
    headEmployeeId: apiUnit.headEmployeeId ?? undefined,
    status: apiUnit.status,
    description: apiUnit.description ?? undefined,
    locationKind: apiUnit.locationKind ?? undefined,
    createdOn: apiUnit.createdAt,
    updatedOn: apiUnit.updatedAt,
  };
}

export function apiMasterRecordToMasterRecord(apiRecord: ApiMasterRecord): MasterRecord {
  return {
    id: apiRecord.id,
    masterType: apiRecord.masterType as MasterType,
    name: apiRecord.name,
    code: apiRecord.code,
    description: apiRecord.description ?? undefined,
    status: apiRecord.status,
    siteId: apiRecord.siteId ?? undefined,
    attributes: apiRecord.attributes,
    createdOn: apiRecord.createdAt,
    updatedOn: apiRecord.updatedAt,
  };
}

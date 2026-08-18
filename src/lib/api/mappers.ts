import type {
  AttendanceRecord,
  AttendanceRegularization,
  AttendanceSource,
  AttendanceStatus,
  Employee,
  EmployeeBankDetail,
  EmployeeDocumentRecord,
  MasterRecord,
  MasterType,
  OrgUnit,
  RegularizationStatus,
  Site,
  SiteType,
} from "@/lib/types";
import type { ApiAttendanceRecord } from "./attendance-api";
import type {
  ApiEmployee,
  ApiEmployeeBankDetail,
  ApiEmployeeDocument,
  CreateEmployeePayload,
  UpdateEmployeePayload,
} from "./employees-api";
import type { ApiMasterRecord } from "./masters-api";
import type { ApiOrgUnit } from "./organization-api";
import type { ApiAttendanceRegularization } from "./regularization-api";
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

/** Matches the frontend's EmploymentStage exactly — the backend enum has no spaces (Phase 18C). */
const EMPLOYMENT_STAGE_FROM_API: Record<ApiEmployee["employmentStage"], Employee["employmentStage"]> = {
  Probation: "Probation",
  Confirmed: "Confirmed",
  OnNotice: "On Notice",
  Exited: "Exited",
};
const EMPLOYMENT_STAGE_TO_API: Record<NonNullable<Employee["employmentStage"]>, ApiEmployee["employmentStage"]> = {
  Probation: "Probation",
  Confirmed: "Confirmed",
  "On Notice": "OnNotice",
  Exited: "Exited",
};

/**
 * Backend Employee has no plain display strings (name/department/
 * designation/location/reportingTo) — every other frontend module that
 * hasn't migrated yet (Attendance/Leave/Payroll/...) still reads those
 * fields directly (spec §18 compatibility), so this resolves them here,
 * once, from the FK ids against the already-loaded Org/Master/Employee
 * caches — never duplicated as authoritative data on the backend itself.
 */
export function apiEmployeeToEmployee(
  apiEmployee: ApiEmployee,
  orgUnits: OrgUnit[],
  masterRecords: MasterRecord[],
  allEmployees: Pick<Employee, "id" | "employeeId">[] = [],
): Employee {
  const department = orgUnits.find((u) => u.id === apiEmployee.departmentId)?.name ?? "";
  const designation = masterRecords.find((m) => m.id === apiEmployee.designationId)?.name ?? "";
  const location = orgUnits.find((u) => u.id === apiEmployee.locationId)?.name ?? "";
  const reportingManager = apiEmployee.reportingManagerId
    ? allEmployees.find((e) => e.id === apiEmployee.reportingManagerId)
    : undefined;

  return {
    id: apiEmployee.id,
    employeeId: apiEmployee.employeeCode,
    name: `${apiEmployee.firstName} ${apiEmployee.middleName ?? ""} ${apiEmployee.lastName}`
      .replace(/\s+/g, " ")
      .trim(),
    email: apiEmployee.email,
    phone: apiEmployee.phone,
    department,
    designation,
    status: apiEmployee.status,
    reportingTo: reportingManager?.employeeId,
    location,
    dateOfJoining: apiEmployee.joiningDate.slice(0, 10),
    dateOfBirth: apiEmployee.dateOfBirth?.slice(0, 10),
    siteId: apiEmployee.siteId,
    reportingManagerId: apiEmployee.reportingManagerId ?? undefined,
    businessUnitId: apiEmployee.businessUnitId ?? undefined,
    departmentId: apiEmployee.departmentId ?? undefined,
    subDepartmentId: apiEmployee.subDepartmentId ?? undefined,
    designationId: apiEmployee.designationId ?? undefined,
    gradeId: apiEmployee.gradeId ?? undefined,
    locationId: apiEmployee.locationId ?? undefined,
    plantId: apiEmployee.plantId ?? undefined,
    costCenterId: apiEmployee.costCenterId ?? undefined,
    profitCenterId: apiEmployee.profitCenterId ?? undefined,
    shiftId: apiEmployee.shiftId ?? undefined,
    employmentTypeId: apiEmployee.employmentTypeId ?? undefined,
    employeeTypeId: apiEmployee.employeeTypeId ?? undefined,
    firstName: apiEmployee.firstName,
    lastName: apiEmployee.lastName,
    profilePhotoUrl: apiEmployee.profilePhotoUrl ?? undefined,
    gender: apiEmployee.gender ?? undefined,
    maritalStatus: apiEmployee.maritalStatus ?? undefined,
    personalEmail: apiEmployee.personalEmail ?? undefined,
    alternatePhone: apiEmployee.alternatePhone ?? undefined,
    addressLine1: apiEmployee.addressLine1 ?? undefined,
    city: apiEmployee.city ?? undefined,
    state: apiEmployee.state ?? undefined,
    country: apiEmployee.country ?? undefined,
    pincode: apiEmployee.pincode ?? undefined,
    employmentStage: EMPLOYMENT_STAGE_FROM_API[apiEmployee.employmentStage],
    confirmationDate: apiEmployee.confirmationDate?.slice(0, 10),
    probationPeriodMonths: apiEmployee.probationPeriodMonths ?? undefined,
    pan: apiEmployee.pan ?? undefined,
    pfNumber: apiEmployee.pfNumber ?? undefined,
    uan: apiEmployee.uan ?? undefined,
    esiNumber: apiEmployee.esiNumber ?? undefined,
  };
}

/** Minimal shape covering every field EmployeeDraft (employee-context.tsx) actually has — avoids a circular import. */
interface EmployeeDraftLike {
  siteId: string;
  name: string;
  email: string;
  phone: string;
  dateOfJoining?: string;
  reportingManagerId?: string;
  businessUnitId?: string;
  departmentId?: string;
  subDepartmentId?: string;
  designationId?: string;
  gradeId?: string;
  plantId?: string;
  locationId?: string;
  costCenterId?: string;
  profitCenterId?: string;
  shiftId?: string;
  employmentTypeId?: string;
  employeeTypeId?: string;
  firstName?: string;
  lastName?: string;
  gender?: Employee["gender"];
  maritalStatus?: Employee["maritalStatus"];
  dateOfBirth?: string;
  personalEmail?: string;
  alternatePhone?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  employmentStage?: Employee["employmentStage"];
  confirmationDate?: string;
  probationPeriodMonths?: number;
  pan?: string;
  pfNumber?: string;
  uan?: string;
  esiNumber?: string;
}

/** `name` splits into firstName/lastName if those weren't supplied directly — the backend has no plain `name` field. */
function splitName(draft: EmployeeDraftLike): { firstName: string; lastName: string } {
  if (draft.firstName || draft.lastName) {
    return { firstName: draft.firstName ?? "", lastName: draft.lastName ?? draft.name };
  }
  const parts = draft.name.trim().split(/\s+/);
  return { firstName: parts[0] ?? draft.name, lastName: parts.slice(1).join(" ") || parts[0] || draft.name };
}

export function employeeDraftToApiCreatePayload(draft: EmployeeDraftLike): CreateEmployeePayload {
  const { firstName, lastName } = splitName(draft);
  return {
    siteId: draft.siteId,
    firstName,
    lastName,
    email: draft.email,
    phone: draft.phone,
    joiningDate: draft.dateOfJoining || new Date().toISOString().slice(0, 10),
    gender: draft.gender,
    maritalStatus: draft.maritalStatus,
    dateOfBirth: draft.dateOfBirth,
    personalEmail: draft.personalEmail,
    alternatePhone: draft.alternatePhone,
    addressLine1: draft.addressLine1,
    city: draft.city,
    state: draft.state,
    country: draft.country,
    pincode: draft.pincode,
    employmentStage: draft.employmentStage ? EMPLOYMENT_STAGE_TO_API[draft.employmentStage] : undefined,
    confirmationDate: draft.confirmationDate,
    probationPeriodMonths: draft.probationPeriodMonths,
    reportingManagerId: draft.reportingManagerId,
    businessUnitId: draft.businessUnitId,
    departmentId: draft.departmentId,
    subDepartmentId: draft.subDepartmentId,
    designationId: draft.designationId,
    gradeId: draft.gradeId,
    plantId: draft.plantId,
    locationId: draft.locationId,
    costCenterId: draft.costCenterId,
    profitCenterId: draft.profitCenterId,
    shiftId: draft.shiftId,
    employmentTypeId: draft.employmentTypeId,
    employeeTypeId: draft.employeeTypeId,
    pan: draft.pan,
    pfNumber: draft.pfNumber,
    uan: draft.uan,
    esiNumber: draft.esiNumber,
  };
}

/** Partial variant for PATCH /employees/:id — only fields actually present on the patch are sent. */
export function employeePatchToApiUpdatePayload(patch: Partial<EmployeeDraftLike>): UpdateEmployeePayload {
  const payload: UpdateEmployeePayload = {};
  if (patch.name !== undefined || patch.firstName !== undefined || patch.lastName !== undefined) {
    const { firstName, lastName } = splitName(patch as EmployeeDraftLike);
    if (firstName) payload.firstName = firstName;
    if (lastName) payload.lastName = lastName;
  }
  if (patch.email !== undefined) payload.email = patch.email;
  if (patch.phone !== undefined) payload.phone = patch.phone;
  if (patch.dateOfJoining !== undefined) payload.joiningDate = patch.dateOfJoining;
  if (patch.gender !== undefined) payload.gender = patch.gender;
  if (patch.maritalStatus !== undefined) payload.maritalStatus = patch.maritalStatus;
  if (patch.dateOfBirth !== undefined) payload.dateOfBirth = patch.dateOfBirth;
  if (patch.personalEmail !== undefined) payload.personalEmail = patch.personalEmail;
  if (patch.alternatePhone !== undefined) payload.alternatePhone = patch.alternatePhone;
  if (patch.addressLine1 !== undefined) payload.addressLine1 = patch.addressLine1;
  if (patch.city !== undefined) payload.city = patch.city;
  if (patch.state !== undefined) payload.state = patch.state;
  if (patch.country !== undefined) payload.country = patch.country;
  if (patch.pincode !== undefined) payload.pincode = patch.pincode;
  if (patch.employmentStage !== undefined) {
    payload.employmentStage = EMPLOYMENT_STAGE_TO_API[patch.employmentStage];
  }
  if (patch.confirmationDate !== undefined) payload.confirmationDate = patch.confirmationDate;
  if (patch.probationPeriodMonths !== undefined) payload.probationPeriodMonths = patch.probationPeriodMonths;
  if (patch.reportingManagerId !== undefined) payload.reportingManagerId = patch.reportingManagerId;
  if (patch.businessUnitId !== undefined) payload.businessUnitId = patch.businessUnitId;
  if (patch.departmentId !== undefined) payload.departmentId = patch.departmentId;
  if (patch.subDepartmentId !== undefined) payload.subDepartmentId = patch.subDepartmentId;
  if (patch.designationId !== undefined) payload.designationId = patch.designationId;
  if (patch.gradeId !== undefined) payload.gradeId = patch.gradeId;
  if (patch.plantId !== undefined) payload.plantId = patch.plantId;
  if (patch.locationId !== undefined) payload.locationId = patch.locationId;
  if (patch.costCenterId !== undefined) payload.costCenterId = patch.costCenterId;
  if (patch.profitCenterId !== undefined) payload.profitCenterId = patch.profitCenterId;
  if (patch.shiftId !== undefined) payload.shiftId = patch.shiftId;
  if (patch.employmentTypeId !== undefined) payload.employmentTypeId = patch.employmentTypeId;
  if (patch.employeeTypeId !== undefined) payload.employeeTypeId = patch.employeeTypeId;
  if (patch.pan !== undefined) payload.pan = patch.pan;
  if (patch.pfNumber !== undefined) payload.pfNumber = patch.pfNumber;
  if (patch.uan !== undefined) payload.uan = patch.uan;
  if (patch.esiNumber !== undefined) payload.esiNumber = patch.esiNumber;
  return payload;
}

export function apiBankDetailToBankDetail(apiBank: ApiEmployeeBankDetail): EmployeeBankDetail {
  return {
    id: apiBank.id,
    employeeId: apiBank.employeeId,
    siteId: apiBank.siteId,
    accountHolderName: apiBank.accountHolderName,
    bankName: apiBank.bankName,
    accountNumber: apiBank.accountNumber,
    ifsc: apiBank.ifsc,
    branch: apiBank.branch,
    accountType: apiBank.accountType,
    updatedOn: apiBank.updatedAt,
    updatedBy: apiBank.updatedBy ?? undefined,
  };
}

export function apiDocumentToDocumentRecord(apiDoc: ApiEmployeeDocument): EmployeeDocumentRecord {
  return {
    id: apiDoc.id,
    employeeId: apiDoc.employeeId,
    siteId: apiDoc.siteId,
    documentType: apiDoc.documentType,
    documentNumber: apiDoc.documentNumber ?? undefined,
    issueDate: apiDoc.issueDate?.slice(0, 10),
    expiryDate: apiDoc.expiryDate?.slice(0, 10),
    fileRef: apiDoc.fileRef ?? undefined,
    status: apiDoc.status,
    uploadedOn: apiDoc.createdAt.slice(0, 10),
    verifiedBy: apiDoc.verifiedBy ?? undefined,
    verifiedOn: apiDoc.verifiedOn?.slice(0, 10),
  };
}

// ====================================================================
// Phase 18D — Attendance + Regularization. The frontend's AttendanceRecord/
// AttendanceRegularization types key employees by `employeeId`, which
// (like Employee.reportingTo — see apiEmployeeToEmployee above) is
// actually Employee.employeeCode, NOT the backend's real Employee.id
// (UUID). Every attendance-api/regularization-api payload uses the real
// UUID (it's a Prisma FK); these mappers are the one place that
// difference is bridged, using the already-hydrated employees list the
// same way reportingManager resolution does.
// ====================================================================

const ATTENDANCE_STATUS_TO_API: Record<AttendanceStatus, ApiAttendanceRecord["status"]> = {
  Present: "Present",
  Absent: "Absent",
  "Half Day": "HalfDay",
  Late: "Late",
  "On Leave": "OnLeave",
  Weekend: "Weekend",
  Holiday: "Holiday",
  "Missing Punch": "MissingPunch",
};
const ATTENDANCE_STATUS_FROM_API: Record<ApiAttendanceRecord["status"], AttendanceStatus> = {
  Present: "Present",
  Absent: "Absent",
  HalfDay: "Half Day",
  Late: "Late",
  OnLeave: "On Leave",
  Weekend: "Weekend",
  Holiday: "Holiday",
  MissingPunch: "Missing Punch",
};

export function attendanceStatusToApi(status: AttendanceStatus): ApiAttendanceRecord["status"] {
  return ATTENDANCE_STATUS_TO_API[status];
}
export function apiAttendanceStatusToStatus(status: ApiAttendanceRecord["status"]): AttendanceStatus {
  return ATTENDANCE_STATUS_FROM_API[status];
}

const ATTENDANCE_SOURCE_TO_API: Record<AttendanceSource, ApiAttendanceRecord["source"]> = {
  MANUAL: "Manual",
  BIOMETRIC: "Biometric",
  MOBILE: "Mobile",
  IMPORT: "Import",
  API: "Api",
  SYSTEM: "System",
};
const ATTENDANCE_SOURCE_FROM_API: Record<ApiAttendanceRecord["source"], AttendanceSource> = {
  Manual: "MANUAL",
  Biometric: "BIOMETRIC",
  Mobile: "MOBILE",
  Import: "IMPORT",
  Api: "API",
  System: "SYSTEM",
};

export function attendanceSourceToApi(source: AttendanceSource): ApiAttendanceRecord["source"] {
  return ATTENDANCE_SOURCE_TO_API[source];
}
export function apiAttendanceSourceToSource(source: ApiAttendanceRecord["source"]): AttendanceSource {
  return ATTENDANCE_SOURCE_FROM_API[source];
}

type EmployeeIdLookup = Pick<Employee, "id" | "employeeId">;

/** Real Employee UUID -> the frontend's display employeeId (employeeCode). Falls back to the raw id if the employee isn't in the loaded index yet, so a render never crashes on a race with the employees fetch. */
export function resolveEmployeeCode(dbId: string, employeesIndex: EmployeeIdLookup[]): string {
  return employeesIndex.find((e) => e.id === dbId)?.employeeId ?? dbId;
}

/** The frontend's display employeeId (employeeCode) -> the real Employee UUID the backend expects as a FK. */
export function resolveEmployeeDbId(employeeCode: string, employeesIndex: EmployeeIdLookup[]): string | undefined {
  return employeesIndex.find((e) => e.employeeId === employeeCode)?.id;
}

export function apiAttendanceToAttendance(
  apiRecord: ApiAttendanceRecord,
  employeesIndex: EmployeeIdLookup[],
): AttendanceRecord {
  return {
    id: apiRecord.id,
    employeeId: resolveEmployeeCode(apiRecord.employeeId, employeesIndex),
    siteId: apiRecord.siteId,
    date: apiRecord.date.slice(0, 10),
    punchIn: apiRecord.punchIn ?? undefined,
    punchOut: apiRecord.punchOut ?? undefined,
    status: apiAttendanceStatusToStatus(apiRecord.status),
    shiftId: apiRecord.shiftId ?? undefined,
    workedHours: apiRecord.workedHours,
    overtimeHours: apiRecord.overtimeHours,
    lateMinutes: apiRecord.lateMinutes,
    earlyLeavingMinutes: apiRecord.earlyLeavingMinutes,
    source: apiAttendanceSourceToSource(apiRecord.source),
    remarks: apiRecord.remarks ?? undefined,
    leaveRequestId: apiRecord.leaveRequestId ?? undefined,
    createdOn: apiRecord.createdAt,
    updatedOn: apiRecord.updatedAt,
    updatedBy: apiRecord.updatedBy ?? undefined,
  };
}

export function apiRegularizationToRegularization(
  apiRequest: ApiAttendanceRegularization,
  employeesIndex: (EmployeeIdLookup & Pick<Employee, "name">)[],
): AttendanceRegularization {
  const requester = employeesIndex.find((e) => e.id === apiRequest.requestedBy);
  const decider = apiRequest.decidedBy ? employeesIndex.find((e) => e.id === apiRequest.decidedBy) : undefined;
  return {
    id: apiRequest.id,
    employeeId: requester?.employeeId ?? apiRequest.requestedBy,
    employee: requester?.name ?? "",
    date: apiRequest.date.slice(0, 10),
    currentStatus: apiAttendanceStatusToStatus(apiRequest.currentStatus),
    requestedStatus: apiAttendanceStatusToStatus(apiRequest.requestedStatus),
    attendanceRecordId: apiRequest.attendanceRecordId ?? undefined,
    requestedPunchIn: apiRequest.requestedPunchIn ?? undefined,
    requestedPunchOut: apiRequest.requestedPunchOut ?? undefined,
    reason: apiRequest.reason,
    status: apiRequest.status as RegularizationStatus,
    siteId: apiRequest.siteId,
    appliedOn: apiRequest.createdAt.slice(0, 10),
    approverId: decider?.employeeId,
    approverName: decider?.name,
    decisionReason: apiRequest.decisionReason ?? undefined,
    decidedOn: apiRequest.decidedOn?.slice(0, 10),
  };
}

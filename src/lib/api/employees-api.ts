"use client";

import { apiFetch } from "./api-client";

/**
 * Shape as returned by summet_hrms_be — see prisma/schema.prisma Employee
 * model. Plain display strings the old frontend Employee type carried
 * (name/department/designation/location/reportingTo) are NOT part of this
 * shape — they're resolved from firstName/lastName + the FK ids via
 * apiEmployeeToEmployee() in mappers.ts, never duplicated as authoritative
 * data on the backend (Phase 18C spec §2).
 */
export interface ApiEmployee {
  id: string;
  siteId: string;
  employeeCode: string;
  status: "Active" | "Inactive";

  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: "Male" | "Female" | "Other" | null;
  dateOfBirth: string | null;
  maritalStatus: "Single" | "Married" | "Other" | null;
  email: string;
  personalEmail: string | null;
  phone: string;
  alternatePhone: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  profilePhotoUrl: string | null;

  joiningDate: string;
  employmentTypeId: string | null;
  employeeTypeId: string | null;
  employmentStage: "Probation" | "Confirmed" | "OnNotice" | "Exited";
  confirmationDate: string | null;
  probationPeriodMonths: number | null;
  dateOfLeaving: string | null;

  businessUnitId: string | null;
  plantId: string | null;
  locationId: string | null;
  departmentId: string | null;
  subDepartmentId: string | null;
  designationId: string | null;
  gradeId: string | null;
  costCenterId: string | null;
  profitCenterId: string | null;
  shiftId: string | null;
  reportingManagerId: string | null;

  pan: string | null;
  pfNumber: string | null;
  uan: string | null;
  esiNumber: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface EmployeeQuery {
  siteId?: string;
  status?: ApiEmployee["status"];
  departmentId?: string;
  designationId?: string;
  employeeTypeId?: string;
  employmentTypeId?: string;
  reportingManagerId?: string;
  search?: string;
}

function toQueryString(query: EmployeeQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listEmployees(query: EmployeeQuery = {}): Promise<ApiEmployee[]> {
  return apiFetch<ApiEmployee[]>(`/employees${toQueryString(query)}`);
}

export function getEmployee(id: string): Promise<ApiEmployee> {
  return apiFetch<ApiEmployee>(`/employees/${id}`);
}

export interface CreateEmployeePayload {
  siteId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  gender?: ApiEmployee["gender"];
  dateOfBirth?: string;
  maritalStatus?: ApiEmployee["maritalStatus"];
  email: string;
  personalEmail?: string;
  phone: string;
  alternatePhone?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  profilePhotoUrl?: string;
  joiningDate: string;
  employmentTypeId?: string;
  employeeTypeId?: string;
  employmentStage?: ApiEmployee["employmentStage"];
  confirmationDate?: string;
  probationPeriodMonths?: number;
  businessUnitId?: string;
  plantId?: string;
  locationId?: string;
  departmentId?: string;
  subDepartmentId?: string;
  designationId?: string;
  gradeId?: string;
  costCenterId?: string;
  profitCenterId?: string;
  shiftId?: string;
  reportingManagerId?: string;
  pan?: string;
  pfNumber?: string;
  uan?: string;
  esiNumber?: string;
}

export type UpdateEmployeePayload = Partial<Omit<CreateEmployeePayload, "siteId">> & {
  dateOfLeaving?: string;
};

export function createEmployeeApi(payload: CreateEmployeePayload): Promise<ApiEmployee> {
  return apiFetch<ApiEmployee>("/employees", { method: "POST", body: payload });
}

export function updateEmployeeApi(id: string, payload: UpdateEmployeePayload): Promise<ApiEmployee> {
  return apiFetch<ApiEmployee>(`/employees/${id}`, { method: "PATCH", body: payload });
}

export function setEmployeeStatusApi(id: string, status: ApiEmployee["status"]): Promise<ApiEmployee> {
  return apiFetch<ApiEmployee>(`/employees/${id}/status`, { method: "PATCH", body: { status } });
}

export interface UpdateStatutoryPayload {
  pan?: string;
  pfNumber?: string;
  uan?: string;
  esiNumber?: string;
}

export function updateEmployeeStatutoryApi(
  id: string,
  payload: UpdateStatutoryPayload,
): Promise<ApiEmployee> {
  return apiFetch<ApiEmployee>(`/employees/${id}/statutory`, { method: "PATCH", body: payload });
}

/** Shape as returned by summet_hrms_be — see prisma/schema.prisma EmployeeBankDetail model. */
export interface ApiEmployeeBankDetail {
  id: string;
  employeeId: string;
  siteId: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  accountType: "Savings" | "Current";
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getEmployeeBank(employeeId: string): Promise<ApiEmployeeBankDetail | null> {
  return apiFetch<ApiEmployeeBankDetail | null>(`/employees/${employeeId}/bank`);
}

export interface UpsertBankPayload {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  accountType: "Savings" | "Current";
}

export function upsertEmployeeBank(
  employeeId: string,
  payload: UpsertBankPayload,
): Promise<ApiEmployeeBankDetail> {
  return apiFetch<ApiEmployeeBankDetail>(`/employees/${employeeId}/bank`, {
    method: "PUT",
    body: payload,
  });
}

/** Shape as returned by summet_hrms_be — see prisma/schema.prisma EmployeeDocument model. */
export interface ApiEmployeeDocument {
  id: string;
  employeeId: string;
  siteId: string;
  documentType: string;
  documentNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  fileRef: string | null;
  status: "Pending" | "Verified" | "Rejected";
  verifiedBy: string | null;
  verifiedOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export function listEmployeeDocuments(employeeId: string): Promise<ApiEmployeeDocument[]> {
  return apiFetch<ApiEmployeeDocument[]>(`/employees/${employeeId}/documents`);
}

export interface AddDocumentPayload {
  documentType: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  fileRef?: string;
}

export function addEmployeeDocument(
  employeeId: string,
  payload: AddDocumentPayload,
): Promise<ApiEmployeeDocument> {
  return apiFetch<ApiEmployeeDocument>(`/employees/${employeeId}/documents`, {
    method: "POST",
    body: payload,
  });
}

export function setEmployeeDocumentStatus(
  employeeId: string,
  documentId: string,
  status: ApiEmployeeDocument["status"],
): Promise<ApiEmployeeDocument> {
  return apiFetch<ApiEmployeeDocument>(
    `/employees/${employeeId}/documents/${documentId}/status`,
    { method: "PATCH", body: { status } },
  );
}

export function removeEmployeeDocument(employeeId: string, documentId: string): Promise<void> {
  return apiFetch<void>(`/employees/${employeeId}/documents/${documentId}`, {
    method: "DELETE",
  });
}

/** Shape as returned by summet_hrms_be — see prisma/schema.prisma EmployeeEmergencyContact model. */
export interface ApiEmergencyContact {
  id: string;
  employeeId: string;
  siteId: string;
  name: string;
  relationship: string;
  phone: string;
  alternatePhone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyContactPayload {
  name: string;
  relationship: string;
  phone: string;
  alternatePhone?: string;
  address?: string;
}

export function listEmergencyContacts(employeeId: string): Promise<ApiEmergencyContact[]> {
  return apiFetch<ApiEmergencyContact[]>(`/employees/${employeeId}/emergency-contacts`);
}

export function addEmergencyContact(
  employeeId: string,
  payload: EmergencyContactPayload,
): Promise<ApiEmergencyContact> {
  return apiFetch<ApiEmergencyContact>(`/employees/${employeeId}/emergency-contacts`, {
    method: "POST",
    body: payload,
  });
}

export function updateEmergencyContact(
  employeeId: string,
  contactId: string,
  payload: Partial<EmergencyContactPayload>,
): Promise<ApiEmergencyContact> {
  return apiFetch<ApiEmergencyContact>(
    `/employees/${employeeId}/emergency-contacts/${contactId}`,
    { method: "PATCH", body: payload },
  );
}

export function removeEmergencyContact(employeeId: string, contactId: string): Promise<void> {
  return apiFetch<void>(`/employees/${employeeId}/emergency-contacts/${contactId}`, {
    method: "DELETE",
  });
}

/** Shape as returned by summet_hrms_be — see prisma/schema.prisma EmployeeNominee model. */
export interface ApiNominee {
  id: string;
  employeeId: string;
  siteId: string;
  name: string;
  relationship: string;
  dateOfBirth: string | null;
  percentage: number;
  contact: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NomineePayload {
  name: string;
  relationship: string;
  dateOfBirth?: string;
  percentage: number;
  contact?: string;
}

export function listNominees(employeeId: string): Promise<ApiNominee[]> {
  return apiFetch<ApiNominee[]>(`/employees/${employeeId}/nominees`);
}

export function addNominee(employeeId: string, payload: NomineePayload): Promise<ApiNominee> {
  return apiFetch<ApiNominee>(`/employees/${employeeId}/nominees`, {
    method: "POST",
    body: payload,
  });
}

export function updateNominee(
  employeeId: string,
  nomineeId: string,
  payload: Partial<NomineePayload>,
): Promise<ApiNominee> {
  return apiFetch<ApiNominee>(`/employees/${employeeId}/nominees/${nomineeId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function removeNominee(employeeId: string, nomineeId: string): Promise<void> {
  return apiFetch<void>(`/employees/${employeeId}/nominees/${nomineeId}`, { method: "DELETE" });
}

/** Shape as returned by summet_hrms_be — see prisma/schema.prisma EmployeePreviousExperience model. */
export interface ApiPreviousExperience {
  id: string;
  employeeId: string;
  siteId: string;
  company: string;
  designation: string;
  startDate: string;
  endDate: string | null;
  responsibilities: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PreviousExperiencePayload {
  company: string;
  designation: string;
  startDate: string;
  endDate?: string;
  responsibilities?: string;
}

export function listPreviousExperience(employeeId: string): Promise<ApiPreviousExperience[]> {
  return apiFetch<ApiPreviousExperience[]>(`/employees/${employeeId}/experience`);
}

export function addPreviousExperience(
  employeeId: string,
  payload: PreviousExperiencePayload,
): Promise<ApiPreviousExperience> {
  return apiFetch<ApiPreviousExperience>(`/employees/${employeeId}/experience`, {
    method: "POST",
    body: payload,
  });
}

export function updatePreviousExperience(
  employeeId: string,
  experienceId: string,
  payload: Partial<PreviousExperiencePayload>,
): Promise<ApiPreviousExperience> {
  return apiFetch<ApiPreviousExperience>(`/employees/${employeeId}/experience/${experienceId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function removePreviousExperience(employeeId: string, experienceId: string): Promise<void> {
  return apiFetch<void>(`/employees/${employeeId}/experience/${experienceId}`, {
    method: "DELETE",
  });
}

export interface CreateEmployeeAccountPayload {
  roleIds: string[];
  password: string;
}

export function createEmployeeAccount(
  employeeId: string,
  payload: CreateEmployeeAccountPayload,
): Promise<{ id: string; email: string }> {
  return apiFetch<{ id: string; email: string }>(`/employees/${employeeId}/account`, {
    method: "POST",
    body: payload,
  });
}

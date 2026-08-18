"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ApiError } from "@/lib/api/api-client";
import {
  addEmergencyContact as apiAddEmergencyContact,
  addEmployeeDocument,
  addNominee as apiAddNominee,
  addPreviousExperience as apiAddPreviousExperience,
  createEmployeeApi,
  getEmployeeBank,
  listEmergencyContacts,
  listEmployeeDocuments,
  listEmployees,
  listNominees,
  listPreviousExperience,
  removeEmergencyContact as apiRemoveEmergencyContact,
  removeNominee as apiRemoveNominee,
  removePreviousExperience as apiRemovePreviousExperience,
  setEmployeeDocumentStatus as apiSetDocumentStatus,
  setEmployeeStatusApi,
  updateEmployeeApi,
  upsertEmployeeBank,
} from "@/lib/api/employees-api";
import {
  apiBankDetailToBankDetail,
  apiDocumentToDocumentRecord,
  apiEmployeeToEmployee,
  employeeDraftToApiCreatePayload,
  employeePatchToApiUpdatePayload,
} from "@/lib/api/mappers";
import { isBackendConnected } from "@/lib/api/token-store";
import {
  bankDetailsStore,
  directReportsOf,
  emergencyContactsStore,
  employeeDocumentsStore,
  employeesStore,
  nextEmployeeCode,
  nomineesStore,
  previousExperienceStore,
  wouldCreateReportingCycle,
  type StoredEmergencyContact,
  type StoredNominee,
  type StoredWorkExperience,
} from "@/lib/employee-store";
import { masterRecordsStore } from "@/lib/master-store";
import { orgUnitsStore } from "@/lib/org-store";
import { useAccessControl } from "@/lib/access-control-context";
import { useSite } from "@/lib/site-context";
import type {
  Employee,
  EmergencyContact,
  EmployeeBankDetail,
  EmployeeDocumentRecord,
  EmployeeDocumentStatus,
  EmployeeStatus,
  EmploymentStage,
  Gender,
  MaritalStatus,
  Nominee,
  WorkExperience,
} from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

export interface EmployeeDraft {
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  location: string;
  siteId: string;
  siteIds?: string[];
  dateOfJoining?: string;
  reportingManagerId?: string;
  companyId?: string;
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
  isAdminAccount?: boolean;
  // Personal information
  firstName?: string;
  lastName?: string;
  gender?: Gender;
  maritalStatus?: MaritalStatus;
  dateOfBirth?: string;
  personalEmail?: string;
  alternatePhone?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  // Employment lifecycle
  employmentStage?: EmploymentStage;
  confirmationDate?: string;
  probationPeriodMonths?: number;
  // Statutory
  pan?: string;
  pfNumber?: string;
  uan?: string;
  esiNumber?: string;
}

export type EmployeeEditable = Partial<EmployeeDraft> & {
  status?: EmployeeStatus;
  profilePhotoUrl?: string;
  emergencyContacts?: EmergencyContact[];
  nominees?: Nominee[];
  previousExperience?: WorkExperience[];
};

interface SaveBankDetailInput {
  employeeId: string;
  siteId: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  accountType: EmployeeBankDetail["accountType"];
}

interface AddDocumentInput {
  employeeId: string;
  siteId: string;
  documentType: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  fileRef?: string;
}

interface AddEmergencyContactInput {
  employeeId: string;
  siteId: string;
  name: string;
  relationship: string;
  phone: string;
  alternatePhone?: string;
  address?: string;
}

interface AddNomineeInput {
  employeeId: string;
  siteId: string;
  name: string;
  relationship: string;
  dateOfBirth?: string;
  percentage: number;
  contact?: string;
}

interface AddPreviousExperienceInput {
  employeeId: string;
  siteId: string;
  company: string;
  designation: string;
  startDate: string;
  endDate?: string;
  responsibilities?: string;
}

interface EmployeeContextValue {
  /** Excludes admin-only records (e.g. Site Admin) — this is the real headcount. */
  employees: Employee[];
  getEmployeeById: (id: string) => Employee | undefined;
  getEmployeeByEmployeeId: (employeeId: string) => Employee | undefined;
  employeesForSite: (siteId: string) => Employee[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  createEmployee: (input: EmployeeDraft) => Promise<ActionResult & { employee?: Employee }>;
  updateEmployee: (id: string, patch: EmployeeEditable) => Promise<ActionResult>;
  setEmployeeStatus: (id: string, status: EmployeeStatus) => Promise<ActionResult>;
  /** Backend never hard-deletes an Employee (spec §15) — when backend-connected this deactivates instead. */
  deleteEmployee: (id: string) => Promise<ActionResult>;
  /** Would assigning `candidateManagerId` as `employeeId`'s manager create a reporting loop? Client-side pre-check only — the backend independently re-validates (spec §5). */
  wouldCreateReportingCycle: (employeeId: string, candidateManagerId: string) => boolean;
  /** True once this session has a live backend connection (see lib/api/token-store.ts). */
  isBackendConnected: boolean;
  /** Fetches bank/documents/emergency contacts/nominees/previous experience for ONE employee — call when a profile page mounts (these are per-record fetches, never bulk-listed). */
  refreshEmployeeProfileRecords: (employeeId: string) => Promise<void>;

  // Bank details
  bankDetails: EmployeeBankDetail[];
  bankDetailFor: (employeeId: string) => EmployeeBankDetail | undefined;
  canManageBank: boolean;
  saveBankDetail: (input: SaveBankDetailInput) => Promise<ActionResult>;

  // Documents
  employeeDocuments: EmployeeDocumentRecord[];
  documentsFor: (employeeId: string) => EmployeeDocumentRecord[];
  canManageDocuments: boolean;
  addDocument: (input: AddDocumentInput) => Promise<ActionResult>;
  setDocumentStatus: (id: string, status: EmployeeDocumentStatus, verifierName: string) => Promise<ActionResult>;

  // Emergency contacts / nominees / previous experience (Phase 18C — real
  // backend models, no longer inline arrays on Employee)
  emergencyContactsFor: (employeeId: string) => EmergencyContact[];
  addEmergencyContact: (input: AddEmergencyContactInput) => Promise<ActionResult>;
  removeEmergencyContact: (employeeId: string, contactId: string) => Promise<ActionResult>;
  nomineesFor: (employeeId: string) => Nominee[];
  addNominee: (input: AddNomineeInput) => Promise<ActionResult>;
  removeNominee: (employeeId: string, nomineeId: string) => Promise<ActionResult>;
  previousExperienceFor: (employeeId: string) => WorkExperience[];
  addPreviousExperience: (input: AddPreviousExperienceInput) => Promise<ActionResult>;
  removePreviousExperience: (employeeId: string, experienceId: string) => Promise<ActionResult>;
}

const EmployeeContext = createContext<EmployeeContextValue | undefined>(undefined);

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const { canFeature } = useAccessControl();
  const { currentSiteId, isAllSites, isSuperAdmin } = useSite();

  const allEmployees = useSyncExternalStore(
    employeesStore.subscribe,
    employeesStore.getSnapshot,
    employeesStore.getServerSnapshot,
  );
  const orgUnits = useSyncExternalStore(orgUnitsStore.subscribe, orgUnitsStore.getSnapshot, orgUnitsStore.getServerSnapshot);
  const masterRecords = useSyncExternalStore(
    masterRecordsStore.subscribe,
    masterRecordsStore.getSnapshot,
    masterRecordsStore.getServerSnapshot,
  );

  const [connected, setConnected] = useState(false);

  // Directory lists/counts exclude admin-only records; lookups by id don't,
  // so an admin's own profile/login still resolves correctly.
  const employees = useMemo(() => allEmployees.filter((e) => !e.isAdminAccount), [allEmployees]);

  const getEmployeeById = useCallback((id: string) => allEmployees.find((e) => e.id === id), [allEmployees]);
  const getEmployeeByEmployeeId = useCallback(
    (employeeId: string) => allEmployees.find((e) => e.employeeId.toLowerCase() === employeeId.toLowerCase()),
    [allEmployees],
  );
  const employeesForSite = useCallback(
    (siteId: string) => employees.filter((e) => e.siteId === siteId),
    [employees],
  );

  // --------------------------------------------------------------
  // Directory list — backend-authoritative once connected (Phase 18C).
  // Scoped to the currently-selected site, same scope every consuming page
  // already filters down to itself; Super Admin's "All Sites" view fetches
  // globally (backend allows that only for Super Admin — spec §6).
  // --------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      if (!isBackendConnected()) {
        setConnected(false);
        return;
      }
      setConnected(true);
      if (!isAllSites && !currentSiteId) return;
      if (isAllSites && !isSuperAdmin) return; // shouldn't happen — SiteProvider always pins a real site otherwise
      try {
        const apiEmployees = await listEmployees(isAllSites ? {} : { siteId: currentSiteId });
        if (cancelled) return;
        const idIndex = apiEmployees.map((e) => ({ id: e.id, employeeId: e.employeeCode }));
        employeesStore.set(apiEmployees.map((e) => apiEmployeeToEmployee(e, orgUnits, masterRecords, idIndex)));
      } catch {
        // Leave the existing cache in place — a transient failure shouldn't blank the directory.
      }
    }
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [currentSiteId, isAllSites, isSuperAdmin, orgUnits, masterRecords]);

  const canCreate = canFeature("employees.directory", "create") || canFeature("employees.directory", "manage");
  const canEdit = canFeature("employees.directory", "edit") || canFeature("employees.directory", "manage");
  const canDelete = canFeature("employees.directory", "delete") || canFeature("employees.directory", "manage");

  const createEmployee = useCallback(
    async (input: EmployeeDraft): Promise<ActionResult & { employee?: Employee }> => {
      if (!canCreate) return { ok: false, message: "You're not authorized to add employees." };
      if (!input.siteId) return { ok: false, message: "A site is required to create an employee." };

      if (isBackendConnected()) {
        try {
          const created = await createEmployeeApi(employeeDraftToApiCreatePayload(input));
          const mapped = apiEmployeeToEmployee(created, orgUnits, masterRecords, allEmployees);
          employeesStore.set([mapped, ...employeesStore.getSnapshot().filter((e) => e.id !== mapped.id)]);
          return { ok: true, message: `${mapped.name} added as ${mapped.employeeId}.`, employee: mapped };
        } catch (error) {
          return { ok: false, message: errorMessage(error, "Failed to create employee.") };
        }
      }

      const email = input.email.trim().toLowerCase();
      if (employeesStore.getSnapshot().some((e) => e.email.toLowerCase() === email)) {
        return { ok: false, message: `An employee with email ${input.email} already exists.` };
      }
      const employeeId = nextEmployeeCode();
      const siteIds = input.siteIds && input.siteIds.length > 1 ? input.siteIds : undefined;
      const employee: Employee = {
        ...input,
        id: employeeId.toLowerCase(),
        employeeId,
        name: input.name.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        status: "Active",
        dateOfJoining: input.dateOfJoining || new Date().toISOString().slice(0, 10),
        siteIds,
        reportingManagerId: input.reportingManagerId || undefined,
        isAdminAccount: input.isAdminAccount || undefined,
      };
      employeesStore.set([employee, ...employeesStore.getSnapshot()]);
      return { ok: true, message: `${employee.name} added as ${employee.employeeId}.`, employee };
    },
    [canCreate, orgUnits, masterRecords, allEmployees],
  );

  const updateEmployee = useCallback(
    async (id: string, patch: EmployeeEditable): Promise<ActionResult> => {
      if (!canEdit) return { ok: false, message: "You're not authorized to edit employees." };
      const existing = employeesStore.getSnapshot().find((e) => e.id === id);
      if (!existing) return { ok: false, message: "Employee not found." };

      if (isBackendConnected()) {
        try {
          const updated = await updateEmployeeApi(id, employeePatchToApiUpdatePayload(patch));
          const mapped = apiEmployeeToEmployee(updated, orgUnits, masterRecords, allEmployees);
          employeesStore.set(employeesStore.getSnapshot().map((e) => (e.id === id ? mapped : e)));
          return { ok: true, message: `${mapped.name} updated.` };
        } catch (error) {
          return { ok: false, message: errorMessage(error, "Failed to update employee.") };
        }
      }

      if (patch.email) {
        const email = patch.email.trim().toLowerCase();
        const clash = employeesStore.getSnapshot().find((e) => e.id !== id && e.email.toLowerCase() === email);
        if (clash) return { ok: false, message: `Another employee already uses email ${patch.email}.` };
      }
      if (patch.reportingManagerId && patch.reportingManagerId === existing.employeeId) {
        return { ok: false, message: "An employee can't be their own reporting manager." };
      }
      if (patch.reportingManagerId && wouldCreateReportingCycle(existing.employeeId, patch.reportingManagerId)) {
        return { ok: false, message: "That would create a reporting loop — choose a different manager." };
      }
      const siteIds =
        patch.siteIds !== undefined ? (patch.siteIds.length > 1 ? patch.siteIds : undefined) : existing.siteIds;
      employeesStore.set(employeesStore.getSnapshot().map((e) => (e.id === id ? { ...e, ...patch, siteIds } : e)));
      return { ok: true, message: `${patch.name?.trim() || existing.name} updated.` };
    },
    [canEdit, orgUnits, masterRecords, allEmployees],
  );

  const setEmployeeStatus = useCallback(
    async (id: string, status: EmployeeStatus): Promise<ActionResult> => {
      if (!canEdit) return { ok: false, message: "You're not authorized to change employee status." };
      const existing = employeesStore.getSnapshot().find((e) => e.id === id);
      if (!existing) return { ok: false, message: "Employee not found." };
      if (existing.status === status) return { ok: true, message: `${existing.name} is already ${status}.` };

      if (isBackendConnected()) {
        try {
          const updated = await setEmployeeStatusApi(id, status);
          const mapped = apiEmployeeToEmployee(updated, orgUnits, masterRecords, allEmployees);
          employeesStore.set(employeesStore.getSnapshot().map((e) => (e.id === id ? mapped : e)));
          return { ok: true, message: status === "Active" ? `${mapped.name} reactivated.` : `${mapped.name} deactivated.` };
        } catch (error) {
          return { ok: false, message: errorMessage(error, "Failed to change employee status.") };
        }
      }

      employeesStore.set(employeesStore.getSnapshot().map((e) => (e.id === id ? { ...e, status } : e)));
      return {
        ok: true,
        message: status === "Active" ? `${existing.name} reactivated.` : `${existing.name} deactivated.`,
      };
    },
    [canEdit, orgUnits, masterRecords, allEmployees],
  );

  const deleteEmployee = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!canDelete) return { ok: false, message: "You're not authorized to delete employees." };
      const existing = employeesStore.getSnapshot().find((e) => e.id === id);
      if (!existing) return { ok: false, message: "Employee not found." };
      const reports = directReportsOf(existing.employeeId);
      if (reports.length > 0) {
        return {
          ok: false,
          message: `This employee cannot be deleted because ${reports.length} employee(s) report to them. Deactivate instead.`,
        };
      }

      // No hard delete once backend-connected (spec §15) — deactivate instead.
      if (isBackendConnected()) {
        const result = await setEmployeeStatus(id, "Inactive");
        return result.ok
          ? { ok: true, message: `${existing.name} deactivated (records are retained, never deleted).` }
          : result;
      }

      employeesStore.set(employeesStore.getSnapshot().filter((e) => e.id !== id));
      return { ok: true, message: `${existing.name} removed.` };
    },
    [canDelete, setEmployeeStatus],
  );

  // --------------------------------------------------------------
  // Per-employee sub-resources — fetched on demand (never bulk-listed;
  // bank/documents are sensitive, and there's no product need to preload
  // every employee's records). Call refreshEmployeeProfileRecords when a
  // profile page mounts.
  // --------------------------------------------------------------
  const refreshEmployeeProfileRecords = useCallback(async (employeeId: string): Promise<void> => {
    if (!isBackendConnected()) return;
    try {
      const [bank, documents, contacts, nominees, experience] = await Promise.all([
        getEmployeeBank(employeeId).catch(() => null),
        listEmployeeDocuments(employeeId).catch(() => []),
        listEmergencyContacts(employeeId).catch(() => []),
        listNominees(employeeId).catch(() => []),
        listPreviousExperience(employeeId).catch(() => []),
      ]);

      if (bank) {
        const mapped = apiBankDetailToBankDetail(bank);
        bankDetailsStore.set([mapped, ...bankDetailsStore.getSnapshot().filter((b) => b.employeeId !== employeeId)]);
      }
      employeeDocumentsStore.set([
        ...documents.map(apiDocumentToDocumentRecord),
        ...employeeDocumentsStore.getSnapshot().filter((d) => d.employeeId !== employeeId),
      ]);
      emergencyContactsStore.set([
        ...contacts.map((c): StoredEmergencyContact => ({
          id: c.id,
          employeeId: c.employeeId,
          name: c.name,
          relationship: c.relationship,
          phone: c.phone,
          alternatePhone: c.alternatePhone ?? undefined,
          address: c.address ?? undefined,
        })),
        ...emergencyContactsStore.getSnapshot().filter((c) => c.employeeId !== employeeId),
      ]);
      nomineesStore.set([
        ...nominees.map((n): StoredNominee => ({
          id: n.id,
          employeeId: n.employeeId,
          name: n.name,
          relationship: n.relationship,
          dateOfBirth: n.dateOfBirth ?? undefined,
          percentage: n.percentage,
          contact: n.contact ?? undefined,
        })),
        ...nomineesStore.getSnapshot().filter((n) => n.employeeId !== employeeId),
      ]);
      previousExperienceStore.set([
        ...experience.map((x): StoredWorkExperience => ({
          id: x.id,
          employeeId: x.employeeId,
          company: x.company,
          designation: x.designation,
          startDate: x.startDate,
          endDate: x.endDate ?? undefined,
          responsibilities: x.responsibilities ?? undefined,
        })),
        ...previousExperienceStore.getSnapshot().filter((x) => x.employeeId !== employeeId),
      ]);
    } catch {
      // Best-effort — leave whatever was already cached in place.
    }
  }, []);

  // --------------------------------------------------------------
  // Bank details
  // --------------------------------------------------------------
  const bankDetails = useSyncExternalStore(
    bankDetailsStore.subscribe,
    bankDetailsStore.getSnapshot,
    bankDetailsStore.getServerSnapshot,
  );
  const bankDetailFor = useCallback(
    (employeeId: string) => bankDetails.find((b) => b.employeeId === employeeId),
    [bankDetails],
  );
  const canManageBank = canFeature("payroll.bank", "edit") || canFeature("payroll.bank", "manage");

  const saveBankDetail = useCallback(
    async (input: SaveBankDetailInput): Promise<ActionResult> => {
      if (!canManageBank) return { ok: false, message: "You're not authorized to manage bank details." };

      if (isBackendConnected()) {
        try {
          const saved = await upsertEmployeeBank(input.employeeId, {
            accountHolderName: input.accountHolderName,
            bankName: input.bankName,
            accountNumber: input.accountNumber,
            ifsc: input.ifsc,
            branch: input.branch,
            accountType: input.accountType,
          });
          const mapped = apiBankDetailToBankDetail(saved);
          bankDetailsStore.set([
            mapped,
            ...bankDetailsStore.getSnapshot().filter((b) => b.employeeId !== input.employeeId),
          ]);
          return { ok: true, message: "Bank details saved." };
        } catch (error) {
          return { ok: false, message: errorMessage(error, "Failed to save bank details.") };
        }
      }

      const existing = bankDetailsStore.getSnapshot().find((b) => b.employeeId === input.employeeId);
      const record: EmployeeBankDetail = {
        id: existing?.id ?? `bank-${input.employeeId}-${Date.now().toString(36)}`,
        ...input,
        updatedOn: new Date().toISOString(),
      };
      bankDetailsStore.set(
        existing
          ? bankDetailsStore.getSnapshot().map((b) => (b.id === existing.id ? record : b))
          : [record, ...bankDetailsStore.getSnapshot()],
      );
      return { ok: true, message: "Bank details saved." };
    },
    [canManageBank],
  );

  // --------------------------------------------------------------
  // Documents
  // --------------------------------------------------------------
  const employeeDocuments = useSyncExternalStore(
    employeeDocumentsStore.subscribe,
    employeeDocumentsStore.getSnapshot,
    employeeDocumentsStore.getServerSnapshot,
  );
  const documentsFor = useCallback(
    (employeeId: string) => employeeDocuments.filter((d) => d.employeeId === employeeId),
    [employeeDocuments],
  );
  const canManageDocuments = canFeature("employees.documents", "edit") || canFeature("employees.documents", "manage");

  const addDocument = useCallback(
    async (input: AddDocumentInput): Promise<ActionResult> => {
      if (!canManageDocuments) return { ok: false, message: "You're not authorized to manage documents." };

      if (isBackendConnected()) {
        try {
          const created = await addEmployeeDocument(input.employeeId, {
            documentType: input.documentType,
            documentNumber: input.documentNumber,
            issueDate: input.issueDate,
            expiryDate: input.expiryDate,
            fileRef: input.fileRef,
          });
          const mapped = apiDocumentToDocumentRecord(created);
          employeeDocumentsStore.set([mapped, ...employeeDocumentsStore.getSnapshot()]);
          return { ok: true, message: "Document added." };
        } catch (error) {
          return { ok: false, message: errorMessage(error, "Failed to add document.") };
        }
      }

      const record: EmployeeDocumentRecord = {
        id: `doc-${input.employeeId}-${Date.now().toString(36)}`,
        ...input,
        status: "Pending",
        uploadedOn: new Date().toISOString().slice(0, 10),
      };
      employeeDocumentsStore.set([record, ...employeeDocumentsStore.getSnapshot()]);
      return { ok: true, message: "Document added." };
    },
    [canManageDocuments],
  );

  const setDocumentStatus = useCallback(
    async (id: string, status: EmployeeDocumentStatus, verifierName: string): Promise<ActionResult> => {
      if (!canManageDocuments) return { ok: false, message: "You're not authorized to verify documents." };
      const existing = employeeDocumentsStore.getSnapshot().find((d) => d.id === id);
      if (!existing) return { ok: false, message: "Document not found." };

      if (isBackendConnected()) {
        try {
          const updated = await apiSetDocumentStatus(existing.employeeId, id, status);
          const mapped = apiDocumentToDocumentRecord(updated);
          employeeDocumentsStore.set(employeeDocumentsStore.getSnapshot().map((d) => (d.id === id ? mapped : d)));
          return { ok: true, message: `Document marked ${status.toLowerCase()}.` };
        } catch (error) {
          return { ok: false, message: errorMessage(error, "Failed to update document status.") };
        }
      }

      employeeDocumentsStore.set(
        employeeDocumentsStore
          .getSnapshot()
          .map((d) =>
            d.id === id
              ? { ...d, status, verifiedBy: verifierName, verifiedOn: new Date().toISOString().slice(0, 10) }
              : d,
          ),
      );
      return { ok: true, message: `Document marked ${status.toLowerCase()}.` };
    },
    [canManageDocuments],
  );

  // --------------------------------------------------------------
  // Emergency contacts / nominees / previous experience
  // --------------------------------------------------------------
  const emergencyContactsRaw = useSyncExternalStore(
    emergencyContactsStore.subscribe,
    emergencyContactsStore.getSnapshot,
    emergencyContactsStore.getServerSnapshot,
  );
  const emergencyContactsFor = useCallback(
    (employeeId: string) => emergencyContactsRaw.filter((c) => c.employeeId === employeeId),
    [emergencyContactsRaw],
  );

  const addEmergencyContact = useCallback(
    async (input: AddEmergencyContactInput): Promise<ActionResult> => {
      if (!canEdit) return { ok: false, message: "You're not authorized to edit employees." };

      if (isBackendConnected()) {
        try {
          const created = await apiAddEmergencyContact(input.employeeId, {
            name: input.name,
            relationship: input.relationship,
            phone: input.phone,
            alternatePhone: input.alternatePhone,
            address: input.address,
          });
          emergencyContactsStore.set([
            { ...created, alternatePhone: created.alternatePhone ?? undefined, address: created.address ?? undefined },
            ...emergencyContactsStore.getSnapshot(),
          ]);
          return { ok: true, message: "Emergency contact added." };
        } catch (error) {
          return { ok: false, message: errorMessage(error, "Failed to add emergency contact.") };
        }
      }

      const record: StoredEmergencyContact = { id: `ec-${Date.now().toString(36)}`, ...input };
      emergencyContactsStore.set([record, ...emergencyContactsStore.getSnapshot()]);
      return { ok: true, message: "Emergency contact added." };
    },
    [canEdit],
  );

  const removeEmergencyContact = useCallback(
    async (employeeId: string, contactId: string): Promise<ActionResult> => {
      if (!canEdit) return { ok: false, message: "You're not authorized to edit employees." };

      if (isBackendConnected()) {
        try {
          await apiRemoveEmergencyContact(employeeId, contactId);
          emergencyContactsStore.set(emergencyContactsStore.getSnapshot().filter((c) => c.id !== contactId));
          return { ok: true, message: "Emergency contact removed." };
        } catch (error) {
          return { ok: false, message: errorMessage(error, "Failed to remove emergency contact.") };
        }
      }

      emergencyContactsStore.set(emergencyContactsStore.getSnapshot().filter((c) => c.id !== contactId));
      return { ok: true, message: "Emergency contact removed." };
    },
    [canEdit],
  );

  const nomineesRaw = useSyncExternalStore(nomineesStore.subscribe, nomineesStore.getSnapshot, nomineesStore.getServerSnapshot);
  const nomineesFor = useCallback(
    (employeeId: string) => nomineesRaw.filter((n) => n.employeeId === employeeId),
    [nomineesRaw],
  );

  const addNominee = useCallback(
    async (input: AddNomineeInput): Promise<ActionResult> => {
      if (!canEdit) return { ok: false, message: "You're not authorized to edit employees." };

      if (isBackendConnected()) {
        try {
          const created = await apiAddNominee(input.employeeId, {
            name: input.name,
            relationship: input.relationship,
            dateOfBirth: input.dateOfBirth,
            percentage: input.percentage,
            contact: input.contact,
          });
          nomineesStore.set([
            { ...created, dateOfBirth: created.dateOfBirth ?? undefined, contact: created.contact ?? undefined },
            ...nomineesStore.getSnapshot(),
          ]);
          return { ok: true, message: "Nominee added." };
        } catch (error) {
          return { ok: false, message: errorMessage(error, "Failed to add nominee.") };
        }
      }

      const record: StoredNominee = { id: `nom-${Date.now().toString(36)}`, ...input };
      nomineesStore.set([record, ...nomineesStore.getSnapshot()]);
      return { ok: true, message: "Nominee added." };
    },
    [canEdit],
  );

  const removeNominee = useCallback(
    async (employeeId: string, nomineeId: string): Promise<ActionResult> => {
      if (!canEdit) return { ok: false, message: "You're not authorized to edit employees." };

      if (isBackendConnected()) {
        try {
          await apiRemoveNominee(employeeId, nomineeId);
          nomineesStore.set(nomineesStore.getSnapshot().filter((n) => n.id !== nomineeId));
          return { ok: true, message: "Nominee removed." };
        } catch (error) {
          return { ok: false, message: errorMessage(error, "Failed to remove nominee.") };
        }
      }

      nomineesStore.set(nomineesStore.getSnapshot().filter((n) => n.id !== nomineeId));
      return { ok: true, message: "Nominee removed." };
    },
    [canEdit],
  );

  const previousExperienceRaw = useSyncExternalStore(
    previousExperienceStore.subscribe,
    previousExperienceStore.getSnapshot,
    previousExperienceStore.getServerSnapshot,
  );
  const previousExperienceFor = useCallback(
    (employeeId: string) => previousExperienceRaw.filter((x) => x.employeeId === employeeId),
    [previousExperienceRaw],
  );

  const addPreviousExperience = useCallback(
    async (input: AddPreviousExperienceInput): Promise<ActionResult> => {
      if (!canEdit) return { ok: false, message: "You're not authorized to edit employees." };

      if (isBackendConnected()) {
        try {
          const created = await apiAddPreviousExperience(input.employeeId, {
            company: input.company,
            designation: input.designation,
            startDate: input.startDate,
            endDate: input.endDate,
            responsibilities: input.responsibilities,
          });
          previousExperienceStore.set([
            { ...created, endDate: created.endDate ?? undefined, responsibilities: created.responsibilities ?? undefined },
            ...previousExperienceStore.getSnapshot(),
          ]);
          return { ok: true, message: "Experience added." };
        } catch (error) {
          return { ok: false, message: errorMessage(error, "Failed to add experience.") };
        }
      }

      const record: StoredWorkExperience = { id: `exp-${Date.now().toString(36)}`, ...input };
      previousExperienceStore.set([record, ...previousExperienceStore.getSnapshot()]);
      return { ok: true, message: "Experience added." };
    },
    [canEdit],
  );

  const removePreviousExperience = useCallback(
    async (employeeId: string, experienceId: string): Promise<ActionResult> => {
      if (!canEdit) return { ok: false, message: "You're not authorized to edit employees." };

      if (isBackendConnected()) {
        try {
          await apiRemovePreviousExperience(employeeId, experienceId);
          previousExperienceStore.set(previousExperienceStore.getSnapshot().filter((x) => x.id !== experienceId));
          return { ok: true, message: "Experience removed." };
        } catch (error) {
          return { ok: false, message: errorMessage(error, "Failed to remove experience.") };
        }
      }

      previousExperienceStore.set(previousExperienceStore.getSnapshot().filter((x) => x.id !== experienceId));
      return { ok: true, message: "Experience removed." };
    },
    [canEdit],
  );

  const value = useMemo<EmployeeContextValue>(
    () => ({
      employees,
      getEmployeeById,
      getEmployeeByEmployeeId,
      employeesForSite,
      canCreate,
      canEdit,
      canDelete,
      createEmployee,
      updateEmployee,
      setEmployeeStatus,
      deleteEmployee,
      wouldCreateReportingCycle,
      isBackendConnected: connected,
      refreshEmployeeProfileRecords,
      bankDetails,
      bankDetailFor,
      canManageBank,
      saveBankDetail,
      employeeDocuments,
      documentsFor,
      canManageDocuments,
      addDocument,
      setDocumentStatus,
      emergencyContactsFor,
      addEmergencyContact,
      removeEmergencyContact,
      nomineesFor,
      addNominee,
      removeNominee,
      previousExperienceFor,
      addPreviousExperience,
      removePreviousExperience,
    }),
    [
      employees,
      getEmployeeById,
      getEmployeeByEmployeeId,
      employeesForSite,
      canCreate,
      canEdit,
      canDelete,
      createEmployee,
      updateEmployee,
      setEmployeeStatus,
      deleteEmployee,
      connected,
      refreshEmployeeProfileRecords,
      bankDetails,
      bankDetailFor,
      canManageBank,
      saveBankDetail,
      employeeDocuments,
      documentsFor,
      canManageDocuments,
      addDocument,
      setDocumentStatus,
      emergencyContactsFor,
      addEmergencyContact,
      removeEmergencyContact,
      nomineesFor,
      addNominee,
      removeNominee,
      previousExperienceFor,
      addPreviousExperience,
      removePreviousExperience,
    ],
  );

  return <EmployeeContext.Provider value={value}>{children}</EmployeeContext.Provider>;
}

export function useEmployees() {
  const ctx = useContext(EmployeeContext);
  if (!ctx) throw new Error("useEmployees must be used within an EmployeeProvider");
  return ctx;
}

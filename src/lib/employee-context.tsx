"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  bankDetailsStore,
  directReportsOf,
  employeeDocumentsStore,
  employeesStore,
  nextEmployeeCode,
  wouldCreateReportingCycle,
} from "@/lib/employee-store";
import { useAccessControl } from "@/lib/access-control-context";
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

interface EmployeeContextValue {
  /** Excludes admin-only records (e.g. Site Admin) — this is the real headcount. */
  employees: Employee[];
  getEmployeeById: (id: string) => Employee | undefined;
  getEmployeeByEmployeeId: (employeeId: string) => Employee | undefined;
  employeesForSite: (siteId: string) => Employee[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  createEmployee: (input: EmployeeDraft) => ActionResult & { employee?: Employee };
  updateEmployee: (id: string, patch: EmployeeEditable) => ActionResult;
  setEmployeeStatus: (id: string, status: EmployeeStatus) => ActionResult;
  deleteEmployee: (id: string) => ActionResult;
  /** Would assigning `candidateManagerId` as `employeeId`'s manager create a reporting loop? */
  wouldCreateReportingCycle: (employeeId: string, candidateManagerId: string) => boolean;

  // Bank details
  bankDetails: EmployeeBankDetail[];
  bankDetailFor: (employeeId: string) => EmployeeBankDetail | undefined;
  canManageBank: boolean;
  saveBankDetail: (input: SaveBankDetailInput) => ActionResult;

  // Documents
  employeeDocuments: EmployeeDocumentRecord[];
  documentsFor: (employeeId: string) => EmployeeDocumentRecord[];
  canManageDocuments: boolean;
  addDocument: (input: AddDocumentInput) => ActionResult;
  setDocumentStatus: (id: string, status: EmployeeDocumentStatus, verifierName: string) => ActionResult;
}

const EmployeeContext = createContext<EmployeeContextValue | undefined>(undefined);

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const { canFeature } = useAccessControl();

  const allEmployees = useSyncExternalStore(
    employeesStore.subscribe,
    employeesStore.getSnapshot,
    employeesStore.getServerSnapshot,
  );

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

  const canCreate = canFeature("employees.directory", "create") || canFeature("employees.directory", "manage");
  const canEdit = canFeature("employees.directory", "edit") || canFeature("employees.directory", "manage");
  const canDelete = canFeature("employees.directory", "delete") || canFeature("employees.directory", "manage");

  const createEmployee = useCallback(
    (input: EmployeeDraft): ActionResult & { employee?: Employee } => {
      if (!canCreate) return { ok: false, message: "You're not authorized to add employees." };
      if (!input.siteId) return { ok: false, message: "A site is required to create an employee." };
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
    [canCreate],
  );

  const updateEmployee = useCallback(
    (id: string, patch: EmployeeEditable): ActionResult => {
      if (!canEdit) return { ok: false, message: "You're not authorized to edit employees." };
      const existing = employeesStore.getSnapshot().find((e) => e.id === id);
      if (!existing) return { ok: false, message: "Employee not found." };
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
      employeesStore.set(
        employeesStore.getSnapshot().map((e) => (e.id === id ? { ...e, ...patch, siteIds } : e)),
      );
      return { ok: true, message: `${patch.name?.trim() || existing.name} updated.` };
    },
    [canEdit],
  );

  const setEmployeeStatus = useCallback(
    (id: string, status: EmployeeStatus): ActionResult => {
      if (!canEdit) return { ok: false, message: "You're not authorized to change employee status." };
      const existing = employeesStore.getSnapshot().find((e) => e.id === id);
      if (!existing) return { ok: false, message: "Employee not found." };
      if (existing.status === status) return { ok: true, message: `${existing.name} is already ${status}.` };
      employeesStore.set(employeesStore.getSnapshot().map((e) => (e.id === id ? { ...e, status } : e)));
      return {
        ok: true,
        message: status === "Active" ? `${existing.name} reactivated.` : `${existing.name} deactivated.`,
      };
    },
    [canEdit],
  );

  const deleteEmployee = useCallback(
    (id: string): ActionResult => {
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
      employeesStore.set(employeesStore.getSnapshot().filter((e) => e.id !== id));
      return { ok: true, message: `${existing.name} removed.` };
    },
    [canDelete],
  );

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
    (input: SaveBankDetailInput): ActionResult => {
      if (!canManageBank) return { ok: false, message: "You're not authorized to manage bank details." };
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
    (input: AddDocumentInput): ActionResult => {
      if (!canManageDocuments) return { ok: false, message: "You're not authorized to manage documents." };
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
    (id: string, status: EmployeeDocumentStatus, verifierName: string): ActionResult => {
      if (!canManageDocuments) return { ok: false, message: "You're not authorized to verify documents." };
      const existing = employeeDocumentsStore.getSnapshot().find((d) => d.id === id);
      if (!existing) return { ok: false, message: "Document not found." };
      employeeDocumentsStore.set(
        employeeDocumentsStore.getSnapshot().map((d) =>
          d.id === id ? { ...d, status, verifiedBy: verifierName, verifiedOn: new Date().toISOString().slice(0, 10) } : d,
        ),
      );
      return { ok: true, message: `Document marked ${status.toLowerCase()}.` };
    },
    [canManageDocuments],
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
      bankDetails,
      bankDetailFor,
      canManageBank,
      saveBankDetail,
      employeeDocuments,
      documentsFor,
      canManageDocuments,
      addDocument,
      setDocumentStatus,
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
      bankDetails,
      bankDetailFor,
      canManageBank,
      saveBankDetail,
      employeeDocuments,
      documentsFor,
      canManageDocuments,
      addDocument,
      setDocumentStatus,
    ],
  );

  return <EmployeeContext.Provider value={value}>{children}</EmployeeContext.Provider>;
}

export function useEmployees() {
  const ctx = useContext(EmployeeContext);
  if (!ctx) throw new Error("useEmployees must be used within an EmployeeProvider");
  return ctx;
}

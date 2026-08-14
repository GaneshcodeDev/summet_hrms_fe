"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import { employees as seedEmployees, getEmployeeById as resolveSeedEmployee } from "@/lib/mock-data";
import type { Employee, EmployeeBankDetail, EmployeeDocumentRecord, UserAccount } from "@/lib/types";

/**
 * Plain (non-React) persistence for the employee directory, mirroring
 * org-store.ts / master-store.ts / rbac-store.ts. This is the single source
 * of truth for employee records going forward — created/edited/deactivated
 * employees live here. The `employees` array in mock-data.ts stays only as
 * raw seed material (and is still read directly by modules not yet migrated
 * onto this store — see the architecture assessment's Phase 6).
 *
 * The real product starts with zero employees (only the Super Admin, who
 * isn't a site employee — see resolveEmployeeForAccount below). The full
 * enriched roster is available as `demoEmployeeSeed` for "Load Demo Data"
 * (see demo-seed.ts) — enrichment goes through mock-data's getEmployeeById
 * so EMP001 keeps the same profile (skills/education/siteIds) it always had.
 */
export const demoEmployeeSeed: Employee[] = seedEmployees.map((e) => resolveSeedEmployee(e.employeeId) ?? e);

export const employeesStore = createLocalStorageStore<Employee[]>("hrms_employees", []);

export function findEmployeeById(id: string): Employee | undefined {
  return employeesStore.getSnapshot().find((e) => e.id === id);
}

export function findEmployeeByEmployeeId(employeeId: string): Employee | undefined {
  return employeesStore.getSnapshot().find((e) => e.employeeId.toLowerCase() === employeeId.toLowerCase());
}

export function getEmployeesBySite(siteId: string): Employee[] {
  return employeesStore.getSnapshot().filter((e) => e.siteId === siteId);
}

/** Employees who list this person (by employeeId) as their reporting manager. */
export function directReportsOf(employeeId: string): Employee[] {
  return employeesStore.getSnapshot().filter((e) => e.reportingManagerId === employeeId);
}

/** Next sequential EMP### code, unique across the whole directory. */
export function nextEmployeeCode(): string {
  const numbers = employeesStore
    .getSnapshot()
    .map((e) => Number(e.employeeId.replace(/^EMP/i, "")))
    .filter((n) => Number.isFinite(n));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `EMP${String(next).padStart(3, "0")}`;
}

/**
 * Walks a candidate manager's own reporting chain looking for `employeeId` —
 * if found, assigning that candidate as `employeeId`'s manager would create a
 * cycle (Rahul reports to Amit, Amit can't then report to Rahul, nor to
 * anyone who eventually reports to Rahul). Bounded so already-corrupt data
 * can't spin this into an infinite loop.
 */
export function wouldCreateReportingCycle(employeeId: string, candidateManagerId: string): boolean {
  const all = employeesStore.getSnapshot();
  let current: string | undefined = candidateManagerId;
  let hops = 0;
  while (current && hops < 50) {
    if (current === employeeId) return true;
    current = all.find((e) => e.employeeId === current)?.reportingManagerId;
    hops += 1;
  }
  return false;
}

/**
 * Real per-employee bank details and documents — additive stores alongside
 * the employee directory itself (Phase 7), not a separate architecture.
 * Both start empty; see demo-seed.ts for the optional demo dataset.
 */
export const bankDetailsStore = createLocalStorageStore<EmployeeBankDetail[]>("hrms_employee_bank_details", []);
export const employeeDocumentsStore = createLocalStorageStore<EmployeeDocumentRecord[]>("hrms_employee_documents", []);

export function findBankDetail(employeeId: string): EmployeeBankDetail | undefined {
  return bankDetailsStore.getSnapshot().find((b) => b.employeeId === employeeId);
}

export function documentsForEmployee(employeeId: string): EmployeeDocumentRecord[] {
  return employeeDocumentsStore.getSnapshot().filter((d) => d.employeeId === employeeId);
}

/**
 * Resolves the display identity behind a logged-in account. Most accounts
 * (Site Admins included) are backed by a real Employee record. The platform
 * Super Admin is the one deliberate exception — per the platform's own
 * model, "Super Admin is NOT an employee of a site" — so when no matching
 * Employee record exists, this synthesizes a minimal Employee-shaped
 * identity straight from the account instead of crashing or defaulting to
 * someone else's profile.
 *
 * Takes the employee list as a parameter (rather than reading the store
 * itself) so callers that run during render — like AccessControlProvider's
 * currentUser — can pass in the list they already got safely via
 * useSyncExternalStore, instead of this reaching into localStorage directly
 * (which would crash during server-side prerendering).
 */
export function resolveEmployeeForAccount(account: UserAccount, employees: Employee[]): Employee {
  const employee = employees.find((e) => e.employeeId.toLowerCase() === account.employeeId.toLowerCase());
  if (employee) return employee;
  return {
    id: account.id,
    employeeId: account.employeeId || account.id,
    name: account.name,
    email: account.email,
    phone: "",
    department: "Platform",
    designation: "Platform Administrator",
    status: account.status,
    location: "—",
    dateOfJoining: account.createdOn,
    siteId: account.siteIds[0] ?? "",
    siteIds: account.siteIds,
  };
}

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyRow, TBody, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { Can } from "@/components/auth/permission-gate";
import type { Employee, OrgUnitType } from "@/lib/types";
import { useSite } from "@/lib/site-context";
import { useEmployees, type EmployeeDraft } from "@/lib/employee-context";
import { useOrg } from "@/lib/org-context";
import { useMasters } from "@/lib/master-context";
import { useToast } from "@/lib/toast-context";
import type { MasterType } from "@/lib/types";

const PAGE_SIZE = 10;

export default function EmployeesPage() {
  const { sites, currentSiteId, currentSite, isAllSites } = useSite();
  const { employees, createEmployee, updateEmployee, setEmployeeStatus, deleteEmployee } = useEmployees();
  const { orgUnits } = useOrg();
  const toast = useToast();

  // Department options come from the site's own Organization structure (set
  // up during onboarding), not a global list — so Site A's and Site B's
  // "Production" departments never get confused with each other.
  const departmentNames = useMemo(() => {
    const names = orgUnits
      .filter((u) => u.type === "Department" && (isAllSites || u.siteId === currentSiteId))
      .map((u) => u.name);
    return Array.from(new Set(names)).sort();
  }, [orgUnits, isAllSites, currentSiteId]);

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All Departments");
  // Defaults to Active — the directory's primary purpose is the current
  // roster; Inactive/Exited employees stay fully on file, just a filter away.
  const [status, setStatus] = useState("Active");
  const [stage, setStage] = useState("All Stages");
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const matchesSite = isAllSites || e.siteId === currentSiteId;
      const matchesSearch =
        !search ||
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.employeeId.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase());
      const matchesDept = department === "All Departments" || e.department === department;
      const matchesStatus = status === "All Status" || e.status === status;
      const matchesStage = stage === "All Stages" || e.employmentStage === stage;
      return matchesSite && matchesSearch && matchesDept && matchesStatus && matchesStage;
    });
  }, [employees, search, department, status, stage, currentSiteId, isAllSites]);

  // Reset to page 1 whenever the filters change — adjusted during render
  // (not an effect) per React's "storing information from previous renders" pattern.
  const filterKey = `${search}|${department}|${status}|${stage}|${currentSiteId}|${isAllSites}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(filtered.length, currentPage * PAGE_SIZE);

  function readDraft(form: FormData, fallbackSiteId: string): EmployeeDraft {
    const siteId = String(form.get("siteId") ?? fallbackSiteId);
    const additionalSiteIds = form.getAll("additionalSiteIds").map(String);
    const siteIds = Array.from(new Set([siteId, ...additionalSiteIds]));
    const optional = (key: string) => {
      const v = String(form.get(key) ?? "").trim();
      return v || undefined;
    };
    return {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      department: String(form.get("department") ?? ""),
      designation: String(form.get("designation") ?? ""),
      location: String(form.get("location") ?? ""),
      siteId,
      siteIds,
      dateOfJoining: optional("dateOfJoining"),
      reportingManagerId: optional("reportingManagerId"),
      businessUnitId: optional("businessUnitId"),
      departmentId: optional("departmentId"),
      subDepartmentId: optional("subDepartmentId"),
      designationId: optional("designationId"),
      gradeId: optional("gradeId"),
      plantId: optional("plantId"),
      locationId: optional("locationId"),
      costCenterId: optional("costCenterId"),
      profitCenterId: optional("profitCenterId"),
      employmentTypeId: optional("employmentTypeId"),
      employeeTypeId: optional("employeeTypeId"),
      shiftId: optional("shiftId"),
    };
  }

  function handleAddEmployee(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const fallbackSiteId = isAllSites ? sites[0]?.id ?? "" : currentSiteId;
    const result = createEmployee(readDraft(form, fallbackSiteId));
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      setAddOpen(false);
      e.currentTarget.reset();
    }
  }

  function handleEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editTarget) return;
    const form = new FormData(e.currentTarget);
    const result = updateEmployee(editTarget.id, readDraft(form, editTarget.siteId));
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setEditTarget(null);
  }

  function handleToggleStatus(employee: Employee) {
    const result = setEmployeeStatus(employee.id, employee.status === "Active" ? "Inactive" : "Active");
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const result = deleteEmployee(deleteTarget.id);
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setDeleteTarget(null);
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        description={
          isAllSites
            ? "Manage and view all employees across every site"
            : `Manage and view employees at ${currentSite?.name}`
        }
        action={
          <Can feature="employees.directory" action="create">
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add Employee
            </Button>
          </Can>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
            />
          </div>
          <Select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-auto"
          >
            <option>All Departments</option>
            {departmentNames.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
          </Select>
          <Select value={stage} onChange={(e) => setStage(e.target.value)} className="w-auto">
            <option>All Stages</option>
            <option>Probation</option>
            <option>Confirmed</option>
            <option>On Notice</option>
            <option>Exited</option>
          </Select>
        </div>

        <Table>
          <THead>
            <Th>Employee</Th>
            <Th>Employee ID</Th>
            {isAllSites && <Th>Site</Th>}
            <Th>Department</Th>
            <Th>Designation</Th>
            <Th>Status</Th>
            <Th>Stage</Th>
            <Th>Actions</Th>
          </THead>
          <TBody>
            {paged.map((employee) => (
              <Tr key={employee.id} hoverable>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={employee.name} size="sm" />
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100">{employee.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{employee.email}</p>
                    </div>
                  </div>
                </Td>
                <Td>{employee.employeeId}</Td>
                {isAllSites && (
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <span>{sites.find((s) => s.id === employee.siteId)?.name ?? "—"}</span>
                      {employee.siteIds && employee.siteIds.length > 1 && (
                        <span
                          title={`Also mapped to ${employee.siteIds.length - 1} other site(s)`}
                          className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                        >
                          +{employee.siteIds.length - 1}
                        </span>
                      )}
                    </div>
                  </Td>
                )}
                <Td>{employee.department}</Td>
                <Td>{employee.designation}</Td>
                <Td>
                  <StatusBadge status={employee.status} />
                </Td>
                <Td>
                  {employee.employmentStage ? <StatusBadge status={employee.employmentStage} /> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                </Td>
                <Td>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/employees/${employee.employeeId}`}
                      className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      View
                    </Link>
                    <Can feature="employees.directory" action="edit">
                      <button
                        onClick={() => setEditTarget(employee)}
                        title="Edit employee"
                        className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(employee)}
                        title={employee.status === "Active" ? "Deactivate employee" : "Activate employee"}
                        className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    </Can>
                    <Can feature="employees.directory" action="delete">
                      <button
                        onClick={() => setDeleteTarget(employee)}
                        title="Delete employee"
                        className="text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Can>
                  </div>
                </Td>
              </Tr>
            ))}
            {filtered.length === 0 && (
              <EmptyRow colSpan={isAllSites ? 8 : 7}>No employees match your filters.</EmptyRow>
            )}
          </TBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Showing {rangeStart} to {rangeEnd} of {filtered.length} entries
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm text-slate-500 dark:text-slate-400">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      <EmployeeFormModal
        open={addOpen}
        title="Add Employee"
        submitLabel="Add Employee"
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddEmployee}
      />

      <EmployeeFormModal
        key={editTarget?.id ?? "edit"}
        open={Boolean(editTarget)}
        title="Edit Employee"
        submitLabel="Save Changes"
        employee={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEditSubmit}
      />

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete Employee">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Are you sure you want to permanently delete{" "}
              <span className="font-medium text-slate-700 dark:text-slate-200">{deleteTarget.name}</span> (
              {deleteTarget.employeeId})? This cannot be undone — consider deactivating instead if you might need
              this record later.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={handleDeleteConfirm}>
                Delete Employee
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function EmployeeFormModal({
  open,
  title,
  submitLabel,
  employee,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  submitLabel: string;
  employee?: Employee | null;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const { sites, mappedSites, currentSiteId, isAllSites, isSuperAdmin } = useSite();
  const { employees, wouldCreateReportingCycle } = useEmployees();
  const { orgUnits } = useOrg();
  const { recordsOfType } = useMasters();

  // Non-Super-Admins (e.g. a Site Admin) can only place employees in a site
  // they're themselves mapped to — enforced here, not just by hiding sites
  // elsewhere, so a Site Admin can never create/map an employee into a site
  // that isn't theirs. With exactly one option, the field is effectively locked.
  const assignableSites = isSuperAdmin ? sites : mappedSites;
  const siteIsLocked = assignableSites.length <= 1;

  const [formSiteId, setFormSiteId] = useState(
    employee?.siteId ?? (siteIsLocked ? assignableSites[0]?.id ?? "" : isAllSites ? "" : currentSiteId),
  );
  const [formDepartmentId, setFormDepartmentId] = useState(employee?.departmentId ?? "");

  function orgOptions(type: OrgUnitType, parentId?: string) {
    return orgUnits.filter(
      (u) => u.type === type && u.siteId === formSiteId && (parentId === undefined || u.parentId === parentId),
    );
  }
  function masterOptions(type: MasterType) {
    return recordsOfType(type).filter((r) => r.siteId === formSiteId && r.status === "Active");
  }

  const businessUnits = orgOptions("BusinessUnit");
  const plants = orgOptions("Plant");
  const locations = orgOptions("Location");
  const departments = orgOptions("Department");
  const subDepartments = formDepartmentId ? orgOptions("SubDepartment", formDepartmentId) : [];
  const costCenters = orgOptions("CostCenter");
  const profitCenters = orgOptions("ProfitCenter");
  const designations = masterOptions("Designation");
  const grades = masterOptions("JobGrade");
  const employmentTypes = masterOptions("EmploymentType");
  const employeeTypes = masterOptions("EmployeeType");
  const shifts = masterOptions("Shift");

  const managerOptions = employees.filter(
    (e) =>
      e.status === "Active" &&
      e.siteId === formSiteId &&
      e.id !== employee?.id &&
      (!employee || !wouldCreateReportingCycle(employee.employeeId, e.employeeId)),
  );

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Full Name">
          <Input name="name" required defaultValue={employee?.name} placeholder="e.g. Kavya Reddy" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email">
            <Input name="email" type="email" required defaultValue={employee?.email} placeholder="name@company.com" />
          </Field>
          <Field label="Phone">
            <Input name="phone" required defaultValue={employee?.phone} placeholder="+91 98765 43210" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Home Site">
            {siteIsLocked ? (
              <>
                <Input value={assignableSites[0]?.name ?? "—"} disabled />
                <input type="hidden" name="siteId" value={formSiteId} />
              </>
            ) : (
              <Select
                name="siteId"
                required
                value={formSiteId}
                onChange={(e) => {
                  setFormSiteId(e.target.value);
                  setFormDepartmentId("");
                }}
              >
                {!employee && (
                  <option value="" disabled>
                    Select site
                  </option>
                )}
                {assignableSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Date of Joining">
            <Input name="dateOfJoining" type="date" defaultValue={employee?.dateOfJoining ?? new Date().toISOString().slice(0, 10)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4" key={formSiteId}>
          <Field label="Business Unit (optional)">
            <Select name="businessUnitId" defaultValue={employee?.businessUnitId ?? ""}>
              <option value="">Not set</option>
              {businessUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Plant (optional)">
            <Select name="plantId" defaultValue={employee?.plantId ?? ""}>
              <option value="">Not set</option>
              {plants.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>

          {locations.length > 0 ? (
            <Field label="Location">
              <Select name="locationId" required defaultValue={employee?.locationId ?? ""}>
                <option value="" disabled>
                  Select location
                </option>
                {locations.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Location">
              <Input name="location" required defaultValue={employee?.location} placeholder="e.g. Noida" />
            </Field>
          )}

          <Field label="Department">
            <Select
              name="department"
              required
              defaultValue={employee?.department ?? ""}
              onChange={(e) => {
                const unit = departments.find((u) => u.name === e.target.value);
                setFormDepartmentId(unit?.id ?? "");
              }}
            >
              <option value="" disabled>
                Select department
              </option>
              {departments.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </Select>
            <input type="hidden" name="departmentId" value={formDepartmentId} />
          </Field>

          <Field label="Sub Department (optional)" key={formDepartmentId}>
            <Select name="subDepartmentId" defaultValue={employee?.subDepartmentId ?? ""} disabled={subDepartments.length === 0}>
              <option value="">{subDepartments.length === 0 ? "None for this department" : "Not set"}</option>
              {subDepartments.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>

          {designations.length > 0 ? (
            <Field label="Designation">
              <Select
                required
                defaultValue={employee?.designationId ?? ""}
                onChange={() => {}}
                name="designationSelect"
              >
                <option value="" disabled>
                  Select designation
                </option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <DesignationHiddenFields designations={designations} defaultId={employee?.designationId} />
            </Field>
          ) : (
            <Field label="Designation">
              <Input name="designation" required defaultValue={employee?.designation} placeholder="e.g. Software Engineer" />
            </Field>
          )}

          <Field label="Grade (optional)">
            <Select name="gradeId" defaultValue={employee?.gradeId ?? ""}>
              <option value="">Not set</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cost Center (optional)">
            <Select name="costCenterId" defaultValue={employee?.costCenterId ?? ""}>
              <option value="">Not set</option>
              {costCenters.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Profit Center (optional)">
            <Select name="profitCenterId" defaultValue={employee?.profitCenterId ?? ""}>
              <option value="">Not set</option>
              {profitCenters.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Employment Type (optional)">
            <Select name="employmentTypeId" defaultValue={employee?.employmentTypeId ?? ""}>
              <option value="">Not set</option>
              {employmentTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Employee Type (optional)">
            <Select name="employeeTypeId" defaultValue={employee?.employeeTypeId ?? ""}>
              <option value="">Not set</option>
              {employeeTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Shift (optional)">
            <Select name="shiftId" defaultValue={employee?.shiftId ?? ""}>
              <option value="">Shift not assigned</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Reporting Manager (optional)">
            <Select name="reportingManagerId" defaultValue={employee?.reportingManagerId ?? ""}>
              <option value="">No reporting manager</option>
              {managerOptions.map((m) => (
                <option key={m.employeeId} value={m.employeeId}>
                  {m.name} ({m.employeeId})
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {assignableSites.length > 1 && (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Also map to other sites (optional)
            </span>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              {assignableSites.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                >
                  <input
                    type="checkbox"
                    name="additionalSiteIds"
                    value={s.id}
                    defaultChecked={employee?.siteIds?.includes(s.id) && s.id !== employee?.siteId}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
                  />
                  {s.name}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
              Employees mapped to more than one site get a working-site switcher on every page.
            </p>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Hidden inputs mirroring the visible Designation select's chosen id/name — kept separate so the visible select doesn't need a name clash with the free-text fallback. */
function DesignationHiddenFields({
  designations,
  defaultId,
}: {
  designations: { id: string; name: string }[];
  defaultId?: string;
}) {
  const [selectedId, setSelectedId] = useState(defaultId ?? "");
  useEffect(() => {
    const select = document.querySelector<HTMLSelectElement>('select[name="designationSelect"]');
    if (!select) return;
    const handler = () => setSelectedId(select.value);
    select.addEventListener("change", handler);
    return () => select.removeEventListener("change", handler);
  }, []);
  const selected = designations.find((d) => d.id === selectedId);
  return (
    <>
      <input type="hidden" name="designationId" value={selectedId} />
      <input type="hidden" name="designation" value={selected?.name ?? ""} />
    </>
  );
}

"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyRow, TBody, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { departments, employees as initialEmployees, TOTAL_EMPLOYEES } from "@/lib/mock-data";
import type { Employee } from "@/lib/types";
import { useSite } from "@/lib/site-context";

export default function EmployeesPage() {
  const { sites, currentSiteId, currentSite, isAllSites } = useSite();
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All Departments");
  const [status, setStatus] = useState("All Status");
  const [modalOpen, setModalOpen] = useState(false);

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
      return matchesSite && matchesSearch && matchesDept && matchesStatus;
    });
  }, [employees, search, department, status, currentSiteId, isAllSites]);

  function handleAddEmployee(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "");
    const nextNum = employees.length + 1;
    const siteId = String(form.get("siteId") ?? (isAllSites ? sites[0]?.id : currentSiteId));
    const additionalSiteIds = form.getAll("additionalSiteIds").map(String);
    const siteIds = Array.from(new Set([siteId, ...additionalSiteIds]));
    setEmployees((prev) => [
      {
        id: String(nextNum),
        employeeId: `EMP${String(nextNum).padStart(3, "0")}`,
        name,
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        department: String(form.get("department") ?? ""),
        designation: String(form.get("designation") ?? ""),
        status: "Active",
        location: String(form.get("location") ?? ""),
        dateOfJoining: new Date().toISOString().slice(0, 10),
        siteId,
        siteIds: siteIds.length > 1 ? siteIds : undefined,
      },
      ...prev,
    ]);
    setModalOpen(false);
    e.currentTarget.reset();
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
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
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
            {departments.map((d) => (
              <option key={d.id}>{d.name}</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
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
            <Th>Actions</Th>
          </THead>
          <TBody>
            {filtered.map((employee) => (
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
                  <Link
                    href={`/employees/${employee.employeeId}`}
                    className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    View
                  </Link>
                </Td>
              </Tr>
            ))}
            {filtered.length === 0 && (
              <EmptyRow colSpan={isAllSites ? 7 : 6}>No employees match your filters.</EmptyRow>
            )}
          </TBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Showing 1 to {filtered.length} of {isAllSites ? TOTAL_EMPLOYEES : filtered.length} entries
          </p>
          <div className="flex items-center gap-1">
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-slate-800" disabled>
              <ChevronLeft className="h-4 w-4" />
            </button>
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium ${
                  p === 1
                    ? "bg-indigo-600 text-white"
                    : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {p}
              </button>
            ))}
            <span className="px-1 text-slate-400 dark:text-slate-500">…</span>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Employee">
        <form className="space-y-4" onSubmit={handleAddEmployee}>
          <Field label="Full Name">
            <Input name="name" required placeholder="e.g. Kavya Reddy" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <Input name="email" type="email" required placeholder="name@company.com" />
            </Field>
            <Field label="Phone">
              <Input name="phone" required placeholder="+91 98765 43210" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Department">
              <Select name="department" required defaultValue="">
                <option value="" disabled>
                  Select department
                </option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Designation">
              <Input name="designation" required placeholder="e.g. Software Engineer" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Location">
              <Input name="location" required placeholder="e.g. Noida" />
            </Field>
            <Field label="Home Site">
              <Select name="siteId" required defaultValue={isAllSites ? "" : currentSiteId}>
                {isAllSites && (
                  <option value="" disabled>
                    Select site
                  </option>
                )}
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {sites.length > 1 && (
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Also map to other sites (optional)
              </span>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                {sites.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                  >
                    <input
                      type="checkbox"
                      name="additionalSiteIds"
                      value={s.id}
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
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Employee</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { LogOut, Users2, ListChecks, CheckCircle2, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { Can } from "@/components/auth/permission-gate";
import { EmptyRow, TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { separationReasons } from "@/lib/offboarding-data";
import { useEmployees } from "@/lib/employee-context";
import { useOffboarding } from "@/lib/offboarding-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useSiteFilter } from "@/lib/site-context";
import { useToast } from "@/lib/toast-context";
import type { SeparationType } from "@/lib/types";

const separationTypes: SeparationType[] = ["Resignation", "Termination", "Retirement", "Absconding"];

export default function OffboardingPage() {
  const { currentUser } = useAccessControl();
  const { employees } = useEmployees();
  const toast = useToast();
  const { visibleCases, canManage, initiateSeparation } = useOffboarding();
  const [modalOpen, setModalOpen] = useState(false);

  const cases = useMemo(() => visibleCases(), [visibleCases]);
  const filteredCases = useSiteFilter(cases);

  const stats = {
    total: filteredCases.length,
    pending: filteredCases.filter((c) => c.status === "Pending Approval").length,
    inProgress: filteredCases.filter((c) => c.status === "Approved" || c.status === "Clearance In Progress" || c.status === "Settlement Pending").length,
    completed: filteredCases.filter((c) => c.status === "Completed").length,
  };

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = initiateSeparation({
      employeeId: canManage ? String(form.get("employeeId") ?? "") : currentUser.employeeId,
      type: canManage ? (String(form.get("type")) as SeparationType) : "Resignation",
      reason: String(form.get("reason") ?? ""),
      resignationDate: String(form.get("resignationDate") ?? ""),
      lastWorkingDay: String(form.get("lastWorkingDay") ?? ""),
      noticePeriodDays: Number(form.get("noticePeriodDays") ?? 0),
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      setModalOpen(false);
      e.currentTarget.reset();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offboarding"
        description="Resignation & termination workflow, clearance, exit interviews and full & final settlement"
        action={
          <Can feature="offboarding.cases" action="create">
            <Button onClick={() => setModalOpen(true)}>
              <LogOut className="h-4 w-4" /> Initiate Separation
            </Button>
          </Can>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Cases" value={String(stats.total)} icon={Users2} tone="indigo" />
        <StatCard label="Pending Approval" value={String(stats.pending)} icon={Clock} tone="amber" />
        <StatCard label="In Progress" value={String(stats.inProgress)} icon={ListChecks} tone="sky" />
        <StatCard label="Completed" value={String(stats.completed)} icon={CheckCircle2} tone="emerald" />
      </div>

      <Card>
        <Table>
          <THead>
            <Th>Employee</Th>
            <Th>Type</Th>
            <Th>Reason</Th>
            <Th>Last Working Day</Th>
            <Th>Status</Th>
          </THead>
          <TBody>
            {filteredCases.map((c) => (
              <Tr key={c.id} hoverable>
                <Td>
                  <Link href={`/offboarding/${c.id}`} className="font-medium text-slate-800 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400">
                    {c.employee}
                  </Link>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{c.designation} · {c.department}</p>
                </Td>
                <Td>{c.type}</Td>
                <Td>{c.reason}</Td>
                <Td>{c.lastWorkingDay}</Td>
                <Td>
                  <StatusBadge status={c.status} />
                </Td>
              </Tr>
            ))}
            {filteredCases.length === 0 && <EmptyRow colSpan={5}>No separation cases to show.</EmptyRow>}
          </TBody>
        </Table>
        <TableFootnote>
          Showing 1 to {filteredCases.length} of {filteredCases.length} entries
        </TableFootnote>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Initiate Separation">
        <form className="space-y-4" onSubmit={handleCreate}>
          {canManage ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Employee">
                <Select name="employeeId" required defaultValue="">
                  <option value="" disabled>
                    Select employee
                  </option>
                  {employees.map((e) => (
                    <option key={e.employeeId} value={e.employeeId}>
                      {e.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Type">
                <Select name="type" required defaultValue="Resignation">
                  {separationTypes.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Submitting a resignation as <span className="font-medium text-slate-700 dark:text-slate-200">{currentUser.name}</span>.
            </p>
          )}
          <Field label="Reason">
            <Select name="reason" required defaultValue={separationReasons[0]}>
              {separationReasons.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Resignation Date">
              <Input name="resignationDate" type="date" required />
            </Field>
            <Field label="Notice Period (days)">
              <Input name="noticePeriodDays" type="number" min={0} required defaultValue={30} />
            </Field>
          </div>
          <Field label="Last Working Day">
            <Input name="lastWorkingDay" type="date" required />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

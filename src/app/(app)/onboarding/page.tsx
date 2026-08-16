"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { UserPlus, Users2, ListChecks, CheckCircle2, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { Can } from "@/components/auth/permission-gate";
import { EmptyRow, TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { departments } from "@/lib/mock-data";
import { useEmployees } from "@/lib/employee-context";
import { useOnboarding } from "@/lib/onboarding-context";
import { useSite, useSiteFilter } from "@/lib/site-context";
import { useToast } from "@/lib/toast-context";

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-indigo-600 dark:bg-indigo-400" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{value}%</span>
    </div>
  );
}

export default function OnboardingPage() {
  const { sites, isAllSites, currentSite } = useSite();
  const { employees } = useEmployees();
  const toast = useToast();
  const { visibleCases, progressFor, createCase } = useOnboarding();
  const [modalOpen, setModalOpen] = useState(false);

  const cases = useMemo(() => visibleCases(), [visibleCases]);
  const filteredCases = useSiteFilter(cases);

  const stats = {
    total: filteredCases.length,
    preboarding: filteredCases.filter((c) => c.status === "Pre-boarding").length,
    inProgress: filteredCases.filter((c) => c.status === "In Progress").length,
    completed: filteredCases.filter((c) => c.status === "Completed").length,
  };

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = createCase({
      candidateName: String(form.get("candidateName") ?? ""),
      candidateEmail: String(form.get("candidateEmail") ?? ""),
      candidatePhone: String(form.get("candidatePhone") ?? ""),
      designation: String(form.get("designation") ?? ""),
      department: String(form.get("department") ?? ""),
      siteId: String(form.get("siteId") ?? (isAllSites ? sites[0]?.id : currentSite?.id)),
      buddyId: String(form.get("buddyId") ?? "") || undefined,
      joiningDate: String(form.get("joiningDate") ?? ""),
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
        title="Onboarding"
        description={
          isAllSites
            ? "Pre-boarding checklists, document collection and e-signatures for every new joiner"
            : `New joiners at ${currentSite?.name}`
        }
        action={
          <Can feature="onboarding.cases" action="create">
            <Button onClick={() => setModalOpen(true)}>
              <UserPlus className="h-4 w-4" /> New Joiner
            </Button>
          </Can>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Cases" value={String(stats.total)} icon={Users2} tone="indigo" />
        <StatCard label="Pre-boarding" value={String(stats.preboarding)} icon={Clock} tone="amber" />
        <StatCard label="In Progress" value={String(stats.inProgress)} icon={ListChecks} tone="sky" />
        <StatCard label="Completed" value={String(stats.completed)} icon={CheckCircle2} tone="emerald" />
      </div>

      <Card>
        <Table>
          <THead>
            <Th>Candidate</Th>
            <Th>Designation</Th>
            <Th>Department</Th>
            <Th>Joining Date</Th>
            <Th>Progress</Th>
            <Th>Status</Th>
          </THead>
          <TBody>
            {filteredCases.map((c) => (
              <Tr key={c.id} hoverable>
                <Td>
                  <Link href={`/onboarding/${c.id}`} className="font-medium text-slate-800 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400">
                    {c.candidateName}
                  </Link>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{c.candidateEmail}</p>
                </Td>
                <Td>{c.designation}</Td>
                <Td>{c.department}</Td>
                <Td>{c.joiningDate}</Td>
                <Td>
                  <ProgressBar value={progressFor(c)} />
                </Td>
                <Td>
                  <StatusBadge status={c.status} />
                </Td>
              </Tr>
            ))}
            {filteredCases.length === 0 && <EmptyRow colSpan={6}>No onboarding cases to show.</EmptyRow>}
          </TBody>
        </Table>
        <TableFootnote>
          Showing 1 to {filteredCases.length} of {filteredCases.length} entries
        </TableFootnote>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Joiner">
        <form className="space-y-4" onSubmit={handleCreate}>
          <Field label="Candidate Name">
            <Input name="candidateName" required placeholder="e.g. Arjun Nair" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <Input name="candidateEmail" type="email" required placeholder="candidate@email.com" />
            </Field>
            <Field label="Phone">
              <Input name="candidatePhone" required placeholder="+91 90000 00000" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Designation">
              <Input name="designation" required placeholder="e.g. Software Engineer" />
            </Field>
            <Field label="Department">
              <Select name="department" required defaultValue={departments[0]?.name}>
                {departments.map((d) => (
                  <option key={d.id}>{d.name}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Site">
              <Select name="siteId" required defaultValue={isAllSites ? sites[0]?.id : currentSite?.id}>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Joining Date">
              <Input name="joiningDate" type="date" required />
            </Field>
          </div>
          <Field label="Onboarding Buddy (optional)">
            <Select name="buddyId" defaultValue="">
              <option value="">— None —</option>
              {employees.map((e) => (
                <option key={e.employeeId} value={e.employeeId}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Case</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

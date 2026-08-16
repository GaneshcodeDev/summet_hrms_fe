"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Target, Users2, ClipboardCheck, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyRow, TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { useSite, useSiteFilter } from "@/lib/site-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useEmployees } from "@/lib/employee-context";
import { usePerformance } from "@/lib/performance-context";
import { useToast } from "@/lib/toast-context";
import { currentCycleCaseFor, getCycleCompletionSummary, getTeamReviewSummary } from "@/lib/dashboard-selectors";

function formatDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PerformancePage() {
  const { sites, currentSiteId, currentSite, isAllSites } = useSite();
  const { currentUser } = useAccessControl();
  const { employees } = useEmployees();
  const { cycles, reviewCases, canManageCycles, createCycle, isDirectManagerOf } = usePerformance();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  const filteredCycles = useSiteFilter(cycles);
  const scopedCases = useSiteFilter(reviewCases);

  const myCase = useMemo(() => currentCycleCaseFor(currentUser.employeeId, cycles, reviewCases), [currentUser.employeeId, cycles, reviewCases]);
  const myCycle = myCase ? cycles.find((c) => c.id === myCase.cycleId) : undefined;

  const teamMembers = useMemo(() => employees.filter((e) => isDirectManagerOf(e.employeeId)), [employees, isDirectManagerOf]);
  const isManager = teamMembers.length > 0;
  const teamCases = useMemo(() => scopedCases.filter((c) => teamMembers.some((m) => m.employeeId === c.employeeId)), [scopedCases, teamMembers]);
  const teamSummary = useMemo(() => getTeamReviewSummary(teamCases), [teamCases]);

  const cycleSummary = useMemo(() => getCycleCompletionSummary(scopedCases), [scopedCases]);

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = createCycle({
      siteId: String(form.get("siteId") ?? (isAllSites ? sites[0]?.id : currentSiteId)),
      name: String(form.get("name") ?? ""),
      startDate: String(form.get("startDate") ?? ""),
      endDate: String(form.get("endDate") ?? ""),
      reviewStartDate: String(form.get("reviewStartDate") ?? ""),
      reviewEndDate: String(form.get("reviewEndDate") ?? ""),
      requiresHRReview: form.get("requiresHRReview") === "on",
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
        title="Performance"
        description={isAllSites ? "Goals, reviews and appraisals across all sites" : `Goals, reviews and appraisals at ${currentSite?.name}`}
        action={
          canManageCycles && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> Create Cycle
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {myCycle && myCase ? (
          <>
            <StatCard label="Current Cycle" value={myCycle.name} icon={Target} tone="indigo" trend={myCase.stage} />
            <StatCard label="Review Status" value={myCase.stage} icon={ClipboardCheck} tone="sky" />
            <StatCard label="Current Rating" value={myCase.finalScore !== undefined ? `${myCase.finalScore}/5` : "—"} icon={Star} tone="amber" />
          </>
        ) : (
          <StatCard label="Current Cycle" value="—" icon={Target} tone="indigo" trend="No goals assigned yet" />
        )}
        {isManager && <StatCard label="Team Reviews Pending" value={String(teamSummary.pendingReviews)} icon={Users2} tone="rose" trend={`${teamSummary.completionPct}% complete`} />}
        {canManageCycles && !isManager && (
          <>
            <StatCard label="Cycle Completion" value={`${cycleSummary.completionPct}%`} icon={ClipboardCheck} tone="emerald" />
            <StatCard label="Employees Awaiting Review" value={String(cycleSummary.employeesAwaitingReview)} icon={Users2} tone="rose" />
          </>
        )}
      </div>

      {isManager && (
        <Card className="p-5">
          <p className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Your team</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {teamSummary.completed} of {teamSummary.total} direct-report reviews completed this cycle.
          </p>
        </Card>
      )}

      <Card>
        <Table>
          <THead>
            <Th>Cycle</Th>
            {isAllSites && <Th>Site</Th>}
            <Th>Period</Th>
            <Th>Review Window</Th>
            <Th>Status</Th>
          </THead>
          <TBody>
            {filteredCycles.map((c) => (
              <Tr key={c.id} hoverable>
                <Td>
                  <Link href={`/performance/${c.id}`} className="font-medium text-slate-800 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400">
                    {c.name}
                  </Link>
                  {!c.requiresHRReview && <p className="text-xs text-slate-400 dark:text-slate-500">Manager-only sign-off</p>}
                </Td>
                {isAllSites && <Td>{sites.find((s) => s.id === c.siteId)?.name ?? "—"}</Td>}
                <Td>
                  {formatDate(c.startDate)} – {formatDate(c.endDate)}
                </Td>
                <Td>
                  {formatDate(c.reviewStartDate)} – {formatDate(c.reviewEndDate)}
                </Td>
                <Td>
                  <StatusBadge status={c.status} />
                </Td>
              </Tr>
            ))}
            {filteredCycles.length === 0 && <EmptyRow colSpan={isAllSites ? 5 : 4}>No performance cycles configured.</EmptyRow>}
          </TBody>
        </Table>
        <TableFootnote>
          Showing 1 to {filteredCycles.length} of {filteredCycles.length} entries
        </TableFootnote>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Performance Cycle">
        <form className="space-y-4" onSubmit={handleCreate}>
          {isAllSites && (
            <Field label="Site">
              <Select name="siteId" required defaultValue={sites[0]?.id}>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Cycle Name">
            <Input name="name" required placeholder="e.g. H2 2026 Performance Review" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date">
              <Input name="startDate" type="date" required />
            </Field>
            <Field label="End Date">
              <Input name="endDate" type="date" required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Review Start Date">
              <Input name="reviewStartDate" type="date" required />
            </Field>
            <Field label="Review End Date">
              <Input name="reviewEndDate" type="date" required />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" name="requiresHRReview" defaultChecked className="h-4 w-4 rounded border-slate-300" />
            Requires HR Review before completion
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Cycle</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

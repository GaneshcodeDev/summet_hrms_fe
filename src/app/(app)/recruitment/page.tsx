"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, Check, X, Ban, CalendarPlus, FileSignature, Users2, Briefcase, ClipboardCheck, IndianRupee } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { Can } from "@/components/auth/permission-gate";
import { Tabs } from "@/components/ui/tabs";
import { EmptyRow, TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { useSite, useSiteFilter } from "@/lib/site-context";
import { useEmployees } from "@/lib/employee-context";
import { useOrg } from "@/lib/org-context";
import { useMasters } from "@/lib/master-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useToast } from "@/lib/toast-context";
import { useRecruitment } from "@/lib/recruitment-context";
import { nextStagesFrom } from "@/lib/recruitment-engine";
import { getInterviewsOnDate, getRecruitmentFunnelReport } from "@/lib/report-selectors";
import type {
  Application,
  ApplicationStage,
  Interview,
  InterviewMode,
  InterviewRecommendation,
  JobOpening,
  JobOpeningStatus,
  Offer,
  RequisitionPriority,
} from "@/lib/types";

function inr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function RecruitmentPage() {
  const { currentSite, isAllSites } = useSite();
  const [active, setActive] = useState("requisitions");
  const { jobOpenings, applications, interviews, offers } = useRecruitment();
  const siteOpenings = useSiteFilter(jobOpenings);
  const siteApplications = useSiteFilter(applications);
  const siteInterviews = useSiteFilter(interviews);
  const siteOffers = useSiteFilter(offers);
  const funnel = useMemo(() => getRecruitmentFunnelReport(siteOpenings, siteApplications, siteOffers), [siteOpenings, siteApplications, siteOffers]);
  const interviewsToday = useMemo(() => getInterviewsOnDate(siteInterviews, todayStr()).length, [siteInterviews]);

  const tabs = [
    { id: "requisitions", label: "Requisitions" },
    { id: "openings", label: "Openings" },
    { id: "candidates", label: "Candidates" },
    { id: "interviews", label: "Interviews" },
    { id: "offers", label: "Offers" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recruitment"
        description={
          isAllSites
            ? "Manpower requisitions, job openings and the hiring pipeline across all sites"
            : `Hiring at ${currentSite?.name}`
        }
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Open Positions" value={funnel.openPositions.toString()} icon={Briefcase} tone="indigo" />
        <StatCard label="Active Candidates" value={funnel.activeCandidates.toString()} icon={Users2} tone="sky" />
        <StatCard label="Interviews Today" value={interviewsToday.toString()} icon={CalendarPlus} tone="amber" />
        <StatCard label="Offers Pending" value={funnel.offersPending.toString()} icon={FileSignature} tone="amber" />
        <StatCard label="Offers Accepted" value={funnel.offersAccepted.toString()} icon={Check} tone="emerald" />
        <StatCard label="Positions Filled" value={funnel.positionsFilled.toString()} icon={ClipboardCheck} tone="emerald" />
      </div>
      <Tabs tabs={tabs} active={active} onChange={setActive} />
      {active === "requisitions" && <RequisitionsTab />}
      {active === "openings" && <OpeningsTab />}
      {active === "candidates" && <CandidatesTab />}
      {active === "interviews" && <InterviewsTab />}
      {active === "offers" && <OffersTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Requisitions                                                        */
/* ------------------------------------------------------------------ */

function RequisitionsTab() {
  const { sites, currentSiteId, isAllSites } = useSite();
  const { employees } = useEmployees();
  const { orgUnits } = useOrg();
  const { records: masterRecords } = useMasters();
  const toast = useToast();
  const { requisitions, visibleRequisitions, canCreateRequisitions, canDecideRequisition, createRequisition, decideRequisition } = useRecruitment();

  const filtered = useSiteFilter(visibleRequisitions());
  const [modalOpen, setModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const deptName = (id?: string) => (id ? orgUnits.find((u) => u.id === id)?.name : undefined) ?? "—";
  const designationName = (id?: string) => (id ? masterRecords.find((m) => m.id === id)?.name : undefined) ?? "—";
  const employeeName = (id?: string) => (id ? employees.find((e) => e.employeeId === id)?.name : undefined) ?? "—";

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const siteId = String(form.get("siteId") ?? (isAllSites ? sites[0]?.id : currentSiteId));
    const skills = String(form.get("requiredSkills") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const result = createRequisition({
      siteId,
      departmentId: String(form.get("departmentId") ?? "") || undefined,
      designationId: String(form.get("designationId") ?? "") || undefined,
      gradeId: String(form.get("gradeId") ?? "") || undefined,
      employmentTypeId: String(form.get("employmentTypeId") ?? "") || undefined,
      employeeTypeId: String(form.get("employeeTypeId") ?? "") || undefined,
      positions: Number(form.get("positions") ?? 1),
      hiringManagerId: String(form.get("hiringManagerId") ?? "") || undefined,
      requiredSkills: skills.length ? skills : undefined,
      minExperienceYears: form.get("minExperienceYears") ? Number(form.get("minExperienceYears")) : undefined,
      maxExperienceYears: form.get("maxExperienceYears") ? Number(form.get("maxExperienceYears")) : undefined,
      salaryRangeMin: form.get("salaryRangeMin") ? Number(form.get("salaryRangeMin")) : undefined,
      salaryRangeMax: form.get("salaryRangeMax") ? Number(form.get("salaryRangeMax")) : undefined,
      priority: (String(form.get("priority") ?? "Medium") as RequisitionPriority),
      targetJoiningDate: String(form.get("targetJoiningDate") ?? "") || undefined,
      reasonForHiring: String(form.get("reasonForHiring") ?? ""),
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      setModalOpen(false);
      e.currentTarget.reset();
    }
  }

  function handleReject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rejectTarget) return;
    const form = new FormData(e.currentTarget);
    const result = decideRequisition(rejectTarget, "REJECT", String(form.get("reason") ?? ""));
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setRejectTarget(null);
  }

  const siteDepartments = orgUnits.filter((u) => u.type === "Department");
  const designations = masterRecords.filter((m) => m.masterType === "Designation");
  const grades = masterRecords.filter((m) => m.masterType === "JobGrade");
  const employmentTypes = masterRecords.filter((m) => m.masterType === "EmploymentType");
  const employeeTypes = masterRecords.filter((m) => m.masterType === "EmployeeType");
  const viewing = viewingId ? requisitions.find((r) => r.id === viewingId) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Can feature="recruitment.requisitions" action="create">
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Raise Requisition
          </Button>
        </Can>
      </div>

      <Card>
        <Table>
          <THead>
            <Th>Requisition</Th>
            <Th>Designation</Th>
            <Th>Department</Th>
            <Th>Positions</Th>
            <Th>Priority</Th>
            <Th>Status</Th>
            <Th>Requested By</Th>
            <Th>Actions</Th>
          </THead>
          <TBody>
            {filtered.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium text-slate-800 dark:text-slate-100">{r.id}</Td>
                <Td>{designationName(r.designationId)}</Td>
                <Td>{deptName(r.departmentId)}</Td>
                <Td>{r.positions}</Td>
                <Td>{r.priority}</Td>
                <Td>
                  <StatusBadge status={r.status} />
                </Td>
                <Td>{r.requestedByName}</Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setViewingId(r.id)} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                      View
                    </button>
                    {r.status === "Pending Approval" && canDecideRequisition(r.id) && (
                      <>
                        <button
                          onClick={() => {
                            const result = decideRequisition(r.id, "APPROVE");
                            (result.ok ? toast.success : toast.error)(result.message);
                          }}
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400"
                        >
                          <Check className="h-3 w-3" /> Approve
                        </button>
                        <button
                          onClick={() => setRejectTarget(r.id)}
                          className="flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400"
                        >
                          <X className="h-3 w-3" /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
            {filtered.length === 0 && <EmptyRow colSpan={8}>No job requisitions yet. Raise one to start hiring.</EmptyRow>}
          </TBody>
        </Table>
        <TableFootnote>
          Showing 1 to {filtered.length} of {filtered.length} entries
        </TableFootnote>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Raise Job Requisition">
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
          <div className="grid grid-cols-2 gap-4">
            <Field label="Department">
              <Select name="departmentId" defaultValue="">
                <option value="">— Not specified —</option>
                {siteDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Designation">
              <Select name="designationId" defaultValue="">
                <option value="">— Not specified —</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Grade">
              <Select name="gradeId" defaultValue="">
                <option value="">— Any —</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Employment Type">
              <Select name="employmentTypeId" defaultValue="">
                <option value="">— Any —</option>
                {employmentTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Employee Type">
              <Select name="employeeTypeId" defaultValue="">
                <option value="">— Any —</option>
                {employeeTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Number of Positions">
              <Input name="positions" type="number" min={1} required defaultValue={1} />
            </Field>
            <Field label="Hiring Manager">
              <Select name="hiringManagerId" defaultValue="">
                <option value="">— Not specified —</option>
                {employees.map((e) => (
                  <option key={e.employeeId} value={e.employeeId}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Required Skills (comma separated)">
            <Input name="requiredSkills" placeholder="e.g. React, Node.js, PostgreSQL" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Min Experience (yrs)">
              <Input name="minExperienceYears" type="number" min={0} />
            </Field>
            <Field label="Max Experience (yrs)">
              <Input name="maxExperienceYears" type="number" min={0} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Salary Range Min (CTC)">
              <Input name="salaryRangeMin" type="number" min={0} />
            </Field>
            <Field label="Salary Range Max (CTC)">
              <Input name="salaryRangeMax" type="number" min={0} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Priority">
              <Select name="priority" defaultValue="Medium">
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Urgent</option>
              </Select>
            </Field>
            <Field label="Target Joining Date">
              <Input name="targetJoiningDate" type="date" />
            </Field>
          </div>
          <Field label="Reason for Hiring">
            <Textarea name="reasonForHiring" rows={3} required placeholder="e.g. Backfill for attrition / new project ramp-up" />
          </Field>
          <p className="text-xs text-slate-400 dark:text-slate-500">Sent for approval — Reporting Manager, then HR.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit for Approval</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} title="Reject Requisition">
        <form className="space-y-4" onSubmit={handleReject}>
          <Field label="Reason">
            <Textarea name="reason" rows={3} required placeholder="Why is this requisition being rejected?" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger">
              Reject
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(viewing)} onClose={() => setViewingId(null)} title={viewing?.id ?? ""}>
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusBadge status={viewing.status} />
              <span className="text-xs text-slate-400 dark:text-slate-500">{viewing.priority} priority</span>
            </div>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <div>
                <dt className="text-slate-400 dark:text-slate-500">Designation</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">{designationName(viewing.designationId)}</dd>
              </div>
              <div>
                <dt className="text-slate-400 dark:text-slate-500">Department</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">{deptName(viewing.departmentId)}</dd>
              </div>
              <div>
                <dt className="text-slate-400 dark:text-slate-500">Positions</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">{viewing.positions}</dd>
              </div>
              <div>
                <dt className="text-slate-400 dark:text-slate-500">Hiring Manager</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">{employeeName(viewing.hiringManagerId)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-400 dark:text-slate-500">Reason for Hiring</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">{viewing.reasonForHiring}</dd>
              </div>
            </dl>
            <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Activity</p>
              <RequisitionAuditTrail requisitionId={viewing.id} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function RequisitionAuditTrail({ requisitionId }: { requisitionId: string }) {
  const { auditFor } = useRecruitment();
  const entries = auditFor("Requisition", requisitionId);
  if (entries.length === 0) return <p className="text-sm text-slate-400 dark:text-slate-500">No activity yet.</p>;
  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <div key={e.id} className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-200">{e.actorName}</span> — {e.detail}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Openings + Pipeline                                                 */
/* ------------------------------------------------------------------ */

function OpeningsTab() {
  const { sites, currentSiteId, isAllSites } = useSite();
  const { orgUnits } = useOrg();
  const { records: masterRecords } = useMasters();
  const toast = useToast();
  const { jobOpenings, requisitions, applicationsForOpening, canManageOpenings, createJobOpening, setJobOpeningStatus } = useRecruitment();

  const filtered = useSiteFilter(jobOpenings);
  const [modalOpen, setModalOpen] = useState(false);
  const [requisitionChoice, setRequisitionChoice] = useState("");
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);

  const approvedRequisitions = requisitions.filter((r) => r.status === "Approved");
  const siteDepartments = orgUnits.filter((u) => u.type === "Department");
  const designations = masterRecords.filter((m) => m.masterType === "Designation");
  const employmentTypes = masterRecords.filter((m) => m.masterType === "EmploymentType");

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const skills = String(form.get("requiredSkills") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const result = createJobOpening({
      requisitionId: requisitionChoice || undefined,
      siteId: String(form.get("siteId") ?? (isAllSites ? sites[0]?.id : currentSiteId)),
      departmentId: String(form.get("departmentId") ?? "") || undefined,
      designationId: String(form.get("designationId") ?? "") || undefined,
      employmentTypeId: String(form.get("employmentTypeId") ?? "") || undefined,
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? "") || undefined,
      requiredSkills: skills.length ? skills : undefined,
      minExperienceYears: form.get("minExperienceYears") ? Number(form.get("minExperienceYears")) : undefined,
      maxExperienceYears: form.get("maxExperienceYears") ? Number(form.get("maxExperienceYears")) : undefined,
      salaryRangeMin: form.get("salaryRangeMin") ? Number(form.get("salaryRangeMin")) : undefined,
      salaryRangeMax: form.get("salaryRangeMax") ? Number(form.get("salaryRangeMax")) : undefined,
      location: String(form.get("location") ?? ""),
      openings: Number(form.get("openings") ?? 1),
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      setModalOpen(false);
      setRequisitionChoice("");
      e.currentTarget.reset();
    }
  }

  const selectedOpening = selectedOpeningId ? filtered.find((j) => j.id === selectedOpeningId) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Can feature="recruitment.openings" action="create">
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> New Opening
          </Button>
        </Can>
      </div>

      <Card>
        <Table>
          <THead>
            <Th>Job</Th>
            {isAllSites && <Th>Site</Th>}
            <Th>Location</Th>
            <Th>Openings</Th>
            <Th>Applications</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </THead>
          <TBody>
            {filtered.map((job) => (
              <Tr key={job.id} hoverable>
                <Td className="font-medium text-slate-800 dark:text-slate-100">{job.title}</Td>
                {isAllSites && <Td>{sites.find((s) => s.id === job.siteId)?.name ?? "—"}</Td>}
                <Td>{job.location}</Td>
                <Td>{job.openings}</Td>
                <Td>{applicationsForOpening(job.id).length}</Td>
                <Td>
                  <StatusBadge status={job.status} />
                </Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setSelectedOpeningId(selectedOpeningId === job.id ? null : job.id)}
                      className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {selectedOpeningId === job.id ? "Hide Pipeline" : "View Pipeline"}
                    </button>
                    {canManageOpenings && job.status !== "Closed" && job.status !== "Cancelled" && (
                      <Select
                        className="h-7 w-auto py-0 text-xs"
                        value={job.status}
                        onChange={(e) => {
                          const result = setJobOpeningStatus(job.id, e.target.value as JobOpeningStatus);
                          if (!result.ok) toast.error(result.message);
                        }}
                      >
                        {(["Draft", "Open", "On Hold", "Closed", "Cancelled"] as JobOpeningStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
            {filtered.length === 0 && <EmptyRow colSpan={isAllSites ? 7 : 6}>No job openings yet.</EmptyRow>}
          </TBody>
        </Table>
        <TableFootnote>
          Showing 1 to {filtered.length} of {filtered.length} entries
        </TableFootnote>
      </Card>

      {selectedOpening && <PipelinePanel opening={selectedOpening} />}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Job Opening">
        <form className="space-y-4" onSubmit={handleCreate}>
          <Field label="From Requisition (optional)">
            <Select value={requisitionChoice} onChange={(e) => setRequisitionChoice(e.target.value)}>
              <option value="">— Standalone opening —</option>
              {approvedRequisitions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} — {designations.find((d) => d.id === r.designationId)?.name ?? "Unassigned"} ({r.positions} position(s))
                </option>
              ))}
            </Select>
          </Field>
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
          <Field label="Job Title">
            <Input name="title" required placeholder="e.g. Senior Node.js Developer" />
          </Field>
          {!requisitionChoice && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Department">
                <Select name="departmentId" defaultValue="">
                  <option value="">— Not specified —</option>
                  {siteDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Employment Type">
                <Select name="employmentTypeId" defaultValue="">
                  <option value="">— Not specified —</option>
                  {employmentTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          <Field label="Description">
            <Textarea name="description" rows={3} placeholder="Role summary, responsibilities..." />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Location">
              <Input name="location" required placeholder="e.g. Noida" />
            </Field>
            <Field label="Openings">
              <Input name="openings" type="number" min={1} defaultValue={1} required />
            </Field>
          </div>
          <Field label="Required Skills (comma separated)">
            <Input name="requiredSkills" placeholder="e.g. React, Node.js" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Min Experience (yrs)">
              <Input name="minExperienceYears" type="number" min={0} />
            </Field>
            <Field label="Max Experience (yrs)">
              <Input name="maxExperienceYears" type="number" min={0} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Salary Range Min (CTC)">
              <Input name="salaryRangeMin" type="number" min={0} />
            </Field>
            <Field label="Salary Range Max (CTC)">
              <Input name="salaryRangeMax" type="number" min={0} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Opening</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function PipelinePanel({ opening }: { opening: JobOpening }) {
  const toast = useToast();
  const { candidateFor, applicationsForOpening, canManagePipeline, rejectApplication, withdrawApplication, moveApplicationStage } = useRecruitment();
  const applications = applicationsForOpening(opening.id);

  const [addOpen, setAddOpen] = useState(false);
  const [interviewTarget, setInterviewTarget] = useState<Application | null>(null);
  const [offerTarget, setOfferTarget] = useState<Application | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Application | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<Application | null>(null);

  function handleReject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rejectTarget) return;
    const form = new FormData(e.currentTarget);
    const result = rejectApplication(rejectTarget.id, String(form.get("reason") ?? ""));
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setRejectTarget(null);
  }

  function handleWithdraw(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!withdrawTarget) return;
    const form = new FormData(e.currentTarget);
    const result = withdrawApplication(withdrawTarget.id, String(form.get("reason") ?? ""));
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setWithdrawTarget(null);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Pipeline — {opening.title}</CardTitle>
        <Can feature="recruitment.pipeline" action="create">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Candidate
          </Button>
        </Can>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <THead>
            <Th>Candidate</Th>
            <Th>Stage</Th>
            <Th>Applied</Th>
            <Th>Actions</Th>
          </THead>
          <TBody>
            {applications.map((app) => {
              const candidate = candidateFor(app.candidateId);
              const forward = nextStagesFrom(app.stage).filter((s) => s !== "Rejected" && s !== "Withdrawn");
              return (
                <Tr key={app.id}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">
                    {candidate ? `${candidate.firstName} ${candidate.lastName}` : app.candidateId}
                    <p className="text-xs font-normal text-slate-400 dark:text-slate-500">{candidate?.email}</p>
                  </Td>
                  <Td>
                    <StatusBadge status={app.stage} />
                  </Td>
                  <Td>{app.appliedDate}</Td>
                  <Td>
                    {canManagePipeline && (
                      <div className="flex flex-wrap items-center gap-2">
                        {forward.includes("Screening") && (
                          <button onClick={() => moveApplicationStage(app.id, "Screening")} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                            Move to Screening
                          </button>
                        )}
                        {forward.includes("Interview") && (
                          <button onClick={() => setInterviewTarget(app)} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                            <CalendarPlus className="h-3 w-3" /> Schedule Interview
                          </button>
                        )}
                        {forward.includes("Selected") && (
                          <button onClick={() => moveApplicationStage(app.id, "Selected")} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                            Mark Selected
                          </button>
                        )}
                        {forward.includes("Offer") && (
                          <button onClick={() => setOfferTarget(app)} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                            <FileSignature className="h-3 w-3" /> Create Offer
                          </button>
                        )}
                        {nextStagesFrom(app.stage).includes("Rejected") && (
                          <button onClick={() => setRejectTarget(app)} className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400">
                            Reject
                          </button>
                        )}
                        {nextStagesFrom(app.stage).includes("Withdrawn") && (
                          <button onClick={() => setWithdrawTarget(app)} className="text-xs font-medium text-slate-500 hover:underline dark:text-slate-400">
                            Withdraw
                          </button>
                        )}
                      </div>
                    )}
                  </Td>
                </Tr>
              );
            })}
            {applications.length === 0 && <EmptyRow colSpan={4}>No candidates in this pipeline yet.</EmptyRow>}
          </TBody>
        </Table>
      </CardContent>

      <AddCandidateModal open={addOpen} onClose={() => setAddOpen(false)} jobOpeningId={opening.id} siteId={opening.siteId} />
      {interviewTarget && <ScheduleInterviewModal application={interviewTarget} onClose={() => setInterviewTarget(null)} />}
      {offerTarget && <CreateOfferModal application={offerTarget} onClose={() => setOfferTarget(null)} />}

      <Modal open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} title="Reject Application">
        <form className="space-y-4" onSubmit={handleReject}>
          <Field label="Reason">
            <Textarea name="reason" rows={3} required placeholder="e.g. Skills mismatch" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger">
              Reject
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(withdrawTarget)} onClose={() => setWithdrawTarget(null)} title="Withdraw Application">
        <form className="space-y-4" onSubmit={handleWithdraw}>
          <Field label="Reason (optional)">
            <Textarea name="reason" rows={3} placeholder="e.g. Candidate accepted another offer" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setWithdrawTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger">
              Withdraw
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

function AddCandidateModal({ open, onClose, jobOpeningId, siteId }: { open: boolean; onClose: () => void; jobOpeningId: string; siteId: string }) {
  const toast = useToast();
  const { records: masterRecords } = useMasters();
  const { applyToJob } = useRecruitment();
  const sources = masterRecords.filter((m) => m.masterType === "RecruitmentSource");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const skills = String(form.get("skills") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const result = applyToJob(
      {
        firstName: String(form.get("firstName") ?? ""),
        lastName: String(form.get("lastName") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        currentCompany: String(form.get("currentCompany") ?? "") || undefined,
        currentDesignation: String(form.get("currentDesignation") ?? "") || undefined,
        totalExperienceYears: form.get("totalExperienceYears") ? Number(form.get("totalExperienceYears")) : undefined,
        expectedSalary: form.get("expectedSalary") ? Number(form.get("expectedSalary")) : undefined,
        noticePeriodDays: form.get("noticePeriodDays") ? Number(form.get("noticePeriodDays")) : undefined,
        skills: skills.length ? skills : undefined,
        sourceId: String(form.get("sourceId") ?? "") || undefined,
        siteId,
      },
      jobOpeningId,
    );
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      onClose();
      e.currentTarget.reset();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Candidate">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name">
            <Input name="firstName" required />
          </Field>
          <Field label="Last Name">
            <Input name="lastName" required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email">
            <Input name="email" type="email" required />
          </Field>
          <Field label="Phone">
            <Input name="phone" required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Current Company">
            <Input name="currentCompany" />
          </Field>
          <Field label="Current Designation">
            <Input name="currentDesignation" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Total Exp (yrs)">
            <Input name="totalExperienceYears" type="number" min={0} step="0.5" />
          </Field>
          <Field label="Expected Salary">
            <Input name="expectedSalary" type="number" min={0} />
          </Field>
          <Field label="Notice (days)">
            <Input name="noticePeriodDays" type="number" min={0} />
          </Field>
        </div>
        <Field label="Skills (comma separated)">
          <Input name="skills" placeholder="e.g. React, Node.js" />
        </Field>
        <Field label="Source">
          <Select name="sourceId" defaultValue="">
            <option value="">— Not specified —</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-slate-400 dark:text-slate-500">If a candidate with this email or phone already exists, they'll be applied to this opening instead of creating a duplicate.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add & Apply</Button>
        </div>
      </form>
    </Modal>
  );
}

function ScheduleInterviewModal({ application, onClose }: { application: Application; onClose: () => void }) {
  const toast = useToast();
  const { employees } = useEmployees();
  const { scheduleInterview, interviewsForApplication } = useRecruitment();
  const round = interviewsForApplication(application.id).length + 1;
  const modes: InterviewMode[] = ["In-Person", "Video", "Phone"];

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const interviewerIds = Array.from(form.getAll("interviewerIds")).map(String);
    const result = scheduleInterview({
      applicationId: application.id,
      round,
      roundLabel: String(form.get("roundLabel") ?? `Round ${round}`),
      interviewerIds,
      scheduledDate: String(form.get("scheduledDate") ?? ""),
      scheduledTime: String(form.get("scheduledTime") ?? ""),
      mode: String(form.get("mode") ?? "Video") as InterviewMode,
      locationOrLink: String(form.get("locationOrLink") ?? "") || undefined,
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) onClose();
  }

  return (
    <Modal open onClose={onClose} title={`Schedule Interview — Round ${round}`}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field label="Round Label">
          <Input name="roundLabel" defaultValue={`Round ${round}`} required />
        </Field>
        <Field label="Interviewer(s)">
          <select name="interviewerIds" multiple required className="h-32 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            {employees.map((e) => (
              <option key={e.employeeId} value={e.employeeId}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date">
            <Input name="scheduledDate" type="date" required defaultValue={todayStr()} />
          </Field>
          <Field label="Time">
            <Input name="scheduledTime" type="time" required defaultValue="10:00" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Mode">
            <Select name="mode" defaultValue="Video">
              {modes.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label="Location / Meeting Link">
            <Input name="locationOrLink" placeholder="e.g. Meet link or Conference Room 2" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Schedule</Button>
        </div>
      </form>
    </Modal>
  );
}

function CreateOfferModal({ application, onClose }: { application: Application; onClose: () => void }) {
  const toast = useToast();
  const { orgUnits } = useOrg();
  const { records: masterRecords } = useMasters();
  const { createOffer } = useRecruitment();
  const designations = masterRecords.filter((m) => m.masterType === "Designation");
  const departments = orgUnits.filter((u) => u.type === "Department");
  const employmentTypes = masterRecords.filter((m) => m.masterType === "EmploymentType");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const ctcAnnual = Number(form.get("ctcAnnual") ?? 0);
    const basic = Math.round(ctcAnnual * 0.5);
    const hra = Math.round(basic * 0.4);
    const specialAllowance = Math.max(0, ctcAnnual - basic - hra);
    const result = createOffer({
      applicationId: application.id,
      designationId: String(form.get("designationId") ?? "") || undefined,
      departmentId: String(form.get("departmentId") ?? "") || undefined,
      employmentTypeId: String(form.get("employmentTypeId") ?? "") || undefined,
      joiningDate: String(form.get("joiningDate") ?? ""),
      ctcAnnual,
      earnings: [
        { componentId: "basic", label: "Basic", amount: Math.round(basic / 12) },
        { componentId: "hra", label: "HRA", amount: Math.round(hra / 12) },
        { componentId: "special-allowance", label: "Special Allowance", amount: Math.round(specialAllowance / 12) },
      ],
      deductions: [],
      probationPeriodMonths: form.get("probationPeriodMonths") ? Number(form.get("probationPeriodMonths")) : undefined,
      offerDate: todayStr(),
      expiryDate: String(form.get("expiryDate") ?? "") || undefined,
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) onClose();
  }

  return (
    <Modal open onClose={onClose} title="Create Offer">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Designation">
            <Select name="designationId" defaultValue="">
              <option value="">— Not specified —</option>
              {designations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Department">
            <Select name="departmentId" defaultValue="">
              <option value="">— Not specified —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Employment Type">
            <Select name="employmentTypeId" defaultValue="">
              <option value="">— Not specified —</option>
              {employmentTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Joining Date">
            <Input name="joiningDate" type="date" required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Annual CTC">
            <Input name="ctcAnnual" type="number" min={1} required />
          </Field>
          <Field label="Probation (months)">
            <Input name="probationPeriodMonths" type="number" min={0} defaultValue={3} />
          </Field>
        </div>
        <Field label="Offer Expiry Date (optional)">
          <Input name="expiryDate" type="date" />
        </Field>
        <p className="text-xs text-slate-400 dark:text-slate-500">Earnings breakup (Basic/HRA/Special Allowance) is derived automatically — the same default split Payroll uses.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create Offer</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Candidates                                                           */
/* ------------------------------------------------------------------ */

function CandidatesTab() {
  const { records: masterRecords } = useMasters();
  const { candidates, applications } = useRecruitment();
  const filtered = useSiteFilter(candidates);
  const sourceName = (id?: string) => (id ? masterRecords.find((m) => m.id === id)?.name : undefined) ?? "—";

  return (
    <Card>
      <Table>
        <THead>
          <Th>Candidate</Th>
          <Th>Email</Th>
          <Th>Phone</Th>
          <Th>Current Company</Th>
          <Th>Experience</Th>
          <Th>Source</Th>
          <Th>Applications</Th>
        </THead>
        <TBody>
          {filtered.map((c) => (
            <Tr key={c.id}>
              <Td className="font-medium text-slate-800 dark:text-slate-100">
                {c.firstName} {c.lastName}
              </Td>
              <Td>{c.email}</Td>
              <Td>{c.phone}</Td>
              <Td>{c.currentCompany ?? "—"}</Td>
              <Td>{c.totalExperienceYears != null ? `${c.totalExperienceYears} yrs` : "—"}</Td>
              <Td>{sourceName(c.sourceId)}</Td>
              <Td>{applications.filter((a) => a.candidateId === c.id).length}</Td>
            </Tr>
          ))}
          {filtered.length === 0 && <EmptyRow colSpan={7}>No candidates yet.</EmptyRow>}
        </TBody>
      </Table>
      <TableFootnote>
        Showing 1 to {filtered.length} of {filtered.length} entries
      </TableFootnote>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Interviews                                                           */
/* ------------------------------------------------------------------ */

function InterviewsTab() {
  const { employees } = useEmployees();
  const toast = useToast();
  const { interviews, applications, jobOpenings, candidateFor, canActOnInterview, submitInterviewFeedback } = useRecruitment();
  const filtered = useSiteFilter(interviews);
  const [feedbackTarget, setFeedbackTarget] = useState<Interview | null>(null);

  const jobTitleFor = (applicationId: string) => {
    const app = applications.find((a) => a.id === applicationId);
    return app ? jobOpenings.find((j) => j.id === app.jobOpeningId)?.title ?? "—" : "—";
  };

  function handleFeedback(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!feedbackTarget) return;
    const form = new FormData(e.currentTarget);
    const num = (key: string) => (form.get(key) ? Number(form.get(key)) : undefined);
    const result = submitInterviewFeedback(feedbackTarget.id, {
      technicalSkills: num("technicalSkills"),
      communication: num("communication"),
      problemSolving: num("problemSolving"),
      cultureFit: num("cultureFit"),
      overallRating: num("overallRating"),
      recommendation: (String(form.get("recommendation") ?? "") || undefined) as InterviewRecommendation | undefined,
      comments: String(form.get("comments") ?? "") || undefined,
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setFeedbackTarget(null);
  }

  const ratingOptions = [1, 2, 3, 4, 5];

  return (
    <Card>
      <Table>
        <THead>
          <Th>Candidate</Th>
          <Th>Job</Th>
          <Th>Round</Th>
          <Th>Date / Time</Th>
          <Th>Mode</Th>
          <Th>Interviewers</Th>
          <Th>Status</Th>
          <Th>Actions</Th>
        </THead>
        <TBody>
          {filtered.map((interview) => {
            const candidate = candidateFor(interview.candidateId);
            return (
              <Tr key={interview.id}>
                <Td className="font-medium text-slate-800 dark:text-slate-100">{candidate ? `${candidate.firstName} ${candidate.lastName}` : interview.candidateId}</Td>
                <Td>{jobTitleFor(interview.applicationId)}</Td>
                <Td>{interview.roundLabel}</Td>
                <Td>
                  {interview.scheduledDate} {interview.scheduledTime}
                </Td>
                <Td>{interview.mode}</Td>
                <Td>{interview.interviewerIds.map((id) => employees.find((e) => e.employeeId === id)?.name ?? id).join(", ")}</Td>
                <Td>
                  <StatusBadge status={interview.status} />
                </Td>
                <Td>
                  {interview.status === "Scheduled" && canActOnInterview(interview) && (
                    <button onClick={() => setFeedbackTarget(interview)} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                      <ClipboardCheck className="h-3.5 w-3.5" /> Submit Feedback
                    </button>
                  )}
                  {interview.status === "Completed" && interview.feedback && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {interview.feedback.recommendation ?? "Feedback recorded"} · {interview.feedback.overallRating ?? "—"}/5
                    </span>
                  )}
                </Td>
              </Tr>
            );
          })}
          {filtered.length === 0 && <EmptyRow colSpan={8}>No interviews scheduled yet.</EmptyRow>}
        </TBody>
      </Table>
      <TableFootnote>
        Showing 1 to {filtered.length} of {filtered.length} entries
      </TableFootnote>

      <Modal open={Boolean(feedbackTarget)} onClose={() => setFeedbackTarget(null)} title="Interview Feedback">
        {feedbackTarget && (
          <form className="space-y-4" onSubmit={handleFeedback}>
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: "technicalSkills", label: "Technical Skills" },
                { name: "communication", label: "Communication" },
                { name: "problemSolving", label: "Problem Solving" },
                { name: "cultureFit", label: "Culture / Team Fit" },
              ].map((f) => (
                <Field key={f.name} label={f.label}>
                  <Select name={f.name} defaultValue="">
                    <option value="">— Not rated —</option>
                    {ratingOptions.map((r) => (
                      <option key={r} value={r}>
                        {r} / 5
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
            <Field label="Overall Rating">
              <Select name="overallRating" defaultValue="">
                <option value="">— Not rated —</option>
                {ratingOptions.map((r) => (
                  <option key={r} value={r}>
                    {r} / 5
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Recommendation">
              <Select name="recommendation" defaultValue="">
                <option value="">— Not specified —</option>
                <option>Strong Hire</option>
                <option>Hire</option>
                <option>No Hire</option>
                <option>Strong No Hire</option>
              </Select>
            </Field>
            <Field label="Comments">
              <Textarea name="comments" rows={3} placeholder="Detailed notes for the panel..." />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFeedbackTarget(null)}>
                Cancel
              </Button>
              <Button type="submit">Submit Feedback</Button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Offers                                                                */
/* ------------------------------------------------------------------ */

function OffersTab() {
  const toast = useToast();
  const { offers, applications, jobOpenings, candidateFor, canManagePipeline, sendOffer, acceptOffer, rejectOffer, expireOffer, withdrawOffer } = useRecruitment();
  const filtered = useSiteFilter(offers);
  const [rejectTarget, setRejectTarget] = useState<Offer | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<Offer | null>(null);

  const jobTitleFor = (applicationId: string) => {
    const app = applications.find((a) => a.id === applicationId);
    return app ? jobOpenings.find((j) => j.id === app.jobOpeningId)?.title ?? "—" : "—";
  };

  function act(fn: () => { ok: boolean; message: string }) {
    const result = fn();
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleReject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rejectTarget) return;
    const form = new FormData(e.currentTarget);
    act(() => rejectOffer(rejectTarget.id, String(form.get("reason") ?? "")));
    setRejectTarget(null);
  }

  function handleWithdraw(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!withdrawTarget) return;
    const form = new FormData(e.currentTarget);
    act(() => withdrawOffer(withdrawTarget.id, String(form.get("reason") ?? "")));
    setWithdrawTarget(null);
  }

  return (
    <Card>
      <Table>
        <THead>
          <Th>Candidate</Th>
          <Th>Job</Th>
          <Th>CTC</Th>
          <Th>Joining Date</Th>
          <Th>Status</Th>
          <Th>Actions</Th>
        </THead>
        <TBody>
          {filtered.map((offer) => {
            const candidate = candidateFor(offer.candidateId);
            return (
              <Tr key={offer.id}>
                <Td className="font-medium text-slate-800 dark:text-slate-100">{candidate ? `${candidate.firstName} ${candidate.lastName}` : offer.candidateId}</Td>
                <Td>{jobTitleFor(offer.applicationId)}</Td>
                <Td>{inr(offer.ctcAnnual)}</Td>
                <Td>{offer.joiningDate}</Td>
                <Td>
                  <StatusBadge status={offer.status} />
                </Td>
                <Td>
                  {canManagePipeline && (
                    <div className="flex flex-wrap items-center gap-2">
                      {offer.status === "Draft" && (
                        <>
                          <button onClick={() => act(() => sendOffer(offer.id))} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                            Send
                          </button>
                          <button onClick={() => setWithdrawTarget(offer)} className="text-xs font-medium text-slate-500 hover:underline dark:text-slate-400">
                            Withdraw
                          </button>
                        </>
                      )}
                      {offer.status === "Sent" && (
                        <>
                          <button onClick={() => act(() => acceptOffer(offer.id))} className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400">
                            <Check className="h-3 w-3" /> Accept
                          </button>
                          <button onClick={() => setRejectTarget(offer)} className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400">
                            Reject
                          </button>
                          <button onClick={() => act(() => expireOffer(offer.id))} className="text-xs font-medium text-slate-500 hover:underline dark:text-slate-400">
                            Mark Expired
                          </button>
                          <button onClick={() => setWithdrawTarget(offer)} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:underline dark:text-slate-400">
                            <Ban className="h-3 w-3" /> Withdraw
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </Td>
              </Tr>
            );
          })}
          {filtered.length === 0 && <EmptyRow colSpan={6}>No offers yet.</EmptyRow>}
        </TBody>
      </Table>
      <TableFootnote>
        Showing 1 to {filtered.length} of {filtered.length} entries
      </TableFootnote>

      <Modal open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} title="Mark Offer Rejected">
        <form className="space-y-4" onSubmit={handleReject}>
          <Field label="Reason (optional)">
            <Textarea name="reason" rows={3} placeholder="e.g. Candidate declined — accepted another offer" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger">
              Mark Rejected
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(withdrawTarget)} onClose={() => setWithdrawTarget(null)} title="Withdraw Offer">
        <form className="space-y-4" onSubmit={handleWithdraw}>
          <Field label="Reason (optional)">
            <Textarea name="reason" rows={3} placeholder="e.g. Position no longer available" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setWithdrawTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger">
              Withdraw
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

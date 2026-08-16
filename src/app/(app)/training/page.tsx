"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, GraduationCap, Users2, ClipboardCheck, AlertTriangle, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { EmptyRow, TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { useSite, useSiteFilter } from "@/lib/site-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useEmployees } from "@/lib/employee-context";
import { useMasters } from "@/lib/master-context";
import { useSkills } from "@/lib/skills-context";
import { useTraining } from "@/lib/training-context";
import { useToast } from "@/lib/toast-context";
import { activeEnrollmentCount, getTrainingCompletionSummary } from "@/lib/training-engine";
import type { TrainingMode } from "@/lib/types";

function formatDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function TrainingPage() {
  const { sites, currentSiteId, currentSite, isAllSites } = useSite();
  const { currentUser } = useAccessControl();
  const { employees } = useEmployees();
  const { recordsOfType } = useMasters();
  const {
    programs,
    canManagePrograms,
    createProgram,
    enrollments,
    enrollmentsForEmployee,
    requests,
    requestsFor,
    visibleRequests,
    canDecideRequests,
    decideTrainingRequest,
    requirements,
    canManageRequirements,
    createRequirement,
    trainingNeedsFor,
  } = useTraining();

  const filteredPrograms = useSiteFilter(programs);
  const scopedEnrollments = useSiteFilter(enrollments);
  const scopedEmployees = useSiteFilter(employees);
  // visibleRequests() is role-scoped only (like visibleCases/visibleRequisitions
  // elsewhere) — useSiteFilter is what actually narrows it to the current site,
  // same two-layer pattern the Offboarding page already uses.
  const scopedVisibleRequests = useSiteFilter(visibleRequests());

  const isManager = useMemo(() => employees.some((e) => e.reportingManagerId === currentUser.employeeId), [employees, currentUser.employeeId]);
  const teamMembers = useMemo(() => employees.filter((e) => e.reportingManagerId === currentUser.employeeId), [employees, currentUser.employeeId]);

  const myEnrollments = enrollmentsForEmployee(currentUser.employeeId);
  const myRequests = requestsFor(currentUser.employeeId);
  const myTrainingNeeds = trainingNeedsFor(currentUser.employeeId);

  const completion = useMemo(() => getTrainingCompletionSummary(scopedEnrollments), [scopedEnrollments]);
  const pendingRequestsForScope = scopedVisibleRequests.filter((r) => r.status === "Pending");
  const upcomingSessionsCount = filteredPrograms.filter((p) => p.status === "Published" || p.status === "In Progress").length;

  const tabs = [
    { id: "programs", label: "Programs" },
    { id: "my-training", label: "My Training" },
    ...(canDecideRequests || isManager ? [{ id: "requests", label: "Requests" }] : []),
    ...(canManagePrograms || isManager ? [{ id: "skill-gaps", label: "Skill Gaps" }] : []),
  ];
  const [active, setActive] = useState("programs");
  const [modalOpen, setModalOpen] = useState(false);
  const [requirementModalOpen, setRequirementModalOpen] = useState(false);
  const toast = useToast();

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = createProgram({
      siteId: String(form.get("siteId") ?? (isAllSites ? sites[0]?.id : currentSiteId)),
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? "") || undefined,
      categoryId: String(form.get("categoryId") ?? "") || undefined,
      trainerId: String(form.get("trainerId") ?? "") || undefined,
      durationHours: form.get("durationHours") ? Number(form.get("durationHours")) : undefined,
      mode: String(form.get("mode") ?? "Classroom") as TrainingMode,
      startDate: String(form.get("startDate") ?? ""),
      endDate: String(form.get("endDate") ?? ""),
      capacity: Number(form.get("capacity") ?? 0),
      programCost: form.get("programCost") ? Number(form.get("programCost")) : undefined,
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      setModalOpen(false);
      e.currentTarget.reset();
    }
  }

  function handleDecide(id: string, decision: "Approved" | "Rejected") {
    let comment: string | undefined;
    if (decision === "Rejected") {
      comment = window.prompt("Reason for rejecting this request?") ?? "";
      if (!comment.trim()) return;
    }
    const result = decideTrainingRequest(id, decision, comment);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training"
        description={isAllSites ? "Programs, skills and training requests across all sites" : `Training programs at ${currentSite?.name}`}
        action={
          canManagePrograms && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> Add Training Program
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {canManagePrograms ? (
          <>
            <StatCard label="Active Programs" value={String(filteredPrograms.filter((p) => p.status !== "Cancelled" && p.status !== "Completed").length)} icon={GraduationCap} tone="indigo" />
            <StatCard label="Employees in Training" value={String(completion.inProgress)} icon={Users2} tone="sky" />
            <StatCard label="Pending Requests" value={String(pendingRequestsForScope.length)} icon={AlertTriangle} tone="amber" />
            <StatCard label="Completion %" value={`${completion.completionPct}%`} icon={ClipboardCheck} tone="emerald" />
          </>
        ) : isManager ? (
          <>
            <StatCard label="Team Training" value={String(teamMembers.length)} icon={Users2} tone="indigo" />
            <StatCard label="Pending Team Requests" value={String(pendingRequestsForScope.length)} icon={AlertTriangle} tone="amber" />
            <StatCard label="Skill Gaps" value={String(teamMembers.reduce((sum, m) => sum + trainingNeedsFor(m.employeeId).length, 0))} icon={ClipboardCheck} tone="rose" />
          </>
        ) : (
          <>
            <StatCard label="My Training" value={String(myEnrollments.filter((e) => e.status !== "Cancelled").length)} icon={GraduationCap} tone="indigo" />
            <StatCard label="Upcoming Training" value={String(myEnrollments.filter((e) => e.status === "Registered" || e.status === "Approved").length)} icon={CalendarClock} tone="sky" />
            <StatCard label="Completed Training" value={String(myEnrollments.filter((e) => e.status === "Completed").length)} icon={ClipboardCheck} tone="emerald" />
            <StatCard label="Pending Requests" value={String(myRequests.filter((r) => r.status === "Pending").length)} icon={AlertTriangle} tone="amber" />
          </>
        )}
      </div>

      <Tabs tabs={tabs} active={active} onChange={setActive} />

      {active === "programs" && (
        <Card>
          <Table>
            <THead>
              <Th>Program</Th>
              <Th>Category</Th>
              {isAllSites && <Th>Site</Th>}
              <Th>Trainer</Th>
              <Th>Mode</Th>
              <Th>Duration</Th>
              <Th>Enrolled</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {filteredPrograms.map((p) => {
                const enrolledCount = activeEnrollmentCount(enrollments, p.id);
                const category = p.categoryId ? recordsOfType("TrainingCategory").find((c) => c.id === p.categoryId)?.name : undefined;
                const trainer = p.trainerId ? employees.find((e) => e.employeeId === p.trainerId)?.name : undefined;
                return (
                  <Tr key={p.id} hoverable>
                    <Td>
                      <Link href={`/training/${p.id}`} className="font-medium text-slate-800 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400">
                        {p.name}
                      </Link>
                    </Td>
                    <Td>{category ?? "—"}</Td>
                    {isAllSites && <Td>{sites.find((s) => s.id === p.siteId)?.name ?? "—"}</Td>}
                    <Td>{trainer ?? "—"}</Td>
                    <Td>{p.mode}</Td>
                    <Td>
                      {formatDate(p.startDate)} – {formatDate(p.endDate)}
                    </Td>
                    <Td>
                      {enrolledCount}/{p.capacity}
                      {enrolledCount >= p.capacity && <span className="ml-1 text-xs text-rose-500">Full</span>}
                    </Td>
                    <Td>
                      <StatusBadge status={p.status} />
                    </Td>
                  </Tr>
                );
              })}
              {filteredPrograms.length === 0 && <EmptyRow colSpan={isAllSites ? 8 : 7}>No training programs configured.</EmptyRow>}
            </TBody>
          </Table>
          <TableFootnote>
            Showing 1 to {filteredPrograms.length} of {filteredPrograms.length} entries
          </TableFootnote>
        </Card>
      )}

      {active === "my-training" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Enrollments</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <THead>
                  <Th>Program</Th>
                  <Th>Status</Th>
                  <Th>Result</Th>
                  <Th>Completion Date</Th>
                </THead>
                <TBody>
                  {myEnrollments.map((e) => {
                    const program = programs.find((p) => p.id === e.trainingProgramId);
                    return (
                      <Tr key={e.id}>
                        <Td className="font-medium text-slate-800 dark:text-slate-100">
                          {program ? <Link href={`/training/${program.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">{program.name}</Link> : "—"}
                        </Td>
                        <Td>
                          <StatusBadge status={e.status} />
                        </Td>
                        <Td>{e.result ? <StatusBadge status={e.result} /> : "—"}</Td>
                        <Td>{e.completionDate ?? "—"}</Td>
                      </Tr>
                    );
                  })}
                  {myEnrollments.length === 0 && <EmptyRow colSpan={4}>No training assigned.</EmptyRow>}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>My Requests</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <THead>
                  <Th>Program</Th>
                  <Th>Reason</Th>
                  <Th>Requested Date</Th>
                  <Th>Status</Th>
                </THead>
                <TBody>
                  {myRequests.map((r) => {
                    const program = programs.find((p) => p.id === r.trainingProgramId);
                    return (
                      <Tr key={r.id}>
                        <Td className="font-medium text-slate-800 dark:text-slate-100">{program?.name ?? "—"}</Td>
                        <Td>{r.reason}</Td>
                        <Td>{r.requestedDate}</Td>
                        <Td>
                          <StatusBadge status={r.status} />
                        </Td>
                      </Tr>
                    );
                  })}
                  {myRequests.length === 0 && <EmptyRow colSpan={4}>No training requests yet.</EmptyRow>}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {active === "requests" && (canDecideRequests || isManager) && (
        <Card>
          <Table>
            <THead>
              <Th>Employee</Th>
              <Th>Program</Th>
              <Th>Reason</Th>
              <Th>Requested Date</Th>
              <Th>Status</Th>
              <Th></Th>
            </THead>
            <TBody>
              {scopedVisibleRequests.map((r) => {
                const program = programs.find((p) => p.id === r.trainingProgramId);
                const employee = employees.find((e) => e.employeeId === r.employeeId);
                return (
                  <Tr key={r.id}>
                    <Td className="font-medium text-slate-800 dark:text-slate-100">{employee?.name ?? r.employeeId}</Td>
                    <Td>{program?.name ?? "—"}</Td>
                    <Td>{r.reason}</Td>
                    <Td>{r.requestedDate}</Td>
                    <Td>
                      <StatusBadge status={r.status} />
                    </Td>
                    <Td>
                      {r.status === "Pending" && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => handleDecide(r.id, "Approved")}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDecide(r.id, "Rejected")}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </Td>
                  </Tr>
                );
              })}
              {scopedVisibleRequests.length === 0 && <EmptyRow colSpan={6}>No training requests to show.</EmptyRow>}
            </TBody>
          </Table>
        </Card>
      )}

      {active === "skill-gaps" && (canManagePrograms || isManager) && (
        <SkillGapsTab
          employees={canManagePrograms ? scopedEmployees : teamMembers}
          canManageRequirements={canManageRequirements}
          onAddRequirement={() => setRequirementModalOpen(true)}
        />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Training Program">
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
          <Field label="Program Name">
            <Input name="name" required placeholder="e.g. React Advanced Patterns" />
          </Field>
          <Field label="Description (optional)">
            <Textarea name="description" rows={2} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <Select name="categoryId" defaultValue="">
                <option value="">— None —</option>
                {recordsOfType("TrainingCategory").map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Mode">
              <Select name="mode" required defaultValue="Classroom">
                <option value="Classroom">Classroom</option>
                <option value="Online">Online</option>
                <option value="Hybrid">Hybrid</option>
                <option value="On-the-job">On-the-job</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Trainer (optional)">
              <Select name="trainerId" defaultValue="">
                <option value="">— Not assigned —</option>
                {employees.map((e) => (
                  <option key={e.employeeId} value={e.employeeId}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Duration (hours)">
              <Input name="durationHours" type="number" min={1} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date">
              <Input name="startDate" type="date" required />
            </Field>
            <Field label="End Date">
              <Input name="endDate" type="date" required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Capacity">
              <Input name="capacity" type="number" min={1} required defaultValue={20} />
            </Field>
            <Field label="Program Cost (optional, ₹)">
              <Input name="programCost" type="number" min={0} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Training Program</Button>
          </div>
        </form>
      </Modal>

      {requirementModalOpen && (
        <AddRequirementModal
          onClose={() => setRequirementModalOpen(false)}
          createRequirement={createRequirement}
          siteId={isAllSites ? sites[0]?.id ?? "" : currentSiteId ?? ""}
        />
      )}
    </div>
  );
}

function SkillGapsTab({
  employees,
  canManageRequirements,
  onAddRequirement,
}: {
  employees: ReturnType<typeof useEmployees>["employees"];
  canManageRequirements: boolean;
  onAddRequirement: () => void;
}) {
  const { trainingNeedsFor, programs } = useTraining();
  const { recordsOfType } = useMasters();
  const skillName = (id: string) => recordsOfType("Skill").find((s) => s.id === id)?.name ?? id;
  const levelName = (id?: string) => (id ? recordsOfType("SkillLevel").find((l) => l.id === id)?.name : "—");

  const rows = employees.flatMap((e) => trainingNeedsFor(e.employeeId).map((need) => ({ employee: e, need })));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Skill Gaps &amp; Training Needs</CardTitle>
        {canManageRequirements && (
          <Button size="sm" variant="outline" onClick={onAddRequirement}>
            <Plus className="h-3.5 w-3.5" /> Add Requirement
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <THead>
            <Th>Employee</Th>
            <Th>Skill</Th>
            <Th>Current Level</Th>
            <Th>Required Level</Th>
            <Th>Gap</Th>
            <Th>Recommended Training</Th>
          </THead>
          <TBody>
            {rows.map((r, i) => {
              const recommended = r.need.recommendedTrainingProgramId ? programs.find((p) => p.id === r.need.recommendedTrainingProgramId) : undefined;
              return (
                <Tr key={`${r.employee.employeeId}-${r.need.skillId}-${i}`}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{r.employee.name}</Td>
                  <Td>{skillName(r.need.skillId)}</Td>
                  <Td>{levelName(r.need.currentSkillLevelId) ?? "Not assessed"}</Td>
                  <Td>{levelName(r.need.requiredSkillLevelId)}</Td>
                  <Td>{r.need.gap}</Td>
                  <Td>{recommended ? <Link href={`/training/${recommended.id}`} className="text-indigo-600 hover:underline dark:text-indigo-400">{recommended.name}</Link> : "—"}</Td>
                </Tr>
              );
            })}
            {rows.length === 0 && <EmptyRow colSpan={6}>No skill gaps identified.</EmptyRow>}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AddRequirementModal({
  onClose,
  createRequirement,
  siteId,
}: {
  onClose: () => void;
  createRequirement: ReturnType<typeof useTraining>["createRequirement"];
  siteId: string;
}) {
  const { recordsOfType } = useMasters();
  const { programs } = useTraining();
  const toast = useToast();
  const [scope, setScope] = useState<"Employee" | "Department" | "Designation" | "Grade" | "Skill">("Designation");
  const { employees } = useEmployees();
  const designations = recordsOfType("Designation").filter((d) => !d.siteId || d.siteId === siteId);
  const grades = recordsOfType("JobGrade").filter((g) => !g.siteId || g.siteId === siteId);
  const siteEmployees = employees.filter((e) => e.siteId === siteId);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = createRequirement({
      siteId,
      scope,
      targetId: String(form.get("targetId") ?? ""),
      requiredSkillId: String(form.get("requiredSkillId") ?? ""),
      requiredSkillLevelId: String(form.get("requiredSkillLevelId") ?? ""),
      requiredTrainingProgramId: String(form.get("requiredTrainingProgramId") ?? "") || undefined,
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) onClose();
  }

  return (
    <Modal open onClose={onClose} title="Add Training Requirement">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field label="Applies To">
          <Select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
            <option value="Designation">Designation</option>
            <option value="Department">Department</option>
            <option value="Grade">Grade</option>
            <option value="Employee">Specific Employee</option>
          </Select>
        </Field>
        <Field label={scope === "Designation" ? "Designation" : scope === "Grade" ? "Grade" : scope === "Employee" ? "Employee" : "Department"}>
          <Select name="targetId" required defaultValue="">
            <option value="" disabled>
              Select {scope.toLowerCase()}
            </option>
            {scope === "Designation" && designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            {scope === "Grade" && grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            {scope === "Employee" && siteEmployees.map((e) => <option key={e.employeeId} value={e.employeeId}>{e.name}</option>)}
            {scope === "Department" && recordsOfType("Department").filter((d) => !d.siteId || d.siteId === siteId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Required Skill">
            <Select name="requiredSkillId" required defaultValue="">
              <option value="" disabled>
                Select skill
              </option>
              {recordsOfType("Skill").map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Required Level">
            <Select name="requiredSkillLevelId" required defaultValue="">
              <option value="" disabled>
                Select level
              </option>
              {recordsOfType("SkillLevel").map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Recommended Training (optional)">
          <Select name="requiredTrainingProgramId" defaultValue="">
            <option value="">— None —</option>
            {programs.filter((p) => p.siteId === siteId).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add Requirement</Button>
        </div>
      </form>
    </Modal>
  );
}

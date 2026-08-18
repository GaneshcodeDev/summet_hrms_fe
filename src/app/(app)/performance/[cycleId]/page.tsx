"use client";

import { Fragment, use, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyRow, TBody, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { useSite } from "@/lib/site-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useEmployees } from "@/lib/employee-context";
import { useMasters } from "@/lib/master-context";
import { usePayroll } from "@/lib/payroll-context";
import { usePerformance } from "@/lib/performance-context";
import { useToast } from "@/lib/toast-context";
import { nextCycleStatus } from "@/lib/performance-engine";
import type { AppraisalDecision, Employee, GoalScope, PerformanceCycle, PerformanceCycleStatus, PerformanceGoal, PerformanceReviewCase } from "@/lib/types";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PerformanceCycleDetailPage(props: PageProps<"/performance/[cycleId]">) {
  const { cycleId } = use(props.params);
  const { currentUser } = useAccessControl();
  const { mappedSites, isSuperAdmin } = useSite();
  const { employees, getEmployeeByEmployeeId } = useEmployees();
  const { cycleById, canManageCycles, advanceCycleStatus, isDirectManagerOf, canManageAllReviews, canManageAppraisal, canApproveAppraisal, caseFor, reviewCases, goals } =
    usePerformance();
  const toast = useToast();

  const cycle = cycleById(cycleId);
  if (!cycle) notFound();
  // Same boundary as the Employee Profile direct-URL fix (Phase 12) — a
  // non-Super-Admin typing another site's cycle URL gets a 404, not a peek.
  if (!isSuperAdmin && !mappedSites.some((s) => s.id === cycle.siteId)) notFound();

  const myCase = caseFor(currentUser.employeeId, cycleId);
  const teamMembers = employees.filter((e) => isDirectManagerOf(e.employeeId));
  const isManager = teamMembers.length > 0;
  const canSeeAllReviews = canManageAllReviews || canManageCycles;
  const canSeeAppraisals = canManageAppraisal || canApproveAppraisal;

  const tabs = [
    ...(myCase ? [{ id: "my-review", label: "My Review" }] : []),
    ...(isManager ? [{ id: "team", label: "My Team" }] : []),
    ...(canSeeAllReviews ? [{ id: "all-reviews", label: "All Reviews" }] : []),
    ...(canSeeAppraisals ? [{ id: "appraisals", label: "Appraisals" }] : []),
  ];
  const [active, setActive] = useState(tabs[0]?.id ?? "all-reviews");

  function handleAdvance() {
    const next = nextCycleStatus(cycle!.status, cycle!.requiresHRReview);
    if (!next) return;
    const result = advanceCycleStatus(cycle!.id, next);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  const nextStatus = nextCycleStatus(cycle.status, cycle.requiresHRReview);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/performance" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Performance
        </Link>
        <PageHeader
          title={cycle.name}
          description={`${formatDate(cycle.startDate)} – ${formatDate(cycle.endDate)} · Review window ${formatDate(cycle.reviewStartDate)} – ${formatDate(cycle.reviewEndDate)}`}
          action={
            <div className="flex items-center gap-2">
              <StatusBadge status={cycle.status} />
              {canManageCycles && nextStatus && (
                <Button size="sm" onClick={handleAdvance}>
                  Move to &ldquo;{nextStatus}&rdquo;
                </Button>
              )}
            </div>
          }
        />
      </div>

      {tabs.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-400 dark:text-slate-500">You don&apos;t have access to any reviews in this cycle.</Card>
      ) : (
        <>
          <Tabs tabs={tabs} active={active} onChange={setActive} />
          {active === "my-review" && myCase && <MyReviewTab cycle={cycle} employeeId={currentUser.employeeId} />}
          {active === "team" && isManager && <TeamTab cycle={cycle} teamMembers={teamMembers} />}
          {active === "all-reviews" && canSeeAllReviews && <AllReviewsTab cycle={cycle} employees={employees.filter((e) => e.siteId === cycle.siteId)} />}
          {active === "appraisals" && canSeeAppraisals && (
            <AppraisalsTab cycle={cycle} reviewCases={reviewCases.filter((c) => c.cycleId === cycleId)} getEmployeeByEmployeeId={getEmployeeByEmployeeId} />
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Goal card — shared read/edit surface reused by My Review / Team /   */
/* All Reviews so achievement, rating and comments render identically   */
/* everywhere (section 12/13's "one place" requirement extends to the   */
/* UI, not just the score math).                                        */
/* ------------------------------------------------------------------ */

function GoalCard({
  goal,
  mode,
  onSaveAchievement,
  onSaveRating,
}: {
  goal: PerformanceGoal;
  mode: "self" | "manager" | "readonly";
  onSaveAchievement?: (achievement: number, comment: string) => void;
  onSaveRating?: (rating: number, comment: string) => void;
}) {
  const { recordsOfType } = useMasters();
  const categoryName = goal.categoryId ? recordsOfType("GoalCategory").find((c) => c.id === goal.categoryId)?.name : undefined;
  const [achievement, setAchievement] = useState(goal.achievement);
  const [employeeComment, setEmployeeComment] = useState(goal.employeeComment ?? "");
  const [rating, setRating] = useState(goal.managerRating ?? 0);
  const [managerComment, setManagerComment] = useState(goal.managerComment ?? "");

  return (
    <div className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{goal.title}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {categoryName ?? "Uncategorized"} · {goal.scope} · Weight {goal.weight}%
          </p>
        </div>
        <StatusBadge status={goal.status} />
      </div>
      {goal.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{goal.description}</p>}
      <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
        <div>
          <dt className="text-slate-400 dark:text-slate-500">KPI</dt>
          <dd className="text-slate-700 dark:text-slate-200">{goal.kpi}</dd>
        </div>
        <div>
          <dt className="text-slate-400 dark:text-slate-500">Target</dt>
          <dd className="text-slate-700 dark:text-slate-200">{goal.target}</dd>
        </div>
        <div>
          <dt className="text-slate-400 dark:text-slate-500">Measurement</dt>
          <dd className="text-slate-700 dark:text-slate-200">{goal.measurement}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Due {formatDate(goal.dueDate)}</p>

      {mode === "self" && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Field label={`Achievement (${achievement}%)`}>
            <input
              type="range"
              min={0}
              max={100}
              value={achievement}
              onChange={(e) => setAchievement(Number(e.target.value))}
              className="w-full"
            />
          </Field>
          <Textarea placeholder="Comment on your progress" rows={2} value={employeeComment} onChange={(e) => setEmployeeComment(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => onSaveAchievement?.(achievement, employeeComment)}>
            Save
          </Button>
        </div>
      )}

      {mode !== "self" && (goal.achievement > 0 || goal.employeeComment) && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
          <p className="font-medium text-slate-600 dark:text-slate-300">Employee achievement: {goal.achievement}%</p>
          {goal.employeeComment && <p className="mt-1 text-slate-500 dark:text-slate-400">&ldquo;{goal.employeeComment}&rdquo;</p>}
        </div>
      )}

      {mode === "manager" && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Field label="Manager Rating (1-5)">
            <Select value={String(rating)} onChange={(e) => setRating(Number(e.target.value))}>
              <option value="0" disabled>
                Select rating
              </option>
              {[1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Textarea placeholder="Manager comment" rows={2} value={managerComment} onChange={(e) => setManagerComment(e.target.value)} />
          <Button size="sm" onClick={() => onSaveRating?.(rating, managerComment)} disabled={rating < 1}>
            Save Rating
          </Button>
        </div>
      )}

      {mode === "readonly" && typeof goal.managerRating === "number" && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-sm font-medium text-slate-700 dark:border-slate-800 dark:text-slate-200">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {goal.managerRating}/5
          {goal.managerComment && <span className="text-xs font-normal text-slate-400 dark:text-slate-500">— &ldquo;{goal.managerComment}&rdquo;</span>}
        </div>
      )}
    </div>
  );
}

function MyReviewTab({ cycle, employeeId }: { cycle: PerformanceCycle; employeeId: string }) {
  const { goalsFor, goalWeightTotal, caseFor, updateGoalAchievement, submitSelfReview } = usePerformance();
  const toast = useToast();
  const myGoals = goalsFor(employeeId, cycle.id);
  const myCase = caseFor(employeeId, cycle.id);
  const weightTotal = goalWeightTotal(employeeId, cycle.id);
  const canSubmit = myCase?.stage === "Goals Assigned" && weightTotal === 100;

  function handleSubmit() {
    const result = submitSelfReview(employeeId, cycle.id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Goal weight total: {weightTotal}%</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {myCase?.stage === "Goals Assigned" ? "Weights must total 100% before you can submit." : `Stage: ${myCase?.stage ?? "Draft"}`}
          </p>
        </div>
        {myCase?.stage === "Goals Assigned" && (
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Submit Self Review
          </Button>
        )}
      </Card>
      <div className="space-y-3">
        {myGoals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            mode={myCase?.stage === "Goals Assigned" ? "self" : "readonly"}
            onSaveAchievement={(achievement, comment) => {
              const result = updateGoalAchievement(g.id, achievement, comment);
              (result.ok ? toast.success : toast.error)(result.message);
            }}
          />
        ))}
        {myGoals.length === 0 && <Card className="p-10 text-center text-sm text-slate-400 dark:text-slate-500">No goals assigned.</Card>}
      </div>
    </div>
  );
}

function TeamTab({ cycle, teamMembers }: { cycle: PerformanceCycle; teamMembers: Employee[] }) {
  const { caseFor, goalsFor, rateGoal, submitManagerReview } = usePerformance();
  const toast = useToast();
  const [assignFor, setAssignFor] = useState<Employee | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <Table>
          <THead>
            <Th>Employee</Th>
            <Th>Designation</Th>
            <Th>Stage</Th>
            <Th>Final Score</Th>
            <Th></Th>
          </THead>
          <TBody>
            {teamMembers.map((m) => {
              const c = caseFor(m.employeeId, cycle.id);
              const goals = goalsFor(m.employeeId, cycle.id);
              const allRated = goals.length > 0 && goals.every((g) => typeof g.managerRating === "number");
              return (
                <Fragment key={m.employeeId}>
                  <Tr hoverable>
                    <Td className="font-medium text-slate-800 dark:text-slate-100">{m.name}</Td>
                    <Td>{m.designation}</Td>
                    <Td>{c ? <StatusBadge status={c.stage} /> : <span className="text-slate-300 dark:text-slate-600">No goals</span>}</Td>
                    <Td>{c?.finalScore !== undefined ? `${c.finalScore}/5` : "—"}</Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        {(!c || c.stage === "Goals Assigned") && (
                          <Button size="sm" variant="outline" onClick={() => setAssignFor(m)}>
                            <Plus className="h-3.5 w-3.5" /> Add Goal
                          </Button>
                        )}
                        {c?.stage === "Self Review" && (
                          <Button size="sm" variant="outline" onClick={() => setExpanded(expanded === m.employeeId ? null : m.employeeId)}>
                            {expanded === m.employeeId ? "Hide" : "Rate Goals"}
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                  {expanded === m.employeeId && c?.stage === "Self Review" && (
                    <tr>
                      <td colSpan={5} className="border-b border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                        <div className="space-y-3">
                          {goals.map((g) => (
                            <GoalCard key={g.id} goal={g} mode="manager" onSaveRating={(rating, comment) => {
                              const result = rateGoal(g.id, rating, comment);
                              (result.ok ? toast.success : toast.error)(result.message);
                            }} />
                          ))}
                          <Button
                            disabled={!allRated}
                            onClick={() => {
                              const result = submitManagerReview(m.employeeId, cycle.id);
                              (result.ok ? toast.success : toast.error)(result.message);
                              if (result.ok) setExpanded(null);
                            }}
                          >
                            Submit Manager Review
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {teamMembers.length === 0 && <EmptyRow colSpan={5}>You have no direct reports.</EmptyRow>}
          </TBody>
        </Table>
      </Card>
      {assignFor && <AssignGoalModal cycle={cycle} employee={assignFor} onClose={() => setAssignFor(null)} />}
    </div>
  );
}

function AllReviewsTab({ cycle, employees }: { cycle: PerformanceCycle; employees: Employee[] }) {
  const { caseFor, submitHRReview } = usePerformance();
  const toast = useToast();
  const [assignFor, setAssignFor] = useState<Employee | null>(null);

  function handleHRReview(employeeId: string) {
    const result = submitHRReview(employeeId, cycle.id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  return (
    <div className="space-y-4">
      <Card>
        <Table>
          <THead>
            <Th>Employee</Th>
            <Th>Department</Th>
            <Th>Stage</Th>
            <Th>Final Score</Th>
            <Th></Th>
          </THead>
          <TBody>
            {employees.map((e) => {
              const c = caseFor(e.employeeId, cycle.id);
              return (
                <Tr key={e.employeeId} hoverable>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{e.name}</Td>
                  <Td>{e.department}</Td>
                  <Td>{c ? <StatusBadge status={c.stage} /> : <span className="text-slate-300 dark:text-slate-600">No goals</span>}</Td>
                  <Td>{c?.finalScore !== undefined ? `${c.finalScore}/5` : "—"}</Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {(!c || c.stage === "Goals Assigned") && (
                        <Button size="sm" variant="outline" onClick={() => setAssignFor(e)}>
                          <Plus className="h-3.5 w-3.5" /> Add Goal
                        </Button>
                      )}
                      {c?.stage === "HR Review" && (
                        <Button size="sm" onClick={() => handleHRReview(e.employeeId)}>
                          Complete HR Review
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              );
            })}
            {employees.length === 0 && <EmptyRow colSpan={5}>No employees at this site.</EmptyRow>}
          </TBody>
        </Table>
      </Card>
      {assignFor && <AssignGoalModal cycle={cycle} employee={assignFor} onClose={() => setAssignFor(null)} />}
    </div>
  );
}

function AssignGoalModal({ cycle, employee, onClose }: { cycle: PerformanceCycle; employee: Employee; onClose: () => void }) {
  const { assignGoal, goalWeightTotal } = usePerformance();
  const { recordsOfType } = useMasters();
  const toast = useToast();
  const categories = recordsOfType("GoalCategory");
  const currentTotal = goalWeightTotal(employee.employeeId, cycle.id);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = assignGoal({
      employeeId: employee.employeeId,
      siteId: cycle.siteId,
      cycleId: cycle.id,
      scope: String(form.get("scope") ?? "Individual") as GoalScope,
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? "") || undefined,
      categoryId: String(form.get("categoryId") ?? "") || undefined,
      kpi: String(form.get("kpi") ?? ""),
      target: String(form.get("target") ?? ""),
      measurement: String(form.get("measurement") ?? ""),
      weight: Number(form.get("weight") ?? 0),
      dueDate: String(form.get("dueDate") ?? cycle.endDate),
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) onClose();
  }

  return (
    <Modal open onClose={onClose} title={`Assign Goal — ${employee.name}`}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-xs text-slate-400 dark:text-slate-500">Current weight total: {currentTotal}% (must reach exactly 100% before self-review).</p>
        <Field label="Goal">
          <Input name="title" required placeholder="e.g. Improve API response time" />
        </Field>
        <Field label="Description (optional)">
          <Textarea name="description" rows={2} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <Select name="categoryId" defaultValue="">
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Scope">
            <Select name="scope" defaultValue="Individual">
              <option value="Individual">Individual</option>
              <option value="Department">Department</option>
              <option value="Team">Team</option>
              <option value="Organization">Organization</option>
            </Select>
          </Field>
        </div>
        <Field label="KPI">
          <Input name="kpi" required placeholder="e.g. p95 latency" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Target">
            <Input name="target" required placeholder="e.g. < 200ms" />
          </Field>
          <Field label="Measurement">
            <Input name="measurement" required placeholder="e.g. Percentage" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Weight (%)">
            <Input name="weight" type="number" min={1} max={100} required defaultValue={100 - currentTotal > 0 ? 100 - currentTotal : undefined} />
          </Field>
          <Field label="Due Date">
            <Input name="dueDate" type="date" required defaultValue={cycle.endDate} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Assign Goal</Button>
        </div>
      </form>
    </Modal>
  );
}

function AppraisalsTab({
  cycle,
  reviewCases,
  getEmployeeByEmployeeId,
}: {
  cycle: PerformanceCycle;
  reviewCases: PerformanceReviewCase[];
  getEmployeeByEmployeeId: (employeeId: string) => Employee | undefined;
}) {
  const { appraisals, appraisalForCase, canManageAppraisal, canApproveAppraisal, submitAppraisalForApproval, decideAppraisal, applyAppraisal } = usePerformance();
  const toast = useToast();
  const [createFor, setCreateFor] = useState<PerformanceReviewCase | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);

  const completedCases = reviewCases.filter((c) => c.stage === "Completed");
  const cycleAppraisals = appraisals.filter((a) => a.cycleId === cycle.id);

  async function act(fn: () => { ok: boolean; message: string } | Promise<{ ok: boolean; message: string }>) {
    const result = await fn();
    (result.ok ? toast.success : toast.error)(result.message);
  }

  return (
    <div className="space-y-4">
      {canManageAppraisal && (
        <Card>
          <CardHeader>
            <CardTitle>Completed Reviews Awaiting Appraisal</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <THead>
                <Th>Employee</Th>
                <Th>Final Score</Th>
                <Th></Th>
              </THead>
              <TBody>
                {completedCases
                  .filter((c) => !appraisalForCase(c.id))
                  .map((c) => (
                    <Tr key={c.id}>
                      <Td className="font-medium text-slate-800 dark:text-slate-100">{getEmployeeByEmployeeId(c.employeeId)?.name ?? c.employeeId}</Td>
                      <Td>{c.finalScore}/5</Td>
                      <Td>
                        <Button size="sm" variant="outline" onClick={() => setCreateFor(c)}>
                          Create Appraisal
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                {completedCases.filter((c) => !appraisalForCase(c.id)).length === 0 && <EmptyRow colSpan={3}>No completed reviews awaiting an appraisal decision.</EmptyRow>}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Appraisal Decisions</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <THead>
              <Th>Employee</Th>
              <Th>Rating</Th>
              <Th>CTC Change</Th>
              <Th>Promotion</Th>
              <Th>Effective</Th>
              <Th>Status</Th>
              <Th></Th>
            </THead>
            <TBody>
              {cycleAppraisals.map((a) => (
                <Tr key={a.id}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{getEmployeeByEmployeeId(a.employeeId)?.name ?? a.employeeId}</Td>
                  <Td>{a.finalRating}/5</Td>
                  <Td>
                    {a.previousCtcAnnual !== undefined && a.proposedCtcAnnual !== undefined
                      ? `₹${a.previousCtcAnnual.toLocaleString("en-IN")} → ₹${a.proposedCtcAnnual.toLocaleString("en-IN")} (+${a.incrementPercent}%)`
                      : "—"}
                  </Td>
                  <Td>{a.promotion ? "Yes" : "No"}</Td>
                  <Td>{formatDate(a.effectiveDate)}</Td>
                  <Td>
                    <StatusBadge status={a.status} />
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      {a.status === "Draft" && canManageAppraisal && (
                        <Button size="sm" variant="outline" onClick={() => act(() => submitAppraisalForApproval(a.id))}>
                          Submit for Approval
                        </Button>
                      )}
                      {a.status === "Pending Approval" && canApproveAppraisal && (
                        <>
                          <Button size="sm" onClick={() => act(() => decideAppraisal(a.id, "Approved"))}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setRejectId(a.id)}>
                            Reject
                          </Button>
                        </>
                      )}
                      {a.status === "Approved" && canManageAppraisal && (
                        <Button size="sm" onClick={() => act(() => applyAppraisal(a.id))}>
                          Apply
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
              {cycleAppraisals.length === 0 && <EmptyRow colSpan={7}>No appraisal decisions yet.</EmptyRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {createFor && <CreateAppraisalModal cycle={cycle} reviewCase={createFor} employee={getEmployeeByEmployeeId(createFor.employeeId)} onClose={() => setCreateFor(null)} />}
      {rejectId && (
        <RejectAppraisalModal
          onClose={() => setRejectId(null)}
          onReject={(reason) => {
            act(() => decideAppraisal(rejectId, "Rejected", reason));
            setRejectId(null);
          }}
        />
      )}
    </div>
  );
}

function RejectAppraisalModal({ onClose, onReject }: { onClose: () => void; onReject: (reason: string) => void }) {
  return (
    <Modal open onClose={onClose} title="Reject Appraisal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          onReject(String(form.get("reason") ?? ""));
        }}
      >
        <Field label="Reason">
          <Textarea name="reason" required rows={3} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger">
            Reject
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CreateAppraisalModal({
  cycle,
  reviewCase,
  employee,
  onClose,
}: {
  cycle: PerformanceCycle;
  reviewCase: PerformanceReviewCase;
  employee?: Employee;
  onClose: () => void;
}) {
  const { createAppraisal } = usePerformance();
  const { salaryStructureFor } = usePayroll();
  const { recordsOfType } = useMasters();
  const toast = useToast();
  const [incrementPercent, setIncrementPercent] = useState(0);
  const [promotion, setPromotion] = useState(false);

  if (!employee) return null;
  const currentSalary = salaryStructureFor(employee.employeeId);
  const proposedCtc = currentSalary ? Math.round(currentSalary.ctcAnnual * (1 + incrementPercent / 100)) : undefined;
  const designations = recordsOfType("Designation").filter((d) => !d.siteId || d.siteId === employee.siteId);
  const grades = recordsOfType("JobGrade").filter((g) => !g.siteId || g.siteId === employee.siteId);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = createAppraisal({
      employeeId: employee!.employeeId,
      cycleId: cycle.id,
      reviewCaseId: reviewCase.id,
      incrementPercent,
      proposedDesignationId: promotion ? String(form.get("designationId") ?? "") || undefined : undefined,
      proposedGradeId: promotion ? String(form.get("gradeId") ?? "") || undefined : undefined,
      promotion,
      effectiveDate: String(form.get("effectiveDate") ?? todayStr()),
      comments: String(form.get("comments") ?? "") || undefined,
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) onClose();
  }

  return (
    <Modal open onClose={onClose} title={`Create Appraisal — ${employee.name}`}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-xs text-slate-400 dark:text-slate-500">Final rating: {reviewCase.finalScore}/5</p>
        {currentSalary ? (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Current CTC: ₹{currentSalary.ctcAnnual.toLocaleString("en-IN")}
            {proposedCtc !== undefined && ` → Proposed: ₹${proposedCtc.toLocaleString("en-IN")}`}
          </p>
        ) : (
          <p className="text-xs text-amber-500">No salary structure on file — increment can't be calculated until one exists.</p>
        )}
        <Field label="Increment (%)">
          <Input type="number" min={0} step={0.5} value={incrementPercent} onChange={(e) => setIncrementPercent(Number(e.target.value))} />
        </Field>
        <Field label="Effective Date">
          <Input name="effectiveDate" type="date" required defaultValue={todayStr()} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={promotion} onChange={(e) => setPromotion(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Recommend promotion
        </label>
        {promotion && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="New Designation">
              <Select name="designationId" defaultValue="">
                <option value="">— No change —</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="New Grade">
              <Select name="gradeId" defaultValue="">
                <option value="">— No change —</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        <Field label="Comments (optional)">
          <Textarea name="comments" rows={2} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create Appraisal</Button>
        </div>
      </form>
    </Modal>
  );
}

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
  appraisalDecisionsStore,
  logPerformanceAudit,
  nextAppraisalId,
  nextCycleId,
  nextGoalId,
  performanceAuditStore,
  performanceCyclesStore,
  performanceGoalsStore,
  performanceReviewCasesStore,
} from "@/lib/performance-store";
import {
  allGoalsRated,
  calculateProposedCtc,
  calculateWeightedScore,
  canAdvanceReviewStage,
  canTransitionCycleStatus,
  isGoalWeightValid,
  nextReviewStage,
  totalGoalWeight,
} from "@/lib/performance-engine";
import { useAccessControl } from "@/lib/access-control-context";
import { useEmployees } from "@/lib/employee-context";
import { useEmployeeLifecycle } from "@/lib/employee-lifecycle-context";
import { usePayroll } from "@/lib/payroll-context";
import { useApprovals } from "@/lib/approval-context";
import type {
  AppraisalDecision,
  AppraisalStatus,
  GoalScope,
  GoalStatus,
  PerformanceAuditEntry,
  PerformanceCycle,
  PerformanceCycleStatus,
  PerformanceGoal,
  PerformanceReviewCase,
} from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

interface CreateCycleInput {
  siteId: string;
  name: string;
  startDate: string;
  endDate: string;
  reviewStartDate: string;
  reviewEndDate: string;
  requiresHRReview: boolean;
}

interface AssignGoalInput {
  employeeId: string;
  siteId: string;
  cycleId: string;
  scope: GoalScope;
  title: string;
  description?: string;
  categoryId?: string;
  kpi: string;
  target: string;
  measurement: string;
  weight: number;
  dueDate: string;
}

type UpdateGoalInput = Partial<
  Pick<PerformanceGoal, "title" | "description" | "categoryId" | "kpi" | "target" | "measurement" | "weight" | "dueDate" | "status">
>;

interface CreateAppraisalInput {
  employeeId: string;
  cycleId: string;
  reviewCaseId: string;
  incrementPercent: number;
  proposedDesignationId?: string;
  proposedGradeId?: string;
  promotion: boolean;
  effectiveDate: string;
  comments?: string;
}

interface PerformanceContextValue {
  // Cycles
  cycles: PerformanceCycle[];
  cyclesForSite: (siteId: string) => PerformanceCycle[];
  cycleById: (cycleId: string) => PerformanceCycle | undefined;
  canManageCycles: boolean;
  createCycle: (input: CreateCycleInput) => ActionResult & { cycle?: PerformanceCycle };
  advanceCycleStatus: (cycleId: string, toStatus: PerformanceCycleStatus) => ActionResult;

  // Goals
  goals: PerformanceGoal[];
  goalsFor: (employeeId: string, cycleId: string) => PerformanceGoal[];
  goalWeightTotal: (employeeId: string, cycleId: string) => number;
  canAssignGoalsFor: (employeeId: string) => boolean;
  assignGoal: (input: AssignGoalInput) => ActionResult & { goal?: PerformanceGoal };
  updateGoal: (goalId: string, patch: UpdateGoalInput) => ActionResult;
  removeGoal: (goalId: string) => ActionResult;

  // Review cases
  reviewCases: PerformanceReviewCase[];
  caseFor: (employeeId: string, cycleId: string) => PerformanceReviewCase | undefined;
  casesForCycle: (cycleId: string) => PerformanceReviewCase[];
  teamCasesForCycle: (cycleId: string) => PerformanceReviewCase[];
  isDirectManagerOf: (employeeId: string) => boolean;
  canManageAllReviews: boolean;
  updateGoalAchievement: (goalId: string, achievement: number, employeeComment?: string) => ActionResult;
  submitSelfReview: (employeeId: string, cycleId: string) => ActionResult;
  rateGoal: (goalId: string, managerRating: number, managerComment?: string) => ActionResult;
  submitManagerReview: (employeeId: string, cycleId: string) => ActionResult;
  submitHRReview: (employeeId: string, cycleId: string, comment?: string) => ActionResult;

  // Appraisal
  appraisals: AppraisalDecision[];
  appraisalsFor: (employeeId: string) => AppraisalDecision[];
  appraisalForCase: (reviewCaseId: string) => AppraisalDecision | undefined;
  canManageAppraisal: boolean;
  canApproveAppraisal: boolean;
  createAppraisal: (input: CreateAppraisalInput) => ActionResult & { appraisal?: AppraisalDecision };
  submitAppraisalForApproval: (id: string) => ActionResult;
  decideAppraisal: (id: string, decision: "Approved" | "Rejected", comment?: string) => ActionResult;
  applyAppraisal: (id: string) => ActionResult;

  auditEntries: PerformanceAuditEntry[];
}

const PerformanceContext = createContext<PerformanceContextValue | undefined>(undefined);

export function PerformanceProvider({ children }: { children: ReactNode }) {
  const { currentUser, canFeature } = useAccessControl();
  const { getEmployeeById, getEmployeeByEmployeeId } = useEmployees();
  const { promoteEmployee } = useEmployeeLifecycle();
  const { salaryStructureFor, defaultSalaryLinesFor, saveSalaryStructure } = usePayroll();
  const { recordMirroredAction } = useApprovals();

  const cycles = useSyncExternalStore(performanceCyclesStore.subscribe, performanceCyclesStore.getSnapshot, performanceCyclesStore.getServerSnapshot);
  const goals = useSyncExternalStore(performanceGoalsStore.subscribe, performanceGoalsStore.getSnapshot, performanceGoalsStore.getServerSnapshot);
  const reviewCases = useSyncExternalStore(performanceReviewCasesStore.subscribe, performanceReviewCasesStore.getSnapshot, performanceReviewCasesStore.getServerSnapshot);
  const appraisals = useSyncExternalStore(appraisalDecisionsStore.subscribe, appraisalDecisionsStore.getSnapshot, appraisalDecisionsStore.getServerSnapshot);
  const auditEntries = useSyncExternalStore(performanceAuditStore.subscribe, performanceAuditStore.getSnapshot, performanceAuditStore.getServerSnapshot);

  const canManageCycles = canFeature("performance.cycles", "create") || canFeature("performance.cycles", "edit") || canFeature("performance.cycles", "manage");
  // "manage" is only ever granted via the full-access grant() helper (Super
  // Admin / Site Admin / HR Admin) — every other role holding
  // performance.reviews gets an explicit action list instead, so this one
  // check is the whole "HR-level, any employee in scope" vs. "manager,
  // direct reports only" split (section 7/9).
  const canManageAllReviews = canFeature("performance.reviews", "manage");
  const canManageAppraisal = canFeature("performance.appraisal", "create") || canFeature("performance.appraisal", "manage");
  const canApproveAppraisal = canFeature("performance.appraisal", "approve") || canFeature("performance.appraisal", "manage");

  const isDirectManagerOf = useCallback(
    (employeeId: string) => {
      const target = getEmployeeByEmployeeId(employeeId);
      return !!target && target.reportingManagerId === currentUser.employeeId;
    },
    [getEmployeeByEmployeeId, currentUser.employeeId],
  );

  const canAssignGoalsFor = useCallback(
    (employeeId: string) => {
      if (canManageAllReviews) return true;
      const canEditTeam = canFeature("performance.reviews", "create") || canFeature("performance.reviews", "edit");
      return canEditTeam && isDirectManagerOf(employeeId);
    },
    [canManageAllReviews, canFeature, isDirectManagerOf],
  );

  const cyclesForSite = useCallback((siteId: string) => cycles.filter((c) => c.siteId === siteId), [cycles]);
  const cycleById = useCallback((cycleId: string) => cycles.find((c) => c.id === cycleId), [cycles]);

  const goalsFor = useCallback(
    (employeeId: string, cycleId: string) => goals.filter((g) => g.employeeId === employeeId && g.cycleId === cycleId),
    [goals],
  );
  const goalWeightTotal = useCallback((employeeId: string, cycleId: string) => totalGoalWeight(goalsFor(employeeId, cycleId)), [goalsFor]);

  const caseFor = useCallback(
    (employeeId: string, cycleId: string) => reviewCases.find((c) => c.employeeId === employeeId && c.cycleId === cycleId),
    [reviewCases],
  );
  const casesForCycle = useCallback((cycleId: string) => reviewCases.filter((c) => c.cycleId === cycleId), [reviewCases]);
  const teamCasesForCycle = useCallback(
    (cycleId: string) => casesForCycle(cycleId).filter((c) => isDirectManagerOf(c.employeeId)),
    [casesForCycle, isDirectManagerOf],
  );

  const appraisalsFor = useCallback((employeeId: string) => appraisals.filter((a) => a.employeeId === employeeId), [appraisals]);
  const appraisalForCase = useCallback(
    (reviewCaseId: string) => appraisals.find((a) => a.reviewCaseId === reviewCaseId && a.status !== "Rejected"),
    [appraisals],
  );

  const logAudit = useCallback(
    (input: Omit<PerformanceAuditEntry, "id" | "timestamp" | "actorName">) => logPerformanceAudit({ ...input, actorName: currentUser.name }),
    [currentUser.name],
  );

  /* ------------------------------------------------------------- */
  /* Cycles                                                          */
  /* ------------------------------------------------------------- */

  const createCycle = useCallback(
    (input: CreateCycleInput): ActionResult & { cycle?: PerformanceCycle } => {
      if (!canManageCycles) return { ok: false, message: "You're not authorized to create performance cycles." };
      if (!input.name.trim()) return { ok: false, message: "Cycle name is required." };
      if (input.startDate > input.endDate) return { ok: false, message: "Start date must be before the end date." };
      if (input.reviewStartDate > input.reviewEndDate) return { ok: false, message: "Review start date must be before the review end date." };
      const cycle: PerformanceCycle = {
        id: nextCycleId(),
        siteId: input.siteId,
        name: input.name.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        reviewStartDate: input.reviewStartDate,
        reviewEndDate: input.reviewEndDate,
        status: "Draft",
        requiresHRReview: input.requiresHRReview,
        createdBy: currentUser.name,
        createdOn: new Date().toISOString().slice(0, 10),
      };
      performanceCyclesStore.set([cycle, ...performanceCyclesStore.getSnapshot()]);
      logAudit({ action: "cycle_created", cycleId: cycle.id, detail: `Cycle "${cycle.name}" created (${cycle.startDate} – ${cycle.endDate}).` });
      return { ok: true, message: `Cycle "${cycle.name}" created.`, cycle };
    },
    [canManageCycles, currentUser.name, logAudit],
  );

  const advanceCycleStatus = useCallback(
    (cycleId: string, toStatus: PerformanceCycleStatus): ActionResult => {
      if (!canManageCycles) return { ok: false, message: "You're not authorized to manage performance cycles." };
      const cycle = cycles.find((c) => c.id === cycleId);
      if (!cycle) return { ok: false, message: "Cycle not found." };
      if (!canTransitionCycleStatus(cycle.status, toStatus, cycle.requiresHRReview)) {
        return { ok: false, message: `Cannot move a cycle from "${cycle.status}" straight to "${toStatus}" — stages can't be skipped.` };
      }
      performanceCyclesStore.set(performanceCyclesStore.getSnapshot().map((c) => (c.id === cycleId ? { ...c, status: toStatus } : c)));
      logAudit({ action: "cycle_status_changed", cycleId, detail: `Cycle "${cycle.name}" moved from "${cycle.status}" to "${toStatus}".` });
      return { ok: true, message: `Cycle status is now "${toStatus}".` };
    },
    [canManageCycles, cycles, logAudit],
  );

  /* ------------------------------------------------------------- */
  /* Goals — employeeId + siteId + cycleId identifies every record   */
  /* (section 6); ensureCase lazily creates the per-employee review   */
  /* case the first time a goal is assigned.                          */
  /* ------------------------------------------------------------- */

  const ensureCase = useCallback((employeeId: string, siteId: string, cycleId: string): PerformanceReviewCase => {
    const existing = performanceReviewCasesStore.getSnapshot().find((c) => c.employeeId === employeeId && c.cycleId === cycleId);
    if (existing) return existing;
    const created: PerformanceReviewCase = { id: `case-${cycleId}-${employeeId}`, employeeId, siteId, cycleId, stage: "Draft" };
    performanceReviewCasesStore.set([created, ...performanceReviewCasesStore.getSnapshot()]);
    return created;
  }, []);

  const assignGoal = useCallback(
    (input: AssignGoalInput): ActionResult & { goal?: PerformanceGoal } => {
      if (!canAssignGoalsFor(input.employeeId)) return { ok: false, message: "You're not authorized to assign goals to this employee." };
      const cycle = cycles.find((c) => c.id === input.cycleId);
      if (!cycle) return { ok: false, message: "Cycle not found." };
      if (cycle.siteId !== input.siteId) return { ok: false, message: "This cycle doesn't belong to the employee's site." };
      const employee = getEmployeeByEmployeeId(input.employeeId);
      if (!employee || employee.siteId !== cycle.siteId) return { ok: false, message: "Employee doesn't belong to this cycle's site." };
      if (cycle.status === "Closed" || cycle.status === "Completed") return { ok: false, message: "This cycle is already closed." };
      if (!input.title.trim()) return { ok: false, message: "Goal title is required." };
      if (input.weight <= 0 || input.weight > 100) return { ok: false, message: "Weight must be between 1 and 100." };

      const existingCase = ensureCase(input.employeeId, input.siteId, input.cycleId);
      if (existingCase.stage !== "Draft" && existingCase.stage !== "Goals Assigned") {
        return { ok: false, message: "Goals can only be added before the self-review stage starts." };
      }

      const goal: PerformanceGoal = {
        id: nextGoalId(),
        employeeId: input.employeeId,
        siteId: input.siteId,
        cycleId: input.cycleId,
        scope: input.scope,
        title: input.title.trim(),
        description: input.description?.trim() || undefined,
        categoryId: input.categoryId,
        kpi: input.kpi.trim(),
        target: input.target.trim(),
        measurement: input.measurement.trim(),
        weight: input.weight,
        dueDate: input.dueDate,
        status: "Not Started",
        achievement: 0,
        createdBy: currentUser.name,
        createdOn: new Date().toISOString().slice(0, 10),
      };
      performanceGoalsStore.set([goal, ...performanceGoalsStore.getSnapshot()]);
      if (existingCase.stage === "Draft") {
        performanceReviewCasesStore.set(
          performanceReviewCasesStore.getSnapshot().map((c) => (c.id === existingCase.id ? { ...c, stage: "Goals Assigned" } : c)),
        );
      }
      logAudit({ action: "goals_assigned", employeeId: input.employeeId, cycleId: input.cycleId, detail: `Goal "${goal.title}" (${goal.weight}%) assigned to ${employee.name}.` });
      return { ok: true, message: `Goal "${goal.title}" assigned.`, goal };
    },
    [canAssignGoalsFor, cycles, getEmployeeByEmployeeId, ensureCase, currentUser.name, logAudit],
  );

  const updateGoal = useCallback(
    (goalId: string, patch: UpdateGoalInput): ActionResult => {
      const goal = performanceGoalsStore.getSnapshot().find((g) => g.id === goalId);
      if (!goal) return { ok: false, message: "Goal not found." };
      if (!canAssignGoalsFor(goal.employeeId)) return { ok: false, message: "You're not authorized to edit this goal." };
      const reviewCase = caseFor(goal.employeeId, goal.cycleId);
      if (reviewCase && reviewCase.stage !== "Draft" && reviewCase.stage !== "Goals Assigned") {
        return { ok: false, message: "Goals can only be edited before the self-review stage starts." };
      }
      if (patch.weight !== undefined && (patch.weight <= 0 || patch.weight > 100)) {
        return { ok: false, message: "Weight must be between 1 and 100." };
      }
      performanceGoalsStore.set(performanceGoalsStore.getSnapshot().map((g) => (g.id === goalId ? { ...g, ...patch } : g)));
      return { ok: true, message: "Goal updated." };
    },
    [canAssignGoalsFor, caseFor],
  );

  const removeGoal = useCallback(
    (goalId: string): ActionResult => {
      const goal = performanceGoalsStore.getSnapshot().find((g) => g.id === goalId);
      if (!goal) return { ok: false, message: "Goal not found." };
      if (!canAssignGoalsFor(goal.employeeId)) return { ok: false, message: "You're not authorized to remove this goal." };
      const reviewCase = caseFor(goal.employeeId, goal.cycleId);
      if (reviewCase && reviewCase.stage !== "Draft" && reviewCase.stage !== "Goals Assigned") {
        return { ok: false, message: "Goals can only be removed before the self-review stage starts." };
      }
      performanceGoalsStore.set(performanceGoalsStore.getSnapshot().filter((g) => g.id !== goalId));
      return { ok: true, message: "Goal removed." };
    },
    [canAssignGoalsFor, caseFor],
  );

  /* ------------------------------------------------------------- */
  /* Self review / Manager review / HR review — one review case per  */
  /* employeeId+cycleId; mirrors the manager/HR approval moments into */
  /* the Phase 9 Approval Engine's shared audit trail (module          */
  /* "Performance") the same way Offboarding/Employee Lifecycle do —  */
  /* no second workflow engine (section 10/15).                        */
  /* ------------------------------------------------------------- */

  const updateGoalAchievement = useCallback(
    (goalId: string, achievement: number, employeeComment?: string): ActionResult => {
      const goal = performanceGoalsStore.getSnapshot().find((g) => g.id === goalId);
      if (!goal) return { ok: false, message: "Goal not found." };
      if (goal.employeeId !== currentUser.employeeId) return { ok: false, message: "You can only update your own goals." };
      const reviewCase = caseFor(goal.employeeId, goal.cycleId);
      if (!reviewCase || (reviewCase.stage !== "Goals Assigned" && reviewCase.stage !== "Self Review")) {
        return { ok: false, message: "Achievement can only be updated during the self-review stage." };
      }
      if (achievement < 0 || achievement > 100) return { ok: false, message: "Achievement must be between 0 and 100." };
      const status: GoalStatus = achievement >= 100 ? "Completed" : achievement > 0 ? "In Progress" : goal.status === "Missed" ? "Missed" : "Not Started";
      performanceGoalsStore.set(
        performanceGoalsStore.getSnapshot().map((g) =>
          g.id === goalId ? { ...g, achievement, status, employeeComment: employeeComment?.trim() || g.employeeComment } : g,
        ),
      );
      return { ok: true, message: "Achievement updated." };
    },
    [currentUser.employeeId, caseFor],
  );

  const submitSelfReview = useCallback(
    (employeeId: string, cycleId: string): ActionResult => {
      if (employeeId !== currentUser.employeeId) return { ok: false, message: "You can only submit your own self-review." };
      const cycle = cycles.find((c) => c.id === cycleId);
      if (!cycle) return { ok: false, message: "Cycle not found." };
      const reviewCase = caseFor(employeeId, cycleId);
      if (!reviewCase || reviewCase.stage !== "Goals Assigned") {
        return { ok: false, message: "Self-review can only be submitted once goals are assigned and not yet submitted." };
      }
      if (!canAdvanceReviewStage(cycle.status, "Self Review")) {
        return { ok: false, message: `The cycle hasn't opened Self Review yet (currently "${cycle.status}").` };
      }
      const employeeGoals = goalsFor(employeeId, cycleId);
      if (!isGoalWeightValid(employeeGoals)) {
        return { ok: false, message: `Goal weights must total 100% before submitting (currently ${totalGoalWeight(employeeGoals)}%).` };
      }
      performanceReviewCasesStore.set(
        performanceReviewCasesStore.getSnapshot().map((c) =>
          c.id === reviewCase.id ? { ...c, stage: "Self Review", selfReviewSubmittedOn: new Date().toISOString().slice(0, 10) } : c,
        ),
      );
      logAudit({ action: "self_review_submitted", employeeId, cycleId, detail: `${currentUser.name} submitted their self-review.` });
      return { ok: true, message: "Self-review submitted." };
    },
    [currentUser.employeeId, currentUser.name, cycles, caseFor, goalsFor, logAudit],
  );

  const rateGoal = useCallback(
    (goalId: string, managerRating: number, managerComment?: string): ActionResult => {
      const goal = performanceGoalsStore.getSnapshot().find((g) => g.id === goalId);
      if (!goal) return { ok: false, message: "Goal not found." };
      if (goal.employeeId === currentUser.employeeId) return { ok: false, message: "You cannot rate your own goals." };
      if (!canManageAllReviews && !isDirectManagerOf(goal.employeeId)) {
        return { ok: false, message: "You can only rate goals for your direct reports." };
      }
      const reviewCase = caseFor(goal.employeeId, goal.cycleId);
      if (!reviewCase || reviewCase.stage !== "Self Review") {
        return { ok: false, message: "Goals can only be rated after the employee submits their self-review." };
      }
      if (managerRating < 1 || managerRating > 5) return { ok: false, message: "Rating must be between 1 and 5." };
      performanceGoalsStore.set(
        performanceGoalsStore.getSnapshot().map((g) => (g.id === goalId ? { ...g, managerRating, managerComment: managerComment?.trim() || g.managerComment } : g)),
      );
      return { ok: true, message: "Rating saved." };
    },
    [currentUser.employeeId, canManageAllReviews, isDirectManagerOf, caseFor],
  );

  const submitManagerReview = useCallback(
    (employeeId: string, cycleId: string): ActionResult => {
      if (employeeId === currentUser.employeeId) return { ok: false, message: "You cannot submit your own manager review." };
      if (!canManageAllReviews && !isDirectManagerOf(employeeId)) {
        return { ok: false, message: "You can only review your direct reports." };
      }
      const cycle = cycles.find((c) => c.id === cycleId);
      if (!cycle) return { ok: false, message: "Cycle not found." };
      const reviewCase = caseFor(employeeId, cycleId);
      if (!reviewCase || reviewCase.stage !== "Self Review") {
        return { ok: false, message: "Manager review can only be submitted after the employee's self-review." };
      }
      if (!canAdvanceReviewStage(cycle.status, "Manager Review")) {
        return { ok: false, message: `The cycle hasn't opened Manager Review yet (currently "${cycle.status}").` };
      }
      const employeeGoals = goalsFor(employeeId, cycleId);
      if (!allGoalsRated(employeeGoals)) {
        return { ok: false, message: "Rate every goal before submitting the manager review." };
      }
      const finalScore = calculateWeightedScore(employeeGoals);
      const next = nextReviewStage("Manager Review", cycle.requiresHRReview) ?? "Completed";
      const today = new Date().toISOString().slice(0, 10);
      performanceReviewCasesStore.set(
        performanceReviewCasesStore.getSnapshot().map((c) =>
          c.id === reviewCase.id
            ? {
                ...c,
                stage: next,
                managerReviewSubmittedOn: today,
                managerReviewedBy: currentUser.name,
                finalScore,
                completedOn: next === "Completed" ? today : undefined,
              }
            : c,
        ),
      );
      logAudit({ action: "manager_review_submitted", employeeId, cycleId, detail: `${currentUser.name} submitted the manager review (score ${finalScore}).` });
      recordMirroredAction({
        siteId: reviewCase.siteId,
        module: "Performance",
        recordId: reviewCase.id,
        recordOwnerEmployeeId: employeeId,
        recordOwnerName: getEmployeeByEmployeeId(employeeId)?.name ?? employeeId,
        approverType: "REPORTING_MANAGER",
        action: "APPROVE",
        newStatus: next === "Completed" ? "Approved" : "Pending",
        comment: `Manager review submitted — weighted score ${finalScore}.`,
        steps: cycle.requiresHRReview
          ? [
              { order: 0, approverType: "REPORTING_MANAGER", required: true },
              { order: 1, approverType: "HR", required: true },
            ]
          : [{ order: 0, approverType: "REPORTING_MANAGER", required: true }],
        advanceToNextStep: cycle.requiresHRReview,
      });
      return { ok: true, message: next === "Completed" ? `Review completed — final score ${finalScore}.` : "Manager review submitted — moved to HR Review." };
    },
    [currentUser.employeeId, currentUser.name, canManageAllReviews, isDirectManagerOf, cycles, caseFor, goalsFor, logAudit, recordMirroredAction, getEmployeeByEmployeeId],
  );

  const submitHRReview = useCallback(
    (employeeId: string, cycleId: string, comment?: string): ActionResult => {
      if (employeeId === currentUser.employeeId) return { ok: false, message: "You cannot submit your own HR review." };
      if (!canFeature("performance.reviews", "approve") && !canManageAllReviews) {
        return { ok: false, message: "You're not authorized to complete the HR review." };
      }
      const cycle = cycles.find((c) => c.id === cycleId);
      if (!cycle) return { ok: false, message: "Cycle not found." };
      const reviewCase = caseFor(employeeId, cycleId);
      if (!reviewCase || reviewCase.stage !== "HR Review") {
        return { ok: false, message: "This review isn't awaiting HR sign-off." };
      }
      const today = new Date().toISOString().slice(0, 10);
      performanceReviewCasesStore.set(
        performanceReviewCasesStore.getSnapshot().map((c) =>
          c.id === reviewCase.id
            ? { ...c, stage: "Completed", hrReviewSubmittedOn: today, hrReviewedBy: currentUser.name, hrComment: comment?.trim() || c.hrComment, completedOn: today }
            : c,
        ),
      );
      logAudit({ action: "hr_review_submitted", employeeId, cycleId, detail: `${currentUser.name} completed the HR review.` });
      recordMirroredAction({
        siteId: reviewCase.siteId,
        module: "Performance",
        recordId: reviewCase.id,
        recordOwnerEmployeeId: employeeId,
        recordOwnerName: getEmployeeByEmployeeId(employeeId)?.name ?? employeeId,
        approverType: "HR",
        action: "APPROVE",
        newStatus: "Approved",
        comment,
        advanceToNextStep: true,
      });
      return { ok: true, message: "HR review completed." };
    },
    [currentUser.employeeId, currentUser.name, canFeature, canManageAllReviews, cycles, caseFor, logAudit, recordMirroredAction, getEmployeeByEmployeeId],
  );

  /* ------------------------------------------------------------- */
  /* Appraisal — Draft -> Pending Approval -> Approved/Rejected ->    */
  /* Applied. Applying is the ONLY place that touches Payroll salary   */
  /* structure or Employee Lifecycle promotion, and it reuses those    */
  /* existing functions rather than mutating salary directly           */
  /* (section 17/18 — critical).                                       */
  /* ------------------------------------------------------------- */

  const createAppraisal = useCallback(
    (input: CreateAppraisalInput): ActionResult & { appraisal?: AppraisalDecision } => {
      if (!canManageAppraisal) return { ok: false, message: "You're not authorized to create appraisal decisions." };
      if (input.employeeId === currentUser.employeeId) return { ok: false, message: "You cannot create your own appraisal decision." };
      const reviewCase = performanceReviewCasesStore.getSnapshot().find((c) => c.id === input.reviewCaseId);
      if (!reviewCase) return { ok: false, message: "Review case not found." };
      if (reviewCase.stage !== "Completed" || reviewCase.finalScore === undefined) {
        return { ok: false, message: "The review must be completed before an appraisal can be created." };
      }
      if (appraisals.some((a) => a.reviewCaseId === input.reviewCaseId && a.status !== "Rejected")) {
        return { ok: false, message: "An appraisal decision already exists for this review." };
      }
      const employee = getEmployeeByEmployeeId(input.employeeId);
      if (!employee) return { ok: false, message: "Employee not found." };
      const currentSalary = salaryStructureFor(input.employeeId);
      const previousCtcAnnual = currentSalary?.ctcAnnual;
      const proposedCtcAnnual = previousCtcAnnual !== undefined ? calculateProposedCtc(previousCtcAnnual, input.incrementPercent) : undefined;

      const appraisal: AppraisalDecision = {
        id: nextAppraisalId(),
        employeeId: input.employeeId,
        siteId: reviewCase.siteId,
        cycleId: input.cycleId,
        reviewCaseId: input.reviewCaseId,
        finalRating: reviewCase.finalScore,
        previousCtcAnnual,
        proposedCtcAnnual,
        incrementPercent: input.incrementPercent,
        proposedDesignationId: input.proposedDesignationId,
        proposedGradeId: input.proposedGradeId,
        promotion: input.promotion,
        effectiveDate: input.effectiveDate,
        comments: input.comments?.trim() || undefined,
        status: "Draft",
        createdBy: currentUser.name,
        createdOn: new Date().toISOString().slice(0, 10),
      };
      appraisalDecisionsStore.set([appraisal, ...appraisalDecisionsStore.getSnapshot()]);
      logAudit({ action: "appraisal_created", employeeId: input.employeeId, cycleId: input.cycleId, detail: `Appraisal drafted for ${employee.name} — ${input.incrementPercent}% increment, effective ${input.effectiveDate}.` });
      return { ok: true, message: "Appraisal decision drafted.", appraisal };
    },
    [canManageAppraisal, currentUser.employeeId, currentUser.name, appraisals, getEmployeeByEmployeeId, salaryStructureFor, logAudit],
  );

  const submitAppraisalForApproval = useCallback(
    (id: string): ActionResult => {
      if (!canManageAppraisal) return { ok: false, message: "You're not authorized to submit appraisal decisions." };
      const appraisal = appraisalDecisionsStore.getSnapshot().find((a) => a.id === id);
      if (!appraisal) return { ok: false, message: "Appraisal not found." };
      if (appraisal.status !== "Draft") return { ok: false, message: "Only a draft appraisal can be submitted for approval." };
      appraisalDecisionsStore.set(appraisalDecisionsStore.getSnapshot().map((a) => (a.id === id ? { ...a, status: "Pending Approval" as AppraisalStatus } : a)));
      return { ok: true, message: "Submitted for approval." };
    },
    [canManageAppraisal],
  );

  const decideAppraisal = useCallback(
    (id: string, decision: "Approved" | "Rejected", comment?: string): ActionResult => {
      const appraisal = appraisalDecisionsStore.getSnapshot().find((a) => a.id === id);
      if (!appraisal) return { ok: false, message: "Appraisal not found." };
      // Unconditional — no combination of roles can approve one's own appraisal (section 24).
      if (appraisal.employeeId === currentUser.employeeId) return { ok: false, message: "You cannot decide your own appraisal." };
      if (!canApproveAppraisal) return { ok: false, message: "You're not authorized to approve appraisal decisions." };
      if (appraisal.status !== "Pending Approval") return { ok: false, message: "This appraisal isn't pending approval." };
      if (decision === "Rejected" && !comment?.trim()) return { ok: false, message: "A reason is required to reject." };

      const today = new Date().toISOString().slice(0, 10);
      appraisalDecisionsStore.set(
        appraisalDecisionsStore.getSnapshot().map((a) =>
          a.id === id ? { ...a, status: decision, decidedBy: currentUser.name, decidedOn: today, comments: comment?.trim() || a.comments } : a,
        ),
      );
      logAudit({ action: "appraisal_decided", employeeId: appraisal.employeeId, cycleId: appraisal.cycleId, detail: `Appraisal ${decision.toLowerCase()} by ${currentUser.name}.` });
      recordMirroredAction({
        siteId: appraisal.siteId,
        module: "Appraisal",
        recordId: appraisal.id,
        recordOwnerEmployeeId: appraisal.employeeId,
        recordOwnerName: getEmployeeByEmployeeId(appraisal.employeeId)?.name ?? appraisal.employeeId,
        approverType: "HR",
        action: decision === "Approved" ? "APPROVE" : "REJECT",
        newStatus: decision,
        comment,
      });
      return { ok: true, message: `Appraisal ${decision.toLowerCase()}.` };
    },
    [currentUser.employeeId, currentUser.name, canApproveAppraisal, logAudit, recordMirroredAction, getEmployeeByEmployeeId],
  );

  const applyAppraisal = useCallback(
    (id: string): ActionResult => {
      if (!canManageAppraisal) return { ok: false, message: "You're not authorized to apply appraisal decisions." };
      const appraisal = appraisalDecisionsStore.getSnapshot().find((a) => a.id === id);
      if (!appraisal) return { ok: false, message: "Appraisal not found." };
      if (appraisal.status !== "Approved") return { ok: false, message: "Only an approved appraisal can be applied." };
      const employee = getEmployeeByEmployeeId(appraisal.employeeId);
      if (!employee) return { ok: false, message: "Employee not found." };

      // Salary Revision: reuses Phase 12's append-only salary versioning —
      // August payroll (already processed) keeps using whatever was
      // effective then; this only creates a new future-dated version.
      if (appraisal.proposedCtcAnnual !== undefined && appraisal.proposedCtcAnnual !== appraisal.previousCtcAnnual) {
        const { earnings, deductions } = defaultSalaryLinesFor(employee.siteId, appraisal.proposedCtcAnnual);
        const salaryResult = saveSalaryStructure({
          employeeId: employee.employeeId,
          siteId: employee.siteId,
          ctcAnnual: appraisal.proposedCtcAnnual,
          earnings,
          deductions,
          effectiveFrom: appraisal.effectiveDate,
          reason: `Appraisal ${appraisal.cycleId} — ${appraisal.incrementPercent}% increment`,
        });
        if (!salaryResult.ok) return salaryResult;
      }

      // Promotion: reuses Phase 12's Employee Lifecycle promotion — no
      // duplicate implementation (section 18).
      if (appraisal.promotion && (appraisal.proposedDesignationId || appraisal.proposedGradeId)) {
        const promoResult = promoteEmployee(employee.id, {
          designationId: appraisal.proposedDesignationId,
          gradeId: appraisal.proposedGradeId,
          effectiveDate: appraisal.effectiveDate,
          comment: `Appraisal promotion — cycle ${appraisal.cycleId}`,
        });
        if (!promoResult.ok) return promoResult;
      }

      const today = new Date().toISOString().slice(0, 10);
      appraisalDecisionsStore.set(appraisalDecisionsStore.getSnapshot().map((a) => (a.id === id ? { ...a, status: "Applied" as AppraisalStatus, appliedOn: today } : a)));
      logAudit({ action: "appraisal_applied", employeeId: appraisal.employeeId, cycleId: appraisal.cycleId, detail: `Appraisal applied for ${employee.name} — salary/promotion updated effective ${appraisal.effectiveDate}.` });
      return { ok: true, message: "Appraisal applied — salary and/or promotion updated." };
    },
    [canManageAppraisal, getEmployeeByEmployeeId, defaultSalaryLinesFor, saveSalaryStructure, promoteEmployee, logAudit],
  );

  const value = useMemo<PerformanceContextValue>(
    () => ({
      cycles,
      cyclesForSite,
      cycleById,
      canManageCycles,
      createCycle,
      advanceCycleStatus,

      goals,
      goalsFor,
      goalWeightTotal,
      canAssignGoalsFor,
      assignGoal,
      updateGoal,
      removeGoal,

      reviewCases,
      caseFor,
      casesForCycle,
      teamCasesForCycle,
      isDirectManagerOf,
      canManageAllReviews,
      updateGoalAchievement,
      submitSelfReview,
      rateGoal,
      submitManagerReview,
      submitHRReview,

      appraisals,
      appraisalsFor,
      appraisalForCase,
      canManageAppraisal,
      canApproveAppraisal,
      createAppraisal,
      submitAppraisalForApproval,
      decideAppraisal,
      applyAppraisal,

      auditEntries,
    }),
    [
      cycles,
      cyclesForSite,
      cycleById,
      canManageCycles,
      createCycle,
      advanceCycleStatus,
      goals,
      goalsFor,
      goalWeightTotal,
      canAssignGoalsFor,
      assignGoal,
      updateGoal,
      removeGoal,
      reviewCases,
      caseFor,
      casesForCycle,
      teamCasesForCycle,
      isDirectManagerOf,
      canManageAllReviews,
      updateGoalAchievement,
      submitSelfReview,
      rateGoal,
      submitManagerReview,
      submitHRReview,
      appraisals,
      appraisalsFor,
      appraisalForCase,
      canManageAppraisal,
      canApproveAppraisal,
      createAppraisal,
      submitAppraisalForApproval,
      decideAppraisal,
      applyAppraisal,
      auditEntries,
    ],
  );

  return <PerformanceContext.Provider value={value}>{children}</PerformanceContext.Provider>;
}

export function usePerformance() {
  const ctx = useContext(PerformanceContext);
  if (!ctx) throw new Error("usePerformance must be used within a PerformanceProvider");
  return ctx;
}

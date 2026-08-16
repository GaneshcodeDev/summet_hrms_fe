/**
 * Pure Performance engine — no store access, no React. Mirrors
 * payroll-engine.ts / recruitment-engine.ts / lifecycle-engine.ts: every
 * function takes already-fetched data and returns derived values or pure
 * decisions. performance-context.tsx is the only caller that touches
 * stores/hooks.
 */
import type { PerformanceCycleStatus, PerformanceGoal, PerformanceReviewStage } from "@/lib/types";

/** Sum of every goal's weight for one employee's cycle — the caller compares this to 100 (section 5). */
export function totalGoalWeight(goals: Pick<PerformanceGoal, "weight">[]): number {
  return Math.round(goals.reduce((sum, g) => sum + g.weight, 0) * 100) / 100;
}

export function isGoalWeightValid(goals: Pick<PerformanceGoal, "weight">[]): boolean {
  if (goals.length === 0) return false;
  return totalGoalWeight(goals) === 100;
}

/**
 * Weighted average of each goal's managerRating, using ITS OWN weight (not
 * renormalized) — a goal with no rating yet contributes 0, so a case can
 * only reach a meaningful final score once every goal has been rated.
 * Example (section 12): 40%@4 + 30%@3 + 30%@5 = 1.6 + 0.9 + 1.5 = 4.0.
 */
export function calculateWeightedScore(goals: Pick<PerformanceGoal, "weight" | "managerRating">[]): number {
  if (goals.length === 0) return 0;
  const score = goals.reduce((sum, g) => sum + (g.weight / 100) * (g.managerRating ?? 0), 0);
  return Math.round(score * 100) / 100;
}

export function allGoalsRated(goals: Pick<PerformanceGoal, "managerRating">[]): boolean {
  return goals.length > 0 && goals.every((g) => typeof g.managerRating === "number");
}

/** Nearest configured rating label for a computed score, e.g. 4.0 -> "Exceeds Expectations" if that record's value is 4. */
export function nearestRatingLabel(score: number, ratings: { name: string; value: number }[]): string | undefined {
  if (ratings.length === 0) return undefined;
  return ratings.reduce((closest, r) => (Math.abs(r.value - score) < Math.abs(closest.value - score) ? r : closest)).name;
}

/* ------------------------------------------------------------------ */
/* Stage transitions — an individual review case can never move ahead   */
/* of what its cycle currently has open, and can never skip a required  */
/* stage (section 14).                                                  */
/* ------------------------------------------------------------------ */

const REVIEW_STAGE_ORDER: PerformanceReviewStage[] = ["Draft", "Goals Assigned", "Self Review", "Manager Review", "HR Review", "Completed"];

/** The stage after `from` — skips "HR Review" entirely when the cycle doesn't require it. */
export function nextReviewStage(from: PerformanceReviewStage, requiresHRReview: boolean): PerformanceReviewStage | undefined {
  const order = requiresHRReview ? REVIEW_STAGE_ORDER : REVIEW_STAGE_ORDER.filter((s) => s !== "HR Review");
  const idx = order.indexOf(from);
  if (idx === -1 || idx === order.length - 1) return undefined;
  return order[idx + 1];
}

/** A cycle's status gates which review-case stage is reachable — a case can sit behind the cycle's stage but never ahead of it. */
const CYCLE_TO_MAX_CASE_STAGE: Record<PerformanceCycleStatus, PerformanceReviewStage> = {
  Draft: "Draft",
  Open: "Goals Assigned",
  "Self Review": "Self Review",
  "Manager Review": "Manager Review",
  "HR Review": "HR Review",
  Completed: "Completed",
  Closed: "Completed",
};

export function canAdvanceReviewStage(cycleStatus: PerformanceCycleStatus, targetStage: PerformanceReviewStage): boolean {
  const maxIdx = REVIEW_STAGE_ORDER.indexOf(CYCLE_TO_MAX_CASE_STAGE[cycleStatus]);
  const targetIdx = REVIEW_STAGE_ORDER.indexOf(targetStage);
  return targetIdx >= 0 && targetIdx <= maxIdx;
}

/** A cycle's own status only ever moves one step forward — no skipping (section 14). "HR Review" is simply unreachable (and skipped over) for a cycle configured with requiresHRReview=false. */
const CYCLE_STATUS_ORDER: PerformanceCycleStatus[] = ["Draft", "Open", "Self Review", "Manager Review", "HR Review", "Completed", "Closed"];

export function nextCycleStatus(from: PerformanceCycleStatus, requiresHRReview: boolean): PerformanceCycleStatus | undefined {
  const order = requiresHRReview ? CYCLE_STATUS_ORDER : CYCLE_STATUS_ORDER.filter((s) => s !== "HR Review");
  const idx = order.indexOf(from);
  if (idx === -1 || idx === order.length - 1) return undefined;
  return order[idx + 1];
}

export function canTransitionCycleStatus(from: PerformanceCycleStatus, to: PerformanceCycleStatus, requiresHRReview: boolean): boolean {
  return nextCycleStatus(from, requiresHRReview) === to;
}

/* ------------------------------------------------------------------ */
/* Appraisal — salary/promotion recommendation math only; applying the   */
/* result reuses Phase 12's salary versioning / promotion logic exactly  */
/* (performance-context.tsx calls saveSalaryStructure / promoteEmployee   */
/* directly — this engine only computes the numbers).                    */
/* ------------------------------------------------------------------ */

export function calculateProposedCtc(previousCtcAnnual: number, incrementPercent: number): number {
  return Math.round(previousCtcAnnual * (1 + incrementPercent / 100));
}

export function calculateIncrementPercent(previousCtcAnnual: number, proposedCtcAnnual: number): number {
  if (previousCtcAnnual <= 0) return 0;
  return Math.round(((proposedCtcAnnual - previousCtcAnnual) / previousCtcAnnual) * 10000) / 100;
}

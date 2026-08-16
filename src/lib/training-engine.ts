/**
 * Pure Training engine — no store access, no React. Mirrors
 * recruitment-engine.ts / performance-engine.ts: every function takes
 * already-fetched data and returns derived values or pure decisions.
 * training-context.tsx is the only caller that touches stores/hooks.
 */
import type { TrainingEnrollment, TrainingEnrollmentStatus, TrainingProgramStatus } from "@/lib/types";

/** Enrollments that still occupy a seat — everything except Cancelled (section 12: Cancelled never counts as active). */
export function activeEnrollments(enrollments: TrainingEnrollment[]): TrainingEnrollment[] {
  return enrollments.filter((e) => e.status !== "Cancelled");
}

export function activeEnrollmentCount(enrollments: TrainingEnrollment[], trainingProgramId: string): number {
  return activeEnrollments(enrollments.filter((e) => e.trainingProgramId === trainingProgramId)).length;
}

export function isProgramFull(capacity: number, enrollments: TrainingEnrollment[], trainingProgramId: string): boolean {
  return activeEnrollmentCount(enrollments, trainingProgramId) >= capacity;
}

const FORWARD_PROGRAM_STATUS_ORDER: TrainingProgramStatus[] = ["Draft", "Published", "In Progress", "Completed"];

/** Draft -> Published -> In Progress -> Completed, one step at a time; Cancelled is reachable from anywhere still active (mirrors recruitment-engine.ts's nextStagesFrom pattern). */
export function nextProgramStatuses(status: TrainingProgramStatus): TrainingProgramStatus[] {
  if (status === "Completed" || status === "Cancelled") return [];
  const idx = FORWARD_PROGRAM_STATUS_ORDER.indexOf(status);
  const forward = idx >= 0 && idx < FORWARD_PROGRAM_STATUS_ORDER.length - 1 ? [FORWARD_PROGRAM_STATUS_ORDER[idx + 1]] : [];
  return [...forward, "Cancelled"];
}

export function canTransitionProgramStatus(from: TrainingProgramStatus, to: TrainingProgramStatus): boolean {
  return nextProgramStatuses(from).includes(to);
}

const ENROLLMENT_STATUS_ORDER: TrainingEnrollmentStatus[] = ["Registered", "Approved", "In Progress", "Completed"];

/** Registered -> Approved -> In Progress -> Completed/Failed/No Show, one step at a time; Cancelled reachable from any non-terminal state. */
export function nextEnrollmentStatuses(status: TrainingEnrollmentStatus): TrainingEnrollmentStatus[] {
  const terminal: TrainingEnrollmentStatus[] = ["Completed", "Failed", "Cancelled", "No Show"];
  if (terminal.includes(status)) return [];
  const idx = ENROLLMENT_STATUS_ORDER.indexOf(status);
  const forward = idx >= 0 && idx < ENROLLMENT_STATUS_ORDER.length - 1 ? [ENROLLMENT_STATUS_ORDER[idx + 1]] : (["Completed", "Failed", "No Show"] as TrainingEnrollmentStatus[]);
  return [...forward, "Cancelled"];
}

export interface TrainingCompletionSummary {
  total: number;
  completed: number;
  failed: number;
  noShow: number;
  inProgress: number;
  completionPct: number;
}

export function getTrainingCompletionSummary(enrollments: TrainingEnrollment[]): TrainingCompletionSummary {
  const active = activeEnrollments(enrollments);
  const completed = active.filter((e) => e.status === "Completed").length;
  const failed = active.filter((e) => e.status === "Failed").length;
  const noShow = active.filter((e) => e.status === "No Show").length;
  const inProgress = active.filter((e) => e.status === "Registered" || e.status === "Approved" || e.status === "In Progress").length;
  return {
    total: active.length,
    completed,
    failed,
    noShow,
    inProgress,
    completionPct: active.length > 0 ? Math.round((completed / active.length) * 100) : 0,
  };
}

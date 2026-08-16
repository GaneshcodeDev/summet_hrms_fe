"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import type {
  TrainingAttendance,
  TrainingEnrollment,
  TrainingProgram,
  TrainingRequest,
  TrainingRequirement,
  TrainingSession,
} from "@/lib/types";

// Real product starts with zero training records — see demo-seed.ts for the optional rich dataset.
export const trainingProgramsStore = createLocalStorageStore<TrainingProgram[]>("hrms_training_programs", []);
export const trainingSessionsStore = createLocalStorageStore<TrainingSession[]>("hrms_training_sessions", []);
export const trainingEnrollmentsStore = createLocalStorageStore<TrainingEnrollment[]>("hrms_training_enrollments", []);
export const trainingAttendanceStore = createLocalStorageStore<TrainingAttendance[]>("hrms_training_attendance", []);
export const trainingRequestsStore = createLocalStorageStore<TrainingRequest[]>("hrms_training_requests", []);
export const trainingRequirementsStore = createLocalStorageStore<TrainingRequirement[]>("hrms_training_requirements", []);

function nextSeqId(prefix: string, existingIds: string[]): string {
  const numbers = existingIds
    .map((id) => Number(id.replace(new RegExp(`^${prefix}`, "i"), "")))
    .filter((n) => Number.isFinite(n));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export function nextTrainingProgramId(): string {
  return nextSeqId("TRN-", trainingProgramsStore.getSnapshot().map((p) => p.id));
}
export function nextTrainingSessionId(): string {
  return nextSeqId("SESS-", trainingSessionsStore.getSnapshot().map((s) => s.id));
}
export function nextTrainingEnrollmentId(): string {
  return nextSeqId("ENR-", trainingEnrollmentsStore.getSnapshot().map((e) => e.id));
}
export function nextTrainingAttendanceId(): string {
  return nextSeqId("TATT-", trainingAttendanceStore.getSnapshot().map((a) => a.id));
}
export function nextTrainingRequestId(): string {
  return nextSeqId("TREQ-", trainingRequestsStore.getSnapshot().map((r) => r.id));
}
export function nextTrainingRequirementId(): string {
  return nextSeqId("TRQMT-", trainingRequirementsStore.getSnapshot().map((r) => r.id));
}

"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import type {
  AppraisalDecision,
  PerformanceAuditEntry,
  PerformanceCycle,
  PerformanceGoal,
  PerformanceReviewCase,
} from "@/lib/types";

// Real product starts with zero performance records — see demo-seed.ts for the optional rich dataset.
export const performanceCyclesStore = createLocalStorageStore<PerformanceCycle[]>("hrms_performance_cycles", []);
export const performanceGoalsStore = createLocalStorageStore<PerformanceGoal[]>("hrms_performance_goals", []);
export const performanceReviewCasesStore = createLocalStorageStore<PerformanceReviewCase[]>("hrms_performance_review_cases", []);
export const appraisalDecisionsStore = createLocalStorageStore<AppraisalDecision[]>("hrms_appraisal_decisions", []);
export const performanceAuditStore = createLocalStorageStore<PerformanceAuditEntry[]>("hrms_performance_audit", []);

export function logPerformanceAudit(entry: Omit<PerformanceAuditEntry, "id" | "timestamp">) {
  const record: PerformanceAuditEntry = {
    ...entry,
    id: `perf-evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  performanceAuditStore.update((events) => [record, ...events].slice(0, 1000));
  return record;
}

function nextSeqId(prefix: string, existingIds: string[]): string {
  const numbers = existingIds
    .map((id) => Number(id.replace(new RegExp(`^${prefix}`, "i"), "")))
    .filter((n) => Number.isFinite(n));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export function nextCycleId(): string {
  return nextSeqId("CYC-", performanceCyclesStore.getSnapshot().map((c) => c.id));
}

export function nextGoalId(): string {
  return nextSeqId("GOAL-", performanceGoalsStore.getSnapshot().map((g) => g.id));
}

export function nextAppraisalId(): string {
  return nextSeqId("APR-", appraisalDecisionsStore.getSnapshot().map((a) => a.id));
}

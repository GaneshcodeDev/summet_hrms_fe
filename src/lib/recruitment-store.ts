"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import type {
  Application,
  Candidate,
  Interview,
  JobOpening,
  JobRequisition,
  Offer,
  RecruitmentAuditEntry,
} from "@/lib/types";

// Real product starts with zero recruitment records — see demo-seed.ts for the optional rich dataset.
export const jobRequisitionsStore = createLocalStorageStore<JobRequisition[]>("hrms_job_requisitions", []);
export const jobOpeningsStore = createLocalStorageStore<JobOpening[]>("hrms_job_openings", []);
export const candidatesStore = createLocalStorageStore<Candidate[]>("hrms_candidates", []);
export const applicationsStore = createLocalStorageStore<Application[]>("hrms_applications", []);
export const interviewsStore = createLocalStorageStore<Interview[]>("hrms_interviews", []);
export const offersStore = createLocalStorageStore<Offer[]>("hrms_offers", []);
export const recruitmentAuditStore = createLocalStorageStore<RecruitmentAuditEntry[]>("hrms_recruitment_audit", []);

export function logRecruitmentAudit(entry: Omit<RecruitmentAuditEntry, "id" | "timestamp">) {
  const record: RecruitmentAuditEntry = {
    ...entry,
    id: `rec-evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  recruitmentAuditStore.update((events) => [record, ...events].slice(0, 500));
  return record;
}

/** Case/whitespace-insensitive — the same "already exists" check email/phone dedup needs everywhere a Candidate is created. */
export function findCandidateByEmailOrPhone(email: string, phone: string): Candidate | undefined {
  const normEmail = email.trim().toLowerCase();
  const normPhone = phone.trim();
  return candidatesStore.getSnapshot().find((c) => c.email.toLowerCase() === normEmail || (normPhone && c.phone === normPhone));
}

function nextSeqId(prefix: string, existingIds: string[]): string {
  const numbers = existingIds
    .map((id) => Number(id.replace(new RegExp(`^${prefix}`, "i"), "")))
    .filter((n) => Number.isFinite(n));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export function nextRequisitionId(): string {
  return nextSeqId("REQ-", jobRequisitionsStore.getSnapshot().map((r) => r.id));
}

export function nextJobOpeningId(): string {
  return nextSeqId("JOB-", jobOpeningsStore.getSnapshot().map((j) => j.id));
}

export function nextCandidateId(): string {
  return nextSeqId("CAND-", candidatesStore.getSnapshot().map((c) => c.id));
}

export function nextApplicationId(): string {
  return nextSeqId("APP-", applicationsStore.getSnapshot().map((a) => a.id));
}

export function nextInterviewId(): string {
  return nextSeqId("INT-", interviewsStore.getSnapshot().map((i) => i.id));
}

export function nextOfferId(): string {
  return nextSeqId("OFR-", offersStore.getSnapshot().map((o) => o.id));
}

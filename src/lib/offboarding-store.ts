"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import { seedOffboardingAudit, seedSeparationCases } from "@/lib/offboarding-data";
import type { OffboardingAuditEntry, SeparationCase } from "@/lib/types";

export const separationCasesStore = createLocalStorageStore<SeparationCase[]>("hrms_separation_cases", seedSeparationCases);
export const offboardingAuditStore = createLocalStorageStore<OffboardingAuditEntry[]>("hrms_offboarding_audit", seedOffboardingAudit);

export function logOffboardingAudit(entry: Omit<OffboardingAuditEntry, "id" | "timestamp">) {
  const record: OffboardingAuditEntry = {
    ...entry,
    id: `off-evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  offboardingAuditStore.update((events) => [record, ...events].slice(0, 500));
  return record;
}

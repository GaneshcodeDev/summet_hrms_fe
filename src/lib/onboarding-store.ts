"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import type { OnboardingAuditEntry, OnboardingCase } from "@/lib/types";

// Real product starts with zero onboarding cases — see demo-seed.ts for the optional rich dataset.
export const onboardingCasesStore = createLocalStorageStore<OnboardingCase[]>("hrms_onboarding_cases", []);
export const onboardingAuditStore = createLocalStorageStore<OnboardingAuditEntry[]>("hrms_onboarding_audit", []);

export function logOnboardingAudit(entry: Omit<OnboardingAuditEntry, "id" | "timestamp">) {
  const record: OnboardingAuditEntry = {
    ...entry,
    id: `ob-evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  onboardingAuditStore.update((events) => [record, ...events].slice(0, 500));
  return record;
}

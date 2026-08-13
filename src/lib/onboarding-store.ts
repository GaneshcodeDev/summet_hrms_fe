"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import { seedOnboardingAudit, seedOnboardingCases } from "@/lib/onboarding-data";
import type { OnboardingAuditEntry, OnboardingCase } from "@/lib/types";

export const onboardingCasesStore = createLocalStorageStore<OnboardingCase[]>("hrms_onboarding_cases", seedOnboardingCases);
export const onboardingAuditStore = createLocalStorageStore<OnboardingAuditEntry[]>("hrms_onboarding_audit", seedOnboardingAudit);

export function logOnboardingAudit(entry: Omit<OnboardingAuditEntry, "id" | "timestamp">) {
  const record: OnboardingAuditEntry = {
    ...entry,
    id: `ob-evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  onboardingAuditStore.update((events) => [record, ...events].slice(0, 500));
  return record;
}

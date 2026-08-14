"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import type { SiteOnboardingConfig } from "@/lib/types";

/**
 * Plain (non-React) persistence for per-site initial configuration
 * (attendance/leave/payroll/holiday defaults captured in Step 4 of the site
 * onboarding wizard), mirroring org-store.ts / rbac-store.ts. Distinct from
 * settings-store.ts, which holds global/platform-level settings.
 */
export const siteConfigsStore = createLocalStorageStore<SiteOnboardingConfig[]>("hrms_site_configs", []);

export function findSiteConfigBySiteId(siteId: string): SiteOnboardingConfig | undefined {
  return siteConfigsStore.getSnapshot().find((c) => c.siteId === siteId);
}

export function upsertSiteConfig(config: SiteOnboardingConfig) {
  siteConfigsStore.update((configs) => {
    const exists = configs.some((c) => c.siteId === config.siteId);
    return exists ? configs.map((c) => (c.siteId === config.siteId ? config : c)) : [...configs, config];
  });
}

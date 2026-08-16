"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { siteConfigsStore, upsertSiteConfig as upsertSiteConfigInStore } from "@/lib/site-config-store";
import { useAccessControl } from "@/lib/access-control-context";
import { useSite } from "@/lib/site-context";
import type { SiteOnboardingConfig } from "@/lib/types";

interface SiteConfigContextValue {
  siteConfigs: SiteOnboardingConfig[];
  configForSite: (siteId: string) => SiteOnboardingConfig | undefined;
  saveSiteConfig: (config: SiteOnboardingConfig) => void;
}

const SiteConfigContext = createContext<SiteConfigContextValue | undefined>(undefined);

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const { canFeature, isSuperAdmin } = useAccessControl();
  const { mappedSites } = useSite();
  const siteConfigs = useSyncExternalStore(
    siteConfigsStore.subscribe,
    siteConfigsStore.getSnapshot,
    siteConfigsStore.getServerSnapshot,
  );

  const configForSite = useCallback(
    (siteId: string) => siteConfigs.find((c) => c.siteId === siteId),
    [siteConfigs],
  );

  // Independent authorization (section 6) — previously anyone who could
  // call this function at all could rewrite ANY site's Attendance/Leave/
  // Payroll/Holiday configuration with no permission or site-scope check.
  const saveSiteConfig = useCallback(
    (config: SiteOnboardingConfig) => {
      if (!isSuperAdmin) {
        if (!canFeature("settings.organization", "edit") && !canFeature("organization.structure", "edit")) return;
        if (!mappedSites.some((s) => s.id === config.siteId)) return;
      }
      upsertSiteConfigInStore(config);
    },
    [isSuperAdmin, canFeature, mappedSites],
  );

  const value = useMemo<SiteConfigContextValue>(
    () => ({ siteConfigs, configForSite, saveSiteConfig }),
    [siteConfigs, configForSite, saveSiteConfig],
  );

  return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>;
}

export function useSiteConfig() {
  const ctx = useContext(SiteConfigContext);
  if (!ctx) throw new Error("useSiteConfig must be used within a SiteConfigProvider");
  return ctx;
}

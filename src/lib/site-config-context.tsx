"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { siteConfigsStore, upsertSiteConfig as upsertSiteConfigInStore } from "@/lib/site-config-store";
import { useAccessControl } from "@/lib/access-control-context";
import { useSite } from "@/lib/site-context";
import { getSiteConfig, setSiteConfig as apiSetSiteConfig } from "@/lib/api/sites-api";
import { isBackendConnected } from "@/lib/api/token-store";
import type { SiteOnboardingConfig } from "@/lib/types";

interface SiteConfigContextValue {
  siteConfigs: SiteOnboardingConfig[];
  configForSite: (siteId: string) => SiteOnboardingConfig | undefined;
  saveSiteConfig: (config: SiteOnboardingConfig) => Promise<void>;
  /** Call when a page starts viewing a given site's config — fetches it from the API when connected. */
  refreshConfig: (siteId: string) => Promise<void>;
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

  const refreshConfig = useCallback(async (siteId: string) => {
    if (!isBackendConnected() || !siteId) return;
    try {
      const apiConfig = await getSiteConfig(siteId);
      const mapped: SiteOnboardingConfig = {
        siteId,
        attendance: apiConfig.attendance as unknown as SiteOnboardingConfig["attendance"],
        leave: apiConfig.leave as unknown as SiteOnboardingConfig["leave"],
        payroll: apiConfig.payroll as unknown as SiteOnboardingConfig["payroll"],
        holiday: apiConfig.holiday as unknown as SiteOnboardingConfig["holiday"],
        updatedOn: apiConfig.updatedAt,
      };
      siteConfigsStore.set([...siteConfigsStore.getSnapshot().filter((c) => c.siteId !== siteId), mapped]);
    } catch {
      // No config saved for this site yet (404) — leave the local cache as-is
      // (emptyConfig() fallback in the Settings UI covers this case).
    }
  }, []);

  // Independent authorization (section 6) — previously anyone who could
  // call this function at all could rewrite ANY site's Attendance/Leave/
  // Payroll/Holiday configuration with no permission or site-scope check.
  // The backend independently re-checks this too (settings.organization
  // permission + SiteScopeGuard) — this client-side check is defense in
  // depth / better UX, never the only guard.
  const saveSiteConfig = useCallback(
    async (config: SiteOnboardingConfig) => {
      if (!isSuperAdmin) {
        if (!canFeature("settings.organization", "edit") && !canFeature("organization.structure", "edit")) return;
        if (!mappedSites.some((s) => s.id === config.siteId)) return;
      }

      if (isBackendConnected()) {
        const updated = await apiSetSiteConfig(config.siteId, {
          attendance: config.attendance as unknown as Record<string, unknown>,
          leave: config.leave as unknown as Record<string, unknown>,
          payroll: config.payroll as unknown as Record<string, unknown>,
          holiday: config.holiday as unknown as Record<string, unknown>,
        });
        const mapped: SiteOnboardingConfig = {
          siteId: config.siteId,
          attendance: updated.attendance as unknown as SiteOnboardingConfig["attendance"],
          leave: updated.leave as unknown as SiteOnboardingConfig["leave"],
          payroll: updated.payroll as unknown as SiteOnboardingConfig["payroll"],
          holiday: updated.holiday as unknown as SiteOnboardingConfig["holiday"],
          updatedOn: updated.updatedAt,
        };
        siteConfigsStore.set([...siteConfigsStore.getSnapshot().filter((c) => c.siteId !== config.siteId), mapped]);
        return;
      }
      upsertSiteConfigInStore(config);
    },
    [isSuperAdmin, canFeature, mappedSites],
  );

  const value = useMemo<SiteConfigContextValue>(
    () => ({ siteConfigs, configForSite, saveSiteConfig, refreshConfig }),
    [siteConfigs, configForSite, saveSiteConfig, refreshConfig],
  );

  return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>;
}

export function useSiteConfig() {
  const ctx = useContext(SiteConfigContext);
  if (!ctx) throw new Error("useSiteConfig must be used within a SiteConfigProvider");
  return ctx;
}

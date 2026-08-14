"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { siteConfigsStore, upsertSiteConfig as upsertSiteConfigInStore } from "@/lib/site-config-store";
import type { SiteOnboardingConfig } from "@/lib/types";

interface SiteConfigContextValue {
  siteConfigs: SiteOnboardingConfig[];
  configForSite: (siteId: string) => SiteOnboardingConfig | undefined;
  saveSiteConfig: (config: SiteOnboardingConfig) => void;
}

const SiteConfigContext = createContext<SiteConfigContextValue | undefined>(undefined);

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const siteConfigs = useSyncExternalStore(
    siteConfigsStore.subscribe,
    siteConfigsStore.getSnapshot,
    siteConfigsStore.getServerSnapshot,
  );

  const configForSite = useCallback(
    (siteId: string) => siteConfigs.find((c) => c.siteId === siteId),
    [siteConfigs],
  );

  const saveSiteConfig = useCallback((config: SiteOnboardingConfig) => {
    upsertSiteConfigInStore(config);
  }, []);

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

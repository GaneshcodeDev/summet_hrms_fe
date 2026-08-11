"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { sites as initialSites } from "@/lib/mock-data";
import { createLocalStorageStore } from "@/lib/local-store";
import { useAccessControl } from "@/lib/access-control-context";
import type { Site } from "@/lib/types";

export const ALL_SITES_ID = "all";

const siteIdStore = createLocalStorageStore<string>("hrms_current_site", ALL_SITES_ID);
const sitesStore = createLocalStorageStore<Site[]>("hrms_sites", initialSites);

interface SiteContextValue {
  sites: Site[];
  currentSiteId: string;
  currentSite: Site | undefined;
  isAllSites: boolean;
  setCurrentSiteId: (id: string) => void;
  addSite: (site: Site) => void;
  updateSite: (id: string, patch: Partial<Site>) => void;
  /** Whether the signed-in user holds the platform-wide Super Admin role. */
  isSuperAdmin: boolean;
  /** Sites the signed-in user is mapped to and can switch their working context between. */
  mappedSites: Site[];
}

const SiteContext = createContext<SiteContextValue | undefined>(undefined);

export function SiteProvider({ children }: { children: ReactNode }) {
  const sites = useSyncExternalStore(
    sitesStore.subscribe,
    sitesStore.getSnapshot,
    sitesStore.getServerSnapshot,
  );
  const rawSiteId = useSyncExternalStore(
    siteIdStore.subscribe,
    siteIdStore.getSnapshot,
    siteIdStore.getServerSnapshot,
  );

  const currentSite = useMemo(
    () => sites.find((s) => s.id === rawSiteId),
    [sites, rawSiteId],
  );
  // Fall back to "All Sites" if the stored id no longer matches a known site
  // (e.g. mock in-memory data reset while the selection was still persisted).
  const isAllSites = rawSiteId === ALL_SITES_ID || !currentSite;
  const currentSiteId = isAllSites ? ALL_SITES_ID : rawSiteId;

  const setCurrentSiteId = useCallback((id: string) => siteIdStore.set(id), []);

  const addSite = useCallback((site: Site) => {
    sitesStore.set([...sitesStore.getSnapshot(), site]);
  }, []);

  const updateSite = useCallback((id: string, patch: Partial<Site>) => {
    sitesStore.set(
      sitesStore.getSnapshot().map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }, []);

  const { currentUser, isSuperAdmin } = useAccessControl();
  const mappedSiteIds = currentUser.siteIds ?? [currentUser.siteId];
  const mappedSites = useMemo(
    () => sites.filter((s) => mappedSiteIds.includes(s.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sites, currentUser],
  );

  const value = useMemo(
    () => ({
      sites,
      currentSiteId,
      currentSite: isAllSites ? undefined : currentSite,
      isAllSites,
      setCurrentSiteId,
      addSite,
      updateSite,
      isSuperAdmin,
      mappedSites,
    }),
    [sites, currentSiteId, currentSite, isAllSites, setCurrentSiteId, addSite, updateSite, isSuperAdmin, mappedSites],
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite must be used within a SiteProvider");
  return ctx;
}

export function useSiteFilter<T extends { siteId?: string }>(items: T[]): T[] {
  const { currentSiteId, isAllSites } = useSite();
  return useMemo(
    () => (isAllSites ? items : items.filter((item) => item.siteId === currentSiteId)),
    [items, currentSiteId, isAllSites],
  );
}

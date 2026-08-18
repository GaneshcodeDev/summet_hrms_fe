"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createLocalStorageStore } from "@/lib/local-store";
import { useAccessControl } from "@/lib/access-control-context";
import { apiSiteToSite, siteToApiUpdatePayload } from "@/lib/api/mappers";
import { listSites, updateSite as apiUpdateSite } from "@/lib/api/sites-api";
import { isBackendConnected } from "@/lib/api/token-store";
import type { Site } from "@/lib/types";

export const ALL_SITES_ID = "all";

const siteIdStore = createLocalStorageStore<string>("hrms_current_site", ALL_SITES_ID);
// Real product starts with zero sites — see demo-seed.ts for the optional rich dataset.
// Exported (unlike a purely-internal store) so demo-seed.ts can hydrate it without a provider mounted.
//
// Phase 18B: Sites are now backend-authoritative for any session with a
// live backend connection (see lib/api/token-store.ts) — this store
// becomes a client-side CACHE of the API response in that case, refreshed
// on mount and after every mutation. Sessions with no backend connection
// (almost every local demo account — see rbac-data.ts backendBridgeAccount)
// keep behaving exactly as before, entirely local.
export const sitesStore = createLocalStorageStore<Site[]>("hrms_sites", []);

interface SiteContextValue {
  sites: Site[];
  currentSiteId: string;
  currentSite: Site | undefined;
  isAllSites: boolean;
  setCurrentSiteId: (id: string) => void;
  addSite: (site: Site) => void;
  updateSite: (id: string, patch: Partial<Site>) => Promise<void>;
  /** Whether the signed-in user holds the platform-wide Super Admin role. */
  isSuperAdmin: boolean;
  /** Sites the signed-in user is mapped to and can switch their working context between. */
  mappedSites: Site[];
  /** True once this session has a live backend connection (see lib/api/token-store.ts). */
  isBackendConnected: boolean;
  /** Re-fetches the site list from the API — call after creating a site (e.g. onboarding). */
  refreshSites: () => Promise<void>;
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
  const [connected, setConnected] = useState(false);

  const refreshSites = useCallback(async () => {
    // The `await` below defers everything after it (including setConnected)
    // to a microtask — callers (including the mount effect) never see a
    // setState call execute synchronously within their own call frame.
    await Promise.resolve();
    if (!isBackendConnected()) {
      setConnected(false);
      return;
    }
    setConnected(true);
    const apiSites = await listSites();
    sitesStore.set(apiSites.map(apiSiteToSite));
  }, []);

  useEffect(() => {
    void refreshSites();
  }, [refreshSites]);

  const { currentUser, isSuperAdmin } = useAccessControl();
  const mappedSiteIds = useMemo(
    () => currentUser.siteIds ?? [currentUser.siteId],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser],
  );
  const mappedSites = useMemo(
    () => sites.filter((s) => mappedSiteIds.includes(s.id)),
    [sites, mappedSiteIds],
  );

  // Super Admin can freely pick any site (including the "All Sites" aggregate
  // view). Everyone else is pinned to a site they're actually mapped to,
  // regardless of what's persisted in localStorage — this is enforced here,
  // at the data layer, not just by hiding the switcher in the UI, so a Site
  // Admin can never end up viewing another site's data.
  const effectiveSiteId = useMemo(() => {
    if (isSuperAdmin) return rawSiteId;
    if (rawSiteId !== ALL_SITES_ID && mappedSiteIds.includes(rawSiteId)) return rawSiteId;
    return mappedSites[0]?.id ?? ALL_SITES_ID;
  }, [isSuperAdmin, rawSiteId, mappedSiteIds, mappedSites]);

  const currentSite = useMemo(
    () => sites.find((s) => s.id === effectiveSiteId),
    [sites, effectiveSiteId],
  );
  // Fall back to "All Sites" if the effective id doesn't match a known site
  // (e.g. mock in-memory data reset while the selection was still persisted).
  const isAllSites = effectiveSiteId === ALL_SITES_ID || !currentSite;
  const currentSiteId = isAllSites ? ALL_SITES_ID : effectiveSiteId;

  const setCurrentSiteId = useCallback((id: string) => siteIdStore.set(id), []);

  const addSite = useCallback((site: Site) => {
    sitesStore.set([...sitesStore.getSnapshot(), site]);
  }, []);

  const updateSite = useCallback(async (id: string, patch: Partial<Site>) => {
    if (isBackendConnected()) {
      const updated = await apiUpdateSite(id, siteToApiUpdatePayload(patch));
      const mapped = apiSiteToSite(updated);
      sitesStore.set(sitesStore.getSnapshot().map((s) => (s.id === id ? mapped : s)));
      return;
    }
    sitesStore.set(
      sitesStore.getSnapshot().map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }, []);

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
      isBackendConnected: connected,
      refreshSites,
    }),
    [
      sites,
      currentSiteId,
      currentSite,
      isAllSites,
      setCurrentSiteId,
      addSite,
      updateSite,
      isSuperAdmin,
      mappedSites,
      connected,
      refreshSites,
    ],
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

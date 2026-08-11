"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import { seedOrgAuditEntries, seedOrgUnits } from "@/lib/org-data";
import type { OrgAuditEntry, OrgUnit } from "@/lib/types";

/**
 * Plain (non-React) persistence for org units and their audit trail, mirroring
 * rbac-store.ts. Kept outside the context so any part of the app (or a future
 * server sync layer) can read/write without needing a provider mounted.
 */
export const orgUnitsStore = createLocalStorageStore<OrgUnit[]>("hrms_org_units", seedOrgUnits);
export const orgAuditStore = createLocalStorageStore<OrgAuditEntry[]>("hrms_org_audit", seedOrgAuditEntries);

export function logOrgAudit(entry: Omit<OrgAuditEntry, "id" | "timestamp">) {
  const record: OrgAuditEntry = {
    ...entry,
    id: `org-evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  orgAuditStore.update((events) => [record, ...events].slice(0, 500));
  return record;
}

export function findOrgUnitById(id: string): OrgUnit | undefined {
  return orgUnitsStore.getSnapshot().find((u) => u.id === id);
}

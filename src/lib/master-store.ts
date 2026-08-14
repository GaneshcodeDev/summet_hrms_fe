"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import { masterTypeConfig, seedMasterRecords } from "@/lib/master-data";
import type { MasterAuditEntry, MasterRecord } from "@/lib/types";

/**
 * Plain (non-React) persistence for master records and their audit trail,
 * mirroring org-store.ts / rbac-store.ts.
 *
 * Global-scope masters (Country/State/City/Bank) are genuine platform
 * reference data, not tenant data, so they're always seeded. Tenant-scoped
 * masters (Designation, Shift, Leave Type, ...) start empty — see
 * demo-seed.ts for the optional rich demo dataset.
 */
const globalOnlySeed = seedMasterRecords.filter((r) => masterTypeConfig[r.masterType].scope === "global");

export const masterRecordsStore = createLocalStorageStore<MasterRecord[]>("hrms_master_records", globalOnlySeed);
export const masterAuditStore = createLocalStorageStore<MasterAuditEntry[]>("hrms_master_audit", []);

export function logMasterAudit(entry: Omit<MasterAuditEntry, "id" | "timestamp">) {
  const record: MasterAuditEntry = {
    ...entry,
    id: `master-evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  masterAuditStore.update((events) => [record, ...events].slice(0, 500));
  return record;
}

export function findMasterRecordById(id: string): MasterRecord | undefined {
  return masterRecordsStore.getSnapshot().find((r) => r.id === id);
}

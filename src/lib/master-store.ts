"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import { seedMasterRecords } from "@/lib/master-data";
import type { MasterAuditEntry, MasterRecord } from "@/lib/types";

/**
 * Plain (non-React) persistence for master records and their audit trail,
 * mirroring org-store.ts / rbac-store.ts.
 */
export const masterRecordsStore = createLocalStorageStore<MasterRecord[]>("hrms_master_records", seedMasterRecords);
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

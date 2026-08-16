"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import type { Asset, AssetAssignment, AssetAuditEntry, AssetDisposal, AssetMaintenance, AssetRequest } from "@/lib/types";

// Real product starts with zero asset records — see demo-seed.ts for the optional rich dataset.
export const assetsStore = createLocalStorageStore<Asset[]>("hrms_assets", []);
export const assetAssignmentsStore = createLocalStorageStore<AssetAssignment[]>("hrms_asset_assignments", []);
export const assetMaintenanceStore = createLocalStorageStore<AssetMaintenance[]>("hrms_asset_maintenance", []);
export const assetDisposalsStore = createLocalStorageStore<AssetDisposal[]>("hrms_asset_disposals", []);
export const assetRequestsStore = createLocalStorageStore<AssetRequest[]>("hrms_asset_requests", []);
export const assetAuditStore = createLocalStorageStore<AssetAuditEntry[]>("hrms_asset_audit", []);

export function logAssetAudit(entry: Omit<AssetAuditEntry, "id" | "timestamp">) {
  const record: AssetAuditEntry = {
    ...entry,
    id: `asset-evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  assetAuditStore.update((events) => [record, ...events].slice(0, 1000));
  return record;
}

function nextSeqId(prefix: string, existingIds: string[]): string {
  const numbers = existingIds
    .map((id) => Number(id.replace(new RegExp(`^${prefix}`, "i"), "")))
    .filter((n) => Number.isFinite(n));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export function nextAssetId(): string {
  return nextSeqId("AST-", assetsStore.getSnapshot().map((a) => a.id));
}
export function nextAssetAssignmentId(): string {
  return nextSeqId("ASGN-", assetAssignmentsStore.getSnapshot().map((a) => a.id));
}
export function nextAssetMaintenanceId(): string {
  return nextSeqId("MAINT-", assetMaintenanceStore.getSnapshot().map((a) => a.id));
}
export function nextAssetDisposalId(): string {
  return nextSeqId("DISP-", assetDisposalsStore.getSnapshot().map((a) => a.id));
}
export function nextAssetRequestId(): string {
  return nextSeqId("AREQ-", assetRequestsStore.getSnapshot().map((a) => a.id));
}

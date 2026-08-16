/**
 * Pure Asset Management engine — no store access, no React. Mirrors
 * skill-engine.ts / training-engine.ts: every function takes already-
 * fetched data and returns derived values or pure decisions.
 * asset-context.tsx is the only caller that touches stores/hooks.
 */
import type { Asset, AssetAssignment, AssetCondition, AssetStatus } from "@/lib/types";

/** Every assignment on file for one asset, oldest first — ordered by `createdOn` (a real timestamp), never the day-precision `assignedDate`. */
export function assignmentHistoryFor(assignments: AssetAssignment[], assetId: string): AssetAssignment[] {
  return assignments
    .filter((a) => a.assetId === assetId)
    .sort((a, b) => (a.createdOn < b.createdOn ? -1 : a.createdOn > b.createdOn ? 1 : 0));
}

/** The active (not yet returned/transferred-out) assignment for an asset, or undefined if it's sitting in inventory. At most one should ever exist — this picks the most recent if that invariant is somehow violated. */
export function selectCurrentAssignment(assignments: AssetAssignment[], assetId: string): AssetAssignment | undefined {
  const active = assignmentHistoryFor(assignments, assetId).filter((a) => !a.returnedDate);
  return active[active.length - 1];
}

export function assignmentsForEmployee(assignments: AssetAssignment[], employeeId: string): AssetAssignment[] {
  return assignments
    .filter((a) => a.employeeId === employeeId)
    .sort((a, b) => (a.createdOn < b.createdOn ? -1 : a.createdOn > b.createdOn ? 1 : 0));
}

export function activeAssignmentsForEmployee(assignments: AssetAssignment[], employeeId: string): AssetAssignment[] {
  return assignmentsForEmployee(assignments, employeeId).filter((a) => !a.returnedDate);
}

/** Available unless the returned condition itself calls for maintenance/write-off — never silently keeps a damaged unit "Available" (section 11). */
export function nextStatusAfterReturn(conditionAtReturn: AssetCondition): AssetStatus {
  return conditionAtReturn === "Damaged" ? "Damaged" : "Available";
}

export interface AssetInventorySummary {
  total: number;
  available: number;
  assigned: number;
  maintenance: number;
  damaged: number;
  retired: number;
  disposed: number;
  lost: number;
}

export function getAssetInventorySummary(assets: Asset[]): AssetInventorySummary {
  const count = (status: AssetStatus) => assets.filter((a) => a.status === status).length;
  return {
    total: assets.length,
    available: count("Available"),
    assigned: count("Assigned"),
    maintenance: count("Under Maintenance"),
    damaged: count("Damaged"),
    retired: count("Retired"),
    disposed: count("Disposed"),
    lost: count("Lost"),
  };
}

/**
 * Offboarding's Asset Clearance (section 13) is always derived, never
 * stored — "Cleared" the instant every assigned asset has a real return on
 * file, "Pending" otherwise. No separate flag that could drift out of sync.
 */
export function isAssetClearanceComplete(assignments: AssetAssignment[], employeeId: string): boolean {
  return activeAssignmentsForEmployee(assignments, employeeId).length === 0;
}

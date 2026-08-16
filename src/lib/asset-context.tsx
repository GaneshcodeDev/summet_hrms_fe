"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  assetAssignmentsStore,
  assetAuditStore,
  assetDisposalsStore,
  assetMaintenanceStore,
  assetRequestsStore,
  assetsStore,
  logAssetAudit,
  nextAssetAssignmentId,
  nextAssetDisposalId,
  nextAssetId,
  nextAssetMaintenanceId,
  nextAssetRequestId,
} from "@/lib/asset-store";
import {
  activeAssignmentsForEmployee as engineActiveAssignmentsForEmployee,
  assignmentHistoryFor,
  assignmentsForEmployee as engineAssignmentsForEmployee,
  nextStatusAfterReturn,
  selectCurrentAssignment,
} from "@/lib/asset-engine";
import { useAccessControl } from "@/lib/access-control-context";
import { useEmployees } from "@/lib/employee-context";
import { useApprovals } from "@/lib/approval-context";
import { useNotifications } from "@/lib/notification-context";
import type {
  Asset,
  AssetAssignment,
  AssetCondition,
  AssetDisposal,
  AssetMaintenance,
  AssetRequest,
  AssetStatus,
} from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

interface CreateAssetInput {
  siteId: string;
  assetTypeId: string;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  warrantyExpiry?: string;
  vendor?: string;
  location?: string;
  condition: AssetCondition;
  remarks?: string;
}

interface AssignAssetInput {
  conditionAtAssignment: AssetCondition;
  remarks?: string;
}

interface ReturnAssetInput {
  conditionAtReturn: AssetCondition;
  remarks?: string;
  damageNotes?: string;
}

interface TransferAssetInput {
  reason: string;
  conditionAtTransfer?: AssetCondition;
}

interface StartMaintenanceInput {
  issue: string;
  reportedDate?: string;
  vendor?: string;
  remarks?: string;
}

interface CompleteMaintenanceInput {
  cost?: number;
  remarks?: string;
}

interface DisposeAssetInput {
  reason: string;
  remarks?: string;
}

interface RequestAssetInput {
  employeeId: string;
  siteId: string;
  assetTypeId: string;
  reason: string;
  requestedDate: string;
}

interface AssetContextValue {
  assets: Asset[];
  assetsForSite: (siteId: string) => Asset[];
  assetById: (id: string) => Asset | undefined;
  canManageAssets: boolean;
  createAsset: (input: CreateAssetInput) => ActionResult & { asset?: Asset };

  assignments: AssetAssignment[];
  currentAssignmentFor: (assetId: string) => AssetAssignment | undefined;
  assignmentHistoryFor: (assetId: string) => AssetAssignment[];
  assignmentsForEmployee: (employeeId: string) => AssetAssignment[];
  activeAssignmentsForEmployee: (employeeId: string) => AssetAssignment[];
  assignAsset: (assetId: string, employeeId: string, input: AssignAssetInput) => ActionResult;
  returnAsset: (assignmentId: string, input: ReturnAssetInput) => ActionResult;
  transferAsset: (assetId: string, newEmployeeId: string, input: TransferAssetInput) => ActionResult;

  maintenanceRecords: AssetMaintenance[];
  maintenanceForAsset: (assetId: string) => AssetMaintenance[];
  startMaintenance: (assetId: string, input: StartMaintenanceInput) => ActionResult;
  completeMaintenance: (id: string, input: CompleteMaintenanceInput) => ActionResult;
  markDamaged: (assetId: string, remarks?: string) => ActionResult;

  disposals: AssetDisposal[];
  disposalFor: (assetId: string) => AssetDisposal | undefined;
  retireAsset: (assetId: string, remarks?: string) => ActionResult;
  disposeAsset: (assetId: string, input: DisposeAssetInput) => ActionResult;

  requests: AssetRequest[];
  requestsFor: (employeeId: string) => AssetRequest[];
  visibleRequests: () => AssetRequest[];
  canDecideRequests: boolean;
  requestAsset: (input: RequestAssetInput) => ActionResult & { request?: AssetRequest };
  decideAssetRequest: (id: string, decision: "Approved" | "Rejected", comment?: string) => ActionResult;
  fulfillAssetRequest: (requestId: string, assetId: string) => ActionResult;

  auditFor: (assetId: string) => ReturnType<typeof assetAuditStore.getSnapshot>;
}

const AssetContext = createContext<AssetContextValue | undefined>(undefined);

export function AssetProvider({ children }: { children: ReactNode }) {
  const { currentUser, canFeature } = useAccessControl();
  const { getEmployeeByEmployeeId } = useEmployees();
  const { recordMirroredAction } = useApprovals();
  const { notify } = useNotifications();

  const assets = useSyncExternalStore(assetsStore.subscribe, assetsStore.getSnapshot, assetsStore.getServerSnapshot);
  const assignments = useSyncExternalStore(assetAssignmentsStore.subscribe, assetAssignmentsStore.getSnapshot, assetAssignmentsStore.getServerSnapshot);
  const maintenanceRecords = useSyncExternalStore(assetMaintenanceStore.subscribe, assetMaintenanceStore.getSnapshot, assetMaintenanceStore.getServerSnapshot);
  const disposals = useSyncExternalStore(assetDisposalsStore.subscribe, assetDisposalsStore.getSnapshot, assetDisposalsStore.getServerSnapshot);
  const requests = useSyncExternalStore(assetRequestsStore.subscribe, assetRequestsStore.getSnapshot, assetRequestsStore.getServerSnapshot);
  const auditEntries = useSyncExternalStore(assetAuditStore.subscribe, assetAuditStore.getSnapshot, assetAuditStore.getServerSnapshot);

  const canManageAssets = canFeature("assets.inventory", "create") || canFeature("assets.inventory", "edit") || canFeature("assets.inventory", "manage");
  const canDecideRequests = canFeature("assets.requests", "approve") || canFeature("assets.requests", "manage");

  const isDirectManagerOf = useCallback(
    (employeeId: string) => {
      const target = getEmployeeByEmployeeId(employeeId);
      return !!target && target.reportingManagerId === currentUser.employeeId;
    },
    [getEmployeeByEmployeeId, currentUser.employeeId],
  );

  const assetsForSite = useCallback((siteId: string) => assets.filter((a) => a.siteId === siteId), [assets]);
  const assetById = useCallback((id: string) => assets.find((a) => a.id === id), [assets]);

  const logAudit = useCallback(
    (assetId: string, action: Parameters<typeof logAssetAudit>[0]["action"], detail: string) =>
      logAssetAudit({ assetId, action, detail, actorName: currentUser.name }),
    [currentUser.name],
  );

  const createAsset = useCallback(
    (input: CreateAssetInput): ActionResult & { asset?: Asset } => {
      if (!canManageAssets) return { ok: false, message: "You're not authorized to add assets." };
      if (!input.name.trim()) return { ok: false, message: "Asset name is required." };
      const seq = assets.filter((a) => a.siteId === input.siteId).length + 1;
      const asset: Asset = {
        id: nextAssetId(),
        assetCode: `${input.siteId.slice(-1).toUpperCase()}A${String(seq).padStart(3, "0")}`,
        siteId: input.siteId,
        assetTypeId: input.assetTypeId,
        name: input.name.trim(),
        brand: input.brand?.trim() || undefined,
        model: input.model?.trim() || undefined,
        serialNumber: input.serialNumber?.trim() || undefined,
        purchaseDate: input.purchaseDate || undefined,
        purchaseCost: input.purchaseCost,
        warrantyExpiry: input.warrantyExpiry || undefined,
        vendor: input.vendor?.trim() || undefined,
        location: input.location?.trim() || undefined,
        condition: input.condition,
        status: "Available",
        remarks: input.remarks?.trim() || undefined,
        createdBy: currentUser.name,
        createdOn: new Date().toISOString().slice(0, 10),
      };
      assetsStore.set([asset, ...assetsStore.getSnapshot()]);
      logAudit(asset.id, "created", `Asset "${asset.name}" (${asset.assetCode}) added to inventory.`);
      return { ok: true, message: `Asset "${asset.name}" added.`, asset };
    },
    [canManageAssets, assets, currentUser.name, logAudit],
  );

  const currentAssignmentFor = useCallback((assetId: string) => selectCurrentAssignment(assignments, assetId), [assignments]);
  const assignmentHistoryForFn = useCallback((assetId: string) => assignmentHistoryFor(assignments, assetId), [assignments]);
  const assignmentsForEmployeeFn = useCallback((employeeId: string) => engineAssignmentsForEmployee(assignments, employeeId), [assignments]);
  const activeAssignmentsForEmployeeFn = useCallback((employeeId: string) => engineActiveAssignmentsForEmployee(assignments, employeeId), [assignments]);

  const assignAsset = useCallback(
    (assetId: string, employeeId: string, input: AssignAssetInput): ActionResult => {
      if (!canManageAssets) return { ok: false, message: "You're not authorized to assign assets." };
      const asset = assetsStore.getSnapshot().find((a) => a.id === assetId);
      if (!asset) return { ok: false, message: "Asset not found." };
      if (asset.status !== "Available") return { ok: false, message: `This asset is currently "${asset.status}" and can't be assigned.` };
      const employee = getEmployeeByEmployeeId(employeeId);
      if (!employee) return { ok: false, message: "Employee not found." };
      if (employee.siteId !== asset.siteId) return { ok: false, message: "This employee doesn't belong to the asset's site." };

      const record: AssetAssignment = {
        id: nextAssetAssignmentId(),
        assetId,
        employeeId,
        siteId: asset.siteId,
        assignedDate: new Date().toISOString().slice(0, 10),
        assignedBy: currentUser.name,
        conditionAtAssignment: input.conditionAtAssignment,
        remarks: input.remarks?.trim() || undefined,
        createdOn: new Date().toISOString(),
      };
      assetAssignmentsStore.set([record, ...assetAssignmentsStore.getSnapshot()]);
      assetsStore.set(assetsStore.getSnapshot().map((a) => (a.id === assetId ? { ...a, status: "Assigned" as AssetStatus, condition: input.conditionAtAssignment } : a)));
      logAudit(assetId, "assigned", `Assigned to ${employee.name}.`);
      notify({
        employeeId,
        type: "info",
        title: "Asset assigned to you",
        message: `${asset.name} (${asset.assetCode}) has been assigned to you.`,
        module: "Asset",
        recordId: assetId,
        href: `/assets/${assetId}`,
      });
      return { ok: true, message: `${asset.name} assigned to ${employee.name}.` };
    },
    [canManageAssets, getEmployeeByEmployeeId, currentUser.name, logAudit, notify],
  );

  const returnAsset = useCallback(
    (assignmentId: string, input: ReturnAssetInput): ActionResult => {
      if (!canManageAssets) return { ok: false, message: "You're not authorized to record asset returns." };
      const assignment = assetAssignmentsStore.getSnapshot().find((a) => a.id === assignmentId);
      if (!assignment) return { ok: false, message: "Assignment not found." };
      if (assignment.returnedDate) return { ok: false, message: "This assignment has already been closed." };
      const asset = assetsStore.getSnapshot().find((a) => a.id === assignment.assetId);
      if (!asset) return { ok: false, message: "Asset not found." };

      const today = new Date().toISOString().slice(0, 10);
      assetAssignmentsStore.set(
        assetAssignmentsStore.getSnapshot().map((a) =>
          a.id === assignmentId
            ? { ...a, returnedDate: today, returnedBy: currentUser.name, conditionAtReturn: input.conditionAtReturn, returnRemarks: input.remarks?.trim() || undefined, damageNotes: input.damageNotes?.trim() || undefined }
            : a,
        ),
      );
      const newStatus = nextStatusAfterReturn(input.conditionAtReturn);
      assetsStore.set(assetsStore.getSnapshot().map((a) => (a.id === asset.id ? { ...a, status: newStatus, condition: input.conditionAtReturn } : a)));
      const employee = getEmployeeByEmployeeId(assignment.employeeId);
      logAudit(asset.id, "returned", `Returned by ${employee?.name ?? assignment.employeeId} — condition ${input.conditionAtReturn}.`);
      return { ok: true, message: `${asset.name} marked as returned.` };
    },
    [canManageAssets, getEmployeeByEmployeeId, currentUser.name, logAudit],
  );

  const transferAsset = useCallback(
    (assetId: string, newEmployeeId: string, input: TransferAssetInput): ActionResult => {
      if (!canManageAssets) return { ok: false, message: "You're not authorized to transfer assets." };
      const asset = assetsStore.getSnapshot().find((a) => a.id === assetId);
      if (!asset) return { ok: false, message: "Asset not found." };
      const current = selectCurrentAssignment(assetAssignmentsStore.getSnapshot(), assetId);
      if (!current) return { ok: false, message: "This asset isn't currently assigned to anyone." };
      if (current.employeeId === newEmployeeId) return { ok: false, message: "This asset is already assigned to that employee." };
      const newEmployee = getEmployeeByEmployeeId(newEmployeeId);
      if (!newEmployee) return { ok: false, message: "Employee not found." };
      if (newEmployee.siteId !== asset.siteId) return { ok: false, message: "This employee doesn't belong to the asset's site." };
      if (!input.reason.trim()) return { ok: false, message: "A reason is required to transfer an asset." };

      const oldEmployee = getEmployeeByEmployeeId(current.employeeId);
      const today = new Date().toISOString().slice(0, 10);
      const condition = input.conditionAtTransfer ?? current.conditionAtAssignment;

      // Auditable transaction, not a silent employeeId mutation (section 14): close the current assignment as a transfer, then open a brand new one.
      assetAssignmentsStore.set(
        assetAssignmentsStore.getSnapshot().map((a) =>
          a.id === current.id
            ? { ...a, returnedDate: today, returnedBy: currentUser.name, conditionAtReturn: condition, returnRemarks: input.reason.trim(), transferredToEmployeeId: newEmployeeId }
            : a,
        ),
      );
      const newAssignment: AssetAssignment = {
        id: nextAssetAssignmentId(),
        assetId,
        employeeId: newEmployeeId,
        siteId: asset.siteId,
        assignedDate: today,
        assignedBy: currentUser.name,
        conditionAtAssignment: condition,
        remarks: `Transferred from ${oldEmployee?.name ?? current.employeeId} — ${input.reason.trim()}`,
        createdOn: new Date().toISOString(),
      };
      assetAssignmentsStore.set([newAssignment, ...assetAssignmentsStore.getSnapshot()]);
      assetsStore.set(assetsStore.getSnapshot().map((a) => (a.id === assetId ? { ...a, condition } : a)));
      logAudit(assetId, "transferred", `Transferred from ${oldEmployee?.name ?? current.employeeId} to ${newEmployee.name} — ${input.reason.trim()}.`);
      return { ok: true, message: `${asset.name} transferred to ${newEmployee.name}.` };
    },
    [canManageAssets, getEmployeeByEmployeeId, currentUser.name, logAudit],
  );

  const maintenanceForAsset = useCallback((assetId: string) => maintenanceRecords.filter((m) => m.assetId === assetId), [maintenanceRecords]);

  const startMaintenance = useCallback(
    (assetId: string, input: StartMaintenanceInput): ActionResult => {
      if (!canManageAssets) return { ok: false, message: "You're not authorized to log asset maintenance." };
      const asset = assetsStore.getSnapshot().find((a) => a.id === assetId);
      if (!asset) return { ok: false, message: "Asset not found." };
      if (asset.status === "Retired" || asset.status === "Disposed") return { ok: false, message: `This asset is ${asset.status.toLowerCase()} and can't be sent for maintenance.` };
      if (!input.issue.trim()) return { ok: false, message: "An issue description is required." };
      const today = new Date().toISOString().slice(0, 10);
      const record: AssetMaintenance = {
        id: nextAssetMaintenanceId(),
        assetId,
        siteId: asset.siteId,
        issue: input.issue.trim(),
        reportedDate: input.reportedDate || today,
        maintenanceStart: today,
        vendor: input.vendor?.trim() || undefined,
        remarks: input.remarks?.trim() || undefined,
        status: "In Progress",
        createdBy: currentUser.name,
        createdOn: today,
      };
      assetMaintenanceStore.set([record, ...assetMaintenanceStore.getSnapshot()]);
      assetsStore.set(assetsStore.getSnapshot().map((a) => (a.id === assetId ? { ...a, status: "Under Maintenance" as AssetStatus } : a)));
      logAudit(assetId, "maintenance_started", `Maintenance started — ${input.issue.trim()}.`);
      return { ok: true, message: "Maintenance logged." };
    },
    [canManageAssets, currentUser.name, logAudit],
  );

  const completeMaintenance = useCallback(
    (id: string, input: CompleteMaintenanceInput): ActionResult => {
      if (!canManageAssets) return { ok: false, message: "You're not authorized to complete asset maintenance." };
      const record = assetMaintenanceStore.getSnapshot().find((m) => m.id === id);
      if (!record) return { ok: false, message: "Maintenance record not found." };
      if (record.status === "Completed") return { ok: false, message: "This maintenance record is already completed." };
      const today = new Date().toISOString().slice(0, 10);
      assetMaintenanceStore.set(
        assetMaintenanceStore.getSnapshot().map((m) =>
          m.id === id ? { ...m, status: "Completed" as const, maintenanceEnd: today, cost: input.cost, remarks: input.remarks?.trim() || m.remarks } : m,
        ),
      );
      // Revert to whatever's actually true — still assigned to someone, or back in the pool.
      const stillAssigned = selectCurrentAssignment(assetAssignmentsStore.getSnapshot(), record.assetId);
      assetsStore.set(assetsStore.getSnapshot().map((a) => (a.id === record.assetId ? { ...a, status: stillAssigned ? "Assigned" : "Available" } : a)));
      logAudit(record.assetId, "maintenance_completed", `Maintenance completed${input.cost !== undefined ? ` — cost ₹${input.cost.toLocaleString("en-IN")}` : ""}.`);
      return { ok: true, message: "Maintenance marked completed." };
    },
    [canManageAssets, logAudit],
  );

  const markDamaged = useCallback(
    (assetId: string, remarks?: string): ActionResult => {
      if (!canManageAssets) return { ok: false, message: "You're not authorized to update asset condition." };
      const asset = assetsStore.getSnapshot().find((a) => a.id === assetId);
      if (!asset) return { ok: false, message: "Asset not found." };
      assetsStore.set(assetsStore.getSnapshot().map((a) => (a.id === assetId ? { ...a, status: "Damaged" as AssetStatus, condition: "Damaged", remarks: remarks?.trim() || a.remarks } : a)));
      logAudit(assetId, "marked_damaged", remarks?.trim() || "Marked damaged.");
      return { ok: true, message: `${asset.name} marked as damaged.` };
    },
    [canManageAssets, logAudit],
  );

  const disposalFor = useCallback((assetId: string) => disposals.find((d) => d.assetId === assetId), [disposals]);

  const retireAsset = useCallback(
    (assetId: string, remarks?: string): ActionResult => {
      if (!canManageAssets) return { ok: false, message: "You're not authorized to retire assets." };
      const asset = assetsStore.getSnapshot().find((a) => a.id === assetId);
      if (!asset) return { ok: false, message: "Asset not found." };
      if (asset.status === "Disposed") return { ok: false, message: "This asset has already been disposed." };
      if (selectCurrentAssignment(assetAssignmentsStore.getSnapshot(), assetId)) {
        return { ok: false, message: "This asset is still assigned — return it before retiring." };
      }
      assetsStore.set(assetsStore.getSnapshot().map((a) => (a.id === assetId ? { ...a, status: "Retired" as AssetStatus, remarks: remarks?.trim() || a.remarks } : a)));
      logAudit(assetId, "retired", remarks?.trim() || "Retired.");
      return { ok: true, message: `${asset.name} retired.` };
    },
    [canManageAssets, logAudit],
  );

  const disposeAsset = useCallback(
    (assetId: string, input: DisposeAssetInput): ActionResult => {
      if (!canManageAssets) return { ok: false, message: "You're not authorized to dispose assets." };
      const asset = assetsStore.getSnapshot().find((a) => a.id === assetId);
      if (!asset) return { ok: false, message: "Asset not found." };
      if (asset.status !== "Retired") return { ok: false, message: "Only a retired asset can be disposed." };
      if (!input.reason.trim()) return { ok: false, message: "A reason is required to dispose an asset." };
      const disposal: AssetDisposal = {
        id: nextAssetDisposalId(),
        assetId,
        siteId: asset.siteId,
        disposalDate: new Date().toISOString().slice(0, 10),
        reason: input.reason.trim(),
        approvedBy: currentUser.name,
        remarks: input.remarks?.trim() || undefined,
        createdOn: new Date().toISOString(),
      };
      assetDisposalsStore.set([disposal, ...assetDisposalsStore.getSnapshot()]);
      assetsStore.set(assetsStore.getSnapshot().map((a) => (a.id === assetId ? { ...a, status: "Disposed" as AssetStatus } : a)));
      logAudit(assetId, "disposed", `Disposed — ${input.reason.trim()}.`);
      return { ok: true, message: `${asset.name} disposed.` };
    },
    [canManageAssets, currentUser.name, logAudit],
  );

  const requestsFor = useCallback((employeeId: string) => requests.filter((r) => r.employeeId === employeeId), [requests]);
  const visibleRequests = useCallback(() => {
    if (canDecideRequests) return requests;
    return requests.filter((r) => r.employeeId === currentUser.employeeId || isDirectManagerOf(r.employeeId));
  }, [requests, canDecideRequests, currentUser.employeeId, isDirectManagerOf]);

  const requestAsset = useCallback(
    (input: RequestAssetInput): ActionResult & { request?: AssetRequest } => {
      if (input.employeeId !== currentUser.employeeId) return { ok: false, message: "You can only submit an asset request for yourself." };
      if (!canFeature("assets.requests", "create")) return { ok: false, message: "You're not authorized to request assets." };
      if (!input.reason.trim()) return { ok: false, message: "A reason is required." };
      const request: AssetRequest = {
        id: nextAssetRequestId(),
        employeeId: input.employeeId,
        siteId: input.siteId,
        assetTypeId: input.assetTypeId,
        reason: input.reason.trim(),
        requestedDate: input.requestedDate,
        status: "Pending",
      };
      assetRequestsStore.set([request, ...assetRequestsStore.getSnapshot()]);
      recordMirroredAction({
        siteId: input.siteId,
        module: "Asset",
        recordId: request.id,
        recordOwnerEmployeeId: input.employeeId,
        recordOwnerName: currentUser.name,
        approverType: "REPORTING_MANAGER",
        action: "APPLY",
        newStatus: "Pending",
        comment: input.reason,
      });
      return { ok: true, message: "Asset request submitted.", request };
    },
    [currentUser.employeeId, currentUser.name, canFeature, recordMirroredAction],
  );

  const decideAssetRequest = useCallback(
    (id: string, decision: "Approved" | "Rejected", comment?: string): ActionResult => {
      const request = assetRequestsStore.getSnapshot().find((r) => r.id === id);
      if (!request) return { ok: false, message: "Asset request not found." };
      // Unconditional — no one can approve their own asset request (section 24).
      if (request.employeeId === currentUser.employeeId) return { ok: false, message: "You cannot decide your own asset request." };
      if (!canDecideRequests && !isDirectManagerOf(request.employeeId)) {
        return { ok: false, message: "You're not authorized to decide this request." };
      }
      if (request.status !== "Pending") return { ok: false, message: "This request has already been decided." };
      if (decision === "Rejected" && !comment?.trim()) return { ok: false, message: "A reason is required to reject." };

      const today = new Date().toISOString().slice(0, 10);
      assetRequestsStore.set(
        assetRequestsStore.getSnapshot().map((r) => (r.id === id ? { ...r, status: decision, decidedBy: currentUser.name, decidedOn: today, comment: comment?.trim() || r.comment } : r)),
      );
      recordMirroredAction({
        siteId: request.siteId,
        module: "Asset",
        recordId: request.id,
        recordOwnerEmployeeId: request.employeeId,
        recordOwnerName: getEmployeeByEmployeeId(request.employeeId)?.name ?? request.employeeId,
        approverType: isDirectManagerOf(request.employeeId) ? "REPORTING_MANAGER" : "HR",
        action: decision === "Approved" ? "APPROVE" : "REJECT",
        newStatus: decision,
        comment,
        advanceToNextStep: true,
      });
      return { ok: true, message: decision === "Approved" ? "Request approved." : "Request rejected." };
    },
    [currentUser.employeeId, currentUser.name, canDecideRequests, isDirectManagerOf, recordMirroredAction, getEmployeeByEmployeeId],
  );

  const fulfillAssetRequest = useCallback(
    (requestId: string, assetId: string): ActionResult => {
      if (!canManageAssets) return { ok: false, message: "You're not authorized to fulfil asset requests." };
      const request = assetRequestsStore.getSnapshot().find((r) => r.id === requestId);
      if (!request) return { ok: false, message: "Asset request not found." };
      if (request.status !== "Approved") return { ok: false, message: "Only an approved request can be fulfilled." };
      const result = assignAsset(assetId, request.employeeId, { conditionAtAssignment: assetsStore.getSnapshot().find((a) => a.id === assetId)?.condition ?? "Good" });
      if (!result.ok) return result;
      assetRequestsStore.set(assetRequestsStore.getSnapshot().map((r) => (r.id === requestId ? { ...r, status: "Assigned" as const, assignedAssetId: assetId } : r)));
      return { ok: true, message: "Request fulfilled — asset assigned." };
    },
    [canManageAssets, assignAsset],
  );

  const auditFor = useCallback((assetId: string) => auditEntries.filter((e) => e.assetId === assetId), [auditEntries]);

  const value = useMemo<AssetContextValue>(
    () => ({
      assets,
      assetsForSite,
      assetById,
      canManageAssets,
      createAsset,

      assignments,
      currentAssignmentFor,
      assignmentHistoryFor: assignmentHistoryForFn,
      assignmentsForEmployee: assignmentsForEmployeeFn,
      activeAssignmentsForEmployee: activeAssignmentsForEmployeeFn,
      assignAsset,
      returnAsset,
      transferAsset,

      maintenanceRecords,
      maintenanceForAsset,
      startMaintenance,
      completeMaintenance,
      markDamaged,

      disposals,
      disposalFor,
      retireAsset,
      disposeAsset,

      requests,
      requestsFor,
      visibleRequests,
      canDecideRequests,
      requestAsset,
      decideAssetRequest,
      fulfillAssetRequest,

      auditFor,
    }),
    [
      assets,
      assetsForSite,
      assetById,
      canManageAssets,
      createAsset,
      assignments,
      currentAssignmentFor,
      assignmentHistoryForFn,
      assignmentsForEmployeeFn,
      activeAssignmentsForEmployeeFn,
      assignAsset,
      returnAsset,
      transferAsset,
      maintenanceRecords,
      maintenanceForAsset,
      startMaintenance,
      completeMaintenance,
      markDamaged,
      disposals,
      disposalFor,
      retireAsset,
      disposeAsset,
      requests,
      requestsFor,
      visibleRequests,
      canDecideRequests,
      requestAsset,
      decideAssetRequest,
      fulfillAssetRequest,
      auditFor,
    ],
  );

  return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>;
}

export function useAssets() {
  const ctx = useContext(AssetContext);
  if (!ctx) throw new Error("useAssets must be used within an AssetProvider");
  return ctx;
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { approvalEvents, approvalInstancesStore } from "@/lib/approval-store";
import { employeesStore } from "@/lib/employee-store";
import { orgUnitsStore } from "@/lib/org-store";
import { useAccessControl } from "@/lib/access-control-context";
import {
  buildAction,
  getPendingApprovalsForSite,
  getPendingApprovalsForUser,
  isAuthorizedApprover,
  isFinalStep,
} from "@/lib/approval-engine";
import type {
  ApprovalAction,
  ApprovalActionType,
  ApprovalInstance,
  ApprovalInstanceStatus,
  ApprovalModule,
  ApproverType,
  WorkflowStepChain,
} from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

interface CreateInstanceInput {
  siteId: string;
  module: ApprovalModule;
  recordId: string;
  steps: WorkflowStepChain;
}

interface RecordMirroredActionInput {
  siteId: string;
  module: ApprovalModule;
  recordId: string;
  recordOwnerEmployeeId: string;
  recordOwnerName: string;
  approverType: ApproverType;
  action: ApprovalActionType;
  newStatus: ApprovalInstanceStatus;
  comment?: string;
  /** Defaults to the record owner (used for the initial APPLY entry) — pass the actual decider for APPROVE/REJECT/CANCEL. */
  actorEmployeeId?: string;
  actorName?: string;
  /** Defaults to now — pass the module's own appliedOn/decidedOn for an accurate history timeline. */
  timestamp?: string;
  /** Full chain to create the instance with, for a module whose existing flow is genuinely multi-step (e.g. Expense Claims' Manager→Finance) — only used the first time (instance creation); ignored on later calls. Defaults to a single step of `approverType`. */
  steps?: WorkflowStepChain;
  /** Which step this action belongs to — defaults to the instance's current step. Pass this explicitly for the 2nd+ step of a pre-declared multi-step mirror so the Approval History attributes each decision to the right step instead of collapsing them all onto step 0. */
  stepOrder?: number;
  /** True when this action should move the instance to the next step rather than finalize it (mirrors an intermediate approval in an existing multi-step flow, e.g. Manager approving before Finance decides). */
  advanceToNextStep?: boolean;
}

interface ApprovalContextValue {
  instances: ApprovalInstance[];
  instanceFor: (module: ApprovalModule, recordId: string) => ApprovalInstance | undefined;
  instancesForSite: (siteId: string) => ApprovalInstance[];
  pendingForSite: (siteId: string) => ApprovalInstance[];
  pendingForUser: (moduleFeatureId: string) => ApprovalInstance[];
  /** Can the signed-in user act on this instance's CURRENT step right now? Pure authorization check, no mutation. */
  canAct: (instance: ApprovalInstance, moduleFeatureId: string) => boolean;
  createInstance: (input: CreateInstanceInput) => ApprovalInstance;
  /**
   * Active gate: advances/finalizes an instance after checking the current
   * step's authorization itself (self-approval always blocked). Returns
   * `completed`/`finalStatus` so the calling module knows whether to also
   * finalize its own record (e.g. Leave only syncs Attendance/Payroll once
   * `finalStatus === "Approved"` on a completed instance).
   */
  act: (
    module: ApprovalModule,
    recordId: string,
    action: "APPROVE" | "REJECT" | "CANCEL",
    moduleFeatureId: string,
    comment?: string,
  ) => ActionResult & { instance?: ApprovalInstance; completed?: boolean; finalStatus?: ApprovalInstanceStatus };
  /** Passive mirror for modules keeping their own existing gating (Regularization/Expense/Loan/Payroll) — records a decision that already happened elsewhere, purely for the shared audit trail / Approval History UI. Never re-authorizes anything. */
  recordMirroredAction: (input: RecordMirroredActionInput) => void;
}

const ApprovalContext = createContext<ApprovalContextValue | undefined>(undefined);

export function ApprovalProvider({ children }: { children: ReactNode }) {
  const { currentUser, canFeature } = useAccessControl();

  const instances = useSyncExternalStore(
    approvalInstancesStore.subscribe,
    approvalInstancesStore.getSnapshot,
    approvalInstancesStore.getServerSnapshot,
  );
  // Plain-module subscriptions (no provider-order dependency), same pattern
  // as leave-context.tsx / regularization-context.tsx.
  const employees = useSyncExternalStore(employeesStore.subscribe, employeesStore.getSnapshot, employeesStore.getServerSnapshot);
  const orgUnits = useSyncExternalStore(orgUnitsStore.subscribe, orgUnitsStore.getSnapshot, orgUnitsStore.getServerSnapshot);

  const instanceFor = useCallback(
    (module: ApprovalModule, recordId: string) => instances.find((i) => i.module === module && i.recordId === recordId),
    [instances],
  );
  const instancesForSite = useCallback((siteId: string) => instances.filter((i) => i.siteId === siteId), [instances]);
  const pendingForSite = useCallback((siteId: string) => getPendingApprovalsForSite(instances, siteId), [instances]);

  const authContextFor = useCallback(
    (moduleFeatureId: string) => ({
      currentUserEmployeeId: currentUser.employeeId,
      currentUserRoleNames: currentUser.roles.map((r) => r.name),
      employees,
      orgUnits,
      canFeature,
      moduleFeatureId,
    }),
    [currentUser.employeeId, currentUser.roles, employees, orgUnits, canFeature],
  );

  const canAct = useCallback(
    (instance: ApprovalInstance, moduleFeatureId: string) => {
      if (instance.status !== "Pending") return false;
      const step = instance.steps[instance.currentStep];
      if (!step) return false;
      return isAuthorizedApprover(step, instance.requestedBy, authContextFor(moduleFeatureId));
    },
    [authContextFor],
  );

  const pendingForUser = useCallback(
    (moduleFeatureId: string) => getPendingApprovalsForUser(instances, (i) => canAct(i, moduleFeatureId)),
    [instances, canAct],
  );

  const createInstance = useCallback(
    (input: CreateInstanceInput): ApprovalInstance => {
      const now = new Date().toISOString();
      const applyAction: ApprovalAction = buildAction({
        stepOrder: 0,
        approverType: input.steps[0]?.approverType ?? "REPORTING_MANAGER",
        actorEmployeeId: currentUser.employeeId,
        actorName: currentUser.name,
        action: "APPLY",
        previousStatus: "Pending",
        newStatus: "Pending",
      });
      const instance: ApprovalInstance = {
        id: `appr-${input.module}-${input.recordId}`,
        siteId: input.siteId,
        module: input.module,
        recordId: input.recordId,
        steps: input.steps,
        currentStep: 0,
        status: input.steps.length === 0 ? "Approved" : "Pending",
        requestedBy: currentUser.employeeId,
        requestedByName: currentUser.name,
        requestedAt: now,
        completedAt: input.steps.length === 0 ? now : undefined,
        actions: [applyAction],
      };
      approvalInstancesStore.set([instance, ...approvalInstancesStore.getSnapshot()]);
      approvalEvents.emit("onApprovalRequested", instance);
      return instance;
    },
    [currentUser.employeeId, currentUser.name],
  );

  const act = useCallback(
    (
      module: ApprovalModule,
      recordId: string,
      action: "APPROVE" | "REJECT" | "CANCEL",
      moduleFeatureId: string,
      comment?: string,
    ): ActionResult & { instance?: ApprovalInstance; completed?: boolean; finalStatus?: ApprovalInstanceStatus } => {
      const instance = approvalInstancesStore.getSnapshot().find((i) => i.module === module && i.recordId === recordId);
      if (!instance) return { ok: false, message: "Approval instance not found." };
      if (instance.status !== "Pending") return { ok: false, message: "This request has already been decided." };
      const step = instance.steps[instance.currentStep];
      if (!step) return { ok: false, message: "This approval has no active step." };

      const isOwner = instance.requestedBy === currentUser.employeeId;
      const authorized = action === "CANCEL" ? isOwner || isAuthorizedApprover(step, instance.requestedBy, authContextFor(moduleFeatureId)) : isAuthorizedApprover(step, instance.requestedBy, authContextFor(moduleFeatureId));
      if (!authorized) {
        return { ok: false, message: "You're not authorized to act on this approval." };
      }
      if (action === "REJECT" && !comment?.trim()) {
        return { ok: false, message: "A reason is required to reject." };
      }

      let newStatus: ApprovalInstanceStatus;
      let nextStep = instance.currentStep;
      let completed = false;
      if (action === "REJECT") {
        newStatus = "Rejected";
        completed = true;
      } else if (action === "CANCEL") {
        newStatus = "Cancelled";
        completed = true;
      } else if (isFinalStep(instance)) {
        newStatus = "Approved";
        completed = true;
      } else {
        newStatus = "Pending";
        nextStep = instance.currentStep + 1;
      }

      const actionRecord = buildAction({
        stepOrder: instance.currentStep,
        approverType: step.approverType,
        actorEmployeeId: currentUser.employeeId,
        actorName: currentUser.name,
        action,
        previousStatus: instance.status,
        newStatus,
        comment: comment?.trim() || undefined,
      });

      const updated: ApprovalInstance = {
        ...instance,
        currentStep: nextStep,
        status: newStatus,
        completedAt: completed ? new Date().toISOString() : instance.completedAt,
        actions: [...instance.actions, actionRecord],
      };
      approvalInstancesStore.set(approvalInstancesStore.getSnapshot().map((i) => (i.id === instance.id ? updated : i)));

      if (newStatus === "Approved") approvalEvents.emit("onApprovalApproved", updated);
      else if (newStatus === "Rejected") approvalEvents.emit("onApprovalRejected", updated);
      else if (newStatus === "Cancelled") approvalEvents.emit("onApprovalCancelled", updated);

      return {
        ok: true,
        message: completed
          ? newStatus === "Approved"
            ? "Approved."
            : newStatus === "Rejected"
              ? "Rejected."
              : "Cancelled."
          : `Approved — moved to the next step (${instance.steps[nextStep]?.approverType ?? ""}).`,
        instance: updated,
        completed,
        finalStatus: newStatus,
      };
    },
    [currentUser.employeeId, currentUser.name, authContextFor],
  );

  const recordMirroredAction = useCallback((input: RecordMirroredActionInput) => {
    const now = input.timestamp ?? new Date().toISOString();
    const existing = approvalInstancesStore.getSnapshot().find((i) => i.module === input.module && i.recordId === input.recordId);
    const stepOrder = input.stepOrder ?? existing?.currentStep ?? 0;
    const actionRecord: ApprovalAction = buildAction({
      stepOrder,
      approverType: input.approverType,
      actorEmployeeId: input.actorEmployeeId ?? input.recordOwnerEmployeeId,
      actorName: input.actorName ?? input.recordOwnerName,
      action: input.action,
      previousStatus: existing?.status ?? "Pending",
      newStatus: input.newStatus,
      comment: input.comment,
    });
    actionRecord.timestamp = now;
    const nextStep = input.advanceToNextStep ? stepOrder + 1 : (existing?.currentStep ?? stepOrder);

    if (existing) {
      approvalInstancesStore.set(
        approvalInstancesStore.getSnapshot().map((i) =>
          i.id === existing.id
            ? {
                ...i,
                currentStep: nextStep,
                status: input.newStatus,
                completedAt: input.newStatus !== "Pending" ? now : i.completedAt,
                actions: [...i.actions, actionRecord],
              }
            : i,
        ),
      );
    } else {
      const instance: ApprovalInstance = {
        id: `appr-${input.module}-${input.recordId}`,
        siteId: input.siteId,
        module: input.module,
        recordId: input.recordId,
        steps: input.steps ?? [{ order: 0, approverType: input.approverType, required: true }],
        currentStep: nextStep,
        status: input.newStatus,
        requestedBy: input.recordOwnerEmployeeId,
        requestedByName: input.recordOwnerName,
        requestedAt: now,
        completedAt: input.newStatus !== "Pending" ? now : undefined,
        actions: [actionRecord],
      };
      approvalInstancesStore.set([instance, ...approvalInstancesStore.getSnapshot()]);
    }
  }, []);

  const value = useMemo<ApprovalContextValue>(
    () => ({
      instances,
      instanceFor,
      instancesForSite,
      pendingForSite,
      pendingForUser,
      canAct,
      createInstance,
      act,
      recordMirroredAction,
    }),
    [instances, instanceFor, instancesForSite, pendingForSite, pendingForUser, canAct, createInstance, act, recordMirroredAction],
  );

  return <ApprovalContext.Provider value={value}>{children}</ApprovalContext.Provider>;
}

export function useApprovals() {
  const ctx = useContext(ApprovalContext);
  if (!ctx) throw new Error("useApprovals must be used within an ApprovalProvider");
  return ctx;
}

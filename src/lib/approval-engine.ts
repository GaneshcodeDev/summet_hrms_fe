/**
 * Pure Approval Workflow engine — no store access, no React. Mirrors the
 * payroll-engine.ts / leave-engine.ts pattern: every function takes
 * already-fetched, already-scoped data and returns derived values.
 * approval-context.tsx is the only caller that touches stores/hooks.
 *
 * Two ways a module can use this engine:
 *  - As an active GATE (only Leave's "Manager then HR" mode does this today):
 *    resolveWorkflowSteps() produces the chain, isAuthorizedApprover() is
 *    checked before allowing an action, and the instance's own currentStep/
 *    status is the source of truth for whether the underlying record may
 *    move to its final approved state.
 *  - As a passive MIRROR (Regularization, Expense, Loan, Payroll today):
 *    the module keeps its own existing authorization/status logic exactly
 *    as-is, and only calls recordApprovalAction() afterward so the shared
 *    audit trail / Approval History UI has something to show. No gating.
 */
import type {
  ApprovalAction,
  ApprovalActionType,
  ApprovalInstance,
  ApprovalInstanceStatus,
  ApproverType,
  Employee,
  LeaveApprovalMode,
  OrgUnit,
  PermissionAction,
  WorkflowStep,
  WorkflowStepChain,
} from "@/lib/types";

export function resolveLeaveWorkflowSteps(approvalMode: LeaveApprovalMode): WorkflowStepChain {
  switch (approvalMode) {
    case "HR":
      return [{ order: 0, approverType: "HR", required: true }];
    case "Manager then HR":
      return [
        { order: 0, approverType: "REPORTING_MANAGER", required: true },
        { order: 1, approverType: "HR", required: true },
      ];
    case "Manager":
    default:
      return [{ order: 0, approverType: "REPORTING_MANAGER", required: true }];
  }
}

/** A single, descriptive step — used for modules that only mirror an existing single-decision flow into the shared audit trail (see file header). */
export function singleStepWorkflow(approverType: ApproverType): WorkflowStepChain {
  return [{ order: 0, approverType, required: true }];
}

export interface ApproverResolutionContext {
  employees: Employee[];
  orgUnits: OrgUnit[];
}

/** Concrete employeeId(s) who satisfy this step, where that's meaningful (REPORTING_MANAGER/DEPARTMENT_HEAD/SPECIFIC_USER). HR/SITE_ADMIN/PAYROLL_ADMIN resolve via permission/role instead — see isAuthorizedApprover. */
export function resolveApproverEmployeeIds(step: WorkflowStep, subjectEmployeeId: string, ctx: ApproverResolutionContext): string[] {
  const subject = ctx.employees.find((e) => e.employeeId === subjectEmployeeId);
  switch (step.approverType) {
    case "REPORTING_MANAGER":
      return subject?.reportingManagerId ? [subject.reportingManagerId] : [];
    case "DEPARTMENT_HEAD": {
      const unit = subject?.departmentId ? ctx.orgUnits.find((u) => u.id === subject.departmentId) : undefined;
      return unit?.headEmployeeId ? [unit.headEmployeeId] : [];
    }
    case "SPECIFIC_USER":
      return step.specificEmployeeId ? [step.specificEmployeeId] : [];
    case "HR":
    case "SITE_ADMIN":
    case "PAYROLL_ADMIN":
      return [];
  }
}

export interface AuthorizationContext {
  currentUserEmployeeId: string;
  currentUserRoleNames: string[];
  employees: Employee[];
  orgUnits: OrgUnit[];
  canFeature: (featureId: string, action: PermissionAction) => boolean;
  /** The RBAC feature id backing this module's "broad/HR" scope, e.g. "leave.requests". */
  moduleFeatureId: string;
}

/**
 * Never authorizes the request's own subject — self-approval is blocked
 * unconditionally here, before any approverType-specific check runs, so no
 * combination of roles/permissions can bypass it (spec section 14).
 */
export function isAuthorizedApprover(step: WorkflowStep, subjectEmployeeId: string, ctx: AuthorizationContext): boolean {
  if (subjectEmployeeId === ctx.currentUserEmployeeId) return false;
  switch (step.approverType) {
    case "REPORTING_MANAGER": {
      const subject = ctx.employees.find((e) => e.employeeId === subjectEmployeeId);
      return subject?.reportingManagerId === ctx.currentUserEmployeeId;
    }
    case "DEPARTMENT_HEAD": {
      const subject = ctx.employees.find((e) => e.employeeId === subjectEmployeeId);
      const unit = subject?.departmentId ? ctx.orgUnits.find((u) => u.id === subject.departmentId) : undefined;
      return unit?.headEmployeeId === ctx.currentUserEmployeeId;
    }
    case "HR":
      return ctx.canFeature(ctx.moduleFeatureId, "edit") || ctx.canFeature(ctx.moduleFeatureId, "manage");
    case "SITE_ADMIN":
      return ctx.currentUserRoleNames.includes("Site Admin") || ctx.currentUserRoleNames.includes("Super Admin");
    case "PAYROLL_ADMIN":
      return ctx.currentUserRoleNames.includes("Payroll Admin");
    case "SPECIFIC_USER":
      return step.specificEmployeeId === ctx.currentUserEmployeeId;
  }
}

/** True once every step has approved. */
export function isFinalStep(instance: Pick<ApprovalInstance, "steps" | "currentStep">): boolean {
  return instance.currentStep >= instance.steps.length - 1;
}

/** Builds one ApprovalAction entry — a pure record, not a store write. */
export function buildAction(input: {
  stepOrder: number;
  approverType: ApproverType;
  actorEmployeeId?: string;
  actorName: string;
  action: ApprovalActionType;
  previousStatus: ApprovalInstanceStatus;
  newStatus: ApprovalInstanceStatus;
  comment?: string;
}): ApprovalAction {
  return {
    id: `appr-act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...input,
  };
}

export function getPendingApprovalsForUser(instances: ApprovalInstance[], canAct: (instance: ApprovalInstance) => boolean): ApprovalInstance[] {
  return instances.filter((i) => i.status === "Pending" && canAct(i));
}

export function getPendingApprovalsForSite(instances: ApprovalInstance[], siteId: string): ApprovalInstance[] {
  return instances.filter((i) => i.siteId === siteId && i.status === "Pending");
}

/** Human-readable label for the current state, e.g. "Awaiting Manager Approval" / "Awaiting HR Approval". */
export function currentStepLabel(instance: Pick<ApprovalInstance, "steps" | "currentStep" | "status">): string {
  if (instance.status !== "Pending") return instance.status;
  const step = instance.steps[instance.currentStep];
  const names: Record<ApproverType, string> = {
    REPORTING_MANAGER: "Manager",
    DEPARTMENT_HEAD: "Department Head",
    HR: "HR",
    SITE_ADMIN: "Site Admin",
    PAYROLL_ADMIN: "Payroll Admin",
    SPECIFIC_USER: "Approver",
  };
  return step ? `Awaiting ${names[step.approverType]} Approval` : "Pending";
}

import { Ban, Check, Clock, X } from "lucide-react";
import type { ApprovalInstance, ApproverType } from "@/lib/types";

const approverLabel: Record<ApproverType, string> = {
  REPORTING_MANAGER: "Manager",
  DEPARTMENT_HEAD: "Department Head",
  HR: "HR",
  SITE_ADMIN: "Site Admin",
  PAYROLL_ADMIN: "Payroll Admin",
  SPECIFIC_USER: "Approver",
};

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Reusable step-by-step approval timeline — Step / Approver / Action /
 * Comment / Date, driven entirely by one ApprovalInstance (see
 * approval-context.tsx). Works for single-step and multi-step workflows
 * alike, and for any module (Leave, Regularization, Expense, Loan, Payroll)
 * that records instances.
 */
export function ApprovalHistory({ instance }: { instance: ApprovalInstance }) {
  const terminalAction = instance.actions.find((a) => a.action === "REJECT" || a.action === "CANCEL");

  return (
    <div className="space-y-3">
      {instance.steps.map((step) => {
        const decision = instance.actions.find((a) => a.stepOrder === step.order && a.action !== "APPLY");
        const isCurrent = instance.status === "Pending" && instance.currentStep === step.order;
        const isSkipped = terminalAction && terminalAction.stepOrder < step.order;

        return (
          <div key={step.order} className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
              {decision?.action === "APPROVE" ? (
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : decision?.action === "REJECT" ? (
                <X className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              ) : decision?.action === "CANCEL" ? (
                <Ban className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              ) : (
                <Clock className={`h-4 w-4 ${isCurrent ? "text-amber-500" : "text-slate-300 dark:text-slate-600"}`} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{approverLabel[step.approverType]}</p>
              {decision ? (
                <>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {decision.action === "APPROVE" ? "Approved" : decision.action === "REJECT" ? "Rejected" : "Cancelled"} by{" "}
                    {decision.actorName}
                  </p>
                  {decision.comment && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">&ldquo;{decision.comment}&rdquo;</p>}
                  <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{formatTimestamp(decision.timestamp)}</p>
                </>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500">{isSkipped ? "Not required" : isCurrent ? "Pending" : "Waiting"}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { FormEvent, useMemo, useState } from "react";
import { Check, History, Plus, X, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { Can } from "@/components/auth/permission-gate";
import { ApprovalHistory } from "@/components/approvals/approval-history";
import { useLeave } from "@/lib/leave-context";
import { currentStepLabel } from "@/lib/approval-engine";
import { useAccessControl } from "@/lib/access-control-context";
import { useEmployees } from "@/lib/employee-context";
import { useSite, useSiteFilter } from "@/lib/site-context";
import { useToast } from "@/lib/toast-context";
import type { ApprovalInstance, HalfDayPortion, LeaveRequest, MasterRecord } from "@/lib/types";

export default function LeavePage() {
  const { currentUser, canFeature } = useAccessControl();
  const { currentSite, isAllSites } = useSite();
  const { employees, getEmployeeByEmployeeId, employeesForSite } = useEmployees();
  const toast = useToast();
  const {
    requestsFor,
    visibleTeamRequests,
    leaveTypesForSite,
    previewDays,
    balanceSummaryFor,
    applyLeave,
    approveLeave,
    rejectLeave,
    canCancel,
    cancelLeave,
    canDecide,
    approvalInstanceFor,
  } = useLeave();

  const [active, setActive] = useState("my");
  const [modalOpen, setModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);
  const [historyTarget, setHistoryTarget] = useState<LeaveRequest | null>(null);

  const canDecideAny = canFeature("leave.requests", "approve") || canFeature("leave.requests", "reject");
  const myLeaveTypes = leaveTypesForSite(currentUser.siteId);
  const myRequests = requestsFor(currentUser.employeeId);
  const teamRequestsRaw = useMemo(() => visibleTeamRequests(), [visibleTeamRequests]);
  const filteredTeamLeave = useSiteFilter(teamRequestsRaw);
  const pendingCount = filteredTeamLeave.filter((r) => r.status === "Pending").length;
  const siteHasEmployees = isAllSites ? employees.length > 0 : employeesForSite(currentSite?.id ?? "").length > 0;

  const tabs = useMemo(() => {
    const base = [{ id: "my", label: "My Leave" }];
    if (canDecideAny) {
      base.push({ id: "team", label: pendingCount > 0 ? `Team Leave (${pendingCount})` : "Team Leave" });
    }
    if (canDecideAny) base.push({ id: "calendar", label: "Leave Calendar" });
    return base;
  }, [canDecideAny, pendingCount]);

  function handleApprove(request: LeaveRequest) {
    const result = approveLeave(request.id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleRejectSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rejectTarget) return;
    const form = new FormData(e.currentTarget);
    const reason = String(form.get("reason") ?? "");
    const result = rejectLeave(rejectTarget.id, reason);
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setRejectTarget(null);
  }

  function handleCancelSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cancelTarget) return;
    const form = new FormData(e.currentTarget);
    const reason = String(form.get("reason") ?? "");
    const result = cancelLeave(cancelTarget.id, reason);
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setCancelTarget(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Management"
        description={
          active === "team" && !isAllSites
            ? `Team leave requests at ${currentSite?.name}`
            : "Apply for leave and track your leave balance"
        }
        action={
          <Can feature="leave.requests" action="create">
            <Button onClick={() => setModalOpen(true)} disabled={myLeaveTypes.length === 0}>
              <Plus className="h-4 w-4" /> Apply Leave
            </Button>
          </Can>
        }
      />

      {myLeaveTypes.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">
          No leave policy configured for your site yet. Ask an HR/Site Admin to set up Leave Types under Masters.
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {myLeaveTypes.map((type) => {
            const summary = balanceSummaryFor(currentUser.employeeId, currentUser.siteId, type.name);
            const isPaid = type.attributes.paid !== false;
            return (
              <Card key={type.id} className="p-5 text-center">
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {summary?.used ?? 0}{" "}
                  <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
                    / {(summary?.opening ?? 0) + (summary?.accrued ?? 0) + (summary?.carryForward ?? 0)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{type.name}</p>
                <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                  {isPaid ? `${summary?.available ?? 0} available` : "Unpaid"}
                  {summary && summary.pending > 0 ? ` · ${summary.pending} pending` : ""}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      <Tabs tabs={tabs} active={active} onChange={setActive} />

      {active === "my" && (
        <LeaveTable
          rows={myRequests}
          showEmployee={false}
          onCancel={canCancel}
          onCancelClick={setCancelTarget}
          approvalInstanceFor={approvalInstanceFor}
          onViewHistory={setHistoryTarget}
        />
      )}
      {active === "team" && canDecideAny && (
        <>
          {!siteHasEmployees ? (
            <Card className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">
              No employees available for leave management.
            </Card>
          ) : (
            <LeaveTable
              rows={filteredTeamLeave}
              showEmployee
              onApprove={handleApprove}
              onReject={setRejectTarget}
              onCancel={canCancel}
              onCancelClick={setCancelTarget}
              canDecide={canDecide}
              approvalInstanceFor={approvalInstanceFor}
              onViewHistory={setHistoryTarget}
            />
          )}
        </>
      )}
      {active === "calendar" && canDecideAny && (
        <LeaveCalendar requests={filteredTeamLeave} hasEmployees={siteHasEmployees} getEmployee={getEmployeeByEmployeeId} />
      )}

      <ApplyLeaveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        leaveTypes={myLeaveTypes}
        siteId={currentUser.siteId}
        previewDays={previewDays}
        applyLeave={applyLeave}
        toast={toast}
      />

      <Modal open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} title="Reject Leave Request">
        {rejectTarget && (
          <form className="space-y-4" onSubmit={handleRejectSubmit}>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Rejecting <span className="font-medium text-slate-700 dark:text-slate-200">{rejectTarget.employee}</span>
              &apos;s {rejectTarget.type} request ({rejectTarget.from} to {rejectTarget.to}). A reason is required so
              they understand why.
            </p>
            <Field label="Reason for Rejection">
              <Textarea name="reason" rows={3} required placeholder="e.g. Team is short-staffed that week" />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger">
                Reject Request
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Cancel Leave Request">
        {cancelTarget && (
          <form className="space-y-4" onSubmit={handleCancelSubmit}>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {cancelTarget.status === "Approved"
                ? "This leave was already approved — cancelling will reverse the balance deduction and clear the auto-marked attendance for these dates."
                : "This will withdraw the pending request."}{" "}
              ({cancelTarget.type}, {cancelTarget.from} to {cancelTarget.to})
            </p>
            <Field label="Reason (optional)">
              <Textarea name="reason" rows={2} placeholder="Optional note" />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCancelTarget(null)}>
                Back
              </Button>
              <Button type="submit" variant="danger">
                Confirm Cancellation
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(historyTarget)} onClose={() => setHistoryTarget(null)} title="Approval History">
        {historyTarget &&
          (() => {
            const instance = approvalInstanceFor(historyTarget.id);
            return instance ? (
              <ApprovalHistory instance={instance} />
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500">No approval history recorded for this request.</p>
            );
          })()}
      </Modal>
    </div>
  );
}

function ApplyLeaveModal({
  open,
  onClose,
  leaveTypes,
  siteId,
  previewDays,
  applyLeave,
  toast,
}: {
  open: boolean;
  onClose: () => void;
  leaveTypes: MasterRecord[];
  siteId: string;
  previewDays: ReturnType<typeof useLeave>["previewDays"];
  applyLeave: ReturnType<typeof useLeave>["applyLeave"];
  toast: ReturnType<typeof useToast>;
}) {
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [halfDay, setHalfDay] = useState<HalfDayPortion | "">("");

  const selectedType = leaveTypes.find((t) => t.id === leaveTypeId);
  const isSingleDay = Boolean(from) && from === to;
  const preview = from && to && from <= to ? previewDays(siteId, from, to, isSingleDay && halfDay ? halfDay : undefined) : null;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = applyLeave({
      leaveTypeId: String(form.get("leaveTypeId") ?? ""),
      from: String(form.get("from") ?? ""),
      to: String(form.get("to") ?? ""),
      halfDay: isSingleDay && halfDay ? halfDay : undefined,
      reason: String(form.get("reason") ?? ""),
      contactDuringLeave: String(form.get("contactDuringLeave") ?? "") || undefined,
      emergencyContact: String(form.get("emergencyContact") ?? "") || undefined,
      attachmentRef: String(form.get("attachmentRef") ?? "") || undefined,
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      onClose();
      e.currentTarget.reset();
      setFrom("");
      setTo("");
      setHalfDay("");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Apply Leave">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field label="Leave Type">
          <Select name="leaveTypeId" required value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
            {leaveTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} {type.attributes.paid === false ? "(Unpaid)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="From">
            <Input name="from" type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input name="to" type="date" required value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        {isSingleDay && (
          <Field label="Half Day (optional)">
            <Select value={halfDay} onChange={(e) => setHalfDay(e.target.value as HalfDayPortion | "")}>
              <option value="">Full day</option>
              <option value="First Half">First Half</option>
              <option value="Second Half">Second Half</option>
            </Select>
          </Field>
        )}
        {preview && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {preview.days > 0
              ? `${preview.days} day${preview.days !== 1 ? "s" : ""} will be charged (weekly-offs/holidays excluded).`
              : "The selected range has no working days for your site."}
          </p>
        )}
        <Field label="Reason">
          <Textarea name="reason" rows={3} required placeholder="Briefly describe the reason" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Contact During Leave (optional)">
            <Input name="contactDuringLeave" placeholder="Phone/email while away" />
          </Field>
          <Field label="Emergency Contact (optional)">
            <Input name="emergencyContact" placeholder="Name & phone" />
          </Field>
        </div>
        {selectedType?.attributes.requiresDocument && (
          <Field label="Supporting Document Reference">
            <Input name="attachmentRef" required placeholder="Link or reference id" />
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Submit Request</Button>
        </div>
      </form>
    </Modal>
  );
}

function LeaveTable({
  rows,
  showEmployee,
  onApprove,
  onReject,
  onCancel,
  onCancelClick,
  canDecide,
  approvalInstanceFor,
  onViewHistory,
}: {
  rows: LeaveRequest[];
  showEmployee: boolean;
  onApprove?: (request: LeaveRequest) => void;
  onReject?: (request: LeaveRequest) => void;
  onCancel?: (request: LeaveRequest) => boolean;
  onCancelClick?: (request: LeaveRequest) => void;
  /** When omitted, any Pending row shown here is assumed already scoped to the viewer (e.g. "My Leave"). Team Leave passes this so multi-step requests only show live buttons on the step whose turn it actually is. */
  canDecide?: (request: LeaveRequest) => boolean;
  approvalInstanceFor?: (requestId: string) => ApprovalInstance | undefined;
  onViewHistory?: (request: LeaveRequest) => void;
}) {
  const hasActions = Boolean(onApprove || onReject || onCancel);
  return (
    <Card>
      <Table>
        <THead>
          {showEmployee && <Th>Employee</Th>}
          <Th>Leave Type</Th>
          <Th>From</Th>
          <Th>To</Th>
          <Th>Days</Th>
          <Th>Status</Th>
          <Th>Reason</Th>
          {hasActions && <Th>Actions</Th>}
        </THead>
        <TBody>
          {rows.map((row) => {
            const cancelEligible = onCancel?.(row) ?? false;
            const instance = approvalInstanceFor?.(row.id);
            const isMultiStep = Boolean(instance && instance.steps.length > 1);
            const myTurn = canDecide ? canDecide(row) : true;
            const hasHistory = Boolean(instance && instance.actions.length > 1);
            return (
              <Tr key={row.id}>
                {showEmployee && <Td className="font-medium text-slate-800 dark:text-slate-100">{row.employee}</Td>}
                <Td className="text-slate-600 dark:text-slate-300">
                  {row.type}
                  {row.halfDay && <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">({row.halfDay})</span>}
                </Td>
                <Td>{row.from}</Td>
                <Td>{row.to}</Td>
                <Td>{row.days}</Td>
                <Td>
                  {row.status === "Pending" && isMultiStep && instance ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                      {currentStepLabel(instance)}
                    </span>
                  ) : (
                    <StatusBadge status={row.status} />
                  )}
                  {(row.status === "Rejected" || row.status === "Approved") && row.decisionReason && (
                    <p className="mt-1 max-w-[220px] text-xs text-slate-400 dark:text-slate-500">{row.decisionReason}</p>
                  )}
                  {row.status === "Cancelled" && (
                    <p className="mt-1 max-w-[220px] text-xs text-slate-400 dark:text-slate-500">
                      by {row.cancelledBy}
                      {row.cancellationReason ? ` — ${row.cancellationReason}` : ""}
                    </p>
                  )}
                  {hasHistory && onViewHistory && (
                    <button
                      onClick={() => onViewHistory(row)}
                      className="mt-1 flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      <History className="h-3 w-3" /> History
                    </button>
                  )}
                </Td>
                <Td>{row.reason}</Td>
                {hasActions && (
                  <Td>
                    <div className="flex items-center gap-2">
                      {row.status === "Pending" && onApprove && myTurn && (
                        <button
                          onClick={() => onApprove(row)}
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                      )}
                      {row.status === "Pending" && onReject && myTurn && (
                        <button
                          onClick={() => onReject(row)}
                          className="flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                      )}
                      {row.status === "Pending" && (onApprove || onReject) && !myTurn && (
                        <span className="text-xs text-slate-300 dark:text-slate-600">Not your turn yet</span>
                      )}
                      {cancelEligible && onCancelClick && (
                        <button
                          onClick={() => onCancelClick(row)}
                          className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                        >
                          <XCircle className="h-3.5 w-3.5" /> {row.status === "Approved" ? "Revoke" : "Withdraw"}
                        </button>
                      )}
                      {!cancelEligible && row.status !== "Pending" && (
                        <span className="text-xs text-slate-300 dark:text-slate-600">
                          {row.approverName ? `by ${row.approverName}` : "—"}
                        </span>
                      )}
                    </div>
                  </Td>
                )}
              </Tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={(showEmployee ? 7 : 6) + (hasActions ? 1 : 0)}
                className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500"
              >
                No leave requests yet.
              </td>
            </tr>
          )}
        </TBody>
      </Table>
      <TableFootnote>
        Showing 1 to {rows.length} of {rows.length} entries
      </TableFootnote>
    </Card>
  );
}

function LeaveCalendar({
  requests,
  hasEmployees,
  getEmployee,
}: {
  requests: LeaveRequest[];
  hasEmployees: boolean;
  getEmployee: (employeeId: string) => { department: string } | undefined;
}) {
  const sorted = [...requests].sort((a, b) => (a.from < b.from ? -1 : 1));
  return (
    <Card>
      {!hasEmployees ? (
        <p className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">
          No employees available for leave management.
        </p>
      ) : (
        <Table>
          <THead>
            <Th>Employee</Th>
            <Th>Department</Th>
            <Th>Leave Type</Th>
            <Th>Start</Th>
            <Th>End</Th>
            <Th>Days</Th>
            <Th>Status</Th>
          </THead>
          <TBody>
            {sorted.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium text-slate-800 dark:text-slate-100">{r.employee}</Td>
                <Td>{getEmployee(r.employeeId)?.department ?? "—"}</Td>
                <Td>{r.type}</Td>
                <Td>{r.from}</Td>
                <Td>{r.to}</Td>
                <Td>{r.days}</Td>
                <Td>
                  <StatusBadge status={r.status} />
                </Td>
              </Tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                  No leave requests yet.
                </td>
              </tr>
            )}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

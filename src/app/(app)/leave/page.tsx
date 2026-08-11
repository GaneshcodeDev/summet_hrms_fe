"use client";

import { FormEvent, useMemo, useState } from "react";
import { Check, Plus, X, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { Can } from "@/components/auth/permission-gate";
import { leaveTypeConfig, leaveTypes } from "@/lib/leave-data";
import { useLeave } from "@/lib/leave-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useSite, useSiteFilter } from "@/lib/site-context";
import { useToast } from "@/lib/toast-context";
import type { LeaveRequest, LeaveType } from "@/lib/types";

export default function LeavePage() {
  const { currentUser, canFeature } = useAccessControl();
  const { currentSite, isAllSites } = useSite();
  const toast = useToast();
  const { leaveBalances, requestsFor, visibleTeamRequests, applyLeave, approveLeave, rejectLeave, cancelLeave } =
    useLeave();

  const [active, setActive] = useState("my");
  const [modalOpen, setModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);

  const canDecideAny = canFeature("leave.requests", "approve") || canFeature("leave.requests", "reject");
  const myRequests = requestsFor(currentUser.employeeId);
  const myBalances = leaveBalances.filter((b) => b.employeeId === currentUser.employeeId);
  const teamRequestsRaw = useMemo(() => visibleTeamRequests(), [visibleTeamRequests]);
  const filteredTeamLeave = useSiteFilter(teamRequestsRaw);
  const pendingCount = filteredTeamLeave.filter((r) => r.status === "Pending").length;

  const tabs = useMemo(() => {
    const base = [{ id: "my", label: "My Leave" }];
    if (canDecideAny) {
      base.push({ id: "team", label: pendingCount > 0 ? `Team Leave (${pendingCount})` : "Team Leave" });
    }
    base.push({ id: "calendar", label: "Leave Calendar" });
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

  function handleCancel(request: LeaveRequest) {
    const result = cancelLeave(request.id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleApplyLeave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = applyLeave({
      type: String(form.get("type")) as LeaveType,
      from: String(form.get("from")),
      to: String(form.get("to")),
      reason: String(form.get("reason") ?? ""),
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      setModalOpen(false);
      e.currentTarget.reset();
    }
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
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> Apply Leave
            </Button>
          </Can>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {leaveTypes.map((type) => {
          const bal = myBalances.find((b) => b.type === type) ?? { used: 0, total: leaveTypeConfig[type].annualQuota };
          return (
            <Card key={type} className="p-5 text-center">
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {bal.used} <span className="text-sm font-medium text-slate-400 dark:text-slate-500">/ {bal.total}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{type}</p>
            </Card>
          );
        })}
      </div>

      <Tabs tabs={tabs} active={active} onChange={setActive} />

      {active === "my" && <LeaveTable rows={myRequests} showEmployee={false} onCancel={handleCancel} />}
      {active === "team" && canDecideAny && (
        <LeaveTable rows={filteredTeamLeave} showEmployee onApprove={handleApprove} onReject={setRejectTarget} />
      )}
      {active === "calendar" && (
        <Card className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">
          Leave calendar view — switch to the Attendance page for a full monthly calendar layout.
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Apply Leave">
        <form className="space-y-4" onSubmit={handleApplyLeave}>
          <Field label="Leave Type">
            <Select name="type" required defaultValue={leaveTypes[0]}>
              {leaveTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="From">
              <Input name="from" type="date" required />
            </Field>
            <Field label="To">
              <Input name="to" type="date" required />
            </Field>
          </div>
          <Field label="Reason">
            <Textarea name="reason" rows={3} required placeholder="Briefly describe the reason" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit Request</Button>
          </div>
        </form>
      </Modal>

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
    </div>
  );
}

function LeaveTable({
  rows,
  showEmployee,
  onApprove,
  onReject,
  onCancel,
}: {
  rows: LeaveRequest[];
  showEmployee: boolean;
  onApprove?: (request: LeaveRequest) => void;
  onReject?: (request: LeaveRequest) => void;
  onCancel?: (request: LeaveRequest) => void;
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
          {rows.map((row) => (
            <Tr key={row.id}>
              {showEmployee && <Td className="font-medium text-slate-800 dark:text-slate-100">{row.employee}</Td>}
              <Td className="text-slate-600 dark:text-slate-300">{row.type}</Td>
              <Td>{row.from}</Td>
              <Td>{row.to}</Td>
              <Td>{row.days}</Td>
              <Td>
                <StatusBadge status={row.status} />
                {row.status !== "Pending" && row.decisionReason && (
                  <p className="mt-1 max-w-[220px] text-xs text-slate-400 dark:text-slate-500">
                    {row.decisionReason}
                  </p>
                )}
              </Td>
              <Td>{row.reason}</Td>
              {hasActions && (
                <Td>
                  {row.status === "Pending" ? (
                    <div className="flex items-center gap-2">
                      {onApprove && (
                        <button
                          onClick={() => onApprove(row)}
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                      )}
                      {onReject && (
                        <button
                          onClick={() => onReject(row)}
                          className="flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                      )}
                      {onCancel && (
                        <button
                          onClick={() => onCancel(row)}
                          className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Withdraw
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300 dark:text-slate-600">
                      {row.approverName ? `by ${row.approverName}` : "—"}
                    </span>
                  )}
                </Td>
              )}
            </Tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={(showEmployee ? 7 : 6) + (hasActions ? 1 : 0)}
                className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500"
              >
                No leave requests to show.
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

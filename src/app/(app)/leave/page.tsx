"use client";

import { FormEvent, useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import {
  leaveBalances,
  leaveHistory as initialLeaveHistory,
  teamLeaveRequests as initialTeamLeaveRequests,
  currentUser,
} from "@/lib/mock-data";
import type { LeaveRequest, LeaveStatus } from "@/lib/types";
import { useSite, useSiteFilter } from "@/lib/site-context";

export default function LeavePage() {
  const { currentSite, isAllSites } = useSite();
  const [active, setActive] = useState("my");
  const [history, setHistory] = useState<LeaveRequest[]>(initialLeaveHistory);
  const [teamLeaveRequests, setTeamLeaveRequests] = useState<LeaveRequest[]>(initialTeamLeaveRequests);
  const filteredTeamLeave = useSiteFilter(teamLeaveRequests);
  const pendingCount = filteredTeamLeave.filter((r) => r.status === "Pending").length;
  const [modalOpen, setModalOpen] = useState(false);

  const tabs = useMemo(
    () => [
      { id: "my", label: "My Leave" },
      { id: "team", label: pendingCount > 0 ? `Team Leave (${pendingCount})` : "Team Leave" },
      { id: "calendar", label: "Leave Calendar" },
    ],
    [pendingCount],
  );

  function handleDecision(id: string, status: LeaveStatus) {
    setTeamLeaveRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  function handleApplyLeave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const from = String(form.get("from"));
    const to = String(form.get("to"));
    const days =
      Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;
    setHistory((prev) => [
      {
        id: String(prev.length + 1),
        employee: currentUser.name,
        type: String(form.get("type")) as LeaveRequest["type"],
        from,
        to,
        days: Number.isFinite(days) && days > 0 ? days : 1,
        status: "Pending",
        reason: String(form.get("reason") ?? ""),
      },
      ...prev,
    ]);
    setModalOpen(false);
    e.currentTarget.reset();
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
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Apply Leave
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {leaveBalances.map((l) => (
          <Card key={l.label} className="p-5 text-center">
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {l.used} <span className="text-sm font-medium text-slate-400 dark:text-slate-500">/ {l.total}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{l.label}</p>
          </Card>
        ))}
      </div>

      <Tabs tabs={tabs} active={active} onChange={setActive} />

      {active === "my" && <LeaveTable rows={history} showEmployee={false} />}
      {active === "team" && (
        <LeaveTable rows={filteredTeamLeave} showEmployee onDecision={handleDecision} />
      )}
      {active === "calendar" && (
        <Card className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">
          Leave calendar view — switch to the Attendance page for a full monthly calendar layout.
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Apply Leave">
        <form className="space-y-4" onSubmit={handleApplyLeave}>
          <Field label="Leave Type">
            <Select name="type" required defaultValue="Casual Leave">
              <option>Casual Leave</option>
              <option>Sick Leave</option>
              <option>Earned Leave</option>
              <option>Comp Off</option>
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
    </div>
  );
}

function LeaveTable({
  rows,
  showEmployee,
  onDecision,
}: {
  rows: LeaveRequest[];
  showEmployee: boolean;
  onDecision?: (id: string, status: LeaveStatus) => void;
}) {
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
          {onDecision && <Th>Actions</Th>}
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
              </Td>
              <Td>{row.reason}</Td>
              {onDecision && (
                <Td>
                  {row.status === "Pending" ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onDecision(row.id, "Approved")}
                        className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => onDecision(row.id, "Rejected")}
                        className="flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                  )}
                </Td>
              )}
            </Tr>
          ))}
        </TBody>
      </Table>
      <TableFootnote>
        Showing 1 to {rows.length} of {rows.length} entries
      </TableFootnote>
    </Card>
  );
}

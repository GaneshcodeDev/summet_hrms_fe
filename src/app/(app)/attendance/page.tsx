"use client";

import { FormEvent, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, LayoutGrid, List, Plus, X, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { Can } from "@/components/auth/permission-gate";
import { cn } from "@/lib/utils";
import { attendanceMay2024, attendanceSummary } from "@/lib/mock-data";
import { useRegularization } from "@/lib/regularization-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useSiteFilter } from "@/lib/site-context";
import { useToast } from "@/lib/toast-context";
import type { AttendanceRegularization, AttendanceStatus } from "@/lib/types";

const statusStyles: Record<AttendanceStatus, string> = {
  Present: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  Absent: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  "Half Day": "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  "On Leave": "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
  Holiday: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  Weekend: "bg-slate-50 text-slate-300 dark:bg-slate-800/50 dark:text-slate-600",
};

const regularizableStatuses: AttendanceStatus[] = ["Present", "Half Day", "Absent", "On Leave"];

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// May 2024 starts on a Wednesday
const leadingBlanks = 3;

const topTabs = [
  { id: "attendance", label: "My Attendance" },
  { id: "regularization", label: "Regularization" },
];

export default function AttendancePage() {
  const [active, setActive] = useState("attendance");
  const { canFeature } = useAccessControl();
  const { visibleTeamRequests } = useRegularization();

  const canDecideAny = canFeature("attendance.records", "approve") || canFeature("attendance.records", "reject");
  const teamPendingCount = useSiteFilter(visibleTeamRequests()).filter((r) => r.status === "Pending").length;

  const tabs = useMemo(
    () =>
      topTabs.map((t) =>
        t.id === "regularization" && canDecideAny && teamPendingCount > 0
          ? { ...t, label: `Regularization (${teamPendingCount})` }
          : t,
      ),
    [canDecideAny, teamPendingCount],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description="Track your daily attendance record" />

      <Tabs tabs={tabs} active={active} onChange={setActive} />

      {active === "attendance" && <MyAttendanceView />}
      {active === "regularization" && <RegularizationView canDecideAny={canDecideAny} />}
    </div>
  );
}

function MyAttendanceView() {
  const [view, setView] = useState<"calendar" | "list">("calendar");

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 dark:text-slate-500 dark:hover:bg-slate-800">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <CardTitle>May 2024</CardTitle>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 dark:text-slate-500 dark:hover:bg-slate-800">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              onClick={() => setView("calendar")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                view === "calendar"
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400"
                  : "text-slate-500 dark:text-slate-400",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Calendar
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                view === "list"
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400"
                  : "text-slate-500 dark:text-slate-400",
              )}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {view === "calendar" ? (
            <div className="grid grid-cols-7 gap-2">
              {dayLabels.map((d) => (
                <div key={d} className="pb-1 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
                  {d}
                </div>
              ))}
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {attendanceMay2024.map((day) => (
                <div
                  key={day.date}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center gap-1 rounded-lg text-sm font-medium",
                    statusStyles[day.status],
                  )}
                >
                  {day.date}
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {attendanceMay2024
                .filter((d) => d.status !== "Weekend")
                .map((day) => (
                  <div key={day.date} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-slate-600 dark:text-slate-300">May {day.date}, 2024</span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        statusStyles[day.status],
                      )}
                    >
                      {day.status}
                    </span>
                  </div>
                ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            {Object.entries(statusStyles)
              .filter(([label]) => label !== "Weekend")
              .map(([label, cls]) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className={cn("h-2.5 w-2.5 rounded-full", cls.split(" ")[0])} />
                  {label}
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 pt-0">
          <SummaryTile label="Present Days" value={attendanceSummary.presentDays} tone="emerald" />
          <SummaryTile label="Absent Days" value={attendanceSummary.absentDays} tone="rose" />
          <SummaryTile label="Half Day" value={attendanceSummary.halfDays} tone="amber" />
          <SummaryTile label="On Leave" value={attendanceSummary.onLeave} tone="sky" />
          <div className="col-span-2 rounded-xl bg-indigo-50 p-3 text-center dark:bg-indigo-500/10">
            <p className="text-lg font-bold text-indigo-700 dark:text-indigo-400">{attendanceSummary.workingDays}</p>
            <p className="text-xs text-indigo-500 dark:text-indigo-400/80">Working Days</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "rose" | "amber" | "sky";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
  };
  return (
    <div className={cn("rounded-xl p-3 text-center", tones[tone])}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}

function RegularizationView({ canDecideAny }: { canDecideAny: boolean }) {
  const { currentUser } = useAccessControl();
  const toast = useToast();
  const {
    requestsFor,
    visibleTeamRequests,
    applyRegularization,
    approveRegularization,
    rejectRegularization,
    cancelRegularization,
  } = useRegularization();

  const [subTab, setSubTab] = useState("my");
  const [modalOpen, setModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<AttendanceRegularization | null>(null);

  const myRequests = requestsFor(currentUser.employeeId);
  const teamRequestsRaw = useMemo(() => visibleTeamRequests(), [visibleTeamRequests]);
  const teamRequests = useSiteFilter(teamRequestsRaw);

  const subTabs = [
    { id: "my", label: "My Requests" },
    ...(canDecideAny ? [{ id: "team", label: "Team Requests" }] : []),
  ];

  function handleApply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = applyRegularization({
      date: String(form.get("date")),
      currentStatus: String(form.get("currentStatus")) as AttendanceStatus,
      requestedStatus: String(form.get("requestedStatus")) as AttendanceStatus,
      reason: String(form.get("reason") ?? ""),
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      setModalOpen(false);
      e.currentTarget.reset();
    }
  }

  function handleApprove(request: AttendanceRegularization) {
    const result = approveRegularization(request.id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleRejectSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rejectTarget) return;
    const form = new FormData(e.currentTarget);
    const result = rejectRegularization(rejectTarget.id, String(form.get("reason") ?? ""));
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setRejectTarget(null);
  }

  function handleCancel(request: AttendanceRegularization) {
    const result = cancelRegularization(request.id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={subTabs} active={subTab} onChange={setSubTab} />
        <Can feature="attendance.records" action="create">
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Request Regularization
          </Button>
        </Can>
      </div>

      {subTab === "my" && <RegularizationTable rows={myRequests} showEmployee={false} onCancel={handleCancel} />}
      {subTab === "team" && canDecideAny && (
        <RegularizationTable rows={teamRequests} showEmployee onApprove={handleApprove} onReject={setRejectTarget} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Request Regularization">
        <form className="space-y-4" onSubmit={handleApply}>
          <Field label="Date">
            <Input name="date" type="date" required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Current Status">
              <Select name="currentStatus" required defaultValue="Absent">
                {regularizableStatuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label="Requested Status">
              <Select name="requestedStatus" required defaultValue="Present">
                {regularizableStatuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Reason">
            <Textarea name="reason" rows={3} required placeholder="e.g. Forgot to punch in, worked from client site" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit Request</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} title="Reject Regularization Request">
        {rejectTarget && (
          <form className="space-y-4" onSubmit={handleRejectSubmit}>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Rejecting <span className="font-medium text-slate-700 dark:text-slate-200">{rejectTarget.employee}</span>
              &apos;s request for {rejectTarget.date} ({rejectTarget.currentStatus} &rarr; {rejectTarget.requestedStatus}). A
              reason is required so they understand why.
            </p>
            <Field label="Reason for Rejection">
              <Textarea name="reason" rows={3} required placeholder="e.g. No WFH approval on file for that date" />
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

function RegularizationTable({
  rows,
  showEmployee,
  onApprove,
  onReject,
  onCancel,
}: {
  rows: AttendanceRegularization[];
  showEmployee: boolean;
  onApprove?: (request: AttendanceRegularization) => void;
  onReject?: (request: AttendanceRegularization) => void;
  onCancel?: (request: AttendanceRegularization) => void;
}) {
  const hasActions = Boolean(onApprove || onReject || onCancel);
  return (
    <Card>
      <Table>
        <THead>
          {showEmployee && <Th>Employee</Th>}
          <Th>Date</Th>
          <Th>Current</Th>
          <Th>Requested</Th>
          <Th>Status</Th>
          <Th>Reason</Th>
          {hasActions && <Th>Actions</Th>}
        </THead>
        <TBody>
          {rows.map((row) => (
            <Tr key={row.id}>
              {showEmployee && <Td className="font-medium text-slate-800 dark:text-slate-100">{row.employee}</Td>}
              <Td>{row.date}</Td>
              <Td>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusStyles[row.currentStatus])}>
                  {row.currentStatus}
                </span>
              </Td>
              <Td>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusStyles[row.requestedStatus])}>
                  {row.requestedStatus}
                </span>
              </Td>
              <Td>
                <StatusBadge status={row.status} />
                {row.status !== "Pending" && row.decisionReason && (
                  <p className="mt-1 max-w-[220px] text-xs text-slate-400 dark:text-slate-500">{row.decisionReason}</p>
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
                colSpan={(showEmployee ? 6 : 5) + (hasActions ? 1 : 0)}
                className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500"
              >
                No regularization requests to show.
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

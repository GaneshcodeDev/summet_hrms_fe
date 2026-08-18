"use client";

import { FormEvent, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, UserPlus, Users2, X, XCircle } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyRow, TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { Can } from "@/components/auth/permission-gate";
import { cn } from "@/lib/utils";
import { useRegularization } from "@/lib/regularization-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useSite } from "@/lib/site-context";
import { useEmployees } from "@/lib/employee-context";
import { useOrg } from "@/lib/org-context";
import { useMasters } from "@/lib/master-context";
import { useSiteConfig } from "@/lib/site-config-context";
import { useAttendance, summarizeAttendance, type MarkAttendanceInput } from "@/lib/attendance-context";
import { useToast } from "@/lib/toast-context";
import type { AttendanceRecord, AttendanceRegularization, AttendanceStatus, Employee } from "@/lib/types";

const statusStyles: Record<AttendanceStatus, string> = {
  Present: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  Absent: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  "Half Day": "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  Late: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
  "On Leave": "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
  Weekend: "bg-slate-50 text-slate-400 dark:bg-slate-800/50 dark:text-slate-500",
  Holiday: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  "Missing Punch": "bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400",
};

const allStatuses: AttendanceStatus[] = ["Present", "Absent", "Half Day", "Late", "On Leave", "Weekend", "Holiday", "Missing Punch"];
const regularizableStatuses: AttendanceStatus[] = ["Present", "Half Day", "Absent", "On Leave", "Late"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function shiftPeriod(direction: 1 | -1, date: string) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + direction);
  return d.toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const { currentUser, canFeature } = useAccessControl();
  const { employees } = useEmployees();
  const { visibleTeamRequests } = useRegularization();

  const hasBroadScope = canFeature("attendance.records", "edit") || canFeature("attendance.records", "manage");
  const hasDirectReports = useMemo(
    () => employees.some((e) => e.reportingManagerId === currentUser.employeeId),
    [employees, currentUser.employeeId],
  );
  const canDecideAny = canFeature("attendance.records", "approve") || canFeature("attendance.records", "reject");
  const teamPendingCount = visibleTeamRequests().filter((r) => r.status === "Pending").length;

  const topTabs = useMemo(
    () => [
      { id: "my", label: "My Attendance" },
      ...(hasDirectReports ? [{ id: "team", label: "Team Attendance" }] : []),
      ...(hasBroadScope ? [{ id: "site", label: "Site Attendance" }] : []),
      {
        id: "regularization",
        label: canDecideAny && teamPendingCount > 0 ? `Regularization (${teamPendingCount})` : "Regularization",
      },
    ],
    [hasDirectReports, hasBroadScope, canDecideAny, teamPendingCount],
  );

  const [active, setActive] = useState(() => (hasBroadScope ? "site" : hasDirectReports ? "team" : "my"));

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description="Track and manage daily attendance" />
      <Tabs tabs={topTabs} active={active} onChange={setActive} />

      {active === "my" && <MyAttendanceView />}
      {active === "team" && hasDirectReports && <TeamAttendanceView />}
      {active === "site" && hasBroadScope && <SiteAttendanceView />}
      {active === "regularization" && <RegularizationView canDecideAny={canDecideAny} />}
    </div>
  );
}

function SummaryCards({ summary, totalEmployees }: { summary: ReturnType<typeof summarizeAttendance>; totalEmployees: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
      <StatCard label="Total Employees" value={String(totalEmployees)} icon={Users2} tone="indigo" />
      <StatCard label="Present" value={String(summary.present)} icon={Check} tone="emerald" />
      <StatCard label="Absent" value={String(summary.absent)} icon={X} tone="rose" />
      <StatCard label="On Leave" value={String(summary.onLeave)} icon={XCircle} tone="sky" />
      <StatCard label="Late" value={String(summary.late)} icon={ChevronRight} tone="amber" />
      <StatCard label="Half Day" value={String(summary.halfDay)} icon={ChevronLeft} tone="amber" />
      <StatCard label="Missing Punch" value={String(summary.missingPunch)} icon={X} tone="rose" />
      <StatCard label="Overtime (hrs)" value={String(summary.overtimeHours)} icon={Check} tone="emerald" />
    </div>
  );
}

function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => onChange(shiftPeriod(-1, date))}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <input
        type="date"
        value={date}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      />
      <button
        onClick={() => onChange(shiftPeriod(1, date))}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      {date !== todayStr() && (
        <button
          onClick={() => onChange(todayStr())}
          className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Today
        </button>
      )}
    </div>
  );
}

function shiftLabel(shift: ReturnType<ReturnType<typeof useMasters>["recordsOfType"]>[number] | undefined) {
  if (!shift) return "Shift not assigned";
  const start = shift.attributes.startTime;
  const end = shift.attributes.endTime;
  return start && end ? `${shift.name} (${start}–${end})` : shift.name;
}

function MyAttendanceView() {
  const { currentUser } = useAccessControl();
  const { recordsForEmployee } = useAttendance();

  const records = useMemo(
    () => recordsForEmployee(currentUser.employeeId).slice().sort((a, b) => (a.date < b.date ? 1 : -1)),
    [recordsForEmployee, currentUser.employeeId],
  );
  const summary = useMemo(() => summarizeAttendance(records), [records]);

  return (
    <div className="space-y-4">
      <SummaryCards summary={summary} totalEmployees={1} />
      <Card>
        <Table>
          <THead>
            <Th>Date</Th>
            <Th>Status</Th>
            <Th>Punch In</Th>
            <Th>Punch Out</Th>
            <Th>Worked Hours</Th>
            <Th>Overtime</Th>
          </THead>
          <TBody>
            {records.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium text-slate-800 dark:text-slate-100">{r.date}</Td>
                <Td>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", statusStyles[r.status])}>{r.status}</span>
                </Td>
                <Td>{r.punchIn ?? "—"}</Td>
                <Td>{r.punchOut ?? "—"}</Td>
                <Td>{r.workedHours || "—"}</Td>
                <Td>{r.overtimeHours || "—"}</Td>
              </Tr>
            ))}
            {records.length === 0 && <EmptyRow colSpan={6}>No attendance records yet.</EmptyRow>}
          </TBody>
        </Table>
        <TableFootnote>Showing {records.length} record{records.length === 1 ? "" : "s"}</TableFootnote>
      </Card>
    </div>
  );
}

function TeamAttendanceView() {
  const { currentUser } = useAccessControl();
  const { employees } = useEmployees();
  const { recordFor } = useAttendance();
  const [date, setDate] = useState(todayStr());

  const directReports = useMemo(
    () => employees.filter((e) => e.reportingManagerId === currentUser.employeeId),
    [employees, currentUser.employeeId],
  );
  const records = useMemo(
    () => directReports.map((e) => recordFor(e.employeeId, date)).filter((r): r is AttendanceRecord => Boolean(r)),
    [directReports, recordFor, date],
  );
  const summary = useMemo(() => summarizeAttendance(records), [records]);

  return (
    <div className="space-y-4">
      <SummaryCards summary={summary} totalEmployees={directReports.length} />
      <DateNav date={date} onChange={setDate} />
      <Card>
        <Table>
          <THead>
            <Th>Employee</Th>
            <Th>Employee Code</Th>
            <Th>Status</Th>
            <Th>Punch In</Th>
            <Th>Punch Out</Th>
            <Th>Worked Hours</Th>
          </THead>
          <TBody>
            {directReports.map((e) => {
              const record = recordFor(e.employeeId, date);
              return (
                <Tr key={e.id}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{e.name}</Td>
                  <Td>{e.employeeId}</Td>
                  <Td>
                    {record ? (
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", statusStyles[record.status])}>
                        {record.status}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">Not Marked</span>
                    )}
                  </Td>
                  <Td>{record?.punchIn ?? "—"}</Td>
                  <Td>{record?.punchOut ?? "—"}</Td>
                  <Td>{record?.workedHours || "—"}</Td>
                </Tr>
              );
            })}
            {directReports.length === 0 && <EmptyRow colSpan={6}>No direct reports.</EmptyRow>}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

function SiteAttendanceView() {
  const { currentSite, isAllSites, currentSiteId } = useSite();
  const { employees } = useEmployees();
  const { orgUnits } = useOrg();
  const { recordsOfType } = useMasters();
  const { configForSite } = useSiteConfig();
  const { recordFor, markAttendance, updateAttendanceRecord, canMark, canEdit } = useAttendance();
  const toast = useToast();

  const [date, setDate] = useState(todayStr());
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All Departments");
  const [subDeptFilter, setSubDeptFilter] = useState("All Sub Departments");
  const [plantFilter, setPlantFilter] = useState("All Plants");
  const [locationFilter, setLocationFilter] = useState("All Locations");
  const [shiftFilter, setShiftFilter] = useState("All Shifts");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [modalTarget, setModalTarget] = useState<{ employee: Employee; record?: AttendanceRecord } | null>(null);

  const siteEmployees = useMemo(
    () => (currentSiteId ? employees.filter((e) => e.siteId === currentSiteId) : []),
    [employees, currentSiteId],
  );

  const departments = useMemo(
    () => orgUnits.filter((u) => u.type === "Department" && u.siteId === currentSiteId),
    [orgUnits, currentSiteId],
  );
  const subDepartments = useMemo(
    () => orgUnits.filter((u) => u.type === "SubDepartment" && u.siteId === currentSiteId),
    [orgUnits, currentSiteId],
  );
  const plants = useMemo(() => orgUnits.filter((u) => u.type === "Plant" && u.siteId === currentSiteId), [orgUnits, currentSiteId]);
  const locations = useMemo(
    () => orgUnits.filter((u) => u.type === "Location" && u.siteId === currentSiteId),
    [orgUnits, currentSiteId],
  );
  const shifts = useMemo(
    () => recordsOfType("Shift").filter((s) => s.siteId === currentSiteId),
    [recordsOfType, currentSiteId],
  );

  const filtered = useMemo(() => {
    return siteEmployees.filter((e) => {
      const record = recordFor(e.employeeId, date);
      const matchesSearch =
        !search ||
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.employeeId.toLowerCase().includes(search.toLowerCase());
      const matchesDept = deptFilter === "All Departments" || e.department === deptFilter;
      const matchesSubDept = subDeptFilter === "All Sub Departments" || e.subDepartmentId === subDeptFilter;
      const matchesPlant = plantFilter === "All Plants" || e.plantId === plantFilter;
      const matchesLocation = locationFilter === "All Locations" || e.locationId === locationFilter;
      const matchesShift = shiftFilter === "All Shifts" || e.shiftId === shiftFilter;
      const matchesStatus =
        statusFilter === "All Status" ||
        (statusFilter === "Not Marked" ? !record : record?.status === statusFilter);
      return matchesSearch && matchesDept && matchesSubDept && matchesPlant && matchesLocation && matchesShift && matchesStatus;
    });
  }, [siteEmployees, recordFor, date, search, deptFilter, subDeptFilter, plantFilter, locationFilter, shiftFilter, statusFilter]);

  const records = useMemo(
    () => siteEmployees.map((e) => recordFor(e.employeeId, date)).filter((r): r is AttendanceRecord => Boolean(r)),
    [siteEmployees, recordFor, date],
  );
  const summary = useMemo(() => summarizeAttendance(records), [records]);

  if (isAllSites || !currentSiteId) {
    return (
      <Card className="p-10 text-center text-sm text-slate-400 dark:text-slate-500">
        Select a site from the switcher above to view its attendance.
      </Card>
    );
  }

  if (siteEmployees.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 p-12 text-center">
        <UserPlus className="h-8 w-8 text-slate-300 dark:text-slate-600" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          No employees have been added to this site yet.
        </p>
        <Link href="/employees">
          <Button size="sm">
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        </Link>
      </Card>
    );
  }

  function handleSaved(result: { ok: boolean; message: string }) {
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setModalTarget(null);
  }

  async function handleMark(input: MarkAttendanceInput) {
    handleSaved(await markAttendance(input));
  }
  async function handleUpdate(
    id: string,
    patch: Parameters<ReturnType<typeof useAttendance>["updateAttendanceRecord"]>[1],
  ) {
    handleSaved(await updateAttendanceRecord(id, patch));
  }

  return (
    <div className="space-y-4">
      <SummaryCards summary={summary} totalEmployees={siteEmployees.length} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateNav date={date} onChange={setDate} />
        <p className="text-xs text-slate-400 dark:text-slate-500">{currentSite?.name}</p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="w-auto">
            <option>All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select value={subDeptFilter} onChange={(e) => setSubDeptFilter(e.target.value)} className="w-auto">
            <option value="All Sub Departments">All Sub Departments</option>
            {subDepartments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select value={plantFilter} onChange={(e) => setPlantFilter(e.target.value)} className="w-auto">
            <option value="All Plants">All Plants</option>
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="w-auto">
            <option value="All Locations">All Locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <Select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)} className="w-auto">
            <option value="All Shifts">All Shifts</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
            <option>All Status</option>
            <option>Not Marked</option>
            {allStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </div>

        <Table>
          <THead>
            <Th>Employee</Th>
            <Th>Employee Code</Th>
            <Th>Department</Th>
            <Th>Designation</Th>
            <Th>Shift</Th>
            <Th>Punch In</Th>
            <Th>Punch Out</Th>
            <Th>Worked Hours</Th>
            <Th>Overtime</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </THead>
          <TBody>
            {filtered.map((e) => {
              const record = recordFor(e.employeeId, date);
              const shift = shifts.find((s) => s.id === (record?.shiftId ?? e.shiftId));
              return (
                <Tr key={e.id} hoverable>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{e.name}</Td>
                  <Td>{e.employeeId}</Td>
                  <Td>{e.department}</Td>
                  <Td>{e.designation}</Td>
                  <Td className="text-xs">{shiftLabel(shift)}</Td>
                  <Td>{record?.punchIn ?? "—"}</Td>
                  <Td>{record?.punchOut ?? "—"}</Td>
                  <Td>{record?.workedHours || "—"}</Td>
                  <Td>{record?.overtimeHours || "—"}</Td>
                  <Td>
                    {record ? (
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", statusStyles[record.status])}>
                        {record.status}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">Not Marked</span>
                    )}
                  </Td>
                  <Td>
                    <Can feature="attendance.records" action={record ? "edit" : "create"}>
                      <button
                        onClick={() => setModalTarget({ employee: e, record })}
                        className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {record ? "Edit" : "Mark"}
                      </button>
                    </Can>
                  </Td>
                </Tr>
              );
            })}
            {filtered.length === 0 && <EmptyRow colSpan={11}>No employees match your filters.</EmptyRow>}
          </TBody>
        </Table>
        <TableFootnote>
          Showing {filtered.length} of {siteEmployees.length} entries
        </TableFootnote>
      </Card>

      <MarkAttendanceModal
        open={Boolean(modalTarget)}
        target={modalTarget}
        date={date}
        siteId={currentSiteId}
        shifts={shifts}
        gracePeriodMinutes={configForSite(currentSiteId)?.attendance.gracePeriodMinutes ?? 0}
        canMark={canMark}
        canEdit={canEdit}
        onClose={() => setModalTarget(null)}
        onMark={handleMark}
        onUpdate={handleUpdate}
      />
    </div>
  );
}

function MarkAttendanceModal({
  open,
  target,
  date,
  siteId,
  shifts,
  gracePeriodMinutes,
  canMark,
  canEdit,
  onClose,
  onMark,
  onUpdate,
}: {
  open: boolean;
  target: { employee: Employee; record?: AttendanceRecord } | null;
  date: string;
  siteId: string;
  shifts: ReturnType<ReturnType<typeof useMasters>["recordsOfType"]>;
  gracePeriodMinutes: number;
  canMark: boolean;
  canEdit: boolean;
  onClose: () => void;
  onMark: (input: MarkAttendanceInput) => Promise<void>;
  onUpdate: (id: string, patch: Parameters<ReturnType<typeof useAttendance>["updateAttendanceRecord"]>[1]) => Promise<void>;
}) {
  if (!target) return null;
  const { employee, record } = target;
  const isEdit = Boolean(record);
  const allowed = isEdit ? canEdit : canMark;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const status = String(form.get("status") ?? "Present") as AttendanceStatus;
    const punchIn = String(form.get("punchIn") ?? "");
    const punchOut = String(form.get("punchOut") ?? "");
    const shiftId = String(form.get("shiftId") ?? "") || undefined;
    const remarks = String(form.get("remarks") ?? "");
    const shift = shifts.find((s) => s.id === shiftId);

    if (isEdit && record) {
      void onUpdate(record.id, {
        status,
        punchIn: punchIn || undefined,
        punchOut: punchOut || undefined,
        shiftId,
        remarks,
        shiftStart: shift?.attributes.startTime as string | undefined,
        shiftEnd: shift?.attributes.endTime as string | undefined,
        gracePeriodMinutes,
      });
    } else {
      void onMark({
        employeeId: employee.employeeId,
        siteId,
        date,
        status,
        punchIn: punchIn || undefined,
        punchOut: punchOut || undefined,
        shiftId,
        remarks,
        shiftStart: shift?.attributes.startTime as string | undefined,
        shiftEnd: shift?.attributes.endTime as string | undefined,
        gracePeriodMinutes,
      });
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`${isEdit ? "Edit" : "Mark"} Attendance — ${employee.name}`}>
      {!allowed ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">You're not authorized to do this.</p>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {employee.employeeId} &middot; {date}
          </p>
          <Field label="Status">
            <Select name="status" defaultValue={record?.status ?? "Present"}>
              {allStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Punch In">
              <Input name="punchIn" type="time" defaultValue={record?.punchIn} />
            </Field>
            <Field label="Punch Out">
              <Input name="punchOut" type="time" defaultValue={record?.punchOut} />
            </Field>
          </div>
          <Field label="Shift">
            <Select name="shiftId" defaultValue={record?.shiftId ?? employee.shiftId ?? ""}>
              <option value="">Shift not assigned</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({String(s.attributes.startTime ?? "")}–{String(s.attributes.endTime ?? "")})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Remarks">
            <Textarea name="remarks" rows={2} defaultValue={record?.remarks} placeholder="Optional" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{isEdit ? "Save Changes" : "Mark Attendance"}</Button>
          </div>
        </form>
      )}
    </Modal>
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
  const teamRequests = useMemo(() => visibleTeamRequests(), [visibleTeamRequests]);

  const subTabs = [
    { id: "my", label: "My Requests" },
    ...(canDecideAny ? [{ id: "team", label: "Team Requests" }] : []),
  ];

  async function handleApply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const target = e.currentTarget;
    const result = await applyRegularization({
      date: String(form.get("date")),
      currentStatus: String(form.get("currentStatus")) as AttendanceStatus,
      requestedStatus: String(form.get("requestedStatus")) as AttendanceStatus,
      requestedPunchIn: String(form.get("requestedPunchIn") ?? "") || undefined,
      requestedPunchOut: String(form.get("requestedPunchOut") ?? "") || undefined,
      reason: String(form.get("reason") ?? ""),
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      setModalOpen(false);
      target.reset();
    }
  }

  async function handleApprove(request: AttendanceRegularization) {
    const result = await approveRegularization(request.id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  async function handleRejectSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rejectTarget) return;
    const form = new FormData(e.currentTarget);
    const result = await rejectRegularization(rejectTarget.id, String(form.get("reason") ?? ""));
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setRejectTarget(null);
  }

  async function handleCancel(request: AttendanceRegularization) {
    const result = await cancelRegularization(request.id);
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
          <div className="grid grid-cols-2 gap-4">
            <Field label="Requested Punch In (optional)">
              <Input name="requestedPunchIn" type="time" />
            </Field>
            <Field label="Requested Punch Out (optional)">
              <Input name="requestedPunchOut" type="time" />
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
                {(row.requestedPunchIn || row.requestedPunchOut) && (
                  <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                    {row.requestedPunchIn ?? "—"}–{row.requestedPunchOut ?? "—"}
                  </span>
                )}
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

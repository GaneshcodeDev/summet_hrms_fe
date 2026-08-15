"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Users, UserCheck, UserX, CalendarOff, Clock, TrendingUp, IndianRupee, ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, Input } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyRow, TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { useAccessControl } from "@/lib/access-control-context";
import { useSite } from "@/lib/site-context";
import { useEmployees } from "@/lib/employee-context";
import { useAttendance } from "@/lib/attendance-context";
import { useLeave } from "@/lib/leave-context";
import { usePayroll } from "@/lib/payroll-context";
import { useApprovals } from "@/lib/approval-context";
import { useOffboarding } from "@/lib/offboarding-context";
import { useOrg } from "@/lib/org-context";
import { useMasters } from "@/lib/master-context";
import { useSiteConfig } from "@/lib/site-config-context";
import { downloadCsv } from "@/lib/utils";
import {
  buildReportEmployeeRows,
  formatDuration,
  getAbsenteeismReport,
  getApprovalBreakdownByModule,
  getApprovalReport,
  getAttendanceBreakdown,
  getAttendanceReport,
  getExitReport,
  getHeadcountReport,
  getJoinersReport,
  getLateComingReport,
  getLeaveBreakdown,
  getLeaveSummary,
  getLeaveUtilizationReport,
  getLopReport,
  getMonthlyTrend,
  getOvertimeReport,
  getPayrollBreakdown,
  getPayrollReport,
  getSiteComparisonReport,
  latestRunPerSite,
  type ReportEmployeeRow,
} from "@/lib/report-selectors";
import type { Site } from "@/lib/types";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function inr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

const CHART_COLOR = "#4f46e5";

export default function ReportsPage() {
  const { currentUser, canFeature, isSuperAdmin } = useAccessControl();
  // Anyone with real oversight of others' attendance/leave/payroll/directory
  // gets the full admin reporting suite (scoped further inside
  // AdminReportsView); a pure individual contributor (no approve/edit/manage/
  // payroll-view rights anywhere) gets self-service-only "My Reports" —
  // this is what correctly separates Employee from Finance/Auditor, who
  // have no approval rights either but do have broad view/export access.
  const hasAnyOversight =
    canFeature("attendance.records", "approve") ||
    canFeature("attendance.records", "edit") ||
    canFeature("attendance.records", "manage") ||
    canFeature("leave.requests", "approve") ||
    canFeature("leave.requests", "edit") ||
    canFeature("leave.requests", "manage") ||
    canFeature("payroll.payslips", "view") ||
    canFeature("payroll.payslips", "export") ||
    canFeature("payroll.payslips", "manage") ||
    canFeature("employees.directory", "edit") ||
    canFeature("employees.directory", "manage");
  const isEmployeeTier = !isSuperAdmin && !hasAnyOversight;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description={isEmployeeTier ? "Your personal attendance, leave and payroll history" : "Live, site-scoped reporting across the organization"}
      />
      {isEmployeeTier ? <MyReportsView employeeId={currentUser.employeeId} /> : <AdminReportsView />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Admin / HR / Manager reports                                        */
/* ------------------------------------------------------------------ */

function AdminReportsView() {
  const { currentUser, canFeature } = useAccessControl();
  const { sites, currentSiteId, isAllSites, isSuperAdmin, mappedSites } = useSite();
  const { employees } = useEmployees();
  const { attendance } = useAttendance();
  const { leaveRequests, leaveBalances } = useLeave();
  const { payslips, payrollRuns } = usePayroll();
  const { instances } = useApprovals();
  const { cases: separationCases } = useOffboarding();
  const { orgUnits } = useOrg();
  const { records: masterRecords } = useMasters();
  const { configForSite } = useSiteConfig();

  const canSeeSalary = canFeature("payroll.payslips", "view") || canFeature("payroll.payslips", "manage");
  // "Manager tier" = holds approve rights on Leave/Attendance but not the
  // broader edit/manage scope those same features grant HR/Admin roles —
  // the exact hasBroadScope split already used throughout Leave/Regularization/
  // Expense contexts. Roles with no approval rights at all (e.g. Finance,
  // Auditor) are NOT manager-tier — they fall through to full site scope,
  // consistent with their existing view-oriented permission grants.
  const hasBroadOversight =
    canFeature("leave.requests", "edit") ||
    canFeature("leave.requests", "manage") ||
    canFeature("attendance.records", "edit") ||
    canFeature("attendance.records", "manage") ||
    canFeature("employees.directory", "edit") ||
    canFeature("employees.directory", "manage");
  const isManagerTier =
    !isSuperAdmin && !hasBroadOversight && (canFeature("leave.requests", "approve") || canFeature("attendance.records", "approve"));

  const [reportSiteId, setReportSiteId] = useState<string>(isAllSites ? "ALL" : currentSiteId);
  const [from, setFrom] = useState(firstOfMonthStr());
  const [to, setTo] = useState(todayStr());
  const [department, setDepartment] = useState("All Departments");
  const [active, setActive] = useState("overview");

  const effectiveSiteIds = useMemo(() => {
    if (isSuperAdmin) return reportSiteId === "ALL" ? sites.map((s) => s.id) : [reportSiteId];
    return mappedSites.map((s) => s.id);
  }, [isSuperAdmin, reportSiteId, sites, mappedSites]);

  // Base employee scope: site-scoped for HR/Admin tiers; direct reports + self for Manager tier.
  const scopedEmployees = useMemo(() => {
    const siteScoped = employees.filter((e) => effectiveSiteIds.includes(e.siteId));
    if (!isManagerTier) return siteScoped;
    return siteScoped.filter((e) => e.reportingManagerId === currentUser.employeeId || e.employeeId === currentUser.employeeId);
  }, [employees, effectiveSiteIds, isManagerTier, currentUser.employeeId]);

  const rows: ReportEmployeeRow[] = useMemo(
    () => buildReportEmployeeRows(scopedEmployees, sites, orgUnits, masterRecords),
    [scopedEmployees, sites, orgUnits, masterRecords],
  );
  const scopedEmployeeIds = useMemo(() => new Set(rows.map((r) => r.employeeId)), [rows]);

  const departmentOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.department))).sort(), [rows]);
  const filteredRows = useMemo(
    () => (department === "All Departments" ? rows : rows.filter((r) => r.department === department)),
    [rows, department],
  );
  const filteredEmployeeIds = useMemo(() => new Set(filteredRows.map((r) => r.employeeId)), [filteredRows]);

  const rangedAttendance = useMemo(
    () => attendance.filter((r) => scopedEmployeeIds.has(r.employeeId) && filteredEmployeeIds.has(r.employeeId) && r.date >= from && r.date <= to),
    [attendance, scopedEmployeeIds, filteredEmployeeIds, from, to],
  );
  const rangedLeave = useMemo(
    () => leaveRequests.filter((r) => filteredEmployeeIds.has(r.employeeId) && r.from <= to && r.to >= from),
    [leaveRequests, filteredEmployeeIds, from, to],
  );
  const scopedBalances = useMemo(() => leaveBalances.filter((b) => filteredEmployeeIds.has(b.employeeId)), [leaveBalances, filteredEmployeeIds]);
  const scopedPayslips = useMemo(
    () => (canSeeSalary ? payslips.filter((p) => filteredEmployeeIds.has(p.employeeId) && effectiveSiteIds.includes(p.siteId)) : []),
    [payslips, filteredEmployeeIds, effectiveSiteIds, canSeeSalary],
  );
  const scopedApprovals = useMemo(
    () => instances.filter((i) => effectiveSiteIds.includes(i.siteId) && (!isManagerTier || filteredEmployeeIds.has(i.requestedBy))),
    [instances, effectiveSiteIds, isManagerTier, filteredEmployeeIds],
  );
  const scopedSeparations = useMemo(
    () => separationCases.filter((c) => c.siteId && effectiveSiteIds.includes(c.siteId)),
    [separationCases, effectiveSiteIds],
  );

  const tabs = useMemo(() => {
    const t = [
      { id: "overview", label: "Overview" },
      { id: "attendance", label: "Attendance" },
      { id: "leave", label: "Leave" },
    ];
    if (canSeeSalary) t.push({ id: "payroll", label: "Payroll" });
    if (!isManagerTier || canFeature("leave.requests", "approve")) t.push({ id: "approvals", label: "Approvals" });
    t.push({ id: "workforce", label: "Workforce" });
    return t;
  }, [canSeeSalary, isManagerTier, canFeature]);

  function exportCurrentTable(filename: string, headers: string[], data: (string | number)[][]) {
    if (!canFeature("reports.analytics", "export")) return;
    downloadCsv(filename, headers, data);
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          {isSuperAdmin && (
            <Field label="Site">
              <Select value={reportSiteId} onChange={(e) => setReportSiteId(e.target.value)} className="w-auto">
                <option value="ALL">All Sites</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
          </Field>
          <Field label="To">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          </Field>
          {(active === "attendance" || active === "leave" || active === "payroll" || active === "overview") && (
            <Field label="Department">
              <Select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-auto">
                <option>All Departments</option>
                {departmentOptions.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      </Card>

      <Tabs tabs={tabs} active={active} onChange={setActive} />

      {active === "overview" && (
        <OverviewTab
          rows={filteredRows}
          from={from}
          to={to}
          isSuperAdmin={isSuperAdmin}
          isAllSites={reportSiteId === "ALL"}
          sites={sites}
          allSiteRows={rows}
          todayAttendance={attendance.filter((r) => r.date === todayStr())}
          payslips={payslips}
          payrollRuns={payrollRuns}
          canSeeSalary={canSeeSalary}
          onExport={exportCurrentTable}
        />
      )}
      {active === "attendance" && (
        <AttendanceTab
          records={rangedAttendance}
          rows={filteredRows}
          from={from}
          to={to}
          configForSite={configForSite}
          onExport={exportCurrentTable}
        />
      )}
      {active === "leave" && (
        <LeaveTab requests={rangedLeave} balances={scopedBalances} rows={filteredRows} siteIds={effectiveSiteIds} from={from} to={to} onExport={exportCurrentTable} />
      )}
      {active === "payroll" && canSeeSalary && <PayrollTab payslips={scopedPayslips} rows={filteredRows} onExport={exportCurrentTable} />}
      {active === "approvals" && <ApprovalsTab instances={scopedApprovals} onExport={exportCurrentTable} />}
      {active === "workforce" && (
        <WorkforceTab rows={filteredRows} cases={scopedSeparations} from={from} to={to} onExport={exportCurrentTable} />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}

type ExportFn = (filename: string, headers: string[], rows: (string | number)[][]) => void;

/* ------------------------------------------------------------------ */
/* Overview                                                             */
/* ------------------------------------------------------------------ */

function OverviewTab({
  rows,
  from,
  to,
  isSuperAdmin,
  isAllSites,
  sites,
  allSiteRows,
  todayAttendance,
  payslips,
  payrollRuns,
  canSeeSalary,
  onExport,
}: {
  rows: ReportEmployeeRow[];
  from: string;
  to: string;
  isSuperAdmin: boolean;
  isAllSites: boolean;
  sites: Site[];
  allSiteRows: ReportEmployeeRow[];
  todayAttendance: ReturnType<typeof useAttendance>["attendance"];
  payslips: ReturnType<typeof usePayroll>["payslips"];
  payrollRuns: ReturnType<typeof usePayroll>["payrollRuns"];
  canSeeSalary: boolean;
  onExport: ExportFn;
}) {
  const headcount = getHeadcountReport(rows, { from, to });

  const siteComparison = useMemo(() => {
    if (!isSuperAdmin || !isAllSites) return [];
    const latest = latestRunPerSite(payrollRuns);
    const latestPayslipsBySite = new Map<string, typeof payslips>();
    for (const [siteId, run] of latest.entries()) {
      latestPayslipsBySite.set(siteId, payslips.filter((p) => p.runId === run.id));
    }
    return getSiteComparisonReport(sites, allSiteRows, todayAttendance, latestPayslipsBySite);
  }, [isSuperAdmin, isAllSites, sites, allSiteRows, todayAttendance, payslips, payrollRuns]);

  if (rows.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-slate-400 dark:text-slate-500">
        No employees match the selected filters.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Employees" value={headcount.total.toString()} icon={Users} tone="indigo" />
        <StatCard label="Active" value={headcount.active.toString()} icon={UserCheck} tone="emerald" />
        <StatCard label="Inactive" value={headcount.inactive.toString()} icon={UserX} tone="rose" />
        <StatCard label="New Joiners (period)" value={headcount.newJoiners.toString()} icon={TrendingUp} tone="amber" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Headcount by Department</CardTitle>
          <Button size="sm" variant="outline" onClick={() => onExport("headcount-by-department.csv", ["Department", "Count"], headcount.byDepartment.map((r) => [r.label, r.count]))}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={headcount.byDepartment.slice(0, 10)} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BreakdownCard title="By Designation" rows={headcount.byDesignation} />
        <BreakdownCard title="By Grade" rows={headcount.byGrade} />
        <BreakdownCard title="By Employment Type" rows={headcount.byEmploymentType} />
        <BreakdownCard title="By Location" rows={headcount.byLocation} />
      </div>

      {isSuperAdmin && isAllSites && (
        <Card>
          <CardHeader>
            <CardTitle>Site Comparison</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <Th>Site</Th>
                <Th>Employees</Th>
                <Th>Active</Th>
                <Th>Present Today</Th>
                <Th>Absent Today</Th>
                <Th>On Leave</Th>
                {canSeeSalary && <Th>Payroll Cost</Th>}
                <Th>Overtime (hrs)</Th>
                {canSeeSalary && <Th>LOP</Th>}
              </THead>
              <TBody>
                {siteComparison.map((s) => (
                  <Tr key={s.siteId}>
                    <Td className="font-medium text-slate-800 dark:text-slate-100">{s.siteName}</Td>
                    <Td>{s.employeeCount}</Td>
                    <Td>{s.activeEmployees}</Td>
                    <Td>{s.presentToday}</Td>
                    <Td>{s.absentToday}</Td>
                    <Td>{s.onLeaveToday}</Td>
                    {canSeeSalary && <Td>{inr(s.payrollCost)}</Td>}
                    <Td>{s.overtimeHours}</Td>
                    {canSeeSalary && <Td>{inr(s.lopAmount)}</Td>}
                  </Tr>
                ))}
                {siteComparison.length === 0 && <EmptyRow colSpan={9}>No sites to compare.</EmptyRow>}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {rows.slice(0, 8).map((r) => (
          <div key={r.label} className="flex items-center gap-3 text-sm">
            <span className="w-32 shrink-0 truncate text-slate-500 dark:text-slate-400">{r.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${total > 0 ? (r.count / total) * 100 : 0}%` }} />
            </div>
            <span className="w-8 shrink-0 text-right font-medium text-slate-700 dark:text-slate-200">{r.count}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No data.</p>}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Attendance                                                           */
/* ------------------------------------------------------------------ */

function AttendanceTab({
  records,
  rows,
  from,
  to,
  configForSite,
  onExport,
}: {
  records: ReturnType<typeof useAttendance>["attendance"];
  rows: ReportEmployeeRow[];
  from: string;
  to: string;
  configForSite: ReturnType<typeof useSiteConfig>["configForSite"];
  onExport: ExportFn;
}) {
  const metrics = getAttendanceReport(records);
  const late = getLateComingReport(records);
  const overtime = getOvertimeReport(records);
  const byDepartment = getAttendanceBreakdown(records, rows, (r) => r.department);

  const bySiteIds = Array.from(new Set(rows.map((r) => r.siteId)));
  const workingDaysSet = new Set<string>();
  const holidaysSet = new Set<string>();
  for (const siteId of bySiteIds) {
    const cfg = configForSite(siteId);
    (cfg?.attendance.workingDays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"]).forEach((d) => workingDaysSet.add(d));
    (cfg?.holiday.holidays ?? []).forEach((h) => holidaysSet.add(h.date));
  }
  const absenteeism = getAbsenteeismReport(records, rows.length, { from, to }, Array.from(workingDaysSet), Array.from(holidaysSet));

  if (rows.length === 0) {
    return <Card className="p-10 text-center text-sm text-slate-400 dark:text-slate-500">No employees match the selected filters.</Card>;
  }
  if (records.length === 0) {
    return <Card className="p-10 text-center text-sm text-slate-400 dark:text-slate-500">No attendance data available for the selected period.</Card>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Present" value={metrics.present.toString()} icon={UserCheck} tone="emerald" />
        <StatCard label="Absent" value={metrics.absent.toString()} icon={UserX} tone="rose" />
        <StatCard label="On Leave" value={metrics.onLeave.toString()} icon={CalendarOff} tone="amber" />
        <StatCard label="Overtime (hrs)" value={metrics.overtimeHours.toString()} icon={Clock} tone="indigo" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Late" value={metrics.late.toString()} icon={Clock} tone="amber" />
        <StatCard label="Half Day" value={metrics.halfDay.toString()} icon={Clock} tone="sky" />
        <StatCard label="Missing Punch" value={metrics.missingPunch.toString()} icon={Clock} tone="rose" />
        <StatCard label="Avg Worked Hrs" value={metrics.avgWorkedHours.toString()} icon={Clock} tone="sky" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Absenteeism</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{absenteeism.absenteeismPct}%</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {absenteeism.absentDays} absent day(s) ÷ {absenteeism.applicableWorkingDays} applicable working day(s) — weekly-offs and holidays excluded.
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Late Coming</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <p>
              <span className="font-bold text-slate-800 dark:text-slate-100">{late.lateEmployees}</span>{" "}
              <span className="text-slate-400 dark:text-slate-500">employee(s)</span>
            </p>
            <p>
              <span className="font-bold text-slate-800 dark:text-slate-100">{late.lateInstances}</span>{" "}
              <span className="text-slate-400 dark:text-slate-500">instance(s)</span>
            </p>
            <p>
              <span className="font-bold text-slate-800 dark:text-slate-100">{late.totalLateMinutes}</span>{" "}
              <span className="text-slate-400 dark:text-slate-500">total min</span>
            </p>
            <p>
              <span className="font-bold text-slate-800 dark:text-slate-100">{late.avgLateMinutes}</span>{" "}
              <span className="text-slate-400 dark:text-slate-500">avg min</span>
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Attendance by Department</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onExport(
                "attendance-by-department.csv",
                ["Department", "Employees", "Present", "Absent", "Late", "On Leave", "Overtime Hrs"],
                byDepartment.map((d) => [d.label, d.employeeCount, d.metrics.present, d.metrics.absent, d.metrics.late, d.metrics.onLeave, d.metrics.overtimeHours]),
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <Th>Department</Th>
              <Th>Employees</Th>
              <Th>Present</Th>
              <Th>Absent</Th>
              <Th>Late</Th>
              <Th>On Leave</Th>
              <Th>Overtime (hrs)</Th>
            </THead>
            <TBody>
              {byDepartment.map((d) => (
                <Tr key={d.label}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{d.label}</Td>
                  <Td>{d.employeeCount}</Td>
                  <Td>{d.metrics.present}</Td>
                  <Td>{d.metrics.absent}</Td>
                  <Td>{d.metrics.late}</Td>
                  <Td>{d.metrics.onLeave}</Td>
                  <Td>{d.metrics.overtimeHours}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {overtime.byEmployee.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Overtime by Employee</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <Th>Employee ID</Th>
                <Th>Overtime Hours</Th>
              </THead>
              <TBody>
                {overtime.byEmployee.slice(0, 20).map((r) => (
                  <Tr key={r.label}>
                    <Td>{r.label}</Td>
                    <Td>{r.count}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Leave                                                                */
/* ------------------------------------------------------------------ */

function LeaveTab({
  requests,
  balances,
  rows,
  siteIds,
  from,
  to,
  onExport,
}: {
  requests: ReturnType<typeof useLeave>["leaveRequests"];
  balances: ReturnType<typeof useLeave>["leaveBalances"];
  rows: ReportEmployeeRow[];
  siteIds: string[];
  from: string;
  to: string;
  onExport: ExportFn;
}) {
  const summary = siteIds.length === 1 ? getLeaveSummary(requests, siteIds[0], { from, to }) : null;
  const total = requests.length;
  const pending = requests.filter((r) => r.status === "Pending").length;
  const approved = requests.filter((r) => r.status === "Approved").length;
  const rejected = requests.filter((r) => r.status === "Rejected").length;
  const cancelled = requests.filter((r) => r.status === "Cancelled").length;
  const approvedDays = requests.filter((r) => r.status === "Approved").reduce((s, r) => s + r.days, 0);

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    requests.forEach((r) => map.set(r.type, (map.get(r.type) ?? 0) + 1));
    return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }, [requests]);

  const byDepartment = getLeaveBreakdown(requests, rows, (r) => r.department);
  const utilization = getLeaveUtilizationReport(balances, requests, rows);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Requests" value={total.toString()} icon={CalendarOff} tone="indigo" />
        <StatCard label="Pending" value={pending.toString()} icon={Clock} tone="amber" />
        <StatCard label="Approved" value={approved.toString()} icon={UserCheck} tone="emerald" />
        <StatCard label="Rejected / Cancelled" value={`${rejected} / ${cancelled}`} icon={UserX} tone="rose" />
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        {approvedDays} approved leave day(s) in range. Only leave that reached its final Approved status counts here — Manager-then-HR requests still awaiting HR remain
        Pending; Cancelled leave is excluded.
      </p>

      {summary && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Site summary — {summary.byType.length} leave type(s) active in range.
        </p>
      )}

      {total === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-400 dark:text-slate-500">No leave requests found.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BreakdownCard title="By Leave Type" rows={byType} />
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">By Department</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <Th>Department</Th>
                  <Th>Approved</Th>
                  <Th>Pending</Th>
                  <Th>Days</Th>
                </THead>
                <TBody>
                  {byDepartment.slice(0, 8).map((d) => (
                    <Tr key={d.label}>
                      <Td>{d.label}</Td>
                      <Td>{d.approved}</Td>
                      <Td>{d.pending}</Td>
                      <Td>{d.approvedDays}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Leave Utilization</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onExport(
                "leave-utilization.csv",
                ["Employee", "Type", "Opening", "Used", "Pending", "Available", "Utilization %"],
                utilization.map((u) => [u.employeeName, u.type, u.summary.opening, u.summary.used, u.summary.pending, u.summary.available, u.utilizationPct]),
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <Th>Employee</Th>
              <Th>Leave Type</Th>
              <Th>Opening</Th>
              <Th>Accrued</Th>
              <Th>Carry Fwd</Th>
              <Th>Used</Th>
              <Th>Pending</Th>
              <Th>Available</Th>
              <Th>Utilization</Th>
            </THead>
            <TBody>
              {utilization.map((u, i) => (
                <Tr key={`${u.employeeId}-${u.type}-${i}`}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{u.employeeName}</Td>
                  <Td>{u.type}</Td>
                  <Td>{u.summary.opening}</Td>
                  <Td>{u.summary.accrued}</Td>
                  <Td>{u.summary.carryForward}</Td>
                  <Td>{u.summary.used}</Td>
                  <Td>{u.summary.pending}</Td>
                  <Td>{u.summary.available}</Td>
                  <Td>{u.utilizationPct}%</Td>
                </Tr>
              ))}
              {utilization.length === 0 && <EmptyRow colSpan={9}>No leave policy configured, or no employees have used leave yet.</EmptyRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Payroll                                                              */
/* ------------------------------------------------------------------ */

function PayrollTab({ payslips, rows, onExport }: { payslips: ReturnType<typeof usePayroll>["payslips"]; rows: ReportEmployeeRow[]; onExport: ExportFn }) {
  const months = useMemo(() => Array.from(new Set(payslips.map((p) => p.month))).sort().reverse(), [payslips]);
  const [month, setMonth] = useState(months[0] ?? "");
  const monthSlips = useMemo(() => payslips.filter((p) => p.month === (month || months[0])), [payslips, month, months]);

  if (payslips.length === 0) {
    return <Card className="p-10 text-center text-sm text-slate-400 dark:text-slate-500">No payroll has been processed for this period.</Card>;
  }

  const report = getPayrollReport(monthSlips);
  const lop = getLopReport(monthSlips);
  const byDepartment = getPayrollBreakdown(monthSlips, rows, (r) => r.department);
  const trend = getMonthlyTrend(payslips, (p) => p.month, (slips) => slips.reduce((s, p) => s + p.netPay, 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Field label="Payroll Month">
          <Select value={month || months[0]} onChange={(e) => setMonth(e.target.value)} className="w-auto">
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Gross Payroll" value={inr(report.grossPayroll)} icon={IndianRupee} tone="indigo" />
        <StatCard label="Net Payroll" value={inr(report.netPayroll)} icon={IndianRupee} tone="emerald" />
        <StatCard label="LOP Amount" value={inr(report.lopAmount)} icon={UserX} tone="rose" />
        <StatCard label="Overtime Amount" value={inr(report.overtimeAmount)} icon={Clock} tone="amber" />
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        {report.employeeCount} employee(s) paid · {lop.lopEmployees} employee(s) with LOP totalling {lop.lopDays} day(s). Figures are read directly from finalized
        payslips — never recalculated here.
      </p>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Payroll Cost by Department (current org mapping)</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onExport(
                `payroll-by-department-${month || months[0]}.csv`,
                ["Department", "Employees", "Gross", "Deductions", "Net", "LOP", "Overtime"],
                byDepartment.map((d) => [d.label, d.employeeCount, d.gross, d.deductions, d.net, d.lop, d.overtime]),
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <Th>Department</Th>
              <Th>Employees</Th>
              <Th>Gross</Th>
              <Th>Deductions</Th>
              <Th>Net</Th>
              <Th>LOP</Th>
              <Th>Overtime</Th>
            </THead>
            <TBody>
              {byDepartment.map((d) => (
                <Tr key={d.label}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{d.label}</Td>
                  <Td>{d.employeeCount}</Td>
                  <Td>{inr(d.gross)}</Td>
                  <Td>{inr(d.deductions)}</Td>
                  <Td>{inr(d.net)}</Td>
                  <Td>{inr(d.lop)}</Td>
                  <Td>{inr(d.overtime)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {trend.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Net Payroll Trend</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend.map((t) => ({ ...t, value: Math.round(t.value) }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => inr(Number(v ?? 0))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="value" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Approvals                                                            */
/* ------------------------------------------------------------------ */

function ApprovalsTab({ instances, onExport }: { instances: ReturnType<typeof useApprovals>["instances"]; onExport: ExportFn }) {
  const report = getApprovalReport(instances);
  const byModule = getApprovalBreakdownByModule(instances);

  if (instances.length === 0) {
    return <Card className="p-10 text-center text-sm text-slate-400 dark:text-slate-500">No approval activity found for the selected period.</Card>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Pending" value={report.pending.toString()} icon={Clock} tone="amber" />
        <StatCard label="Approved" value={report.approved.toString()} icon={ClipboardCheck} tone="emerald" />
        <StatCard label="Rejected" value={report.rejected.toString()} icon={UserX} tone="rose" />
        <StatCard label="Cancelled" value={report.cancelled.toString()} icon={UserX} tone="sky" />
      </div>

      <Card className="p-5">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Approval Time (final decision − request)</p>
        {report.hasTimingData ? (
          <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
            <p>
              <span className="block text-xs text-slate-400 dark:text-slate-500">Average</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{formatDuration(report.avgApprovalMs!)}</span>
            </p>
            <p>
              <span className="block text-xs text-slate-400 dark:text-slate-500">Fastest</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{formatDuration(report.fastestMs!)}</span>
            </p>
            <p>
              <span className="block text-xs text-slate-400 dark:text-slate-500">Longest</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{formatDuration(report.longestMs!)}</span>
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">Insufficient approval history.</p>
        )}
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>By Module</CardTitle>
          <Button size="sm" variant="outline" onClick={() => onExport("approvals-by-module.csv", ["Module", "Count"], byModule.map((m) => [m.label, m.count]))}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <Th>Module</Th>
              <Th>Requests</Th>
            </THead>
            <TBody>
              {byModule.map((m) => (
                <Tr key={m.label}>
                  <Td>{m.label}</Td>
                  <Td>{m.count}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Workforce (Joiners / Exits)                                         */
/* ------------------------------------------------------------------ */

function WorkforceTab({
  rows,
  cases,
  from,
  to,
  onExport,
}: {
  rows: ReportEmployeeRow[];
  cases: ReturnType<typeof useOffboarding>["cases"];
  from: string;
  to: string;
  onExport: ExportFn;
}) {
  const joiners = getJoinersReport(rows, { from, to });
  const exits = getExitReport(cases, { from, to });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <StatCard label="New Joiners" value={joiners.length.toString()} icon={TrendingUp} tone="emerald" />
        <StatCard label="Exits" value={exits.length.toString()} icon={UserX} tone="rose" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Joiners</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onExport("joiners.csv", ["Employee", "Department", "Designation", "Site", "Joining Date"], joiners.map((j) => [j.name, j.department, j.designation, j.siteName, j.dateOfJoining]))}
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <Th>Employee</Th>
              <Th>Department</Th>
              <Th>Designation</Th>
              <Th>Site</Th>
              <Th>Joining Date</Th>
            </THead>
            <TBody>
              {joiners.map((j) => (
                <Tr key={j.employeeId}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{j.name}</Td>
                  <Td>{j.department}</Td>
                  <Td>{j.designation}</Td>
                  <Td>{j.siteName}</Td>
                  <Td>{j.dateOfJoining}</Td>
                </Tr>
              ))}
              {joiners.length === 0 && <EmptyRow colSpan={5}>No new joiners in the selected date range.</EmptyRow>}
            </TBody>
          </Table>
          <TableFootnote>Showing 1 to {joiners.length} of {joiners.length} entries</TableFootnote>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Exits</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onExport("exits.csv", ["Employee", "Department", "Last Working Day", "Reason"], exits.map((x) => [x.employee, x.department, x.lastWorkingDay, x.reason]))}
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <Th>Employee</Th>
              <Th>Department</Th>
              <Th>Last Working Day</Th>
              <Th>Reason</Th>
            </THead>
            <TBody>
              {exits.map((x) => (
                <Tr key={x.employeeId}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{x.employee}</Td>
                  <Td>{x.department}</Td>
                  <Td>{x.lastWorkingDay}</Td>
                  <Td>{x.reason}</Td>
                </Tr>
              ))}
              {exits.length === 0 && <EmptyRow colSpan={4}>No completed exits in the selected date range.</EmptyRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Employee self-service                                               */
/* ------------------------------------------------------------------ */

function MyReportsView({ employeeId }: { employeeId: string }) {
  const { attendance } = useAttendance();
  const { requestsFor, leaveTypesForSite, balanceSummaryFor } = useLeave();
  const { payslipsForEmployee } = usePayroll();
  const { currentUser } = useAccessControl();

  const [from, setFrom] = useState(firstOfMonthStr());
  const [to, setTo] = useState(todayStr());

  const myAttendance = attendance.filter((r) => r.employeeId === employeeId && r.date >= from && r.date <= to);
  const attendanceMetrics = getAttendanceReport(myAttendance);
  const myLeave = requestsFor(employeeId).filter((r) => r.from <= to && r.to >= from);
  const myLeaveTypes = leaveTypesForSite(currentUser.siteId);
  const myPayslips = payslipsForEmployee(employeeId).sort((a, b) => (a.month < b.month ? 1 : -1));

  const [active, setActive] = useState("attendance");
  const tabs = [
    { id: "attendance", label: "My Attendance" },
    { id: "leave", label: "My Leave" },
    { id: "payroll", label: "My Payroll" },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
          </Field>
          <Field label="To">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          </Field>
        </div>
      </Card>

      <Tabs tabs={tabs} active={active} onChange={setActive} />

      {active === "attendance" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Present" value={attendanceMetrics.present.toString()} icon={UserCheck} tone="emerald" />
            <StatCard label="Absent" value={attendanceMetrics.absent.toString()} icon={UserX} tone="rose" />
            <StatCard label="On Leave" value={attendanceMetrics.onLeave.toString()} icon={CalendarOff} tone="amber" />
            <StatCard label="Overtime (hrs)" value={attendanceMetrics.overtimeHours.toString()} icon={Clock} tone="indigo" />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th>Worked Hours</Th>
                  <Th>Overtime</Th>
                </THead>
                <TBody>
                  {myAttendance
                    .slice()
                    .sort((a, b) => (a.date < b.date ? 1 : -1))
                    .map((r) => (
                      <Tr key={r.id}>
                        <Td>{r.date}</Td>
                        <Td>
                          <StatusBadge status={r.status} />
                        </Td>
                        <Td>{r.workedHours}</Td>
                        <Td>{r.overtimeHours}</Td>
                      </Tr>
                    ))}
                  {myAttendance.length === 0 && <EmptyRow colSpan={4}>No attendance data available for the selected period.</EmptyRow>}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {active === "leave" && (
        <div className="space-y-6">
          {myLeaveTypes.length === 0 ? (
            <Card className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">No leave policy configured.</Card>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {myLeaveTypes.map((t) => {
                const s = balanceSummaryFor(employeeId, currentUser.siteId, t.name);
                return (
                  <Card key={t.id} className="p-4 text-center">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{s?.available ?? 0}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{t.name} available</p>
                  </Card>
                );
              })}
            </div>
          )}
          <Card>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <Th>Leave Type</Th>
                  <Th>From</Th>
                  <Th>To</Th>
                  <Th>Days</Th>
                  <Th>Status</Th>
                </THead>
                <TBody>
                  {myLeave.map((l) => (
                    <Tr key={l.id}>
                      <Td>{l.type}</Td>
                      <Td>{l.from}</Td>
                      <Td>{l.to}</Td>
                      <Td>{l.days}</Td>
                      <Td>
                        <StatusBadge status={l.status} />
                      </Td>
                    </Tr>
                  ))}
                  {myLeave.length === 0 && <EmptyRow colSpan={5}>No leave requests found.</EmptyRow>}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {active === "payroll" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <Th>Month</Th>
                <Th>Gross</Th>
                <Th>Deductions</Th>
                <Th>Net Pay</Th>
                <Th>LOP Days</Th>
              </THead>
              <TBody>
                {myPayslips.map((p) => (
                  <Tr key={p.id}>
                    <Td>{p.month}</Td>
                    <Td>{inr(p.grossEarnings)}</Td>
                    <Td>{inr(p.totalDeductions)}</Td>
                    <Td className="font-medium text-slate-800 dark:text-slate-100">{inr(p.netPay)}</Td>
                    <Td>{p.lopDays}</Td>
                  </Tr>
                ))}
                {myPayslips.length === 0 && <EmptyRow colSpan={5}>No payroll has been processed for you yet.</EmptyRow>}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

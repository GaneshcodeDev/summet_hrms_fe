"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Users, UserCheck, UserX, CalendarOff, Clock, TrendingUp, IndianRupee, ClipboardCheck, Search, GraduationCap } from "lucide-react";
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
import { useEmployeeLifecycle } from "@/lib/employee-lifecycle-context";
import { useRecruitment } from "@/lib/recruitment-context";
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
  getApprovalSlaByModule,
  getAttendanceBreakdown,
  getAttendanceReport,
  getExitReport,
  getEmployeeLifecycleEventsByType,
  getHeadcountReport,
  getHiringBreakdown,
  getInterviewConversionReport,
  getJoinersReport,
  getLateComingBreakdown,
  getLateComingReport,
  getLeaveBreakdown,
  getLeaveSummary,
  getLeaveUtilizationReport,
  getLopBreakdown,
  getLopMonthlyTrend,
  getLopReport,
  getMonthlyTrend,
  getOfferConversionReport,
  getOvertimeReport,
  getPayrollBreakdown,
  getPayrollReport,
  getPerformanceCompletionReport,
  getGoalCompletionReport,
  getRatingDistribution,
  getPerformanceRatingBreakdown,
  getPromotionRecommendations,
  getSalaryRevisionRecommendations,
  getTrainingProgramReport,
  getTrainingBreakdown,
  getSkillDistribution,
  getAssetReport,
  getAssetsByType,
  getAssetsByDimension,
  getAssetsByEmployee,
  getExpenseReport,
  getTravelReport,
  getExpensesByCategory,
  getExpensesByDimension,
  getExpensesByEmployee,
  getTravelByType,
  getMonthlyExpenseTrend,
  getRecruitmentFunnelReport,
  getRequisitionReport,
  getSiteComparisonReport,
  getSourceWiseHiring,
  latestRunPerSite,
  type ReportEmployeeRow,
} from "@/lib/report-selectors";
import { usePerformance } from "@/lib/performance-context";
import { useTraining } from "@/lib/training-context";
import { useSkills } from "@/lib/skills-context";
import { useAssets } from "@/lib/asset-context";
import { useExpense } from "@/lib/expense-context";
import type { AppraisalDecision, Asset, AssetAssignment, EmployeeSkill, ExpenseClaim, PerformanceGoal, PerformanceReviewCase, Site, TrainingEnrollment, TrainingProgram, TravelRequest } from "@/lib/types";

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
/** Most date fields in this app are ISO ("YYYY-MM-DD"), safely sliceable — but a couple of seed records store a human-readable date, so parse defensively rather than assume the format. */
function monthOf(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const CHART_COLOR = "#4f46e5";
const PIE_COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

/* ------------------------------------------------------------------ */
/* Generic filter dimensions — every value derives from ReportEmployeeRow,   */
/* never a second lookup. Which of these show up is scoped per report tab.  */
/* ------------------------------------------------------------------ */

type FilterKey = "department" | "subDepartment" | "designation" | "grade" | "employmentType" | "employeeType" | "location" | "plant" | "status" | "employeeId";

const FILTER_LABELS: Record<FilterKey, string> = {
  department: "Department",
  subDepartment: "Sub Department",
  designation: "Designation",
  grade: "Grade",
  employmentType: "Employment Type",
  employeeType: "Employee Type",
  location: "Location",
  plant: "Plant",
  status: "Status",
  employeeId: "Employee",
};

const FILTERS_BY_TAB: Record<string, FilterKey[]> = {
  overview: ["department", "subDepartment", "designation", "grade", "employmentType", "employeeType", "location", "plant", "status"],
  attendance: ["department", "location", "plant", "status", "employeeId"],
  leave: ["department", "employmentType", "status", "employeeId"],
  payroll: ["department", "employeeId"],
  approvals: ["department"],
  workforce: ["department", "employmentType", "employeeType"],
};

function rowFieldFor(key: FilterKey, row: ReportEmployeeRow): string {
  if (key === "employeeId") return row.employeeId;
  return row[key];
}

/** Simple local search+pagination for the larger report tables — no server round-trip, no separate fetch per chart. */
function useTablePaging<T>(items: T[], searchFn: (item: T, q: string) => boolean, pageSize = 10) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => (search.trim() ? items.filter((item) => searchFn(item, search.trim().toLowerCase())) : items), [items, search, searchFn]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  return {
    search,
    setSearch: (v: string) => {
      setSearch(v);
      setPage(1);
    },
    page: safePage,
    setPage,
    totalPages,
    paged,
    filteredCount: filtered.length,
    rangeStart: filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1,
    rangeEnd: Math.min(safePage * pageSize, filtered.length),
  };
}

function TableSearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-8" />
    </div>
  );
}

function PagerFooter({ page, totalPages, onPage, rangeStart, rangeEnd, total }: { page: number; totalPages: number; onPage: (p: number) => void; rangeStart: number; rangeEnd: number; total: number }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
      <TableFootnote>
        Showing {rangeStart} to {rangeEnd} of {total} entries
      </TableFootnote>
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            Prev
          </Button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {page} / {totalPages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

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
  const { events: lifecycleEvents } = useEmployeeLifecycle();
  const { reviewCases: performanceReviewCases, goals: performanceGoals, appraisals } = usePerformance();
  const { programs: trainingPrograms, enrollments: trainingEnrollments } = useTraining();
  const { skills: employeeSkills } = useSkills();
  const { assets, assignments: assetAssignments } = useAssets();
  const { expenseClaims, travelRequests } = useExpense();
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
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    department: "All",
    subDepartment: "All",
    designation: "All",
    grade: "All",
    employmentType: "All",
    employeeType: "All",
    location: "All",
    plant: "All",
    status: "All",
    employeeId: "All",
  });
  const [active, setActive] = useState("overview");

  function setFilter(key: FilterKey, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

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

  // Dropdown options for every filter dimension, derived straight from the current site/role scope — never another site's values.
  const filterOptions = useMemo(() => {
    const opts: Record<FilterKey, string[]> = {
      department: [],
      subDepartment: [],
      designation: [],
      grade: [],
      employmentType: [],
      employeeType: [],
      location: [],
      plant: [],
      status: [],
      employeeId: [],
    };
    (Object.keys(opts) as FilterKey[]).forEach((key) => {
      if (key === "employeeId") {
        opts[key] = rows.map((r) => r.employeeId);
        return;
      }
      opts[key] = Array.from(new Set(rows.map((r) => rowFieldFor(key, r)))).sort();
    });
    return opts;
  }, [rows]);

  const employeeNameById = useMemo(() => new Map(rows.map((r) => [r.employeeId, r.name])), [rows]);

  const filteredRows = useMemo(
    () =>
      rows.filter((r) =>
        (Object.keys(filters) as FilterKey[]).every((key) => filters[key] === "All" || rowFieldFor(key, r) === filters[key]),
      ),
    [rows, filters],
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
  const allSitePayslips = useMemo(
    () => (canSeeSalary ? payslips.filter((p) => filteredEmployeeIds.has(p.employeeId)) : []),
    [payslips, filteredEmployeeIds, canSeeSalary],
  );
  const scopedApprovals = useMemo(
    () => instances.filter((i) => effectiveSiteIds.includes(i.siteId) && (!isManagerTier || filteredEmployeeIds.has(i.requestedBy))),
    [instances, effectiveSiteIds, isManagerTier, filteredEmployeeIds],
  );
  const scopedSeparations = useMemo(
    () => separationCases.filter((c) => c.siteId && effectiveSiteIds.includes(c.siteId)),
    [separationCases, effectiveSiteIds],
  );
  const scopedLifecycleEvents = useMemo(
    () => lifecycleEvents.filter((e) => effectiveSiteIds.includes(e.siteId)),
    [lifecycleEvents, effectiveSiteIds],
  );
  const scopedReviewCases = useMemo(
    () => performanceReviewCases.filter((c) => effectiveSiteIds.includes(c.siteId)),
    [performanceReviewCases, effectiveSiteIds],
  );
  const scopedPerformanceGoals = useMemo(
    () => performanceGoals.filter((g) => effectiveSiteIds.includes(g.siteId)),
    [performanceGoals, effectiveSiteIds],
  );
  const scopedAppraisals = useMemo(
    () => appraisals.filter((a) => effectiveSiteIds.includes(a.siteId)),
    [appraisals, effectiveSiteIds],
  );
  const scopedTrainingPrograms = useMemo(
    () => trainingPrograms.filter((p) => effectiveSiteIds.includes(p.siteId)),
    [trainingPrograms, effectiveSiteIds],
  );
  const scopedTrainingEnrollments = useMemo(
    () => trainingEnrollments.filter((e) => effectiveSiteIds.includes(e.siteId)),
    [trainingEnrollments, effectiveSiteIds],
  );
  const scopedAssets = useMemo(() => assets.filter((a) => effectiveSiteIds.includes(a.siteId)), [assets, effectiveSiteIds]);
  const scopedAssetAssignments = useMemo(
    () => assetAssignments.filter((a) => effectiveSiteIds.includes(a.siteId)),
    [assetAssignments, effectiveSiteIds],
  );
  // Ranged like Leave (trip/submission overlapping [from, to]) — a claim still
  // in Draft has no submittedOn yet and isn't real activity, so it's excluded
  // from the date-ranged report (still visible on the employee's own list).
  const rangedExpenseClaims = useMemo(
    () => expenseClaims.filter((c) => filteredEmployeeIds.has(c.employeeId) && effectiveSiteIds.includes(c.siteId) && c.submittedOn && c.submittedOn >= from && c.submittedOn <= to),
    [expenseClaims, filteredEmployeeIds, effectiveSiteIds, from, to],
  );
  const rangedTravelRequests = useMemo(
    () => travelRequests.filter((r) => filteredEmployeeIds.has(r.employeeId) && effectiveSiteIds.includes(r.siteId) && r.fromDate <= to && r.toDate >= from),
    [travelRequests, filteredEmployeeIds, effectiveSiteIds, from, to],
  );

  const canSeeRecruitment =
    canFeature("recruitment.requisitions", "view") || canFeature("recruitment.openings", "view") || canFeature("recruitment.pipeline", "view");
  const canSeePerformance = canFeature("performance.reviews", "view");
  const canSeeTraining = canFeature("training.programs", "view");
  const canSeeAssets = canFeature("assets.inventory", "view");
  const canSeeExpenses = canFeature("expenses.claims", "view") || canFeature("expenses.travel", "view");

  const tabs = useMemo(() => {
    const t = [
      { id: "overview", label: "Overview" },
      { id: "attendance", label: "Attendance" },
      { id: "leave", label: "Leave" },
    ];
    if (canSeeSalary) t.push({ id: "payroll", label: "Payroll" });
    if (!isManagerTier || canFeature("leave.requests", "approve")) t.push({ id: "approvals", label: "Approvals" });
    t.push({ id: "workforce", label: "Workforce" });
    if (canSeePerformance) t.push({ id: "performance", label: "Performance" });
    if (canSeeTraining) t.push({ id: "training", label: "Training" });
    if (canSeeAssets) t.push({ id: "assets", label: "Assets" });
    if (canSeeExpenses) t.push({ id: "expenses", label: "Expenses" });
    if (canSeeRecruitment) t.push({ id: "recruitment", label: "Recruitment" });
    return t;
  }, [canSeeSalary, isManagerTier, canFeature, canSeeRecruitment, canSeePerformance, canSeeTraining, canSeeAssets, canSeeExpenses]);

  function exportCurrentTable(filename: string, headers: string[], data: (string | number)[][]) {
    if (!canFeature("reports.analytics", "export")) return;
    downloadCsv(filename, headers, data);
  }

  const relevantFilters = FILTERS_BY_TAB[active] ?? [];

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
          {relevantFilters.map((key) => {
            const opts = filterOptions[key];
            if (opts.length === 0) return null;
            return (
              <Field key={key} label={FILTER_LABELS[key]}>
                <Select value={filters[key]} onChange={(e) => setFilter(key, e.target.value)} className="w-auto">
                  <option value="All">All {FILTER_LABELS[key]}</option>
                  {opts.map((o) => (
                    <option key={o} value={o}>
                      {key === "employeeId" ? `${employeeNameById.get(o) ?? o} (${o})` : o}
                    </option>
                  ))}
                </Select>
              </Field>
            );
          })}
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
          onDrillDown={setFilter}
        />
      )}
      {active === "attendance" && (
        <AttendanceTab
          records={rangedAttendance}
          rows={filteredRows}
          from={from}
          to={to}
          isMultiSite={effectiveSiteIds.length > 1}
          configForSite={configForSite}
          onExport={exportCurrentTable}
          onDrillDown={setFilter}
        />
      )}
      {active === "leave" && (
        <LeaveTab requests={rangedLeave} balances={scopedBalances} rows={filteredRows} siteIds={effectiveSiteIds} from={from} to={to} onExport={exportCurrentTable} onDrillDown={setFilter} />
      )}
      {active === "payroll" && canSeeSalary && (
        <PayrollTab payslips={scopedPayslips} allMonthsPayslips={allSitePayslips} rows={filteredRows} onExport={exportCurrentTable} onDrillDown={setFilter} />
      )}
      {active === "approvals" && <ApprovalsTab instances={scopedApprovals} onExport={exportCurrentTable} />}
      {active === "workforce" && (
        <WorkforceTab rows={filteredRows} allRows={rows} cases={scopedSeparations} lifecycleEvents={scopedLifecycleEvents} from={from} to={to} onExport={exportCurrentTable} />
      )}
      {active === "performance" && canSeePerformance && (
        <PerformanceReportTab
          cases={scopedReviewCases}
          goals={scopedPerformanceGoals}
          appraisals={scopedAppraisals}
          rows={filteredRows}
          onExport={exportCurrentTable}
        />
      )}
      {active === "training" && canSeeTraining && (
        <TrainingReportTab
          programs={scopedTrainingPrograms}
          enrollments={scopedTrainingEnrollments}
          skills={employeeSkills}
          rows={filteredRows}
          onExport={exportCurrentTable}
        />
      )}
      {active === "assets" && canSeeAssets && (
        <AssetsReportTab
          assets={scopedAssets}
          assignments={scopedAssetAssignments}
          rows={filteredRows}
          employeeIdsOnNotice={employees.filter((e) => e.employmentStage === "On Notice").map((e) => e.employeeId)}
          onExport={exportCurrentTable}
        />
      )}
      {active === "expenses" && canSeeExpenses && (
        <ExpensesReportTab claims={rangedExpenseClaims} travelRequests={rangedTravelRequests} rows={filteredRows} onExport={exportCurrentTable} />
      )}
      {active === "recruitment" && <RecruitmentTab siteIds={effectiveSiteIds} onExport={exportCurrentTable} />}
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
type DrillDownFn = (key: FilterKey, value: string) => void;

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
  onDrillDown,
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
  onDrillDown: DrillDownFn;
}) {
  const headcount = useMemo(() => getHeadcountReport(rows, { from, to }), [rows, from, to]);
  const isMultiSite = useMemo(() => new Set(rows.map((r) => r.siteId)).size > 1, [rows]);

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
                <Bar
                  dataKey="count"
                  fill={CHART_COLOR}
                  radius={[4, 4, 0, 0]}
                  onClick={(d: { payload?: { label?: string } }) => d?.payload?.label && onDrillDown("department", d.payload.label)}
                  cursor="pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {isMultiSite && <BreakdownCard title="By Site" rows={headcount.bySite} />}
        <BreakdownCard title="By Sub Department" rows={headcount.bySubDepartment} onRowClick={(v) => onDrillDown("subDepartment", v)} />
        <BreakdownCard title="By Designation" rows={headcount.byDesignation} onRowClick={(v) => onDrillDown("designation", v)} />
        <BreakdownCard title="By Grade" rows={headcount.byGrade} onRowClick={(v) => onDrillDown("grade", v)} />
        <BreakdownCard title="By Employment Type" rows={headcount.byEmploymentType} onRowClick={(v) => onDrillDown("employmentType", v)} />
        <BreakdownCard title="By Employee Type" rows={headcount.byEmployeeType} onRowClick={(v) => onDrillDown("employeeType", v)} />
        <BreakdownCard title="By Location" rows={headcount.byLocation} onRowClick={(v) => onDrillDown("location", v)} />
        <BreakdownCard title="By Plant" rows={headcount.byPlant} onRowClick={(v) => onDrillDown("plant", v)} />
      </div>

      {isSuperAdmin && isAllSites && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Site Comparison</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onExport(
                  "site-comparison.csv",
                  ["Site", "Employees", "Active", "Present Today", "Absent Today", "On Leave", "Payroll Cost", "Overtime (hrs)", "LOP"],
                  siteComparison.map((s) => [s.siteName, s.employeeCount, s.activeEmployees, s.presentToday, s.absentToday, s.onLeaveToday, s.payrollCost, s.overtimeHours, s.lopAmount]),
                )
              }
            >
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
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

function BreakdownCard({ title, rows, onRowClick }: { title: string; rows: { label: string; count: number }[]; onRowClick?: (label: string) => void }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {rows.slice(0, 8).map((r) => (
          <div
            key={r.label}
            className={`flex items-center gap-3 text-sm ${onRowClick ? "cursor-pointer rounded px-1 -mx-1 hover:bg-slate-50 dark:hover:bg-slate-800/60" : ""}`}
            onClick={() => onRowClick?.(r.label)}
            title={onRowClick ? `Filter by ${r.label}` : undefined}
          >
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

type AttendanceDimension = "department" | "siteName" | "shift" | "location" | "plant";
const ATTENDANCE_DIMENSIONS: { id: AttendanceDimension; label: string }[] = [
  { id: "department", label: "Department" },
  { id: "siteName", label: "Site" },
  { id: "shift", label: "Shift" },
  { id: "location", label: "Location" },
  { id: "plant", label: "Plant" },
];

function AttendanceTab({
  records,
  rows,
  from,
  to,
  isMultiSite,
  configForSite,
  onExport,
  onDrillDown,
}: {
  records: ReturnType<typeof useAttendance>["attendance"];
  rows: ReportEmployeeRow[];
  from: string;
  to: string;
  isMultiSite: boolean;
  configForSite: ReturnType<typeof useSiteConfig>["configForSite"];
  onExport: ExportFn;
  onDrillDown: DrillDownFn;
}) {
  const [dimension, setDimension] = useState<AttendanceDimension>("department");

  const metrics = useMemo(() => getAttendanceReport(records), [records]);
  const late = useMemo(() => getLateComingReport(records), [records]);
  const overtime = useMemo(() => getOvertimeReport(records), [records]);
  const byDimension = useMemo(() => getAttendanceBreakdown(records, rows, (r) => r[dimension]), [records, rows, dimension]);
  const lateByDepartment = useMemo(() => getLateComingBreakdown(records, rows, (r) => r.department), [records, rows]);
  const overtimeBySite = useMemo(() => getAttendanceBreakdown(records, rows, (r) => r.siteName), [records, rows]);
  const trend = useMemo(() => getMonthlyTrend(records, (r) => r.date.slice(0, 7), (recs) => getAttendanceReport(recs).present), [records]);

  const bySiteIds = Array.from(new Set(rows.map((r) => r.siteId)));
  const workingDaysSet = new Set<string>();
  const holidaysSet = new Set<string>();
  for (const siteId of bySiteIds) {
    const cfg = configForSite(siteId);
    (cfg?.attendance.workingDays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"]).forEach((d) => workingDaysSet.add(d));
    (cfg?.holiday.holidays ?? []).forEach((h) => holidaysSet.add(h.date));
  }
  const absenteeism = getAbsenteeismReport(records, rows.length, { from, to }, Array.from(workingDaysSet), Array.from(holidaysSet));

  const overtimePaging = useTablePaging(overtime.byEmployee, (r, q) => r.label.toLowerCase().includes(q));
  const latePaging = useTablePaging(lateByDepartment, (r, q) => r.label.toLowerCase().includes(q));

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
          <CardTitle>Attendance by {ATTENDANCE_DIMENSIONS.find((d) => d.id === dimension)?.label}</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={dimension} onChange={(e) => setDimension(e.target.value as AttendanceDimension)} className="w-auto">
              {ATTENDANCE_DIMENSIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  Break down by {d.label}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onExport(
                  `attendance-by-${dimension}.csv`,
                  ["Group", "Employees", "Present", "Absent", "Late", "On Leave", "Overtime Hrs"],
                  byDimension.map((d) => [d.label, d.employeeCount, d.metrics.present, d.metrics.absent, d.metrics.late, d.metrics.onLeave, d.metrics.overtimeHours]),
                )
              }
            >
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <Th>{ATTENDANCE_DIMENSIONS.find((d) => d.id === dimension)?.label}</Th>
              <Th>Employees</Th>
              <Th>Present</Th>
              <Th>Absent</Th>
              <Th>Late</Th>
              <Th>On Leave</Th>
              <Th>Overtime (hrs)</Th>
            </THead>
            <TBody>
              {byDimension.map((d) => (
                <Tr
                  key={d.label}
                  className={dimension === "department" ? "cursor-pointer" : undefined}
                  onClick={() => dimension === "department" && onDrillDown("department", d.label)}
                >
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{d.label}</Td>
                  <Td>{d.employeeCount}</Td>
                  <Td>{d.metrics.present}</Td>
                  <Td>{d.metrics.absent}</Td>
                  <Td>{d.metrics.late}</Td>
                  <Td>{d.metrics.onLeave}</Td>
                  <Td>{d.metrics.overtimeHours}</Td>
                </Tr>
              ))}
              {byDimension.length === 0 && <EmptyRow colSpan={7}>No data for this breakdown.</EmptyRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {trend.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Present Headcount Trend</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="value" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {lateByDepartment.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Late Coming by Department</CardTitle>
            <div className="flex items-center gap-2">
              <TableSearchBar value={latePaging.search} onChange={latePaging.setSearch} placeholder="Search department..." />
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onExport(
                    "late-coming-by-department.csv",
                    ["Department", "Late Employees", "Late Instances", "Total Late Minutes", "Avg Late Minutes"],
                    lateByDepartment.map((d) => [d.label, d.report.lateEmployees, d.report.lateInstances, d.report.totalLateMinutes, d.report.avgLateMinutes]),
                  )
                }
              >
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <Th>Department</Th>
                <Th>Late Employees</Th>
                <Th>Late Instances</Th>
                <Th>Total Late Min</Th>
                <Th>Avg Late Min</Th>
              </THead>
              <TBody>
                {latePaging.paged.map((d) => (
                  <Tr key={d.label}>
                    <Td className="font-medium text-slate-800 dark:text-slate-100">{d.label}</Td>
                    <Td>{d.report.lateEmployees}</Td>
                    <Td>{d.report.lateInstances}</Td>
                    <Td>{d.report.totalLateMinutes}</Td>
                    <Td>{d.report.avgLateMinutes}</Td>
                  </Tr>
                ))}
                {latePaging.paged.length === 0 && <EmptyRow colSpan={5}>No matching departments.</EmptyRow>}
              </TBody>
            </Table>
            <PagerFooter page={latePaging.page} totalPages={latePaging.totalPages} onPage={latePaging.setPage} rangeStart={latePaging.rangeStart} rangeEnd={latePaging.rangeEnd} total={latePaging.filteredCount} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {overtime.byEmployee.length > 0 && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Overtime by Employee</CardTitle>
              <div className="flex items-center gap-2">
                <TableSearchBar value={overtimePaging.search} onChange={overtimePaging.setSearch} placeholder="Search employee..." />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onExport("overtime-by-employee.csv", ["Employee ID", "Overtime Hours"], overtime.byEmployee.map((r) => [r.label, r.count]))}
                >
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <Th>Employee ID</Th>
                  <Th>Overtime Hours</Th>
                </THead>
                <TBody>
                  {overtimePaging.paged.map((r) => (
                    <Tr key={r.label}>
                      <Td>{r.label}</Td>
                      <Td>{r.count}</Td>
                    </Tr>
                  ))}
                  {overtimePaging.paged.length === 0 && <EmptyRow colSpan={2}>No matching employees.</EmptyRow>}
                </TBody>
              </Table>
              <PagerFooter page={overtimePaging.page} totalPages={overtimePaging.totalPages} onPage={overtimePaging.setPage} rangeStart={overtimePaging.rangeStart} rangeEnd={overtimePaging.rangeEnd} total={overtimePaging.filteredCount} />
            </CardContent>
          </Card>
        )}

        {isMultiSite && (
          <Card>
            <CardHeader>
              <CardTitle>Overtime by Site</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <Th>Site</Th>
                  <Th>Overtime (hrs)</Th>
                </THead>
                <TBody>
                  {overtimeBySite.map((s) => (
                    <Tr key={s.label}>
                      <Td className="font-medium text-slate-800 dark:text-slate-100">{s.label}</Td>
                      <Td>{s.metrics.overtimeHours}</Td>
                    </Tr>
                  ))}
                  {overtimeBySite.length === 0 && <EmptyRow colSpan={2}>No data.</EmptyRow>}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
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
  onDrillDown,
}: {
  requests: ReturnType<typeof useLeave>["leaveRequests"];
  balances: ReturnType<typeof useLeave>["leaveBalances"];
  rows: ReportEmployeeRow[];
  siteIds: string[];
  from: string;
  to: string;
  onExport: ExportFn;
  onDrillDown: DrillDownFn;
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

  const byDepartment = useMemo(() => getLeaveBreakdown(requests, rows, (r) => r.department), [requests, rows]);
  const utilization = useMemo(() => getLeaveUtilizationReport(balances, requests, rows), [balances, requests, rows]);
  const trend = useMemo(
    () => getMonthlyTrend(requests.filter((r) => r.status === "Approved"), (r) => r.from.slice(0, 7), (reqs) => Math.round(reqs.reduce((s, r) => s + r.days, 0))),
    [requests],
  );

  const utilizationPaging = useTablePaging(utilization, (u, q) => u.employeeName.toLowerCase().includes(q) || u.type.toLowerCase().includes(q));

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
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">By Leave Type</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byType}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      label={(props: { name?: string; value?: number }) => `${props.name}: ${props.value}`}
                    >
                      {byType.map((entry, i) => (
                        <Cell key={entry.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
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
                    <Tr key={d.label} className="cursor-pointer" onClick={() => onDrillDown("department", d.label)}>
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

      {trend.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Approved Leave Days Trend</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="value" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Leave Utilization</CardTitle>
          <div className="flex items-center gap-2">
            <TableSearchBar value={utilizationPaging.search} onChange={utilizationPaging.setSearch} placeholder="Search employee or type..." />
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
          </div>
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
              {utilizationPaging.paged.map((u, i) => (
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
              {utilizationPaging.paged.length === 0 && <EmptyRow colSpan={9}>No leave policy configured, or no employees have used leave yet.</EmptyRow>}
            </TBody>
          </Table>
          <PagerFooter
            page={utilizationPaging.page}
            totalPages={utilizationPaging.totalPages}
            onPage={utilizationPaging.setPage}
            rangeStart={utilizationPaging.rangeStart}
            rangeEnd={utilizationPaging.rangeEnd}
            total={utilizationPaging.filteredCount}
          />
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Payroll                                                              */
/* ------------------------------------------------------------------ */

function PayrollTab({
  payslips,
  allMonthsPayslips,
  rows,
  onExport,
  onDrillDown,
}: {
  payslips: ReturnType<typeof usePayroll>["payslips"];
  allMonthsPayslips: ReturnType<typeof usePayroll>["payslips"];
  rows: ReportEmployeeRow[];
  onExport: ExportFn;
  onDrillDown: DrillDownFn;
}) {
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
  const lopByEmployeeRaw = getLopBreakdown(monthSlips, rows, (r) => r.name);
  const lopByDepartment = getLopBreakdown(monthSlips, rows, (r) => r.department);
  const lopTrend = getLopMonthlyTrend(allMonthsPayslips);

  const lopByEmployeePaging = useTablePaging(lopByEmployeeRaw, (r, q) => r.label.toLowerCase().includes(q));

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
                <Tr key={d.label} className="cursor-pointer" onClick={() => onDrillDown("department", d.label)}>
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

      {lopByDepartment.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>LOP by Department</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onExport(
                  `lop-by-department-${month || months[0]}.csv`,
                  ["Department", "Employees", "LOP Amount"],
                  lopByDepartment.map((d) => [d.label, d.employeeCount, d.lop]),
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
                <Th>LOP Amount</Th>
              </THead>
              <TBody>
                {lopByDepartment.map((d) => (
                  <Tr key={d.label} className="cursor-pointer" onClick={() => onDrillDown("department", d.label)}>
                    <Td className="font-medium text-slate-800 dark:text-slate-100">{d.label}</Td>
                    <Td>{d.employeeCount}</Td>
                    <Td>{inr(d.lop)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {lopByEmployeeRaw.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>LOP by Employee</CardTitle>
            <div className="flex items-center gap-2">
              <TableSearchBar value={lopByEmployeePaging.search} onChange={lopByEmployeePaging.setSearch} placeholder="Search employee..." />
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onExport(
                    `lop-by-employee-${month || months[0]}.csv`,
                    ["Employee", "LOP Amount"],
                    lopByEmployeeRaw.map((d) => [d.label, d.lop]),
                  )
                }
              >
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <Th>Employee</Th>
                <Th>LOP Amount</Th>
              </THead>
              <TBody>
                {lopByEmployeePaging.paged.map((d) => (
                  <Tr key={d.label}>
                    <Td className="font-medium text-slate-800 dark:text-slate-100">{d.label}</Td>
                    <Td>{inr(d.lop)}</Td>
                  </Tr>
                ))}
                {lopByEmployeePaging.paged.length === 0 && <EmptyRow colSpan={2}>No matching employees.</EmptyRow>}
              </TBody>
            </Table>
            <PagerFooter
              page={lopByEmployeePaging.page}
              totalPages={lopByEmployeePaging.totalPages}
              onPage={lopByEmployeePaging.setPage}
              rangeStart={lopByEmployeePaging.rangeStart}
              rangeEnd={lopByEmployeePaging.rangeEnd}
              total={lopByEmployeePaging.filteredCount}
            />
          </CardContent>
        </Card>
      )}

      {lopTrend.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>LOP Amount Trend</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lopTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => inr(Number(v ?? 0))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} />
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
  const report = useMemo(() => getApprovalReport(instances), [instances]);
  const byModule = useMemo(() => getApprovalBreakdownByModule(instances), [instances]);
  const slaByModule = useMemo(() => getApprovalSlaByModule(instances), [instances]);

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>By Module</CardTitle>
            <Button size="sm" variant="outline" onClick={() => onExport("approvals-by-module.csv", ["Module", "Count"], byModule.map((m) => [m.label, m.count]))}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byModule}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approval SLA by Module</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <Th>Module</Th>
                <Th>Average</Th>
                <Th>Fastest</Th>
                <Th>Longest</Th>
              </THead>
              <TBody>
                {slaByModule.map((s) => (
                  <Tr key={s.module}>
                    <Td className="font-medium text-slate-800 dark:text-slate-100">{s.module}</Td>
                    {s.report.hasTimingData ? (
                      <>
                        <Td>{formatDuration(s.report.avgApprovalMs!)}</Td>
                        <Td>{formatDuration(s.report.fastestMs!)}</Td>
                        <Td>{formatDuration(s.report.longestMs!)}</Td>
                      </>
                    ) : (
                      <Td colSpan={3} className="text-slate-400 dark:text-slate-500">
                        Insufficient approval history
                      </Td>
                    )}
                  </Tr>
                ))}
                {slaByModule.length === 0 && <EmptyRow colSpan={4}>Insufficient approval history.</EmptyRow>}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Workforce (Joiners / Exits)                                         */
/* ------------------------------------------------------------------ */

function WorkforceTab({
  rows,
  allRows,
  cases,
  lifecycleEvents,
  from,
  to,
  onExport,
}: {
  rows: ReportEmployeeRow[];
  allRows: ReportEmployeeRow[];
  cases: ReturnType<typeof useOffboarding>["cases"];
  lifecycleEvents: ReturnType<typeof useEmployeeLifecycle>["events"];
  from: string;
  to: string;
  onExport: ExportFn;
}) {
  const joiners = useMemo(() => getJoinersReport(rows, { from, to }), [rows, from, to]);
  const exits = useMemo(() => getExitReport(cases, { from, to }), [cases, from, to]);
  const joinersTrend = useMemo(() => getMonthlyTrend(allRows, (r) => monthOf(r.dateOfJoining), (rs) => rs.length), [allRows]);
  const exitsTrend = useMemo(() => getMonthlyTrend(getExitReport(cases), (x) => x.lastWorkingDay.slice(0, 7), (xs) => xs.length), [cases]);
  const confirmations = useMemo(() => getEmployeeLifecycleEventsByType(lifecycleEvents, "Confirmed", { from, to }), [lifecycleEvents, from, to]);
  const transfers = useMemo(() => getEmployeeLifecycleEventsByType(lifecycleEvents, "Transferred", { from, to }), [lifecycleEvents, from, to]);
  const promotions = useMemo(() => getEmployeeLifecycleEventsByType(lifecycleEvents, "Promoted", { from, to }), [lifecycleEvents, from, to]);
  const salaryRevisions = useMemo(() => getEmployeeLifecycleEventsByType(lifecycleEvents, "Salary Revised", { from, to }), [lifecycleEvents, from, to]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <StatCard label="New Joiners" value={joiners.length.toString()} icon={TrendingUp} tone="emerald" />
        <StatCard label="Exits" value={exits.length.toString()} icon={UserX} tone="rose" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {joinersTrend.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Joiners Trend</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={joinersTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
        {exitsTrend.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Exits Trend</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={exitsTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Confirmations" value={confirmations.length.toString()} icon={UserCheck} tone="emerald" />
        <StatCard label="Transfers" value={transfers.length.toString()} icon={TrendingUp} tone="sky" />
        <StatCard label="Promotions" value={promotions.length.toString()} icon={TrendingUp} tone="indigo" />
        <StatCard label="Salary Revisions" value={salaryRevisions.length.toString()} icon={IndianRupee} tone="amber" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Lifecycle Activity</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onExport(
                "lifecycle-activity.csv",
                ["Employee", "Event", "From", "To", "Date", "Actor"],
                [...confirmations, ...transfers, ...promotions, ...salaryRevisions]
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .map((e) => [
                    allRows.find((r) => r.employeeId === e.employeeId)?.name ?? e.employeeId,
                    e.eventType,
                    e.previousValue ?? "",
                    e.newValue ?? "",
                    e.date,
                    e.actorName,
                  ]),
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
              <Th>Event</Th>
              <Th>Change</Th>
              <Th>Date</Th>
              <Th>Actor</Th>
            </THead>
            <TBody>
              {[...confirmations, ...transfers, ...promotions, ...salaryRevisions]
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((e) => (
                  <Tr key={e.id}>
                    <Td className="font-medium text-slate-800 dark:text-slate-100">{allRows.find((r) => r.employeeId === e.employeeId)?.name ?? e.employeeId}</Td>
                    <Td>{e.eventType}</Td>
                    <Td>{e.previousValue && e.newValue ? `${e.previousValue} → ${e.newValue}` : e.newValue ?? "—"}</Td>
                    <Td>{e.date}</Td>
                    <Td>{e.actorName}</Td>
                  </Tr>
                ))}
              {confirmations.length + transfers.length + promotions.length + salaryRevisions.length === 0 && (
                <EmptyRow colSpan={5}>No confirmations, transfers, promotions or salary revisions in the selected date range.</EmptyRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Performance                                                          */
/* ------------------------------------------------------------------ */

function PerformanceReportTab({
  cases,
  goals,
  appraisals,
  rows,
  onExport,
}: {
  cases: PerformanceReviewCase[];
  goals: PerformanceGoal[];
  appraisals: AppraisalDecision[];
  rows: ReportEmployeeRow[];
  onExport: ExportFn;
}) {
  const completion = useMemo(() => getPerformanceCompletionReport(cases), [cases]);
  const goalCompletion = useMemo(() => getGoalCompletionReport(goals), [goals]);
  const ratingDistribution = useMemo(() => getRatingDistribution(cases), [cases]);
  const departmentRating = useMemo(() => getPerformanceRatingBreakdown(cases, rows, (r) => r.department), [cases, rows]);
  const siteRating = useMemo(() => getPerformanceRatingBreakdown(cases, rows, (r) => r.siteName), [cases, rows]);
  const promotionRecs = useMemo(() => getPromotionRecommendations(appraisals), [appraisals]);
  const salaryRecs = useMemo(() => getSalaryRevisionRecommendations(appraisals), [appraisals]);
  const nameById = useMemo(() => new Map(rows.map((r) => [r.employeeId, r.name])), [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Average Rating" value={completion.averageRating > 0 ? `${completion.averageRating}/5` : "—"} icon={TrendingUp} tone="emerald" />
        <StatCard label="Completion" value={`${completion.completionPct}%`} icon={ClipboardCheck} tone="sky" />
        <StatCard label="Goals Completed" value={String(goalCompletion.completed)} icon={ClipboardCheck} tone="indigo" />
        <StatCard label="Goals Pending" value={String(goalCompletion.pending)} icon={Clock} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {ratingDistribution.every((r) => r.count === 0) ? (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No completed reviews in range.</p>
            ) : (
              ratingDistribution.map((r) => (
                <div key={r.rating} className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-slate-500 dark:text-slate-400">{r.rating}/5</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${completion.completed > 0 ? (r.count / completion.completed) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-slate-500 dark:text-slate-400">{r.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rating by Department</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {departmentRating.length === 0 && <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No data yet.</p>}
            {departmentRating.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">{d.name}</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {d.averageRating}/5 <span className="text-xs font-normal text-slate-400 dark:text-slate-500">({d.count})</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {siteRating.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Rating by Site</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {siteRating.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">{s.name}</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {s.averageRating}/5 <span className="text-xs font-normal text-slate-400 dark:text-slate-500">({s.count})</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Promotion Recommendations</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onExport(
                "promotion-recommendations.csv",
                ["Employee", "Rating", "Effective Date", "Status"],
                promotionRecs.map((a) => [nameById.get(a.employeeId) ?? a.employeeId, a.finalRating, a.effectiveDate, a.status]),
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <THead>
              <Th>Employee</Th>
              <Th>Rating</Th>
              <Th>Effective Date</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {promotionRecs.map((a) => (
                <Tr key={a.id}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{nameById.get(a.employeeId) ?? a.employeeId}</Td>
                  <Td>{a.finalRating}/5</Td>
                  <Td>{a.effectiveDate}</Td>
                  <Td>
                    <StatusBadge status={a.status} />
                  </Td>
                </Tr>
              ))}
              {promotionRecs.length === 0 && <EmptyRow colSpan={4}>No approved promotion recommendations in range.</EmptyRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Salary Revision Recommendations</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onExport(
                "salary-revision-recommendations.csv",
                ["Employee", "Previous CTC", "Proposed CTC", "Increment %", "Effective Date", "Status"],
                salaryRecs.map((a) => [
                  nameById.get(a.employeeId) ?? a.employeeId,
                  a.previousCtcAnnual ?? "",
                  a.proposedCtcAnnual ?? "",
                  a.incrementPercent,
                  a.effectiveDate,
                  a.status,
                ]),
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <THead>
              <Th>Employee</Th>
              <Th>CTC Change</Th>
              <Th>Effective Date</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {salaryRecs.map((a) => (
                <Tr key={a.id}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{nameById.get(a.employeeId) ?? a.employeeId}</Td>
                  <Td>
                    ₹{a.previousCtcAnnual?.toLocaleString("en-IN")} → ₹{a.proposedCtcAnnual?.toLocaleString("en-IN")} (+{a.incrementPercent}%)
                  </Td>
                  <Td>{a.effectiveDate}</Td>
                  <Td>
                    <StatusBadge status={a.status} />
                  </Td>
                </Tr>
              ))}
              {salaryRecs.length === 0 && <EmptyRow colSpan={4}>No approved salary revision recommendations in range.</EmptyRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Training                                                             */
/* ------------------------------------------------------------------ */

function TrainingReportTab({
  programs,
  enrollments,
  skills,
  rows,
  onExport,
}: {
  programs: TrainingProgram[];
  enrollments: TrainingEnrollment[];
  skills: EmployeeSkill[];
  rows: ReportEmployeeRow[];
  onExport: ExportFn;
}) {
  const { recordsOfType } = useMasters();
  const summary = useMemo(() => getTrainingProgramReport(programs, enrollments), [programs, enrollments]);
  const departmentBreakdown = useMemo(() => getTrainingBreakdown(enrollments, rows, (r) => r.department), [enrollments, rows]);
  const siteBreakdown = useMemo(() => getTrainingBreakdown(enrollments, rows, (r) => r.siteName), [enrollments, rows]);
  const skillDistribution = useMemo(() => getSkillDistribution(skills, rows.map((r) => r.employeeId)), [skills, rows]);
  const skillName = (id: string) => recordsOfType("Skill").find((s) => s.id === id)?.name ?? id;
  const levelName = (id: string) => recordsOfType("SkillLevel").find((l) => l.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Training Programs" value={String(summary.totalPrograms)} icon={GraduationCap} tone="indigo" />
        <StatCard label="Employees Trained" value={String(summary.employeesTrained)} icon={UserCheck} tone="emerald" />
        <StatCard label="Completion Rate" value={`${summary.completionRatePct}%`} icon={ClipboardCheck} tone="sky" />
        <StatCard label="Training Hours" value={String(summary.totalTrainingHours)} icon={Clock} tone="amber" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Failed Training" value={String(summary.failed)} icon={UserX} tone="rose" />
        <StatCard label="No Show" value={String(summary.noShow)} icon={UserX} tone="rose" />
        <StatCard label="Training Cost" value={summary.totalCost !== undefined ? inr(summary.totalCost) : "Not tracked"} icon={IndianRupee} tone="indigo" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Training by Department</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {departmentBreakdown.length === 0 && <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No completed training yet.</p>}
            {departmentBreakdown.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">{d.name}</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{d.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {siteBreakdown.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Training by Site</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {siteBreakdown.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{s.name}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{s.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Skill Distribution</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onExport(
                "skill-distribution.csv",
                ["Skill", "Level", "Employees"],
                skillDistribution.map((s) => [skillName(s.skillId), levelName(s.levelId), s.count]),
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <THead>
              <Th>Skill</Th>
              <Th>Level</Th>
              <Th>Employees</Th>
            </THead>
            <TBody>
              {skillDistribution.map((s) => (
                <Tr key={`${s.skillId}-${s.levelId}`}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{skillName(s.skillId)}</Td>
                  <Td>{levelName(s.levelId)}</Td>
                  <Td>{s.count}</Td>
                </Tr>
              ))}
              {skillDistribution.length === 0 && <EmptyRow colSpan={3}>No skill records in scope yet.</EmptyRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Assets                                                               */
/* ------------------------------------------------------------------ */

function AssetsReportTab({
  assets,
  assignments,
  rows,
  employeeIdsOnNotice,
  onExport,
}: {
  assets: Asset[];
  assignments: AssetAssignment[];
  rows: ReportEmployeeRow[];
  employeeIdsOnNotice: string[];
  onExport: ExportFn;
}) {
  const { recordsOfType } = useMasters();
  const report = useMemo(() => getAssetReport(assets, assignments, employeeIdsOnNotice), [assets, assignments, employeeIdsOnNotice]);
  const byType = useMemo(() => getAssetsByType(assets), [assets]);
  const byDepartment = useMemo(() => getAssetsByDimension(assignments, rows, (r) => r.department), [assignments, rows]);
  const bySite = useMemo(() => getAssetsByDimension(assignments, rows, (r) => r.siteName), [assignments, rows]);
  const byEmployee = useMemo(() => getAssetsByEmployee(assignments, rows), [assignments, rows]);
  const assetTypeName = (id: string) => recordsOfType("AssetType").find((t) => t.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Assets" value={String(report.total)} icon={GraduationCap} tone="indigo" />
        <StatCard label="Assigned" value={String(report.assigned)} icon={UserCheck} tone="sky" />
        <StatCard label="Available" value={String(report.available)} icon={ClipboardCheck} tone="emerald" />
        <StatCard label="Asset Value" value={report.totalValue !== undefined ? inr(report.totalValue) : "Not tracked"} icon={IndianRupee} tone="indigo" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Maintenance" value={String(report.maintenance)} icon={Clock} tone="amber" />
        <StatCard label="Damaged" value={String(report.damaged)} icon={UserX} tone="rose" />
        <StatCard label="Retired" value={String(report.retired)} icon={UserX} tone="rose" />
        <StatCard label="Pending Returns" value={String(report.pendingReturns)} icon={CalendarOff} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assets by Type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {byType.length === 0 && <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No assets in scope.</p>}
            {byType.map((t) => (
              <div key={t.assetTypeId} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">{assetTypeName(t.assetTypeId)}</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{t.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assigned Assets by Department</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {byDepartment.length === 0 && <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No active assignments.</p>}
            {byDepartment.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">{d.name}</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{d.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {bySite.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Assets by Site</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {bySite.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">{s.name}</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{s.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Assets by Employee</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onExport("assets-by-employee.csv", ["Employee", "Assets Held"], byEmployee.map((e) => [e.name, e.count]))}
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <THead>
              <Th>Employee</Th>
              <Th>Assets Held</Th>
            </THead>
            <TBody>
              {byEmployee.map((e) => (
                <Tr key={e.employeeId}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{e.name}</Td>
                  <Td>{e.count}</Td>
                </Tr>
              ))}
              {byEmployee.length === 0 && <EmptyRow colSpan={2}>No active assignments in scope.</EmptyRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ExpensesReportTab({
  claims,
  travelRequests,
  rows,
  onExport,
}: {
  claims: ExpenseClaim[];
  travelRequests: TravelRequest[];
  rows: ReportEmployeeRow[];
  onExport: ExportFn;
}) {
  const { recordsOfType } = useMasters();
  const expenseReport = useMemo(() => getExpenseReport(claims), [claims]);
  const travelReport = useMemo(() => getTravelReport(travelRequests), [travelRequests]);
  const byCategory = useMemo(() => getExpensesByCategory(claims), [claims]);
  const byDepartment = useMemo(() => getExpensesByDimension(claims, rows, (r) => r.department), [claims, rows]);
  const bySite = useMemo(() => getExpensesByDimension(claims, rows, (r) => r.siteName), [claims, rows]);
  const byEmployee = useMemo(() => getExpensesByEmployee(claims, rows), [claims, rows]);
  const byTravelType = useMemo(() => getTravelByType(travelRequests), [travelRequests]);
  const monthlyTrend = useMemo(() => getMonthlyExpenseTrend(claims), [claims]);
  const categoryName = (id: string) => recordsOfType("ExpenseCategory").find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Claims" value={String(expenseReport.totalClaims)} icon={ClipboardCheck} tone="indigo" />
        <StatCard label="Claimed Amount" value={inr(expenseReport.claimedAmount)} icon={IndianRupee} tone="sky" />
        <StatCard label="Approved Amount" value={inr(expenseReport.approvedAmount)} icon={ClipboardCheck} tone="emerald" />
        <StatCard label="Reimbursed Amount" value={inr(expenseReport.reimbursedAmount)} icon={IndianRupee} tone="emerald" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Outstanding Amount" value={inr(expenseReport.outstandingAmount)} icon={CalendarOff} tone="amber" />
        <StatCard label="Travel Requests" value={String(travelReport.totalRequests)} icon={TrendingUp} tone="indigo" />
        <StatCard label="Approved Travel" value={String(travelReport.approved)} icon={UserCheck} tone="emerald" />
        <StatCard label="Estimated Travel Cost" value={inr(travelReport.estimatedCost)} icon={IndianRupee} tone="sky" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Claimed Amount by Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {byCategory.length === 0 && <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No claims in scope.</p>}
            {byCategory.map((c) => (
              <div key={c.categoryId} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">{categoryName(c.categoryId)}</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{inr(c.claimedAmount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Travel Requests by Type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {byTravelType.length === 0 && <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No travel requests in scope.</p>}
            {byTravelType.map((t) => (
              <div key={t.travelType} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">{t.travelType}</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{t.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Claimed Amount by Department</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {byDepartment.length === 0 && <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No claims in scope.</p>}
            {byDepartment.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">{d.name}</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">{inr(d.count)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {bySite.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Claimed Amount by Site</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {bySite.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{s.name}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{inr(s.count)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {monthlyTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Expense Trend</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => inr(Number(v ?? 0))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="claimed" fill="#818cf8" name="Claimed" />
                <Bar dataKey="approved" fill="#38bdf8" name="Approved" />
                <Bar dataKey="reimbursed" fill="#34d399" name="Reimbursed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Claimed Amount by Employee</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onExport("expenses-by-employee.csv", ["Employee", "Claimed Amount"], byEmployee.map((e) => [e.name, e.claimedAmount]))}
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <THead>
              <Th>Employee</Th>
              <Th>Claimed Amount</Th>
            </THead>
            <TBody>
              {byEmployee.map((e) => (
                <Tr key={e.employeeId}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{e.name}</Td>
                  <Td>{inr(e.claimedAmount)}</Td>
                </Tr>
              ))}
              {byEmployee.length === 0 && <EmptyRow colSpan={2}>No claims in scope.</EmptyRow>}
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

/* ------------------------------------------------------------------ */
/* Recruitment                                                          */
/* ------------------------------------------------------------------ */

function RecruitmentTab({ siteIds, onExport }: { siteIds: string[]; onExport: ExportFn }) {
  const { orgUnits } = useOrg();
  const { records: masterRecords } = useMasters();
  const { sites } = useSite();
  const { requisitions, jobOpenings, candidates, applications, interviews, offers } = useRecruitment();

  const scopedRequisitions = useMemo(() => requisitions.filter((r) => siteIds.includes(r.siteId)), [requisitions, siteIds]);
  const scopedOpenings = useMemo(() => jobOpenings.filter((j) => siteIds.includes(j.siteId)), [jobOpenings, siteIds]);
  const scopedCandidates = useMemo(() => candidates.filter((c) => siteIds.includes(c.siteId)), [candidates, siteIds]);
  const scopedApplications = useMemo(() => applications.filter((a) => siteIds.includes(a.siteId)), [applications, siteIds]);
  const scopedInterviews = useMemo(() => interviews.filter((i) => siteIds.includes(i.siteId)), [interviews, siteIds]);
  const scopedOffers = useMemo(() => offers.filter((o) => siteIds.includes(o.siteId)), [offers, siteIds]);

  const requisitionReport = useMemo(() => getRequisitionReport(scopedRequisitions), [scopedRequisitions]);
  const funnel = useMemo(() => getRecruitmentFunnelReport(scopedOpenings, scopedApplications, scopedOffers), [scopedOpenings, scopedApplications, scopedOffers]);
  const interviewConversion = useMemo(() => getInterviewConversionReport(scopedInterviews), [scopedInterviews]);
  const offerConversion = useMemo(() => getOfferConversionReport(scopedOffers), [scopedOffers]);
  const byDepartment = useMemo(
    () => getHiringBreakdown(scopedApplications, scopedOpenings, (o) => (o.departmentId ? orgUnits.find((u) => u.id === o.departmentId)?.name : undefined)),
    [scopedApplications, scopedOpenings, orgUnits],
  );
  const bySite = useMemo(
    () => getHiringBreakdown(scopedApplications, scopedOpenings, (o) => sites.find((s) => s.id === o.siteId)?.name),
    [scopedApplications, scopedOpenings, sites],
  );
  const bySource = useMemo(() => getSourceWiseHiring(scopedApplications, scopedCandidates), [scopedApplications, scopedCandidates]);

  if (scopedRequisitions.length === 0 && scopedOpenings.length === 0 && scopedCandidates.length === 0) {
    return <Card className="p-10 text-center text-sm text-slate-400 dark:text-slate-500">No recruitment activity for the selected filters.</Card>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Requisitions" value={requisitionReport.total.toString()} icon={ClipboardCheck} tone="indigo" />
        <StatCard label="Pending Approval" value={requisitionReport.pendingApproval.toString()} icon={Clock} tone="amber" />
        <StatCard label="Open Positions" value={funnel.openPositions.toString()} icon={Users} tone="sky" />
        <StatCard label="Positions Filled" value={funnel.positionsFilled.toString()} icon={UserCheck} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Interview Conversion (Hire / Strong Hire recommended)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{interviewConversion.conversionPct}%</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {interviewConversion.advanced} of {interviewConversion.total} completed interview(s) recommended for hire.
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Offer Conversion (Accepted)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{offerConversion.conversionPct}%</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {offerConversion.advanced} of {offerConversion.total} sent offer(s) accepted.
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Hiring by Department</CardTitle>
            <Button size="sm" variant="outline" onClick={() => onExport("hiring-by-department.csv", ["Department", "Hired"], byDepartment.map((r) => [r.label, r.count]))}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <Th>Department</Th>
                <Th>Hired</Th>
              </THead>
              <TBody>
                {byDepartment.map((r) => (
                  <Tr key={r.label}>
                    <Td>{r.label}</Td>
                    <Td>{r.count}</Td>
                  </Tr>
                ))}
                {byDepartment.length === 0 && <EmptyRow colSpan={2}>No hires yet in this range.</EmptyRow>}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Source-wise Hiring</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <Th>Source</Th>
                <Th>Hired</Th>
              </THead>
              <TBody>
                {bySource.map((r) => (
                  <Tr key={r.label}>
                    <Td>{r.label}</Td>
                    <Td>{r.count}</Td>
                  </Tr>
                ))}
                {bySource.length === 0 && <EmptyRow colSpan={2}>No hires yet in this range.</EmptyRow>}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {siteIds.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Hiring by Site</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <Th>Site</Th>
                <Th>Hired</Th>
              </THead>
              <TBody>
                {bySite.map((r) => (
                  <Tr key={r.label}>
                    <Td>{r.label}</Td>
                    <Td>{r.count}</Td>
                  </Tr>
                ))}
                {bySite.length === 0 && <EmptyRow colSpan={2}>No hires yet in this range.</EmptyRow>}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Job Openings</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onExport(
                "job-openings.csv",
                ["Job", "Location", "Openings", "Applications", "Status"],
                scopedOpenings.map((o) => [o.title, o.location, o.openings, scopedApplications.filter((a) => a.jobOpeningId === o.id).length, o.status]),
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <Th>Job</Th>
              <Th>Location</Th>
              <Th>Openings</Th>
              <Th>Applications</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {scopedOpenings.map((o) => (
                <Tr key={o.id}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{o.title}</Td>
                  <Td>{o.location}</Td>
                  <Td>{o.openings}</Td>
                  <Td>{scopedApplications.filter((a) => a.jobOpeningId === o.id).length}</Td>
                  <Td>
                    <StatusBadge status={o.status} />
                  </Td>
                </Tr>
              ))}
              {scopedOpenings.length === 0 && <EmptyRow colSpan={5}>No job openings yet.</EmptyRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

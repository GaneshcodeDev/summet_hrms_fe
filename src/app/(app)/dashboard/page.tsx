"use client";

import Link from "next/link";
import {
  Users,
  UserCheck,
  UserX,
  CalendarOff,
  Clock,
  AlertTriangle,
  Building2,
  Plus,
  Sparkles,
  UserPlus,
  Wallet,
  Cake,
  LogOut,
  ArrowUpRight,
  UserCog,
  BellRing,
  ClipboardCheck,
  Target,
  Star,
  GraduationCap,
  CalendarClock,
  Laptop,
  Wrench,
  CheckCircle2,
  Receipt,
  Plane,
} from "lucide-react";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, Th, Td, Tr, EmptyRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useSite, useSiteFilter } from "@/lib/site-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useEmployees } from "@/lib/employee-context";
import { useAttendance, summarizeAttendance } from "@/lib/attendance-context";
import { useLeave } from "@/lib/leave-context";
import { useRegularization } from "@/lib/regularization-context";
import { useOrg } from "@/lib/org-context";
import { useOffboarding } from "@/lib/offboarding-context";
import { useSiteConfig } from "@/lib/site-config-context";
import { usePerformance } from "@/lib/performance-context";
import { useTraining } from "@/lib/training-context";
import { getTrainingCompletionSummary } from "@/lib/training-engine";
import { useAssets } from "@/lib/asset-context";
import { getAssetInventorySummary } from "@/lib/asset-engine";
import { useExpense } from "@/lib/expense-context";
import { getExpenseSummary, getTravelSummary } from "@/lib/expense-engine";
import { loadDemoData } from "@/lib/demo-seed";
import {
  currentCycleCaseFor,
  getAttendanceTrend,
  getCycleCompletionSummary,
  getDepartmentDistribution,
  getExitSummary,
  getLeaveSummaryForDate,
  getNewJoiners,
  getProbationSummary,
  getRecentActivity,
  getSiteEmployeeStats,
  getTeamReviewSummary,
  getUpcomingEvents,
  countSiteDepartments,
} from "@/lib/dashboard-selectors";
import type { Employee } from "@/lib/types";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const { sites, currentSite, currentSiteId, isAllSites } = useSite();
  const { currentUser, isSuperAdmin, canFeature } = useAccessControl();
  const { employees } = useEmployees();

  const hasBroadScope = canFeature("attendance.records", "edit") || canFeature("attendance.records", "manage");
  const hasDirectReports = useMemo(
    () => employees.some((e) => e.reportingManagerId === currentUser.employeeId),
    [employees, currentUser.employeeId],
  );

  if (sites.length === 0 && isSuperAdmin) {
    return <EmptyPlatformState />;
  }

  if (isAllSites) {
    return <GlobalSuperAdminDashboard />;
  }
  if (hasBroadScope && currentSite) {
    return <SiteDashboard />;
  }
  if (hasDirectReports) {
    return <TeamDashboard />;
  }
  return <EmployeeDashboard />;
}

function EmptyPlatformState() {
  const { currentUser } = useAccessControl();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Welcome back, {currentUser.name}! 👋</h1>
      </div>
      <Card className="flex flex-col items-center gap-4 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
          <Building2 className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Welcome to your HRMS</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            You haven&apos;t onboarded any sites yet. Total Sites: 0 &middot; Total Employees: 0.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/sites/new">
            <Button>
              <Plus className="h-4 w-4" /> Create Your First Site
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => {
              loadDemoData();
              window.location.reload();
            }}
          >
            <Sparkles className="h-4 w-4" /> Load Demo Data
          </Button>
        </div>
      </Card>
    </div>
  );
}

function GlobalSuperAdminDashboard() {
  const { sites, setCurrentSiteId } = useSite();
  const { currentUser } = useAccessControl();
  const { employees } = useEmployees();
  const { attendance } = useAttendance();
  const { leaveRequests } = useLeave();
  const { orgUnits } = useOrg();

  const today = todayStr();
  const employeeStats = getSiteEmployeeStats(employees);
  const totalDepartments = countSiteDepartments(orgUnits);
  const leaveSummary = getLeaveSummaryForDate(leaveRequests, today);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Welcome back, {currentUser.name}! 👋</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Platform overview across every site.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Total Sites" value={String(sites.length)} icon={Building2} tone="indigo" />
        <StatCard label="Active Sites" value={String(sites.filter((s) => s.status === "Active").length)} icon={Building2} tone="emerald" />
        <StatCard label="Total Employees" value={String(employeeStats.total)} icon={Users} tone="indigo" />
        <StatCard label="Active Employees" value={String(employeeStats.active)} icon={UserCheck} tone="emerald" />
        <StatCard label="Total Departments" value={String(totalDepartments)} icon={Building2} tone="sky" />
        <StatCard label="On Leave Today" value={String(leaveSummary.onLeaveToday)} icon={CalendarOff} tone="amber" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sites</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <Th>Site</Th>
            <Th>Code</Th>
            <Th>Status</Th>
            <Th>Employees</Th>
            <Th>Departments</Th>
            <Th>Present Today</Th>
            <Th>Absent Today</Th>
            <Th>On Leave Today</Th>
            <Th>Actions</Th>
          </THead>
          <TBody>
            {sites.map((site) => {
              const siteEmployees = employees.filter((e) => e.siteId === site.id);
              const siteAttendanceToday = attendance.filter((r) => r.siteId === site.id && r.date === today);
              const summary = summarizeAttendance(siteAttendanceToday);
              const deptCount = orgUnits.filter((u) => u.type === "Department" && u.siteId === site.id).length;
              return (
                <Tr key={site.id} hoverable>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{site.name}</Td>
                  <Td>{site.code}</Td>
                  <Td>
                    <StatusBadge status={site.status} />
                  </Td>
                  <Td>{siteEmployees.length}</Td>
                  <Td>{deptCount}</Td>
                  <Td>{summary.present}</Td>
                  <Td>{summary.absent}</Td>
                  <Td>{summary.onLeave}</Td>
                  <Td>
                    <button
                      onClick={() => setCurrentSiteId(site.id)}
                      className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      View Dashboard
                    </button>
                  </Td>
                </Tr>
              );
            })}
            {sites.length === 0 && <EmptyRow colSpan={9}>No sites onboarded yet.</EmptyRow>}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

function EmptyStateCTAs({ siteScoped }: { siteScoped: boolean }) {
  return (
    <Card className="flex flex-col items-center gap-3 p-10 text-center">
      <UserPlus className="h-8 w-8 text-slate-300 dark:text-slate-600" />
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
        {siteScoped ? "This site has no employees yet." : "No employees have been added to this site yet."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link href="/employees">
          <Button size="sm">
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        </Link>
        <Link href="/organization">
          <Button size="sm" variant="outline">
            Configure Organization
          </Button>
        </Link>
        <Link href="/attendance">
          <Button size="sm" variant="outline">
            Configure Attendance
          </Button>
        </Link>
        <Link href="/leave">
          <Button size="sm" variant="outline">
            Configure Leave
          </Button>
        </Link>
        <Link href="/payroll">
          <Button size="sm" variant="outline">
            Process Payroll
          </Button>
        </Link>
      </div>
    </Card>
  );
}

function SiteDashboard() {
  const { currentSite, currentSiteId } = useSite();
  const { currentUser } = useAccessControl();
  const { employees } = useEmployees();
  const { attendance } = useAttendance();
  const { auditEntries: leaveAuditEntries, visibleTeamRequests: visibleLeaveRequests } = useLeave();
  const { regularizations, visibleTeamRequests: visibleRegularizations } = useRegularization();
  const { orgUnits } = useOrg();
  const { visibleCases } = useOffboarding();
  const { reviewCases } = usePerformance();
  const { programs: trainingPrograms, enrollments: trainingEnrollments, visibleRequests: visibleTrainingRequests } = useTraining();
  const { assets, activeAssignmentsForEmployee, visibleRequests: visibleAssetRequests } = useAssets();
  const { expenseClaims, travelRequests, hasBroadClaimScope, hasBroadTravelScope } = useExpense();

  const today = todayStr();
  const siteEmployees = useMemo(() => employees.filter((e) => e.siteId === currentSiteId), [employees, currentSiteId]);
  const siteAttendanceToday = useMemo(
    () => attendance.filter((r) => r.siteId === currentSiteId && r.date === today),
    [attendance, currentSiteId, today],
  );
  const summary = summarizeAttendance(siteAttendanceToday);
  const pendingLeave = useSiteFilter(visibleLeaveRequests()).filter((r) => r.status === "Pending").length;
  const pendingRegularizations = useSiteFilter(visibleRegularizations()).filter((r) => r.status === "Pending").length;
  const newJoiners = useMemo(() => getNewJoiners(siteEmployees), [siteEmployees]);
  const siteCases = useSiteFilter(visibleCases());
  const exitSummary = useMemo(() => getExitSummary(siteCases), [siteCases]);
  const probationSummary = useMemo(() => getProbationSummary(siteEmployees), [siteEmployees]);
  const siteReviewCases = useMemo(() => reviewCases.filter((c) => c.siteId === currentSiteId), [reviewCases, currentSiteId]);
  const cycleSummary = useMemo(() => getCycleCompletionSummary(siteReviewCases), [siteReviewCases]);
  const siteTrainingPrograms = useMemo(() => trainingPrograms.filter((p) => p.siteId === currentSiteId), [trainingPrograms, currentSiteId]);
  const siteTrainingEnrollments = useMemo(() => trainingEnrollments.filter((e) => e.siteId === currentSiteId), [trainingEnrollments, currentSiteId]);
  const trainingCompletion = useMemo(() => getTrainingCompletionSummary(siteTrainingEnrollments), [siteTrainingEnrollments]);
  const pendingTrainingRequests = useMemo(() => visibleTrainingRequests().filter((r) => r.siteId === currentSiteId && r.status === "Pending").length, [visibleTrainingRequests, currentSiteId]);
  const siteAssets = useMemo(() => assets.filter((a) => a.siteId === currentSiteId), [assets, currentSiteId]);
  const assetSummary = useMemo(() => getAssetInventorySummary(siteAssets), [siteAssets]);
  const pendingAssetReturns = useMemo(
    () => siteEmployees.filter((e) => e.employmentStage === "On Notice").reduce((sum, e) => sum + activeAssignmentsForEmployee(e.employeeId).length, 0),
    [siteEmployees, activeAssignmentsForEmployee],
  );
  const pendingAssetRequests = useMemo(() => visibleAssetRequests().filter((r) => r.siteId === currentSiteId && r.status === "Pending").length, [visibleAssetRequests, currentSiteId]);
  const siteExpenseClaims = useMemo(() => expenseClaims.filter((c) => c.siteId === currentSiteId), [expenseClaims, currentSiteId]);
  const siteTravelRequests = useMemo(() => travelRequests.filter((r) => r.siteId === currentSiteId), [travelRequests, currentSiteId]);
  const expenseSummary = useMemo(() => getExpenseSummary(siteExpenseClaims), [siteExpenseClaims]);
  const travelSummary = useMemo(() => getTravelSummary(siteTravelRequests), [siteTravelRequests]);
  const departmentDistribution = useMemo(() => getDepartmentDistribution(siteEmployees), [siteEmployees]);
  const attendanceTrend = useMemo(
    () => getAttendanceTrend(attendance.filter((r) => r.siteId === currentSiteId)),
    [attendance, currentSiteId],
  );
  const siteLeaveAudit = useSiteFilterByEmployee(leaveAuditEntries, siteEmployees);
  const siteRegularizations = useSiteFilter(regularizations);
  const activity = useMemo(
    () => getRecentActivity(siteLeaveAudit, siteRegularizations),
    [siteLeaveAudit, siteRegularizations],
  );

  if (siteEmployees.length === 0) {
    return (
      <div className="space-y-6">
        <PageIntro title={`Welcome back, ${currentUser.name}! 👋`} subtitle={`${currentSite?.name ?? ""} dashboard`} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Employees" value="0" icon={Users} tone="indigo" />
          <StatCard label="Attendance" value="0" icon={UserCheck} tone="emerald" />
          <StatCard label="Leave Requests" value="0" icon={CalendarOff} tone="amber" />
          <StatCard label="Payroll" value="Not Processed" icon={Wallet} tone="rose" />
        </div>
        <EmptyStateCTAs siteScoped />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro title={`Welcome back, ${currentUser.name}! 👋`} subtitle={`Here's what's happening at ${currentSite?.name} today.`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Employees" value={String(siteEmployees.length)} icon={Users} tone="indigo" />
        <StatCard label="Present Today" value={String(summary.present)} icon={UserCheck} tone="emerald" />
        <StatCard label="Absent Today" value={String(summary.absent)} icon={UserX} tone="rose" />
        <StatCard label="On Leave Today" value={String(summary.onLeave)} icon={CalendarOff} tone="sky" />
        <StatCard label="Late Today" value={String(summary.late)} icon={Clock} tone="amber" />
        <StatCard label="Half Day Today" value={String(summary.halfDay)} icon={Clock} tone="amber" />
        <StatCard label="Missing Punch" value={String(summary.missingPunch)} icon={AlertTriangle} tone="rose" />
        <StatCard label="Pending Leave Requests" value={String(pendingLeave)} icon={CalendarOff} tone="sky" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Pending Regularizations" value={String(pendingRegularizations)} icon={AlertTriangle} tone="amber" />
        <StatCard label="New Joiners (30d)" value={String(newJoiners.length)} icon={UserPlus} tone="emerald" />
        <StatCard label="Exiting (30d)" value={String(exitSummary.upcomingExits)} icon={LogOut} tone="rose" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="On Probation" value={String(probationSummary.onProbation)} icon={UserCog} tone="amber" />
        <StatCard label="Due for Confirmation" value={String(probationSummary.dueForConfirmationSoon)} icon={BellRing} tone="sky" />
        <StatCard label="On Notice" value={String(exitSummary.inNoticePeriod)} icon={LogOut} tone="rose" />
        <StatCard label="Recently Exited (30d)" value={String(exitSummary.recentlyExited)} icon={UserX} tone="indigo" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Cycle Completion" value={`${cycleSummary.completionPct}%`} icon={ClipboardCheck} tone="emerald" />
        <StatCard label="Pending Reviews" value={String(cycleSummary.pendingReviews)} icon={Target} tone="amber" />
        <StatCard label="Employees Awaiting Review" value={String(cycleSummary.employeesAwaitingReview)} icon={UserCog} tone="rose" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Programs" value={String(siteTrainingPrograms.filter((p) => p.status !== "Cancelled" && p.status !== "Completed").length)} icon={GraduationCap} tone="indigo" />
        <StatCard label="Employees in Training" value={String(trainingCompletion.inProgress)} icon={Users} tone="sky" />
        <StatCard label="Pending Training Requests" value={String(pendingTrainingRequests)} icon={CalendarClock} tone="amber" />
        <StatCard label="Training Completion %" value={`${trainingCompletion.completionPct}%`} icon={ClipboardCheck} tone="emerald" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Assets" value={String(assetSummary.total)} icon={Laptop} tone="indigo" trend={pendingAssetRequests > 0 ? `${pendingAssetRequests} pending request(s)` : undefined} />
        <StatCard label="Available" value={String(assetSummary.available)} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Assigned" value={String(assetSummary.assigned)} icon={Users} tone="sky" />
        <StatCard label="Maintenance" value={String(assetSummary.maintenance)} icon={Wrench} tone="amber" />
        <StatCard label="Damaged" value={String(assetSummary.damaged)} icon={AlertTriangle} tone="rose" />
        <StatCard label="Pending Returns" value={String(pendingAssetReturns)} icon={UserX} tone="rose" />
      </div>
      {(hasBroadClaimScope || hasBroadTravelScope) && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {hasBroadClaimScope && (
            <>
              <StatCard label="Pending Expense Approval" value={String(expenseSummary.pendingApproval)} icon={Receipt} tone="amber" />
              <StatCard label="Approved for Reimbursement" value={String(expenseSummary.approvedForReimbursement)} icon={ClipboardCheck} tone="sky" />
              <StatCard label="Reimbursed" value={`₹${expenseSummary.reimbursedAmount.toLocaleString("en-IN")}`} icon={Wallet} tone="emerald" />
              <StatCard label="Outstanding Reimbursement" value={`₹${expenseSummary.outstandingAmount.toLocaleString("en-IN")}`} icon={AlertTriangle} tone="rose" />
            </>
          )}
          {hasBroadTravelScope && !hasBroadClaimScope && (
            <>
              <StatCard label="Travel Requests" value={String(travelSummary.total)} icon={Plane} tone="indigo" />
              <StatCard label="Approved Travel" value={String(travelSummary.approved)} icon={CheckCircle2} tone="emerald" />
              <StatCard label="Rejected Travel" value={String(travelSummary.rejected)} icon={AlertTriangle} tone="rose" />
              <StatCard label="Estimated Travel Cost" value={`₹${travelSummary.estimatedCost.toLocaleString("en-IN")}`} icon={Wallet} tone="sky" />
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Attendance Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {attendanceTrend.every((d) => d.summary.present + d.summary.absent + d.summary.late + d.summary.onLeave === 0) ? (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                Not enough attendance history yet.
              </p>
            ) : (
              <div className="space-y-2">
                {attendanceTrend.map((d) => (
                  <div key={d.date} className="flex items-center justify-between text-xs">
                    <span className="w-24 text-slate-500 dark:text-slate-400">{d.date}</span>
                    <span className="flex-1 text-slate-600 dark:text-slate-300">
                      Present {d.summary.present} &middot; Absent {d.summary.absent} &middot; Late {d.summary.late} &middot; On
                      Leave {d.summary.onLeave}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Department Headcount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {departmentDistribution.length === 0 && (
              <p className="text-sm text-slate-400 dark:text-slate-500">No departments configured.</p>
            )}
            {departmentDistribution.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">{d.name}</span>
                <Badge tone="indigo">{d.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {activity.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No recent activity.</p>}
          {activity.map((a) => (
            <div key={a.id} className="flex items-start gap-3">
              <Avatar name={a.actorName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-700 dark:text-slate-200">{a.detail}</p>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{new Date(a.timestamp).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function useSiteFilterByEmployee<T extends { employeeName?: string }>(items: T[], siteEmployees: Employee[]): T[] {
  return useMemo(() => {
    const names = new Set(siteEmployees.map((e) => e.name));
    return items.filter((i) => !i.employeeName || names.has(i.employeeName));
  }, [items, siteEmployees]);
}

function PageIntro({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
  );
}

function TeamDashboard() {
  const { currentUser } = useAccessControl();
  const { employees } = useEmployees();
  const { recordFor } = useAttendance();
  const { visibleTeamRequests: visibleLeaveRequests, requestsFor: leaveRequestsFor } = useLeave();
  const { visibleTeamRequests: visibleRegularizations } = useRegularization();
  const { reviewCases } = usePerformance();
  const { enrollmentsForEmployee, visibleRequests: visibleTrainingRequests, trainingNeedsFor } = useTraining();
  const { activeAssignmentsForEmployee, visibleRequests: visibleAssetRequests } = useAssets();
  const { visibleTeamTravelRequests, visibleTeamClaims, hasBroadClaimScope, expenseClaims } = useExpense();

  const today = todayStr();
  const team = useMemo(
    () => employees.filter((e) => e.reportingManagerId === currentUser.employeeId),
    [employees, currentUser.employeeId],
  );
  const teamAttendanceToday = useMemo(
    () => team.map((e) => recordFor(e.employeeId, today)).filter((r): r is NonNullable<typeof r> => Boolean(r)),
    [team, recordFor, today],
  );
  const summary = summarizeAttendance(teamAttendanceToday);
  const pendingLeave = visibleLeaveRequests().filter((r) => r.status === "Pending").length;
  const pendingRegularizations = visibleRegularizations().filter((r) => r.status === "Pending").length;
  const teamReviewCases = useMemo(
    () => reviewCases.filter((c) => team.some((m) => m.employeeId === c.employeeId)),
    [reviewCases, team],
  );
  const teamReviewSummary = useMemo(() => getTeamReviewSummary(teamReviewCases), [teamReviewCases]);
  const teamInTraining = useMemo(
    () => team.reduce((sum, m) => sum + enrollmentsForEmployee(m.employeeId).filter((e) => e.status === "Registered" || e.status === "Approved" || e.status === "In Progress").length, 0),
    [team, enrollmentsForEmployee],
  );
  const pendingTeamTraining = useMemo(
    () => visibleTrainingRequests().filter((r) => r.status === "Pending" && team.some((m) => m.employeeId === r.employeeId)).length,
    [visibleTrainingRequests, team],
  );
  const teamSkillGaps = useMemo(() => team.reduce((sum, m) => sum + trainingNeedsFor(m.employeeId).length, 0), [team, trainingNeedsFor]);
  const teamAssetsCount = useMemo(() => team.reduce((sum, m) => sum + activeAssignmentsForEmployee(m.employeeId).length, 0), [team, activeAssignmentsForEmployee]);
  const pendingTeamAssetRequests = useMemo(
    () => visibleAssetRequests().filter((r) => r.status === "Pending" && team.some((m) => m.employeeId === r.employeeId)).length,
    [visibleAssetRequests, team],
  );
  const pendingTeamTravel = useMemo(
    () => visibleTeamTravelRequests().filter((r) => r.status === "Pending" && team.some((m) => m.employeeId === r.employeeId)).length,
    [visibleTeamTravelRequests, team],
  );
  const pendingTeamClaims = useMemo(
    () => visibleTeamClaims().filter((c) => team.some((m) => m.employeeId === c.employeeId)).length,
    [visibleTeamClaims, team],
  );
  const siteScopedClaims = useSiteFilter(expenseClaims);
  const financeExpenseSummary = useMemo(() => getExpenseSummary(siteScopedClaims), [siteScopedClaims]);

  return (
    <div className="space-y-6">
      <PageIntro title={`Welcome back, ${currentUser.name}! 👋`} subtitle="Here's how your team is doing today." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My Team Size" value={String(team.length)} icon={Users} tone="indigo" />
        <StatCard label="Present Today" value={String(summary.present)} icon={UserCheck} tone="emerald" />
        <StatCard label="Absent Today" value={String(summary.absent)} icon={UserX} tone="rose" />
        <StatCard label="On Leave Today" value={String(summary.onLeave)} icon={CalendarOff} tone="sky" />
        <StatCard label="Late Today" value={String(summary.late)} icon={Clock} tone="amber" />
        <StatCard label="Pending Leave Approvals" value={String(pendingLeave)} icon={CalendarOff} tone="sky" />
        <StatCard label="Pending Regularizations" value={String(pendingRegularizations)} icon={AlertTriangle} tone="amber" />
        <StatCard label="Team Reviews Pending" value={String(teamReviewSummary.pendingReviews)} icon={Target} tone="rose" trend={`${teamReviewSummary.completionPct}% complete`} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Team in Training" value={String(teamInTraining)} icon={GraduationCap} tone="indigo" />
        <StatCard label="Pending Team Training" value={String(pendingTeamTraining)} icon={CalendarClock} tone="amber" />
        <StatCard label="Skill Gaps" value={String(teamSkillGaps)} icon={ClipboardCheck} tone="rose" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Team Assets" value={String(teamAssetsCount)} icon={Laptop} tone="indigo" />
        <StatCard label="Pending Asset Requests" value={String(pendingTeamAssetRequests)} icon={AlertTriangle} tone="amber" />
      </div>
      {hasBroadClaimScope ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Pending Expense Approval" value={String(financeExpenseSummary.pendingApproval)} icon={Receipt} tone="amber" />
          <StatCard label="Approved for Reimbursement" value={String(financeExpenseSummary.approvedForReimbursement)} icon={ClipboardCheck} tone="sky" />
          <StatCard label="Reimbursed" value={`₹${financeExpenseSummary.reimbursedAmount.toLocaleString("en-IN")}`} icon={Wallet} tone="emerald" />
          <StatCard label="Outstanding Reimbursement" value={`₹${financeExpenseSummary.outstandingAmount.toLocaleString("en-IN")}`} icon={AlertTriangle} tone="rose" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard label="Team Travel Pending" value={String(pendingTeamTravel)} icon={Plane} tone="amber" />
          <StatCard label="Team Claims Pending" value={String(pendingTeamClaims)} icon={Receipt} tone="amber" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>My Team</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <Th>Employee</Th>
            <Th>Department</Th>
            <Th>Status</Th>
            <Th>Punch In</Th>
            <Th>Punch Out</Th>
            <Th>Leave Status</Th>
          </THead>
          <TBody>
            {team.map((e) => {
              const record = recordFor(e.employeeId, today);
              const pendingLeaveForEmp = leaveRequestsFor(e.employeeId).find(
                (r) => r.status === "Pending" || (r.status === "Approved" && r.from <= today && r.to >= today),
              );
              return (
                <Tr key={e.id}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{e.name}</Td>
                  <Td>{e.department}</Td>
                  <Td>{record ? <StatusBadge status={record.status} /> : <span className="text-xs text-slate-400 dark:text-slate-500">Not Marked</span>}</Td>
                  <Td>{record?.punchIn ?? "—"}</Td>
                  <Td>{record?.punchOut ?? "—"}</Td>
                  <Td>{pendingLeaveForEmp ? <StatusBadge status={pendingLeaveForEmp.status} /> : "—"}</Td>
                </Tr>
              );
            })}
            {team.length === 0 && <EmptyRow colSpan={6}>No direct reports.</EmptyRow>}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

function EmployeeDashboard() {
  const { currentUser } = useAccessControl();
  const { currentSiteId } = useSite();
  const { recordFor, recordsForEmployee } = useAttendance();
  const { balancesFor, requestsFor: leaveRequestsFor } = useLeave();
  const { requestsFor: regularizationRequestsFor } = useRegularization();
  const { configForSite } = useSiteConfig();
  const { cycles: performanceCycles, reviewCases: performanceReviewCases, goalsFor: performanceGoalsFor } = usePerformance();
  const { enrollmentsForEmployee, requestsFor: trainingRequestsFor } = useTraining();
  const { activeAssignmentsForEmployee, requestsFor: assetRequestsFor } = useAssets();
  const { requestsFor: travelRequestsFor, claimsFor } = useExpense();

  const today = todayStr();
  const monthPrefix = today.slice(0, 7);
  const todayRecord = recordFor(currentUser.employeeId, today);
  const monthRecords = useMemo(
    () => recordsForEmployee(currentUser.employeeId).filter((r) => r.date.startsWith(monthPrefix)),
    [recordsForEmployee, currentUser.employeeId, monthPrefix],
  );
  const monthSummary = summarizeAttendance(monthRecords);
  const leaveBalances = balancesFor(currentUser.employeeId);
  const myLeaveRequests = leaveRequestsFor(currentUser.employeeId);
  const pendingLeave = myLeaveRequests.filter((r) => r.status === "Pending");
  const myRegularizations = regularizationRequestsFor(currentUser.employeeId);
  const pendingRegularizations = myRegularizations.filter((r) => r.status === "Pending");
  const holidays = configForSite(currentSiteId)?.holiday.holidays ?? [];
  const upcomingHolidays = holidays.filter((h) => h.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 5);
  const recentRequests = [
    ...myLeaveRequests.map((r) => ({ id: r.id, label: `${r.type} · ${r.from} to ${r.to}`, status: r.status, date: r.appliedOn })),
    ...myRegularizations.map((r) => ({ id: r.id, label: `Regularization · ${r.date}`, status: r.status, date: r.appliedOn })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8);
  const myCase = useMemo(
    () => currentCycleCaseFor(currentUser.employeeId, performanceCycles, performanceReviewCases),
    [currentUser.employeeId, performanceCycles, performanceReviewCases],
  );
  const myCycle = myCase ? performanceCycles.find((c) => c.id === myCase.cycleId) : undefined;
  const myGoalCount = myCase ? performanceGoalsFor(currentUser.employeeId, myCase.cycleId).length : 0;
  const myTrainingEnrollments = enrollmentsForEmployee(currentUser.employeeId);
  const myTrainingRequests = trainingRequestsFor(currentUser.employeeId);
  const myAssets = activeAssignmentsForEmployee(currentUser.employeeId);
  const myAssetRequests = assetRequestsFor(currentUser.employeeId);
  const myTravelRequests = travelRequestsFor(currentUser.employeeId);
  const myExpenseSummary = useMemo(() => getExpenseSummary(claimsFor(currentUser.employeeId)), [claimsFor, currentUser.employeeId]);

  return (
    <div className="space-y-6">
      <PageIntro title={`Welcome back, ${currentUser.name}! 👋`} subtitle="Here's your personal summary for today." />

      <Card className="flex items-center gap-4 p-5">
        <Avatar name={currentUser.name} size="lg" />
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{currentUser.name}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {currentUser.designation} &middot; {currentUser.department} &middot; {currentUser.employeeId}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's Attendance"
          value={todayRecord?.status ?? "Not Marked"}
          icon={UserCheck}
          tone={todayRecord?.status === "Present" ? "emerald" : "amber"}
        />
        <StatCard label="Present Days (This Month)" value={String(monthSummary.present)} icon={UserCheck} tone="emerald" />
        <StatCard label="Pending Leave Requests" value={String(pendingLeave.length)} icon={CalendarOff} tone="sky" />
        <StatCard label="Pending Regularizations" value={String(pendingRegularizations.length)} icon={AlertTriangle} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current Cycle" value={myCycle?.name ?? "—"} icon={Target} tone="indigo" trend={myCase ? undefined : "No goals assigned yet"} />
        <StatCard label="My Goals" value={String(myGoalCount)} icon={ClipboardCheck} tone="sky" />
        <StatCard label="Review Status" value={myCase?.stage ?? "—"} icon={UserCog} tone="amber" />
        <StatCard label="Current Rating" value={myCase?.finalScore !== undefined ? `${myCase.finalScore}/5` : "—"} icon={Star} tone="emerald" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My Training" value={String(myTrainingEnrollments.filter((e) => e.status !== "Cancelled").length)} icon={GraduationCap} tone="indigo" />
        <StatCard label="Upcoming Training" value={String(myTrainingEnrollments.filter((e) => e.status === "Registered" || e.status === "Approved").length)} icon={CalendarClock} tone="sky" />
        <StatCard label="Completed Training" value={String(myTrainingEnrollments.filter((e) => e.status === "Completed").length)} icon={ClipboardCheck} tone="emerald" />
        <StatCard label="Pending Training Requests" value={String(myTrainingRequests.filter((r) => r.status === "Pending").length)} icon={AlertTriangle} tone="amber" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="My Assets" value={String(myAssets.length)} icon={Laptop} tone="indigo" />
        <StatCard label="Pending Asset Requests" value={String(myAssetRequests.filter((r) => r.status === "Pending").length)} icon={AlertTriangle} tone="amber" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending Travel" value={String(myTravelRequests.filter((r) => r.status === "Pending").length)} icon={Plane} tone="amber" />
        <StatCard label="Pending Claims" value={String(myExpenseSummary.pendingApproval)} icon={Receipt} tone="amber" />
        <StatCard label="Approved Claims" value={String(myExpenseSummary.approvedForReimbursement + myExpenseSummary.reimbursed)} icon={ClipboardCheck} tone="sky" />
        <StatCard label="Reimbursed Amount" value={`₹${myExpenseSummary.reimbursedAmount.toLocaleString("en-IN")}`} icon={Wallet} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>My Leave Balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {leaveBalances.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No leave balance on file.</p>}
            {leaveBalances.map((b) => (
              <div key={b.type}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{b.type}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {b.used}/{b.total}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${Math.min(100, (b.used / b.total) * 100)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Latest Payslip</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-slate-400 dark:text-slate-500">Payroll has not been processed yet.</p>
            <Link href="/payroll/payslip" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              View Payroll <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Cake className="h-4 w-4" /> Upcoming Holidays
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {upcomingHolidays.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No upcoming holidays configured.</p>}
            {upcomingHolidays.map((h) => (
              <div key={`${h.name}-${h.date}`} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">{h.name}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{h.date}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Recent Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {recentRequests.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No requests yet.</p>}
          {recentRequests.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-300">{r.label}</span>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

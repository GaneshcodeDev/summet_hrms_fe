/**
 * Pure aggregation helpers for the Dashboard. Every function here takes
 * already-fetched, already-scoped data (from the existing Employee/
 * Attendance/Leave/Org stores via their normal hooks) and returns derived
 * numbers — no store access, no React, no site/RBAC filtering of its own.
 * Callers are responsible for scoping their inputs (by site, by team, by
 * employee) before calling these, using the existing Site Context / RBAC /
 * reporting-line mechanisms. This keeps one set of calculations reused
 * across the Super Admin / Site Admin / Manager / Employee dashboard views
 * instead of four separate implementations.
 */
import type {
  AttendanceRecord,
  AttendanceRegularization,
  Employee,
  LeaveAuditEntry,
  LeaveRequest,
  OrgUnit,
  SeparationCase,
} from "@/lib/types";
import { summarizeAttendance } from "@/lib/attendance-context";

export function getSiteEmployeeStats(employees: Employee[]) {
  return {
    total: employees.length,
    active: employees.filter((e) => e.status === "Active").length,
  };
}

export interface DepartmentCount {
  name: string;
  count: number;
}

/** Groups employees by their department display name (the field every employee already has). */
export function getDepartmentDistribution(employees: Employee[]): DepartmentCount[] {
  const counts = new Map<string, number>();
  for (const e of employees) {
    const label = e.department || "Unassigned";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** Departments configured for a site via Organization, regardless of whether anyone's assigned yet. */
export function countSiteDepartments(orgUnits: OrgUnit[]): number {
  return orgUnits.filter((u) => u.type === "Department").length;
}

function daysUntil(dateStr: string): number {
  const ms = new Date(`${dateStr}T00:00:00`).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime();
  return Math.round(ms / 86_400_000);
}

/** Employees whose dateOfJoining falls within the last N days (default 30). */
export function getNewJoiners(employees: Employee[], withinDays = 30): Employee[] {
  return employees
    .filter((e) => e.dateOfJoining && daysUntil(e.dateOfJoining) >= -withinDays && daysUntil(e.dateOfJoining) <= 0)
    .sort((a, b) => (a.dateOfJoining < b.dateOfJoining ? 1 : -1));
}

export interface UpcomingEvent {
  employee: Employee;
  type: "birthday" | "anniversary";
  date: string;
  daysAway: number;
}

/** Next occurrence (this year or next) of a birthday/anniversary, within `withinDays`. */
function nextOccurrence(dateStr: string, withinDays: number): number | null {
  const source = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(source.getTime())) return null;
  const today = new Date(new Date().toISOString().slice(0, 10));
  let next = new Date(today.getFullYear(), source.getMonth(), source.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, source.getMonth(), source.getDate());
  const days = Math.round((next.getTime() - today.getTime()) / 86_400_000);
  return days <= withinDays ? days : null;
}

/** Upcoming birthdays (from dateOfBirth, often unset) and work anniversaries (from dateOfJoining, always set). */
export function getUpcomingEvents(employees: Employee[], withinDays = 30): UpcomingEvent[] {
  const events: UpcomingEvent[] = [];
  for (const e of employees) {
    if (e.dateOfBirth) {
      const days = nextOccurrence(e.dateOfBirth, withinDays);
      if (days !== null) events.push({ employee: e, type: "birthday", date: e.dateOfBirth, daysAway: days });
    }
    if (e.dateOfJoining) {
      const days = nextOccurrence(e.dateOfJoining, withinDays);
      if (days !== null) events.push({ employee: e, type: "anniversary", date: e.dateOfJoining, daysAway: days });
    }
  }
  return events.sort((a, b) => a.daysAway - b.daysAway);
}

/** Per-day attendance summary for the last N days (default 7), oldest first. Only includes days that have any records. */
export function getAttendanceTrend(records: AttendanceRecord[], days = 7) {
  const trend: { date: string; summary: ReturnType<typeof summarizeAttendance> }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayRecords = records.filter((r) => r.date === dateStr);
    trend.push({ date: dateStr, summary: summarizeAttendance(dayRecords) });
  }
  return trend;
}

export function getLeaveSummaryForDate(requests: LeaveRequest[], date: string) {
  const onLeaveToday = requests.filter((r) => r.status === "Approved" && r.from <= date && r.to >= date).length;
  return {
    onLeaveToday,
    pending: requests.filter((r) => r.status === "Pending").length,
    approved: requests.filter((r) => r.status === "Approved").length,
    rejected: requests.filter((r) => r.status === "Rejected").length,
  };
}

const openSeparationStatuses: SeparationCase["status"][] = [
  "Pending Approval",
  "Approved",
  "Clearance In Progress",
  "Settlement Pending",
];

export interface ActivityItem {
  id: string;
  actorName: string;
  detail: string;
  timestamp: string;
}

/**
 * Real recent-activity feed built from actual audit trails (Leave audit +
 * decided Regularizations) — not fabricated. Callers pass already
 * site-scoped input; returns the most recent items first.
 */
export function getRecentActivity(
  leaveAudit: LeaveAuditEntry[],
  regularizations: AttendanceRegularization[],
  limit = 8,
): ActivityItem[] {
  const fromLeave: ActivityItem[] = leaveAudit.map((e) => ({
    id: e.id,
    actorName: e.actorName,
    detail: `${e.employeeName}: ${e.detail}`,
    timestamp: e.timestamp,
  }));
  const fromRegularization: ActivityItem[] = regularizations
    .filter((r) => r.status !== "Pending" && r.decidedOn)
    .map((r) => ({
      id: r.id,
      actorName: r.approverName ?? "System",
      detail: `${r.employee}: attendance regularization for ${r.date} ${r.status.toLowerCase()}`,
      timestamp: r.decidedOn as string,
    }));
  return [...fromLeave, ...fromRegularization]
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, limit);
}

export function getExitSummary(cases: SeparationCase[]) {
  const today = new Date().toISOString().slice(0, 10);
  const in30 = (d: string) => {
    const days = daysUntil(d);
    return days >= 0 && days <= 30;
  };
  const withinLast30 = (d: string) => {
    const days = daysUntil(d);
    return days <= 0 && days >= -30;
  };
  return {
    inNoticePeriod: cases.filter((c) => openSeparationStatuses.includes(c.status) && c.lastWorkingDay >= today).length,
    upcomingExits: cases.filter((c) => openSeparationStatuses.includes(c.status) && in30(c.lastWorkingDay)).length,
    recentlyExited: cases.filter((c) => c.status === "Completed" && withinLast30(c.lastWorkingDay)).length,
  };
}

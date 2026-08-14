/**
 * Pure Leave calculation/selector engine — no store access, no React. Every
 * function takes already-fetched, already-scoped data and returns derived
 * values, mirroring the payroll-engine.ts / dashboard-selectors.ts pattern.
 * leave-context.tsx and payroll-context.tsx are the only callers that touch
 * stores/hooks; everything here is unit-testable in isolation.
 */
import type { LeaveBalance, LeaveRequest, LeaveStatus } from "@/lib/types";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return dates;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export interface LeaveDayCalc {
  /** Total leave days charged (fractional for a half-day single-date request). */
  days: number;
  /** Calendar dates actually counted as leave (weekly-offs/holidays excluded) — what Attendance should mark ON_LEAVE. */
  applicableDates: string[];
}

/**
 * Counts leave days respecting the site's configured working days and
 * holiday calendar — a Friday+Monday request spanning a Sat/Sun weekly-off
 * charges 2 days, not 4. `halfDay` only applies to a single-date request.
 */
export function calculateLeaveDays(
  from: string,
  to: string,
  workingDays: string[],
  holidayDates: string[],
  halfDay?: "First Half" | "Second Half",
): LeaveDayCalc {
  const holidays = new Set(holidayDates);
  const applicableDates = eachDate(from, to).filter((date) => {
    const dow = dayNames[new Date(`${date}T00:00:00`).getDay()];
    return workingDays.includes(dow) && !holidays.has(date);
  });
  if (applicableDates.length === 0) return { days: 0, applicableDates: [] };
  const isSingleHalfDay = halfDay && from === to && applicableDates.length === 1;
  return { days: isSingleHalfDay ? 0.5 : applicableDates.length, applicableDates };
}

const activeOverlapStatuses: LeaveStatus[] = ["Pending", "Approved"];

/** True if `from..to` intersects any existing Pending/Approved request for the same employee (Rejected/Cancelled don't block). */
export function hasOverlap(existingRequests: LeaveRequest[], from: string, to: string, excludeId?: string): boolean {
  return existingRequests.some(
    (r) => r.id !== excludeId && activeOverlapStatuses.includes(r.status) && r.from <= to && r.to >= from,
  );
}

export interface LeaveBalanceSummary {
  opening: number;
  accrued: number;
  carryForward: number;
  used: number;
  pending: number;
  available: number;
}

/**
 * Available = Opening + Accrued + CarryForward - Used - Pending.
 * `fallbackOpening` is the site's configured annual allocation for this
 * leave type, used only when no persisted balance record exists yet (a
 * brand-new employee's opening balance is their real configured entitlement
 * — not a fabricated number, just not persisted until first touched).
 */
export function computeLeaveBalanceSummary(
  balance: LeaveBalance | undefined,
  fallbackOpening: number,
  pendingDays: number,
): LeaveBalanceSummary {
  const opening = balance?.opening ?? balance?.total ?? fallbackOpening;
  const accrued = balance?.accrued ?? 0;
  const carryForward = balance?.carryForward ?? 0;
  const used = balance?.used ?? 0;
  return {
    opening,
    accrued,
    carryForward,
    used,
    pending: pendingDays,
    available: opening + accrued + carryForward - used - pendingDays,
  };
}

/** This employee's real (non-fabricated) balance per leave type they have a record for. */
export function getEmployeeLeaveBalance(balances: LeaveBalance[], requests: LeaveRequest[], employeeId: string) {
  return balances
    .filter((b) => b.employeeId === employeeId)
    .map((b) => {
      const pendingDays = requests
        .filter((r) => r.employeeId === employeeId && r.type === b.type && r.status === "Pending")
        .reduce((sum, r) => sum + r.days, 0);
      return { balance: b, summary: computeLeaveBalanceSummary(b, b.total, pendingDays) };
    });
}

export function getLeaveRequestsForSite(requests: LeaveRequest[], siteId: string): LeaveRequest[] {
  return requests.filter((r) => r.siteId === siteId);
}

export function getPendingLeaveRequests(requests: LeaveRequest[], siteId?: string): LeaveRequest[] {
  return requests.filter((r) => r.status === "Pending" && (!siteId || r.siteId === siteId));
}

/** Employees actually on approved leave covering `date`, for this site. */
export function getApprovedLeaveForDate(requests: LeaveRequest[], siteId: string, date: string): LeaveRequest[] {
  return requests.filter((r) => r.siteId === siteId && r.status === "Approved" && r.from <= date && r.to >= date);
}

export interface LeaveSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  approvedDays: number;
  byType: { type: string; approvedDays: number; requests: number }[];
}

/** Aggregate leave activity for a site within a date range — the one place this rollup is computed, reused by Dashboard/Reports. */
export function getLeaveSummary(requests: LeaveRequest[], siteId: string, range: { from: string; to: string }): LeaveSummary {
  const inRange = requests.filter((r) => r.siteId === siteId && r.from <= range.to && r.to >= range.from);
  const approved = inRange.filter((r) => r.status === "Approved");
  const byTypeMap = new Map<string, { approvedDays: number; requests: number }>();
  for (const r of approved) {
    const entry = byTypeMap.get(r.type) ?? { approvedDays: 0, requests: 0 };
    entry.approvedDays += r.days;
    entry.requests += 1;
    byTypeMap.set(r.type, entry);
  }
  return {
    total: inRange.length,
    pending: inRange.filter((r) => r.status === "Pending").length,
    approved: approved.length,
    rejected: inRange.filter((r) => r.status === "Rejected").length,
    cancelled: inRange.filter((r) => r.status === "Cancelled").length,
    approvedDays: approved.reduce((sum, r) => sum + r.days, 0),
    byType: Array.from(byTypeMap.entries()).map(([type, v]) => ({ type, ...v })),
  };
}

export interface PayrollLeaveDay {
  isPaid: boolean;
  portion: number;
}

/**
 * Expands approved leave requests into a per-date paid/unpaid map, scoped to
 * the pay period's actual working days. Payroll consumes this — see
 * payroll-engine.ts's computeAttendanceForPayroll — rather than re-deriving
 * paid/unpaid from Attendance status, which can't tell the two apart.
 */
export function computeLeaveDaysForPayroll(
  approvedLeaveRequests: LeaveRequest[],
  workingDayDates: string[],
  isPaidLookup: (request: LeaveRequest) => boolean,
): Map<string, PayrollLeaveDay> {
  const workingSet = new Set(workingDayDates);
  const map = new Map<string, PayrollLeaveDay>();
  for (const request of approvedLeaveRequests) {
    const isPaid = isPaidLookup(request);
    const portion = request.halfDay ? 0.5 : 1;
    for (const date of eachDate(request.from, request.to)) {
      if (workingSet.has(date)) map.set(date, { isPaid, portion });
    }
  }
  return map;
}

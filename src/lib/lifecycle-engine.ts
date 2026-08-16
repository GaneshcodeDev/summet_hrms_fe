/**
 * Pure Employee Lifecycle engine — no store access, no React. Mirrors
 * payroll-engine.ts / recruitment-engine.ts: every function takes plain
 * data and returns a derived value. employee-lifecycle-context.tsx and
 * dashboard-selectors.ts are the callers.
 */

/** Probation End Date = Joining Date + Probation Period (months) — never a hardcoded duration. */
export function calculateProbationEndDate(joiningDate: string, probationPeriodMonths: number): string {
  const d = new Date(`${joiningDate}T00:00:00`);
  d.setMonth(d.getMonth() + probationPeriodMonths);
  return d.toISOString().slice(0, 10);
}

/** True once the calendar has reached (or passed) the probation end date. */
export function isProbationOverdue(joiningDate: string, probationPeriodMonths: number, today: string): boolean {
  return calculateProbationEndDate(joiningDate, probationPeriodMonths) <= today;
}

/** True when probation ends within the next N days (default 30) but hasn't already passed. */
export function isProbationDueSoon(joiningDate: string, probationPeriodMonths: number, today: string, withinDays = 30): boolean {
  const end = calculateProbationEndDate(joiningDate, probationPeriodMonths);
  if (end < today) return false;
  const days = Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000);
  return days <= withinDays;
}

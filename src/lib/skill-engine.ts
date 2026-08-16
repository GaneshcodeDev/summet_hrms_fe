/**
 * Pure Employee Skills engine — no store access, no React. Mirrors
 * payroll-engine.ts's salary-versioning pattern exactly: EmployeeSkill
 * records are append-only, and "current" is always just "the latest one for
 * this employeeId+skillId pair" — never a separately-maintained field that
 * could drift out of sync with the history.
 */
import type { EmployeeSkill } from "@/lib/types";

/**
 * Every version on file for one employee+skill, oldest first — the real
 * Skill History (section 19). Ordered by `createdOn` (a full ISO timestamp,
 * always monotonically unique), never `lastAssessedDate` — that field is
 * only day-precision and user-editable, so two assessments recorded on the
 * same calendar day (a real scenario: an HR assessment followed later that
 * day by a training-completion bump) would otherwise tie and risk the
 * comparator picking the wrong one as "current".
 */
export function skillHistoryFor(skills: EmployeeSkill[], employeeId: string, skillId: string): EmployeeSkill[] {
  return skills
    .filter((s) => s.employeeId === employeeId && s.skillId === skillId)
    .sort((a, b) => (a.createdOn < b.createdOn ? -1 : a.createdOn > b.createdOn ? 1 : 0));
}

/** The latest version for one employee+skill, or undefined if never recorded. */
export function selectCurrentSkill(skills: EmployeeSkill[], employeeId: string, skillId: string): EmployeeSkill | undefined {
  const history = skillHistoryFor(skills, employeeId, skillId);
  return history[history.length - 1];
}

/** One row per distinct skillId this employee has ever had a record for — each the latest version (reuses selectCurrentSkill, never a second comparison rule). */
export function selectCurrentSkills(skills: EmployeeSkill[], employeeId: string): EmployeeSkill[] {
  const skillIds = new Set(skills.filter((s) => s.employeeId === employeeId).map((s) => s.skillId));
  return Array.from(skillIds)
    .map((skillId) => selectCurrentSkill(skills, employeeId, skillId))
    .filter((s): s is EmployeeSkill => Boolean(s));
}

/** Required level minus current level (ordinal "value" attributes from the SkillLevel master) — positive means a real gap, 0/negative means the requirement is already met. */
export function calculateSkillGap(currentLevelValue: number, requiredLevelValue: number): number {
  return requiredLevelValue - currentLevelValue;
}

/**
 * What a training-completion should propose as the new skill level — the
 * program's own explicit target if it set one, otherwise one ordinal step
 * up from wherever the employee is today (capped at the highest configured
 * level). Never returns a level lower than the current one.
 */
export function resolveProposedSkillLevelId(
  currentLevelValue: number | undefined,
  targetSkillLevelId: string | undefined,
  skillLevels: { id: string; value: number }[],
): string | undefined {
  if (skillLevels.length === 0) return undefined;
  if (targetSkillLevelId) return targetSkillLevelId;
  const sorted = skillLevels.slice().sort((a, b) => a.value - b.value);
  const currentIdx = currentLevelValue === undefined ? -1 : sorted.findIndex((l) => l.value === currentLevelValue);
  const nextIdx = Math.min(currentIdx + 1, sorted.length - 1);
  return sorted[Math.max(nextIdx, 0)]?.id;
}

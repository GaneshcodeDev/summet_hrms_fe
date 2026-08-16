"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import type { EmployeeSkill, SkillUpdateProposal } from "@/lib/types";

// Real product starts with zero skill records — see demo-seed.ts for the optional rich dataset.
export const employeeSkillsStore = createLocalStorageStore<EmployeeSkill[]>("hrms_employee_skills", []);
export const skillUpdateProposalsStore = createLocalStorageStore<SkillUpdateProposal[]>("hrms_skill_update_proposals", []);

function nextSeqId(prefix: string, existingIds: string[]): string {
  const numbers = existingIds
    .map((id) => Number(id.replace(new RegExp(`^${prefix}`, "i"), "")))
    .filter((n) => Number.isFinite(n));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export function nextEmployeeSkillId(): string {
  return nextSeqId("ESK-", employeeSkillsStore.getSnapshot().map((s) => s.id));
}

export function nextSkillUpdateProposalId(): string {
  return nextSeqId("SUP-", skillUpdateProposalsStore.getSnapshot().map((s) => s.id));
}

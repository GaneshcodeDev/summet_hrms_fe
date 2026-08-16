"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  employeeSkillsStore,
  nextEmployeeSkillId,
  nextSkillUpdateProposalId,
  skillUpdateProposalsStore,
} from "@/lib/skill-store";
import { selectCurrentSkill, selectCurrentSkills, skillHistoryFor as skillHistoryForEngine } from "@/lib/skill-engine";
import { useAccessControl } from "@/lib/access-control-context";
import { useEmployees } from "@/lib/employee-context";
import type { EmployeeSkill, SkillUpdateProposal } from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

interface AssessSkillInput {
  employeeId: string;
  siteId: string;
  skillId: string;
  skillLevelId: string;
  yearsOfExperience?: number;
  comment?: string;
}

interface CreateProposalInput {
  employeeId: string;
  siteId: string;
  skillId: string;
  proposedSkillLevelId: string;
  sourceEnrollmentId: string;
  reason: string;
}

interface SkillsContextValue {
  skills: EmployeeSkill[];
  currentSkillsFor: (employeeId: string) => EmployeeSkill[];
  currentSkillFor: (employeeId: string, skillId: string) => EmployeeSkill | undefined;
  skillHistoryFor: (employeeId: string, skillId: string) => EmployeeSkill[];
  canManageAllSkills: boolean;
  canAssessSkillFor: (employeeId: string) => boolean;
  assessSkill: (input: AssessSkillInput) => ActionResult;

  proposals: SkillUpdateProposal[];
  proposalsFor: (employeeId: string) => SkillUpdateProposal[];
  pendingProposalsForScope: () => SkillUpdateProposal[];
  /** Called internally by training-context.tsx when an enrollment linked to a skill completes — never applied without a later decideSkillUpdateProposal (section 17). */
  createSkillUpdateProposal: (input: CreateProposalInput) => SkillUpdateProposal;
  decideSkillUpdateProposal: (id: string, decision: "Approved" | "Rejected", comment?: string) => ActionResult;
}

const SkillsContext = createContext<SkillsContextValue | undefined>(undefined);

export function SkillsProvider({ children }: { children: ReactNode }) {
  const { currentUser, canFeature } = useAccessControl();
  const { getEmployeeByEmployeeId } = useEmployees();

  const skills = useSyncExternalStore(employeeSkillsStore.subscribe, employeeSkillsStore.getSnapshot, employeeSkillsStore.getServerSnapshot);
  const proposals = useSyncExternalStore(skillUpdateProposalsStore.subscribe, skillUpdateProposalsStore.getSnapshot, skillUpdateProposalsStore.getServerSnapshot);

  // "manage" only ever comes from the full-access grant() helper (Super
  // Admin / Site Admin / HR Admin) — every other role holding
  // employees.skills gets an explicit action list, so this one check is the
  // whole "HR-level, any employee in scope" vs. "manager, direct reports
  // only" split, same pattern as Performance's canManageAllReviews.
  const canManageAllSkills = canFeature("employees.skills", "manage");

  const isDirectManagerOf = useCallback(
    (employeeId: string) => {
      const target = getEmployeeByEmployeeId(employeeId);
      return !!target && target.reportingManagerId === currentUser.employeeId;
    },
    [getEmployeeByEmployeeId, currentUser.employeeId],
  );

  const canAssessSkillFor = useCallback(
    (employeeId: string) => {
      if (canManageAllSkills) return true;
      return canFeature("employees.skills", "edit") && isDirectManagerOf(employeeId);
    },
    [canManageAllSkills, canFeature, isDirectManagerOf],
  );

  const currentSkillsFor = useCallback((employeeId: string) => selectCurrentSkills(skills, employeeId), [skills]);
  const currentSkillFor = useCallback((employeeId: string, skillId: string) => selectCurrentSkill(skills, employeeId, skillId), [skills]);
  const skillHistoryFor = useCallback((employeeId: string, skillId: string) => skillHistoryForEngine(skills, employeeId, skillId), [skills]);

  const assessSkill = useCallback(
    (input: AssessSkillInput): ActionResult => {
      if (!canAssessSkillFor(input.employeeId)) return { ok: false, message: "You're not authorized to assess this employee's skills." };
      const employee = getEmployeeByEmployeeId(input.employeeId);
      if (!employee) return { ok: false, message: "Employee not found." };
      const record: EmployeeSkill = {
        id: nextEmployeeSkillId(),
        employeeId: input.employeeId,
        siteId: input.siteId,
        skillId: input.skillId,
        skillLevelId: input.skillLevelId,
        yearsOfExperience: input.yearsOfExperience,
        lastAssessedDate: new Date().toISOString().slice(0, 10),
        source: canManageAllSkills ? "HR Assessed" : "Manager Assessed",
        assessedBy: currentUser.name,
        comment: input.comment?.trim() || undefined,
        createdOn: new Date().toISOString(),
      };
      employeeSkillsStore.set([record, ...employeeSkillsStore.getSnapshot()]);
      return { ok: true, message: `Skill assessment recorded for ${employee.name}.` };
    },
    [canAssessSkillFor, getEmployeeByEmployeeId, canManageAllSkills, currentUser.name],
  );

  const proposalsFor = useCallback((employeeId: string) => proposals.filter((p) => p.employeeId === employeeId), [proposals]);
  const pendingProposalsForScope = useCallback(() => {
    if (canManageAllSkills) return proposals.filter((p) => p.status === "Pending");
    return proposals.filter((p) => p.status === "Pending" && isDirectManagerOf(p.employeeId));
  }, [proposals, canManageAllSkills, isDirectManagerOf]);

  const createSkillUpdateProposal = useCallback((input: CreateProposalInput): SkillUpdateProposal => {
    const current = selectCurrentSkill(employeeSkillsStore.getSnapshot(), input.employeeId, input.skillId);
    const proposal: SkillUpdateProposal = {
      id: nextSkillUpdateProposalId(),
      employeeId: input.employeeId,
      siteId: input.siteId,
      skillId: input.skillId,
      currentSkillLevelId: current?.skillLevelId,
      proposedSkillLevelId: input.proposedSkillLevelId,
      sourceEnrollmentId: input.sourceEnrollmentId,
      reason: input.reason,
      status: "Pending",
      createdOn: new Date().toISOString().slice(0, 10),
    };
    skillUpdateProposalsStore.set([proposal, ...skillUpdateProposalsStore.getSnapshot()]);
    return proposal;
  }, []);

  const decideSkillUpdateProposal = useCallback(
    (id: string, decision: "Approved" | "Rejected", comment?: string): ActionResult => {
      const proposal = skillUpdateProposalsStore.getSnapshot().find((p) => p.id === id);
      if (!proposal) return { ok: false, message: "Skill update proposal not found." };
      // Unconditional — an employee can never confirm their own proposed skill bump (section 17/26).
      if (proposal.employeeId === currentUser.employeeId) return { ok: false, message: "You cannot decide your own skill update proposal." };
      if (!canAssessSkillFor(proposal.employeeId)) return { ok: false, message: "You're not authorized to decide this proposal." };
      if (proposal.status !== "Pending") return { ok: false, message: "This proposal has already been decided." };

      const today = new Date().toISOString().slice(0, 10);
      skillUpdateProposalsStore.set(
        skillUpdateProposalsStore.getSnapshot().map((p) => (p.id === id ? { ...p, status: decision, decidedBy: currentUser.name, decidedOn: today } : p)),
      );

      if (decision === "Approved") {
        const employee = getEmployeeByEmployeeId(proposal.employeeId);
        const record: EmployeeSkill = {
          id: nextEmployeeSkillId(),
          employeeId: proposal.employeeId,
          siteId: proposal.siteId,
          skillId: proposal.skillId,
          skillLevelId: proposal.proposedSkillLevelId,
          lastAssessedDate: today,
          source: "Training Completion",
          assessedBy: currentUser.name,
          comment: comment?.trim() || proposal.reason,
          createdOn: new Date().toISOString(),
        };
        employeeSkillsStore.set([record, ...employeeSkillsStore.getSnapshot()]);
        return { ok: true, message: `Skill level updated for ${employee?.name ?? proposal.employeeId}.` };
      }
      return { ok: true, message: "Skill update proposal rejected." };
    },
    [currentUser.employeeId, currentUser.name, canAssessSkillFor, getEmployeeByEmployeeId],
  );

  const value = useMemo<SkillsContextValue>(
    () => ({
      skills,
      currentSkillsFor,
      currentSkillFor,
      skillHistoryFor,
      canManageAllSkills,
      canAssessSkillFor,
      assessSkill,
      proposals,
      proposalsFor,
      pendingProposalsForScope,
      createSkillUpdateProposal,
      decideSkillUpdateProposal,
    }),
    [
      skills,
      currentSkillsFor,
      currentSkillFor,
      skillHistoryFor,
      canManageAllSkills,
      canAssessSkillFor,
      assessSkill,
      proposals,
      proposalsFor,
      pendingProposalsForScope,
      createSkillUpdateProposal,
      decideSkillUpdateProposal,
    ],
  );

  return <SkillsContext.Provider value={value}>{children}</SkillsContext.Provider>;
}

export function useSkills() {
  const ctx = useContext(SkillsContext);
  if (!ctx) throw new Error("useSkills must be used within a SkillsProvider");
  return ctx;
}

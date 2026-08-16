/**
 * Pure Recruitment engine — no store access, no React. Mirrors
 * payroll-engine.ts / leave-engine.ts / approval-engine.ts: every function
 * takes already-fetched data and returns derived values or pure decisions.
 * recruitment-context.tsx is the only caller that touches stores/hooks.
 */
import type { ApplicationStage, ApproverType, WorkflowStepChain } from "@/lib/types";

/**
 * Hiring Manager -> HR, mirroring the shape of resolveLeaveWorkflowSteps
 * (approval-engine.ts) for Leave's "Manager then HR" mode — Requisition
 * approval always runs through the requesting employee's reporting chain
 * first (the hiring manager), then HR signs off. No per-site configuration
 * exists yet (unlike Leave's SiteLeaveConfig.approvalMode), so this is the
 * one fixed chain every requisition uses; see AGENTS.md Phase 11 section 4.
 */
export function resolveRequisitionWorkflowSteps(): WorkflowStepChain {
  return [
    { order: 0, approverType: "REPORTING_MANAGER" as ApproverType, required: true },
    { order: 1, approverType: "HR" as ApproverType, required: true },
  ];
}

/** Applied -> Screening -> Interview -> Selected -> Offer -> Offer Accepted -> Hired, with Rejected/Withdrawn reachable as an exit from any non-terminal stage. */
const FORWARD_STAGE_ORDER: ApplicationStage[] = [
  "Applied",
  "Screening",
  "Interview",
  "Selected",
  "Offer",
  "Offer Accepted",
  "Hired",
];
const TERMINAL_STAGES: ApplicationStage[] = ["Hired", "Rejected", "Withdrawn"];

export function isTerminalStage(stage: ApplicationStage): boolean {
  return TERMINAL_STAGES.includes(stage);
}

/** Stages an application may move to from its current stage — forward one step at a time, or straight to Rejected/Withdrawn from anywhere still active. */
export function nextStagesFrom(stage: ApplicationStage): ApplicationStage[] {
  if (isTerminalStage(stage)) return [];
  const idx = FORWARD_STAGE_ORDER.indexOf(stage);
  const forward = idx >= 0 && idx < FORWARD_STAGE_ORDER.length - 1 ? [FORWARD_STAGE_ORDER[idx + 1]] : [];
  return [...forward, "Rejected", "Withdrawn"];
}

export function canTransitionStage(from: ApplicationStage, to: ApplicationStage): boolean {
  return nextStagesFrom(from).includes(to);
}

export interface FunnelCounts {
  applied: number;
  screening: number;
  interview: number;
  selected: number;
  offer: number;
  offerAccepted: number;
  hired: number;
  rejected: number;
  withdrawn: number;
}

/** Counts applications currently sitting at each stage — a snapshot, not a cumulative funnel (an application only ever occupies one stage at a time). */
export function getFunnelCounts(stages: ApplicationStage[]): FunnelCounts {
  const count = (s: ApplicationStage) => stages.filter((x) => x === s).length;
  return {
    applied: count("Applied"),
    screening: count("Screening"),
    interview: count("Interview"),
    selected: count("Selected"),
    offer: count("Offer"),
    offerAccepted: count("Offer Accepted"),
    hired: count("Hired"),
    rejected: count("Rejected"),
    withdrawn: count("Withdrawn"),
  };
}

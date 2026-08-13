"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { logOffboardingAudit, offboardingAuditStore, separationCasesStore } from "@/lib/offboarding-store";
import { buildClearanceItems } from "@/lib/offboarding-data";
import { leaveBalancesStore } from "@/lib/leave-store";
import { employeeLoansStore } from "@/lib/payroll-store";
import { employees } from "@/lib/mock-data";
import { useAccessControl } from "@/lib/access-control-context";
import type {
  ClearanceItemStatus,
  ExitInterview,
  FnFLineItem,
  LetterStatus,
  OffboardingAuditEntry,
  SeparationCase,
  SeparationStatus,
  SeparationType,
} from "@/lib/types";

/** Illustrative flat per-day encashment rate used for the demo F&F calculation (no real payroll engine). */
const ENCASHMENT_DAILY_RATE = 2500;
const PENDING_SALARY_ESTIMATE = 15000;

interface ActionResult {
  ok: boolean;
  message: string;
}

interface InitiateSeparationInput {
  employeeId: string;
  type: SeparationType;
  reason: string;
  resignationDate: string;
  lastWorkingDay: string;
  noticePeriodDays: number;
}

const openStatuses: SeparationStatus[] = ["Pending Approval", "Approved", "Clearance In Progress", "Settlement Pending"];

interface OffboardingContextValue {
  cases: SeparationCase[];
  auditEntries: OffboardingAuditEntry[];
  canManage: boolean;
  visibleCases: () => SeparationCase[];
  caseById: (id: string) => SeparationCase | undefined;
  auditFor: (caseId: string) => OffboardingAuditEntry[];
  initiateSeparation: (input: InitiateSeparationInput) => ActionResult;
  approveSeparation: (id: string) => ActionResult;
  rejectSeparation: (id: string, reason: string) => ActionResult;
  withdrawResignation: (id: string) => ActionResult;
  updateClearanceItem: (caseId: string, itemId: string, status: ClearanceItemStatus, remarks?: string) => ActionResult;
  scheduleExitInterview: (caseId: string, scheduledOn: string, conductedBy: string) => ActionResult;
  submitExitInterviewFeedback: (caseId: string, feedback: Pick<ExitInterview, "primaryReason" | "feedbackNotes" | "wouldRehire" | "rating">) => ActionResult;
  computeSettlement: (caseId: string) => ActionResult;
  addSettlementLineItem: (caseId: string, label: string, type: FnFLineItem["type"], amount: number) => ActionResult;
  markSettlementPaid: (caseId: string, reference: string) => ActionResult;
  advanceLetterStatus: (caseId: string, letter: "relieving" | "experience") => ActionResult;
  completeOffboarding: (caseId: string) => ActionResult;
}

const OffboardingContext = createContext<OffboardingContextValue | undefined>(undefined);

function allCleared(c: SeparationCase) {
  return c.clearanceItems.every((i) => i.status === "Cleared");
}

export function OffboardingProvider({ children }: { children: ReactNode }) {
  const { currentUser, canFeature } = useAccessControl();

  const cases = useSyncExternalStore(
    separationCasesStore.subscribe,
    separationCasesStore.getSnapshot,
    separationCasesStore.getServerSnapshot,
  );
  const auditEntries = useSyncExternalStore(
    offboardingAuditStore.subscribe,
    offboardingAuditStore.getSnapshot,
    offboardingAuditStore.getServerSnapshot,
  );

  const canManage = canFeature("offboarding.cases", "edit") || canFeature("offboarding.cases", "manage");
  const canCreate = canFeature("offboarding.cases", "create") || canManage;

  const visibleCases = useCallback(() => {
    if (canManage) return cases;
    const directReportIds = new Set(
      employees.filter((e) => e.reportingManagerId === currentUser.employeeId).map((e) => e.employeeId),
    );
    return cases.filter((c) => c.employeeId === currentUser.employeeId || directReportIds.has(c.employeeId));
  }, [cases, canManage, currentUser.employeeId]);

  const caseById = useCallback((id: string) => cases.find((c) => c.id === id), [cases]);
  const auditFor = useCallback((caseId: string) => auditEntries.filter((e) => e.caseId === caseId), [auditEntries]);

  const mutateCase = useCallback((caseId: string, fn: (c: SeparationCase) => SeparationCase) => {
    separationCasesStore.set(separationCasesStore.getSnapshot().map((c) => (c.id === caseId ? fn(c) : c)));
  }, []);

  const initiateSeparation = useCallback(
    (input: InitiateSeparationInput): ActionResult => {
      const targetIsSelf = input.employeeId === currentUser.employeeId;
      if (!targetIsSelf && !canManage) {
        return { ok: false, message: "You're not authorized to initiate a separation for another employee." };
      }
      if (targetIsSelf && !canCreate) {
        return { ok: false, message: "You're not authorized to submit a resignation." };
      }
      const employee = employees.find((e) => e.employeeId === input.employeeId);
      if (!employee) return { ok: false, message: "Employee not found." };
      const existingOpen = separationCasesStore
        .getSnapshot()
        .find((c) => c.employeeId === input.employeeId && openStatuses.includes(c.status));
      if (existingOpen) return { ok: false, message: `${employee.name} already has an active separation case in progress.` };

      const id = `off-${Date.now().toString(36)}`;
      const record: SeparationCase = {
        id,
        employeeId: employee.employeeId,
        employee: employee.name,
        designation: employee.designation,
        department: employee.department,
        siteId: employee.siteId,
        type: input.type,
        reason: input.reason,
        resignationDate: input.resignationDate,
        lastWorkingDay: input.lastWorkingDay,
        noticePeriodDays: input.noticePeriodDays,
        status: "Pending Approval",
        initiatedBy: currentUser.name,
        clearanceItems: buildClearanceItems(id),
        exitInterview: { status: "Not Scheduled" },
        settlement: { lineItems: [], netPayable: 0, status: "Pending" },
        relievingLetterStatus: "Not Generated",
        experienceLetterStatus: "Not Generated",
      };
      separationCasesStore.set([record, ...separationCasesStore.getSnapshot()]);
      logOffboardingAudit({
        caseId: id,
        employeeName: employee.name,
        action: "initiated",
        actorName: currentUser.name,
        detail: `${input.type} submitted — reason: ${input.reason}`,
      });
      return { ok: true, message: `${input.type} submitted for ${employee.name}.` };
    },
    [canCreate, canManage, currentUser.employeeId, currentUser.name],
  );

  const approveSeparation = useCallback(
    (id: string): ActionResult => {
      if (!canManage) return { ok: false, message: "You're not authorized to approve separations." };
      const record = separationCasesStore.getSnapshot().find((c) => c.id === id);
      if (!record) return { ok: false, message: "Separation case not found." };
      if (record.status !== "Pending Approval") return { ok: false, message: "This case has already been decided." };

      mutateCase(id, (c) => ({ ...c, status: "Approved", approverId: currentUser.employeeId, approverName: currentUser.name, decidedOn: new Date().toISOString().slice(0, 10) }));
      logOffboardingAudit({ caseId: id, employeeName: record.employee, action: "approved", actorName: currentUser.name, detail: `${record.type} approved` });
      return { ok: true, message: `Approved ${record.employee}'s ${record.type.toLowerCase()}.` };
    },
    [canManage, currentUser.employeeId, currentUser.name, mutateCase],
  );

  const rejectSeparation = useCallback(
    (id: string, reason: string): ActionResult => {
      if (!canManage) return { ok: false, message: "You're not authorized to reject separations." };
      if (!reason.trim()) return { ok: false, message: "A reason is required to reject a separation request." };
      const record = separationCasesStore.getSnapshot().find((c) => c.id === id);
      if (!record) return { ok: false, message: "Separation case not found." };
      if (record.status !== "Pending Approval") return { ok: false, message: "This case has already been decided." };

      mutateCase(id, (c) => ({
        ...c,
        status: "Rejected",
        approverId: currentUser.employeeId,
        approverName: currentUser.name,
        decisionReason: reason.trim(),
        decidedOn: new Date().toISOString().slice(0, 10),
      }));
      logOffboardingAudit({ caseId: id, employeeName: record.employee, action: "rejected", actorName: currentUser.name, detail: `${record.type} rejected — ${reason.trim()}` });
      return { ok: true, message: `Rejected ${record.employee}'s ${record.type.toLowerCase()}.` };
    },
    [canManage, currentUser.employeeId, currentUser.name, mutateCase],
  );

  const withdrawResignation = useCallback(
    (id: string): ActionResult => {
      const record = separationCasesStore.getSnapshot().find((c) => c.id === id);
      if (!record) return { ok: false, message: "Separation case not found." };
      if (record.employeeId !== currentUser.employeeId) return { ok: false, message: "You can only withdraw your own resignation." };
      if (record.status !== "Pending Approval") return { ok: false, message: "Only requests still pending approval can be withdrawn." };

      mutateCase(id, (c) => ({ ...c, status: "Withdrawn" }));
      logOffboardingAudit({ caseId: id, employeeName: record.employee, action: "withdrawn", actorName: currentUser.name, detail: "Resignation withdrawn by the employee" });
      return { ok: true, message: "Resignation withdrawn." };
    },
    [currentUser.employeeId, currentUser.name, mutateCase],
  );

  const updateClearanceItem = useCallback(
    (caseId: string, itemId: string, status: ClearanceItemStatus, remarks?: string): ActionResult => {
      if (!canManage) return { ok: false, message: "You're not authorized to update clearance items." };
      const record = separationCasesStore.getSnapshot().find((c) => c.id === caseId);
      if (!record) return { ok: false, message: "Separation case not found." };
      if (!openStatuses.includes(record.status)) return { ok: false, message: "This case is no longer open for clearance updates." };
      const item = record.clearanceItems.find((i) => i.id === itemId);
      if (!item) return { ok: false, message: "Clearance item not found." };

      mutateCase(caseId, (c) => {
        const updatedItems = c.clearanceItems.map((i) =>
          i.id === itemId
            ? { ...i, status, clearedBy: status === "Cleared" ? currentUser.name : i.clearedBy, clearedOn: status === "Cleared" ? new Date().toISOString().slice(0, 10) : i.clearedOn, remarks: remarks?.trim() || i.remarks }
            : i,
        );
        const nowAllCleared = updatedItems.every((i) => i.status === "Cleared");
        const nextStatus: SeparationStatus =
          c.status === "Approved"
            ? "Clearance In Progress"
            : nowAllCleared && c.settlement.status !== "Paid"
              ? "Settlement Pending"
              : c.status;
        return { ...c, clearanceItems: updatedItems, status: nextStatus };
      });
      logOffboardingAudit({ caseId, employeeName: record.employee, action: "clearance_updated", actorName: currentUser.name, detail: `${item.title} marked ${status}` });
      return { ok: true, message: `${item.title} marked ${status}.` };
    },
    [canManage, currentUser.name, mutateCase],
  );

  const scheduleExitInterview = useCallback(
    (caseId: string, scheduledOn: string, conductedBy: string): ActionResult => {
      if (!canManage) return { ok: false, message: "You're not authorized to schedule exit interviews." };
      const record = separationCasesStore.getSnapshot().find((c) => c.id === caseId);
      if (!record) return { ok: false, message: "Separation case not found." };

      mutateCase(caseId, (c) => ({ ...c, exitInterview: { ...c.exitInterview, status: "Scheduled", scheduledOn, conductedBy } }));
      logOffboardingAudit({ caseId, employeeName: record.employee, action: "exit_interview_scheduled", actorName: currentUser.name, detail: `Exit interview scheduled for ${scheduledOn}` });
      return { ok: true, message: "Exit interview scheduled." };
    },
    [canManage, currentUser.name, mutateCase],
  );

  const submitExitInterviewFeedback = useCallback(
    (caseId: string, feedback: Pick<ExitInterview, "primaryReason" | "feedbackNotes" | "wouldRehire" | "rating">): ActionResult => {
      if (!canManage) return { ok: false, message: "You're not authorized to record exit interview feedback." };
      const record = separationCasesStore.getSnapshot().find((c) => c.id === caseId);
      if (!record) return { ok: false, message: "Separation case not found." };

      mutateCase(caseId, (c) => ({ ...c, exitInterview: { ...c.exitInterview, ...feedback, status: "Completed" } }));
      logOffboardingAudit({ caseId, employeeName: record.employee, action: "exit_interview_completed", actorName: currentUser.name, detail: "Exit interview feedback recorded" });
      return { ok: true, message: "Exit interview feedback saved." };
    },
    [canManage, currentUser.name, mutateCase],
  );

  const computeSettlement = useCallback(
    (caseId: string): ActionResult => {
      if (!canManage) return { ok: false, message: "You're not authorized to compute the F&F settlement." };
      const record = separationCasesStore.getSnapshot().find((c) => c.id === caseId);
      if (!record) return { ok: false, message: "Separation case not found." };
      if (record.settlement.status === "Paid") return { ok: false, message: "This settlement has already been paid." };

      const leaveBalance = leaveBalancesStore.getSnapshot().find((b) => b.employeeId === record.employeeId && b.type === "Earned Leave");
      const encashableDays = leaveBalance ? Math.max(leaveBalance.total - leaveBalance.used, 0) : 0;
      const activeLoans = employeeLoansStore.getSnapshot().filter((l) => l.employeeId === record.employeeId && l.status === "Active");

      const lineItems: FnFLineItem[] = [
        { id: `fnf-${Date.now()}-1`, label: "Pending Salary (partial month)", type: "Earning", amount: PENDING_SALARY_ESTIMATE, autoComputed: true },
      ];
      if (encashableDays > 0) {
        lineItems.push({
          id: `fnf-${Date.now()}-2`,
          label: `Leave Encashment (${encashableDays} day${encashableDays === 1 ? "" : "s"} @ ₹${ENCASHMENT_DAILY_RATE}/day)`,
          type: "Earning",
          amount: encashableDays * ENCASHMENT_DAILY_RATE,
          autoComputed: true,
        });
      }
      activeLoans.forEach((loan, i) => {
        lineItems.push({
          id: `fnf-${Date.now()}-loan-${i}`,
          label: `Loan Recovery — ${loan.type}`,
          type: "Deduction",
          amount: loan.outstandingAmount,
          autoComputed: true,
        });
      });

      const netPayable = lineItems.reduce((sum, li) => sum + (li.type === "Earning" ? li.amount : -li.amount), 0);

      mutateCase(caseId, (c) => ({
        ...c,
        settlement: { lineItems, netPayable, status: "Processing", computedOn: new Date().toISOString().slice(0, 10) },
      }));
      logOffboardingAudit({ caseId, employeeName: record.employee, action: "settlement_computed", actorName: currentUser.name, detail: `F&F settlement computed — net payable ₹${netPayable.toLocaleString("en-IN")}` });
      return { ok: true, message: `Settlement computed — net payable ₹${netPayable.toLocaleString("en-IN")}.` };
    },
    [canManage, currentUser.name, mutateCase],
  );

  const addSettlementLineItem = useCallback(
    (caseId: string, label: string, type: FnFLineItem["type"], amount: number): ActionResult => {
      if (!canManage) return { ok: false, message: "You're not authorized to edit the F&F settlement." };
      if (!label.trim() || amount <= 0) return { ok: false, message: "Enter a label and a positive amount." };
      const record = separationCasesStore.getSnapshot().find((c) => c.id === caseId);
      if (!record) return { ok: false, message: "Separation case not found." };
      if (record.settlement.status === "Paid") return { ok: false, message: "This settlement has already been paid." };

      mutateCase(caseId, (c) => {
        const lineItems = [...c.settlement.lineItems, { id: `fnf-${Date.now()}`, label: label.trim(), type, amount, autoComputed: false }];
        const netPayable = lineItems.reduce((sum, li) => sum + (li.type === "Earning" ? li.amount : -li.amount), 0);
        return { ...c, settlement: { ...c.settlement, lineItems, netPayable, status: c.settlement.status === "Pending" ? "Processing" : c.settlement.status } };
      });
      return { ok: true, message: "Line item added to the settlement." };
    },
    [canManage, mutateCase],
  );

  const markSettlementPaid = useCallback(
    (caseId: string, reference: string): ActionResult => {
      if (!canManage) return { ok: false, message: "You're not authorized to mark the settlement as paid." };
      const record = separationCasesStore.getSnapshot().find((c) => c.id === caseId);
      if (!record) return { ok: false, message: "Separation case not found." };
      if (record.settlement.status !== "Processing") return { ok: false, message: "Compute the settlement before marking it paid." };
      if (!reference.trim()) return { ok: false, message: "A payment reference is required." };

      mutateCase(caseId, (c) => ({ ...c, settlement: { ...c.settlement, status: "Paid", paidOn: new Date().toISOString().slice(0, 10), reference: reference.trim() } }));
      logOffboardingAudit({ caseId, employeeName: record.employee, action: "settlement_paid", actorName: currentUser.name, detail: `F&F settlement paid — ref ${reference.trim()}` });
      return { ok: true, message: "Settlement marked as paid." };
    },
    [canManage, currentUser.name, mutateCase],
  );

  const advanceLetterStatus = useCallback(
    (caseId: string, letter: "relieving" | "experience"): ActionResult => {
      if (!canManage) return { ok: false, message: "You're not authorized to generate documents." };
      const record = separationCasesStore.getSnapshot().find((c) => c.id === caseId);
      if (!record) return { ok: false, message: "Separation case not found." };
      const field = letter === "relieving" ? "relievingLetterStatus" : "experienceLetterStatus";
      const current = record[field];
      const next: LetterStatus = current === "Not Generated" ? "Generated" : current === "Generated" ? "Sent" : "Sent";
      if (current === "Sent") return { ok: false, message: "This letter has already been sent." };

      mutateCase(caseId, (c) => ({ ...c, [field]: next }));
      logOffboardingAudit({
        caseId,
        employeeName: record.employee,
        action: "document_generated",
        actorName: currentUser.name,
        detail: `${letter === "relieving" ? "Relieving" : "Experience"} letter ${next.toLowerCase()}`,
      });
      return { ok: true, message: `${letter === "relieving" ? "Relieving" : "Experience"} letter ${next.toLowerCase()}.` };
    },
    [canManage, currentUser.name, mutateCase],
  );

  const completeOffboarding = useCallback(
    (caseId: string): ActionResult => {
      if (!canManage) return { ok: false, message: "You're not authorized to complete offboarding." };
      const record = separationCasesStore.getSnapshot().find((c) => c.id === caseId);
      if (!record) return { ok: false, message: "Separation case not found." };
      if (record.status === "Completed") return { ok: false, message: "This case is already completed." };
      if (!allCleared(record)) return { ok: false, message: "All clearance items must be Cleared first." };
      if (record.settlement.status !== "Paid") return { ok: false, message: "The full & final settlement must be paid first." };

      mutateCase(caseId, (c) => ({ ...c, status: "Completed", completedOn: new Date().toISOString().slice(0, 10) }));
      logOffboardingAudit({ caseId, employeeName: record.employee, action: "completed", actorName: currentUser.name, detail: "Offboarding completed" });
      return { ok: true, message: `Offboarding completed for ${record.employee}.` };
    },
    [canManage, currentUser.name, mutateCase],
  );

  const value = useMemo<OffboardingContextValue>(
    () => ({
      cases,
      auditEntries,
      canManage,
      visibleCases,
      caseById,
      auditFor,
      initiateSeparation,
      approveSeparation,
      rejectSeparation,
      withdrawResignation,
      updateClearanceItem,
      scheduleExitInterview,
      submitExitInterviewFeedback,
      computeSettlement,
      addSettlementLineItem,
      markSettlementPaid,
      advanceLetterStatus,
      completeOffboarding,
    }),
    [
      cases,
      auditEntries,
      canManage,
      visibleCases,
      caseById,
      auditFor,
      initiateSeparation,
      approveSeparation,
      rejectSeparation,
      withdrawResignation,
      updateClearanceItem,
      scheduleExitInterview,
      submitExitInterviewFeedback,
      computeSettlement,
      addSettlementLineItem,
      markSettlementPaid,
      advanceLetterStatus,
      completeOffboarding,
    ],
  );

  return <OffboardingContext.Provider value={value}>{children}</OffboardingContext.Provider>;
}

export function useOffboarding() {
  const ctx = useContext(OffboardingContext);
  if (!ctx) throw new Error("useOffboarding must be used within an OffboardingProvider");
  return ctx;
}

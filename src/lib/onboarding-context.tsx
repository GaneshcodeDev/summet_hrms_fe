"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { logOnboardingAudit, onboardingAuditStore, onboardingCasesStore } from "@/lib/onboarding-store";
import { onboardingDocumentTemplates, onboardingTaskTemplates } from "@/lib/onboarding-data";
import { useAccessControl } from "@/lib/access-control-context";
import { useEmployees } from "@/lib/employee-context";
import { usePayroll } from "@/lib/payroll-context";
import { useSite } from "@/lib/site-context";
import { applicationsStore, logRecruitmentAudit } from "@/lib/recruitment-store";
import type {
  DocumentStatus,
  OnboardingAuditEntry,
  OnboardingCase,
  OnboardingDocument,
  OnboardingTask,
  OnboardingTaskStatus,
  SalaryLine,
} from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

interface CreateCaseInput {
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  designation: string;
  department: string;
  siteId: string;
  buddyId?: string;
  joiningDate: string;
  /**
   * Set when this case originated from an accepted Recruitment Offer (see
   * recruitment-context.tsx's acceptOffer) — carries everything
   * completeOnboarding needs to create a real, fully-mapped Employee record
   * without a second, parallel data entry step. All optional: a case HR
   * creates by hand today (the "New Joiner" form) simply omits them, and
   * Employee creation falls back to the plain designation/department text.
   */
  recruitmentApplicationId?: string;
  departmentId?: string;
  subDepartmentId?: string;
  designationId?: string;
  gradeId?: string;
  employmentTypeId?: string;
  employeeTypeId?: string;
  reportingManagerId?: string;
  probationPeriodMonths?: number;
  offerCtcAnnual?: number;
  offerEarnings?: SalaryLine[];
  offerDeductions?: SalaryLine[];
}

interface OnboardingContextValue {
  cases: OnboardingCase[];
  auditEntries: OnboardingAuditEntry[];
  canManage: boolean;
  visibleCases: () => OnboardingCase[];
  caseById: (id: string) => OnboardingCase | undefined;
  auditFor: (caseId: string) => OnboardingAuditEntry[];
  progressFor: (c: OnboardingCase) => number;
  canActOnTask: (c: OnboardingCase, task: OnboardingTask) => boolean;
  canActOnDocuments: (c: OnboardingCase) => boolean;
  createCase: (input: CreateCaseInput) => ActionResult;
  updateTaskStatus: (caseId: string, taskId: string, status: OnboardingTaskStatus, note?: string) => ActionResult;
  uploadDocument: (caseId: string, docId: string, fileName: string) => ActionResult;
  verifyDocument: (caseId: string, docId: string, status: DocumentStatus, reason?: string) => ActionResult;
  sendForSignature: (caseId: string, docId: string) => ActionResult;
  markSigned: (caseId: string, docId: string) => ActionResult;
  completeOnboarding: (caseId: string) => Promise<ActionResult>;
  cancelOnboarding: (caseId: string, reason: string) => ActionResult;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

function mandatoryTasksDone(c: OnboardingCase) {
  return c.tasks.filter((t) => t.mandatory).every((t) => t.status === "Completed");
}

function mandatoryDocsCleared(c: OnboardingCase) {
  return c.documents
    .filter((d) => d.docType !== "Previous Employment Relieving Letter")
    .every((d) => d.status === "Verified" && (d.signatureStatus === "Not Required" || d.signatureStatus === "Signed"));
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { currentUser, canFeature } = useAccessControl();
  const { createEmployee } = useEmployees();
  const { saveSalaryStructure } = usePayroll();
  const { sites } = useSite();

  const cases = useSyncExternalStore(
    onboardingCasesStore.subscribe,
    onboardingCasesStore.getSnapshot,
    onboardingCasesStore.getServerSnapshot,
  );
  const auditEntries = useSyncExternalStore(
    onboardingAuditStore.subscribe,
    onboardingAuditStore.getSnapshot,
    onboardingAuditStore.getServerSnapshot,
  );

  const canManage = canFeature("onboarding.cases", "edit") || canFeature("onboarding.cases", "manage");
  const canCreate = canFeature("onboarding.cases", "create") || canManage;

  const visibleCases = useCallback(() => {
    if (canManage) return cases;
    return cases.filter((c) => c.employeeId === currentUser.employeeId || c.buddyId === currentUser.employeeId);
  }, [cases, canManage, currentUser.employeeId]);

  const caseById = useCallback((id: string) => cases.find((c) => c.id === id), [cases]);
  const auditFor = useCallback(
    (caseId: string) => auditEntries.filter((e) => e.caseId === caseId),
    [auditEntries],
  );

  const progressFor = useCallback((c: OnboardingCase) => {
    if (c.tasks.length === 0) return 0;
    const done = c.tasks.filter((t) => t.status === "Completed").length;
    return Math.round((done / c.tasks.length) * 100);
  }, []);

  const canActOnTask = useCallback(
    (c: OnboardingCase, task: OnboardingTask) => {
      if (canManage) return true;
      if (task.category === "Employee") return c.employeeId === currentUser.employeeId;
      if (task.category === "Manager") return c.buddyId === currentUser.employeeId;
      return false;
    },
    [canManage, currentUser.employeeId],
  );

  const canActOnDocuments = useCallback(
    (c: OnboardingCase) => canManage || c.employeeId === currentUser.employeeId || c.buddyId === currentUser.employeeId,
    [canManage, currentUser.employeeId],
  );

  const mutateCase = useCallback((caseId: string, fn: (c: OnboardingCase) => OnboardingCase) => {
    onboardingCasesStore.set(onboardingCasesStore.getSnapshot().map((c) => (c.id === caseId ? fn(c) : c)));
  }, []);

  const createCase = useCallback(
    (input: CreateCaseInput): ActionResult => {
      if (!canCreate) return { ok: false, message: "You're not authorized to create onboarding cases." };
      if (!input.candidateName.trim()) return { ok: false, message: "Candidate name is required." };
      const id = `ob-${Date.now().toString(36)}`;
      const now = new Date().toISOString().slice(0, 10);
      const record: OnboardingCase = {
        id,
        candidateName: input.candidateName,
        candidateEmail: input.candidateEmail,
        candidatePhone: input.candidatePhone,
        designation: input.designation,
        department: input.department,
        siteId: input.siteId,
        buddyId: input.buddyId,
        joiningDate: input.joiningDate,
        status: "Pre-boarding",
        createdOn: now,
        recruitmentApplicationId: input.recruitmentApplicationId,
        departmentId: input.departmentId,
        subDepartmentId: input.subDepartmentId,
        designationId: input.designationId,
        gradeId: input.gradeId,
        employmentTypeId: input.employmentTypeId,
        employeeTypeId: input.employeeTypeId,
        reportingManagerId: input.reportingManagerId,
        probationPeriodMonths: input.probationPeriodMonths,
        offerCtcAnnual: input.offerCtcAnnual,
        offerEarnings: input.offerEarnings,
        offerDeductions: input.offerDeductions,
        tasks: onboardingTaskTemplates.map((t) => ({
          id: `${id}-${t.id}`,
          title: t.title,
          category: t.category,
          mandatory: t.mandatory,
          status: "Pending",
        })),
        documents: onboardingDocumentTemplates.map((d) => ({
          id: `${id}-${d.id}`,
          docType: d.docType,
          status: "Pending",
          signatureStatus: d.requiresSignature ? "Not Sent" : "Not Required",
        })),
      };
      onboardingCasesStore.set([record, ...onboardingCasesStore.getSnapshot()]);
      logOnboardingAudit({
        caseId: id,
        candidateName: input.candidateName,
        action: "created",
        actorName: currentUser.name,
        detail: `Onboarding case created for ${input.designation}, joining ${input.joiningDate}`,
      });
      return { ok: true, message: `Onboarding case created for ${input.candidateName}.` };
    },
    [canCreate, currentUser.name],
  );

  const updateTaskStatus = useCallback(
    (caseId: string, taskId: string, status: OnboardingTaskStatus, note?: string): ActionResult => {
      const record = onboardingCasesStore.getSnapshot().find((c) => c.id === caseId);
      if (!record) return { ok: false, message: "Onboarding case not found." };
      const task = record.tasks.find((t) => t.id === taskId);
      if (!task) return { ok: false, message: "Task not found." };
      if (!canActOnTask(record, task)) return { ok: false, message: "You're not authorized to update this task." };

      mutateCase(caseId, (c) => ({
        ...c,
        status: c.status === "Pre-boarding" ? "In Progress" : c.status,
        tasks: c.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status,
                note: note?.trim() || t.note,
                completedBy: status === "Completed" ? currentUser.name : undefined,
                completedOn: status === "Completed" ? new Date().toISOString().slice(0, 10) : undefined,
              }
            : t,
        ),
      }));
      logOnboardingAudit({
        caseId,
        candidateName: record.candidateName,
        action: "task_updated",
        actorName: currentUser.name,
        detail: `${task.title} marked ${status}`,
      });
      return { ok: true, message: `${task.title} marked ${status}.` };
    },
    [canActOnTask, currentUser.name, mutateCase],
  );

  const uploadDocument = useCallback(
    (caseId: string, docId: string, fileName: string): ActionResult => {
      const record = onboardingCasesStore.getSnapshot().find((c) => c.id === caseId);
      if (!record) return { ok: false, message: "Onboarding case not found." };
      if (!canActOnDocuments(record)) return { ok: false, message: "You're not authorized to upload documents here." };
      if (!fileName.trim()) return { ok: false, message: "Choose a file to upload." };
      const doc = record.documents.find((d) => d.id === docId);
      if (!doc) return { ok: false, message: "Document not found." };

      mutateCase(caseId, (c) => ({
        ...c,
        documents: c.documents.map((d) =>
          d.id === docId
            ? { ...d, status: "Uploaded", fileName, uploadedOn: new Date().toISOString().slice(0, 10), verifiedBy: undefined, verifiedOn: undefined, rejectionReason: undefined }
            : d,
        ),
      }));
      logOnboardingAudit({
        caseId,
        candidateName: record.candidateName,
        action: "document_uploaded",
        actorName: currentUser.name,
        detail: `${doc.docType} uploaded (${fileName})`,
      });
      return { ok: true, message: `${doc.docType} uploaded.` };
    },
    [canActOnDocuments, currentUser.name, mutateCase],
  );

  const verifyDocument = useCallback(
    (caseId: string, docId: string, status: DocumentStatus, reason?: string): ActionResult => {
      if (!canManage) return { ok: false, message: "You're not authorized to verify documents." };
      const record = onboardingCasesStore.getSnapshot().find((c) => c.id === caseId);
      if (!record) return { ok: false, message: "Onboarding case not found." };
      const doc = record.documents.find((d) => d.id === docId);
      if (!doc) return { ok: false, message: "Document not found." };
      if (doc.status !== "Uploaded") return { ok: false, message: "Only uploaded documents can be verified." };
      if (status === "Rejected" && !reason?.trim()) return { ok: false, message: "A reason is required to reject a document." };

      mutateCase(caseId, (c) => ({
        ...c,
        documents: c.documents.map((d) =>
          d.id === docId
            ? { ...d, status, verifiedBy: currentUser.name, verifiedOn: new Date().toISOString().slice(0, 10), rejectionReason: status === "Rejected" ? reason?.trim() : undefined }
            : d,
        ),
      }));
      logOnboardingAudit({
        caseId,
        candidateName: record.candidateName,
        action: status === "Verified" ? "document_verified" : "document_rejected",
        actorName: currentUser.name,
        detail: status === "Verified" ? `${doc.docType} verified` : `${doc.docType} rejected — ${reason}`,
      });
      return { ok: true, message: status === "Verified" ? `${doc.docType} verified.` : `${doc.docType} rejected.` };
    },
    [canManage, currentUser.name, mutateCase],
  );

  const sendForSignature = useCallback(
    (caseId: string, docId: string): ActionResult => {
      if (!canManage) return { ok: false, message: "You're not authorized to send documents for signature." };
      const record = onboardingCasesStore.getSnapshot().find((c) => c.id === caseId);
      if (!record) return { ok: false, message: "Onboarding case not found." };
      const doc = record.documents.find((d) => d.id === docId);
      if (!doc) return { ok: false, message: "Document not found." };
      if (doc.signatureStatus === "Not Required") return { ok: false, message: "This document doesn't require a signature." };

      mutateCase(caseId, (c) => ({
        ...c,
        documents: c.documents.map((d) => (d.id === docId ? { ...d, signatureStatus: "Sent" } : d)),
      }));
      logOnboardingAudit({
        caseId,
        candidateName: record.candidateName,
        action: "signature_sent",
        actorName: currentUser.name,
        detail: `${doc.docType} sent for e-signature`,
      });
      return { ok: true, message: `${doc.docType} sent for signature.` };
    },
    [canManage, currentUser.name, mutateCase],
  );

  const markSigned = useCallback(
    (caseId: string, docId: string): ActionResult => {
      const record = onboardingCasesStore.getSnapshot().find((c) => c.id === caseId);
      if (!record) return { ok: false, message: "Onboarding case not found." };
      if (!(canManage || record.employeeId === currentUser.employeeId)) {
        return { ok: false, message: "Only the signer or HR can confirm this signature." };
      }
      const doc = record.documents.find((d) => d.id === docId);
      if (!doc) return { ok: false, message: "Document not found." };
      if (doc.signatureStatus !== "Sent" && doc.signatureStatus !== "Viewed") {
        return { ok: false, message: "This document hasn't been sent for signature yet." };
      }

      mutateCase(caseId, (c) => ({
        ...c,
        documents: c.documents.map((d) =>
          d.id === docId ? { ...d, signatureStatus: "Signed", signedOn: new Date().toISOString().slice(0, 10) } : d,
        ),
      }));
      logOnboardingAudit({
        caseId,
        candidateName: record.candidateName,
        action: "signature_signed",
        actorName: currentUser.name,
        detail: `${doc.docType} signed`,
      });
      return { ok: true, message: `${doc.docType} signed.` };
    },
    [canManage, currentUser.employeeId, currentUser.name, mutateCase],
  );

  const completeOnboarding = useCallback(
    async (caseId: string): Promise<ActionResult> => {
      if (!canManage) return { ok: false, message: "You're not authorized to complete onboarding." };
      const record = onboardingCasesStore.getSnapshot().find((c) => c.id === caseId);
      if (!record) return { ok: false, message: "Onboarding case not found." };
      if (record.status === "Completed") return { ok: false, message: "This case is already completed." };
      if (!mandatoryTasksDone(record)) return { ok: false, message: "All mandatory checklist tasks must be completed first." };
      if (!mandatoryDocsCleared(record)) return { ok: false, message: "All mandatory documents must be verified (and signed, where required) first." };

      // This is the real Employee Store — completeOnboarding is the one place
      // an onboarding case ever produces a headcount hire; there is no
      // parallel/second Employee model anywhere in Onboarding or Recruitment.
      // A case that already carries an employeeId (e.g. one HR hand-linked
      // outside this flow) is left as-is rather than creating a duplicate.
      let employeeId = record.employeeId;
      let salaryWarning: string | undefined;
      if (!employeeId) {
        const created = await createEmployee({
          name: record.candidateName,
          email: record.candidateEmail,
          phone: record.candidatePhone,
          department: record.department,
          designation: record.designation,
          location: sites.find((s) => s.id === record.siteId)?.name ?? "",
          siteId: record.siteId,
          dateOfJoining: record.joiningDate,
          departmentId: record.departmentId,
          subDepartmentId: record.subDepartmentId,
          designationId: record.designationId,
          gradeId: record.gradeId,
          employmentTypeId: record.employmentTypeId,
          employeeTypeId: record.employeeTypeId,
          reportingManagerId: record.reportingManagerId,
          employmentStage: "Probation",
          probationPeriodMonths: record.probationPeriodMonths,
        });
        if (!created.ok || !created.employee) {
          return { ok: false, message: `Could not create the employee record: ${created.message}` };
        }
        employeeId = created.employee.employeeId;

        if (record.offerCtcAnnual && record.offerEarnings && record.offerDeductions) {
          const salaryResult = saveSalaryStructure({
            employeeId,
            siteId: record.siteId,
            ctcAnnual: record.offerCtcAnnual,
            earnings: record.offerEarnings,
            deductions: record.offerDeductions,
            effectiveFrom: record.joiningDate,
            reason: "New hire — offer salary",
          });
          if (!salaryResult.ok) salaryWarning = ` Salary structure could not be set automatically: ${salaryResult.message}`;
        }

        if (record.recruitmentApplicationId) {
          const application = applicationsStore.getSnapshot().find((a) => a.id === record.recruitmentApplicationId);
          if (application && application.stage !== "Hired" && application.stage !== "Rejected" && application.stage !== "Withdrawn") {
            applicationsStore.set(applicationsStore.getSnapshot().map((a) => (a.id === application.id ? { ...a, stage: "Hired" } : a)));
            logRecruitmentAudit({
              recordType: "Application",
              recordId: application.id,
              siteId: application.siteId,
              action: "stage_changed",
              actorName: currentUser.name,
              detail: `Offer Accepted -> Hired (Employee ${employeeId} created)`,
            });
          }
        }
      }

      mutateCase(caseId, (c) => ({ ...c, status: "Completed", completedOn: new Date().toISOString().slice(0, 10), employeeId }));
      logOnboardingAudit({
        caseId,
        candidateName: record.candidateName,
        action: "completed",
        actorName: currentUser.name,
        detail: `Onboarding completed — Employee ${employeeId} created`,
      });
      return { ok: true, message: `Onboarding completed for ${record.candidateName} — created as ${employeeId}.${salaryWarning ?? ""}` };
    },
    [canManage, createEmployee, saveSalaryStructure, sites, currentUser.name, mutateCase],
  );

  const cancelOnboarding = useCallback(
    (caseId: string, reason: string): ActionResult => {
      if (!canManage) return { ok: false, message: "You're not authorized to cancel onboarding." };
      if (!reason.trim()) return { ok: false, message: "A reason is required to cancel onboarding." };
      const record = onboardingCasesStore.getSnapshot().find((c) => c.id === caseId);
      if (!record) return { ok: false, message: "Onboarding case not found." };

      mutateCase(caseId, (c) => ({ ...c, status: "Cancelled", cancelledReason: reason.trim() }));
      logOnboardingAudit({
        caseId,
        candidateName: record.candidateName,
        action: "cancelled",
        actorName: currentUser.name,
        detail: `Onboarding cancelled — ${reason.trim()}`,
      });
      return { ok: true, message: `Onboarding cancelled for ${record.candidateName}.` };
    },
    [canManage, currentUser.name, mutateCase],
  );

  const value = useMemo<OnboardingContextValue>(
    () => ({
      cases,
      auditEntries,
      canManage,
      visibleCases,
      caseById,
      auditFor,
      progressFor,
      canActOnTask,
      canActOnDocuments,
      createCase,
      updateTaskStatus,
      uploadDocument,
      verifyDocument,
      sendForSignature,
      markSigned,
      completeOnboarding,
      cancelOnboarding,
    }),
    [
      cases,
      auditEntries,
      canManage,
      visibleCases,
      caseById,
      auditFor,
      progressFor,
      canActOnTask,
      canActOnDocuments,
      createCase,
      updateTaskStatus,
      uploadDocument,
      verifyDocument,
      sendForSignature,
      markSigned,
      completeOnboarding,
      cancelOnboarding,
    ],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within an OnboardingProvider");
  return ctx;
}

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
  applicationsStore,
  candidatesStore,
  findCandidateByEmailOrPhone,
  interviewsStore,
  jobOpeningsStore,
  jobRequisitionsStore,
  logRecruitmentAudit,
  nextApplicationId,
  nextCandidateId,
  nextInterviewId,
  nextJobOpeningId,
  nextOfferId,
  nextRequisitionId,
  offersStore,
  recruitmentAuditStore,
} from "@/lib/recruitment-store";
import { canTransitionStage, resolveRequisitionWorkflowSteps } from "@/lib/recruitment-engine";
import { useAccessControl } from "@/lib/access-control-context";
import { useApprovals } from "@/lib/approval-context";
import { useOnboarding } from "@/lib/onboarding-context";
import { useOrg } from "@/lib/org-context";
import { useMasters } from "@/lib/master-context";
import type {
  Application,
  ApplicationStage,
  Candidate,
  Interview,
  InterviewFeedback,
  InterviewMode,
  JobOpening,
  JobOpeningStatus,
  JobRequisition,
  Offer,
  RecruitmentAuditEntry,
  RequisitionPriority,
  SalaryLine,
} from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

interface CreateRequisitionInput {
  siteId: string;
  departmentId?: string;
  subDepartmentId?: string;
  designationId?: string;
  gradeId?: string;
  employmentTypeId?: string;
  employeeTypeId?: string;
  positions: number;
  hiringManagerId?: string;
  requiredSkills?: string[];
  minExperienceYears?: number;
  maxExperienceYears?: number;
  salaryRangeMin?: number;
  salaryRangeMax?: number;
  priority: RequisitionPriority;
  targetJoiningDate?: string;
  reasonForHiring: string;
}

interface CreateJobOpeningInput {
  requisitionId?: string;
  siteId: string;
  departmentId?: string;
  designationId?: string;
  employmentTypeId?: string;
  title: string;
  description?: string;
  requiredSkills?: string[];
  minExperienceYears?: number;
  maxExperienceYears?: number;
  salaryRangeMin?: number;
  salaryRangeMax?: number;
  location: string;
  openings: number;
}

interface CandidateInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  dateOfBirth?: string;
  location?: string;
  currentCompany?: string;
  currentDesignation?: string;
  totalExperienceYears?: number;
  relevantExperienceYears?: number;
  currentSalary?: number;
  expectedSalary?: number;
  noticePeriodDays?: number;
  skills?: string[];
  resumeFileName?: string;
  sourceId?: string;
  siteId: string;
}

interface ScheduleInterviewInput {
  applicationId: string;
  round: number;
  roundLabel: string;
  interviewerIds: string[];
  scheduledDate: string;
  scheduledTime: string;
  mode: InterviewMode;
  locationOrLink?: string;
}

interface CreateOfferInput {
  applicationId: string;
  designationId?: string;
  departmentId?: string;
  employmentTypeId?: string;
  joiningDate: string;
  ctcAnnual: number;
  earnings: SalaryLine[];
  deductions: SalaryLine[];
  probationPeriodMonths?: number;
  offerDate: string;
  expiryDate?: string;
}

interface RecruitmentContextValue {
  requisitions: JobRequisition[];
  jobOpenings: JobOpening[];
  candidates: Candidate[];
  applications: Application[];
  interviews: Interview[];
  offers: Offer[];
  auditEntries: RecruitmentAuditEntry[];

  canCreateRequisitions: boolean;
  canManageRequisitions: boolean;
  canManageOpenings: boolean;
  canManagePipeline: boolean;

  visibleRequisitions: () => JobRequisition[];

  createRequisition: (input: CreateRequisitionInput) => ActionResult & { requisition?: JobRequisition };
  decideRequisition: (requisitionId: string, action: "APPROVE" | "REJECT" | "CANCEL", comment?: string) => ActionResult;
  canDecideRequisition: (requisitionId: string) => boolean;

  createJobOpening: (input: CreateJobOpeningInput) => ActionResult & { jobOpening?: JobOpening };
  setJobOpeningStatus: (jobOpeningId: string, status: JobOpeningStatus) => ActionResult;

  applicationsForOpening: (jobOpeningId: string) => Application[];
  candidateFor: (candidateId: string) => Candidate | undefined;
  openingFor: (jobOpeningId: string) => JobOpening | undefined;

  applyToJob: (candidate: CandidateInput, jobOpeningId: string, recruiterId?: string) => ActionResult & { application?: Application; candidate?: Candidate };
  moveApplicationStage: (applicationId: string, toStage: ApplicationStage) => ActionResult;
  rejectApplication: (applicationId: string, reason: string) => ActionResult;
  withdrawApplication: (applicationId: string, reason: string) => ActionResult;

  interviewsForApplication: (applicationId: string) => Interview[];
  canActOnInterview: (interview: Interview) => boolean;
  scheduleInterview: (input: ScheduleInterviewInput) => ActionResult;
  submitInterviewFeedback: (interviewId: string, feedback: Omit<InterviewFeedback, "submittedBy" | "submittedOn">) => ActionResult;
  cancelInterview: (interviewId: string) => ActionResult;

  offersForApplication: (applicationId: string) => Offer[];
  createOffer: (input: CreateOfferInput) => ActionResult & { offer?: Offer };
  sendOffer: (offerId: string) => ActionResult;
  acceptOffer: (offerId: string) => ActionResult;
  rejectOffer: (offerId: string, reason: string) => ActionResult;
  expireOffer: (offerId: string) => ActionResult;
  withdrawOffer: (offerId: string, reason: string) => ActionResult;

  auditFor: (recordType: RecruitmentAuditEntry["recordType"], recordId: string) => RecruitmentAuditEntry[];
}

const RecruitmentContext = createContext<RecruitmentContextValue | undefined>(undefined);

export function RecruitmentProvider({ children }: { children: ReactNode }) {
  const { currentUser, canFeature } = useAccessControl();
  const { createInstance, instanceFor, act, canAct } = useApprovals();
  const { createCase } = useOnboarding();
  const { orgUnits } = useOrg();
  const { records: masterRecords } = useMasters();

  const requisitions = useSyncExternalStore(jobRequisitionsStore.subscribe, jobRequisitionsStore.getSnapshot, jobRequisitionsStore.getServerSnapshot);
  const jobOpenings = useSyncExternalStore(jobOpeningsStore.subscribe, jobOpeningsStore.getSnapshot, jobOpeningsStore.getServerSnapshot);
  const candidates = useSyncExternalStore(candidatesStore.subscribe, candidatesStore.getSnapshot, candidatesStore.getServerSnapshot);
  const applications = useSyncExternalStore(applicationsStore.subscribe, applicationsStore.getSnapshot, applicationsStore.getServerSnapshot);
  const interviews = useSyncExternalStore(interviewsStore.subscribe, interviewsStore.getSnapshot, interviewsStore.getServerSnapshot);
  const offers = useSyncExternalStore(offersStore.subscribe, offersStore.getSnapshot, offersStore.getServerSnapshot);
  const auditEntries = useSyncExternalStore(recruitmentAuditStore.subscribe, recruitmentAuditStore.getSnapshot, recruitmentAuditStore.getServerSnapshot);

  const canCreateRequisitions = canFeature("recruitment.requisitions", "create") || canFeature("recruitment.requisitions", "manage");
  const canManageRequisitions = canFeature("recruitment.requisitions", "edit") || canFeature("recruitment.requisitions", "manage");
  const canManageOpenings = canFeature("recruitment.openings", "create") || canFeature("recruitment.openings", "edit") || canFeature("recruitment.openings", "manage");
  const canManagePipeline = canFeature("recruitment.pipeline", "create") || canFeature("recruitment.pipeline", "edit") || canFeature("recruitment.pipeline", "manage");

  // A Hiring Manager without broad requisition rights only sees requisitions
  // they raised or are the named hiring manager for — same visibleCases()
  // pattern onboarding-context.tsx already uses for buddy/employee scoping.
  const visibleRequisitions = useCallback(() => {
    if (canManageRequisitions || canCreateRequisitions) return requisitions;
    return requisitions.filter((r) => r.requestedBy === currentUser.employeeId || r.hiringManagerId === currentUser.employeeId);
  }, [requisitions, canManageRequisitions, canCreateRequisitions, currentUser.employeeId]);

  const auditFor = useCallback(
    (recordType: RecruitmentAuditEntry["recordType"], recordId: string) =>
      auditEntries.filter((e) => e.recordType === recordType && e.recordId === recordId),
    [auditEntries],
  );

  /* ------------------------------------------------------------- */
  /* Requisitions — gated by the Phase 9 Approval Engine, no second */
  /* approval architecture (AGENTS.md Phase 11 section 4).          */
  /* ------------------------------------------------------------- */

  const createRequisition = useCallback(
    (input: CreateRequisitionInput): ActionResult & { requisition?: JobRequisition } => {
      if (!canCreateRequisitions) return { ok: false, message: "You're not authorized to raise job requisitions." };
      if (!input.positions || input.positions < 1) return { ok: false, message: "At least one position is required." };
      if (!input.reasonForHiring.trim()) return { ok: false, message: "A reason for hiring is required." };

      const id = nextRequisitionId();
      const requisition: JobRequisition = {
        id,
        siteId: input.siteId,
        departmentId: input.departmentId,
        subDepartmentId: input.subDepartmentId,
        designationId: input.designationId,
        gradeId: input.gradeId,
        employmentTypeId: input.employmentTypeId,
        employeeTypeId: input.employeeTypeId,
        positions: input.positions,
        hiringManagerId: input.hiringManagerId,
        requiredSkills: input.requiredSkills,
        minExperienceYears: input.minExperienceYears,
        maxExperienceYears: input.maxExperienceYears,
        salaryRangeMin: input.salaryRangeMin,
        salaryRangeMax: input.salaryRangeMax,
        priority: input.priority,
        targetJoiningDate: input.targetJoiningDate,
        reasonForHiring: input.reasonForHiring.trim(),
        status: "Pending Approval",
        requestedBy: currentUser.employeeId,
        requestedByName: currentUser.name,
        createdOn: new Date().toISOString().slice(0, 10),
      };
      jobRequisitionsStore.set([requisition, ...jobRequisitionsStore.getSnapshot()]);
      createInstance({ siteId: input.siteId, module: "Requisition", recordId: id, steps: resolveRequisitionWorkflowSteps() });
      logRecruitmentAudit({
        recordType: "Requisition",
        recordId: id,
        siteId: input.siteId,
        action: "requisition_created",
        actorName: currentUser.name,
        detail: `Requisition raised for ${input.positions} position(s)`,
      });
      return { ok: true, message: `Requisition ${id} raised and sent for approval.`, requisition };
    },
    [canCreateRequisitions, currentUser.employeeId, currentUser.name, createInstance],
  );

  const canDecideRequisition = useCallback(
    (requisitionId: string) => {
      const instance = instanceFor("Requisition", requisitionId);
      return Boolean(instance && canAct(instance, "recruitment.requisitions"));
    },
    [instanceFor, canAct],
  );

  const decideRequisition = useCallback(
    (requisitionId: string, action: "APPROVE" | "REJECT" | "CANCEL", comment?: string): ActionResult => {
      const requisition = jobRequisitionsStore.getSnapshot().find((r) => r.id === requisitionId);
      if (!requisition) return { ok: false, message: "Requisition not found." };
      const result = act("Requisition", requisitionId, action, "recruitment.requisitions", comment);
      if (!result.ok) return result;
      if (result.completed && result.finalStatus) {
        const status = result.finalStatus === "Approved" ? "Approved" : result.finalStatus === "Rejected" ? "Rejected" : "Cancelled";
        jobRequisitionsStore.set(jobRequisitionsStore.getSnapshot().map((r) => (r.id === requisitionId ? { ...r, status } : r)));
        logRecruitmentAudit({
          recordType: "Requisition",
          recordId: requisitionId,
          siteId: requisition.siteId,
          action: status === "Approved" ? "requisition_approved" : status === "Rejected" ? "requisition_rejected" : "requisition_cancelled",
          actorName: currentUser.name,
          detail: comment || `Requisition ${status.toLowerCase()}`,
        });
      }
      return result;
    },
    [act, currentUser.name],
  );

  /* ------------------------------------------------------------- */
  /* Job Openings — an approved Requisition can open one; smaller    */
  /* orgs may also open directly without a Requisition (section 1). */
  /* ------------------------------------------------------------- */

  const createJobOpening = useCallback(
    (input: CreateJobOpeningInput): ActionResult & { jobOpening?: JobOpening } => {
      if (!canManageOpenings) return { ok: false, message: "You're not authorized to create job openings." };
      if (input.requisitionId) {
        const requisition = jobRequisitionsStore.getSnapshot().find((r) => r.id === input.requisitionId);
        if (!requisition) return { ok: false, message: "Requisition not found." };
        if (requisition.status !== "Approved") return { ok: false, message: "Only an approved requisition can be opened." };
      }
      const id = nextJobOpeningId();
      const jobOpening: JobOpening = {
        id,
        requisitionId: input.requisitionId,
        siteId: input.siteId,
        departmentId: input.departmentId,
        designationId: input.designationId,
        employmentTypeId: input.employmentTypeId,
        title: input.title.trim(),
        description: input.description,
        requiredSkills: input.requiredSkills,
        minExperienceYears: input.minExperienceYears,
        maxExperienceYears: input.maxExperienceYears,
        salaryRangeMin: input.salaryRangeMin,
        salaryRangeMax: input.salaryRangeMax,
        location: input.location,
        openings: input.openings || 1,
        status: "Open",
        openDate: new Date().toISOString().slice(0, 10),
        createdBy: currentUser.name,
        createdOn: new Date().toISOString().slice(0, 10),
      };
      jobOpeningsStore.set([jobOpening, ...jobOpeningsStore.getSnapshot()]);
      logRecruitmentAudit({
        recordType: "Opening",
        recordId: id,
        siteId: input.siteId,
        action: "opening_created",
        actorName: currentUser.name,
        detail: `${jobOpening.title} opened (${jobOpening.openings} position(s))`,
      });
      return { ok: true, message: `Job opening ${id} created.`, jobOpening };
    },
    [canManageOpenings, currentUser.name],
  );

  const setJobOpeningStatus = useCallback(
    (jobOpeningId: string, status: JobOpeningStatus): ActionResult => {
      if (!canManageOpenings) return { ok: false, message: "You're not authorized to update job openings." };
      const opening = jobOpeningsStore.getSnapshot().find((j) => j.id === jobOpeningId);
      if (!opening) return { ok: false, message: "Job opening not found." };
      jobOpeningsStore.set(
        jobOpeningsStore.getSnapshot().map((j) => (j.id === jobOpeningId ? { ...j, status, closeDate: status === "Closed" ? new Date().toISOString().slice(0, 10) : j.closeDate } : j)),
      );
      logRecruitmentAudit({
        recordType: "Opening",
        recordId: jobOpeningId,
        siteId: opening.siteId,
        action: "opening_status_changed",
        actorName: currentUser.name,
        detail: `Status changed to ${status}`,
      });
      return { ok: true, message: `${opening.title} marked ${status}.` };
    },
    [canManageOpenings, currentUser.name],
  );

  const applicationsForOpening = useCallback((jobOpeningId: string) => applications.filter((a) => a.jobOpeningId === jobOpeningId), [applications]);
  const candidateFor = useCallback((candidateId: string) => candidates.find((c) => c.id === candidateId), [candidates]);
  const openingFor = useCallback((jobOpeningId: string) => jobOpenings.find((j) => j.id === jobOpeningId), [jobOpenings]);

  /* ------------------------------------------------------------- */
  /* Candidates & Applications — one Candidate may hold many         */
  /* Applications; email/phone dedup prevents duplicate profiles.    */
  /* ------------------------------------------------------------- */

  const applyToJob = useCallback(
    (input: CandidateInput, jobOpeningId: string, recruiterId?: string): ActionResult & { application?: Application; candidate?: Candidate } => {
      if (!canManagePipeline) return { ok: false, message: "You're not authorized to add candidates or applications." };
      const opening = jobOpeningsStore.getSnapshot().find((j) => j.id === jobOpeningId);
      if (!opening) return { ok: false, message: "Job opening not found." };
      if (!input.email.trim() || !input.phone.trim()) return { ok: false, message: "Candidate email and phone are required." };

      let candidate = findCandidateByEmailOrPhone(input.email, input.phone);
      const isNewCandidate = !candidate;
      if (!candidate) {
        candidate = {
          id: nextCandidateId(),
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          email: input.email.trim(),
          phone: input.phone.trim(),
          alternatePhone: input.alternatePhone,
          dateOfBirth: input.dateOfBirth,
          location: input.location,
          currentCompany: input.currentCompany,
          currentDesignation: input.currentDesignation,
          totalExperienceYears: input.totalExperienceYears,
          relevantExperienceYears: input.relevantExperienceYears,
          currentSalary: input.currentSalary,
          expectedSalary: input.expectedSalary,
          noticePeriodDays: input.noticePeriodDays,
          skills: input.skills,
          resumeFileName: input.resumeFileName,
          sourceId: input.sourceId,
          siteId: input.siteId,
          createdOn: new Date().toISOString().slice(0, 10),
          createdBy: currentUser.name,
        };
        candidatesStore.set([candidate, ...candidatesStore.getSnapshot()]);
        logRecruitmentAudit({
          recordType: "Candidate",
          recordId: candidate.id,
          siteId: candidate.siteId,
          action: "candidate_created",
          actorName: currentUser.name,
          detail: `${candidate.firstName} ${candidate.lastName} added`,
        });
      }

      const duplicate = applicationsStore.getSnapshot().find((a) => a.candidateId === candidate!.id && a.jobOpeningId === jobOpeningId && a.stage !== "Rejected" && a.stage !== "Withdrawn");
      if (duplicate) {
        return { ok: false, message: "Candidate already exists.", candidate };
      }

      const application: Application = {
        id: nextApplicationId(),
        candidateId: candidate.id,
        jobOpeningId,
        siteId: opening.siteId,
        appliedDate: new Date().toISOString().slice(0, 10),
        sourceId: input.sourceId,
        recruiterId: recruiterId ?? currentUser.employeeId,
        stage: "Applied",
      };
      applicationsStore.set([application, ...applicationsStore.getSnapshot()]);
      logRecruitmentAudit({
        recordType: "Application",
        recordId: application.id,
        siteId: opening.siteId,
        action: "application_created",
        actorName: currentUser.name,
        detail: `${candidate.firstName} ${candidate.lastName} applied to ${opening.title}${isNewCandidate ? "" : " (existing candidate)"}`,
      });
      return { ok: true, message: isNewCandidate ? "Candidate added and application created." : "Existing candidate applied to this opening.", application, candidate };
    },
    [canManagePipeline, currentUser.employeeId, currentUser.name],
  );

  const moveApplicationStage = useCallback(
    (applicationId: string, toStage: ApplicationStage): ActionResult => {
      if (!canManagePipeline) return { ok: false, message: "You're not authorized to update this application." };
      const application = applicationsStore.getSnapshot().find((a) => a.id === applicationId);
      if (!application) return { ok: false, message: "Application not found." };
      if (!canTransitionStage(application.stage, toStage)) {
        return { ok: false, message: `Cannot move from ${application.stage} to ${toStage}.` };
      }
      applicationsStore.set(applicationsStore.getSnapshot().map((a) => (a.id === applicationId ? { ...a, stage: toStage } : a)));
      logRecruitmentAudit({
        recordType: "Application",
        recordId: applicationId,
        siteId: application.siteId,
        action: "stage_changed",
        actorName: currentUser.name,
        detail: `${application.stage} -> ${toStage}`,
      });
      return { ok: true, message: `Moved to ${toStage}.` };
    },
    [canManagePipeline, currentUser.name],
  );

  const rejectApplication = useCallback(
    (applicationId: string, reason: string): ActionResult => {
      if (!canManagePipeline) return { ok: false, message: "You're not authorized to reject this application." };
      if (!reason.trim()) return { ok: false, message: "A rejection reason is required." };
      const application = applicationsStore.getSnapshot().find((a) => a.id === applicationId);
      if (!application) return { ok: false, message: "Application not found." };
      if (!canTransitionStage(application.stage, "Rejected")) return { ok: false, message: "This application can no longer be rejected." };
      applicationsStore.set(
        applicationsStore.getSnapshot().map((a) =>
          a.id === applicationId
            ? { ...a, stage: "Rejected", rejectedBy: currentUser.name, rejectedOn: new Date().toISOString().slice(0, 10), rejectionReason: reason.trim() }
            : a,
        ),
      );
      logRecruitmentAudit({
        recordType: "Application",
        recordId: applicationId,
        siteId: application.siteId,
        action: "stage_changed",
        actorName: currentUser.name,
        detail: `Rejected — ${reason.trim()}`,
      });
      return { ok: true, message: "Application rejected." };
    },
    [canManagePipeline, currentUser.name],
  );

  const withdrawApplication = useCallback(
    (applicationId: string, reason: string): ActionResult => {
      if (!canManagePipeline) return { ok: false, message: "You're not authorized to withdraw this application." };
      const application = applicationsStore.getSnapshot().find((a) => a.id === applicationId);
      if (!application) return { ok: false, message: "Application not found." };
      if (!canTransitionStage(application.stage, "Withdrawn")) return { ok: false, message: "This application can no longer be withdrawn." };
      applicationsStore.set(
        applicationsStore.getSnapshot().map((a) =>
          a.id === applicationId ? { ...a, stage: "Withdrawn", withdrawnOn: new Date().toISOString().slice(0, 10), withdrawnReason: reason.trim() || undefined } : a,
        ),
      );
      logRecruitmentAudit({
        recordType: "Application",
        recordId: applicationId,
        siteId: application.siteId,
        action: "stage_changed",
        actorName: currentUser.name,
        detail: "Withdrawn",
      });
      return { ok: true, message: "Application withdrawn — history kept." };
    },
    [canManagePipeline, currentUser.name],
  );

  /* ------------------------------------------------------------- */
  /* Interviews                                                       */
  /* ------------------------------------------------------------- */

  const interviewsForApplication = useCallback((applicationId: string) => interviews.filter((i) => i.applicationId === applicationId), [interviews]);

  const canActOnInterview = useCallback(
    (interview: Interview) => canManagePipeline || interview.interviewerIds.includes(currentUser.employeeId),
    [canManagePipeline, currentUser.employeeId],
  );

  const scheduleInterview = useCallback(
    (input: ScheduleInterviewInput): ActionResult => {
      if (!canManagePipeline) return { ok: false, message: "You're not authorized to schedule interviews." };
      const application = applicationsStore.getSnapshot().find((a) => a.id === input.applicationId);
      if (!application) return { ok: false, message: "Application not found." };
      const interview: Interview = {
        id: nextInterviewId(),
        applicationId: input.applicationId,
        candidateId: application.candidateId,
        siteId: application.siteId,
        round: input.round,
        roundLabel: input.roundLabel.trim() || `Round ${input.round}`,
        interviewerIds: input.interviewerIds,
        scheduledDate: input.scheduledDate,
        scheduledTime: input.scheduledTime,
        mode: input.mode,
        locationOrLink: input.locationOrLink,
        status: "Scheduled",
        createdOn: new Date().toISOString().slice(0, 10),
      };
      interviewsStore.set([interview, ...interviewsStore.getSnapshot()]);
      if (canTransitionStage(application.stage, "Interview")) {
        applicationsStore.set(applicationsStore.getSnapshot().map((a) => (a.id === input.applicationId ? { ...a, stage: "Interview" } : a)));
      }
      logRecruitmentAudit({
        recordType: "Interview",
        recordId: interview.id,
        siteId: application.siteId,
        action: "interview_scheduled",
        actorName: currentUser.name,
        detail: `${interview.roundLabel} scheduled for ${interview.scheduledDate} ${interview.scheduledTime}`,
      });
      return { ok: true, message: "Interview scheduled." };
    },
    [canManagePipeline, currentUser.name],
  );

  const submitInterviewFeedback = useCallback(
    (interviewId: string, feedback: Omit<InterviewFeedback, "submittedBy" | "submittedOn">): ActionResult => {
      const interview = interviewsStore.getSnapshot().find((i) => i.id === interviewId);
      if (!interview) return { ok: false, message: "Interview not found." };
      if (!canActOnInterview(interview)) return { ok: false, message: "You're not authorized to submit feedback for this interview." };
      interviewsStore.set(
        interviewsStore.getSnapshot().map((i) =>
          i.id === interviewId
            ? {
                ...i,
                status: "Completed",
                feedback: { ...feedback, submittedBy: currentUser.name, submittedOn: new Date().toISOString().slice(0, 10) },
              }
            : i,
        ),
      );
      logRecruitmentAudit({
        recordType: "Interview",
        recordId: interviewId,
        siteId: interview.siteId,
        action: "interview_feedback_submitted",
        actorName: currentUser.name,
        detail: `Feedback submitted — ${feedback.recommendation ?? "no recommendation"}`,
      });
      return { ok: true, message: "Feedback submitted." };
    },
    [canActOnInterview, currentUser.name],
  );

  const cancelInterview = useCallback(
    (interviewId: string): ActionResult => {
      if (!canManagePipeline) return { ok: false, message: "You're not authorized to cancel this interview." };
      const interview = interviewsStore.getSnapshot().find((i) => i.id === interviewId);
      if (!interview) return { ok: false, message: "Interview not found." };
      interviewsStore.set(interviewsStore.getSnapshot().map((i) => (i.id === interviewId ? { ...i, status: "Cancelled" } : i)));
      return { ok: true, message: "Interview cancelled." };
    },
    [canManagePipeline],
  );

  /* ------------------------------------------------------------- */
  /* Offers — acceptance is the one hand-off point into Onboarding.  */
  /* ------------------------------------------------------------- */

  const offersForApplication = useCallback((applicationId: string) => offers.filter((o) => o.applicationId === applicationId), [offers]);

  const createOffer = useCallback(
    (input: CreateOfferInput): ActionResult & { offer?: Offer } => {
      if (!canManagePipeline) return { ok: false, message: "You're not authorized to create offers." };
      const application = applicationsStore.getSnapshot().find((a) => a.id === input.applicationId);
      if (!application) return { ok: false, message: "Application not found." };
      if (application.stage !== "Selected" && application.stage !== "Offer") {
        return { ok: false, message: "An offer can only be created once a candidate is Selected." };
      }
      if (!input.ctcAnnual || input.ctcAnnual <= 0) return { ok: false, message: "A valid annual CTC is required." };
      const offer: Offer = {
        id: nextOfferId(),
        applicationId: input.applicationId,
        candidateId: application.candidateId,
        siteId: application.siteId,
        designationId: input.designationId,
        departmentId: input.departmentId,
        employmentTypeId: input.employmentTypeId,
        joiningDate: input.joiningDate,
        ctcAnnual: input.ctcAnnual,
        earnings: input.earnings,
        deductions: input.deductions,
        probationPeriodMonths: input.probationPeriodMonths,
        offerDate: input.offerDate,
        expiryDate: input.expiryDate,
        status: "Draft",
        createdBy: currentUser.name,
        createdOn: new Date().toISOString().slice(0, 10),
      };
      offersStore.set([offer, ...offersStore.getSnapshot()]);
      if (canTransitionStage(application.stage, "Offer")) {
        applicationsStore.set(applicationsStore.getSnapshot().map((a) => (a.id === input.applicationId ? { ...a, stage: "Offer" } : a)));
      }
      logRecruitmentAudit({
        recordType: "Offer",
        recordId: offer.id,
        siteId: application.siteId,
        action: "offer_created",
        actorName: currentUser.name,
        detail: `Offer drafted — CTC ${offer.ctcAnnual}`,
      });
      return { ok: true, message: "Offer created as Draft.", offer };
    },
    [canManagePipeline, currentUser.name],
  );

  const sendOffer = useCallback(
    (offerId: string): ActionResult => {
      if (!canManagePipeline) return { ok: false, message: "You're not authorized to send offers." };
      const offer = offersStore.getSnapshot().find((o) => o.id === offerId);
      if (!offer) return { ok: false, message: "Offer not found." };
      if (offer.status !== "Draft") return { ok: false, message: "Only a Draft offer can be sent." };
      offersStore.set(offersStore.getSnapshot().map((o) => (o.id === offerId ? { ...o, status: "Sent" } : o)));
      logRecruitmentAudit({ recordType: "Offer", recordId: offerId, siteId: offer.siteId, action: "offer_sent", actorName: currentUser.name, detail: "Offer sent to candidate" });
      return { ok: true, message: "Offer sent." };
    },
    [canManagePipeline, currentUser.name],
  );

  const acceptOffer = useCallback(
    (offerId: string): ActionResult => {
      if (!canManagePipeline) return { ok: false, message: "You're not authorized to record an offer acceptance." };
      const offer = offersStore.getSnapshot().find((o) => o.id === offerId);
      if (!offer) return { ok: false, message: "Offer not found." };
      if (offer.status !== "Sent") return { ok: false, message: "Only a Sent offer can be accepted." };
      const application = applicationsStore.getSnapshot().find((a) => a.id === offer.applicationId);
      if (!application) return { ok: false, message: "Application not found." };
      const candidate = candidatesStore.getSnapshot().find((c) => c.id === offer.candidateId);
      if (!candidate) return { ok: false, message: "Candidate not found." };
      const requisitionId = jobOpeningsStore.getSnapshot().find((j) => j.id === application.jobOpeningId)?.requisitionId;
      const hiringManagerId = requisitionId ? jobRequisitionsStore.getSnapshot().find((r) => r.id === requisitionId)?.hiringManagerId : undefined;
      const departmentName = offer.departmentId ? orgUnits.find((u) => u.id === offer.departmentId)?.name : undefined;
      const designationName = offer.designationId ? masterRecords.find((m) => m.id === offer.designationId)?.name : undefined;

      offersStore.set(offersStore.getSnapshot().map((o) => (o.id === offerId ? { ...o, status: "Accepted", decidedOn: new Date().toISOString().slice(0, 10) } : o)));
      applicationsStore.set(applicationsStore.getSnapshot().map((a) => (a.id === offer.applicationId ? { ...a, stage: "Offer Accepted" } : a)));

      // Hand off to Onboarding — reuses the real createCase (RBAC, task/document
      // templates, audit trail) rather than a parallel onboarding store.
      const caseResult = createCase({
        candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
        candidateEmail: candidate.email,
        candidatePhone: candidate.phone,
        designation: designationName || "Unassigned",
        department: departmentName || "Unassigned",
        siteId: offer.siteId,
        joiningDate: offer.joiningDate,
        recruitmentApplicationId: application.id,
        departmentId: offer.departmentId,
        designationId: offer.designationId,
        employmentTypeId: offer.employmentTypeId,
        reportingManagerId: hiringManagerId,
        probationPeriodMonths: offer.probationPeriodMonths,
        offerCtcAnnual: offer.ctcAnnual,
        offerEarnings: offer.earnings,
        offerDeductions: offer.deductions,
      });

      logRecruitmentAudit({ recordType: "Offer", recordId: offerId, siteId: offer.siteId, action: "offer_accepted", actorName: currentUser.name, detail: "Offer accepted" });
      logRecruitmentAudit({
        recordType: "Application",
        recordId: application.id,
        siteId: offer.siteId,
        action: "onboarding_started",
        actorName: currentUser.name,
        detail: caseResult.ok ? "Onboarding case created" : `Onboarding case NOT created — ${caseResult.message}`,
      });
      return caseResult.ok
        ? { ok: true, message: "Offer accepted — onboarding started." }
        : { ok: true, message: `Offer accepted, but onboarding could not be started automatically: ${caseResult.message}` };
    },
    [canManagePipeline, currentUser.name, createCase],
  );

  const rejectOffer = useCallback(
    (offerId: string, reason: string): ActionResult => {
      if (!canManagePipeline) return { ok: false, message: "You're not authorized to reject this offer." };
      const offer = offersStore.getSnapshot().find((o) => o.id === offerId);
      if (!offer) return { ok: false, message: "Offer not found." };
      if (offer.status !== "Sent") return { ok: false, message: "Only a Sent offer can be marked rejected." };
      offersStore.set(offersStore.getSnapshot().map((o) => (o.id === offerId ? { ...o, status: "Rejected", decidedOn: new Date().toISOString().slice(0, 10), decisionReason: reason.trim() || undefined } : o)));
      applicationsStore.set(
        applicationsStore.getSnapshot().map((a) =>
          a.id === offer.applicationId ? { ...a, stage: "Rejected", rejectedBy: currentUser.name, rejectedOn: new Date().toISOString().slice(0, 10), rejectionReason: reason.trim() || "Offer declined by candidate" } : a,
        ),
      );
      logRecruitmentAudit({ recordType: "Offer", recordId: offerId, siteId: offer.siteId, action: "offer_rejected", actorName: currentUser.name, detail: reason.trim() || "Offer declined" });
      return { ok: true, message: "Offer marked rejected." };
    },
    [canManagePipeline, currentUser.name],
  );

  const expireOffer = useCallback(
    (offerId: string): ActionResult => {
      if (!canManagePipeline) return { ok: false, message: "You're not authorized to expire this offer." };
      const offer = offersStore.getSnapshot().find((o) => o.id === offerId);
      if (!offer) return { ok: false, message: "Offer not found." };
      if (offer.status !== "Sent") return { ok: false, message: "Only a Sent offer can expire." };
      offersStore.set(offersStore.getSnapshot().map((o) => (o.id === offerId ? { ...o, status: "Expired" } : o)));
      logRecruitmentAudit({ recordType: "Offer", recordId: offerId, siteId: offer.siteId, action: "offer_expired", actorName: currentUser.name, detail: "Offer expired" });
      return { ok: true, message: "Offer marked expired." };
    },
    [canManagePipeline, currentUser.name],
  );

  const withdrawOffer = useCallback(
    (offerId: string, reason: string): ActionResult => {
      if (!canManagePipeline) return { ok: false, message: "You're not authorized to withdraw this offer." };
      const offer = offersStore.getSnapshot().find((o) => o.id === offerId);
      if (!offer) return { ok: false, message: "Offer not found." };
      if (offer.status !== "Draft" && offer.status !== "Sent") return { ok: false, message: "This offer can no longer be withdrawn." };
      offersStore.set(offersStore.getSnapshot().map((o) => (o.id === offerId ? { ...o, status: "Withdrawn", decisionReason: reason.trim() || undefined } : o)));
      logRecruitmentAudit({ recordType: "Offer", recordId: offerId, siteId: offer.siteId, action: "offer_withdrawn", actorName: currentUser.name, detail: reason.trim() || "Offer withdrawn" });
      return { ok: true, message: "Offer withdrawn." };
    },
    [canManagePipeline, currentUser.name],
  );

  const value = useMemo<RecruitmentContextValue>(
    () => ({
      requisitions,
      jobOpenings,
      candidates,
      applications,
      interviews,
      offers,
      auditEntries,
      canCreateRequisitions,
      canManageRequisitions,
      canManageOpenings,
      canManagePipeline,
      visibleRequisitions,
      createRequisition,
      decideRequisition,
      canDecideRequisition,
      createJobOpening,
      setJobOpeningStatus,
      applicationsForOpening,
      candidateFor,
      openingFor,
      applyToJob,
      moveApplicationStage,
      rejectApplication,
      withdrawApplication,
      interviewsForApplication,
      canActOnInterview,
      scheduleInterview,
      submitInterviewFeedback,
      cancelInterview,
      offersForApplication,
      createOffer,
      sendOffer,
      acceptOffer,
      rejectOffer,
      expireOffer,
      withdrawOffer,
      auditFor,
    }),
    [
      requisitions,
      jobOpenings,
      candidates,
      applications,
      interviews,
      offers,
      auditEntries,
      canCreateRequisitions,
      canManageRequisitions,
      canManageOpenings,
      canManagePipeline,
      visibleRequisitions,
      createRequisition,
      decideRequisition,
      canDecideRequisition,
      createJobOpening,
      setJobOpeningStatus,
      applicationsForOpening,
      candidateFor,
      openingFor,
      applyToJob,
      moveApplicationStage,
      rejectApplication,
      withdrawApplication,
      interviewsForApplication,
      canActOnInterview,
      scheduleInterview,
      submitInterviewFeedback,
      cancelInterview,
      offersForApplication,
      createOffer,
      sendOffer,
      acceptOffer,
      rejectOffer,
      expireOffer,
      withdrawOffer,
      auditFor,
    ],
  );

  return <RecruitmentContext.Provider value={value}>{children}</RecruitmentContext.Provider>;
}

export function useRecruitment() {
  const ctx = useContext(RecruitmentContext);
  if (!ctx) throw new Error("useRecruitment must be used within a RecruitmentProvider");
  return ctx;
}

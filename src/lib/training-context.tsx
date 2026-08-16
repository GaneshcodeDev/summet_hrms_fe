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
  nextTrainingAttendanceId,
  nextTrainingEnrollmentId,
  nextTrainingProgramId,
  nextTrainingRequestId,
  nextTrainingRequirementId,
  nextTrainingSessionId,
  trainingAttendanceStore,
  trainingEnrollmentsStore,
  trainingProgramsStore,
  trainingRequestsStore,
  trainingRequirementsStore,
  trainingSessionsStore,
} from "@/lib/training-store";
import {
  activeEnrollmentCount,
  canTransitionProgramStatus,
  isProgramFull,
  nextEnrollmentStatuses,
} from "@/lib/training-engine";
import { calculateSkillGap, resolveProposedSkillLevelId, selectCurrentSkill } from "@/lib/skill-engine";
import { useAccessControl } from "@/lib/access-control-context";
import { useEmployees } from "@/lib/employee-context";
import { useMasters } from "@/lib/master-context";
import { useSkills } from "@/lib/skills-context";
import { useApprovals } from "@/lib/approval-context";
import { useNotifications } from "@/lib/notification-context";
import type {
  TrainingAttendance,
  TrainingAttendanceStatus,
  TrainingEnrollment,
  TrainingEnrollmentStatus,
  TrainingMode,
  TrainingProgram,
  TrainingProgramStatus,
  TrainingRequest,
  TrainingRequirement,
  TrainingRequirementScope,
  TrainingResult,
  TrainingSession,
} from "@/lib/types";

interface ActionResult {
  ok: boolean;
  message: string;
}

interface CreateProgramInput {
  siteId: string;
  name: string;
  description?: string;
  categoryId?: string;
  trainerId?: string;
  durationHours?: number;
  mode: TrainingMode;
  startDate: string;
  endDate: string;
  capacity: number;
  relatedSkillId?: string;
  targetSkillLevelId?: string;
  programCost?: number;
  perEmployeeCost?: number;
  vendorCost?: number;
}

interface AddSessionInput {
  trainingProgramId: string;
  siteId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  trainerId?: string;
  location?: string;
}

interface EnrollInput {
  employeeId: string;
  siteId: string;
  trainingProgramId: string;
  requestId?: string;
}

interface RequestTrainingInput {
  employeeId: string;
  siteId: string;
  trainingProgramId: string;
  reason: string;
  requestedDate: string;
}

interface CreateRequirementInput {
  siteId: string;
  scope: TrainingRequirementScope;
  targetId: string;
  requiredSkillId: string;
  requiredSkillLevelId: string;
  requiredTrainingProgramId?: string;
}

export interface TrainingNeed {
  skillId: string;
  currentSkillLevelId?: string;
  requiredSkillLevelId: string;
  gap: number;
  recommendedTrainingProgramId?: string;
}

interface TrainingContextValue {
  // Programs
  programs: TrainingProgram[];
  programsForSite: (siteId: string) => TrainingProgram[];
  programById: (id: string) => TrainingProgram | undefined;
  canManagePrograms: boolean;
  canManageProgramContent: (program: TrainingProgram) => boolean;
  createProgram: (input: CreateProgramInput) => ActionResult & { program?: TrainingProgram };
  advanceProgramStatus: (id: string, toStatus: TrainingProgramStatus) => ActionResult;

  // Sessions
  sessions: TrainingSession[];
  sessionsForProgram: (programId: string) => TrainingSession[];
  addSession: (input: AddSessionInput) => ActionResult & { session?: TrainingSession };

  // Enrollments
  enrollments: TrainingEnrollment[];
  enrollmentsForProgram: (programId: string) => TrainingEnrollment[];
  enrollmentsForEmployee: (employeeId: string) => TrainingEnrollment[];
  enrollmentFor: (employeeId: string, trainingProgramId: string) => TrainingEnrollment | undefined;
  isProgramFull: (programId: string) => boolean;
  enrollEmployee: (input: EnrollInput) => ActionResult & { enrollment?: TrainingEnrollment };
  setEnrollmentStatus: (id: string, status: TrainingEnrollmentStatus) => ActionResult;
  cancelEnrollment: (id: string) => ActionResult;
  recordAssessment: (id: string, input: { score?: number; result: TrainingResult; trainerFeedback?: string; assessmentDate?: string }) => ActionResult;
  completeEnrollment: (id: string, input: { completionDate?: string; certificateReference?: string }) => ActionResult;

  // Attendance
  attendance: TrainingAttendance[];
  attendanceForSession: (sessionId: string) => TrainingAttendance[];
  markAttendance: (input: { sessionId: string; enrollmentId: string; employeeId: string; siteId: string; status: TrainingAttendanceStatus }) => ActionResult;

  // Requests
  requests: TrainingRequest[];
  requestsFor: (employeeId: string) => TrainingRequest[];
  visibleRequests: () => TrainingRequest[];
  canDecideRequests: boolean;
  requestTraining: (input: RequestTrainingInput) => ActionResult & { request?: TrainingRequest };
  decideTrainingRequest: (id: string, decision: "Approved" | "Rejected", comment?: string) => ActionResult;
  cancelTrainingRequest: (id: string) => ActionResult;

  // Requirements / Training Need Identification
  requirements: TrainingRequirement[];
  requirementsForSite: (siteId: string) => TrainingRequirement[];
  canManageRequirements: boolean;
  createRequirement: (input: CreateRequirementInput) => ActionResult & { requirement?: TrainingRequirement };
  trainingNeedsFor: (employeeId: string) => TrainingNeed[];
}

const TrainingContext = createContext<TrainingContextValue | undefined>(undefined);

export function TrainingProvider({ children }: { children: ReactNode }) {
  const { currentUser, canFeature } = useAccessControl();
  const { getEmployeeByEmployeeId } = useEmployees();
  const { records: masterRecords } = useMasters();
  const { currentSkillFor, createSkillUpdateProposal } = useSkills();
  const { recordMirroredAction } = useApprovals();
  const { notify } = useNotifications();

  const programs = useSyncExternalStore(trainingProgramsStore.subscribe, trainingProgramsStore.getSnapshot, trainingProgramsStore.getServerSnapshot);
  const sessions = useSyncExternalStore(trainingSessionsStore.subscribe, trainingSessionsStore.getSnapshot, trainingSessionsStore.getServerSnapshot);
  const enrollments = useSyncExternalStore(trainingEnrollmentsStore.subscribe, trainingEnrollmentsStore.getSnapshot, trainingEnrollmentsStore.getServerSnapshot);
  const attendance = useSyncExternalStore(trainingAttendanceStore.subscribe, trainingAttendanceStore.getSnapshot, trainingAttendanceStore.getServerSnapshot);
  const requests = useSyncExternalStore(trainingRequestsStore.subscribe, trainingRequestsStore.getSnapshot, trainingRequestsStore.getServerSnapshot);
  const requirements = useSyncExternalStore(trainingRequirementsStore.subscribe, trainingRequirementsStore.getSnapshot, trainingRequirementsStore.getServerSnapshot);

  const canManagePrograms = canFeature("training.programs", "create") || canFeature("training.programs", "edit") || canFeature("training.programs", "manage");
  const canManageRequirements = canManagePrograms;
  const canDecideRequests = canFeature("training.requests", "approve") || canFeature("training.requests", "manage");

  const isDirectManagerOf = useCallback(
    (employeeId: string) => {
      const target = getEmployeeByEmployeeId(employeeId);
      return !!target && target.reportingManagerId === currentUser.employeeId;
    },
    [getEmployeeByEmployeeId, currentUser.employeeId],
  );

  /** HR/Admin with broad program rights, OR the specific employee assigned as this program's trainer — no second role model (section 27). */
  const canManageProgramContent = useCallback(
    (program: TrainingProgram) => canManagePrograms || program.trainerId === currentUser.employeeId,
    [canManagePrograms, currentUser.employeeId],
  );

  const programsForSite = useCallback((siteId: string) => programs.filter((p) => p.siteId === siteId), [programs]);
  const programById = useCallback((id: string) => programs.find((p) => p.id === id), [programs]);

  const createProgram = useCallback(
    (input: CreateProgramInput): ActionResult & { program?: TrainingProgram } => {
      if (!canManagePrograms) return { ok: false, message: "You're not authorized to create training programs." };
      if (!input.name.trim()) return { ok: false, message: "Program name is required." };
      if (input.startDate > input.endDate) return { ok: false, message: "Start date must be before the end date." };
      if (input.capacity <= 0) return { ok: false, message: "Capacity must be at least 1." };
      const program: TrainingProgram = {
        id: nextTrainingProgramId(),
        siteId: input.siteId,
        name: input.name.trim(),
        description: input.description?.trim() || undefined,
        categoryId: input.categoryId,
        trainerId: input.trainerId,
        durationHours: input.durationHours,
        mode: input.mode,
        startDate: input.startDate,
        endDate: input.endDate,
        capacity: input.capacity,
        status: "Draft",
        relatedSkillId: input.relatedSkillId,
        targetSkillLevelId: input.targetSkillLevelId,
        programCost: input.programCost,
        perEmployeeCost: input.perEmployeeCost,
        vendorCost: input.vendorCost,
        createdBy: currentUser.name,
        createdOn: new Date().toISOString().slice(0, 10),
      };
      trainingProgramsStore.set([program, ...trainingProgramsStore.getSnapshot()]);
      // A program always ships with at least one session spanning its own dates — multi-session programs add more via addSession (section 13).
      const defaultSession: TrainingSession = {
        id: nextTrainingSessionId(),
        trainingProgramId: program.id,
        siteId: program.siteId,
        date: program.startDate,
        trainerId: program.trainerId,
        createdBy: currentUser.name,
        createdOn: new Date().toISOString().slice(0, 10),
      };
      trainingSessionsStore.set([defaultSession, ...trainingSessionsStore.getSnapshot()]);
      return { ok: true, message: `Training program "${program.name}" created.`, program };
    },
    [canManagePrograms, currentUser.name],
  );

  const advanceProgramStatus = useCallback(
    (id: string, toStatus: TrainingProgramStatus): ActionResult => {
      const program = trainingProgramsStore.getSnapshot().find((p) => p.id === id);
      if (!program) return { ok: false, message: "Program not found." };
      if (!canManageProgramContent(program)) return { ok: false, message: "You're not authorized to manage this program." };
      if (!canTransitionProgramStatus(program.status, toStatus)) {
        return { ok: false, message: `Cannot move a program from "${program.status}" straight to "${toStatus}".` };
      }
      trainingProgramsStore.set(trainingProgramsStore.getSnapshot().map((p) => (p.id === id ? { ...p, status: toStatus } : p)));
      return { ok: true, message: `Program status is now "${toStatus}".` };
    },
    [canManageProgramContent],
  );

  const sessionsForProgram = useCallback((programId: string) => sessions.filter((s) => s.trainingProgramId === programId), [sessions]);

  const addSession = useCallback(
    (input: AddSessionInput): ActionResult & { session?: TrainingSession } => {
      const program = trainingProgramsStore.getSnapshot().find((p) => p.id === input.trainingProgramId);
      if (!program) return { ok: false, message: "Program not found." };
      if (!canManageProgramContent(program)) return { ok: false, message: "You're not authorized to manage this program." };
      const session: TrainingSession = {
        id: nextTrainingSessionId(),
        trainingProgramId: input.trainingProgramId,
        siteId: input.siteId,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        trainerId: input.trainerId,
        location: input.location,
        createdBy: currentUser.name,
        createdOn: new Date().toISOString().slice(0, 10),
      };
      trainingSessionsStore.set([session, ...trainingSessionsStore.getSnapshot()]);
      return { ok: true, message: "Session added.", session };
    },
    [canManageProgramContent, currentUser.name],
  );

  const enrollmentsForProgram = useCallback((programId: string) => enrollments.filter((e) => e.trainingProgramId === programId), [enrollments]);
  const enrollmentsForEmployee = useCallback((employeeId: string) => enrollments.filter((e) => e.employeeId === employeeId), [enrollments]);
  const enrollmentFor = useCallback(
    (employeeId: string, trainingProgramId: string) => enrollments.find((e) => e.employeeId === employeeId && e.trainingProgramId === trainingProgramId && e.status !== "Cancelled"),
    [enrollments],
  );
  const isProgramFullFn = useCallback(
    (programId: string) => {
      const program = programs.find((p) => p.id === programId);
      return !program || isProgramFull(program.capacity, enrollments, programId);
    },
    [programs, enrollments],
  );

  const createEnrollmentRecord = useCallback(
    (input: EnrollInput): ActionResult & { enrollment?: TrainingEnrollment } => {
      const program = trainingProgramsStore.getSnapshot().find((p) => p.id === input.trainingProgramId);
      if (!program) return { ok: false, message: "Program not found." };
      if (program.status === "Cancelled" || program.status === "Completed") {
        return { ok: false, message: `This program is ${program.status.toLowerCase()} and can no longer accept enrollments.` };
      }
      const employee = getEmployeeByEmployeeId(input.employeeId);
      if (!employee) return { ok: false, message: "Employee not found." };
      if (employee.siteId !== program.siteId) return { ok: false, message: "Employee does not belong to this program's site." };
      if (enrollmentFor(input.employeeId, input.trainingProgramId)) {
        return { ok: false, message: `${employee.name} is already enrolled in this program.` };
      }
      const currentEnrollments = trainingEnrollmentsStore.getSnapshot();
      if (isProgramFull(program.capacity, currentEnrollments, input.trainingProgramId)) {
        return { ok: false, message: `Program is full (${activeEnrollmentCount(currentEnrollments, input.trainingProgramId)}/${program.capacity}).` };
      }
      const enrollment: TrainingEnrollment = {
        id: nextTrainingEnrollmentId(),
        employeeId: input.employeeId,
        siteId: program.siteId,
        trainingProgramId: input.trainingProgramId,
        status: "Registered",
        requestId: input.requestId,
        registeredOn: new Date().toISOString().slice(0, 10),
        registeredBy: currentUser.name,
      };
      trainingEnrollmentsStore.set([enrollment, ...trainingEnrollmentsStore.getSnapshot()]);
      return { ok: true, message: `${employee.name} enrolled in "${program.name}".`, enrollment };
    },
    [getEmployeeByEmployeeId, enrollmentFor, currentUser.name],
  );

  const enrollEmployee = useCallback(
    (input: EnrollInput): ActionResult & { enrollment?: TrainingEnrollment } => {
      if (!canManagePrograms) return { ok: false, message: "You're not authorized to enroll employees directly." };
      return createEnrollmentRecord(input);
    },
    [canManagePrograms, createEnrollmentRecord],
  );

  const setEnrollmentStatus = useCallback(
    (id: string, status: TrainingEnrollmentStatus): ActionResult => {
      const enrollment = trainingEnrollmentsStore.getSnapshot().find((e) => e.id === id);
      if (!enrollment) return { ok: false, message: "Enrollment not found." };
      const program = trainingProgramsStore.getSnapshot().find((p) => p.id === enrollment.trainingProgramId);
      if (!program || !canManageProgramContent(program)) return { ok: false, message: "You're not authorized to manage this enrollment." };
      if (!nextEnrollmentStatuses(enrollment.status).includes(status)) {
        return { ok: false, message: `Cannot move an enrollment from "${enrollment.status}" straight to "${status}".` };
      }
      trainingEnrollmentsStore.set(trainingEnrollmentsStore.getSnapshot().map((e) => (e.id === id ? { ...e, status } : e)));
      return { ok: true, message: `Enrollment status is now "${status}".` };
    },
    [canManageProgramContent],
  );

  const cancelEnrollment = useCallback(
    (id: string): ActionResult => {
      const enrollment = trainingEnrollmentsStore.getSnapshot().find((e) => e.id === id);
      if (!enrollment) return { ok: false, message: "Enrollment not found." };
      const program = trainingProgramsStore.getSnapshot().find((p) => p.id === enrollment.trainingProgramId);
      const isOwn = enrollment.employeeId === currentUser.employeeId;
      if (!isOwn && !(program && canManageProgramContent(program))) {
        return { ok: false, message: "You're not authorized to cancel this enrollment." };
      }
      if (enrollment.status === "Completed" || enrollment.status === "Failed") {
        return { ok: false, message: "This training has already concluded and can't be cancelled." };
      }
      trainingEnrollmentsStore.set(trainingEnrollmentsStore.getSnapshot().map((e) => (e.id === id ? { ...e, status: "Cancelled" } : e)));
      return { ok: true, message: "Enrollment cancelled." };
    },
    [currentUser.employeeId, canManageProgramContent],
  );

  const recordAssessment = useCallback(
    (id: string, input: { score?: number; result: TrainingResult; trainerFeedback?: string; assessmentDate?: string }): ActionResult => {
      const enrollment = trainingEnrollmentsStore.getSnapshot().find((e) => e.id === id);
      if (!enrollment) return { ok: false, message: "Enrollment not found." };
      if (enrollment.employeeId === currentUser.employeeId) return { ok: false, message: "You cannot assess your own training." };
      const program = trainingProgramsStore.getSnapshot().find((p) => p.id === enrollment.trainingProgramId);
      if (!program || !canManageProgramContent(program)) return { ok: false, message: "You're not authorized to assess this enrollment." };
      trainingEnrollmentsStore.set(
        trainingEnrollmentsStore.getSnapshot().map((e) =>
          e.id === id
            ? { ...e, score: input.score, result: input.result, trainerFeedback: input.trainerFeedback?.trim() || e.trainerFeedback, assessmentDate: input.assessmentDate ?? new Date().toISOString().slice(0, 10) }
            : e,
        ),
      );
      return { ok: true, message: "Assessment recorded." };
    },
    [currentUser.employeeId, canManageProgramContent],
  );

  const completeEnrollment = useCallback(
    (id: string, input: { completionDate?: string; certificateReference?: string }): ActionResult => {
      const enrollment = trainingEnrollmentsStore.getSnapshot().find((e) => e.id === id);
      if (!enrollment) return { ok: false, message: "Enrollment not found." };
      // Unconditional — an employee can never mark their own training completed (section 26).
      if (enrollment.employeeId === currentUser.employeeId) return { ok: false, message: "You cannot mark your own training as completed." };
      const program = trainingProgramsStore.getSnapshot().find((p) => p.id === enrollment.trainingProgramId);
      if (!program || !canManageProgramContent(program)) return { ok: false, message: "You're not authorized to complete this enrollment." };
      const completionDate = input.completionDate ?? new Date().toISOString().slice(0, 10);
      trainingEnrollmentsStore.set(
        trainingEnrollmentsStore.getSnapshot().map((e) =>
          e.id === id ? { ...e, status: "Completed" as TrainingEnrollmentStatus, completionDate, certificateReference: input.certificateReference?.trim() || e.certificateReference } : e,
        ),
      );

      // Section 17: a completion never silently overwrites the skill — it only ever proposes, and only when the program actually names a skill and the employee passed.
      if (program.relatedSkillId && enrollment.result === "Passed") {
        const skillLevels = masterRecords.filter((r) => r.masterType === "SkillLevel").map((r) => ({ id: r.id, value: Number(r.attributes.value ?? 0) }));
        const current = currentSkillFor(enrollment.employeeId, program.relatedSkillId);
        const currentValue = current ? skillLevels.find((l) => l.id === current.skillLevelId)?.value : undefined;
        const proposedId = resolveProposedSkillLevelId(currentValue, program.targetSkillLevelId, skillLevels);
        if (proposedId && proposedId !== current?.skillLevelId) {
          createSkillUpdateProposal({
            employeeId: enrollment.employeeId,
            siteId: enrollment.siteId,
            skillId: program.relatedSkillId,
            proposedSkillLevelId: proposedId,
            sourceEnrollmentId: enrollment.id,
            reason: `Completed training: ${program.name}`,
          });
        }
      }
      return { ok: true, message: "Training marked as completed." };
    },
    [currentUser.employeeId, canManageProgramContent, masterRecords, currentSkillFor, createSkillUpdateProposal],
  );

  const attendanceForSession = useCallback((sessionId: string) => attendance.filter((a) => a.sessionId === sessionId), [attendance]);

  const markAttendance = useCallback(
    (input: { sessionId: string; enrollmentId: string; employeeId: string; siteId: string; status: TrainingAttendanceStatus }): ActionResult => {
      const session = trainingSessionsStore.getSnapshot().find((s) => s.id === input.sessionId);
      if (!session) return { ok: false, message: "Session not found." };
      const program = trainingProgramsStore.getSnapshot().find((p) => p.id === session.trainingProgramId);
      if (!program || !canManageProgramContent(program)) return { ok: false, message: "You're not authorized to mark attendance for this session." };
      const existing = trainingAttendanceStore.getSnapshot().find((a) => a.sessionId === input.sessionId && a.enrollmentId === input.enrollmentId);
      const record: TrainingAttendance = {
        id: existing?.id ?? nextTrainingAttendanceId(),
        sessionId: input.sessionId,
        enrollmentId: input.enrollmentId,
        employeeId: input.employeeId,
        siteId: input.siteId,
        status: input.status,
        markedBy: currentUser.name,
        markedOn: new Date().toISOString(),
      };
      trainingAttendanceStore.set(existing ? trainingAttendanceStore.getSnapshot().map((a) => (a.id === existing.id ? record : a)) : [record, ...trainingAttendanceStore.getSnapshot()]);
      return { ok: true, message: "Attendance recorded." };
    },
    [canManageProgramContent, currentUser.name],
  );

  const requestsFor = useCallback((employeeId: string) => requests.filter((r) => r.employeeId === employeeId), [requests]);
  const visibleRequests = useCallback(() => {
    if (canDecideRequests) return requests;
    return requests.filter((r) => r.employeeId === currentUser.employeeId || isDirectManagerOf(r.employeeId));
  }, [requests, canDecideRequests, currentUser.employeeId, isDirectManagerOf]);

  const requestTraining = useCallback(
    (input: RequestTrainingInput): ActionResult & { request?: TrainingRequest } => {
      if (input.employeeId !== currentUser.employeeId) return { ok: false, message: "You can only submit a training request for yourself." };
      if (!canFeature("training.requests", "create")) return { ok: false, message: "You're not authorized to request training." };
      const program = trainingProgramsStore.getSnapshot().find((p) => p.id === input.trainingProgramId);
      if (!program) return { ok: false, message: "Training program not found." };
      if (!input.reason.trim()) return { ok: false, message: "A reason is required." };
      const request: TrainingRequest = {
        id: nextTrainingRequestId(),
        employeeId: input.employeeId,
        siteId: input.siteId,
        trainingProgramId: input.trainingProgramId,
        reason: input.reason.trim(),
        requestedDate: input.requestedDate,
        status: "Pending",
      };
      trainingRequestsStore.set([request, ...trainingRequestsStore.getSnapshot()]);
      recordMirroredAction({
        siteId: input.siteId,
        module: "Training",
        recordId: request.id,
        recordOwnerEmployeeId: input.employeeId,
        recordOwnerName: currentUser.name,
        approverType: "REPORTING_MANAGER",
        action: "APPLY",
        newStatus: "Pending",
        comment: input.reason,
      });
      return { ok: true, message: `Training request for "${program.name}" submitted.`, request };
    },
    [currentUser.employeeId, currentUser.name, canFeature, recordMirroredAction],
  );

  const decideTrainingRequest = useCallback(
    (id: string, decision: "Approved" | "Rejected", comment?: string): ActionResult => {
      const request = trainingRequestsStore.getSnapshot().find((r) => r.id === id);
      if (!request) return { ok: false, message: "Training request not found." };
      // Unconditional — no one can approve their own training request (section 26).
      if (request.employeeId === currentUser.employeeId) return { ok: false, message: "You cannot decide your own training request." };
      if (!canDecideRequests && !isDirectManagerOf(request.employeeId)) {
        return { ok: false, message: "You're not authorized to decide this request." };
      }
      if (request.status !== "Pending") return { ok: false, message: "This request has already been decided." };
      if (decision === "Rejected" && !comment?.trim()) return { ok: false, message: "A reason is required to reject." };

      let enrollment: TrainingEnrollment | undefined;
      if (decision === "Approved") {
        const result = createEnrollmentRecord({ employeeId: request.employeeId, siteId: request.siteId, trainingProgramId: request.trainingProgramId, requestId: request.id });
        if (!result.ok) return result;
        enrollment = result.enrollment;
      }

      const today = new Date().toISOString().slice(0, 10);
      trainingRequestsStore.set(
        trainingRequestsStore.getSnapshot().map((r) => (r.id === id ? { ...r, status: decision, decidedBy: currentUser.name, decidedOn: today, comment: comment?.trim() || r.comment } : r)),
      );
      recordMirroredAction({
        siteId: request.siteId,
        module: "Training",
        recordId: request.id,
        recordOwnerEmployeeId: request.employeeId,
        recordOwnerName: getEmployeeByEmployeeId(request.employeeId)?.name ?? request.employeeId,
        approverType: isDirectManagerOf(request.employeeId) ? "REPORTING_MANAGER" : "HR",
        action: decision === "Approved" ? "APPROVE" : "REJECT",
        newStatus: decision,
        comment,
        advanceToNextStep: true,
      });
      const programName = programById(request.trainingProgramId)?.name ?? "the training program";
      notify({
        employeeId: request.employeeId,
        type: decision === "Approved" ? "success" : "warning",
        title: `Training request ${decision.toLowerCase()}`,
        message: decision === "Approved" ? `You're enrolled in ${programName}.` : `Your request for ${programName} was rejected${comment ? ` — ${comment}` : ""}.`,
        module: "Training",
        recordId: request.id,
        href: `/training/${request.trainingProgramId}`,
      });
      return { ok: true, message: decision === "Approved" ? `Request approved — ${enrollment ? "enrolled" : "processed"}.` : "Request rejected." };
    },
    [currentUser.employeeId, currentUser.name, canDecideRequests, isDirectManagerOf, createEnrollmentRecord, recordMirroredAction, getEmployeeByEmployeeId, notify, programById],
  );

  const cancelTrainingRequest = useCallback(
    (id: string): ActionResult => {
      const request = trainingRequestsStore.getSnapshot().find((r) => r.id === id);
      if (!request) return { ok: false, message: "Training request not found." };
      if (request.employeeId !== currentUser.employeeId) return { ok: false, message: "You can only cancel your own request." };
      if (request.status !== "Pending") return { ok: false, message: "Only a pending request can be cancelled." };
      trainingRequestsStore.set(trainingRequestsStore.getSnapshot().map((r) => (r.id === id ? { ...r, status: "Cancelled" } : r)));
      return { ok: true, message: "Request cancelled." };
    },
    [currentUser.employeeId],
  );

  const requirementsForSite = useCallback((siteId: string) => requirements.filter((r) => r.siteId === siteId), [requirements]);

  const createRequirement = useCallback(
    (input: CreateRequirementInput): ActionResult & { requirement?: TrainingRequirement } => {
      if (!canManageRequirements) return { ok: false, message: "You're not authorized to define training requirements." };
      const requirement: TrainingRequirement = {
        id: nextTrainingRequirementId(),
        siteId: input.siteId,
        scope: input.scope,
        targetId: input.targetId,
        requiredSkillId: input.requiredSkillId,
        requiredSkillLevelId: input.requiredSkillLevelId,
        requiredTrainingProgramId: input.requiredTrainingProgramId,
        createdBy: currentUser.name,
        createdOn: new Date().toISOString().slice(0, 10),
      };
      trainingRequirementsStore.set([requirement, ...trainingRequirementsStore.getSnapshot()]);
      return { ok: true, message: "Training requirement created.", requirement };
    },
    [canManageRequirements, currentUser.name],
  );

  const trainingNeedsFor = useCallback(
    (employeeId: string): TrainingNeed[] => {
      const employee = getEmployeeByEmployeeId(employeeId);
      if (!employee) return [];
      const skillLevelValue = (id: string | undefined) => (id ? Number(masterRecords.find((r) => r.id === id && r.masterType === "SkillLevel")?.attributes.value ?? 0) : 0);

      const applicable = requirements.filter((r) => {
        if (r.siteId !== employee.siteId) return false;
        switch (r.scope) {
          case "Employee":
            return r.targetId === employee.employeeId;
          case "Department":
            return !!employee.departmentId && r.targetId === employee.departmentId;
          case "Designation":
            return !!employee.designationId && r.targetId === employee.designationId;
          case "Grade":
            return !!employee.gradeId && r.targetId === employee.gradeId;
          case "Skill":
            return true;
          default:
            return false;
        }
      });

      return applicable
        .map((r) => {
          const current = currentSkillFor(employeeId, r.requiredSkillId);
          const gap = calculateSkillGap(skillLevelValue(current?.skillLevelId), skillLevelValue(r.requiredSkillLevelId));
          return {
            skillId: r.requiredSkillId,
            currentSkillLevelId: current?.skillLevelId,
            requiredSkillLevelId: r.requiredSkillLevelId,
            gap,
            recommendedTrainingProgramId: r.requiredTrainingProgramId,
          };
        })
        .filter((need) => need.gap > 0);
    },
    [getEmployeeByEmployeeId, requirements, masterRecords, currentSkillFor],
  );

  const value = useMemo<TrainingContextValue>(
    () => ({
      programs,
      programsForSite,
      programById,
      canManagePrograms,
      canManageProgramContent,
      createProgram,
      advanceProgramStatus,

      sessions,
      sessionsForProgram,
      addSession,

      enrollments,
      enrollmentsForProgram,
      enrollmentsForEmployee,
      enrollmentFor,
      isProgramFull: isProgramFullFn,
      enrollEmployee,
      setEnrollmentStatus,
      cancelEnrollment,
      recordAssessment,
      completeEnrollment,

      attendance,
      attendanceForSession,
      markAttendance,

      requests,
      requestsFor,
      visibleRequests,
      canDecideRequests,
      requestTraining,
      decideTrainingRequest,
      cancelTrainingRequest,

      requirements,
      requirementsForSite,
      canManageRequirements,
      createRequirement,
      trainingNeedsFor,
    }),
    [
      programs,
      programsForSite,
      programById,
      canManagePrograms,
      canManageProgramContent,
      createProgram,
      advanceProgramStatus,
      sessions,
      sessionsForProgram,
      addSession,
      enrollments,
      enrollmentsForProgram,
      enrollmentsForEmployee,
      enrollmentFor,
      isProgramFullFn,
      enrollEmployee,
      setEnrollmentStatus,
      cancelEnrollment,
      recordAssessment,
      completeEnrollment,
      attendance,
      attendanceForSession,
      markAttendance,
      requests,
      requestsFor,
      visibleRequests,
      canDecideRequests,
      requestTraining,
      decideTrainingRequest,
      cancelTrainingRequest,
      requirements,
      requirementsForSite,
      canManageRequirements,
      createRequirement,
      trainingNeedsFor,
    ],
  );

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>;
}

export function useTraining() {
  const ctx = useContext(TrainingContext);
  if (!ctx) throw new Error("useTraining must be used within a TrainingProvider");
  return ctx;
}

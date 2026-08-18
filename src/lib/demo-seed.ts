"use client";

/**
 * Optional developer/demo data loader. The real product starts empty — 1
 * Super Admin, 0 sites, 0 employees, 0 of everything else (see the Phase 2
 * architecture note in AGENTS.md). This is the explicit opt-in path to
 * hydrate every store with the original rich multi-site demo dataset in one
 * action, for development/testing/demos. Never called automatically.
 */
import { sites } from "@/lib/mock-data";
import { sitesStore } from "@/lib/site-context";
import { demoUserAccounts, seedDeviceSessions, seedSecurityEvents } from "@/lib/rbac-data";
import { accountsStore, deviceSessionsStore, securityEventsStore } from "@/lib/rbac-store";
import { bankDetailsStore, demoEmployeeSeed, employeeDocumentsStore, employeesStore } from "@/lib/employee-store";
import { seedOrgAuditEntries, seedOrgUnits } from "@/lib/org-data";
import { orgAuditStore, orgUnitsStore } from "@/lib/org-store";
import { seedMasterRecords } from "@/lib/master-data";
import { masterRecordsStore } from "@/lib/master-store";
import { seedLeaveAuditEntries, seedLeaveBalances, seedLeaveRequests } from "@/lib/leave-data";
import { seedEvents } from "@/lib/event-data";
import { eventsStore } from "@/lib/event-store";
import { leaveAuditStore, leaveBalancesStore, leaveRequestsStore } from "@/lib/leave-store";
import { seedEmployeeLoans, seedTaxDeclarations } from "@/lib/payroll-data";
import { employeeLoansStore, taxDeclarationsStore } from "@/lib/payroll-store";
import { seedRegularizations } from "@/lib/regularization-data";
import { regularizationsStore } from "@/lib/regularization-store";
import { attendanceStore } from "@/lib/attendance-store";
import { seedOnboardingAudit, seedOnboardingCases } from "@/lib/onboarding-data";
import { onboardingAuditStore, onboardingCasesStore } from "@/lib/onboarding-store";
import { seedOffboardingAudit, seedSeparationCases } from "@/lib/offboarding-data";
import { offboardingAuditStore, separationCasesStore } from "@/lib/offboarding-store";
import {
  seedApplications,
  seedCandidates,
  seedInterviews,
  seedJobOpenings,
  seedJobRequisitions,
  seedOffers,
  seedRecruitmentOnboardingCase,
} from "@/lib/recruitment-data";
import {
  applicationsStore,
  candidatesStore,
  interviewsStore,
  jobOpeningsStore,
  jobRequisitionsStore,
  offersStore,
} from "@/lib/recruitment-store";
import { salaryStructuresStore, payrollRunsStore, payslipsStore } from "@/lib/payroll-store";
import {
  buildDefaultSalaryLines,
  calculatePayslip,
  listWorkingDaysInMonth,
  resolveComponentRates,
} from "@/lib/payroll-engine";
import { performanceCyclesStore, performanceGoalsStore, performanceReviewCasesStore, appraisalDecisionsStore } from "@/lib/performance-store";
import { employeeSkillsStore, skillUpdateProposalsStore } from "@/lib/skill-store";
import {
  trainingProgramsStore,
  trainingSessionsStore,
  trainingEnrollmentsStore,
  trainingAttendanceStore,
  trainingRequestsStore,
  trainingRequirementsStore,
} from "@/lib/training-store";
import {
  assetsStore,
  assetAssignmentsStore,
  assetMaintenanceStore,
  assetDisposalsStore,
  assetRequestsStore,
  assetAuditStore,
} from "@/lib/asset-store";
import { travelRequestsStore, expenseClaimsStore, expenseAuditStore } from "@/lib/expense-store";
import type {
  AppraisalDecision,
  Asset,
  AssetAssignment,
  AssetAuditEntry,
  AssetMaintenance,
  AttendanceRecord,
  AttendanceStatus,
  Employee,
  EmployeeBankDetail,
  EmployeeDocumentRecord,
  EmployeeLoan,
  EmployeeSalaryStructure,
  EmployeeSkill,
  ExpenseAuditEntry,
  ExpenseClaim,
  ExpenseItem,
  MasterRecord,
  PayrollPayslip,
  PayrollRun,
  PerformanceCycle,
  PerformanceGoal,
  PerformanceReviewCase,
  SkillUpdateProposal,
  TravelRequest,
  TrainingAttendance,
  TrainingEnrollment,
  TrainingProgram,
  TrainingRequest,
  TrainingRequirement,
  TrainingSession,
} from "@/lib/types";

/**
 * True in local dev (`next dev`) and any non-production build. False in a
 * production build (`next build && next start`) — Next.js inlines
 * `process.env.NODE_ENV` as the literal "production" at build time, so this
 * evaluates once, at build time, to a hard `false`. Every "Load Demo Data"
 * button/link is gated on this, so the affordance can never render — let
 * alone run — for a real user in a production deployment.
 */
export const isDemoDataEnabled = process.env.NODE_ENV !== "production";

/**
 * Generates attendance for the last 10 working days for real employees —
 * never a static array, and never for employees that don't exist. Rebuilt
 * from today's date each time demo data is (re)loaded, so it's never stuck
 * on a stale hardcoded month.
 */
function generateDemoAttendance(employees: Employee[]): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const now = new Date();
  let daysCollected = 0;
  let cursor = 0;

  while (daysCollected < 10 && cursor < 30) {
    const day = new Date(now);
    day.setDate(day.getDate() - cursor);
    cursor += 1;
    const dow = day.getDay(); // 0 = Sunday, 6 = Saturday
    if (dow === 0 || dow === 6) continue; // demo default: Sat/Sun off
    daysCollected += 1;
    const dateStr = day.toISOString().slice(0, 10);

    employees.forEach((emp, i) => {
      const seed = (emp.employeeId.charCodeAt(emp.employeeId.length - 1) + i + cursor) % 10;
      const nowIso = new Date().toISOString();
      let status: AttendanceStatus = "Present";
      let punchIn = "09:0" + (seed % 6);
      let punchOut = "18:0" + ((seed + 2) % 6);
      let lateMinutes = 0;
      if (seed === 7) {
        status = "Absent";
        punchIn = "";
        punchOut = "";
      } else if (seed === 8) {
        status = "On Leave";
        punchIn = "";
        punchOut = "";
      } else if (seed === 9) {
        status = "Late";
        punchIn = "09:45";
        lateMinutes = 30;
      }
      records.push({
        id: `att-${emp.employeeId}-${dateStr}`,
        employeeId: emp.employeeId,
        siteId: emp.siteId,
        date: dateStr,
        punchIn: punchIn || undefined,
        punchOut: punchOut || undefined,
        status,
        shiftId: emp.shiftId,
        workedHours: punchIn && punchOut ? 8.5 : 0,
        overtimeHours: 0,
        lateMinutes,
        earlyLeavingMinutes: 0,
        source: "MANUAL",
        createdOn: nowIso,
        updatedOn: nowIso,
      });
    });
  }
  return records;
}

/** One salary structure per demo employee, built through the same engine every real site uses. */
function generateDemoSalaryStructures(employees: Employee[], masterRecords: MasterRecord[]): EmployeeSalaryStructure[] {
  const now = new Date().toISOString();
  return employees.map((emp, i) => {
    const seed = (emp.employeeId.charCodeAt(emp.employeeId.length - 1) + i) % 5;
    const ctcAnnual = 400000 + seed * 60000;
    const siteComponents = masterRecords.filter((r) => r.masterType === "SalaryComponent" && r.siteId === emp.siteId);
    const rates = resolveComponentRates(siteComponents);
    const { earnings, deductions, grossMonthly } = buildDefaultSalaryLines(ctcAnnual, rates);
    return {
      id: `salary-${emp.employeeId}`,
      employeeId: emp.employeeId,
      siteId: emp.siteId,
      effectiveFrom: emp.dateOfJoining,
      ctcAnnual,
      earnings,
      deductions,
      grossMonthly,
      updatedOn: now,
      updatedBy: "Demo Seed",
    };
  });
}

/** A fully Locked payroll run for last month, so "My Latest Payslip" has something real to show right after loading demo data. */
function generateDemoPayrollRun(
  employees: Employee[],
  salaryStructures: EmployeeSalaryStructure[],
  loans: EmployeeLoan[],
): { runs: PayrollRun[]; payslips: PayrollPayslip[] } {
  const now = new Date();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const workingDayDates = listWorkingDaysInMonth(month, ["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const workingDays = workingDayDates.length;

  const runs: PayrollRun[] = [];
  const payslips: PayrollPayslip[] = [];
  const siteIds = Array.from(new Set(employees.map((e) => e.siteId)));

  for (const siteId of siteIds) {
    const siteEmployees = employees.filter((e) => e.siteId === siteId);
    const runPayslips: PayrollPayslip[] = [];
    const runId = `run-${siteId}-${month}-demo`;

    for (const emp of siteEmployees) {
      const structure = salaryStructures.find((s) => s.employeeId === emp.employeeId);
      if (!structure) continue;
      const activeLoans = loans.filter((l) => l.employeeId === emp.employeeId && l.status === "Active");
      // Demo history assumes full attendance for the closed month (no LOP/overtime) — keeps the seed simple and honest.
      const result = calculatePayslip({
        salaryStructure: structure,
        attendance: { workingDays, paidDays: workingDays, lopDays: 0, overtimeHours: 0 },
        activeLoans,
      });
      runPayslips.push({
        id: `payslip-${emp.employeeId}-${month}`,
        runId,
        employeeId: emp.employeeId,
        siteId,
        month,
        earnings: result.earnings,
        deductions: result.deductions,
        workingDays: result.workingDays,
        paidDays: result.paidDays,
        lopDays: result.lopDays,
        overtimeHours: result.overtimeHours,
        overtimeAmount: result.overtimeAmount,
        grossEarnings: result.grossEarnings,
        totalDeductions: result.totalDeductions,
        netPay: result.netPay,
        generatedOn: now.toISOString(),
      });
    }

    if (runPayslips.length === 0) continue;
    runs.push({
      id: runId,
      siteId,
      month,
      status: "Locked",
      employeeCount: runPayslips.length,
      totalGross: runPayslips.reduce((sum, p) => sum + p.grossEarnings, 0),
      totalDeductions: runPayslips.reduce((sum, p) => sum + p.totalDeductions, 0),
      totalNet: runPayslips.reduce((sum, p) => sum + p.netPay, 0),
      createdOn: now.toISOString(),
      createdBy: "Demo Seed",
      approvedOn: now.toISOString(),
      approvedBy: "Demo Seed",
      lockedOn: now.toISOString(),
      lockedBy: "Demo Seed",
    });
    payslips.push(...runPayslips);
  }

  return { runs, payslips };
}

const demoBanks = ["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Mahindra Bank"];

/** One bank record per demo employee — deterministic per employee, not random. */
function generateDemoBankDetails(employees: Employee[]): EmployeeBankDetail[] {
  const now = new Date().toISOString();
  return employees.map((emp, i) => ({
    id: `bank-${emp.employeeId}`,
    employeeId: emp.employeeId,
    siteId: emp.siteId,
    accountHolderName: emp.name,
    bankName: demoBanks[i % demoBanks.length],
    accountNumber: `XXXX XXXX ${String(1000 + i * 37).slice(-4)}`,
    ifsc: `${demoBanks[i % demoBanks.length].slice(0, 4).toUpperCase().replace(/\s/g, "")}0${String(100000 + i).slice(-6)}`,
    branch: emp.location || "Head Office",
    accountType: i % 4 === 0 ? "Current" : "Savings",
    updatedOn: now,
    updatedBy: "Demo Seed",
  }));
}

const demoDocumentTypes = ["Aadhar Card", "PAN Card", "Offer Letter", "Educational Certificate"];

/** A handful of identity/employment documents per demo employee. */
function generateDemoDocuments(employees: Employee[]): EmployeeDocumentRecord[] {
  const records: EmployeeDocumentRecord[] = [];
  employees.forEach((emp) => {
    demoDocumentTypes.forEach((type, i) => {
      records.push({
        id: `doc-${emp.employeeId}-${i}`,
        employeeId: emp.employeeId,
        siteId: emp.siteId,
        documentType: type,
        status: i === demoDocumentTypes.length - 1 ? "Pending" : "Verified",
        uploadedOn: emp.dateOfJoining,
        verifiedBy: i === demoDocumentTypes.length - 1 ? undefined : "HR Admin",
        verifiedOn: i === demoDocumentTypes.length - 1 ? undefined : emp.dateOfJoining,
      });
    });
  });
  return records;
}

/**
 * One coherent, fully-walked example — Cycle -> Goals -> Self Review ->
 * Manager Review -> HR Review -> Completed -> Appraisal (AGENTS.md Phase 13
 * section 31) — not a fabricated audit trail: every date is internally
 * consistent (self review before manager review before HR review, all
 * inside the cycle's own review window) and the CTC figures come straight
 * off the SAME salary structure generateDemoPayrollRun uses, never a second
 * guessed number. The appraisal is seeded "Approved" (not "Applied") so a
 * real "Apply" click exercises the actual salary-versioning / promotion
 * code path instead of the seed script faking that outcome.
 */
function generateDemoPerformanceData(salaryStructures: EmployeeSalaryStructure[]): {
  cycles: PerformanceCycle[];
  goals: PerformanceGoal[];
  reviewCases: PerformanceReviewCase[];
  appraisals: AppraisalDecision[];
} {
  const cycle: PerformanceCycle = {
    id: "CYC-0001",
    siteId: "site-1",
    name: "H1 2026 Performance Review",
    startDate: "2026-01-01",
    endDate: "2026-06-30",
    reviewStartDate: "2026-06-01",
    reviewEndDate: "2026-06-30",
    status: "Completed",
    requiresHRReview: true,
    createdBy: "Demo Seed",
    createdOn: "2026-01-01",
  };

  const employeeId = "EMP002"; // Rohit Sharma — reports to EMP001, already Confirmed (Phase 12 seed).
  const goals: PerformanceGoal[] = [
    {
      id: "GOAL-0001",
      employeeId,
      siteId: cycle.siteId,
      cycleId: cycle.id,
      scope: "Individual",
      title: "Ship the redesigned onboarding module",
      description: "Deliver the new onboarding flow end-to-end this half.",
      categoryId: "goalcat-business-impact",
      kpi: "Feature delivery",
      target: "100% of agreed scope shipped",
      measurement: "Percentage",
      weight: 40,
      dueDate: "2026-06-15",
      status: "Completed",
      achievement: 100,
      employeeComment: "Shipped on schedule with positive user feedback.",
      managerComment: "Strong delivery, clean rollout.",
      managerRating: 4,
      createdBy: "Demo Seed",
      createdOn: "2026-01-05",
    },
    {
      id: "GOAL-0002",
      employeeId,
      siteId: cycle.siteId,
      cycleId: cycle.id,
      scope: "Individual",
      title: "Reduce core API error rate",
      description: "Bring the core API's error rate down this half.",
      categoryId: "goalcat-quality",
      kpi: "Error rate",
      target: "Under 1%",
      measurement: "Percentage",
      weight: 30,
      dueDate: "2026-06-15",
      status: "Completed",
      achievement: 85,
      employeeComment: "Reduced the error rate significantly but landed just short of target.",
      managerComment: "Good progress — still room to close the gap next cycle.",
      managerRating: 3,
      createdBy: "Demo Seed",
      createdOn: "2026-01-05",
    },
    {
      id: "GOAL-0003",
      employeeId,
      siteId: cycle.siteId,
      cycleId: cycle.id,
      scope: "Individual",
      title: "Mentor two junior engineers",
      description: "Structured mentorship for two recent hires.",
      categoryId: "goalcat-behavioral",
      kpi: "Mentorship sessions completed",
      target: "12 sessions",
      measurement: "Number",
      weight: 30,
      dueDate: "2026-06-15",
      status: "Completed",
      achievement: 100,
      employeeComment: "Completed all planned sessions.",
      managerComment: "Excellent mentorship — both mentees ramped up quickly.",
      managerRating: 5,
      createdBy: "Demo Seed",
      createdOn: "2026-01-05",
    },
  ];

  const reviewCase: PerformanceReviewCase = {
    id: `case-${cycle.id}-${employeeId}`,
    employeeId,
    siteId: cycle.siteId,
    cycleId: cycle.id,
    stage: "Completed",
    selfReviewSubmittedOn: "2026-06-05",
    managerReviewSubmittedOn: "2026-06-12",
    managerReviewedBy: "Ganesh Pandey",
    hrReviewSubmittedOn: "2026-06-15",
    hrReviewedBy: "Ganesh Pandey",
    hrComment: "Reviewed and confirmed — strong first half.",
    // 0.40*4 + 0.30*3 + 0.30*5 = 4.0 — the worked example from AGENTS.md Phase 13 section 12.
    finalScore: 4,
    completedOn: "2026-06-15",
  };

  const structure = salaryStructures.find((s) => s.employeeId === employeeId);
  const previousCtcAnnual = structure?.ctcAnnual;
  const incrementPercent = 10;
  const proposedCtcAnnual = previousCtcAnnual !== undefined ? Math.round(previousCtcAnnual * (1 + incrementPercent / 100)) : undefined;

  const appraisal: AppraisalDecision = {
    id: "APR-0001",
    employeeId,
    siteId: cycle.siteId,
    cycleId: cycle.id,
    reviewCaseId: reviewCase.id,
    finalRating: 4,
    previousCtcAnnual,
    proposedCtcAnnual,
    incrementPercent,
    promotion: false,
    effectiveDate: "2026-09-01",
    comments: "Strong first-half performance — standard increment.",
    status: "Approved",
    createdBy: "Ganesh Pandey",
    createdOn: "2026-06-16",
    decidedBy: "Ganesh Pandey",
    decidedOn: "2026-06-17",
  };

  return { cycles: [cycle], goals, reviewCases: [reviewCase], appraisals: [appraisal] };
}

/**
 * One coherent, fully-walked example — Skills -> Training Program ->
 * Enrollment -> Completed Training -> Skill Assessment (AGENTS.md Phase 14
 * section 31) — every date is internally consistent (skill assessed before
 * the program starts, completion after the program's own dates, the skill
 * update proposal decided after completion) and nothing is disconnected:
 * the proposal's sourceEnrollmentId really points at the seeded enrollment,
 * and the post-training EmployeeSkill version carries source
 * "Training Completion", not a fabricated bump.
 */
function generateDemoTrainingData(): {
  programs: TrainingProgram[];
  sessions: TrainingSession[];
  enrollments: TrainingEnrollment[];
  attendance: TrainingAttendance[];
  requests: TrainingRequest[];
  requirements: TrainingRequirement[];
  skills: EmployeeSkill[];
  skillProposals: SkillUpdateProposal[];
} {
  const program: TrainingProgram = {
    id: "TRN-0001",
    siteId: "site-1",
    name: "React Advanced Patterns",
    description: "Hands-on workshop covering advanced component composition, performance and state patterns.",
    categoryId: "trainingcat-technical",
    trainerId: "EMP001",
    durationHours: 16,
    mode: "Online",
    startDate: "2026-07-01",
    endDate: "2026-07-10",
    capacity: 20,
    status: "Completed",
    relatedSkillId: "skill-react",
    targetSkillLevelId: "skilllevel-advanced",
    programCost: 45000,
    perEmployeeCost: 2500,
    createdBy: "Demo Seed",
    createdOn: "2026-06-15",
  };

  const session: TrainingSession = {
    id: "SESS-0001",
    trainingProgramId: program.id,
    siteId: program.siteId,
    date: "2026-07-05",
    startTime: "10:00",
    endTime: "17:00",
    trainerId: program.trainerId,
    location: "Zoom",
    createdBy: "Demo Seed",
    createdOn: "2026-06-15",
  };

  const enrollment: TrainingEnrollment = {
    id: "ENR-0001",
    employeeId: "EMP002",
    siteId: program.siteId,
    trainingProgramId: program.id,
    status: "Completed",
    registeredOn: "2026-06-20",
    registeredBy: "Demo Seed",
    score: 88,
    result: "Passed",
    trainerFeedback: "Strong grasp of composition patterns; ready for more complex frontend work.",
    assessmentDate: "2026-07-10",
    completionDate: "2026-07-10",
    certificateReference: "CERT-REACT-2026-0042",
  };

  const attendance: TrainingAttendance = {
    id: "TATT-0001",
    sessionId: session.id,
    enrollmentId: enrollment.id,
    employeeId: enrollment.employeeId,
    siteId: program.siteId,
    status: "Present",
    markedBy: "Demo Seed",
    markedOn: "2026-07-05T18:00:00.000Z",
  };

  // A second, still-pending request against the same program — gives the Requests tab something real to approve/reject in a live demo.
  const request: TrainingRequest = {
    id: "TREQ-0001",
    employeeId: "EMP011",
    siteId: program.siteId,
    trainingProgramId: program.id,
    reason: "Want to strengthen frontend skills for the onboarding module work.",
    requestedDate: "2026-07-02",
    status: "Pending",
  };

  // Not yet published/enrolled — exists so the requirement below has a real, navigable "Recommended Training" instead of leaving it blank.
  const nodeProgram: TrainingProgram = {
    id: "TRN-0002",
    siteId: "site-1",
    name: "Node.js Fundamentals",
    description: "Core Node.js runtime, async patterns and building REST APIs.",
    categoryId: "trainingcat-technical",
    durationHours: 12,
    mode: "Online",
    startDate: "2026-09-01",
    endDate: "2026-09-05",
    capacity: 15,
    status: "Draft",
    relatedSkillId: "skill-node",
    targetSkillLevelId: "skilllevel-advanced",
    createdBy: "Demo Seed",
    createdOn: "2026-07-20",
  };

  // A requirement that's deliberately NOT yet met — Engineering needs Node.js
  // at Advanced, but nobody's been assessed on it, so it surfaces as a real
  // (not fabricated) gap. Uses departmentId (Department scope) rather than
  // designationId — most seed employees never had a designationId FK
  // populated (only the plain-text `designation` field), so a Designation-
  // scoped rule would silently match nobody.
  const requirement: TrainingRequirement = {
    id: "TRQMT-0001",
    siteId: "site-1",
    scope: "Department",
    targetId: "dept-engineering",
    requiredSkillId: "skill-node",
    requiredSkillLevelId: "skilllevel-advanced",
    requiredTrainingProgramId: nodeProgram.id,
    createdBy: "Demo Seed",
    createdOn: "2026-01-10",
  };

  const skillBefore: EmployeeSkill = {
    id: "ESK-0001",
    employeeId: "EMP002",
    siteId: "site-1",
    skillId: "skill-react",
    skillLevelId: "skilllevel-intermediate",
    yearsOfExperience: 2,
    lastAssessedDate: "2026-01-15",
    source: "Manager Assessed",
    assessedBy: "Ganesh Pandey",
    createdOn: "2026-01-15T00:00:00.000Z",
  };

  const skillProposal: SkillUpdateProposal = {
    id: "SUP-0001",
    employeeId: "EMP002",
    siteId: "site-1",
    skillId: "skill-react",
    currentSkillLevelId: "skilllevel-intermediate",
    proposedSkillLevelId: "skilllevel-advanced",
    sourceEnrollmentId: enrollment.id,
    reason: `Completed training: ${program.name}`,
    status: "Approved",
    createdOn: "2026-07-10",
    decidedBy: "Ganesh Pandey",
    decidedOn: "2026-07-11",
  };

  const skillAfter: EmployeeSkill = {
    id: "ESK-0002",
    employeeId: "EMP002",
    siteId: "site-1",
    skillId: "skill-react",
    skillLevelId: "skilllevel-advanced",
    yearsOfExperience: 2,
    lastAssessedDate: "2026-07-11",
    source: "Training Completion",
    assessedBy: "Ganesh Pandey",
    comment: `Completed training: ${program.name}`,
    createdOn: "2026-07-11T00:00:00.000Z",
  };

  return {
    programs: [program, nodeProgram],
    sessions: [session],
    enrollments: [enrollment],
    attendance: [attendance],
    requests: [request],
    requirements: [requirement],
    skills: [skillAfter, skillBefore],
    skillProposals: [skillProposal],
  };
}

/**
 * Coherent asset lifecycle example: Rohit Sharma (EMP002) holds a laptop and
 * a monitor, Amit Kumar (EMP007) holds a laptop, one unit sits Available,
 * one is Under Maintenance, one is Retired (with a real prior owner and
 * return on file — never an ownerless fabricated retirement), and one is
 * assigned to Vikram Desai (EMP006), whose offboarding case (off-2) is
 * already Approved and On Notice — so demo data load immediately shows a
 * real "Pending Return" on his offboarding case (section 10/12/13).
 */
function generateDemoAssetData() {
  const assets: Asset[] = [
    {
      id: "AST-0001",
      assetCode: "L001",
      siteId: "site-1",
      assetTypeId: "assettype-laptop",
      name: "Dell Latitude 5420",
      brand: "Dell",
      model: "Latitude 5420",
      serialNumber: "SN-L001-2022",
      purchaseDate: "2022-01-15",
      purchaseCost: 68000,
      warrantyExpiry: "2025-01-14",
      vendor: "Dell India",
      location: "Noida — IT Storage Room",
      condition: "Good",
      status: "Assigned",
      createdBy: "Demo Seed",
      createdOn: "2022-01-18T09:00:00.000Z",
    },
    {
      id: "AST-0002",
      assetCode: "M001",
      siteId: "site-1",
      assetTypeId: "assettype-monitor",
      name: "LG UltraWide Monitor",
      brand: "LG",
      model: "34WN780",
      serialNumber: "SN-M001-2022",
      purchaseDate: "2022-01-15",
      purchaseCost: 32000,
      warrantyExpiry: "2025-01-14",
      vendor: "LG Electronics",
      location: "Noida — IT Storage Room",
      condition: "Good",
      status: "Assigned",
      createdBy: "Demo Seed",
      createdOn: "2022-01-18T09:05:00.000Z",
    },
    {
      id: "AST-0003",
      assetCode: "L002",
      siteId: "site-1",
      assetTypeId: "assettype-laptop",
      name: "MacBook Pro 14",
      brand: "Apple",
      model: "MacBook Pro 14 (2023)",
      serialNumber: "SN-L002-2023",
      purchaseDate: "2023-04-10",
      purchaseCost: 185000,
      warrantyExpiry: "2026-04-09",
      vendor: "Apple India",
      location: "Noida — IT Storage Room",
      condition: "Good",
      status: "Assigned",
      createdBy: "Demo Seed",
      createdOn: "2023-04-12T09:00:00.000Z",
    },
    {
      id: "AST-0004",
      assetCode: "MB001",
      siteId: "site-1",
      assetTypeId: "assettype-mobile",
      name: "iPhone 13",
      brand: "Apple",
      model: "iPhone 13",
      serialNumber: "SN-MB001-2023",
      purchaseDate: "2023-06-01",
      purchaseCost: 58000,
      warrantyExpiry: "2024-05-31",
      vendor: "Apple India",
      location: "Noida — IT Storage Room",
      condition: "Good",
      status: "Available",
      createdBy: "Demo Seed",
      createdOn: "2023-06-03T09:00:00.000Z",
    },
    {
      id: "AST-0005",
      assetCode: "L003",
      siteId: "site-2",
      assetTypeId: "assettype-laptop",
      name: "Dell Latitude 5420",
      brand: "Dell",
      model: "Latitude 5420",
      serialNumber: "SN-L003-2022",
      purchaseDate: "2022-03-01",
      purchaseCost: 68000,
      warrantyExpiry: "2025-02-28",
      vendor: "Dell India",
      location: "Bangalore — IT Storage Room",
      condition: "Fair",
      status: "Under Maintenance",
      remarks: "Reported screen flickering — sent for diagnosis.",
      createdBy: "Demo Seed",
      createdOn: "2022-03-05T09:00:00.000Z",
    },
    {
      id: "AST-0006",
      assetCode: "L004",
      siteId: "site-2",
      assetTypeId: "assettype-laptop",
      name: "ThinkPad T480",
      brand: "Lenovo",
      model: "ThinkPad T480",
      serialNumber: "SN-L004-2019",
      purchaseDate: "2019-05-01",
      purchaseCost: 62000,
      warrantyExpiry: "2022-04-30",
      vendor: "Lenovo India",
      location: "Bangalore — IT Storage Room",
      condition: "Fair",
      status: "Retired",
      remarks: "Retired — out of warranty, replaced with newer hardware.",
      createdBy: "Demo Seed",
      createdOn: "2019-05-05T09:00:00.000Z",
    },
    {
      id: "AST-0007",
      assetCode: "L005",
      siteId: "site-2",
      assetTypeId: "assettype-laptop",
      name: "Dell Latitude 5420",
      brand: "Dell",
      model: "Latitude 5420",
      serialNumber: "SN-L005-2021",
      purchaseDate: "2021-09-15",
      purchaseCost: 68000,
      warrantyExpiry: "2024-09-14",
      vendor: "Dell India",
      location: "Bangalore — IT Storage Room",
      condition: "Good",
      status: "Assigned",
      createdBy: "Demo Seed",
      createdOn: "2021-09-18T09:00:00.000Z",
    },
  ];

  const assignments: AssetAssignment[] = [
    {
      id: "ASGN-0001",
      assetId: "AST-0001",
      employeeId: "EMP002",
      siteId: "site-1",
      assignedDate: "2022-01-20",
      assignedBy: "Ganesh Pandey",
      conditionAtAssignment: "Good",
      remarks: "Issued at joining team setup.",
      createdOn: "2022-01-20T09:10:00.000Z",
    },
    {
      id: "ASGN-0002",
      assetId: "AST-0002",
      employeeId: "EMP002",
      siteId: "site-1",
      assignedDate: "2022-01-20",
      assignedBy: "Ganesh Pandey",
      conditionAtAssignment: "Good",
      createdOn: "2022-01-20T09:15:00.000Z",
    },
    {
      id: "ASGN-0003",
      assetId: "AST-0003",
      employeeId: "EMP007",
      siteId: "site-1",
      assignedDate: "2023-04-15",
      assignedBy: "Ganesh Pandey",
      conditionAtAssignment: "Good",
      remarks: "Replacement for prior device.",
      createdOn: "2023-04-15T09:00:00.000Z",
    },
    // AST-0006's prior owner — returned ahead of retirement, so the Retired
    // unit has a real, non-fabricated history instead of appearing ownerless.
    {
      id: "ASGN-0004",
      assetId: "AST-0006",
      employeeId: "EMP003",
      siteId: "site-2",
      assignedDate: "2019-05-10",
      assignedBy: "Rohit Sharma",
      conditionAtAssignment: "Good",
      returnedDate: "2026-06-01",
      returnedBy: "Rohit Sharma",
      conditionAtReturn: "Fair",
      returnRemarks: "Returned ahead of hardware refresh; unit shows normal wear.",
      createdOn: "2019-05-10T09:00:00.000Z",
    },
    // Vikram Desai is On Notice with an Approved offboarding case (off-2) —
    // this active assignment is what makes it show as a Pending Return there.
    {
      id: "ASGN-0005",
      assetId: "AST-0007",
      employeeId: "EMP006",
      siteId: "site-2",
      assignedDate: "2021-09-20",
      assignedBy: "Rohit Sharma",
      conditionAtAssignment: "Good",
      remarks: "Standard issue laptop.",
      createdOn: "2021-09-20T09:00:00.000Z",
    },
  ];

  const maintenance: AssetMaintenance[] = [
    {
      id: "MAINT-0001",
      assetId: "AST-0005",
      siteId: "site-2",
      issue: "Screen flickering intermittently during use.",
      reportedDate: "2026-08-05",
      maintenanceStart: "2026-08-06",
      // Cost left unset deliberately — genuinely not billed yet; must render "Not recorded", never $0.
      vendor: "Dell Service Center — Bangalore",
      status: "In Progress",
      createdBy: "Rohit Sharma",
      createdOn: "2026-08-06T10:00:00.000Z",
    },
  ];

  // Newest-first, matching logAssetAudit's prepend convention.
  const audit: AssetAuditEntry[] = [
    { id: "AEVT-0015", assetId: "AST-0007", action: "assigned", actorName: "Rohit Sharma", detail: "Assigned to Vikram Desai.", timestamp: "2021-09-20T09:00:00.000Z" },
    { id: "AEVT-0014", assetId: "AST-0007", action: "created", actorName: "Demo Seed", detail: "Asset L005 — Dell Latitude 5420 added to inventory.", timestamp: "2021-09-18T09:00:00.000Z" },
    { id: "AEVT-0013", assetId: "AST-0006", action: "retired", actorName: "Ganesh Pandey", detail: "Retired — out of warranty, replaced with newer hardware.", timestamp: "2026-06-02T09:00:00.000Z" },
    { id: "AEVT-0012", assetId: "AST-0006", action: "returned", actorName: "Rohit Sharma", detail: "Returned by Priya Singh — condition Fair.", timestamp: "2026-06-01T09:00:00.000Z" },
    { id: "AEVT-0011", assetId: "AST-0006", action: "assigned", actorName: "Rohit Sharma", detail: "Assigned to Priya Singh.", timestamp: "2019-05-10T09:00:00.000Z" },
    { id: "AEVT-0010", assetId: "AST-0006", action: "created", actorName: "Demo Seed", detail: "Asset L004 — ThinkPad T480 added to inventory.", timestamp: "2019-05-05T09:00:00.000Z" },
    { id: "AEVT-0009", assetId: "AST-0005", action: "maintenance_started", actorName: "Rohit Sharma", detail: "Reported screen flickering — sent for diagnosis.", timestamp: "2026-08-06T10:00:00.000Z" },
    { id: "AEVT-0008", assetId: "AST-0005", action: "created", actorName: "Demo Seed", detail: "Asset L003 — Dell Latitude 5420 added to inventory.", timestamp: "2022-03-05T09:00:00.000Z" },
    { id: "AEVT-0007", assetId: "AST-0004", action: "created", actorName: "Demo Seed", detail: "Asset MB001 — iPhone 13 added to inventory.", timestamp: "2023-06-03T09:00:00.000Z" },
    { id: "AEVT-0006", assetId: "AST-0003", action: "assigned", actorName: "Ganesh Pandey", detail: "Assigned to Amit Kumar.", timestamp: "2023-04-15T09:00:00.000Z" },
    { id: "AEVT-0005", assetId: "AST-0003", action: "created", actorName: "Demo Seed", detail: "Asset L002 — MacBook Pro 14 added to inventory.", timestamp: "2023-04-12T09:00:00.000Z" },
    { id: "AEVT-0004", assetId: "AST-0002", action: "assigned", actorName: "Ganesh Pandey", detail: "Assigned to Rohit Sharma.", timestamp: "2022-01-20T09:15:00.000Z" },
    { id: "AEVT-0003", assetId: "AST-0002", action: "created", actorName: "Demo Seed", detail: "Asset M001 — LG UltraWide Monitor added to inventory.", timestamp: "2022-01-18T09:05:00.000Z" },
    { id: "AEVT-0002", assetId: "AST-0001", action: "assigned", actorName: "Ganesh Pandey", detail: "Assigned to Rohit Sharma.", timestamp: "2022-01-20T09:10:00.000Z" },
    { id: "AEVT-0001", assetId: "AST-0001", action: "created", actorName: "Demo Seed", detail: "Asset L001 — Dell Latitude 5420 added to inventory.", timestamp: "2022-01-18T09:00:00.000Z" },
  ];

  return { assets, assignments, maintenance, audit };
}

/**
 * Coherent Travel/Expense example, exactly matching the spec's worked
 * lifecycle: Rohit Sharma's (EMP002, site-1) Bangalore trip is Approved,
 * then fully claimed and paid out (Hotel 5,000 + Travel 7,000 + Food 2,000
 * = 14,000, Manager Approved → Finance Approved → Reimbursed). A second
 * pair at site-2 (Vikram Desai, EMP006) doubles as the mandatory Site B
 * fixture and the "one pending claim" example; Priya Singh's (EMP003,
 * site-2) non-travel claim is the "one rejected claim" example — every
 * record ties to a real seed employee, nothing disconnected.
 */
function generateDemoExpenseData() {
  const travelRequests: TravelRequest[] = [
    {
      id: "TR-0001",
      employeeId: "EMP002",
      employee: "Rohit Sharma",
      siteId: "site-1",
      purpose: "Bangalore client workshop",
      travelType: "Domestic",
      from: "Noida",
      destination: "Bangalore",
      mode: "Flight",
      fromDate: "2026-07-20",
      toDate: "2026-07-22",
      estimatedCost: 20000,
      advanceRequired: true,
      advanceAmount: 5000,
      accommodationRequired: true,
      transportRequired: true,
      status: "Approved",
      appliedOn: "2026-07-10",
      approverId: "EMP001",
      approverName: "Ganesh Pandey",
      decidedOn: "2026-07-11",
    },
    {
      id: "TR-0002",
      employeeId: "EMP006",
      employee: "Vikram Desai",
      siteId: "site-2",
      purpose: "Chennai data center audit",
      travelType: "Domestic",
      from: "Bangalore",
      destination: "Chennai",
      mode: "Flight",
      fromDate: "2026-07-05",
      toDate: "2026-07-07",
      estimatedCost: 15000,
      advanceRequired: false,
      accommodationRequired: true,
      transportRequired: false,
      status: "Approved",
      appliedOn: "2026-06-28",
      approverId: "EMP002",
      approverName: "Rohit Sharma",
      decidedOn: "2026-06-29",
    },
  ];

  let itemSeq = 0;
  function item(date: string, categoryId: string, amount: number, description: string, receiptReference?: string, overLimitNote?: string): ExpenseItem {
    itemSeq += 1;
    return { id: `exi-seed-${itemSeq}`, date, categoryId, amount, description, receiptReference, overLimitNote };
  }

  const claims: ExpenseClaim[] = [
    {
      id: "EC-0001",
      employeeId: "EMP002",
      employee: "Rohit Sharma",
      siteId: "site-1",
      title: "Bangalore Client Workshop",
      travelRequestId: "TR-0001",
      items: [
        item("2026-07-20", "expensecat-travel", 7000, "Round-trip flight to Bangalore", "INV-FLT-0720"),
        item("2026-07-21", "expensecat-accommodation", 5000, "Hotel stay (2 nights)", "INV-HTL-0721"),
        item("2026-07-21", "expensecat-food", 2000, "Meals during trip", "INV-FOOD-0721", "Client dinner included — pre-cleared with manager."),
      ],
      totalAmount: 14000,
      status: "Reimbursed",
      submittedOn: "2026-07-23",
      managerId: "EMP001",
      managerName: "Ganesh Pandey",
      managerDecisionReason: "Approved",
      managerDecidedOn: "2026-07-24",
      financeName: "Amit Kumar",
      financeDecisionReason: "Approved for reimbursement",
      financeDecidedOn: "2026-07-25",
      approvedAmount: 14000,
      reimbursedOn: "2026-07-28",
      reimbursedAmount: 14000,
      reimbursementReference: "NEFT-EXP-0728",
      reimbursementMethod: "NEFT",
      reimbursedBy: "Amit Kumar",
    },
    // Site B fixture + "one pending claim" — Manager hasn't decided yet.
    {
      id: "EC-0002",
      employeeId: "EMP006",
      employee: "Vikram Desai",
      siteId: "site-2",
      title: "Chennai Data Center Audit",
      travelRequestId: "TR-0002",
      items: [
        item("2026-07-05", "expensecat-travel", 8000, "Flight to Chennai", "INV-FLT-0705"),
        item("2026-07-06", "expensecat-food", 1200, "Meals during audit", "INV-FOOD-0706"),
      ],
      totalAmount: 9200,
      status: "Submitted",
      submittedOn: "2026-07-08",
    },
    // "One rejected claim" — non-travel, over the Office Expense category limit, manager declined.
    {
      id: "EC-0003",
      employeeId: "EMP003",
      employee: "Priya Singh",
      siteId: "site-2",
      title: "Team Lunch — Client Entertainment",
      items: [
        item("2026-06-15", "expensecat-office", 3500, "Client entertainment lunch (6 attendees)", "INV-LUNCH-0615", "Larger group than usual — 6 client attendees."),
      ],
      totalAmount: 3500,
      status: "Rejected",
      submittedOn: "2026-06-16",
      managerId: "EMP002",
      managerName: "Rohit Sharma",
      managerDecisionReason: "Please route entertainment expenses through Finance pre-approval next time.",
      managerDecidedOn: "2026-06-17",
    },
  ];

  const audit: ExpenseAuditEntry[] = [
    { id: "EEVT-0001", refId: "TR-0001", employeeName: "Rohit Sharma", action: "travel_requested", actorName: "Rohit Sharma", detail: "Travel request submitted for Bangalore", timestamp: "2026-07-10T09:00:00.000Z" },
    { id: "EEVT-0002", refId: "TR-0001", employeeName: "Rohit Sharma", action: "travel_decided", actorName: "Ganesh Pandey", detail: "Travel request approved", timestamp: "2026-07-11T09:00:00.000Z" },
    { id: "EEVT-0003", refId: "EC-0001", employeeName: "Rohit Sharma", action: "created", actorName: "Rohit Sharma", detail: 'Expense claim "Bangalore Client Workshop" created', timestamp: "2026-07-20T08:00:00.000Z" },
    { id: "EEVT-0004", refId: "EC-0001", employeeName: "Rohit Sharma", action: "submitted", actorName: "Rohit Sharma", detail: "Claim submitted for ₹14,000", timestamp: "2026-07-23T09:00:00.000Z" },
    { id: "EEVT-0005", refId: "EC-0001", employeeName: "Rohit Sharma", action: "manager_approved", actorName: "Ganesh Pandey", detail: "Manager approved", timestamp: "2026-07-24T09:00:00.000Z" },
    { id: "EEVT-0006", refId: "EC-0001", employeeName: "Rohit Sharma", action: "finance_approved", actorName: "Amit Kumar", detail: "Finance approved ₹14,000 — ready for reimbursement", timestamp: "2026-07-25T09:00:00.000Z" },
    { id: "EEVT-0007", refId: "EC-0001", employeeName: "Rohit Sharma", action: "reimbursed", actorName: "Amit Kumar", detail: "Reimbursed ₹14,000 — ref NEFT-EXP-0728", timestamp: "2026-07-28T09:00:00.000Z" },
    { id: "EEVT-0008", refId: "TR-0002", employeeName: "Vikram Desai", action: "travel_requested", actorName: "Vikram Desai", detail: "Travel request submitted for Chennai", timestamp: "2026-06-28T09:00:00.000Z" },
    { id: "EEVT-0009", refId: "TR-0002", employeeName: "Vikram Desai", action: "travel_decided", actorName: "Rohit Sharma", detail: "Travel request approved", timestamp: "2026-06-29T09:00:00.000Z" },
    { id: "EEVT-0010", refId: "EC-0002", employeeName: "Vikram Desai", action: "created", actorName: "Vikram Desai", detail: 'Expense claim "Chennai Data Center Audit" created', timestamp: "2026-07-05T08:00:00.000Z" },
    { id: "EEVT-0011", refId: "EC-0002", employeeName: "Vikram Desai", action: "submitted", actorName: "Vikram Desai", detail: "Claim submitted for ₹9,200", timestamp: "2026-07-08T09:00:00.000Z" },
    { id: "EEVT-0012", refId: "EC-0003", employeeName: "Priya Singh", action: "created", actorName: "Priya Singh", detail: 'Expense claim "Team Lunch — Client Entertainment" created', timestamp: "2026-06-15T08:00:00.000Z" },
    { id: "EEVT-0013", refId: "EC-0003", employeeName: "Priya Singh", action: "submitted", actorName: "Priya Singh", detail: "Claim submitted for ₹3,500", timestamp: "2026-06-16T09:00:00.000Z" },
    { id: "EEVT-0014", refId: "EC-0003", employeeName: "Priya Singh", action: "manager_rejected", actorName: "Rohit Sharma", detail: "Claim rejected — entertainment spend needs prior approval", timestamp: "2026-06-17T09:00:00.000Z" },
  ];

  return { travelRequests, claims, audit: audit.slice().reverse() };
}

/** Overwrites every store with the full rich demo dataset (4 sites, 10 employees, ...). */
export function loadDemoData() {
  sitesStore.set(sites);
  employeesStore.set(demoEmployeeSeed);
  accountsStore.set(demoUserAccounts);
  deviceSessionsStore.set(seedDeviceSessions);
  securityEventsStore.set(seedSecurityEvents);
  orgUnitsStore.set(seedOrgUnits);
  orgAuditStore.set(seedOrgAuditEntries);
  masterRecordsStore.set(seedMasterRecords);
  leaveRequestsStore.set(seedLeaveRequests);
  leaveBalancesStore.set(seedLeaveBalances);
  leaveAuditStore.set(seedLeaveAuditEntries);
  employeeLoansStore.set(seedEmployeeLoans);
  taxDeclarationsStore.set(seedTaxDeclarations);
  regularizationsStore.set(seedRegularizations);
  attendanceStore.set(generateDemoAttendance(demoEmployeeSeed));
  bankDetailsStore.set(generateDemoBankDetails(demoEmployeeSeed));
  employeeDocumentsStore.set(generateDemoDocuments(demoEmployeeSeed));
  onboardingCasesStore.set([...seedOnboardingCases, seedRecruitmentOnboardingCase]);
  onboardingAuditStore.set(seedOnboardingAudit);
  separationCasesStore.set(seedSeparationCases);
  offboardingAuditStore.set(seedOffboardingAudit);

  jobRequisitionsStore.set(seedJobRequisitions);
  jobOpeningsStore.set(seedJobOpenings);
  candidatesStore.set(seedCandidates);
  applicationsStore.set(seedApplications);
  interviewsStore.set(seedInterviews);
  offersStore.set(seedOffers);

  const salaryStructures = generateDemoSalaryStructures(demoEmployeeSeed, seedMasterRecords);
  salaryStructuresStore.set(salaryStructures);
  const { runs, payslips } = generateDemoPayrollRun(demoEmployeeSeed, salaryStructures, seedEmployeeLoans);
  payrollRunsStore.set(runs);
  payslipsStore.set(payslips);

  const performanceData = generateDemoPerformanceData(salaryStructures);
  performanceCyclesStore.set(performanceData.cycles);
  performanceGoalsStore.set(performanceData.goals);
  performanceReviewCasesStore.set(performanceData.reviewCases);
  appraisalDecisionsStore.set(performanceData.appraisals);

  const trainingData = generateDemoTrainingData();
  trainingProgramsStore.set(trainingData.programs);
  trainingSessionsStore.set(trainingData.sessions);
  trainingEnrollmentsStore.set(trainingData.enrollments);
  trainingAttendanceStore.set(trainingData.attendance);
  trainingRequestsStore.set(trainingData.requests);
  trainingRequirementsStore.set(trainingData.requirements);
  employeeSkillsStore.set(trainingData.skills);
  skillUpdateProposalsStore.set(trainingData.skillProposals);

  const assetData = generateDemoAssetData();
  assetsStore.set(assetData.assets);
  assetAssignmentsStore.set(assetData.assignments);
  assetMaintenanceStore.set(assetData.maintenance);
  assetDisposalsStore.set([]);
  assetRequestsStore.set([]);
  assetAuditStore.set(assetData.audit);

  const expenseData = generateDemoExpenseData();
  travelRequestsStore.set(expenseData.travelRequests);
  expenseClaimsStore.set(expenseData.claims);
  expenseAuditStore.set(expenseData.audit);

  eventsStore.set(seedEvents);
}

/**
 * Optional demo dataset for Recruitment — loaded only via loadDemoData()
 * (see demo-seed.ts), never on a normal empty start. Deliberately a single
 * coherent chain per AGENTS.md Phase 11 section 34 ("do not create
 * disconnected fake records"): one historical Approved requisition with
 * candidates spread across every pipeline stage (including one already at
 * Offer Accepted with a linked, still-open OnboardingCase — see
 * seedRecruitmentOnboardingCase below, merged into demo-seed's onboarding
 * cases), plus one still-Pending requisition so "Load Demo Data" always
 * leaves something real to approve live.
 */
import { buildDocuments, buildTasks, onboardingTaskTemplates } from "@/lib/onboarding-data";
import type { Application, Candidate, Interview, JobOpening, JobRequisition, Offer, OnboardingCase } from "@/lib/types";

export const seedJobRequisitions: JobRequisition[] = [
  {
    id: "REQ-0001",
    siteId: "site-1",
    departmentId: "dept-engineering",
    designationId: "designation-sr-swe",
    gradeId: "jobgrade-7",
    employmentTypeId: "emptype-fulltime",
    positions: 2,
    hiringManagerId: "EMP002",
    requiredSkills: ["React", "Node.js", "PostgreSQL"],
    minExperienceYears: 4,
    maxExperienceYears: 8,
    salaryRangeMin: 1200000,
    salaryRangeMax: 1600000,
    priority: "High",
    targetJoiningDate: "2026-09-01",
    reasonForHiring: "Team expansion for the new platform initiative",
    status: "Approved",
    requestedBy: "EMP002",
    requestedByName: "Rohit Sharma",
    createdOn: "2026-07-01",
  },
  {
    id: "REQ-0002",
    siteId: "site-3",
    departmentId: "dept-delhi-hr",
    designationId: "designation-hr-exec",
    employmentTypeId: "emptype-fulltime",
    positions: 1,
    priority: "Medium",
    targetJoiningDate: "2026-10-01",
    reasonForHiring: "Growing HR support needs at the Delhi site",
    status: "Pending Approval",
    requestedBy: "EMP005",
    requestedByName: "Sneha Kapoor",
    createdOn: "2026-08-05",
  },
];

export const seedJobOpenings: JobOpening[] = [
  {
    id: "JOB-0001",
    requisitionId: "REQ-0001",
    siteId: "site-1",
    departmentId: "dept-engineering",
    designationId: "designation-sr-swe",
    employmentTypeId: "emptype-fulltime",
    title: "Senior Software Engineer",
    description: "Own platform services end-to-end — API design, data modeling and production reliability.",
    requiredSkills: ["React", "Node.js", "PostgreSQL"],
    minExperienceYears: 4,
    maxExperienceYears: 8,
    salaryRangeMin: 1200000,
    salaryRangeMax: 1600000,
    location: "Noida",
    openings: 2,
    status: "Open",
    openDate: "2026-07-03",
    createdBy: "Rohit Sharma",
    createdOn: "2026-07-03",
  },
];

export const seedCandidates: Candidate[] = [
  {
    id: "CAND-0001",
    firstName: "Arvind",
    lastName: "Rao",
    email: "arvind.rao@example.com",
    phone: "+91 90011 22001",
    currentCompany: "Infoedge",
    currentDesignation: "Software Engineer",
    totalExperienceYears: 5,
    relevantExperienceYears: 4,
    expectedSalary: 1400000,
    noticePeriodDays: 60,
    skills: ["React", "Node.js", "AWS"],
    sourceId: "recsource-linkedin",
    siteId: "site-1",
    createdOn: "2026-07-10",
    createdBy: "Rohit Sharma",
  },
  {
    id: "CAND-0002",
    firstName: "Neha",
    lastName: "Joshi",
    email: "neha.joshi@example.com",
    phone: "+91 90011 22002",
    currentCompany: "Zeta Systems",
    currentDesignation: "Senior Software Engineer",
    totalExperienceYears: 6,
    relevantExperienceYears: 5,
    expectedSalary: 1450000,
    noticePeriodDays: 30,
    skills: ["React", "TypeScript", "PostgreSQL"],
    sourceId: "recsource-naukri",
    siteId: "site-1",
    createdOn: "2026-07-08",
    createdBy: "Rohit Sharma",
  },
  {
    id: "CAND-0003",
    firstName: "Karan",
    lastName: "Mehta",
    email: "karan.mehta@example.com",
    phone: "+91 90011 22003",
    currentCompany: "Freelance",
    currentDesignation: "Web Developer",
    totalExperienceYears: 2,
    relevantExperienceYears: 1,
    expectedSalary: 900000,
    noticePeriodDays: 15,
    skills: ["React"],
    sourceId: "recsource-naukri",
    siteId: "site-1",
    createdOn: "2026-07-09",
    createdBy: "Rohit Sharma",
  },
  {
    id: "CAND-0004",
    firstName: "Divya",
    lastName: "Nair",
    email: "divya.nair@example.com",
    phone: "+91 90011 22004",
    currentCompany: "Quantum Softech",
    currentDesignation: "Software Engineer",
    totalExperienceYears: 5,
    relevantExperienceYears: 5,
    currentSalary: 1350000,
    expectedSalary: 1500000,
    noticePeriodDays: 30,
    skills: ["React", "Node.js", "PostgreSQL", "AWS"],
    sourceId: "recsource-referral",
    siteId: "site-1",
    createdOn: "2026-06-20",
    createdBy: "Rohit Sharma",
  },
];

export const seedApplications: Application[] = [
  { id: "APP-0001", candidateId: "CAND-0001", jobOpeningId: "JOB-0001", siteId: "site-1", appliedDate: "2026-07-10", sourceId: "recsource-linkedin", recruiterId: "EMP002", stage: "Interview" },
  { id: "APP-0002", candidateId: "CAND-0002", jobOpeningId: "JOB-0001", siteId: "site-1", appliedDate: "2026-07-08", sourceId: "recsource-naukri", recruiterId: "EMP002", stage: "Offer" },
  {
    id: "APP-0003",
    candidateId: "CAND-0003",
    jobOpeningId: "JOB-0001",
    siteId: "site-1",
    appliedDate: "2026-07-09",
    sourceId: "recsource-naukri",
    recruiterId: "EMP002",
    stage: "Rejected",
    rejectedBy: "Rohit Sharma",
    rejectedOn: "2026-07-12",
    rejectionReason: "Experience below the role's minimum requirement",
  },
  { id: "APP-0004", candidateId: "CAND-0004", jobOpeningId: "JOB-0001", siteId: "site-1", appliedDate: "2026-06-20", sourceId: "recsource-referral", recruiterId: "EMP002", stage: "Offer Accepted" },
];

export const seedInterviews: Interview[] = [
  {
    id: "INT-0001",
    applicationId: "APP-0001",
    candidateId: "CAND-0001",
    siteId: "site-1",
    round: 1,
    roundLabel: "Technical Round 1",
    interviewerIds: ["EMP002"],
    scheduledDate: "2026-07-18",
    scheduledTime: "11:00",
    mode: "Video",
    locationOrLink: "Google Meet",
    status: "Completed",
    feedback: {
      technicalSkills: 4,
      communication: 4,
      problemSolving: 4,
      cultureFit: 5,
      overallRating: 4,
      recommendation: "Hire",
      comments: "Solid fundamentals, good system design instincts. Proceed to next round.",
      submittedBy: "Rohit Sharma",
      submittedOn: "2026-07-18",
    },
    createdOn: "2026-07-14",
  },
];

export const seedOffers: Offer[] = [
  {
    id: "OFR-0001",
    applicationId: "APP-0002",
    candidateId: "CAND-0002",
    siteId: "site-1",
    designationId: "designation-sr-swe",
    departmentId: "dept-engineering",
    employmentTypeId: "emptype-fulltime",
    joiningDate: "2026-09-01",
    ctcAnnual: 1450000,
    earnings: [
      { componentId: "basic", label: "Basic", amount: 60417 },
      { componentId: "hra", label: "HRA", amount: 24167 },
      { componentId: "special-allowance", label: "Special Allowance", amount: 36249 },
    ],
    deductions: [],
    probationPeriodMonths: 3,
    offerDate: "2026-07-25",
    expiryDate: "2026-08-25",
    status: "Sent",
    createdBy: "Rohit Sharma",
    createdOn: "2026-07-25",
  },
  {
    id: "OFR-0002",
    applicationId: "APP-0004",
    candidateId: "CAND-0004",
    siteId: "site-1",
    designationId: "designation-sr-swe",
    departmentId: "dept-engineering",
    employmentTypeId: "emptype-fulltime",
    joiningDate: "2026-08-24",
    ctcAnnual: 1500000,
    earnings: [
      { componentId: "basic", label: "Basic", amount: 62500 },
      { componentId: "hra", label: "HRA", amount: 25000 },
      { componentId: "special-allowance", label: "Special Allowance", amount: 37500 },
    ],
    deductions: [],
    probationPeriodMonths: 3,
    offerDate: "2026-07-05",
    expiryDate: "2026-08-05",
    status: "Accepted",
    createdBy: "Rohit Sharma",
    createdOn: "2026-07-05",
    decidedOn: "2026-07-08",
  },
];

/**
 * The one Offer that's already Accepted (OFR-0002 / CAND-0004) gets its
 * onboarding case seeded directly here — exactly like acceptOffer() would
 * have produced via createCase(), just without a live click. Left at
 * Pre-boarding (not Completed) on purpose: this is the record the Phase 11
 * end-to-end test drives through "Complete Onboarding" to prove Employee
 * creation for real. Merged into onboarding-store's cases in demo-seed.ts.
 */
const RECRUITMENT_CASE_ID = "ob-rec-1";
// Every mandatory task/document already cleared except the final HR
// checklist item — leaves exactly one thing for the Phase 11 end-to-end
// test to complete live before "Complete Onboarding" creates the Employee.
const doneTaskIds = onboardingTaskTemplates.map((t) => t.id).filter((id) => id !== "hr-record");

export const seedRecruitmentOnboardingCase: OnboardingCase = {
  id: RECRUITMENT_CASE_ID,
  candidateName: "Divya Nair",
  candidateEmail: "divya.nair@example.com",
  candidatePhone: "+91 90011 22004",
  designation: "Senior Software Engineer",
  department: "Engineering",
  siteId: "site-1",
  joiningDate: "2026-08-24",
  status: "Pre-boarding",
  createdOn: "2026-07-08",
  tasks: buildTasks(RECRUITMENT_CASE_ID, doneTaskIds, [], "Rohit Sharma", "2026-07-20"),
  documents: buildDocuments(RECRUITMENT_CASE_ID, {
    "doc-offer": { status: "Verified", fileName: "Divya_Nair_Offer.pdf", uploadedOn: "2026-07-09", verifiedBy: "Rohit Sharma", verifiedOn: "2026-07-10", signatureStatus: "Signed", signedOn: "2026-07-10" },
    "doc-id": { status: "Verified", fileName: "Divya_Nair_ID.pdf", uploadedOn: "2026-07-12", verifiedBy: "Rohit Sharma", verifiedOn: "2026-07-13" },
    "doc-edu": { status: "Verified", fileName: "Divya_Nair_Degree.pdf", uploadedOn: "2026-07-14", verifiedBy: "Rohit Sharma", verifiedOn: "2026-07-15" },
    "doc-bank": { status: "Verified", fileName: "Divya_Nair_Cheque.pdf", uploadedOn: "2026-07-16", verifiedBy: "Rohit Sharma", verifiedOn: "2026-07-17" },
  }),
  recruitmentApplicationId: "APP-0004",
  departmentId: "dept-engineering",
  designationId: "designation-sr-swe",
  employmentTypeId: "emptype-fulltime",
  reportingManagerId: "EMP002",
  probationPeriodMonths: 3,
  offerCtcAnnual: 1500000,
  offerEarnings: [
    { componentId: "basic", label: "Basic", amount: 62500 },
    { componentId: "hra", label: "HRA", amount: 25000 },
    { componentId: "special-allowance", label: "Special Allowance", amount: 37500 },
  ],
  offerDeductions: [],
};

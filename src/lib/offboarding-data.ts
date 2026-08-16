import type {
  ClearanceDepartment,
  ClearanceItem,
  ClearanceItemStatus,
  FnFLineItem,
  OffboardingAuditEntry,
  SeparationCase,
} from "@/lib/types";

export const separationReasons = [
  "Better Opportunity",
  "Higher Studies",
  "Relocation",
  "Health Reasons",
  "Personal Reasons",
  "Performance",
  "Restructuring / Redundancy",
  "End of Contract",
] as const;

interface ClearanceTemplate {
  key: string;
  department: ClearanceDepartment;
  title: string;
}

export const clearanceTemplates: ClearanceTemplate[] = [
  { key: "it-access", department: "IT", title: "Revoke email & system access" },
  { key: "it-assets", department: "IT", title: "Collect laptop & IT assets" },
  { key: "it-vpn", department: "IT", title: "Deactivate VPN / remote access" },
  { key: "admin-idcard", department: "Admin", title: "Return ID card & access card" },
  { key: "admin-assets", department: "Admin", title: "Return other company assets" },
  { key: "fin-loans", department: "Finance", title: "Clear pending loans / advances" },
  { key: "fin-salary", department: "Finance", title: "Process last salary & reimbursements" },
  { key: "hr-interview", department: "HR", title: "Conduct exit interview" },
  { key: "hr-handover", department: "HR", title: "Collect handover documentation" },
  { key: "hr-records", department: "HR", title: "Update HRMS & statutory records" },
];

export function buildClearanceItems(
  caseId: string,
  overrides: Record<string, { status: ClearanceItemStatus; clearedBy?: string; clearedOn?: string; remarks?: string }> = {},
): ClearanceItem[] {
  return clearanceTemplates.map((t) => {
    const o = overrides[t.key];
    return {
      id: `${caseId}-${t.key}`,
      department: t.department,
      title: t.title,
      status: o?.status ?? "Pending",
      clearedBy: o?.clearedBy,
      clearedOn: o?.clearedOn,
      remarks: o?.remarks,
    };
  });
}

let lineItemSeq = 0;
export function fnfLine(label: string, type: FnFLineItem["type"], amount: number, autoComputed = false): FnFLineItem {
  lineItemSeq += 1;
  return { id: `fnf-seed-${lineItemSeq}`, label, type, amount, autoComputed };
}

export const seedSeparationCases: SeparationCase[] = [
  {
    id: "off-1",
    employeeId: "EMP008",
    employee: "Rahul Mehta",
    designation: "Accountant",
    department: "Finance",
    siteId: "site-3",
    type: "Resignation",
    reason: "Better Opportunity",
    resignationDate: "2024-02-01",
    noticePeriodDays: 30,
    lastWorkingDay: "2024-03-02",
    status: "Completed",
    initiatedBy: "Rahul Mehta",
    approverId: "EMP010",
    approverName: "Manoj Gupta",
    decisionReason: "Approved — handover plan confirmed",
    decidedOn: "2024-02-02",
    clearanceItems: buildClearanceItems("off-1", {
      "it-access": { status: "Cleared", clearedBy: "IT Team", clearedOn: "2024-03-01" },
      "it-assets": { status: "Cleared", clearedBy: "IT Team", clearedOn: "2024-03-01" },
      "it-vpn": { status: "Cleared", clearedBy: "IT Team", clearedOn: "2024-03-01" },
      "admin-idcard": { status: "Cleared", clearedBy: "Admin Team", clearedOn: "2024-03-01" },
      "admin-assets": { status: "Cleared", clearedBy: "Admin Team", clearedOn: "2024-03-01" },
      "fin-loans": { status: "Cleared", clearedBy: "Manoj Gupta", clearedOn: "2024-03-02", remarks: "No outstanding loans" },
      "fin-salary": { status: "Cleared", clearedBy: "Manoj Gupta", clearedOn: "2024-03-04" },
      "hr-interview": { status: "Cleared", clearedBy: "Neha Verma", clearedOn: "2024-02-25" },
      "hr-handover": { status: "Cleared", clearedBy: "Neha Verma", clearedOn: "2024-03-01" },
      "hr-records": { status: "Cleared", clearedBy: "Neha Verma", clearedOn: "2024-03-05" },
    }),
    exitInterview: {
      status: "Completed",
      scheduledOn: "2024-02-25",
      conductedBy: "Neha Verma",
      primaryReason: "Better Opportunity",
      feedbackNotes: "Positive experience overall; leaving for a higher compensation offer elsewhere.",
      wouldRehire: true,
      rating: 4,
    },
    settlement: {
      lineItems: [fnfLine("Pending Salary (2 days)", "Earning", 2300)],
      netPayable: 2300,
      status: "Paid",
      computedOn: "2024-03-04",
      paidOn: "2024-03-05",
      reference: "FNF-EMP008-0305",
    },
    relievingLetterStatus: "Sent",
    experienceLetterStatus: "Sent",
    completedOn: "2024-03-05",
  },
  {
    id: "off-2",
    employeeId: "EMP006",
    employee: "Vikram Desai",
    designation: "DevOps Engineer",
    department: "Engineering",
    siteId: "site-2",
    type: "Resignation",
    reason: "Higher Studies",
    resignationDate: "2026-08-01",
    noticePeriodDays: 30,
    lastWorkingDay: "2026-08-31",
    status: "Approved",
    initiatedBy: "Vikram Desai",
    clearanceItems: buildClearanceItems("off-2"),
    exitInterview: { status: "Not Scheduled" },
    settlement: { lineItems: [], netPayable: 0, status: "Pending" },
    relievingLetterStatus: "Not Generated",
    experienceLetterStatus: "Not Generated",
  },
  {
    id: "off-3",
    employeeId: "EMP009",
    employee: "Anjali Kumari",
    designation: "Recruiter",
    department: "Sales & Marketing",
    siteId: "site-4",
    type: "Resignation",
    reason: "Relocation",
    resignationDate: "2024-05-01",
    noticePeriodDays: 30,
    lastWorkingDay: "2024-05-31",
    status: "Clearance In Progress",
    initiatedBy: "Anjali Kumari",
    approverId: "EMP001",
    approverName: "Ganesh Pandey",
    decisionReason: "Approved",
    decidedOn: "2024-05-02",
    clearanceItems: buildClearanceItems("off-3", {
      "it-access": { status: "Cleared", clearedBy: "IT Team", clearedOn: "2024-05-30" },
      "it-assets": { status: "Cleared", clearedBy: "IT Team", clearedOn: "2024-05-30" },
      "it-vpn": { status: "Cleared", clearedBy: "IT Team", clearedOn: "2024-05-30" },
      "admin-idcard": { status: "Cleared", clearedBy: "Admin Team", clearedOn: "2024-05-30" },
      "admin-assets": { status: "Cleared", clearedBy: "Admin Team", clearedOn: "2024-05-30" },
      "hr-interview": { status: "Cleared", clearedBy: "Neha Verma", clearedOn: "2024-05-20" },
      "hr-handover": { status: "Cleared", clearedBy: "Neha Verma", clearedOn: "2024-05-29" },
      "fin-loans": { status: "Pending", remarks: "Awaiting full & final settlement computation" },
      "fin-salary": { status: "Pending" },
      "hr-records": { status: "Pending" },
    }),
    exitInterview: {
      status: "Completed",
      scheduledOn: "2024-05-20",
      conductedBy: "Neha Verma",
      primaryReason: "Relocation",
      feedbackNotes: "Relocating to home city for family reasons. Positive feedback about team culture and growth opportunities.",
      wouldRehire: true,
      rating: 5,
    },
    settlement: { lineItems: [], netPayable: 0, status: "Pending" },
    relievingLetterStatus: "Not Generated",
    experienceLetterStatus: "Not Generated",
  },
  {
    id: "off-4",
    employeeId: "EMP003",
    employee: "Priya Singh",
    designation: "Tech Lead",
    department: "Engineering",
    siteId: "site-2",
    type: "Resignation",
    reason: "Personal Reasons",
    resignationDate: "2024-05-18",
    noticePeriodDays: 60,
    lastWorkingDay: "2024-07-17",
    status: "Rejected",
    initiatedBy: "Priya Singh",
    approverId: "EMP002",
    approverName: "Rohit Sharma",
    decisionReason: "We'd like to retain you — let's discuss a revised role and compensation before you decide. HR will reach out this week.",
    decidedOn: "2024-05-25",
    clearanceItems: buildClearanceItems("off-4"),
    exitInterview: { status: "Not Scheduled" },
    settlement: { lineItems: [], netPayable: 0, status: "Pending" },
    relievingLetterStatus: "Not Generated",
    experienceLetterStatus: "Not Generated",
  },
];

export const seedOffboardingAudit: OffboardingAuditEntry[] = [
  { id: "off-evt-1", caseId: "off-1", employeeName: "Rahul Mehta", action: "completed", actorName: "Neha Verma", detail: "Offboarding completed — F&F settlement paid", timestamp: "2024-03-05T10:00:00.000Z" },
  { id: "off-evt-2", caseId: "off-2", employeeName: "Vikram Desai", action: "initiated", actorName: "Vikram Desai", detail: "Resignation submitted — reason: Higher Studies", timestamp: "2026-08-01T09:00:00.000Z" },
  { id: "off-evt-2b", caseId: "off-2", employeeName: "Vikram Desai", action: "approved", actorName: "Ganesh Pandey", detail: "Resignation approved — notice period in effect", timestamp: "2026-08-02T09:00:00.000Z" },
  { id: "off-evt-3", caseId: "off-3", employeeName: "Anjali Kumari", action: "approved", actorName: "Ganesh Pandey", detail: "Resignation approved", timestamp: "2024-05-02T09:00:00.000Z" },
  { id: "off-evt-4", caseId: "off-4", employeeName: "Priya Singh", action: "rejected", actorName: "Rohit Sharma", detail: "Resignation rejected — retention conversation requested", timestamp: "2024-05-25T09:00:00.000Z" },
];

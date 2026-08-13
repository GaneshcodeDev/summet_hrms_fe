import type {
  OnboardingAuditEntry,
  OnboardingCase,
  OnboardingDocument,
  OnboardingTask,
  OnboardingTaskCategory,
} from "@/lib/types";

interface TaskTemplate {
  id: string;
  title: string;
  category: OnboardingTaskCategory;
  mandatory: boolean;
}

export const onboardingTaskTemplates: TaskTemplate[] = [
  { id: "hr-offer", title: "Send & confirm signed offer letter", category: "HR", mandatory: true },
  { id: "hr-kyc", title: "Collect KYC & prior employment documents", category: "HR", mandatory: true },
  { id: "hr-record", title: "Create employee record & assign Employee ID", category: "HR", mandatory: true },
  { id: "it-email", title: "Provision company email & collaboration tools", category: "IT", mandatory: true },
  { id: "it-assets", title: "Issue laptop & IT assets", category: "IT", mandatory: true },
  { id: "admin-idcard", title: "Issue ID card & building access", category: "Admin", mandatory: true },
  { id: "admin-workstation", title: "Set up workstation & seating", category: "Admin", mandatory: false },
  { id: "mgr-buddy", title: "Assign onboarding buddy", category: "Manager", mandatory: true },
  { id: "mgr-induction", title: "Schedule Day-1 induction & team introduction", category: "Manager", mandatory: true },
  { id: "emp-policy", title: "Acknowledge company policies", category: "Employee", mandatory: true },
  { id: "emp-bank", title: "Submit bank account & PF/UAN details", category: "Employee", mandatory: true },
  { id: "emp-training", title: "Attend HR induction training", category: "Employee", mandatory: false },
];

interface DocTemplate {
  id: string;
  docType: string;
  requiresSignature: boolean;
}

export const onboardingDocumentTemplates: DocTemplate[] = [
  { id: "doc-offer", docType: "Offer Letter", requiresSignature: true },
  { id: "doc-id", docType: "ID Proof (Aadhaar/PAN)", requiresSignature: false },
  { id: "doc-edu", docType: "Educational Certificates", requiresSignature: false },
  { id: "doc-bank", docType: "Bank Proof / Cancelled Cheque", requiresSignature: false },
  { id: "doc-relieving", docType: "Previous Employment Relieving Letter", requiresSignature: false },
];

/** Builds a case's task list from the templates, marking `doneIds`/`inProgressIds` as such. */
function buildTasks(caseId: string, doneIds: string[], inProgressIds: string[], completedBy: string, completedOn: string): OnboardingTask[] {
  return onboardingTaskTemplates.map((t) => {
    const status = doneIds.includes(t.id) ? "Completed" : inProgressIds.includes(t.id) ? "In Progress" : "Pending";
    return {
      id: `${caseId}-${t.id}`,
      title: t.title,
      category: t.category,
      mandatory: t.mandatory,
      status,
      completedBy: status === "Completed" ? completedBy : undefined,
      completedOn: status === "Completed" ? completedOn : undefined,
    };
  });
}

interface DocState {
  status: OnboardingDocument["status"];
  signatureStatus: OnboardingDocument["signatureStatus"];
  fileName?: string;
  uploadedOn?: string;
  verifiedBy?: string;
  verifiedOn?: string;
  signedOn?: string;
}

function buildDocuments(caseId: string, states: Record<string, Partial<DocState>>): OnboardingDocument[] {
  return onboardingDocumentTemplates.map((d) => {
    const s = states[d.id] ?? {};
    return {
      id: `${caseId}-${d.id}`,
      docType: d.docType,
      status: s.status ?? "Pending",
      fileName: s.fileName,
      uploadedOn: s.uploadedOn,
      verifiedBy: s.verifiedBy,
      verifiedOn: s.verifiedOn,
      signatureStatus: d.requiresSignature ? (s.signatureStatus ?? "Not Sent") : "Not Required",
      signedOn: s.signedOn,
    };
  });
}

export const seedOnboardingCases: OnboardingCase[] = [
  {
    id: "ob-1",
    candidateName: "Arjun Nair",
    candidateEmail: "arjun.nair@newhire.com",
    candidatePhone: "+91 90000 11122",
    designation: "Software Engineer",
    department: "Engineering",
    siteId: "site-1",
    buddyId: "EMP002",
    joiningDate: "2024-07-01",
    status: "Pre-boarding",
    createdOn: "2024-06-10",
    tasks: buildTasks("ob-1", ["hr-offer"], ["hr-kyc"], "Neha Verma", "2024-06-11"),
    documents: buildDocuments("ob-1", {
      "doc-offer": { status: "Uploaded", fileName: "Arjun_Nair_Offer.pdf", uploadedOn: "2024-06-10", signatureStatus: "Sent" },
    }),
  },
  {
    id: "ob-2",
    candidateName: "Kabir Anand",
    candidateEmail: "kabir.anand@newhire.com",
    candidatePhone: "+91 90000 22233",
    designation: "Sales Executive",
    department: "Sales & Marketing",
    siteId: "site-4",
    buddyId: "EMP009",
    joiningDate: "2024-06-15",
    status: "In Progress",
    createdOn: "2024-05-28",
    tasks: buildTasks(
      "ob-2",
      ["hr-offer", "hr-kyc", "hr-record", "mgr-buddy"],
      ["it-email", "it-assets"],
      "Anjali Kumari",
      "2024-06-05",
    ),
    documents: buildDocuments("ob-2", {
      "doc-offer": { status: "Verified", fileName: "Kabir_Anand_Offer.pdf", uploadedOn: "2024-05-29", verifiedBy: "Anjali Kumari", verifiedOn: "2024-05-30", signatureStatus: "Signed", signedOn: "2024-05-30" },
      "doc-id": { status: "Uploaded", fileName: "Kabir_Anand_ID.pdf", uploadedOn: "2024-06-01" },
      "doc-bank": { status: "Pending" },
    }),
  },
  {
    id: "ob-3",
    candidateName: "Meera Iyer",
    candidateEmail: "meera.iyer@newhire.com",
    candidatePhone: "+91 90000 33344",
    designation: "HR Executive",
    department: "Human Resources",
    siteId: "site-3",
    buddyId: "EMP005",
    joiningDate: "2024-06-01",
    status: "In Progress",
    createdOn: "2024-05-15",
    tasks: buildTasks(
      "ob-3",
      ["hr-offer", "hr-kyc", "hr-record", "it-email", "it-assets", "admin-idcard", "mgr-buddy", "mgr-induction", "emp-policy"],
      ["emp-bank"],
      "Sneha Kapoor",
      "2024-05-30",
    ),
    documents: buildDocuments("ob-3", {
      "doc-offer": { status: "Verified", fileName: "Meera_Iyer_Offer.pdf", uploadedOn: "2024-05-16", verifiedBy: "Sneha Kapoor", verifiedOn: "2024-05-17", signatureStatus: "Signed", signedOn: "2024-05-17" },
      "doc-id": { status: "Verified", fileName: "Meera_Iyer_ID.pdf", uploadedOn: "2024-05-20", verifiedBy: "Sneha Kapoor", verifiedOn: "2024-05-21" },
      "doc-edu": { status: "Uploaded", fileName: "Meera_Iyer_Degree.pdf", uploadedOn: "2024-05-28" },
      "doc-bank": { status: "Rejected", fileName: "Meera_Iyer_Cheque.pdf", uploadedOn: "2024-05-28", verifiedBy: "Sneha Kapoor", verifiedOn: "2024-05-29" },
    }),
  },
  {
    id: "ob-4",
    candidateName: "Sneha Kapoor",
    candidateEmail: "sneha.kapoor@company.com",
    candidatePhone: "+91 98765 43214",
    designation: "HR Executive",
    department: "Human Resources",
    siteId: "site-3",
    employeeId: "EMP005",
    buddyId: "EMP004",
    joiningDate: "2022-08-05",
    status: "Completed",
    createdOn: "2022-07-20",
    completedOn: "2022-08-12",
    tasks: buildTasks(
      "ob-4",
      onboardingTaskTemplates.map((t) => t.id),
      [],
      "Neha Verma",
      "2022-08-10",
    ),
    documents: buildDocuments("ob-4", {
      "doc-offer": { status: "Verified", fileName: "Sneha_Kapoor_Offer.pdf", uploadedOn: "2022-07-21", verifiedBy: "Neha Verma", verifiedOn: "2022-07-22", signatureStatus: "Signed", signedOn: "2022-07-22" },
      "doc-id": { status: "Verified", fileName: "Sneha_Kapoor_ID.pdf", uploadedOn: "2022-07-25", verifiedBy: "Neha Verma", verifiedOn: "2022-07-26" },
      "doc-edu": { status: "Verified", fileName: "Sneha_Kapoor_Degree.pdf", uploadedOn: "2022-07-25", verifiedBy: "Neha Verma", verifiedOn: "2022-07-26" },
      "doc-bank": { status: "Verified", fileName: "Sneha_Kapoor_Cheque.pdf", uploadedOn: "2022-07-26", verifiedBy: "Neha Verma", verifiedOn: "2022-07-27" },
      "doc-relieving": { status: "Verified", fileName: "Sneha_Kapoor_Relieving.pdf", uploadedOn: "2022-07-27", verifiedBy: "Neha Verma", verifiedOn: "2022-07-28" },
    }),
  },
];

export const seedOnboardingAudit: OnboardingAuditEntry[] = [
  { id: "ob-evt-1", caseId: "ob-1", candidateName: "Arjun Nair", action: "created", actorName: "Neha Verma", detail: "Onboarding case created", timestamp: "2024-06-10T09:00:00.000Z" },
  { id: "ob-evt-2", caseId: "ob-2", candidateName: "Kabir Anand", action: "created", actorName: "Anjali Kumari", detail: "Onboarding case created", timestamp: "2024-05-28T09:00:00.000Z" },
  { id: "ob-evt-3", caseId: "ob-2", candidateName: "Kabir Anand", action: "signature_signed", actorName: "Kabir Anand", detail: "Offer Letter signed", timestamp: "2024-05-30T11:00:00.000Z" },
  { id: "ob-evt-4", caseId: "ob-3", candidateName: "Meera Iyer", action: "document_rejected", actorName: "Sneha Kapoor", detail: "Bank Proof / Cancelled Cheque rejected — image unclear, please re-upload", timestamp: "2024-05-29T10:00:00.000Z" },
  { id: "ob-evt-5", caseId: "ob-4", candidateName: "Sneha Kapoor", action: "completed", actorName: "Neha Verma", detail: "Onboarding completed — all mandatory tasks and documents cleared", timestamp: "2022-08-12T10:00:00.000Z" },
];

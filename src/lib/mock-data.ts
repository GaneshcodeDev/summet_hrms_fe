import type {
  Department,
  Employee,
  PackagePlan,
  Site,
  SiteStatus,
} from "@/lib/types";

export const sites: Site[] = [
  {
    id: "site-1",
    name: "Noida Head Office",
    code: "NOI-HQ",
    logoColor: "#4f46e5",
    addressLine1: "Tower B, Logix Techno Park",
    city: "Noida",
    state: "Uttar Pradesh",
    pincode: "201301",
    country: "India",
    package: "Enterprise",
    status: "Active",
    adminName: "Ganesh Pandey",
    adminEmail: "ganesh.pandey@company.com",
    adminPhone: "+91 98765 43210",
    createdOn: "2018-01-10",
  },
  {
    id: "site-2",
    name: "Bangalore Tech Park",
    code: "BLR-01",
    logoColor: "#0ea5e9",
    addressLine1: "Prestige Tech Park, Marathahalli",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560103",
    country: "India",
    package: "Professional",
    status: "Active",
    adminName: "Priya Singh",
    adminEmail: "priya.singh@company.com",
    adminPhone: "+91 98765 43212",
    createdOn: "2019-06-15",
  },
  {
    id: "site-3",
    name: "Delhi Corporate Office",
    code: "DEL-01",
    logoColor: "#f59e0b",
    addressLine1: "DLF Cyber Hub, Connaught Place",
    city: "Delhi",
    state: "Delhi",
    pincode: "110001",
    country: "India",
    package: "Starter",
    status: "Trial",
    adminName: "Sneha Kapoor",
    adminEmail: "sneha.kapoor@company.com",
    adminPhone: "+91 98765 43214",
    createdOn: "2024-02-20",
  },
  {
    id: "site-4",
    name: "Mumbai Business Hub",
    code: "MUM-01",
    logoColor: "#10b981",
    addressLine1: "Bandra Kurla Complex",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400051",
    country: "India",
    package: "Professional",
    status: "Active",
    adminName: "Anjali Kumari",
    adminEmail: "anjali.kumari@company.com",
    adminPhone: "+91 98765 43218",
    createdOn: "2021-11-05",
  },
];

export const packageFeatures: Record<PackagePlan, { price: string; employeeLimit: string; features: string[] }> = {
  Starter: {
    price: "₹4,999/month",
    employeeLimit: "Up to 50 employees",
    features: ["Employee Directory", "Attendance", "Leave Management"],
  },
  Professional: {
    price: "₹12,999/month",
    employeeLimit: "Up to 250 employees",
    features: ["Everything in Starter", "Payroll", "Recruitment", "Training"],
  },
  Enterprise: {
    price: "Custom pricing",
    employeeLimit: "Unlimited employees",
    features: ["Everything in Professional", "Performance Reviews", "Advanced Reports", "Priority Support"],
  },
};

export const siteStatuses: SiteStatus[] = ["Active", "Trial", "Suspended"];

export const currentUser = {
  name: "Ganesh Pandey",
  role: "Super Admin",
  employeeId: "EMP001",
  email: "ganesh.pandey@company.com",
  phone: "+91 98765 43210",
  department: "Engineering",
  designation: "Senior Software Engineer",
  dateOfJoining: "15 January 2022",
  location: "Noida, India",
  reportingTo: undefined as string | undefined,
  status: "Active" as const,
  siteId: "site-1",
  // Super Admin is mapped to every tenant site; the working-site switcher
  // shows whichever sites are listed here, so this stays in sync with `sites`.
  siteIds: sites.map((s) => s.id),
  skills: ["React.js", "Node.js", "JavaScript", "MongoDB", "AWS", "Docker"],
  education: [
    { degree: "B.Tech in Computer Science", school: "Delhi Technological University", years: "2016 - 2020" },
  ],
};

// Day-one seed data only. `employee-store.ts` seeds its persistent store from
// this array on first load; from then on the store (via `useEmployees()` /
// `@/lib/employee-context`) is the live, mutable source of truth for
// employees. Modules not yet migrated onto that store still read this array
// directly — see the architecture assessment's Phase 6 for the migration list.
export const employees: Employee[] = [
  { id: "1", employeeId: "EMP001", name: "Ganesh Pandey", email: "ganesh.pandey@company.com", phone: "+91 98765 43210", department: "Engineering", designation: "Senior Software Engineer", status: "Active", location: "Noida", dateOfJoining: "2022-01-15", siteId: "site-1", companyId: "company-1", businessUnitId: "bu-tech", departmentId: "dept-engineering", locationId: "loc-eng-wing", costCenterId: "cc-eng" },
  { id: "2", employeeId: "EMP002", name: "Rohit Sharma", email: "rohit.sharma@company.com", phone: "+91 98765 43211", department: "Engineering", designation: "Software Engineer", status: "Active", location: "Noida", dateOfJoining: "2021-03-10", siteId: "site-1", reportingManagerId: "EMP001", companyId: "company-1", businessUnitId: "bu-tech", departmentId: "dept-engineering", locationId: "loc-eng-wing", costCenterId: "cc-eng", employmentStage: "Confirmed", confirmationDate: "2021-09-10", probationPeriodMonths: 6 },
  { id: "3", employeeId: "EMP003", name: "Priya Singh", email: "priya.singh@company.com", phone: "+91 98765 43212", department: "Engineering", designation: "Tech Lead", status: "Active", location: "Bangalore", dateOfJoining: "2020-06-01", siteId: "site-2", siteIds: ["site-2", "site-4"], reportingManagerId: "EMP002", companyId: "company-2", businessUnitId: "bu-blr-eng", plantId: "plant-blr" },
  { id: "4", employeeId: "EMP004", name: "Neha Verma", email: "neha.verma@company.com", phone: "+91 98765 43213", department: "Human Resources", designation: "HR Manager", status: "Active", location: "Noida", dateOfJoining: "2019-11-20", siteId: "site-1", reportingManagerId: "EMP001", companyId: "company-1", businessUnitId: "bu-corp", departmentId: "dept-hr", locationId: "loc-hr-wing", costCenterId: "cc-hr" },
  { id: "5", employeeId: "EMP005", name: "Sneha Kapoor", email: "sneha.kapoor@company.com", phone: "+91 98765 43214", department: "Human Resources", designation: "HR Executive", status: "Active", location: "Delhi", dateOfJoining: "2022-08-05", siteId: "site-3", reportingManagerId: "EMP004", companyId: "company-3", departmentId: "dept-delhi-hr" },
  { id: "6", employeeId: "EMP006", name: "Vikram Desai", email: "vikram.desai@company.com", phone: "+91 98765 43215", department: "Engineering", designation: "DevOps Engineer", status: "Active", location: "Bangalore", dateOfJoining: "2021-09-12", siteId: "site-2", reportingManagerId: "EMP002", companyId: "company-2", businessUnitId: "bu-blr-eng", plantId: "plant-blr", employmentStage: "On Notice" },
  { id: "7", employeeId: "EMP007", name: "Amit Kumar", email: "amit.kumar@company.com", phone: "+91 98765 43216", department: "Finance", designation: "Finance Manager", status: "Active", location: "Noida", dateOfJoining: "2018-04-18", siteId: "site-1", reportingManagerId: "EMP001", companyId: "company-1", businessUnitId: "bu-corp", departmentId: "dept-finance", costCenterId: "cc-fin" },
  { id: "8", employeeId: "EMP008", name: "Rahul Mehta", email: "rahul.mehta@company.com", phone: "+91 98765 43217", department: "Finance", designation: "Accountant", status: "Inactive", location: "Delhi", dateOfJoining: "2020-02-25", siteId: "site-3", reportingManagerId: "EMP010", companyId: "company-3", employmentStage: "Exited" },
  { id: "9", employeeId: "EMP009", name: "Anjali Kumari", email: "anjali.kumari@company.com", phone: "+91 98765 43218", department: "Sales & Marketing", designation: "Recruiter", status: "Active", location: "Mumbai", dateOfJoining: "2023-01-09", siteId: "site-4", reportingManagerId: "EMP001", companyId: "company-4", departmentId: "dept-mumbai-sales" },
  { id: "10", employeeId: "EMP010", name: "Manoj Gupta", email: "manoj.gupta@company.com", phone: "+91 98765 43219", department: "Finance", designation: "Finance Manager", status: "Active", location: "Noida", dateOfJoining: "2017-07-30", siteId: "site-1", reportingManagerId: "EMP007", companyId: "company-1", businessUnitId: "bu-corp", departmentId: "dept-finance", costCenterId: "cc-fin" },
  // Recently joined, still on probation — probation end date lands inside
  // the dashboard's "due for confirmation soon" window (see
  // lifecycle-engine.ts's isProbationDueSoon) rather than being fabricated.
  { id: "11", employeeId: "EMP011", name: "Ishaan Bhatt", email: "ishaan.bhatt@company.com", phone: "+91 98765 43220", department: "Engineering", designation: "Software Engineer", status: "Active", location: "Noida", dateOfJoining: "2026-07-20", siteId: "site-1", reportingManagerId: "EMP002", companyId: "company-1", businessUnitId: "bu-tech", departmentId: "dept-engineering", locationId: "loc-eng-wing", costCenterId: "cc-eng", employmentStage: "Probation", probationPeriodMonths: 1 },
];

export const departments: Department[] = [
  { id: "1", name: "Engineering", code: "ENG", head: "Rohit Sharma", employeeCount: 210, status: "Active", siteId: "site-1" },
  { id: "2", name: "Human Resources", code: "HR", head: "Neha Verma", employeeCount: 42, status: "Active", siteId: "site-1" },
  { id: "3", name: "Finance", code: "FIN", head: "Amit Kumar", employeeCount: 58, status: "Active", siteId: "site-1" },
  { id: "4", name: "Sales & Marketing", code: "SALES", head: "Anjali Kumari", employeeCount: 45, status: "Active", siteId: "site-4" },
  { id: "5", name: "Operations", code: "OPS", head: "Vikram Desai", employeeCount: 83, status: "Active", siteId: "site-2" },
];

// Designation is now a configurable Master (see @/lib/master-data) instead of
// a hardcoded array, so it can be managed centrally like every other master.

// attendanceMay2024 / attendanceSummary removed — Attendance is now a real
// store-backed module (see attendance-store.ts / attendance-context.tsx),
// generated per employee+site rather than one hardcoded calendar for everyone.

// attendanceReport (a hardcoded 5-row fake attendance summary, unused by
// any page — real per-employee attendance comes from attendance-store.ts)
// removed in Phase 17's mock-data audit.

// The old static single-employee payslip/payroll-history mocks are gone —
// Payroll is now a real store-backed module (see payroll-engine.ts /
// payroll-context.tsx), generated per employee+site rather than one
// hardcoded example for everyone.

// Static job-opening mocks are gone — Recruitment is now a real store-backed
// module (see recruitment-store.ts / recruitment-context.tsx).

// Performance reviews are now a real store-backed module too (see
// performance-store.ts / performance-context.tsx / demo-seed.ts).

// recentActivities (fabricated "who did what" feed, unrelated to any real
// store) removed in Phase 17 — the Topbar notification bell now reads real
// AppNotification records instead (see notification-context.tsx).

// upcomingBirthdays / attendanceOverview / departmentDistribution / payrollSummary /
// payrollCostByDept were the old hardcoded Dashboard chart data — removed. Dashboard
// (Phase 5) and Payroll (Phase 6) now derive all of this from live stores.

// Training programs are now a real store-backed module (see
// training-store.ts / training-context.tsx / demo-seed.ts).

// Assets are now a real store-backed module (see asset-store.ts /
// asset-context.tsx / demo-seed.ts).

const defaultSkillSets: Record<string, string[]> = {
  Engineering: ["React.js", "Node.js", "JavaScript", "MongoDB", "AWS", "Docker"],
  "Human Resources": ["Recruitment", "Employee Relations", "HRIS", "Onboarding"],
  Finance: ["Excel", "SAP", "Financial Modeling", "Tally"],
  "Sales & Marketing": ["CRM", "Lead Generation", "Salesforce", "Negotiation"],
  Operations: ["Process Optimization", "Vendor Management", "Six Sigma"],
};

export function getEmployeeById(employeeId: string) {
  const employee = employees.find((e) => e.employeeId === employeeId);
  if (!employee) return undefined;
  if (employee.employeeId === currentUser.employeeId) {
    return { ...employee, ...currentUser };
  }
  return {
    ...employee,
    reportingTo: employee.reportingTo ?? "Ganesh Pandey",
    skills: employee.skills ?? defaultSkillSets[employee.department] ?? [],
    education: employee.education ?? [
      { degree: "B.Tech in Computer Science", school: "Delhi Technological University", years: "2014 - 2018" },
    ],
  };
}

// Role, permission-module and permission-matrix definitions now live in
// `@/lib/rbac-data` (see the Access Control module) — they moved out of mock
// data because they support full Module -> Feature -> Action grants, not just
// per-designation module booleans.

// organizationSettings (a hardcoded, unused stand-in for org branding/
// locale) removed in Phase 17's mock-data audit — the real thing is
// settings-context.tsx's AppSettings (see Settings > General/Localization).

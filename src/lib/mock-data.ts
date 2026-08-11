import type {
  Activity,
  AttendanceDay,
  AttendanceReportRow,
  AttendanceStatus,
  Department,
  Designation,
  Employee,
  JobOpening,
  LeaveRequest,
  PackagePlan,
  Payslip,
  PerformanceReview,
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

export const employees: Employee[] = [
  { id: "1", employeeId: "EMP001", name: "Ganesh Pandey", email: "ganesh.pandey@company.com", phone: "+91 98765 43210", department: "Engineering", designation: "Senior Software Engineer", status: "Active", location: "Noida", dateOfJoining: "2022-01-15", siteId: "site-1", companyId: "company-1", businessUnitId: "bu-tech", departmentId: "dept-engineering", locationId: "loc-eng-wing", costCenterId: "cc-eng" },
  { id: "2", employeeId: "EMP002", name: "Rohit Sharma", email: "rohit.sharma@company.com", phone: "+91 98765 43211", department: "Engineering", designation: "Software Engineer", status: "Active", location: "Noida", dateOfJoining: "2021-03-10", siteId: "site-1", reportingManagerId: "EMP001", companyId: "company-1", businessUnitId: "bu-tech", departmentId: "dept-engineering", locationId: "loc-eng-wing", costCenterId: "cc-eng" },
  { id: "3", employeeId: "EMP003", name: "Priya Singh", email: "priya.singh@company.com", phone: "+91 98765 43212", department: "Engineering", designation: "Tech Lead", status: "Active", location: "Bangalore", dateOfJoining: "2020-06-01", siteId: "site-2", siteIds: ["site-2", "site-4"], reportingManagerId: "EMP002", companyId: "company-2", businessUnitId: "bu-blr-eng", plantId: "plant-blr" },
  { id: "4", employeeId: "EMP004", name: "Neha Verma", email: "neha.verma@company.com", phone: "+91 98765 43213", department: "Human Resources", designation: "HR Manager", status: "Active", location: "Noida", dateOfJoining: "2019-11-20", siteId: "site-1", reportingManagerId: "EMP001", companyId: "company-1", businessUnitId: "bu-corp", departmentId: "dept-hr", locationId: "loc-hr-wing", costCenterId: "cc-hr" },
  { id: "5", employeeId: "EMP005", name: "Sneha Kapoor", email: "sneha.kapoor@company.com", phone: "+91 98765 43214", department: "Human Resources", designation: "HR Executive", status: "Active", location: "Delhi", dateOfJoining: "2022-08-05", siteId: "site-3", reportingManagerId: "EMP004", companyId: "company-3", departmentId: "dept-delhi-hr" },
  { id: "6", employeeId: "EMP006", name: "Vikram Desai", email: "vikram.desai@company.com", phone: "+91 98765 43215", department: "Engineering", designation: "DevOps Engineer", status: "Active", location: "Bangalore", dateOfJoining: "2021-09-12", siteId: "site-2", reportingManagerId: "EMP002", companyId: "company-2", businessUnitId: "bu-blr-eng", plantId: "plant-blr" },
  { id: "7", employeeId: "EMP007", name: "Amit Kumar", email: "amit.kumar@company.com", phone: "+91 98765 43216", department: "Finance", designation: "Finance Manager", status: "Active", location: "Noida", dateOfJoining: "2018-04-18", siteId: "site-1", reportingManagerId: "EMP001", companyId: "company-1", businessUnitId: "bu-corp", departmentId: "dept-finance", costCenterId: "cc-fin" },
  { id: "8", employeeId: "EMP008", name: "Rahul Mehta", email: "rahul.mehta@company.com", phone: "+91 98765 43217", department: "Finance", designation: "Accountant", status: "Inactive", location: "Delhi", dateOfJoining: "2020-02-25", siteId: "site-3", reportingManagerId: "EMP010", companyId: "company-3" },
  { id: "9", employeeId: "EMP009", name: "Anjali Kumari", email: "anjali.kumari@company.com", phone: "+91 98765 43218", department: "Sales & Marketing", designation: "Recruiter", status: "Active", location: "Mumbai", dateOfJoining: "2023-01-09", siteId: "site-4", reportingManagerId: "EMP001", companyId: "company-4", departmentId: "dept-mumbai-sales" },
  { id: "10", employeeId: "EMP010", name: "Manoj Gupta", email: "manoj.gupta@company.com", phone: "+91 98765 43219", department: "Finance", designation: "Finance Manager", status: "Active", location: "Noida", dateOfJoining: "2017-07-30", siteId: "site-1", reportingManagerId: "EMP007", companyId: "company-1", businessUnitId: "bu-corp", departmentId: "dept-finance", costCenterId: "cc-fin" },
];

export const TOTAL_EMPLOYEES = 523;

export const departments: Department[] = [
  { id: "1", name: "Engineering", code: "ENG", head: "Rohit Sharma", employeeCount: 210, status: "Active", siteId: "site-1" },
  { id: "2", name: "Human Resources", code: "HR", head: "Neha Verma", employeeCount: 42, status: "Active", siteId: "site-1" },
  { id: "3", name: "Finance", code: "FIN", head: "Amit Kumar", employeeCount: 58, status: "Active", siteId: "site-1" },
  { id: "4", name: "Sales & Marketing", code: "SALES", head: "Anjali Kumari", employeeCount: 45, status: "Active", siteId: "site-4" },
  { id: "5", name: "Operations", code: "OPS", head: "Vikram Desai", employeeCount: 83, status: "Active", siteId: "site-2" },
];

export const designations: Designation[] = [
  { id: "1", name: "CEO", department: "Management", grade: "Grade 10", employeeCount: 1, status: "Active", siteId: "site-1" },
  { id: "2", name: "CTO", department: "Engineering", grade: "Grade 9", employeeCount: 1, status: "Active", siteId: "site-1" },
  { id: "3", name: "HR Manager", department: "Human Resources", grade: "Grade 8", employeeCount: 3, status: "Active", siteId: "site-1" },
  { id: "4", name: "Software Engineer", department: "Engineering", grade: "Grade 6", employeeCount: 84, status: "Active", siteId: "site-1" },
  { id: "5", name: "HR Executive", department: "Human Resources", grade: "Grade 5", employeeCount: 12, status: "Active", siteId: "site-3" },
  { id: "6", name: "Finance Manager", department: "Finance", grade: "Grade 8", employeeCount: 4, status: "Active", siteId: "site-1" },
  { id: "7", name: "DevOps Engineer", department: "Engineering", grade: "Grade 7", employeeCount: 22, status: "Active", siteId: "site-2" },
  { id: "8", name: "Accountant", department: "Finance", grade: "Grade 4", employeeCount: 16, status: "Active", siteId: "site-3" },
  { id: "9", name: "Tech Lead", department: "Engineering", grade: "Grade 8", employeeCount: 9, status: "Active", siteId: "site-2" },
  { id: "10", name: "Recruiter", department: "Human Resources", grade: "Grade 5", employeeCount: 7, status: "Active", siteId: "site-4" },
];

export const leaveHistory: LeaveRequest[] = [
  { id: "1", employee: "Ganesh Pandey", type: "Casual Leave", from: "2024-05-30", to: "2024-05-31", days: 2, status: "Approved", reason: "Personal Work", siteId: "site-1" },
  { id: "2", employee: "Ganesh Pandey", type: "Sick Leave", from: "2024-05-10", to: "2024-05-11", days: 2, status: "Approved", reason: "Fever", siteId: "site-1" },
  { id: "3", employee: "Ganesh Pandey", type: "Earned Leave", from: "2024-04-01", to: "2024-04-05", days: 5, status: "Approved", reason: "Vacation", siteId: "site-1" },
  { id: "4", employee: "Ganesh Pandey", type: "Comp Off", from: "2024-03-15", to: "2024-03-15", days: 1, status: "Rejected", reason: "Worked on Holiday", siteId: "site-1" },
];

const attendanceOverrides: Record<number, AttendanceStatus> = {
  4: "Weekend", 5: "Weekend",
  10: "Half Day",
  11: "Weekend", 12: "Weekend",
  15: "On Leave",
  18: "Weekend", 19: "Weekend",
  22: "Absent",
  25: "Weekend", 26: "Weekend",
  27: "Holiday",
};

export const attendanceMay2024: AttendanceDay[] = Array.from({ length: 31 }, (_, i) => {
  const date = i + 1;
  return { date, status: attendanceOverrides[date] ?? "Present" };
});

export const attendanceSummary = {
  presentDays: 18,
  absentDays: 2,
  halfDays: 1,
  onLeave: 1,
  workingDays: 23,
};

export const attendanceReport: AttendanceReportRow[] = [
  { employee: "Ganesh Pandey", department: "Engineering", presentDays: 20, absentDays: 1, halfDays: 0, onLeave: 1, attendancePct: 90, siteId: "site-1" },
  { employee: "Rohit Sharma", department: "Engineering", presentDays: 21, absentDays: 0, halfDays: 1, onLeave: 0, attendancePct: 100, siteId: "site-1" },
  { employee: "Priya Singh", department: "Engineering", presentDays: 19, absentDays: 1, halfDays: 0, onLeave: 2, attendancePct: 84, siteId: "site-2" },
  { employee: "Neha Verma", department: "Human Resources", presentDays: 18, absentDays: 2, halfDays: 1, onLeave: 1, attendancePct: 82, siteId: "site-1" },
  { employee: "Sneha Kapoor", department: "Human Resources", presentDays: 17, absentDays: 1, halfDays: 2, onLeave: 2, attendancePct: 81, siteId: "site-3" },
];

export const payslip: Payslip = {
  id: "1",
  month: "May 2024",
  employee: "Ganesh Pandey",
  employeeId: "EMP001",
  designation: "Senior Software Engineer",
  paymentDate: "31 May 2024",
  bankName: "HDFC Bank",
  bankAccount: "XXXX XXXX 0134",
  earnings: [
    { label: "Basic Salary", amount: 35000 },
    { label: "HRA", amount: 14000 },
    { label: "Special Allowance", amount: 10000 },
    { label: "Other Allowance", amount: 5000 },
  ],
  deductions: [
    { label: "PF", amount: 4200 },
    { label: "Professional Tax", amount: 200 },
    { label: "Income Tax", amount: 7344 },
    { label: "Other Deductions", amount: 100 },
  ],
};

export const payrollHistory = [
  { month: "May 2024", status: "Processed on 31 May 2024" },
  { month: "April 2024", status: "Processed on 30 Apr 2024" },
  { month: "March 2024", status: "Processed on 31 Mar 2024" },
];

export const jobOpenings: JobOpening[] = [
  { id: "1", title: "Senior Software Engineer", department: "Engineering", location: "Noida", applicants: 25, status: "Active", siteId: "site-1" },
  { id: "2", title: "HR Manager", department: "Human Resources", location: "Noida", applicants: 12, status: "Active", siteId: "site-1" },
  { id: "3", title: "DevOps Engineer", department: "Engineering", location: "Bangalore", applicants: 18, status: "Active", siteId: "site-2" },
  { id: "4", title: "Sales Executive", department: "Sales & Marketing", location: "Delhi", applicants: 22, status: "Closed", siteId: "site-3" },
];

export const performanceReviews: PerformanceReview[] = [
  { id: "1", employee: "Rohit Sharma", period: "Jan 2024 - Jun 2024", status: "Completed", rating: 4.5, siteId: "site-1" },
  { id: "2", employee: "Priya Singh", period: "Jan 2024 - Jun 2024", status: "Completed", rating: 4.2, siteId: "site-2" },
  { id: "3", employee: "Vikram Desai", period: "Jan 2024 - Jun 2024", status: "In Progress", siteId: "site-2" },
  { id: "4", employee: "Sneha Kapoor", period: "Jan 2024 - Jun 2024", status: "Pending", siteId: "site-3" },
  { id: "5", employee: "Amit Kumar", period: "Jan 2024 - Jun 2024", status: "Completed", rating: 4.0, siteId: "site-1" },
];

export const recentActivities: Activity[] = [
  { id: "1", name: "Priya Singh", action: "Submitted a leave request", time: "10 min ago" },
  { id: "2", name: "Rohan Mehta", action: "Uploaded new document", time: "45 min ago" },
  { id: "3", name: "Neha Verma", action: "Approved leave request", time: "2 hr ago" },
  { id: "4", name: "Vikram Desai", action: "Joined the company", time: "1 day ago" },
  { id: "5", name: "Sneha Kapoor", action: "Updated bank details", time: "1 day ago" },
  { id: "6", name: "Ganesh Pandey", action: "Initiated a performance review", time: "2 days ago" },
  { id: "7", name: "Rohit Sharma", action: "Marked attendance for the week", time: "3 days ago" },
  { id: "8", name: "Anjali Kumari", action: "Onboarded a new site", time: "4 days ago" },
];

export const upcomingBirthdays = [
  { name: "Anjali Kumari", date: "May 20" },
  { name: "Vikram Desai", date: "May 26" },
  { name: "Sneha Kapoor", date: "Jun 02" },
];

export const attendanceOverview = [
  { day: "Mon", value: 92 }, { day: "Tue", value: 88 }, { day: "Wed", value: 95 },
  { day: "Thu", value: 90 }, { day: "Fri", value: 97 }, { day: "Sat", value: 40 },
  { day: "Sun", value: 20 },
];

export const departmentDistribution = [
  { name: "Engineering", value: 40, color: "#4f46e5" },
  { name: "Sales & Marketing", value: 20, color: "#f59e0b" },
  { name: "Finance", value: 15, color: "#10b981" },
  { name: "HR", value: 15, color: "#0ea5e9" },
  { name: "Others", value: 10, color: "#94a3b8" },
];

export const payrollSummary = [
  { month: "Jan", value: 95 }, { month: "Feb", value: 100 }, { month: "Mar", value: 88 },
  { month: "Apr", value: 105 }, { month: "May", value: 112 }, { month: "Jun", value: 98 },
];

export const payrollCostByDept = [
  { name: "Engineering", value: 40, color: "#4f46e5" },
  { name: "Sales & Marketing", value: 20, color: "#f59e0b" },
  { name: "HR", value: 20, color: "#0ea5e9" },
  { name: "Finance", value: 20, color: "#10b981" },
];

export const leaveBalances = [
  { label: "Casual Leave", used: 12, total: 15 },
  { label: "Sick Leave", used: 10, total: 12 },
  { label: "Earned Leave", used: 18, total: 20 },
  { label: "Comp Off", used: 4, total: 5 },
];

export const teamLeaveRequests: LeaveRequest[] = [
  { id: "5", employee: "Rohit Sharma", type: "Casual Leave", from: "2024-05-22", to: "2024-05-23", days: 2, status: "Pending", reason: "Family function", siteId: "site-1" },
  { id: "6", employee: "Priya Singh", type: "Sick Leave", from: "2024-05-18", to: "2024-05-18", days: 1, status: "Approved", reason: "Fever", siteId: "site-2" },
  { id: "7", employee: "Vikram Desai", type: "Earned Leave", from: "2024-06-03", to: "2024-06-07", days: 5, status: "Pending", reason: "Vacation", siteId: "site-2" },
  { id: "8", employee: "Sneha Kapoor", type: "Comp Off", from: "2024-05-11", to: "2024-05-11", days: 1, status: "Approved", reason: "Worked on weekend", siteId: "site-3" },
];

export interface Document {
  id: string;
  name: string;
  type: string;
  uploadedOn: string;
  status: "Verified" | "Pending";
}

export interface BankDetail {
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  panNumber: string;
  uan: string;
}

export interface SalaryStructure {
  ctc: number;
  earnings: { label: string; amount: number }[];
  deductions: { label: string; amount: number }[];
}

const defaultDocuments: Document[] = [
  { id: "1", name: "Aadhar Card.pdf", type: "Identity Proof", uploadedOn: "2022-01-15", status: "Verified" },
  { id: "2", name: "PAN Card.pdf", type: "Identity Proof", uploadedOn: "2022-01-15", status: "Verified" },
  { id: "3", name: "Offer Letter.pdf", type: "Employment", uploadedOn: "2022-01-15", status: "Verified" },
  { id: "4", name: "Relieving Letter.pdf", type: "Employment", uploadedOn: "2022-01-20", status: "Pending" },
  { id: "5", name: "Educational Certificate.pdf", type: "Education", uploadedOn: "2022-01-16", status: "Verified" },
];

const defaultBankDetail: BankDetail = {
  bankName: "HDFC Bank",
  accountNumber: "XXXX XXXX 0134",
  ifsc: "HDFC0001234",
  branch: "Sector 62, Noida",
  panNumber: "ABCDE1234F",
  uan: "101234567890",
};

export function getEmployeeSalaryStructure(employee: Employee): SalaryStructure {
  const baseSeed = employee.employeeId.charCodeAt(3) % 5;
  const basic = 30000 + baseSeed * 5000;
  return {
    ctc: (basic + basic * 0.4 + basic * 0.3) * 12,
    earnings: [
      { label: "Basic Salary", amount: basic },
      { label: "HRA", amount: Math.round(basic * 0.4) },
      { label: "Special Allowance", amount: Math.round(basic * 0.25) },
      { label: "Other Allowance", amount: 5000 },
    ],
    deductions: [
      { label: "PF", amount: Math.round(basic * 0.12) },
      { label: "Professional Tax", amount: 200 },
      { label: "Income Tax", amount: Math.round(basic * 0.15) },
      { label: "Other Deductions", amount: 100 },
    ],
  };
}

export function getEmployeeDocuments(employee: Employee): Document[] {
  return defaultDocuments.map((d) => ({ ...d, id: `${employee.id}-${d.id}` }));
}

export function getEmployeeBankDetail(): BankDetail {
  return defaultBankDetail;
}

export interface TrainingProgram {
  id: string;
  title: string;
  category: string;
  trainer: string;
  startDate: string;
  endDate: string;
  enrolled: number;
  status: "Upcoming" | "Ongoing" | "Completed";
  siteId: string;
}

export const trainingPrograms: TrainingProgram[] = [
  { id: "1", title: "React Advanced Patterns", category: "Technical", trainer: "Rohit Sharma", startDate: "2024-06-10", endDate: "2024-06-14", enrolled: 24, status: "Upcoming", siteId: "site-1" },
  { id: "2", title: "Leadership Essentials", category: "Soft Skills", trainer: "Neha Verma", startDate: "2024-05-20", endDate: "2024-05-24", enrolled: 18, status: "Ongoing", siteId: "site-1" },
  { id: "3", title: "AWS Cloud Practitioner", category: "Technical", trainer: "Vikram Desai", startDate: "2024-04-01", endDate: "2024-04-30", enrolled: 32, status: "Completed", siteId: "site-2" },
  { id: "4", title: "POSH Awareness", category: "Compliance", trainer: "Sneha Kapoor", startDate: "2024-05-15", endDate: "2024-05-15", enrolled: 210, status: "Completed", siteId: "site-3" },
  { id: "5", title: "Financial Planning 101", category: "Finance", trainer: "Amit Kumar", startDate: "2024-06-20", endDate: "2024-06-21", enrolled: 12, status: "Upcoming", siteId: "site-1" },
];

export interface Asset {
  id: string;
  name: string;
  type: string;
  serialNumber: string;
  assignedTo: string;
  assignedDate: string;
  status: "Assigned" | "Available" | "Under Repair";
  siteId: string;
}

export const assets: Asset[] = [
  { id: "1", name: 'MacBook Pro 14"', type: "Laptop", serialNumber: "MBP14-2201", assignedTo: "Ganesh Pandey", assignedDate: "2022-01-16", status: "Assigned", siteId: "site-1" },
  { id: "2", name: "Dell Latitude 5420", type: "Laptop", serialNumber: "DL5420-1180", assignedTo: "Rohit Sharma", assignedDate: "2021-03-11", status: "Assigned", siteId: "site-1" },
  { id: "3", name: "iPhone 13", type: "Mobile", serialNumber: "IP13-0091", assignedTo: "Priya Singh", assignedDate: "2020-06-05", status: "Assigned", siteId: "site-2" },
  { id: "4", name: "LG UltraWide Monitor", type: "Monitor", serialNumber: "LGUW-0456", assignedTo: "—", assignedDate: "—", status: "Available", siteId: "site-1" },
  { id: "5", name: "Dell Latitude 5420", type: "Laptop", serialNumber: "DL5420-1181", assignedTo: "—", assignedDate: "—", status: "Under Repair", siteId: "site-2" },
  { id: "6", name: "Logitech MX Master 3", type: "Accessory", serialNumber: "LGMX-3390", assignedTo: "Vikram Desai", assignedDate: "2021-09-15", status: "Assigned", siteId: "site-2" },
];

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

export const organizationSettings = {
  name: "Tech Solutions Pvt Ltd",
  logo: "",
  dateFormat: "DD MMM YYYY",
  timeFormat: "12 Hour",
  currency: "INR (₹) - Indian Rupee",
};

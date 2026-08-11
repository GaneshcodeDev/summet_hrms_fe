import {
  Users,
  IdCard,
  Layers,
  Briefcase,
  UserCog,
  MapPin,
  Factory,
  Clock,
  Clock3,
  CalendarDays,
  PartyPopper,
  Wallet,
  PiggyBank,
  MinusCircle,
  GraduationCap,
  Sparkles,
  FileText,
  UserX,
  Radar,
  Coins,
  TrendingUp,
  Landmark,
  Globe,
  Map,
  Building,
  type LucideIcon,
} from "lucide-react";
import type { MasterAttributes, MasterFieldType, MasterRecord, MasterType } from "@/lib/types";
import { departments } from "@/lib/mock-data";

export interface MasterFieldDef {
  key: string;
  label: string;
  type: MasterFieldType;
  required?: boolean;
  /** Static option list, for plain selects not backed by another master. */
  options?: string[];
  /** Dynamic option list — resolved from another master type's active records. */
  refMasterType?: MasterType;
  placeholder?: string;
}

export interface MasterTypeConfig {
  type: MasterType;
  label: string;
  pluralLabel: string;
  slug: string;
  icon: LucideIcon;
  description: string;
  group: string;
  /** Tenant-scoped masters are filtered by the active site; global masters apply everywhere. */
  scope: "tenant" | "global";
  fields: MasterFieldDef[];
  /**
   * Some requested "masters" are already owned by another module (the
   * Organization unit hierarchy) — defining them again here would create the
   * exact duplicate source of truth the module is meant to avoid. Those
   * entries are catalog-only and deep-link out instead of offering CRUD.
   */
  managedExternally?: { moduleLabel: string; href: string };
}

const orgManaged = (label: string, slug: string) => ({
  moduleLabel: "Organization",
  href: `/organization/units/${slug}`,
});

export const masterTypeConfig: Record<MasterType, MasterTypeConfig> = {
  Department: {
    type: "Department",
    label: "Department",
    pluralLabel: "Departments",
    slug: "department",
    icon: Users,
    description: "Working department within the org structure",
    group: "Organization-linked",
    scope: "tenant",
    fields: [],
    managedExternally: orgManaged("Department", "departments"),
  },
  Designation: {
    type: "Designation",
    label: "Designation",
    pluralLabel: "Designations",
    slug: "designation",
    icon: IdCard,
    description: "Job title an employee holds",
    group: "Employment",
    scope: "tenant",
    fields: [
      { key: "department", label: "Department", type: "select", options: departments.map((d) => d.name) },
      { key: "gradeId", label: "Job Grade", type: "select", refMasterType: "JobGrade" },
    ],
  },
  JobGrade: {
    type: "JobGrade",
    label: "Job Grade",
    pluralLabel: "Job Grades",
    slug: "job-grade",
    icon: Layers,
    description: "Pay/seniority grade used to band designations",
    group: "Employment",
    scope: "tenant",
    fields: [{ key: "level", label: "Level (rank)", type: "number", required: true }],
  },
  EmploymentType: {
    type: "EmploymentType",
    label: "Employment Type",
    pluralLabel: "Employment Types",
    slug: "employment-type",
    icon: Briefcase,
    description: "Full-time, part-time, contract, intern, etc.",
    group: "Employment",
    scope: "tenant",
    fields: [],
  },
  EmployeeType: {
    type: "EmployeeType",
    label: "Employee Type",
    pluralLabel: "Employee Types",
    slug: "employee-type",
    icon: UserCog,
    description: "Permanent, probation, temporary, contractor",
    group: "Employment",
    scope: "tenant",
    fields: [],
  },
  Location: {
    type: "Location",
    label: "Location",
    pluralLabel: "Locations",
    slug: "location",
    icon: MapPin,
    description: "Block, building, floor or precise work location",
    group: "Organization-linked",
    scope: "tenant",
    fields: [],
    managedExternally: orgManaged("Location", "locations"),
  },
  Plant: {
    type: "Plant",
    label: "Plant",
    pluralLabel: "Plants",
    slug: "plant",
    icon: Factory,
    description: "Manufacturing or delivery facility",
    group: "Organization-linked",
    scope: "tenant",
    fields: [],
    managedExternally: orgManaged("Plant", "plants"),
  },
  Shift: {
    type: "Shift",
    label: "Shift",
    pluralLabel: "Shifts",
    slug: "shift",
    icon: Clock,
    description: "A specific work shift timing",
    group: "Time & Attendance",
    scope: "tenant",
    fields: [
      { key: "shiftTypeId", label: "Shift Type", type: "select", refMasterType: "ShiftType", required: true },
      { key: "startTime", label: "Start Time", type: "time", required: true },
      { key: "endTime", label: "End Time", type: "time", required: true },
    ],
  },
  ShiftType: {
    type: "ShiftType",
    label: "Shift Type",
    pluralLabel: "Shift Types",
    slug: "shift-type",
    icon: Clock3,
    description: "Category a shift belongs to (day, night, rotational)",
    group: "Time & Attendance",
    scope: "tenant",
    fields: [],
  },
  LeaveType: {
    type: "LeaveType",
    label: "Leave Type",
    pluralLabel: "Leave Types",
    slug: "leave-type",
    icon: CalendarDays,
    description: "Casual, sick, earned leave and similar policies",
    group: "Time & Attendance",
    scope: "tenant",
    fields: [
      { key: "paid", label: "Paid Leave", type: "boolean" },
      { key: "maxDaysPerYear", label: "Max Days / Year", type: "number" },
    ],
  },
  HolidayType: {
    type: "HolidayType",
    label: "Holiday Type",
    pluralLabel: "Holiday Types",
    slug: "holiday-type",
    icon: PartyPopper,
    description: "National, restricted or regional holiday category",
    group: "Time & Attendance",
    scope: "tenant",
    fields: [],
  },
  SalaryComponent: {
    type: "SalaryComponent",
    label: "Salary Component",
    pluralLabel: "Salary Components",
    slug: "salary-component",
    icon: Wallet,
    description: "Earning or deduction line used to build a salary structure",
    group: "Payroll",
    scope: "tenant",
    fields: [
      { key: "componentType", label: "Component Type", type: "select", options: ["Earning", "Deduction"], required: true },
      { key: "calculationType", label: "Calculation Type", type: "select", options: ["Fixed", "Percentage"] },
      { key: "taxable", label: "Taxable", type: "boolean" },
    ],
  },
  Allowance: {
    type: "Allowance",
    label: "Allowance",
    pluralLabel: "Allowances",
    slug: "allowance",
    icon: PiggyBank,
    description: "HRA, conveyance, medical and other allowances",
    group: "Payroll",
    scope: "tenant",
    fields: [
      { key: "calculationType", label: "Calculation Type", type: "select", options: ["Fixed", "Percentage"] },
      { key: "taxable", label: "Taxable", type: "boolean" },
    ],
  },
  Deduction: {
    type: "Deduction",
    label: "Deduction",
    pluralLabel: "Deductions",
    slug: "deduction",
    icon: MinusCircle,
    description: "PF, ESI, professional tax, loan recoveries",
    group: "Payroll",
    scope: "tenant",
    fields: [
      { key: "calculationType", label: "Calculation Type", type: "select", options: ["Fixed", "Percentage"] },
      { key: "statutory", label: "Statutory", type: "boolean" },
    ],
  },
  Qualification: {
    type: "Qualification",
    label: "Qualification",
    pluralLabel: "Qualifications",
    slug: "qualification",
    icon: GraduationCap,
    description: "Academic qualification for employee records",
    group: "People",
    scope: "tenant",
    fields: [],
  },
  Skill: {
    type: "Skill",
    label: "Skill",
    pluralLabel: "Skills",
    slug: "skill",
    icon: Sparkles,
    description: "Technical or functional skill tag",
    group: "People",
    scope: "tenant",
    fields: [],
  },
  DocumentType: {
    type: "DocumentType",
    label: "Document Type",
    pluralLabel: "Document Types",
    slug: "document-type",
    icon: FileText,
    description: "Category used to classify uploaded employee documents",
    group: "People",
    scope: "tenant",
    fields: [],
  },
  SeparationReason: {
    type: "SeparationReason",
    label: "Separation Reason",
    pluralLabel: "Separation Reasons",
    slug: "separation-reason",
    icon: UserX,
    description: "Reason recorded when an employee exits",
    group: "People",
    scope: "tenant",
    fields: [],
  },
  RecruitmentSource: {
    type: "RecruitmentSource",
    label: "Recruitment Source",
    pluralLabel: "Recruitment Sources",
    slug: "recruitment-source",
    icon: Radar,
    description: "Where a candidate application originated from",
    group: "Recruitment",
    scope: "tenant",
    fields: [],
  },
  CostCenter: {
    type: "CostCenter",
    label: "Cost Center",
    pluralLabel: "Cost Centers",
    slug: "cost-center",
    icon: Coins,
    description: "Accounting unit costs are tracked against",
    group: "Organization-linked",
    scope: "tenant",
    fields: [],
    managedExternally: orgManaged("Cost Center", "cost-centers"),
  },
  ProfitCenter: {
    type: "ProfitCenter",
    label: "Profit Center",
    pluralLabel: "Profit Centers",
    slug: "profit-center",
    icon: TrendingUp,
    description: "Accounting unit revenue and cost are tracked against",
    group: "Organization-linked",
    scope: "tenant",
    fields: [],
    managedExternally: orgManaged("Profit Center", "profit-centers"),
  },
  Bank: {
    type: "Bank",
    label: "Bank",
    pluralLabel: "Banks",
    slug: "bank",
    icon: Landmark,
    description: "Bank used for employee salary accounts",
    group: "Location & Finance",
    scope: "global",
    fields: [{ key: "ifscPrefix", label: "IFSC Prefix", type: "text", placeholder: "e.g. HDFC" }],
  },
  Country: {
    type: "Country",
    label: "Country",
    pluralLabel: "Countries",
    slug: "country",
    icon: Globe,
    description: "Country reference list",
    group: "Location & Finance",
    scope: "global",
    fields: [],
  },
  State: {
    type: "State",
    label: "State",
    pluralLabel: "States",
    slug: "state",
    icon: Map,
    description: "State or province within a country",
    group: "Location & Finance",
    scope: "global",
    fields: [{ key: "countryId", label: "Country", type: "select", refMasterType: "Country", required: true }],
  },
  City: {
    type: "City",
    label: "City",
    pluralLabel: "Cities",
    slug: "city",
    icon: Building,
    description: "City within a state",
    group: "Location & Finance",
    scope: "global",
    fields: [{ key: "stateId", label: "State", type: "select", refMasterType: "State", required: true }],
  },
};

export const masterTypeList: MasterTypeConfig[] = Object.values(masterTypeConfig);

export function masterTypeBySlug(slug: string): MasterTypeConfig | undefined {
  return masterTypeList.find((c) => c.slug === slug);
}

export const masterGroupOrder = [
  "Organization-linked",
  "Employment",
  "Time & Attendance",
  "Payroll",
  "People",
  "Recruitment",
  "Location & Finance",
];

/* ------------------------------------------------------------------ */
/* Seed data for the master types this module owns                     */
/* ------------------------------------------------------------------ */

function record(input: {
  id: string;
  masterType: MasterType;
  name: string;
  code: string;
  siteId?: string;
  description?: string;
  attributes?: MasterAttributes;
  status?: "Active" | "Inactive";
  createdOn?: string;
}): MasterRecord {
  return {
    status: "Active",
    attributes: {},
    createdOn: "2022-01-10",
    updatedOn: "2022-01-10",
    ...input,
  };
}

// Job Grades (referenced by Designation.gradeId)
const jg4 = record({ id: "jobgrade-4", masterType: "JobGrade", name: "Grade 4", code: "G4", siteId: "site-1", attributes: { level: 4 } });
const jg5 = record({ id: "jobgrade-5", masterType: "JobGrade", name: "Grade 5", code: "G5", siteId: "site-1", attributes: { level: 5 } });
const jg6 = record({ id: "jobgrade-6", masterType: "JobGrade", name: "Grade 6", code: "G6", siteId: "site-1", attributes: { level: 6 } });
const jg7 = record({ id: "jobgrade-7", masterType: "JobGrade", name: "Grade 7", code: "G7", siteId: "site-1", attributes: { level: 7 } });
const jg8 = record({ id: "jobgrade-8", masterType: "JobGrade", name: "Grade 8", code: "G8", siteId: "site-1", attributes: { level: 8 } });
const jg9 = record({ id: "jobgrade-9", masterType: "JobGrade", name: "Grade 9", code: "G9", siteId: "site-1", attributes: { level: 9 } });
const jg10 = record({ id: "jobgrade-10", masterType: "JobGrade", name: "Grade 10", code: "G10", siteId: "site-1", attributes: { level: 10 } });

// Shift Types (referenced by Shift.shiftTypeId)
const stGeneral = record({ id: "shifttype-general", masterType: "ShiftType", name: "General", code: "GEN", siteId: "site-1" });
const stDay = record({ id: "shifttype-day", masterType: "ShiftType", name: "Day Shift", code: "DAY", siteId: "site-1" });
const stNight = record({ id: "shifttype-night", masterType: "ShiftType", name: "Night Shift", code: "NGT", siteId: "site-1" });
const stRotational = record({ id: "shifttype-rotational", masterType: "ShiftType", name: "Rotational", code: "ROT", siteId: "site-1" });

// Countries / States / Cities (global, cross-referenced)
const cIndia = record({ id: "country-in", masterType: "Country", name: "India", code: "IN" });
const cUS = record({ id: "country-us", masterType: "Country", name: "United States", code: "US" });
const cUK = record({ id: "country-uk", masterType: "Country", name: "United Kingdom", code: "UK" });

const stateUP = record({ id: "state-up", masterType: "State", name: "Uttar Pradesh", code: "UP", attributes: { countryId: cIndia.id } });
const stateKA = record({ id: "state-ka", masterType: "State", name: "Karnataka", code: "KA", attributes: { countryId: cIndia.id } });
const stateDL = record({ id: "state-dl", masterType: "State", name: "Delhi", code: "DL", attributes: { countryId: cIndia.id } });
const stateMH = record({ id: "state-mh", masterType: "State", name: "Maharashtra", code: "MH", attributes: { countryId: cIndia.id } });
const stateTN = record({ id: "state-tn", masterType: "State", name: "Tamil Nadu", code: "TN", attributes: { countryId: cIndia.id } });

export const seedMasterRecords: MasterRecord[] = [
  jg4, jg5, jg6, jg7, jg8, jg9, jg10,
  stGeneral, stDay, stNight, stRotational,
  cIndia, cUS, cUK,
  stateUP, stateKA, stateDL, stateMH, stateTN,

  record({ id: "city-noida", masterType: "City", name: "Noida", code: "NOI", attributes: { stateId: stateUP.id } }),
  record({ id: "city-bangalore", masterType: "City", name: "Bangalore", code: "BLR", attributes: { stateId: stateKA.id } }),
  record({ id: "city-newdelhi", masterType: "City", name: "New Delhi", code: "DEL", attributes: { stateId: stateDL.id } }),
  record({ id: "city-mumbai", masterType: "City", name: "Mumbai", code: "MUM", attributes: { stateId: stateMH.id } }),
  record({ id: "city-chennai", masterType: "City", name: "Chennai", code: "CHN", attributes: { stateId: stateTN.id } }),

  record({ id: "bank-hdfc", masterType: "Bank", name: "HDFC Bank", code: "HDFC", attributes: { ifscPrefix: "HDFC" } }),
  record({ id: "bank-icici", masterType: "Bank", name: "ICICI Bank", code: "ICICI", attributes: { ifscPrefix: "ICIC" } }),
  record({ id: "bank-sbi", masterType: "Bank", name: "State Bank of India", code: "SBI", attributes: { ifscPrefix: "SBIN" } }),
  record({ id: "bank-axis", masterType: "Bank", name: "Axis Bank", code: "AXIS", attributes: { ifscPrefix: "UTIB" } }),
  record({ id: "bank-kotak", masterType: "Bank", name: "Kotak Mahindra Bank", code: "KOTAK", attributes: { ifscPrefix: "KKBK" } }),

  record({ id: "designation-ceo", masterType: "Designation", name: "CEO", code: "CEO", siteId: "site-1", attributes: { department: "Operations", gradeId: jg10.id } }),
  record({ id: "designation-cto", masterType: "Designation", name: "CTO", code: "CTO", siteId: "site-1", attributes: { department: "Engineering", gradeId: jg9.id } }),
  record({ id: "designation-hr-manager", masterType: "Designation", name: "HR Manager", code: "HRM", siteId: "site-1", attributes: { department: "Human Resources", gradeId: jg8.id } }),
  record({ id: "designation-swe", masterType: "Designation", name: "Software Engineer", code: "SWE", siteId: "site-1", attributes: { department: "Engineering", gradeId: jg6.id } }),
  record({ id: "designation-sr-swe", masterType: "Designation", name: "Senior Software Engineer", code: "SRSWE", siteId: "site-1", attributes: { department: "Engineering", gradeId: jg7.id } }),
  record({ id: "designation-hr-exec", masterType: "Designation", name: "HR Executive", code: "HREX", siteId: "site-3", attributes: { department: "Human Resources", gradeId: jg5.id } }),
  record({ id: "designation-finance-manager", masterType: "Designation", name: "Finance Manager", code: "FINM", siteId: "site-1", attributes: { department: "Finance", gradeId: jg8.id } }),
  record({ id: "designation-devops", masterType: "Designation", name: "DevOps Engineer", code: "DEVOPS", siteId: "site-2", attributes: { department: "Engineering", gradeId: jg7.id } }),
  record({ id: "designation-accountant", masterType: "Designation", name: "Accountant", code: "ACCT", siteId: "site-3", attributes: { department: "Finance", gradeId: jg4.id } }),
  record({ id: "designation-tech-lead", masterType: "Designation", name: "Tech Lead", code: "TL", siteId: "site-2", attributes: { department: "Engineering", gradeId: jg8.id } }),
  record({ id: "designation-recruiter", masterType: "Designation", name: "Recruiter", code: "RECR", siteId: "site-4", attributes: { department: "Sales & Marketing", gradeId: jg5.id } }),

  record({ id: "emptype-fulltime", masterType: "EmploymentType", name: "Full-Time", code: "FT", siteId: "site-1" }),
  record({ id: "emptype-parttime", masterType: "EmploymentType", name: "Part-Time", code: "PT", siteId: "site-1" }),
  record({ id: "emptype-contract", masterType: "EmploymentType", name: "Contract", code: "CTR", siteId: "site-1" }),
  record({ id: "emptype-intern", masterType: "EmploymentType", name: "Intern", code: "INT", siteId: "site-1" }),
  record({ id: "emptype-consultant", masterType: "EmploymentType", name: "Consultant", code: "CNS", siteId: "site-1" }),

  record({ id: "emptypecat-permanent", masterType: "EmployeeType", name: "Permanent", code: "PERM", siteId: "site-1" }),
  record({ id: "emptypecat-probation", masterType: "EmployeeType", name: "Probation", code: "PROB", siteId: "site-1" }),
  record({ id: "emptypecat-temporary", masterType: "EmployeeType", name: "Temporary", code: "TEMP", siteId: "site-1" }),
  record({ id: "emptypecat-contractor", masterType: "EmployeeType", name: "Contractor", code: "CTRC", siteId: "site-1" }),

  record({ id: "shift-general", masterType: "Shift", name: "General Shift", code: "SH-GEN", siteId: "site-1", attributes: { shiftTypeId: stGeneral.id, startTime: "09:00", endTime: "18:00" } }),
  record({ id: "shift-morning", masterType: "Shift", name: "Morning Shift", code: "SH-MOR", siteId: "site-1", attributes: { shiftTypeId: stDay.id, startTime: "06:00", endTime: "14:00" } }),
  record({ id: "shift-evening", masterType: "Shift", name: "Evening Shift", code: "SH-EVE", siteId: "site-1", attributes: { shiftTypeId: stDay.id, startTime: "14:00", endTime: "22:00" } }),
  record({ id: "shift-night", masterType: "Shift", name: "Night Shift", code: "SH-NGT", siteId: "site-1", attributes: { shiftTypeId: stNight.id, startTime: "22:00", endTime: "06:00" } }),

  record({ id: "leavetype-casual", masterType: "LeaveType", name: "Casual Leave", code: "CL", siteId: "site-1", attributes: { paid: true, maxDaysPerYear: 12 } }),
  record({ id: "leavetype-sick", masterType: "LeaveType", name: "Sick Leave", code: "SL", siteId: "site-1", attributes: { paid: true, maxDaysPerYear: 12 } }),
  record({ id: "leavetype-earned", masterType: "LeaveType", name: "Earned Leave", code: "EL", siteId: "site-1", attributes: { paid: true, maxDaysPerYear: 20 } }),
  record({ id: "leavetype-compoff", masterType: "LeaveType", name: "Comp Off", code: "CO", siteId: "site-1", attributes: { paid: true, maxDaysPerYear: 5 } }),
  record({ id: "leavetype-lop", masterType: "LeaveType", name: "Loss of Pay", code: "LOP", siteId: "site-1", attributes: { paid: false, maxDaysPerYear: 0 } }),
  record({ id: "leavetype-maternity", masterType: "LeaveType", name: "Maternity Leave", code: "ML", siteId: "site-1", attributes: { paid: true, maxDaysPerYear: 182 } }),
  record({ id: "leavetype-paternity", masterType: "LeaveType", name: "Paternity Leave", code: "PL", siteId: "site-1", attributes: { paid: true, maxDaysPerYear: 15 } }),

  record({ id: "holidaytype-national", masterType: "HolidayType", name: "National Holiday", code: "NAT", siteId: "site-1" }),
  record({ id: "holidaytype-restricted", masterType: "HolidayType", name: "Restricted Holiday", code: "RH", siteId: "site-1" }),
  record({ id: "holidaytype-regional", masterType: "HolidayType", name: "Regional Holiday", code: "REG", siteId: "site-1" }),

  record({ id: "salcomp-basic", masterType: "SalaryComponent", name: "Basic Salary", code: "BASIC", siteId: "site-1", attributes: { componentType: "Earning", calculationType: "Percentage", taxable: true } }),
  record({ id: "salcomp-hra", masterType: "SalaryComponent", name: "HRA", code: "HRA", siteId: "site-1", attributes: { componentType: "Earning", calculationType: "Percentage", taxable: false } }),
  record({ id: "salcomp-special", masterType: "SalaryComponent", name: "Special Allowance", code: "SPLA", siteId: "site-1", attributes: { componentType: "Earning", calculationType: "Fixed", taxable: true } }),
  record({ id: "salcomp-other-allow", masterType: "SalaryComponent", name: "Other Allowance", code: "OALW", siteId: "site-1", attributes: { componentType: "Earning", calculationType: "Fixed", taxable: true } }),
  record({ id: "salcomp-pf", masterType: "SalaryComponent", name: "Provident Fund", code: "PF", siteId: "site-1", attributes: { componentType: "Deduction", calculationType: "Percentage", taxable: false } }),
  record({ id: "salcomp-pt", masterType: "SalaryComponent", name: "Professional Tax", code: "PT", siteId: "site-1", attributes: { componentType: "Deduction", calculationType: "Fixed", taxable: false } }),
  record({ id: "salcomp-it", masterType: "SalaryComponent", name: "Income Tax", code: "IT", siteId: "site-1", attributes: { componentType: "Deduction", calculationType: "Percentage", taxable: false } }),
  record({ id: "salcomp-other-ded", masterType: "SalaryComponent", name: "Other Deductions", code: "ODED", siteId: "site-1", attributes: { componentType: "Deduction", calculationType: "Fixed", taxable: false } }),

  record({ id: "allowance-hra", masterType: "Allowance", name: "HRA", code: "HRA", siteId: "site-1", attributes: { calculationType: "Percentage", taxable: false } }),
  record({ id: "allowance-conveyance", masterType: "Allowance", name: "Conveyance Allowance", code: "CONV", siteId: "site-1", attributes: { calculationType: "Fixed", taxable: false } }),
  record({ id: "allowance-medical", masterType: "Allowance", name: "Medical Allowance", code: "MED", siteId: "site-1", attributes: { calculationType: "Fixed", taxable: false } }),
  record({ id: "allowance-special", masterType: "Allowance", name: "Special Allowance", code: "SPL", siteId: "site-1", attributes: { calculationType: "Fixed", taxable: true } }),
  record({ id: "allowance-travel", masterType: "Allowance", name: "Travel Allowance", code: "TRV", siteId: "site-1", attributes: { calculationType: "Fixed", taxable: true } }),

  record({ id: "deduction-pf", masterType: "Deduction", name: "Provident Fund", code: "PF", siteId: "site-1", attributes: { calculationType: "Percentage", statutory: true } }),
  record({ id: "deduction-esi", masterType: "Deduction", name: "ESI", code: "ESI", siteId: "site-1", attributes: { calculationType: "Percentage", statutory: true } }),
  record({ id: "deduction-pt", masterType: "Deduction", name: "Professional Tax", code: "PT", siteId: "site-1", attributes: { calculationType: "Fixed", statutory: true } }),
  record({ id: "deduction-it", masterType: "Deduction", name: "Income Tax (TDS)", code: "TDS", siteId: "site-1", attributes: { calculationType: "Percentage", statutory: true } }),
  record({ id: "deduction-loan", masterType: "Deduction", name: "Loan Recovery", code: "LOAN", siteId: "site-1", attributes: { calculationType: "Fixed", statutory: false } }),
  record({ id: "deduction-advance", masterType: "Deduction", name: "Salary Advance", code: "ADV", siteId: "site-1", attributes: { calculationType: "Fixed", statutory: false } }),

  record({ id: "qual-btech", masterType: "Qualification", name: "B.Tech", code: "BTECH", siteId: "site-1" }),
  record({ id: "qual-mtech", masterType: "Qualification", name: "M.Tech", code: "MTECH", siteId: "site-1" }),
  record({ id: "qual-mba", masterType: "Qualification", name: "MBA", code: "MBA", siteId: "site-1" }),
  record({ id: "qual-bcom", masterType: "Qualification", name: "B.Com", code: "BCOM", siteId: "site-1" }),
  record({ id: "qual-mca", masterType: "Qualification", name: "MCA", code: "MCA", siteId: "site-1" }),
  record({ id: "qual-12th", masterType: "Qualification", name: "12th Standard", code: "12TH", siteId: "site-1" }),
  record({ id: "qual-diploma", masterType: "Qualification", name: "Diploma", code: "DIP", siteId: "site-1" }),

  record({ id: "skill-react", masterType: "Skill", name: "React.js", code: "REACT", siteId: "site-1" }),
  record({ id: "skill-node", masterType: "Skill", name: "Node.js", code: "NODE", siteId: "site-1" }),
  record({ id: "skill-js", masterType: "Skill", name: "JavaScript", code: "JS", siteId: "site-1" }),
  record({ id: "skill-python", masterType: "Skill", name: "Python", code: "PY", siteId: "site-1" }),
  record({ id: "skill-aws", masterType: "Skill", name: "AWS", code: "AWS", siteId: "site-1" }),
  record({ id: "skill-docker", masterType: "Skill", name: "Docker", code: "DOCKER", siteId: "site-1" }),
  record({ id: "skill-sql", masterType: "Skill", name: "SQL", code: "SQL", siteId: "site-1" }),
  record({ id: "skill-recruitment", masterType: "Skill", name: "Recruitment", code: "RECRT", siteId: "site-1" }),
  record({ id: "skill-financial-modeling", masterType: "Skill", name: "Financial Modeling", code: "FINMOD", siteId: "site-1" }),
  record({ id: "skill-salesforce", masterType: "Skill", name: "Salesforce", code: "SFDC", siteId: "site-1" }),

  record({ id: "doctype-identity", masterType: "DocumentType", name: "Identity Proof", code: "ID", siteId: "site-1" }),
  record({ id: "doctype-address", masterType: "DocumentType", name: "Address Proof", code: "ADDR", siteId: "site-1" }),
  record({ id: "doctype-education", masterType: "DocumentType", name: "Educational Certificate", code: "EDU", siteId: "site-1" }),
  record({ id: "doctype-offer", masterType: "DocumentType", name: "Offer Letter", code: "OFFER", siteId: "site-1" }),
  record({ id: "doctype-relieving", masterType: "DocumentType", name: "Relieving Letter", code: "RELIEV", siteId: "site-1" }),
  record({ id: "doctype-bank", masterType: "DocumentType", name: "Bank Passbook", code: "BANKPB", siteId: "site-1" }),

  record({ id: "sepreason-resignation", masterType: "SeparationReason", name: "Resignation", code: "RESIGN", siteId: "site-1" }),
  record({ id: "sepreason-termination", masterType: "SeparationReason", name: "Termination", code: "TERM", siteId: "site-1" }),
  record({ id: "sepreason-contract-end", masterType: "SeparationReason", name: "End of Contract", code: "EOC", siteId: "site-1" }),
  record({ id: "sepreason-retirement", masterType: "SeparationReason", name: "Retirement", code: "RETIRE", siteId: "site-1" }),
  record({ id: "sepreason-absconding", masterType: "SeparationReason", name: "Absconding", code: "ABSC", siteId: "site-1" }),
  record({ id: "sepreason-mutual", masterType: "SeparationReason", name: "Mutual Separation", code: "MUTUAL", siteId: "site-1" }),

  record({ id: "recsource-linkedin", masterType: "RecruitmentSource", name: "LinkedIn", code: "LI", siteId: "site-1" }),
  record({ id: "recsource-referral", masterType: "RecruitmentSource", name: "Employee Referral", code: "REF", siteId: "site-1" }),
  record({ id: "recsource-naukri", masterType: "RecruitmentSource", name: "Naukri.com", code: "NAUKRI", siteId: "site-1" }),
  record({ id: "recsource-campus", masterType: "RecruitmentSource", name: "Campus Placement", code: "CAMPUS", siteId: "site-1" }),
  record({ id: "recsource-agency", masterType: "RecruitmentSource", name: "Consultant / Agency", code: "AGENCY", siteId: "site-1" }),
];

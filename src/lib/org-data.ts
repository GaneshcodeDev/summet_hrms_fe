import {
  Building2,
  Layers,
  GitBranch,
  Users,
  UsersRound,
  MapPinned,
  Factory,
  MapPin,
  Wallet,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { OrgAuditEntry, OrgUnit, OrgUnitType } from "@/lib/types";

export interface OrgUnitTypeConfig {
  type: OrgUnitType;
  label: string;
  pluralLabel: string;
  /** URL segment used by the /organization/units/[type] route. */
  slug: string;
  icon: LucideIcon;
  description: string;
  /** Which unit types this type may be nested under. Empty = root-level (no parent). */
  allowedParentTypes: OrgUnitType[];
}

export const orgUnitTypeConfig: Record<OrgUnitType, OrgUnitTypeConfig> = {
  Company: {
    type: "Company",
    label: "Company",
    pluralLabel: "Companies",
    slug: "companies",
    icon: Building2,
    description: "Legal entity at the root of the organization structure",
    allowedParentTypes: [],
  },
  BusinessUnit: {
    type: "BusinessUnit",
    label: "Business Unit",
    pluralLabel: "Business Units",
    slug: "business-units",
    icon: Layers,
    description: "Major line of business within a company",
    allowedParentTypes: ["Company"],
  },
  Division: {
    type: "Division",
    label: "Division",
    pluralLabel: "Divisions",
    slug: "divisions",
    icon: GitBranch,
    description: "Functional division within a business unit",
    allowedParentTypes: ["BusinessUnit"],
  },
  Department: {
    type: "Department",
    label: "Department",
    pluralLabel: "Departments",
    slug: "departments",
    icon: Users,
    description: "Working department within a division",
    allowedParentTypes: ["Division", "BusinessUnit", "Company"],
  },
  SubDepartment: {
    type: "SubDepartment",
    label: "Sub Department",
    pluralLabel: "Sub Departments",
    slug: "sub-departments",
    icon: UsersRound,
    description: "Specialized team within a department",
    allowedParentTypes: ["Department"],
  },
  Branch: {
    type: "Branch",
    label: "Branch",
    pluralLabel: "Branches",
    slug: "branches",
    icon: MapPinned,
    description: "Physical branch office of the company",
    allowedParentTypes: ["Company", "BusinessUnit"],
  },
  Plant: {
    type: "Plant",
    label: "Plant",
    pluralLabel: "Plants",
    slug: "plants",
    icon: Factory,
    description: "Manufacturing or delivery facility",
    allowedParentTypes: ["Company", "BusinessUnit"],
  },
  Location: {
    type: "Location",
    label: "Location",
    pluralLabel: "Locations",
    slug: "locations",
    icon: MapPin,
    description: "Block, building, floor or precise location within a branch or plant",
    allowedParentTypes: ["Branch", "Plant", "Location"],
  },
  CostCenter: {
    type: "CostCenter",
    label: "Cost Center",
    pluralLabel: "Cost Centers",
    slug: "cost-centers",
    icon: Wallet,
    description: "Accounting unit costs are tracked against",
    allowedParentTypes: ["Company", "BusinessUnit", "Division", "Department"],
  },
  ProfitCenter: {
    type: "ProfitCenter",
    label: "Profit Center",
    pluralLabel: "Profit Centers",
    slug: "profit-centers",
    icon: TrendingUp,
    description: "Accounting unit revenue and cost are tracked against",
    allowedParentTypes: ["Company", "BusinessUnit", "Division"],
  },
};

export const orgUnitTypeList: OrgUnitTypeConfig[] = Object.values(orgUnitTypeConfig);

export function orgUnitTypeBySlug(slug: string): OrgUnitTypeConfig | undefined {
  return orgUnitTypeList.find((c) => c.slug === slug);
}

function unit(partial: Omit<OrgUnit, "status" | "createdOn" | "updatedOn"> & { createdOn?: string }): OrgUnit {
  return {
    status: "Active",
    createdOn: partial.createdOn ?? "2022-01-10",
    updatedOn: partial.createdOn ?? "2022-01-10",
    ...partial,
  };
}

export const seedOrgUnits: OrgUnit[] = [
  // ---- Site 1 (Noida Head Office) — full depth demo hierarchy ----
  unit({ id: "company-1", type: "Company", name: "Tech Solutions Pvt Ltd", code: "TSPL", parentId: null, siteId: "site-1", headEmployeeId: "EMP001", description: "Parent legal entity", createdOn: "2018-01-10" }),

  unit({ id: "bu-tech", type: "BusinessUnit", name: "Technology & Engineering", code: "TECH-BU", parentId: "company-1", siteId: "site-1", headEmployeeId: "EMP002", createdOn: "2018-02-01" }),
  unit({ id: "bu-corp", type: "BusinessUnit", name: "Business Operations", code: "OPS-BU", parentId: "company-1", siteId: "site-1", headEmployeeId: "EMP004", createdOn: "2018-02-01" }),

  unit({ id: "div-product-eng", type: "Division", name: "Product Engineering", code: "DIV-PE", parentId: "bu-tech", siteId: "site-1", headEmployeeId: "EMP002", createdOn: "2018-03-01" }),
  unit({ id: "div-people-fin", type: "Division", name: "People & Finance", code: "DIV-PF", parentId: "bu-corp", siteId: "site-1", headEmployeeId: "EMP004", createdOn: "2018-03-01" }),
  unit({ id: "div-sales-mkt", type: "Division", name: "Sales & Marketing", code: "DIV-SM", parentId: "bu-corp", siteId: "site-1", headEmployeeId: "EMP009", createdOn: "2018-03-01" }),

  unit({ id: "dept-engineering", type: "Department", name: "Engineering", code: "ENG", parentId: "div-product-eng", siteId: "site-1", headEmployeeId: "EMP002", createdOn: "2018-04-01" }),
  unit({ id: "dept-hr", type: "Department", name: "Human Resources", code: "HR", parentId: "div-people-fin", siteId: "site-1", headEmployeeId: "EMP004", createdOn: "2018-04-01" }),
  unit({ id: "dept-finance", type: "Department", name: "Finance", code: "FIN", parentId: "div-people-fin", siteId: "site-1", headEmployeeId: "EMP007", createdOn: "2018-04-01" }),
  unit({ id: "dept-sales", type: "Department", name: "Sales & Marketing", code: "SALES", parentId: "div-sales-mkt", siteId: "site-1", headEmployeeId: "EMP009", createdOn: "2018-04-01" }),
  unit({ id: "dept-operations", type: "Department", name: "Operations", code: "OPS", parentId: "bu-corp", siteId: "site-1", headEmployeeId: "EMP006", createdOn: "2018-04-01" }),

  unit({ id: "subdept-platform", type: "SubDepartment", name: "Platform Engineering", code: "ENG-PLAT", parentId: "dept-engineering", siteId: "site-1", headEmployeeId: "EMP003", createdOn: "2019-01-15" }),
  unit({ id: "subdept-devops", type: "SubDepartment", name: "DevOps & Infrastructure", code: "ENG-DEVOPS", parentId: "dept-engineering", siteId: "site-1", headEmployeeId: "EMP006", createdOn: "2019-01-15" }),
  unit({ id: "subdept-talent", type: "SubDepartment", name: "Talent Acquisition", code: "HR-TA", parentId: "dept-hr", siteId: "site-1", headEmployeeId: "EMP005", createdOn: "2019-06-01" }),
  unit({ id: "subdept-ap", type: "SubDepartment", name: "Accounts Payable", code: "FIN-AP", parentId: "dept-finance", siteId: "site-1", createdOn: "2019-06-01" }),

  unit({ id: "branch-noida", type: "Branch", name: "Noida Corporate Branch", code: "BR-NOI", parentId: "company-1", siteId: "site-1", headEmployeeId: "EMP001", description: "Tower B, Logix Techno Park, Noida", createdOn: "2018-01-15" }),
  unit({ id: "branch-blr", type: "Branch", name: "Bangalore Branch", code: "BR-BLR", parentId: "company-1", siteId: "site-1", createdOn: "2019-06-15" }),

  unit({ id: "plant-blr", type: "Plant", name: "Bangalore Delivery Center", code: "PLT-BLR", parentId: "company-1", siteId: "site-1", headEmployeeId: "EMP006", createdOn: "2019-09-01" }),

  unit({ id: "block-tower-b", type: "Location", name: "Tower B", code: "LOC-TWRB", parentId: "branch-noida", siteId: "site-1", locationKind: "Block", createdOn: "2018-01-15" }),
  unit({ id: "building-logix", type: "Location", name: "Logix Techno Park", code: "LOC-LOGIX", parentId: "block-tower-b", siteId: "site-1", locationKind: "Building", createdOn: "2018-01-15" }),
  unit({ id: "floor-3", type: "Location", name: "3rd Floor", code: "LOC-F3", parentId: "building-logix", siteId: "site-1", locationKind: "Floor", createdOn: "2018-01-15" }),
  unit({ id: "loc-eng-wing", type: "Location", name: "Engineering Wing", code: "LOC-ENGW", parentId: "floor-3", siteId: "site-1", locationKind: "Location", createdOn: "2018-01-20" }),
  unit({ id: "loc-hr-wing", type: "Location", name: "HR & Admin Wing", code: "LOC-HRW", parentId: "floor-3", siteId: "site-1", locationKind: "Location", createdOn: "2018-01-20" }),

  unit({ id: "cc-eng", type: "CostCenter", name: "Engineering Cost Center", code: "CC-ENG", parentId: "dept-engineering", siteId: "site-1", createdOn: "2018-04-05" }),
  unit({ id: "cc-hr", type: "CostCenter", name: "HR Cost Center", code: "CC-HR", parentId: "dept-hr", siteId: "site-1", createdOn: "2018-04-05" }),
  unit({ id: "cc-fin", type: "CostCenter", name: "Finance Cost Center", code: "CC-FIN", parentId: "dept-finance", siteId: "site-1", createdOn: "2018-04-05" }),

  unit({ id: "pc-product", type: "ProfitCenter", name: "Product Engineering Profit Center", code: "PC-PROD", parentId: "div-product-eng", siteId: "site-1", createdOn: "2018-04-10" }),
  unit({ id: "pc-sales", type: "ProfitCenter", name: "Sales & Marketing Profit Center", code: "PC-SALES", parentId: "div-sales-mkt", siteId: "site-1", createdOn: "2018-04-10" }),

  // ---- Site 2 (Bangalore Tech Park) — lighter structure ----
  unit({ id: "company-2", type: "Company", name: "Bangalore Tech Park Pvt Ltd", code: "BTP", parentId: null, siteId: "site-2", headEmployeeId: "EMP003", createdOn: "2019-06-15" }),
  unit({ id: "bu-blr-eng", type: "BusinessUnit", name: "Engineering", code: "BLR-ENG-BU", parentId: "company-2", siteId: "site-2", headEmployeeId: "EMP003", createdOn: "2019-06-20" }),
  unit({ id: "dept-blr-ops", type: "Department", name: "Operations", code: "BLR-OPS", parentId: "bu-blr-eng", siteId: "site-2", headEmployeeId: "EMP006", createdOn: "2019-07-01" }),
  unit({ id: "branch-blr-2", type: "Branch", name: "Bangalore Tech Park Branch", code: "BR-BLR2", parentId: "company-2", siteId: "site-2", description: "Prestige Tech Park, Marathahalli", createdOn: "2019-06-15" }),
  unit({ id: "cc-blr-eng", type: "CostCenter", name: "Bangalore Engineering Cost Center", code: "CC-BLR-ENG", parentId: "bu-blr-eng", siteId: "site-2", createdOn: "2019-07-05" }),

  // ---- Site 3 (Delhi Corporate Office) — early-stage tenant, minimal structure ----
  unit({ id: "company-3", type: "Company", name: "Delhi Corporate Services Pvt Ltd", code: "DCS", parentId: null, siteId: "site-3", headEmployeeId: "EMP005", createdOn: "2024-02-20" }),
  unit({ id: "dept-delhi-hr", type: "Department", name: "Human Resources", code: "DEL-HR", parentId: "company-3", siteId: "site-3", headEmployeeId: "EMP005", createdOn: "2024-02-25" }),
  unit({ id: "branch-delhi", type: "Branch", name: "Delhi Corporate Branch", code: "BR-DEL", parentId: "company-3", siteId: "site-3", description: "DLF Cyber Hub, Connaught Place", createdOn: "2024-02-20" }),

  // ---- Site 4 (Mumbai Business Hub) — lighter structure ----
  unit({ id: "company-4", type: "Company", name: "Mumbai Business Hub Pvt Ltd", code: "MBH", parentId: null, siteId: "site-4", headEmployeeId: "EMP009", createdOn: "2021-11-05" }),
  unit({ id: "dept-mumbai-sales", type: "Department", name: "Sales & Marketing", code: "MUM-SALES", parentId: "company-4", siteId: "site-4", headEmployeeId: "EMP009", createdOn: "2021-11-10" }),
  unit({ id: "branch-mumbai", type: "Branch", name: "Mumbai Business Hub Branch", code: "BR-MUM", parentId: "company-4", siteId: "site-4", description: "Bandra Kurla Complex", createdOn: "2021-11-05" }),
];

export const seedOrgAuditEntries: OrgAuditEntry[] = [
  {
    id: "org-evt-1",
    orgUnitId: "dept-engineering",
    orgUnitType: "Department",
    orgUnitName: "Engineering",
    action: "created",
    actorName: "Ganesh Pandey",
    detail: "Department created under Product Engineering division",
    timestamp: "2018-04-01T09:00:00.000Z",
  },
  {
    id: "org-evt-2",
    orgUnitId: "subdept-devops",
    orgUnitType: "SubDepartment",
    orgUnitName: "DevOps & Infrastructure",
    action: "created",
    actorName: "Neha Verma",
    detail: "Sub-department created under Engineering",
    timestamp: "2019-01-15T10:30:00.000Z",
  },
  {
    id: "org-evt-3",
    orgUnitId: "branch-blr",
    orgUnitType: "Branch",
    orgUnitName: "Bangalore Branch",
    action: "created",
    actorName: "Ganesh Pandey",
    detail: "New branch onboarded",
    timestamp: "2019-06-15T11:00:00.000Z",
  },
];

import type { EmployeeSiteMapping, SiteProfile } from "@/lib/types";

export const siteCategories = ["Support Function", "Revenue Generating", "Shared Service", "R&D"];
export const siteCurrencies = ["INR", "USD", "EUR", "GBP"];
export const siteSegments = ["Corporate", "Engineering", "Sales", "Operations", "Delivery"];

function profile(p: Omit<SiteProfile, "updatedBy" | "updatedOn"> & { updatedOn?: string }): SiteProfile {
  return { updatedBy: "Ganesh Pandey", updatedOn: p.updatedOn ?? "2024-01-10", ...p };
}

export const seedSiteProfiles: SiteProfile[] = [
  profile({
    orgUnitId: "cc-eng",
    category: "Support Function",
    currency: "INR",
    segment: "Engineering",
    subSegment: "Product Engineering",
    assetBarcodePrefix: "CC-ENG",
    activationDateTime: "2018-04-05T09:00",
    address: { line1: "Tower B, Logix Techno Park", city: "Noida", state: "Uttar Pradesh", pincode: "201301", country: "India" },
    contact: { name: "Rohit Sharma", phone: "+91 98765 43211", email: "rohit.sharma@company.com" },
    physicalLocationNote: "3rd floor, Engineering wing, Tower B",
    roleIds: ["role-hr-admin", "role-department-head", "role-manager"],
    shifts: [
      { id: "shift-eng-gen", name: "General Shift", startTime: "09:30", endTime: "18:30" },
      { id: "shift-eng-flex", name: "Flexible", startTime: "11:00", endTime: "20:00" },
    ],
    holidays: [
      { id: "hol-eng-1", name: "Republic Day", date: "2024-01-26" },
      { id: "hol-eng-2", name: "Holi", date: "2024-03-25" },
      { id: "hol-eng-3", name: "Independence Day", date: "2024-08-15" },
    ],
  }),
  profile({
    orgUnitId: "cc-hr",
    category: "Support Function",
    currency: "INR",
    segment: "Corporate",
    subSegment: "People & Culture",
    assetBarcodePrefix: "CC-HR",
    activationDateTime: "2018-04-05T09:00",
    address: { line1: "Tower B, Logix Techno Park", city: "Noida", state: "Uttar Pradesh", pincode: "201301", country: "India" },
    contact: { name: "Neha Verma", phone: "+91 98765 43213", email: "neha.verma@company.com" },
    physicalLocationNote: "2nd floor, HR wing, Tower B",
    roleIds: ["role-hr-admin", "role-hr-manager"],
    shifts: [{ id: "shift-hr-gen", name: "General Shift", startTime: "09:30", endTime: "18:30" }],
    holidays: [
      { id: "hol-hr-1", name: "Republic Day", date: "2024-01-26" },
      { id: "hol-hr-2", name: "Diwali", date: "2024-11-01" },
    ],
  }),
  profile({
    orgUnitId: "cc-fin",
    category: "Support Function",
    currency: "INR",
    segment: "Corporate",
    subSegment: "Finance & Accounts",
    assetBarcodePrefix: "CC-FIN",
    activationDateTime: "2018-04-05T09:00",
    address: { line1: "Tower B, Logix Techno Park", city: "Noida", state: "Uttar Pradesh", pincode: "201301", country: "India" },
    contact: { name: "Amit Kumar", phone: "+91 98765 43216", email: "amit.kumar@company.com" },
    physicalLocationNote: "2nd floor, Finance wing, Tower B",
    roleIds: ["role-payroll-admin", "role-finance"],
    shifts: [{ id: "shift-fin-gen", name: "General Shift", startTime: "09:30", endTime: "18:30" }],
    holidays: [
      { id: "hol-fin-1", name: "Republic Day", date: "2024-01-26" },
      { id: "hol-fin-2", name: "Financial Year Close", date: "2024-03-31" },
    ],
  }),
  profile({
    orgUnitId: "pc-product",
    category: "Revenue Generating",
    currency: "INR",
    segment: "Engineering",
    subSegment: "Product Engineering",
    assetBarcodePrefix: "PC-PROD",
    activationDateTime: "2018-04-10T09:00",
    address: { line1: "Tower B, Logix Techno Park", city: "Noida", state: "Uttar Pradesh", pincode: "201301", country: "India" },
    contact: { name: "Rohit Sharma", phone: "+91 98765 43211", email: "rohit.sharma@company.com" },
    physicalLocationNote: "3rd floor, Product Engineering wing, Tower B",
    roleIds: ["role-hr-admin", "role-department-head"],
    shifts: [{ id: "shift-prod-gen", name: "General Shift", startTime: "09:30", endTime: "18:30" }],
    holidays: [{ id: "hol-prod-1", name: "Republic Day", date: "2024-01-26" }],
  }),
  profile({
    orgUnitId: "pc-sales",
    category: "Revenue Generating",
    currency: "INR",
    segment: "Sales",
    subSegment: "Direct Sales",
    assetBarcodePrefix: "PC-SALES",
    activationDateTime: "2018-04-10T09:00",
    address: { line1: "Tower B, Logix Techno Park", city: "Noida", state: "Uttar Pradesh", pincode: "201301", country: "India" },
    contact: { name: "Anjali Kumari", phone: "+91 98765 43218", email: "anjali.kumari@company.com" },
    physicalLocationNote: "1st floor, Sales wing, Tower B",
    roleIds: ["role-hr-admin"],
    shifts: [{ id: "shift-sales-gen", name: "General Shift", startTime: "10:00", endTime: "19:00" }],
    holidays: [{ id: "hol-sales-1", name: "Republic Day", date: "2024-01-26" }],
  }),
  profile({
    orgUnitId: "cc-blr-eng",
    category: "Support Function",
    currency: "INR",
    segment: "Engineering",
    subSegment: "Platform Engineering",
    assetBarcodePrefix: "CC-BLR-ENG",
    activationDateTime: "2019-07-05T09:00",
    address: { line1: "Prestige Tech Park, Marathahalli", city: "Bangalore", state: "Karnataka", pincode: "560103", country: "India" },
    contact: { name: "Priya Singh", phone: "+91 98765 43212", email: "priya.singh@company.com" },
    physicalLocationNote: "4th floor, Engineering wing, Block C",
    roleIds: ["role-hr-admin", "role-department-head"],
    shifts: [
      { id: "shift-blr-gen", name: "General Shift", startTime: "09:30", endTime: "18:30" },
      { id: "shift-blr-night", name: "Night Shift (On-call)", startTime: "22:00", endTime: "06:00" },
    ],
    holidays: [
      { id: "hol-blr-1", name: "Republic Day", date: "2024-01-26" },
      { id: "hol-blr-2", name: "Ugadi", date: "2024-04-09" },
    ],
  }),
];

export const seedEmployeeSiteMappings: EmployeeSiteMapping[] = [
  { employeeId: "EMP001", costCenterId: "cc-eng", profitCenterId: "pc-product", updatedBy: "System", updatedOn: "2022-01-15" },
  { employeeId: "EMP002", costCenterId: "cc-eng", profitCenterId: "pc-product", updatedBy: "System", updatedOn: "2021-03-10" },
  { employeeId: "EMP003", costCenterId: "cc-blr-eng", updatedBy: "System", updatedOn: "2020-06-01" },
  { employeeId: "EMP004", costCenterId: "cc-hr", updatedBy: "System", updatedOn: "2019-11-20" },
  { employeeId: "EMP006", costCenterId: "cc-blr-eng", updatedBy: "System", updatedOn: "2021-09-12" },
  { employeeId: "EMP007", costCenterId: "cc-fin", updatedBy: "System", updatedOn: "2018-04-18" },
  { employeeId: "EMP009", profitCenterId: "pc-sales", updatedBy: "System", updatedOn: "2023-01-09" },
  { employeeId: "EMP010", costCenterId: "cc-fin", updatedBy: "System", updatedOn: "2017-07-30" },
];

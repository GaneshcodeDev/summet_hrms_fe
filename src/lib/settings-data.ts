import {
  Biohazard,
  CreditCard,
  MessageCircle,
  MessageSquare,
  Users2,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { AppSettings } from "@/lib/types";

export const defaultSettings: AppSettings = {
  general: {
    name: "Tech Solutions Pvt Ltd",
    logoDataUrl: undefined,
  },
  organization: {
    legalName: "Tech Solutions Private Limited",
    registrationNumber: "U72900DL2018PTC330123",
    taxId: "07AAFCT1234M1Z9",
    industry: "Information Technology",
    companySize: "201-500 employees",
    website: "https://techsolutions.example.com",
    address: "Tower B, Logix Techno Park, Sector 62, Noida, Uttar Pradesh 201301, India",
    fiscalYearStartMonth: "April",
  },
  localization: {
    timezone: "(GMT+5:30) India Standard Time — Kolkata",
    language: "English",
    country: "India",
    dateFormat: "DD MMM YYYY",
    timeFormat: "12 Hour",
    numberFormat: "1,23,456.78 (Indian)",
    currency: "INR (₹) - Indian Rupee",
    weekStart: "Monday",
  },
  email: {
    smtpHost: "smtp.techsolutions.example.com",
    smtpPort: "587",
    smtpUsername: "notifications@techsolutions.example.com",
    smtpPassword: "",
    fromName: "Tech Solutions HRMS",
    fromEmail: "hrms-noreply@techsolutions.example.com",
    encryption: "TLS",
    notifications: {
      welcome: true,
      leaveApproval: true,
      payslip: true,
      passwordReset: true,
      birthday: false,
    },
  },
  integrations: {
    slack: true,
    teams: false,
    "google-workspace": true,
    zoom: false,
    biometric: false,
    payment: false,
  },
  backup: {
    autoBackupEnabled: true,
    frequency: "Weekly",
    retentionDays: 90,
  },
};

export const notificationCatalog: { key: string; label: string; description: string }[] = [
  { key: "welcome", label: "Welcome Email", description: "Sent when a new employee account is created" },
  { key: "leaveApproval", label: "Leave Approval/Rejection", description: "Sent when a leave request is actioned" },
  { key: "payslip", label: "Payslip Generated", description: "Sent when a monthly payslip is published" },
  { key: "passwordReset", label: "Password Reset", description: "Sent when a user requests a password reset link" },
  { key: "birthday", label: "Birthday Reminders", description: "Sent to managers ahead of a direct report's birthday" },
];

export interface IntegrationConfig {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: string;
}

export const integrationCatalog: IntegrationConfig[] = [
  { id: "slack", name: "Slack", description: "Post approvals and announcements to team channels", icon: MessageCircle, category: "Communication" },
  { id: "teams", name: "Microsoft Teams", description: "Post approvals and announcements to Teams channels", icon: MessageSquare, category: "Communication" },
  { id: "google-workspace", name: "Google Workspace", description: "Sync calendars and enable single sign-on", icon: Users2, category: "Identity" },
  { id: "zoom", name: "Zoom", description: "Auto-generate meeting links for interviews and reviews", icon: Video, category: "Recruitment" },
  { id: "biometric", name: "Biometric Device", description: "Sync attendance punches from on-site biometric devices", icon: Biohazard, category: "Attendance" },
  { id: "payment", name: "Payment Gateway", description: "Disburse payroll directly to employee bank accounts", icon: CreditCard, category: "Payroll" },
];

export const timezoneOptions = [
  "(GMT+5:30) India Standard Time — Kolkata",
  "(GMT+0:00) Greenwich Mean Time — London",
  "(GMT-5:00) Eastern Time — New York",
  "(GMT-8:00) Pacific Time — Los Angeles",
  "(GMT+4:00) Gulf Standard Time — Dubai",
  "(GMT+8:00) Singapore Standard Time — Singapore",
];

export const languageOptions = ["English", "Hindi", "Spanish", "French", "German"];
export const industryOptions = [
  "Information Technology",
  "Manufacturing",
  "Healthcare",
  "Financial Services",
  "Retail & E-commerce",
  "Education",
];
export const companySizeOptions = ["1-50 employees", "51-200 employees", "201-500 employees", "501-2000 employees", "2000+ employees"];
export const fiscalYearMonths = ["January", "April", "July", "October"];
export const numberFormatOptions = ["1,23,456.78 (Indian)", "1,234,567.89 (International)", "1.234.567,89 (European)"];
export const weekStartOptions = ["Sunday", "Monday"];

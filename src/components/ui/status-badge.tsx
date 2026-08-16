import { Badge, type BadgeTone } from "@/components/ui/badge";

const toneMap: Record<string, BadgeTone> = {
  Active: "emerald",
  Inactive: "slate",
  Approved: "emerald",
  Pending: "amber",
  Rejected: "rose",
  Completed: "emerald",
  "In Progress": "sky",
  Closed: "slate",
  "On Hold": "amber",
  Upcoming: "sky",
  Ongoing: "amber",
  Assigned: "indigo",
  Available: "emerald",
  "Under Repair": "rose",
  Verified: "emerald",
  Submitted: "sky",
  Draft: "slate",
  Scheduled: "sky",
  Cancelled: "rose",
  Present: "emerald",
  Absent: "rose",
  "Half Day": "amber",
  "On Leave": "sky",
  Holiday: "indigo",

  // Onboarding
  "Pre-boarding": "indigo",
  Uploaded: "sky",
  "Not Sent": "slate",
  Sent: "sky",
  Viewed: "sky",
  Signed: "emerald",
  Declined: "rose",
  "Not Required": "slate",
  "Not Applicable": "slate",

  // Offboarding
  "Pending Approval": "amber",
  "Clearance In Progress": "amber",
  "Settlement Pending": "amber",
  Withdrawn: "slate",
  Cleared: "emerald",
  Flagged: "rose",
  Processing: "amber",
  Paid: "emerald",
  "Not Generated": "slate",
  Generated: "sky",
  "Not Scheduled": "slate",

  // Expenses
  "Manager Approved": "sky",
  "Finance Approved": "indigo",
  Reimbursed: "emerald",

  // Recruitment
  Open: "emerald",
  Applied: "sky",
  Screening: "amber",
  Interview: "indigo",
  Selected: "emerald",
  Offer: "indigo",
  "Offer Accepted": "emerald",
  Hired: "emerald",
  Accepted: "emerald",
  Expired: "slate",
  "No-Show": "rose",

  // Employee lifecycle
  Probation: "amber",
  Confirmed: "emerald",
  "On Notice": "rose",
  Exited: "slate",

  // Performance
  "Self Review": "sky",
  "Manager Review": "indigo",
  "HR Review": "amber",
  "Goals Assigned": "sky",

  // Training
  Published: "sky",
  Registered: "sky",
  Failed: "rose",
  "No Show": "rose",
  Late: "amber",
  "Not Attempted": "slate",
  Passed: "emerald",

  // Assets
  "Under Maintenance": "amber",
  Lost: "rose",
  Damaged: "rose",
  Retired: "slate",
  Disposed: "slate",
  New: "emerald",
  Good: "emerald",
  Fair: "amber",
  Reported: "amber",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={toneMap[status] ?? "slate"}>{status}</Badge>;
}

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
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={toneMap[status] ?? "slate"}>{status}</Badge>;
}

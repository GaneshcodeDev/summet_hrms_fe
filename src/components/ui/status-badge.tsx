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
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={toneMap[status] ?? "slate"}>{status}</Badge>;
}

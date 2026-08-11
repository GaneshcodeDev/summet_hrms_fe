import type { LeaveAuditEntry, LeaveBalance, LeaveRequest, LeaveType } from "@/lib/types";

export const leaveTypes: LeaveType[] = ["Casual Leave", "Sick Leave", "Earned Leave", "Comp Off"];

export const leaveTypeConfig: Record<LeaveType, { annualQuota: number; color: string }> = {
  "Casual Leave": { annualQuota: 12, color: "#4f46e5" },
  "Sick Leave": { annualQuota: 12, color: "#0ea5e9" },
  "Earned Leave": { annualQuota: 21, color: "#10b981" },
  "Comp Off": { annualQuota: 6, color: "#f59e0b" },
};

function balance(employeeId: string, type: LeaveType, used: number): LeaveBalance {
  return { employeeId, type, used, total: leaveTypeConfig[type].annualQuota };
}

// Active employees only (EMP008 is Inactive — no current-year balance to track).
export const seedLeaveBalances: LeaveBalance[] = [
  ...["EMP001", "EMP002", "EMP003", "EMP004", "EMP005", "EMP006", "EMP007", "EMP009", "EMP010"].flatMap(
    (employeeId, i) => {
      // Deterministic-but-varied usage so every employee's balance card looks realistic.
      const seed = i + 1;
      return [
        balance(employeeId, "Casual Leave", 3 + (seed % 6)),
        balance(employeeId, "Sick Leave", 2 + (seed % 5)),
        balance(employeeId, "Earned Leave", 5 + (seed % 10)),
        balance(employeeId, "Comp Off", seed % 4),
      ];
    },
  ),
];

export const seedLeaveRequests: LeaveRequest[] = [
  // Ganesh Pandey (EMP001) — CEO/Super Admin, approved history
  { id: "lv-1", employeeId: "EMP001", employee: "Ganesh Pandey", type: "Casual Leave", from: "2024-05-30", to: "2024-05-31", days: 2, status: "Approved", reason: "Personal work", siteId: "site-1", appliedOn: "2024-05-25", approverId: "EMP001", approverName: "Ganesh Pandey", decisionReason: "Self-approved (Super Admin)", decidedOn: "2024-05-25" },
  { id: "lv-2", employeeId: "EMP001", employee: "Ganesh Pandey", type: "Sick Leave", from: "2024-05-10", to: "2024-05-11", days: 2, status: "Approved", reason: "Fever", siteId: "site-1", appliedOn: "2024-05-10", approverId: "EMP001", approverName: "Ganesh Pandey", decidedOn: "2024-05-10" },
  { id: "lv-3", employeeId: "EMP001", employee: "Ganesh Pandey", type: "Earned Leave", from: "2024-04-01", to: "2024-04-05", days: 5, status: "Approved", reason: "Vacation", siteId: "site-1", appliedOn: "2024-03-20", approverId: "EMP001", approverName: "Ganesh Pandey", decidedOn: "2024-03-21" },

  // Rohit Sharma (EMP002) reports to Ganesh — pending, awaiting Ganesh's decision
  { id: "lv-4", employeeId: "EMP002", employee: "Rohit Sharma", type: "Casual Leave", from: "2024-06-22", to: "2024-06-23", days: 2, status: "Pending", reason: "Family function", siteId: "site-1", appliedOn: "2024-06-15" },
  { id: "lv-5", employeeId: "EMP002", employee: "Rohit Sharma", type: "Comp Off", from: "2024-03-15", to: "2024-03-15", days: 1, status: "Rejected", reason: "Worked on holiday", siteId: "site-1", appliedOn: "2024-03-10", approverId: "EMP001", approverName: "Ganesh Pandey", decisionReason: "No compensatory work record found for that date — please resubmit with the manager's confirmation email attached.", decidedOn: "2024-03-11" },

  // Priya Singh (EMP003) reports to Rohit — pending, awaiting Rohit's decision
  { id: "lv-6", employeeId: "EMP003", employee: "Priya Singh", type: "Sick Leave", from: "2024-05-18", to: "2024-05-18", days: 1, status: "Approved", reason: "Fever", siteId: "site-2", appliedOn: "2024-05-17", approverId: "EMP002", approverName: "Rohit Sharma", decidedOn: "2024-05-17" },
  { id: "lv-7", employeeId: "EMP003", employee: "Priya Singh", type: "Earned Leave", from: "2024-06-03", to: "2024-06-07", days: 5, status: "Pending", reason: "Vacation", siteId: "site-2", appliedOn: "2024-05-28" },

  // Neha Verma (EMP004, HR Manager) — broad approval scope, own history
  { id: "lv-8", employeeId: "EMP004", employee: "Neha Verma", type: "Casual Leave", from: "2024-04-18", to: "2024-04-19", days: 2, status: "Approved", reason: "Personal work", siteId: "site-1", appliedOn: "2024-04-15", approverId: "EMP001", approverName: "Ganesh Pandey", decidedOn: "2024-04-15" },

  // Sneha Kapoor (EMP005) reports to Neha — pending
  { id: "lv-9", employeeId: "EMP005", employee: "Sneha Kapoor", type: "Comp Off", from: "2024-05-11", to: "2024-05-11", days: 1, status: "Approved", reason: "Worked on weekend", siteId: "site-3", appliedOn: "2024-05-06", approverId: "EMP004", approverName: "Neha Verma", decidedOn: "2024-05-07" },
  { id: "lv-10", employeeId: "EMP005", employee: "Sneha Kapoor", type: "Casual Leave", from: "2024-06-10", to: "2024-06-11", days: 2, status: "Pending", reason: "Sister's wedding", siteId: "site-3", appliedOn: "2024-06-01" },

  // Vikram Desai (EMP006) reports to Rohit — pending
  { id: "lv-11", employeeId: "EMP006", employee: "Vikram Desai", type: "Earned Leave", from: "2024-06-17", to: "2024-06-21", days: 5, status: "Pending", reason: "Vacation", siteId: "site-2", appliedOn: "2024-06-05" },

  // Amit Kumar (EMP007, Finance Manager) — approved history
  { id: "lv-12", employeeId: "EMP007", employee: "Amit Kumar", type: "Sick Leave", from: "2024-05-02", to: "2024-05-03", days: 2, status: "Approved", reason: "Viral fever", siteId: "site-1", appliedOn: "2024-05-01", approverId: "EMP001", approverName: "Ganesh Pandey", decidedOn: "2024-05-01" },

  // Anjali Kumari (EMP009) reports to Ganesh — rejected example
  { id: "lv-13", employeeId: "EMP009", employee: "Anjali Kumari", type: "Casual Leave", from: "2024-05-27", to: "2024-05-28", days: 2, status: "Rejected", reason: "Personal trip", siteId: "site-4", appliedOn: "2024-05-20", approverId: "EMP001", approverName: "Ganesh Pandey", decisionReason: "Team has a client go-live that week — please pick alternate dates after June 5th.", decidedOn: "2024-05-21" },
  { id: "lv-14", employeeId: "EMP009", employee: "Anjali Kumari", type: "Earned Leave", from: "2024-06-24", to: "2024-06-26", days: 3, status: "Pending", reason: "Personal trip (rescheduled)", siteId: "site-4", appliedOn: "2024-05-22" },

  // Manoj Gupta (EMP010) reports to Amit — approved
  { id: "lv-15", employeeId: "EMP010", employee: "Manoj Gupta", type: "Comp Off", from: "2024-04-29", to: "2024-04-29", days: 1, status: "Approved", reason: "Worked on holiday", siteId: "site-1", appliedOn: "2024-04-25", approverId: "EMP007", approverName: "Amit Kumar", decidedOn: "2024-04-26" },
];

export const seedLeaveAuditEntries: LeaveAuditEntry[] = seedLeaveRequests
  .filter((r) => r.status !== "Pending")
  .map((r) => ({
    id: `leave-evt-seed-${r.id}`,
    leaveRequestId: r.id,
    employeeName: r.employee,
    action: r.status === "Approved" ? "approved" : "rejected",
    actorName: r.approverName ?? "System",
    detail:
      r.status === "Approved"
        ? `${r.type} approved for ${r.days} day(s)`
        : `${r.type} rejected — ${r.decisionReason ?? "no reason recorded"}`,
    timestamp: r.decidedOn ?? r.appliedOn,
  }));

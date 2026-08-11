"use client";

import { useMemo, useState } from "react";
import { Lock, ShieldAlert, Unlock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, TBody, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { Can } from "@/components/auth/permission-gate";
import { useAccessControl } from "@/lib/access-control-context";
import { useNow } from "@/lib/use-now";
import { downloadCsv } from "@/lib/utils";
import type { SecurityEventType } from "@/lib/types";

const eventLabels: Record<SecurityEventType, string> = {
  login_success: "Login Success",
  login_failed: "Login Failed",
  logout: "Logout",
  account_locked: "Account Locked",
  account_unlocked: "Account Unlocked",
  password_changed: "Password Changed",
  password_reset_requested: "Password Reset Requested",
  password_reset_completed: "Password Reset Completed",
  role_assigned: "Role Assigned",
  role_created: "Role Created",
  role_permissions_updated: "Permissions Updated",
  user_status_changed: "User Status Changed",
  access_denied: "Access Denied",
};

const eventTone: Record<SecurityEventType, "emerald" | "rose" | "amber" | "indigo" | "slate"> = {
  login_success: "emerald",
  login_failed: "amber",
  logout: "slate",
  account_locked: "rose",
  account_unlocked: "emerald",
  password_changed: "indigo",
  password_reset_requested: "amber",
  password_reset_completed: "indigo",
  role_assigned: "indigo",
  role_created: "indigo",
  role_permissions_updated: "indigo",
  user_status_changed: "slate",
  access_denied: "rose",
};

export default function AccessControlSecurityPage() {
  const { accounts, securityEvents, unlockAccount } = useAccessControl();
  const [typeFilter, setTypeFilter] = useState("All Events");
  const now = useNow();

  const lockedAccounts = accounts.filter(
    (a) => a.lockedUntil && now !== null && new Date(a.lockedUntil).getTime() > now,
  );

  const filteredEvents = useMemo(
    () =>
      securityEvents.filter((e) => typeFilter === "All Events" || eventLabels[e.type] === typeFilter).slice(0, 100),
    [securityEvents, typeFilter],
  );

  function exportLog() {
    downloadCsv(
      "security-audit-log.csv",
      ["Timestamp", "Event", "Actor", "Detail", "IP"],
      filteredEvents.map((e) => [new Date(e.timestamp).toLocaleString(), eventLabels[e.type], e.actorName, e.detail, e.ip]),
    );
  }

  return (
    <div className="space-y-6">
      {lockedAccounts.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <Lock className="h-4 w-4 text-rose-500" /> Locked Accounts
          </h2>
          <div className="space-y-2">
            {lockedAccounts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-rose-100 bg-rose-50/60 px-3.5 py-2.5 dark:border-rose-500/20 dark:bg-rose-500/10"
              >
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{a.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Locked until {new Date(a.lockedUntil!).toLocaleTimeString()} after {a.failedLoginAttempts} failed attempts
                  </p>
                </div>
                <Can feature="access-control.security" action="manage">
                  <Button size="sm" variant="outline" onClick={() => unlockAccount(a.id)}>
                    <Unlock className="h-3.5 w-3.5" /> Unlock
                  </Button>
                </Can>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Audit Log</h2>
          </div>
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto">
              <option>All Events</option>
              {Object.values(eventLabels)
                .filter((v, i, arr) => arr.indexOf(v) === i)
                .map((label) => (
                  <option key={label}>{label}</option>
                ))}
            </Select>
            <Can feature="access-control.security" action="export">
              <Button variant="outline" onClick={exportLog}>
                Export
              </Button>
            </Can>
          </div>
        </div>

        <Table>
          <THead>
            <Th>Event</Th>
            <Th>Actor</Th>
            <Th>Detail</Th>
            <Th>IP Address</Th>
            <Th>Time</Th>
          </THead>
          <TBody>
            {filteredEvents.map((e) => (
              <Tr key={e.id} hoverable>
                <Td>
                  <Badge tone={eventTone[e.type]}>{eventLabels[e.type]}</Badge>
                </Td>
                <Td className="font-medium text-slate-700 dark:text-slate-200">{e.actorName}</Td>
                <Td>{e.detail}</Td>
                <Td>{e.ip}</Td>
                <Td>{new Date(e.timestamp).toLocaleString()}</Td>
              </Tr>
            ))}
            {filteredEvents.length === 0 && <EmptyRow colSpan={5}>No security events match your filters.</EmptyRow>}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

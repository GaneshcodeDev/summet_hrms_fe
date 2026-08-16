"use client";

import { AlertTriangle, Laptop, Lock, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { useAccessControl } from "@/lib/access-control-context";
import { useSite } from "@/lib/site-context";
import { getSession, revokeOtherSessions, revokeSession } from "@/lib/auth";

const securityEventLabel: Record<string, string> = {
  login_success: "Signed in",
  login_failed: "Failed sign-in attempt",
  logout: "Signed out",
  account_locked: "Account locked",
  account_unlocked: "Account unlocked",
  password_changed: "Password changed",
  password_reset_requested: "Password reset requested",
  password_reset_completed: "Password reset completed",
  role_assigned: "Role assignment updated",
  role_created: "Role created",
  role_permissions_updated: "Role permissions updated",
  user_status_changed: "Account status changed",
  access_denied: "Access denied",
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * A platform-level profile for accounts with no linked Employee record —
 * chiefly the Super Admin sentinel account before "Load Demo Data" ever
 * links it to a real employee (see rbac-data.ts's SUPER_ADMIN_ACCOUNT_ID
 * comment). Without this page, the topbar's "My Profile"/"Security" links
 * pointed at /employees/SUPERADMIN, which 404s — there's no such Employee
 * record (Phase 17 fix).
 */
export default function PlatformProfilePage() {
  const { currentUser, isSuperAdmin, deviceSessions, securityEvents } = useAccessControl();
  const { sites } = useSite();

  const currentSessionId = getSession()?.sessionId;
  const mySessions = currentUser.account ? deviceSessions.filter((s) => s.accountId === currentUser.account!.id) : [];
  const myEvents = currentUser.account ? securityEvents.filter((e) => e.accountId === currentUser.account!.id).slice(0, 8) : [];
  const isLocked = Boolean(currentUser.account?.lockedUntil && new Date(currentUser.account.lockedUntil) > new Date());

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="Platform-level account — not tied to a specific employee record" />

      <Card className="flex items-center gap-4 p-5">
        <Avatar name={currentUser.name} size="lg" />
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{currentUser.name}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {currentUser.role} {isSuperAdmin && "· Full platform access across every site"}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-y-3 pt-0 text-sm">
            <dt className="text-slate-400 dark:text-slate-500">Name</dt>
            <dd className="text-slate-700 dark:text-slate-200">{currentUser.name}</dd>
            <dt className="text-slate-400 dark:text-slate-500">Email</dt>
            <dd className="text-slate-700 dark:text-slate-200">{currentUser.email}</dd>
            <dt className="text-slate-400 dark:text-slate-500">Role</dt>
            <dd className="text-slate-700 dark:text-slate-200">{currentUser.roles.map((r) => r.name).join(", ") || "—"}</dd>
            <dt className="text-slate-400 dark:text-slate-500">Site Scope</dt>
            <dd className="text-slate-700 dark:text-slate-200">{isSuperAdmin ? `All sites (${sites.length})` : currentUser.account?.siteIds.length || "—"}</dd>
            <dt className="text-slate-400 dark:text-slate-500">Account Status</dt>
            <dd className="text-slate-700 dark:text-slate-200">{currentUser.account?.status ?? "—"}</dd>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            {isLocked ? (
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
                <Lock className="h-4 w-4 shrink-0" />
                Account temporarily locked until {new Date(currentUser.account!.lockedUntil!).toLocaleTimeString()}.
              </div>
            ) : currentUser.account && currentUser.account.failedLoginAttempts > 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {currentUser.account.failedLoginAttempts} recent failed sign-in attempt(s) on this account.
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                No security issues on this account.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-8 pt-5">
          <ChangePasswordForm />

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Laptop className="h-4 w-4" /> Active Sessions
              </h3>
              {mySessions.length > 1 && currentUser.account && (
                <button
                  onClick={() => revokeOtherSessions(currentUser.account!.id)}
                  className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
                >
                  Sign out all other sessions
                </button>
              )}
            </div>
            <div className="space-y-2">
              {mySessions.map((s) => {
                const isCurrent = s.id === currentSessionId;
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3.5 py-2.5 dark:border-slate-800">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {s.device} &middot; {s.browser}
                        {isCurrent && (
                          <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                            This device
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {s.location} &middot; {s.ip} &middot; Active {timeAgo(s.lastActiveAt)}
                      </p>
                    </div>
                    {!isCurrent && (
                      <button onClick={() => revokeSession(s.id)} className="flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline dark:text-rose-400">
                        <LogOut className="h-3.5 w-3.5" /> Sign out
                      </button>
                    )}
                  </div>
                );
              })}
              {mySessions.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No active sessions.</p>}
            </div>
          </div>

          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <ShieldAlert className="h-4 w-4" /> Recent Security Activity
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {myEvents.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-200">{securityEventLabel[e.type] ?? e.type}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{e.detail}</p>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{timeAgo(e.timestamp)}</span>
                </div>
              ))}
              {myEvents.length === 0 && <p className="py-2 text-sm text-slate-400 dark:text-slate-500">No recent activity.</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

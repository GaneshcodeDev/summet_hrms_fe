"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, CalendarOff, ChevronDown, LogOut, Network, RefreshCw, Search, ShieldCheck, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { logout } from "@/lib/auth";
import { recentActivities, teamLeaveRequests } from "@/lib/mock-data";
import { useCurrentUser } from "@/lib/access-control-context";
import { useOrg } from "@/lib/org-context";
import { SiteSwitcher } from "@/components/layout/site-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function Topbar({ title }: { title?: string }) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const { auditEntries: orgAuditEntries } = useOrg();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifSeen, setNotifSeen] = useState(false);
  const pendingApprovals = teamLeaveRequests.filter((r) => r.status === "Pending").length;

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-100 bg-white/80 px-4 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/80">
      {title && (
        <h1 className="hidden text-base font-semibold text-slate-900 lg:block dark:text-white">
          {title}
        </h1>
      )}

      <SiteSwitcher />

      <div className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          placeholder="Search anything, my leave..."
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
        <button className="hidden h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 sm:flex dark:text-slate-400 dark:hover:bg-slate-800">
          <RefreshCw className="h-4.5 w-4.5" />
        </button>
        <ThemeToggle />

        <div className="relative">
          <button
            onClick={() => {
              setNotifOpen((v) => !v);
              setNotifSeen(true);
            }}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Bell className="h-4.5 w-4.5" />
            {!notifSeen && (
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notifications</p>
                </div>

                {pendingApprovals > 0 && (
                  <Link
                    href="/leave"
                    onClick={() => setNotifOpen(false)}
                    className="flex items-center gap-3 border-b border-slate-100 bg-amber-50/60 px-4 py-3 hover:bg-amber-50 dark:border-slate-800 dark:bg-amber-500/5 dark:hover:bg-amber-500/10"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                      <CalendarOff className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {pendingApprovals} leave {pendingApprovals === 1 ? "request" : "requests"} awaiting your approval
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Team Leave</p>
                    </div>
                  </Link>
                )}

                {orgAuditEntries.length > 0 && (
                  <Link
                    href="/organization/dashboard"
                    onClick={() => setNotifOpen(false)}
                    className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
                      <Network className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {orgAuditEntries[0].orgUnitName} {orgAuditEntries[0].action}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        Organization structure &middot; {orgAuditEntries.length} recent change
                        {orgAuditEntries.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </Link>
                )}

                <div className="max-h-72 overflow-y-auto">
                  {recentActivities.slice(0, 5).map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <Avatar name={activity.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-700 dark:text-slate-200">
                          <span className="font-medium">{activity.name}</span> {activity.action}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Avatar name={currentUser.name} size="sm" />
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-tight text-slate-800 dark:text-slate-100">
                {currentUser.name}
              </p>
              <p className="text-xs leading-tight text-slate-400 dark:text-slate-500">
                {currentUser.role}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                <Link
                  href={`/employees/${currentUser.employeeId}`}
                  className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <UserRound className="h-4 w-4" /> My Profile
                </Link>
                <Link
                  href={`/employees/${currentUser.employeeId}?tab=security`}
                  className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ShieldCheck className="h-4 w-4" /> Security
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

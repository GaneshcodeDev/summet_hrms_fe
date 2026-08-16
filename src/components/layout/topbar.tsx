"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, CheckCheck, ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { logout } from "@/lib/auth";
import { useCurrentUser } from "@/lib/access-control-context";
import { useEmployees } from "@/lib/employee-context";
import { useNotifications } from "@/lib/notification-context";
import { GlobalSearch } from "@/components/layout/global-search";
import { SiteSwitcher } from "@/components/layout/site-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";

function notifTone(type: string) {
  if (type === "success") return "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400";
  if (type === "warning") return "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400";
  if (type === "action_required") return "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400";
  return "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400";
}

function notifTimeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} day(s) ago`;
}

export function Topbar({ title }: { title?: string }) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const { getEmployeeByEmployeeId } = useEmployees();
  const { myNotifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  // Points at the real Employee Profile only when one actually exists —
  // Super Admin's default sentinel account has no linked Employee record
  // until "Load Demo Data" links it to EMP001, so it must not 404 (Phase 17).
  const hasRealProfile = Boolean(getEmployeeByEmployeeId(currentUser.employeeId));
  const profileHref = hasRealProfile ? `/employees/${currentUser.employeeId}` : "/profile";
  const securityHref = hasRealProfile ? `/employees/${currentUser.employeeId}?tab=security` : "/profile";

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

      <GlobalSearch />

      <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
        <ThemeToggle />

        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Bell className="h-4.5 w-4.5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notifications</p>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {myNotifications.slice(0, 20).map((n) => (
                    <Link
                      key={n.id}
                      href={n.href ?? "#"}
                      onClick={() => {
                        markRead(n.id);
                        setNotifOpen(false);
                      }}
                      className={`flex items-start gap-3 border-b border-slate-100 px-4 py-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 ${!n.read ? "bg-indigo-50/40 dark:bg-indigo-500/5" : ""}`}
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${notifTone(n.type)}`}>
                        <Bell className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{n.title}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{notifTimeAgo(n.createdAt)}</p>
                      </div>
                      {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />}
                    </Link>
                  ))}
                  {myNotifications.length === 0 && (
                    <p className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">No notifications yet.</p>
                  )}
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
                  href={profileHref}
                  className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <UserRound className="h-4 w-4" /> My Profile
                </Link>
                <Link
                  href={securityHref}
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

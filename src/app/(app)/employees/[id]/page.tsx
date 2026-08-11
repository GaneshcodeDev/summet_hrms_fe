"use client";

import { FormEvent, Suspense, use, useMemo, useState } from "react";
import { notFound, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  Check,
  Laptop,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import {
  attendanceSummary,
  getEmployeeBankDetail,
  getEmployeeById,
  getEmployeeDocuments,
  getEmployeeSalaryStructure,
  performanceReviews,
} from "@/lib/mock-data";
import { useSite } from "@/lib/site-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useLeave } from "@/lib/leave-context";
import { useNow } from "@/lib/use-now";
import { changePassword, getSession, revokeOtherSessions, revokeSession } from "@/lib/auth";

const baseTabs = [
  { id: "overview", label: "Overview" },
  { id: "documents", label: "Documents" },
  { id: "attendance", label: "Attendance" },
  { id: "leave", label: "Leave" },
  { id: "performance", label: "Performance" },
];

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

function EmployeeProfileClient({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const { sites } = useSite();
  const { currentUser: signedInUser, canFeature, deviceSessions, securityEvents } = useAccessControl();
  const { balancesFor, requestsFor } = useLeave();
  const now = useNow();

  const employee = getEmployeeById(id);
  if (!employee) notFound();

  const isOwnProfile = signedInUser.employeeId === employee.employeeId;
  const canViewBank = isOwnProfile || canFeature("payroll.bank", "view");
  const canViewSalary = isOwnProfile || canFeature("payroll.salary", "view");

  const tabs = useMemo(
    () => [
      baseTabs[0],
      baseTabs[1],
      ...(canViewBank ? [{ id: "bank", label: "Bank Details" }] : []),
      ...(canViewSalary ? [{ id: "salary", label: "Salary" }] : []),
      baseTabs[2],
      baseTabs[3],
      baseTabs[4],
      ...(isOwnProfile ? [{ id: "security", label: "Security" }] : []),
    ],
    [canViewBank, canViewSalary, isOwnProfile],
  );

  const initialTab = searchParams.get("tab");
  const [active, setActive] = useState(
    initialTab && tabs.some((t) => t.id === initialTab) ? initialTab : "overview",
  );

  const mappedSites = (employee.siteIds ?? [employee.siteId])
    .map((siteId) => sites.find((s) => s.id === siteId))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const documents = getEmployeeDocuments(employee);
  const bank = getEmployeeBankDetail();
  const salary = getEmployeeSalaryStructure(employee);
  const employeeLeaves = requestsFor(employee.employeeId);
  const employeeLeaveBalances = balancesFor(employee.employeeId);
  const review = performanceReviews.find((r) => r.employee === employee.name);

  const mySessions = isOwnProfile
    ? deviceSessions.filter((s) => s.accountId === signedInUser.account?.id)
    : [];
  const currentSessionId = getSession()?.sessionId;
  const myEvents = isOwnProfile
    ? securityEvents.filter((e) => e.accountId === signedInUser.account?.id).slice(0, 8)
    : [];
  const isLocked = Boolean(
    signedInUser.account?.lockedUntil && now !== null && new Date(signedInUser.account.lockedUntil).getTime() > now,
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 text-center lg:col-span-1">
          <Avatar name={employee.name} size="xl" className="mx-auto" />
          <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{employee.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{employee.employeeId}</p>
          <p className="mt-1 text-sm font-medium text-indigo-600 dark:text-indigo-400">{employee.designation}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{employee.department} Department</p>

          <div className="mt-5 space-y-3 border-t border-slate-100 pt-5 text-left dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Mail className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              <span className="truncate">{employee.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Phone className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              {employee.phone}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              {employee.location}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Calendar className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              Joined {employee.dateOfJoining}
            </div>
            {employee.reportingTo && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Briefcase className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                Reports to {employee.reportingTo}
              </div>
            )}
          </div>

          {mappedSites.length > 1 && (
            <div className="mt-5 border-t border-slate-100 pt-5 text-left dark:border-slate-800">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Mapped Sites
              </p>
              <div className="flex flex-wrap gap-1.5">
                {mappedSites.map((site) => (
                  <Badge key={site.id} tone="indigo">
                    {site.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-center gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
            <StatusBadge status={employee.status} />
          </div>
        </Card>

        <div className="lg:col-span-2">
          <Card>
            <Tabs tabs={tabs} active={active} onChange={setActive} className="px-3" />

            {active === "overview" && (
              <CardContent className="space-y-6">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">About</h3>
                  <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    Dedicated and results-driven professional at {employee.department} with a
                    strong track record of delivering high-impact work. Passionate about
                    collaboration and continuous learning.
                  </p>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {employee.skills?.map((skill) => (
                      <Badge key={skill} tone="indigo">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Education</h3>
                  {employee.education?.map((edu) => (
                    <div key={edu.degree} className="text-sm">
                      <p className="font-medium text-slate-700 dark:text-slate-200">{edu.degree}</p>
                      <p className="text-slate-400 dark:text-slate-500">
                        {edu.school} &middot; {edu.years}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}

            {active === "documents" && (
              <CardContent>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{doc.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {doc.type} &middot; Uploaded {doc.uploadedOn}
                        </p>
                      </div>
                      <StatusBadge status={doc.status} />
                    </div>
                  ))}
                </div>
              </CardContent>
            )}

            {active === "bank" && canViewBank && (
              <CardContent>
                <dl className="grid grid-cols-2 gap-y-4 text-sm">
                  <div>
                    <dt className="text-slate-400 dark:text-slate-500">Bank Name</dt>
                    <dd className="font-medium text-slate-700 dark:text-slate-200">{bank.bankName}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 dark:text-slate-500">Account Number</dt>
                    <dd className="font-medium text-slate-700 dark:text-slate-200">{bank.accountNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 dark:text-slate-500">IFSC Code</dt>
                    <dd className="font-medium text-slate-700 dark:text-slate-200">{bank.ifsc}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 dark:text-slate-500">Branch</dt>
                    <dd className="font-medium text-slate-700 dark:text-slate-200">{bank.branch}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 dark:text-slate-500">PAN Number</dt>
                    <dd className="font-medium text-slate-700 dark:text-slate-200">{bank.panNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 dark:text-slate-500">UAN</dt>
                    <dd className="font-medium text-slate-700 dark:text-slate-200">{bank.uan}</dd>
                  </div>
                </dl>
              </CardContent>
            )}

            {active === "salary" && canViewSalary && (
              <CardContent className="space-y-5">
                <div className="rounded-xl bg-indigo-50 px-4 py-3 dark:bg-indigo-500/10">
                  <p className="text-xs text-indigo-500 dark:text-indigo-400/80">Annual CTC</p>
                  <p className="text-xl font-bold text-indigo-700 dark:text-indigo-400">
                    ₹{salary.ctc.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Earnings</h3>
                    <div className="space-y-2">
                      {salary.earnings.map((e) => (
                        <div key={e.label} className="flex justify-between text-sm">
                          <span className="text-slate-500 dark:text-slate-400">{e.label}</span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            ₹{e.amount.toLocaleString("en-IN")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Deductions</h3>
                    <div className="space-y-2">
                      {salary.deductions.map((d) => (
                        <div key={d.label} className="flex justify-between text-sm">
                          <span className="text-slate-500 dark:text-slate-400">{d.label}</span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            ₹{d.amount.toLocaleString("en-IN")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            )}

            {active === "attendance" && (
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: "Present Days", value: attendanceSummary.presentDays },
                    { label: "Absent Days", value: attendanceSummary.absentDays },
                    { label: "Half Days", value: attendanceSummary.halfDays },
                    { label: "On Leave", value: attendanceSummary.onLeave },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-slate-100 p-3 text-center dark:border-slate-800">
                      <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{s.value}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}

            {active === "leave" && (
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {employeeLeaveBalances.map((l) => (
                    <div key={l.type} className="rounded-xl border border-slate-100 p-3 text-center dark:border-slate-800">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {l.used}/{l.total}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{l.type}</p>
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {employeeLeaves.map((l) => (
                    <div key={l.id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <p className="font-medium text-slate-700 dark:text-slate-200">{l.type}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {l.from} to {l.to} &middot; {l.days} day(s)
                        </p>
                      </div>
                      <StatusBadge status={l.status} />
                    </div>
                  ))}
                  {employeeLeaves.length === 0 && (
                    <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                      No leave requests on record.
                    </p>
                  )}
                </div>
              </CardContent>
            )}

            {active === "performance" && (
              <CardContent>
                {review ? (
                  <div className="flex items-center justify-between rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{review.period}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Performance review cycle</p>
                    </div>
                    <div className="text-right">
                      {review.rating && (
                        <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{review.rating}/5</p>
                      )}
                      <StatusBadge status={review.status} />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 dark:text-slate-500">No performance reviews yet.</p>
                )}
              </CardContent>
            )}

            {active === "security" && isOwnProfile && (
              <CardContent className="space-y-8">
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <ShieldCheck className="h-4 w-4" /> Account Security
                  </h3>
                  {isLocked ? (
                    <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
                      <Lock className="h-4 w-4 shrink-0" />
                      Account temporarily locked until{" "}
                      {new Date(signedInUser.account!.lockedUntil!).toLocaleTimeString()}.
                    </div>
                  ) : signedInUser.account && signedInUser.account.failedLoginAttempts > 0 ? (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {signedInUser.account.failedLoginAttempts} recent failed sign-in attempt(s) on this account.
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                      No security issues on this account.
                    </div>
                  )}
                </div>

                <ChangePasswordForm />

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      <Laptop className="h-4 w-4" /> Active Sessions
                    </h3>
                    {mySessions.length > 1 && signedInUser.account && (
                      <button
                        onClick={() => revokeOtherSessions(signedInUser.account!.id)}
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
                        <div
                          key={s.id}
                          className="flex items-center justify-between rounded-lg border border-slate-100 px-3.5 py-2.5 dark:border-slate-800"
                        >
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
                            <button
                              onClick={() => revokeSession(s.id)}
                              className="flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
                            >
                              <LogOut className="h-3.5 w-3.5" /> Sign out
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {mySessions.length === 0 && (
                      <p className="text-sm text-slate-400 dark:text-slate-500">No active sessions.</p>
                    )}
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
                          <p className="font-medium text-slate-700 dark:text-slate-200">
                            {securityEventLabel[e.type] ?? e.type}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{e.detail}</p>
                        </div>
                        <span className="text-xs text-slate-400 dark:text-slate-500">{timeAgo(e.timestamp)}</span>
                      </div>
                    ))}
                    {myEvents.length === 0 && (
                      <p className="py-2 text-sm text-slate-400 dark:text-slate-500">No recent activity.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reporting Line</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {employee.reportingTo ? (
              <>
                {employee.name} reports to{" "}
                <span className="font-medium text-slate-700 dark:text-slate-200">{employee.reportingTo}</span> in the{" "}
                {employee.department} department.
              </>
            ) : (
              <>
                {employee.name} is at the top of the organizational hierarchy in the{" "}
                {employee.department} department.
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (next.length < 8 || !/[a-zA-Z]/.test(next) || !/[0-9]/.test(next) || !/[^a-zA-Z0-9]/.test(next)) {
      setMessage({ tone: "error", text: "New password must be 8+ characters with a letter, number and symbol." });
      return;
    }
    if (next !== confirm) {
      setMessage({ tone: "error", text: "New password and confirmation don't match." });
      return;
    }
    const result = changePassword(current, next);
    if (!result.ok) {
      setMessage({
        tone: "error",
        text:
          result.error === "invalid_current_password"
            ? "Current password is incorrect."
            : result.error === "same_as_current"
              ? "New password must be different from your current password."
              : "Unable to change password right now.",
      });
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setMessage({ tone: "success", text: "Password changed successfully." });
  }

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <Lock className="h-4 w-4" /> Change Password
      </h3>
      {message && (
        <div
          className={`mb-3 flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm ${
            message.tone === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
          }`}
        >
          {message.tone === "success" ? <Check className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {message.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Current Password">
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </Field>
        <Field label="New Password">
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </Field>
        <Field label="Confirm New Password">
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        <div className="sm:col-span-3">
          <Button type="submit" size="sm">
            Update Password
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function EmployeeProfilePage(props: PageProps<"/employees/[id]">) {
  const { id } = use(props.params);
  return (
    <Suspense fallback={null}>
      <EmployeeProfileClient id={id} />
    </Suspense>
  );
}

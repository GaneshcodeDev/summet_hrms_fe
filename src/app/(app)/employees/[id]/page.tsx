"use client";

import { FormEvent, Suspense, use, useMemo, useState } from "react";
import { notFound, useSearchParams } from "next/navigation";
import Link from "next/link";
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
  Pencil,
  Phone,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { performanceReviews } from "@/lib/mock-data";
import { useSite } from "@/lib/site-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useEmployees, type EmployeeEditable } from "@/lib/employee-context";
import { useToast } from "@/lib/toast-context";
import { useAttendance, summarizeAttendance } from "@/lib/attendance-context";
import { useLeave } from "@/lib/leave-context";
import { usePayroll } from "@/lib/payroll-context";
import { useRegularization } from "@/lib/regularization-context";
import { useOrg } from "@/lib/org-context";
import { useMasters } from "@/lib/master-context";
import { useNow } from "@/lib/use-now";
import { changePassword, getSession, revokeOtherSessions, revokeSession } from "@/lib/auth";
import type {
  BankAccountType,
  EmergencyContact,
  Employee,
  EmployeeBankDetail,
  EmployeeDocumentRecord,
  EmployeeDocumentStatus,
  Gender,
  MaritalStatus,
  Nominee,
  WorkExperience,
} from "@/lib/types";

type ActionResult = { ok: boolean; message: string };

const baseTabs = [
  { id: "overview", label: "Overview" },
  { id: "personal", label: "Personal" },
  { id: "employment", label: "Employment" },
  { id: "organization", label: "Organization" },
  { id: "documents", label: "Documents" },
  { id: "attendance", label: "Attendance" },
  { id: "leave", label: "Leave" },
  { id: "performance", label: "Performance" },
  { id: "timeline", label: "Timeline" },
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
  const {
    getEmployeeByEmployeeId,
    canEdit: canEditEmployees,
    bankDetailFor,
    canManageBank: canManageBankDetail,
    saveBankDetail,
    documentsFor,
    canManageDocuments,
    addDocument,
    setDocumentStatus,
    updateEmployee,
  } = useEmployees();
  const { requestsFor, leaveTypesForSite, balanceSummaryFor } = useLeave();
  const { recordsForEmployee } = useAttendance();
  const { requestsFor: regularizationRequestsFor } = useRegularization();
  const { orgUnits } = useOrg();
  const { recordsOfType } = useMasters();
  const now = useNow();

  const employee = getEmployeeByEmployeeId(id);
  if (!employee) notFound();

  const isOwnProfile = signedInUser.employeeId === employee.employeeId;
  const canViewBank = isOwnProfile || canFeature("payroll.bank", "view");
  const canViewSalary = isOwnProfile || canFeature("payroll.salary", "view");
  const canViewDocuments = isOwnProfile || canFeature("employees.documents", "view") || canManageDocuments;
  const canViewProfileDetail = isOwnProfile || canFeature("employees.directory", "view");
  const canEditPersonalDetail = isOwnProfile || canEditEmployees;
  // "employees.directory: view" is a broad, non-row-scoped grant most roles
  // hold — it's NOT enough to gate this employee's own Leave data. Only show
  // it to the employee themself, HR/broad leave scope, or their own direct
  // manager — never trust the URL's employeeId as an ownership signal.
  const hasBroadLeaveScope = canFeature("leave.requests", "edit") || canFeature("leave.requests", "manage");
  const isDirectManager = employee.reportingManagerId === signedInUser.employeeId;
  const canViewEmployeeLeave =
    isOwnProfile ||
    hasBroadLeaveScope ||
    (isDirectManager && (canFeature("leave.requests", "approve") || canFeature("leave.requests", "reject")));

  const nameForOrgUnit = (unitId?: string) => (unitId ? orgUnits.find((u) => u.id === unitId)?.name : undefined);
  const nameForMaster = (type: Parameters<typeof recordsOfType>[0], recordId?: string) =>
    recordId ? recordsOfType(type).find((r) => r.id === recordId)?.name : undefined;
  const reportingManager = employee.reportingManagerId
    ? getEmployeeByEmployeeId(employee.reportingManagerId)
    : undefined;

  const tabs = useMemo(
    () => [
      baseTabs[0],
      ...(canViewProfileDetail ? [baseTabs[1], baseTabs[2], baseTabs[3]] : []),
      ...(canViewBank ? [{ id: "bank", label: "Bank Details" }] : []),
      ...(canViewProfileDetail ? [{ id: "statutory", label: "Statutory" }] : []),
      ...(canViewSalary ? [{ id: "salary", label: "Salary" }] : []),
      ...(canViewProfileDetail ? [{ id: "emergency", label: "Emergency" }, { id: "nominee", label: "Nominee" }] : []),
      ...(canViewDocuments ? [baseTabs[4]] : []),
      baseTabs[5],
      ...(canViewEmployeeLeave ? [baseTabs[6]] : []),
      ...(canViewProfileDetail ? [{ id: "experience", label: "Experience" }] : []),
      baseTabs[7],
      baseTabs[8],
      ...(isOwnProfile ? [{ id: "security", label: "Security" }] : []),
    ],
    [canViewBank, canViewSalary, canViewDocuments, canViewProfileDetail, canViewEmployeeLeave, isOwnProfile],
  );

  const initialTab = searchParams.get("tab");
  const [active, setActive] = useState(
    initialTab && tabs.some((t) => t.id === initialTab) ? initialTab : "overview",
  );

  const mappedSites = (employee.siteIds ?? [employee.siteId])
    .map((siteId) => sites.find((s) => s.id === siteId))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const documents = documentsFor(employee.employeeId);
  const bank = bankDetailFor(employee.employeeId);
  const { salaryStructureFor } = usePayroll();
  const salary = salaryStructureFor(employee.employeeId);
  const employeeLeaves = requestsFor(employee.employeeId);
  const employeeLeaveTypes = leaveTypesForSite(employee.siteId);
  const employeeRegularizations = regularizationRequestsFor(employee.employeeId);
  // Queried by employeeId (never by name) — attendance-store.ts is already
  // site-isolated since every record carries the siteId it was marked under.
  const employeeAttendance = useMemo(
    () => recordsForEmployee(employee.employeeId).slice().sort((a, b) => (a.date < b.date ? 1 : -1)),
    [recordsForEmployee, employee.employeeId],
  );
  const attendanceSummary = useMemo(() => summarizeAttendance(employeeAttendance), [employeeAttendance]);
  const review = performanceReviews.find((r) => r.employee === employee.name);

  // Built only from real records already on file — no synthetic history.
  // Not memoized: the list is small (a handful of records per employee) and
  // computing it fresh avoids a stale closure over `employee`.
  const timelineEvents: { date: string; label: string; detail?: string }[] = [
    { date: employee.dateOfJoining, label: "Joined", detail: `${employee.designation} · ${employee.department}` },
    ...(employee.confirmationDate
      ? [{ date: employee.confirmationDate, label: "Confirmed", detail: "Probation completed" }]
      : []),
    ...employeeLeaves
      .filter((l) => l.decidedOn && l.status !== "Pending")
      .map((l) => ({ date: l.decidedOn!, label: `Leave ${l.status.toLowerCase()}`, detail: `${l.type} · ${l.days} day(s)` })),
    ...employeeRegularizations
      .filter((r) => r.decidedOn && r.status !== "Pending")
      .map((r) => ({
        date: r.decidedOn!,
        label: `Regularization ${r.status.toLowerCase()}`,
        detail: `${r.date} · ${r.currentStatus} → ${r.requestedStatus}`,
      })),
    ...(salary
      ? [{ date: salary.updatedOn.slice(0, 10), label: "Salary structure updated", detail: `CTC ₹${salary.ctcAnnual.toLocaleString("en-IN")}` }]
      : []),
    ...documents.flatMap((d) => [
      { date: d.uploadedOn, label: "Document uploaded", detail: d.documentType },
      ...(d.verifiedOn ? [{ date: d.verifiedOn, label: `Document ${d.status.toLowerCase()}`, detail: d.documentType }] : []),
    ]),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

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

            {active === "personal" && canViewProfileDetail && (
              <PersonalTab employee={employee} canEdit={canEditPersonalDetail} updateEmployee={updateEmployee} />
            )}

            {active === "employment" && canViewProfileDetail && (
              <CardContent>
                <dl className="grid grid-cols-2 gap-y-4 text-sm">
                  <DL label="Employee Code" value={employee.employeeId} />
                  <DL label="Date of Joining" value={employee.dateOfJoining} />
                  <DL label="Employment Status" value={employee.status} />
                  <DL label="Employment Stage" value={employee.employmentStage} />
                  <DL label="Confirmation Date" value={employee.confirmationDate} />
                  <DL label="Probation Period" value={employee.probationPeriodMonths ? `${employee.probationPeriodMonths} month(s)` : undefined} />
                  <DL label="Employment Type" value={nameForMaster("EmploymentType", employee.employmentTypeId)} />
                  <DL label="Employee Type" value={nameForMaster("EmployeeType", employee.employeeTypeId)} />
                  <DL label="Shift" value={nameForMaster("Shift", employee.shiftId)} />
                </dl>
              </CardContent>
            )}

            {active === "organization" && canViewProfileDetail && (
              <CardContent>
                <dl className="grid grid-cols-2 gap-y-4 text-sm">
                  <DL label="Site" value={sites.find((s) => s.id === employee.siteId)?.name} />
                  <DL label="Business Unit" value={nameForOrgUnit(employee.businessUnitId)} />
                  <DL label="Plant" value={nameForOrgUnit(employee.plantId)} />
                  <DL label="Location" value={nameForOrgUnit(employee.locationId) ?? employee.location} />
                  <DL label="Department" value={employee.department} />
                  <DL label="Sub Department" value={nameForOrgUnit(employee.subDepartmentId)} />
                  <DL label="Designation" value={employee.designation} />
                  <DL label="Grade" value={nameForMaster("JobGrade", employee.gradeId)} />
                  <DL label="Cost Center" value={nameForOrgUnit(employee.costCenterId)} />
                  <DL label="Profit Center" value={nameForOrgUnit(employee.profitCenterId)} />
                  <DL
                    label="Reporting Manager"
                    value={reportingManager ? `${reportingManager.name} (${reportingManager.employeeId})` : undefined}
                  />
                </dl>
              </CardContent>
            )}

            {active === "documents" && canViewDocuments && (
              <DocumentsTab
                employee={employee}
                documents={documents}
                canManage={canManageDocuments}
                addDocument={addDocument}
                setDocumentStatus={setDocumentStatus}
                verifierName={signedInUser.name}
              />
            )}

            {active === "bank" && canViewBank && (
              <BankTab employee={employee} bank={bank} canManage={canManageBankDetail} saveBankDetail={saveBankDetail} />
            )}

            {active === "statutory" && canViewProfileDetail && (
              <StatutoryTab employee={employee} canEdit={canEditPersonalDetail} updateEmployee={updateEmployee} />
            )}

            {active === "emergency" && canViewProfileDetail && (
              <EmergencyTab employee={employee} canEdit={canEditPersonalDetail} updateEmployee={updateEmployee} />
            )}

            {active === "nominee" && canViewProfileDetail && (
              <NomineeTab employee={employee} canEdit={canEditPersonalDetail} updateEmployee={updateEmployee} />
            )}

            {active === "salary" && canViewSalary && (
              <CardContent className="space-y-5">
                {!salary ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    No salary structure configured yet. {canFeature("payroll.salary", "edit") && (
                      <>
                        Assign one from{" "}
                        <Link href="/payroll?tab=salary" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                          Payroll &rarr; Salary Structure
                        </Link>
                        .
                      </>
                    )}
                  </p>
                ) : (
                  <>
                    <div className="rounded-xl bg-indigo-50 px-4 py-3 dark:bg-indigo-500/10">
                      <p className="text-xs text-indigo-500 dark:text-indigo-400/80">Annual CTC</p>
                      <p className="text-xl font-bold text-indigo-700 dark:text-indigo-400">
                        ₹{salary.ctcAnnual.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Earnings (monthly)</h3>
                        <div className="space-y-2">
                          {salary.earnings.map((e) => (
                            <div key={e.componentId} className="flex justify-between text-sm">
                              <span className="text-slate-500 dark:text-slate-400">{e.label}</span>
                              <span className="font-medium text-slate-700 dark:text-slate-200">
                                ₹{e.amount.toLocaleString("en-IN")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Deductions (monthly)</h3>
                        <div className="space-y-2">
                          {salary.deductions.map((d) => (
                            <div key={d.componentId} className="flex justify-between text-sm">
                              <span className="text-slate-500 dark:text-slate-400">{d.label}</span>
                              <span className="font-medium text-slate-700 dark:text-slate-200">
                                ₹{d.amount.toLocaleString("en-IN")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            )}

            {active === "attendance" && (
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: "Present", value: attendanceSummary.present },
                    { label: "Absent", value: attendanceSummary.absent },
                    { label: "Half Day", value: attendanceSummary.halfDay },
                    { label: "On Leave", value: attendanceSummary.onLeave },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-slate-100 p-3 text-center dark:border-slate-800">
                      <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{s.value}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {employeeAttendance.slice(0, 15).map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="text-slate-600 dark:text-slate-300">{r.date}</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {r.status}
                        {r.punchIn && ` · ${r.punchIn}${r.punchOut ? `–${r.punchOut}` : ""}`}
                      </span>
                    </div>
                  ))}
                  {employeeAttendance.length === 0 && (
                    <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                      No attendance records on file.
                    </p>
                  )}
                </div>
              </CardContent>
            )}

            {active === "leave" && canViewEmployeeLeave && (
              <CardContent className="space-y-5">
                {employeeLeaveTypes.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500">No leave policy configured.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {employeeLeaveTypes.map((type) => {
                      const summary = balanceSummaryFor(employee.employeeId, employee.siteId, type.name);
                      return (
                        <div key={type.id} className="rounded-xl border border-slate-100 p-3 text-center dark:border-slate-800">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {summary?.used ?? 0}/{(summary?.opening ?? 0) + (summary?.accrued ?? 0) + (summary?.carryForward ?? 0)}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{type.name}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
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

            {active === "experience" && canViewProfileDetail && (
              <ExperienceTab employee={employee} canEdit={canEditPersonalDetail} updateEmployee={updateEmployee} />
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

            {active === "timeline" && (
              <CardContent>
                <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
                  {timelineEvents.map((event, i) => (
                    <div key={`${event.date}-${event.label}-${i}`} className="flex items-start gap-3 py-3">
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{event.label}</p>
                        {event.detail && <p className="text-xs text-slate-400 dark:text-slate-500">{event.detail}</p>}
                        <p className="text-xs text-slate-400 dark:text-slate-500">{event.date}</p>
                      </div>
                    </div>
                  ))}
                  {timelineEvents.length === 0 && (
                    <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                      No recorded events for this employee yet.
                    </p>
                  )}
                </div>
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

function DL({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-700 dark:text-slate-200">{value || "—"}</dd>
    </div>
  );
}

function PersonalTab({
  employee,
  canEdit,
  updateEmployee,
}: {
  employee: Employee;
  canEdit: boolean;
  updateEmployee: (id: string, patch: EmployeeEditable) => ActionResult;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const optional = (key: string) => String(form.get(key) ?? "").trim() || undefined;
    const result = updateEmployee(employee.id, {
      firstName: optional("firstName"),
      lastName: optional("lastName"),
      gender: optional("gender") as Gender | undefined,
      maritalStatus: optional("maritalStatus") as MaritalStatus | undefined,
      dateOfBirth: optional("dateOfBirth"),
      personalEmail: optional("personalEmail"),
      alternatePhone: optional("alternatePhone"),
      addressLine1: optional("addressLine1"),
      city: optional("city"),
      state: optional("state"),
      country: optional("country"),
      pincode: optional("pincode"),
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setEditing(false);
  }

  if (editing) {
    return (
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name">
              <Input name="firstName" defaultValue={employee.firstName} />
            </Field>
            <Field label="Last Name">
              <Input name="lastName" defaultValue={employee.lastName} />
            </Field>
            <Field label="Gender">
              <Select name="gender" defaultValue={employee.gender ?? ""}>
                <option value="">Not set</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </Select>
            </Field>
            <Field label="Marital Status">
              <Select name="maritalStatus" defaultValue={employee.maritalStatus ?? ""}>
                <option value="">Not set</option>
                <option>Single</option>
                <option>Married</option>
                <option>Other</option>
              </Select>
            </Field>
            <Field label="Date of Birth">
              <Input name="dateOfBirth" type="date" defaultValue={employee.dateOfBirth} />
            </Field>
            <Field label="Personal Email">
              <Input name="personalEmail" type="email" defaultValue={employee.personalEmail} />
            </Field>
            <Field label="Alternate Phone">
              <Input name="alternatePhone" defaultValue={employee.alternatePhone} />
            </Field>
            <Field label="Pincode">
              <Input name="pincode" defaultValue={employee.pincode} />
            </Field>
            <Field label="Address" className="col-span-2">
              <Input name="addressLine1" defaultValue={employee.addressLine1} />
            </Field>
            <Field label="City">
              <Input name="city" defaultValue={employee.city} />
            </Field>
            <Field label="State">
              <Input name="state" defaultValue={employee.state} />
            </Field>
            <Field label="Country">
              <Input name="country" defaultValue={employee.country} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </CardContent>
    );
  }

  return (
    <CardContent>
      <div className="mb-4 flex justify-end">
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-y-4 text-sm">
        <DL label="First Name" value={employee.firstName} />
        <DL label="Last Name" value={employee.lastName} />
        <DL label="Gender" value={employee.gender} />
        <DL label="Marital Status" value={employee.maritalStatus} />
        <DL label="Date of Birth" value={employee.dateOfBirth} />
        <DL label="Personal Email" value={employee.personalEmail} />
        <DL label="Work Email" value={employee.email} />
        <DL label="Mobile" value={employee.phone} />
        <DL label="Alternate Phone" value={employee.alternatePhone} />
        <DL label="Address" value={employee.addressLine1} />
        <DL label="City" value={employee.city} />
        <DL label="State" value={employee.state} />
        <DL label="Country" value={employee.country} />
        <DL label="Pincode" value={employee.pincode} />
      </dl>
    </CardContent>
  );
}

function StatutoryTab({
  employee,
  canEdit,
  updateEmployee,
}: {
  employee: Employee;
  canEdit: boolean;
  updateEmployee: (id: string, patch: EmployeeEditable) => ActionResult;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const optional = (key: string) => String(form.get(key) ?? "").trim() || undefined;
    const result = updateEmployee(employee.id, {
      pan: optional("pan"),
      pfNumber: optional("pfNumber"),
      uan: optional("uan"),
      esiNumber: optional("esiNumber"),
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setEditing(false);
  }

  if (editing) {
    return (
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="PAN">
              <Input name="pan" defaultValue={employee.pan} placeholder="ABCDE1234F" />
            </Field>
            <Field label="PF Number">
              <Input name="pfNumber" defaultValue={employee.pfNumber} />
            </Field>
            <Field label="UAN">
              <Input name="uan" defaultValue={employee.uan} />
            </Field>
            <Field label="ESI Number">
              <Input name="esiNumber" defaultValue={employee.esiNumber} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </CardContent>
    );
  }

  return (
    <CardContent>
      <div className="mb-4 flex justify-end">
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-y-4 text-sm">
        <DL label="PAN" value={employee.pan} />
        <DL label="PF Number" value={employee.pfNumber} />
        <DL label="UAN" value={employee.uan} />
        <DL label="ESI Number" value={employee.esiNumber} />
      </dl>
      <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
        Statutory compliance calculations (PF/ESI/TDS) are not part of this phase — this tab only stores the
        reference numbers.
      </p>
    </CardContent>
  );
}

function EmergencyTab({
  employee,
  canEdit,
  updateEmployee,
}: {
  employee: Employee;
  canEdit: boolean;
  updateEmployee: (id: string, patch: EmployeeEditable) => ActionResult;
}) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const contacts = employee.emergencyContacts ?? [];

  function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const relationship = String(form.get("relationship") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    if (!name || !relationship || !phone) {
      toast.error("Name, relationship and phone are required.");
      return;
    }
    const contact: EmergencyContact = {
      id: `ec-${Date.now().toString(36)}`,
      name,
      relationship,
      phone,
      alternatePhone: String(form.get("alternatePhone") ?? "").trim() || undefined,
      address: String(form.get("address") ?? "").trim() || undefined,
    };
    const result = updateEmployee(employee.id, { emergencyContacts: [...contacts, contact] });
    (result.ok ? toast.success : toast.error)(result.ok ? "Emergency contact added." : result.message);
    if (result.ok) {
      setAdding(false);
      e.currentTarget.reset();
    }
  }

  function handleRemove(id: string) {
    const result = updateEmployee(employee.id, { emergencyContacts: contacts.filter((c) => c.id !== id) });
    (result.ok ? toast.success : toast.error)(result.ok ? "Emergency contact removed." : result.message);
  }

  return (
    <CardContent className="space-y-4">
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {contacts.map((c) => (
          <div key={c.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {c.name} <span className="font-normal text-slate-400 dark:text-slate-500">· {c.relationship}</span>
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {c.phone}
                {c.alternatePhone && ` · ${c.alternatePhone}`}
                {c.address && ` · ${c.address}`}
              </p>
            </div>
            {canEdit && (
              <button onClick={() => handleRemove(c.id)} className="text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {contacts.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No emergency contacts on file.</p>
        )}
      </div>

      {canEdit && !adding && (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Contact
        </Button>
      )}

      {canEdit && adding && (
        <form className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700" onSubmit={handleAdd}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name">
              <Input name="name" required />
            </Field>
            <Field label="Relationship">
              <Input name="relationship" required placeholder="e.g. Spouse" />
            </Field>
            <Field label="Phone">
              <Input name="phone" required />
            </Field>
            <Field label="Alternate Phone">
              <Input name="alternatePhone" />
            </Field>
            <Field label="Address" className="col-span-2">
              <Input name="address" />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit">Add</Button>
          </div>
        </form>
      )}
    </CardContent>
  );
}

function NomineeTab({
  employee,
  canEdit,
  updateEmployee,
}: {
  employee: Employee;
  canEdit: boolean;
  updateEmployee: (id: string, patch: EmployeeEditable) => ActionResult;
}) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const nominees = employee.nominees ?? [];
  const totalPercentage = nominees.reduce((sum, n) => sum + n.percentage, 0);

  function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const relationship = String(form.get("relationship") ?? "").trim();
    const percentage = Number(form.get("percentage") ?? 0);
    if (!name || !relationship || !percentage) {
      toast.error("Name, relationship and percentage share are required.");
      return;
    }
    if (totalPercentage + percentage > 100) {
      toast.error(`Total nominee share can't exceed 100% (currently ${totalPercentage}%).`);
      return;
    }
    const nominee: Nominee = {
      id: `nom-${Date.now().toString(36)}`,
      name,
      relationship,
      percentage,
      dateOfBirth: String(form.get("dateOfBirth") ?? "").trim() || undefined,
      contact: String(form.get("contact") ?? "").trim() || undefined,
    };
    const result = updateEmployee(employee.id, { nominees: [...nominees, nominee] });
    (result.ok ? toast.success : toast.error)(result.ok ? "Nominee added." : result.message);
    if (result.ok) {
      setAdding(false);
      e.currentTarget.reset();
    }
  }

  function handleRemove(id: string) {
    const result = updateEmployee(employee.id, { nominees: nominees.filter((n) => n.id !== id) });
    (result.ok ? toast.success : toast.error)(result.ok ? "Nominee removed." : result.message);
  }

  return (
    <CardContent className="space-y-4">
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {nominees.map((n) => (
          <div key={n.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {n.name} <span className="font-normal text-slate-400 dark:text-slate-500">· {n.relationship}</span>
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {n.percentage}% share{n.dateOfBirth && ` · DOB ${n.dateOfBirth}`}
                {n.contact && ` · ${n.contact}`}
              </p>
            </div>
            {canEdit && (
              <button onClick={() => handleRemove(n.id)} className="text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {nominees.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No nominees on file.</p>
        )}
      </div>
      {nominees.length > 0 && (
        <p className={`text-xs ${totalPercentage === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
          Total allocated: {totalPercentage}%{totalPercentage !== 100 && " — should add up to 100%"}
        </p>
      )}

      {canEdit && !adding && (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Nominee
        </Button>
      )}

      {canEdit && adding && (
        <form className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700" onSubmit={handleAdd}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name">
              <Input name="name" required />
            </Field>
            <Field label="Relationship">
              <Input name="relationship" required placeholder="e.g. Spouse" />
            </Field>
            <Field label="Share %">
              <Input name="percentage" type="number" min={1} max={100} required />
            </Field>
            <Field label="Date of Birth">
              <Input name="dateOfBirth" type="date" />
            </Field>
            <Field label="Contact" className="col-span-2">
              <Input name="contact" />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit">Add</Button>
          </div>
        </form>
      )}
    </CardContent>
  );
}

function ExperienceTab({
  employee,
  canEdit,
  updateEmployee,
}: {
  employee: Employee;
  canEdit: boolean;
  updateEmployee: (id: string, patch: EmployeeEditable) => ActionResult;
}) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const experience = employee.previousExperience ?? [];
  const now = useNow();

  function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const company = String(form.get("company") ?? "").trim();
    const designation = String(form.get("designation") ?? "").trim();
    const startDate = String(form.get("startDate") ?? "").trim();
    if (!company || !designation || !startDate) {
      toast.error("Company, designation and start date are required.");
      return;
    }
    const entry: WorkExperience = {
      id: `exp-${Date.now().toString(36)}`,
      company,
      designation,
      startDate,
      endDate: String(form.get("endDate") ?? "").trim() || undefined,
      responsibilities: String(form.get("responsibilities") ?? "").trim() || undefined,
    };
    const result = updateEmployee(employee.id, { previousExperience: [...experience, entry] });
    (result.ok ? toast.success : toast.error)(result.ok ? "Experience added." : result.message);
    if (result.ok) {
      setAdding(false);
      e.currentTarget.reset();
    }
  }

  function handleRemove(id: string) {
    const result = updateEmployee(employee.id, { previousExperience: experience.filter((x) => x.id !== id) });
    (result.ok ? toast.success : toast.error)(result.ok ? "Experience removed." : result.message);
  }

  function years(entry: WorkExperience) {
    const start = new Date(entry.startDate).getTime();
    const end = entry.endDate ? new Date(entry.endDate).getTime() : (now ?? start);
    const diff = (end - start) / (1000 * 60 * 60 * 24 * 365.25);
    return diff > 0 ? diff.toFixed(1) : "0";
  }

  return (
    <CardContent className="space-y-4">
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {experience.map((x) => (
          <div key={x.id} className="flex items-start justify-between py-3">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {x.designation} <span className="font-normal text-slate-400 dark:text-slate-500">at {x.company}</span>
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {x.startDate} to {x.endDate ?? "Present"} &middot; {years(x)} yr(s)
              </p>
              {x.responsibilities && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{x.responsibilities}</p>}
            </div>
            {canEdit && (
              <button onClick={() => handleRemove(x.id)} className="text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {experience.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No prior experience on file.</p>
        )}
      </div>

      {canEdit && !adding && (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Experience
        </Button>
      )}

      {canEdit && adding && (
        <form className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700" onSubmit={handleAdd}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company">
              <Input name="company" required />
            </Field>
            <Field label="Designation">
              <Input name="designation" required />
            </Field>
            <Field label="Start Date">
              <Input name="startDate" type="date" required />
            </Field>
            <Field label="End Date">
              <Input name="endDate" type="date" />
            </Field>
            <Field label="Responsibilities" className="col-span-2">
              <Input name="responsibilities" />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit">Add</Button>
          </div>
        </form>
      )}
    </CardContent>
  );
}

function BankTab({
  employee,
  bank,
  canManage,
  saveBankDetail,
}: {
  employee: Employee;
  bank?: EmployeeBankDetail;
  canManage: boolean;
  saveBankDetail: (input: {
    employeeId: string;
    siteId: string;
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    branch: string;
    accountType: BankAccountType;
  }) => ActionResult;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(!bank && canManage);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = saveBankDetail({
      employeeId: employee.employeeId,
      siteId: employee.siteId,
      accountHolderName: String(form.get("accountHolderName") ?? "").trim(),
      bankName: String(form.get("bankName") ?? "").trim(),
      accountNumber: String(form.get("accountNumber") ?? "").trim(),
      ifsc: String(form.get("ifsc") ?? "").trim(),
      branch: String(form.get("branch") ?? "").trim(),
      accountType: form.get("accountType") as BankAccountType,
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setEditing(false);
  }

  if (editing) {
    return (
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Account Holder Name">
              <Input name="accountHolderName" required defaultValue={bank?.accountHolderName} />
            </Field>
            <Field label="Bank Name">
              <Input name="bankName" required defaultValue={bank?.bankName} />
            </Field>
            <Field label="Account Number">
              <Input name="accountNumber" required defaultValue={bank?.accountNumber} />
            </Field>
            <Field label="IFSC Code">
              <Input name="ifsc" required defaultValue={bank?.ifsc} />
            </Field>
            <Field label="Branch">
              <Input name="branch" required defaultValue={bank?.branch} />
            </Field>
            <Field label="Account Type">
              <Select name="accountType" defaultValue={bank?.accountType ?? "Savings"}>
                <option>Savings</option>
                <option>Current</option>
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            {bank && (
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
            <Button type="submit">Save</Button>
          </div>
        </form>
      </CardContent>
    );
  }

  if (!bank) {
    return (
      <CardContent>
        <p className="text-sm text-slate-400 dark:text-slate-500">No bank details on file yet.</p>
      </CardContent>
    );
  }

  return (
    <CardContent>
      <div className="mb-4 flex justify-end">
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-y-4 text-sm">
        <DL label="Account Holder Name" value={bank.accountHolderName} />
        <DL label="Bank Name" value={bank.bankName} />
        <DL label="Account Number" value={bank.accountNumber} />
        <DL label="IFSC Code" value={bank.ifsc} />
        <DL label="Branch" value={bank.branch} />
        <DL label="Account Type" value={bank.accountType} />
      </dl>
    </CardContent>
  );
}

function DocumentsTab({
  employee,
  documents,
  canManage,
  addDocument,
  setDocumentStatus,
  verifierName,
}: {
  employee: Employee;
  documents: EmployeeDocumentRecord[];
  canManage: boolean;
  addDocument: (input: {
    employeeId: string;
    siteId: string;
    documentType: string;
    documentNumber?: string;
    issueDate?: string;
    expiryDate?: string;
    fileRef?: string;
  }) => ActionResult;
  setDocumentStatus: (id: string, status: EmployeeDocumentStatus, verifierName: string) => ActionResult;
  verifierName: string;
}) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);

  function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const documentType = String(form.get("documentType") ?? "").trim();
    if (!documentType) {
      toast.error("Document type is required.");
      return;
    }
    const result = addDocument({
      employeeId: employee.employeeId,
      siteId: employee.siteId,
      documentType,
      documentNumber: String(form.get("documentNumber") ?? "").trim() || undefined,
      issueDate: String(form.get("issueDate") ?? "").trim() || undefined,
      expiryDate: String(form.get("expiryDate") ?? "").trim() || undefined,
      fileRef: String(form.get("fileRef") ?? "").trim() || undefined,
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      setAdding(false);
      e.currentTarget.reset();
    }
  }

  function handleStatus(id: string, status: EmployeeDocumentStatus) {
    const result = setDocumentStatus(id, status, verifierName);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  return (
    <CardContent className="space-y-4">
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{doc.documentType}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {doc.documentNumber && `${doc.documentNumber} · `}Uploaded {doc.uploadedOn}
                {doc.expiryDate && ` · Expires ${doc.expiryDate}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={doc.status} />
              {canManage && doc.status === "Pending" && (
                <>
                  <button
                    onClick={() => handleStatus(doc.id, "Verified")}
                    className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    Verify
                  </button>
                  <button
                    onClick={() => handleStatus(doc.id, "Rejected")}
                    className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {documents.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No documents on file.</p>
        )}
      </div>

      {canManage && !adding && (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Document
        </Button>
      )}

      {canManage && adding && (
        <form className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700" onSubmit={handleAdd}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Document Type">
              <Input name="documentType" required placeholder="e.g. PAN Card" />
            </Field>
            <Field label="Document Number">
              <Input name="documentNumber" />
            </Field>
            <Field label="Issue Date">
              <Input name="issueDate" type="date" />
            </Field>
            <Field label="Expiry Date">
              <Input name="expiryDate" type="date" />
            </Field>
            <Field label="File Reference" className="col-span-2">
              <Input name="fileRef" placeholder="Link or reference id" />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit">Add</Button>
          </div>
        </form>
      )}
    </CardContent>
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

"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { SiteLogo } from "@/components/ui/site-logo";
import { cn } from "@/lib/utils";
import { useSite } from "@/lib/site-context";
import { useOrg } from "@/lib/org-context";
import { useMasters } from "@/lib/master-context";
import { useEmployees } from "@/lib/employee-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useSiteConfig } from "@/lib/site-config-context";
import { useToast } from "@/lib/toast-context";
import { packageFeatures, siteStatuses } from "@/lib/mock-data";
import { timezoneOptions } from "@/lib/settings-data";
import { leaveTypeConfig, leaveTypes } from "@/lib/leave-data";
import { siteTypes } from "@/lib/types";
import type {
  LeaveApprovalMode,
  PackagePlan,
  PayFrequency,
  Site,
  SiteStatus,
  SiteType,
} from "@/lib/types";

const wizardSteps = [
  { id: 1, label: "Site Information" },
  { id: 2, label: "Organization Setup" },
  { id: 3, label: "Site Admin" },
  { id: 4, label: "Initial Configuration" },
  { id: 5, label: "Review & Create" },
];

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const logoColors = ["#4f46e5", "#0ea5e9", "#f59e0b", "#10b981", "#e11d48", "#7c3aed"];
const currencyOptions = ["INR (₹)", "USD ($)", "EUR (€)", "GBP (£)", "AED (د.إ)", "SGD ($)"];
const payFrequencies: PayFrequency[] = ["Monthly", "Bi-Weekly", "Weekly"];
const approvalModes: LeaveApprovalMode[] = ["Manager", "HR", "Manager then HR"];
const defaultComponentOptions = ["Basic Salary", "HRA", "Special Allowance", "Provident Fund", "Professional Tax", "Income Tax"];

function codeFrom(name: string, used: Set<string>): string {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "GEN";
  let code = base;
  let i = 1;
  while (used.has(code)) {
    code = `${base}${i}`;
    i += 1;
  }
  used.add(code);
  return code;
}

interface BasicInfo {
  name: string;
  code: string;
  legalName: string;
  siteType: SiteType;
  industry: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  timezone: string;
  currency: string;
  status: SiteStatus;
  package: PackagePlan;
  logoColor: string;
}

const initialBasic: BasicInfo = {
  name: "",
  code: "",
  legalName: "",
  siteType: "Corporate Office",
  industry: "",
  email: "",
  phone: "",
  addressLine1: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  timezone: timezoneOptions[0],
  currency: currencyOptions[0],
  status: "Trial",
  package: "Professional",
  logoColor: logoColors[0],
};

interface OrgSetupState {
  businessUnits: string[];
  plants: string[];
  locations: string[];
  costCenters: string[];
  profitCenters: string[];
  departments: string[];
  subDepartments: string[];
  designations: string[];
  grades: string[];
  employmentTypes: string[];
  employeeTypes: string[];
}

const initialOrgSetup: OrgSetupState = {
  businessUnits: [],
  plants: [],
  locations: [],
  costCenters: [],
  profitCenters: [],
  departments: [],
  subDepartments: [],
  designations: [],
  grades: [],
  employmentTypes: [],
  employeeTypes: [],
};

interface AdminInfo {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const initialAdmin: AdminInfo = { fullName: "", email: "", password: "", confirmPassword: "" };

interface AttendanceConfigState {
  workingDays: string[];
  weeklyOff: string[];
  gracePeriodMinutes: number;
  lateComingRule: string;
  earlyGoingRule: string;
  overtimeEnabled: boolean;
}

const initialAttendance: AttendanceConfigState = {
  workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  weeklyOff: ["Sat", "Sun"],
  gracePeriodMinutes: 10,
  lateComingRule: "Flag as late arrival after the grace period",
  earlyGoingRule: "Flag as early departure if leaving 30+ minutes before shift end",
  overtimeEnabled: true,
};

interface LeaveConfigState {
  enabledLeaveTypes: string[];
  approvalMode: LeaveApprovalMode;
  carryForwardEnabled: boolean;
  carryForwardMaxDays: number;
}

const initialLeave: LeaveConfigState = {
  enabledLeaveTypes: [...leaveTypes],
  approvalMode: "Manager",
  carryForwardEnabled: true,
  carryForwardMaxDays: 5,
};

interface PayrollConfigState {
  frequency: PayFrequency;
  payCycleStartDay: number;
  processingDay: number;
  defaultComponents: string[];
}

const initialPayroll: PayrollConfigState = {
  frequency: "Monthly",
  payCycleStartDay: 1,
  processingDay: 25,
  defaultComponents: [...defaultComponentOptions],
};

interface HolidayConfigState {
  calendarName: string;
  holidays: { name: string; date: string }[];
}

const initialHoliday: HolidayConfigState = { calendarName: "", holidays: [] };

export function SiteOnboardingWizard() {
  const router = useRouter();
  const toast = useToast();
  const { sites, addSite, setCurrentSiteId } = useSite();
  const { createOrgUnit } = useOrg();
  const { createRecord } = useMasters();
  const { createEmployee } = useEmployees();
  const { roles, accounts, createAccount } = useAccessControl();
  const { saveSiteConfig } = useSiteConfig();

  const [step, setStep] = useState(1);
  const [basic, setBasic] = useState<BasicInfo>(initialBasic);
  const [orgSetup, setOrgSetup] = useState<OrgSetupState>(initialOrgSetup);
  const [admin, setAdmin] = useState<AdminInfo>(initialAdmin);
  const [attendance, setAttendance] = useState<AttendanceConfigState>(initialAttendance);
  const [leaveConfig, setLeaveConfig] = useState<LeaveConfigState>(initialLeave);
  const [payrollConfig, setPayrollConfig] = useState<PayrollConfigState>(initialPayroll);
  const [holidayConfig, setHolidayConfig] = useState<HolidayConfigState>(initialHoliday);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validateStep(current: number): string | null {
    if (current === 1) {
      if (!basic.name.trim()) return "Site Name is required.";
      if (!basic.code.trim()) return "Site Code is required.";
      if (sites.some((s) => s.code.toLowerCase() === basic.code.trim().toLowerCase())) {
        return `Site Code "${basic.code}" is already in use — pick a unique code.`;
      }
      if (basic.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(basic.email)) return "Site email looks invalid.";
      if (!basic.addressLine1.trim() || !basic.city.trim() || !basic.state.trim() || !basic.pincode.trim() || !basic.country.trim()) {
        return "Complete the full address (line 1, city, state, pincode, country).";
      }
      return null;
    }
    if (current === 3) {
      if (!admin.fullName.trim()) return "Site Admin full name is required.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email)) return "Enter a valid Site Admin email.";
      if (accounts.some((a) => a.email.toLowerCase() === admin.email.trim().toLowerCase())) {
        return `An account already exists for ${admin.email}.`;
      }
      if (admin.password.length < 8) return "Password must be at least 8 characters.";
      if (admin.password !== admin.confirmPassword) return "Password and confirmation don't match.";
      return null;
    }
    return null;
  }

  function goNext() {
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep((s) => Math.min(5, s + 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  function handleCreateSite() {
    const step1Error = validateStep(1);
    const step3Error = validateStep(3);
    if (step1Error || step3Error) {
      setError(step1Error ?? step3Error);
      setStep(step1Error ? 1 : 3);
      return;
    }

    setSubmitting(true);
    const siteId = `site-${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);

    const newSite: Site = {
      id: siteId,
      name: basic.name.trim(),
      code: basic.code.trim().toUpperCase(),
      legalName: basic.legalName.trim() || undefined,
      siteType: basic.siteType,
      industry: basic.industry.trim() || undefined,
      email: basic.email.trim() || undefined,
      phone: basic.phone.trim() || undefined,
      timezone: basic.timezone,
      currency: basic.currency,
      logoColor: basic.logoColor,
      addressLine1: basic.addressLine1.trim(),
      city: basic.city.trim(),
      state: basic.state.trim(),
      pincode: basic.pincode.trim(),
      country: basic.country.trim(),
      package: basic.package,
      status: basic.status,
      adminName: admin.fullName.trim(),
      adminEmail: admin.email.trim(),
      adminPhone: "",
      createdOn: today,
      onboardingCompletedOn: new Date().toISOString(),
    };
    addSite(newSite);

    // Organization structure — every site gets one root Company; everything
    // else nests directly under it (Sub Departments under the first
    // Department) to keep this wizard simple. Full re-parenting is always
    // available afterward in the Organization module.
    const orgCodes = new Set<string>();
    const company = createOrgUnit({ type: "Company", name: newSite.name, code: newSite.code, parentId: null, siteId });
    orgCodes.add(newSite.code);

    orgSetup.businessUnits.forEach((name) =>
      createOrgUnit({ type: "BusinessUnit", name, code: codeFrom(name, orgCodes), parentId: company.id, siteId }),
    );
    orgSetup.plants.forEach((name) =>
      createOrgUnit({ type: "Plant", name, code: codeFrom(name, orgCodes), parentId: company.id, siteId }),
    );
    orgSetup.locations.forEach((name) =>
      createOrgUnit({ type: "Location", name, code: codeFrom(name, orgCodes), parentId: company.id, siteId, locationKind: "Location" }),
    );
    orgSetup.costCenters.forEach((name) =>
      createOrgUnit({ type: "CostCenter", name, code: codeFrom(name, orgCodes), parentId: company.id, siteId }),
    );
    orgSetup.profitCenters.forEach((name) =>
      createOrgUnit({ type: "ProfitCenter", name, code: codeFrom(name, orgCodes), parentId: company.id, siteId }),
    );
    const departmentUnits = orgSetup.departments.map((name) =>
      createOrgUnit({ type: "Department", name, code: codeFrom(name, orgCodes), parentId: company.id, siteId }),
    );
    const subDeptParentId = departmentUnits[0]?.id ?? company.id;
    orgSetup.subDepartments.forEach((name) =>
      createOrgUnit({ type: "SubDepartment", name, code: codeFrom(name, orgCodes), parentId: subDeptParentId, siteId }),
    );

    const masterCodes = new Set<string>();
    orgSetup.designations.forEach((name) => createRecord({ masterType: "Designation", name, code: codeFrom(name, masterCodes), siteId }));
    orgSetup.grades.forEach((name) => createRecord({ masterType: "JobGrade", name, code: codeFrom(name, masterCodes), siteId }));
    orgSetup.employmentTypes.forEach((name) => createRecord({ masterType: "EmploymentType", name, code: codeFrom(name, masterCodes), siteId }));
    orgSetup.employeeTypes.forEach((name) => createRecord({ masterType: "EmployeeType", name, code: codeFrom(name, masterCodes), siteId }));

    // Leave policy — turns Step 4's leave-type toggles into real site-scoped
    // "LeaveType" Master records (see master-data.ts) instead of leaving that
    // selection purely decorative. Every site also gets one unpaid escape
    // valve (Loss of Pay) by default since Leave -> Payroll integration
    // requires at least one unpaid type to exist; admins can rename/remove
    // it afterward via Masters like any other record.
    const leaveTypeCodes = new Set<string>();
    leaveConfig.enabledLeaveTypes.forEach((name) =>
      createRecord({
        masterType: "LeaveType",
        name,
        code: codeFrom(name, leaveTypeCodes),
        siteId,
        attributes: {
          paid: true,
          maxDaysPerYear: leaveTypeConfig[name]?.annualQuota ?? 12,
          carryForward: leaveConfig.carryForwardEnabled,
          maxCarryForwardDays: leaveConfig.carryForwardMaxDays,
          requiresApproval: true,
          requiresDocument: name === "Sick Leave",
        },
      }),
    );
    createRecord({
      masterType: "LeaveType",
      name: "Loss of Pay",
      code: codeFrom("Loss of Pay", leaveTypeCodes),
      siteId,
      attributes: { paid: false, maxDaysPerYear: 0, carryForward: false, requiresApproval: true },
    });

    // Site Admin — a real Employee + a real UserAccount, not a UI-only label.
    // Marked isAdminAccount so they don't inflate the site's employee headcount.
    const employeeResult = createEmployee({
      name: admin.fullName.trim(),
      email: admin.email.trim(),
      phone: "",
      department: "Administration",
      designation: "Site Administrator",
      location: newSite.city,
      siteId,
      isAdminAccount: true,
    });

    if (!employeeResult.ok || !employeeResult.employee) {
      toast.error(employeeResult.message);
      setSubmitting(false);
      return;
    }

    const siteAdminRoleId = roles.find((r) => r.name === "Site Admin")?.id;
    if (siteAdminRoleId) {
      createAccount({
        employeeId: employeeResult.employee.employeeId,
        roleIds: [siteAdminRoleId],
        siteIds: [siteId],
        password: admin.password,
      });
    } else {
      toast.error('The "Site Admin" role is missing from Access Control — the employee record was created, but no login account was.');
    }

    saveSiteConfig({
      siteId,
      attendance,
      leave: leaveConfig,
      payroll: payrollConfig,
      holiday: {
        calendarName: holidayConfig.calendarName.trim() || `${newSite.name} Holiday Calendar`,
        holidays: holidayConfig.holidays,
      },
      updatedOn: new Date().toISOString(),
    });

    toast.success(`${newSite.name} onboarded. Site Admin can sign in with ${admin.email}.`);
    setCurrentSiteId(siteId);
    router.push("/sites");
  }

  return (
    <div className="space-y-6">
      <StepIndicator current={step} />

      {error && (
        <div className="rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
          {error}
        </div>
      )}

      {step === 1 && <StepBasicInfo basic={basic} setBasic={setBasic} />}
      {step === 2 && <StepOrgSetup orgSetup={orgSetup} setOrgSetup={setOrgSetup} />}
      {step === 3 && <StepSiteAdmin admin={admin} setAdmin={setAdmin} />}
      {step === 4 && (
        <StepInitialConfig
          attendance={attendance}
          setAttendance={setAttendance}
          leaveConfig={leaveConfig}
          setLeaveConfig={setLeaveConfig}
          payrollConfig={payrollConfig}
          setPayrollConfig={setPayrollConfig}
          holidayConfig={holidayConfig}
          setHolidayConfig={setHolidayConfig}
        />
      )}
      {step === 5 && (
        <StepReview
          basic={basic}
          orgSetup={orgSetup}
          admin={admin}
          attendance={attendance}
          leaveConfig={leaveConfig}
          payrollConfig={payrollConfig}
          holidayConfig={holidayConfig}
        />
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-5 dark:border-slate-800">
        <div>
          {step > 1 && (
            <Button type="button" variant="outline" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/sites")}>
            Cancel
          </Button>
          {step < 5 ? (
            <Button type="button" onClick={goNext}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleCreateSite} disabled={submitting}>
              {submitting ? "Creating…" : "Create Site"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {wizardSteps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              s.id < current
                ? "bg-emerald-500 text-white"
                : s.id === current
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
            )}
          >
            {s.id < current ? <Check className="h-3.5 w-3.5" /> : s.id}
          </div>
          <span
            className={cn(
              "hidden text-xs font-medium sm:inline",
              s.id === current ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500",
            )}
          >
            {s.label}
          </span>
          {i < wizardSteps.length - 1 && <div className="h-px w-6 bg-slate-200 dark:bg-slate-700 sm:w-10" />}
        </div>
      ))}
    </div>
  );
}

function ChipListInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const trimmed = draft.trim();
    if (!trimmed || values.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...values, trimmed]);
    setDraft("");
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} tone="indigo" className="gap-1.5">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function StepBasicInfo({ basic, setBasic }: { basic: BasicInfo; setBasic: (fn: (b: BasicInfo) => BasicInfo) => void }) {
  function set<K extends keyof BasicInfo>(key: K, value: BasicInfo[K]) {
    setBasic((b) => ({ ...b, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Site Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center gap-4">
            <SiteLogo name={basic.name || "New Site"} color={basic.logoColor} size="lg" />
            <div className="flex gap-2">
              {logoColors.map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => set("logoColor", color)}
                  className={cn(
                    "h-7 w-7 rounded-full ring-offset-2 dark:ring-offset-slate-900",
                    basic.logoColor === color && "ring-2 ring-slate-400",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Site Name">
              <Input value={basic.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. ABC Manufacturing — Noida" required />
            </Field>
            <Field label="Site Code">
              <Input value={basic.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="e.g. ABC-NOIDA" required />
            </Field>
            <Field label="Legal Name">
              <Input value={basic.legalName} onChange={(e) => set("legalName", e.target.value)} placeholder="Registered legal entity name" />
            </Field>
            <Field label="Site Type">
              <Select value={basic.siteType} onChange={(e) => set("siteType", e.target.value as SiteType)}>
                {siteTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Industry">
              <Input value={basic.industry} onChange={(e) => set("industry", e.target.value)} placeholder="e.g. Manufacturing" />
            </Field>
            <Field label="Status">
              <Select value={basic.status} onChange={(e) => set("status", e.target.value as SiteStatus)}>
                {siteStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Email">
              <Input type="email" value={basic.email} onChange={(e) => set("email", e.target.value)} placeholder="site@company.com" />
            </Field>
            <Field label="Phone">
              <Input value={basic.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 90000 00000" />
            </Field>
            <Field label="Timezone">
              <Select value={basic.timezone} onChange={(e) => set("timezone", e.target.value)}>
                {timezoneOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Currency">
              <Select value={basic.currency} onChange={(e) => set("currency", e.target.value)}>
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 pt-0 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Address Line 1">
              <Input value={basic.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} placeholder="Building, street" required />
            </Field>
          </div>
          <Field label="City">
            <Input value={basic.city} onChange={(e) => set("city", e.target.value)} required />
          </Field>
          <Field label="State">
            <Input value={basic.state} onChange={(e) => set("state", e.target.value)} required />
          </Field>
          <Field label="Pincode">
            <Input value={basic.pincode} onChange={(e) => set("pincode", e.target.value)} required />
          </Field>
          <Field label="Country">
            <Input value={basic.country} onChange={(e) => set("country", e.target.value)} required />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Package &amp; Billing</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 pt-0 sm:grid-cols-3">
          {(Object.keys(packageFeatures) as PackagePlan[]).map((plan) => (
            <button
              type="button"
              key={plan}
              onClick={() => set("package", plan)}
              className={cn(
                "relative rounded-xl border p-4 text-left transition-colors",
                basic.package === plan
                  ? "border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-200 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:ring-indigo-500/30"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600",
              )}
            >
              {basic.package === plan && (
                <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              <p className="font-semibold text-slate-900 dark:text-white">{plan}</p>
              <p className="mt-1 text-sm font-medium text-indigo-600 dark:text-indigo-400">{packageFeatures[plan].price}</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{packageFeatures[plan].employeeLimit}</p>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StepOrgSetup({
  orgSetup,
  setOrgSetup,
}: {
  orgSetup: OrgSetupState;
  setOrgSetup: (fn: (o: OrgSetupState) => OrgSetupState) => void;
}) {
  function setField<K extends keyof OrgSetupState>(key: K, values: string[]) {
    setOrgSetup((o) => ({ ...o, [key]: values }));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Organization Structure</CardTitle>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Every site starts with one root Company; anything you add here nests underneath it. You can always
              re-organize the full hierarchy later in Organization.
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 pt-0 sm:grid-cols-2">
          <ChipListInput label="Business Units" placeholder="e.g. Manufacturing" values={orgSetup.businessUnits} onChange={(v) => setField("businessUnits", v)} />
          <ChipListInput label="Plants" placeholder="e.g. Noida Plant" values={orgSetup.plants} onChange={(v) => setField("plants", v)} />
          <ChipListInput label="Locations" placeholder="e.g. Noida Location" values={orgSetup.locations} onChange={(v) => setField("locations", v)} />
          <ChipListInput label="Cost Centers" placeholder="e.g. Production Cost Center" values={orgSetup.costCenters} onChange={(v) => setField("costCenters", v)} />
          <ChipListInput label="Profit Centers" placeholder="e.g. Manufacturing Profit Center" values={orgSetup.profitCenters} onChange={(v) => setField("profitCenters", v)} />
          <div className="sm:col-span-2 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <ChipListInput label="Departments" placeholder="e.g. Production" values={orgSetup.departments} onChange={(v) => setField("departments", v)} />
            <ChipListInput label="Sub Departments" placeholder="e.g. Assembly Line" values={orgSetup.subDepartments} onChange={(v) => setField("subDepartments", v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employment Masters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 pt-0 sm:grid-cols-2">
          <ChipListInput label="Designations" placeholder="e.g. Machine Operator" values={orgSetup.designations} onChange={(v) => setField("designations", v)} />
          <ChipListInput label="Grades" placeholder="e.g. Grade 3" values={orgSetup.grades} onChange={(v) => setField("grades", v)} />
          <ChipListInput label="Employment Types" placeholder="e.g. Full-Time" values={orgSetup.employmentTypes} onChange={(v) => setField("employmentTypes", v)} />
          <ChipListInput label="Employee Types" placeholder="e.g. Permanent" values={orgSetup.employeeTypes} onChange={(v) => setField("employeeTypes", v)} />
        </CardContent>
      </Card>
    </div>
  );
}

function StepSiteAdmin({ admin, setAdmin }: { admin: AdminInfo; setAdmin: (fn: (a: AdminInfo) => AdminInfo) => void }) {
  function set<K extends keyof AdminInfo>(key: K, value: AdminInfo[K]) {
    setAdmin((a) => ({ ...a, [key]: value }));
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Site Administrator</CardTitle>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Creates a real login account with the <span className="font-medium">Site Admin</span> role, scoped to
            this site only. They&apos;ll be able to sign in immediately with the credentials below.
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 pt-0 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Full Name">
            <Input value={admin.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="e.g. Kavya Reddy" required />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Email">
            <Input type="email" value={admin.email} onChange={(e) => set("email", e.target.value)} placeholder="admin@abc.com" required />
          </Field>
        </div>
        <Field label="Password">
          <Input type="password" value={admin.password} onChange={(e) => set("password", e.target.value)} placeholder="8+ characters" required />
        </Field>
        <Field label="Confirm Password">
          <Input type="password" value={admin.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} required />
        </Field>
        <Field label="Role">
          <Input value="Site Admin" disabled />
        </Field>
      </CardContent>
    </Card>
  );
}

function StepInitialConfig({
  attendance,
  setAttendance,
  leaveConfig,
  setLeaveConfig,
  payrollConfig,
  setPayrollConfig,
  holidayConfig,
  setHolidayConfig,
}: {
  attendance: AttendanceConfigState;
  setAttendance: (fn: (a: AttendanceConfigState) => AttendanceConfigState) => void;
  leaveConfig: LeaveConfigState;
  setLeaveConfig: (fn: (l: LeaveConfigState) => LeaveConfigState) => void;
  payrollConfig: PayrollConfigState;
  setPayrollConfig: (fn: (p: PayrollConfigState) => PayrollConfigState) => void;
  holidayConfig: HolidayConfigState;
  setHolidayConfig: (fn: (h: HolidayConfigState) => HolidayConfigState) => void;
}) {
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");

  function toggleDay(list: string[], day: string) {
    return list.includes(day) ? list.filter((d) => d !== day) : [...list, day];
  }

  function addHoliday() {
    if (!holidayName.trim() || !holidayDate) return;
    setHolidayConfig((h) => ({ ...h, holidays: [...h.holidays, { name: holidayName.trim(), date: holidayDate }] }));
    setHolidayName("");
    setHolidayDate("");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Working Days</span>
            <div className="flex flex-wrap gap-2">
              {weekDays.map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => setAttendance((a) => ({ ...a, workingDays: toggleDay(a.workingDays, d) }))}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium",
                    attendance.workingDays.includes(d)
                      ? "border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-400"
                      : "border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Weekly Off</span>
            <div className="flex flex-wrap gap-2">
              {weekDays.map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => setAttendance((a) => ({ ...a, weeklyOff: toggleDay(a.weeklyOff, d) }))}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium",
                    attendance.weeklyOff.includes(d)
                      ? "border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400"
                      : "border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Grace Period (minutes)">
              <Input
                type="number"
                min={0}
                value={attendance.gracePeriodMinutes}
                onChange={(e) => setAttendance((a) => ({ ...a, gracePeriodMinutes: Number(e.target.value) || 0 }))}
              />
            </Field>
            <label className="mt-6 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={attendance.overtimeEnabled}
                onChange={(e) => setAttendance((a) => ({ ...a, overtimeEnabled: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
              />
              Enable overtime tracking
            </label>
            <Field label="Late-Coming Rule">
              <Input value={attendance.lateComingRule} onChange={(e) => setAttendance((a) => ({ ...a, lateComingRule: e.target.value }))} />
            </Field>
            <Field label="Early-Going Rule">
              <Input value={attendance.earlyGoingRule} onChange={(e) => setAttendance((a) => ({ ...a, earlyGoingRule: e.target.value }))} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leave</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Enabled Leave Types</span>
            <div className="flex flex-wrap gap-2">
              {leaveTypes.map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setLeaveConfig((l) => ({ ...l, enabledLeaveTypes: toggleDay(l.enabledLeaveTypes, t) }))}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium",
                    leaveConfig.enabledLeaveTypes.includes(t)
                      ? "border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-400"
                      : "border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Approval Mode">
              <Select
                value={leaveConfig.approvalMode}
                onChange={(e) => setLeaveConfig((l) => ({ ...l, approvalMode: e.target.value as LeaveApprovalMode }))}
              >
                {approvalModes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="mt-6 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={leaveConfig.carryForwardEnabled}
                onChange={(e) => setLeaveConfig((l) => ({ ...l, carryForwardEnabled: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
              />
              Allow carry-forward
            </label>
            <Field label="Max Carry-Forward Days">
              <Input
                type="number"
                min={0}
                disabled={!leaveConfig.carryForwardEnabled}
                value={leaveConfig.carryForwardMaxDays}
                onChange={(e) => setLeaveConfig((l) => ({ ...l, carryForwardMaxDays: Number(e.target.value) || 0 }))}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payroll</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Pay Frequency">
              <Select
                value={payrollConfig.frequency}
                onChange={(e) => setPayrollConfig((p) => ({ ...p, frequency: e.target.value as PayFrequency }))}
              >
                {payFrequencies.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Pay Cycle Start Day">
              <Input
                type="number"
                min={1}
                max={28}
                value={payrollConfig.payCycleStartDay}
                onChange={(e) => setPayrollConfig((p) => ({ ...p, payCycleStartDay: Number(e.target.value) || 1 }))}
              />
            </Field>
            <Field label="Processing Day">
              <Input
                type="number"
                min={1}
                max={28}
                value={payrollConfig.processingDay}
                onChange={(e) => setPayrollConfig((p) => ({ ...p, processingDay: Number(e.target.value) || 1 }))}
              />
            </Field>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Default Salary Components</span>
            <div className="flex flex-wrap gap-2">
              {defaultComponentOptions.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setPayrollConfig((p) => ({ ...p, defaultComponents: toggleDay(p.defaultComponents, c) }))}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium",
                    payrollConfig.defaultComponents.includes(c)
                      ? "border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-400"
                      : "border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Holiday Calendar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <Field label="Calendar Name">
            <Input
              value={holidayConfig.calendarName}
              onChange={(e) => setHolidayConfig((h) => ({ ...h, calendarName: e.target.value }))}
              placeholder="e.g. ABC Noida Holiday Calendar"
            />
          </Field>
          <div className="flex gap-2">
            <Input value={holidayName} onChange={(e) => setHolidayName(e.target.value)} placeholder="Holiday name" className="flex-1" />
            <Input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} className="w-auto" />
            <Button type="button" variant="outline" onClick={addHoliday}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {holidayConfig.holidays.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {holidayConfig.holidays.map((h, i) => (
                <div key={`${h.name}-${h.date}`} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-600 dark:text-slate-300">
                    {h.name} — {h.date}
                  </span>
                  <button
                    type="button"
                    onClick={() => setHolidayConfig((cfg) => ({ ...cfg, holidays: cfg.holidays.filter((_, idx) => idx !== i) }))}
                    className="text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-400 dark:text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );
}

function StepReview({
  basic,
  orgSetup,
  admin,
  attendance,
  leaveConfig,
  payrollConfig,
  holidayConfig,
}: {
  basic: BasicInfo;
  orgSetup: OrgSetupState;
  admin: AdminInfo;
  attendance: AttendanceConfigState;
  leaveConfig: LeaveConfigState;
  payrollConfig: PayrollConfigState;
  holidayConfig: HolidayConfigState;
}) {
  const orgTotal = useMemo(
    () => Object.values(orgSetup).reduce((sum, list) => sum + list.length, 0),
    [orgSetup],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Site</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ReviewRow label="Name" value={basic.name || "—"} />
          <ReviewRow label="Code" value={basic.code || "—"} />
          <ReviewRow label="Type" value={basic.siteType} />
          <ReviewRow label="Location" value={[basic.city, basic.state, basic.country].filter(Boolean).join(", ") || "—"} />
          <ReviewRow label="Package" value={basic.package} />
          <ReviewRow label="Status" value={basic.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization ({orgTotal} record{orgTotal === 1 ? "" : "s"})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {orgTotal === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              No organization records added — you can configure these later in Organization &amp; Masters.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {Object.values(orgSetup)
                .flat()
                .map((name) => (
                  <Badge key={name}>{name}</Badge>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Site Admin</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ReviewRow label="Name" value={admin.fullName || "—"} />
          <ReviewRow label="Email" value={admin.email || "—"} />
          <ReviewRow label="Role" value="Site Admin" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ReviewRow label="Working Days" value={attendance.workingDays.join(", ") || "—"} />
          <ReviewRow label="Weekly Off" value={attendance.weeklyOff.join(", ") || "—"} />
          <ReviewRow label="Grace Period" value={`${attendance.gracePeriodMinutes} min`} />
          <ReviewRow label="Overtime" value={attendance.overtimeEnabled ? "Enabled" : "Disabled"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leave</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ReviewRow label="Leave Types" value={leaveConfig.enabledLeaveTypes.join(", ") || "—"} />
          <ReviewRow label="Approval Mode" value={leaveConfig.approvalMode} />
          <ReviewRow
            label="Carry Forward"
            value={leaveConfig.carryForwardEnabled ? `Up to ${leaveConfig.carryForwardMaxDays} days` : "Disabled"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payroll</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ReviewRow label="Frequency" value={payrollConfig.frequency} />
          <ReviewRow label="Pay Cycle Start" value={`Day ${payrollConfig.payCycleStartDay}`} />
          <ReviewRow label="Processing Day" value={`Day ${payrollConfig.processingDay}`} />
          <ReviewRow label="Components" value={payrollConfig.defaultComponents.join(", ") || "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Holiday</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ReviewRow label="Calendar" value={holidayConfig.calendarName || `${basic.name || "Site"} Holiday Calendar`} />
          <ReviewRow label="Holidays" value={holidayConfig.holidays.length} />
        </CardContent>
      </Card>
    </div>
  );
}

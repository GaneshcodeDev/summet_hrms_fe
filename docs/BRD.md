# Business Requirements Document — Summet HRMS

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Business Requirements Document (BRD) |
| Product Name | Summet HRMS |
| Version | 1.0 (Phase 18B) |
| Date | 2026-08-17 |
| Status | Draft — reflects the currently implemented frontend only |
| Prepared For | Summet HRMS stakeholders / client onboarding |
| Prepared By | Engineering (derived from a full read-only audit of `summeet_hrms_fe`) |

This document is generated **from the actual implementation**, not from a
spec or a wishlist. Every capability described in Sections 5–29 was
verified against source in `src/lib/*.ts`, `src/lib/*-context.tsx`, and
`src/app/(app)/**`. Where a typical HRMS capability is absent, this is
stated explicitly rather than silently omitted.

## 2. Executive Summary

Summet HRMS is a multi-site (multi-tenant) Human Resource Management
System frontend covering the full employee lifecycle: recruitment,
onboarding, employee master data, attendance, leave, payroll, performance,
training, assets, expenses, offboarding, and cross-module reporting.

**Business problem it solves:** organizations running HR operations across
multiple physical sites/offices need one system that (a) keeps each site's
data isolated from every other site, (b) lets a small platform team
(Super Admin) onboard new client sites without engineering involvement,
and (c) gives every role — from a Site HR Admin down to an individual
Employee — a self-service experience scoped to exactly what they're
allowed to see and do.

**Target users:** platform operators (Super Admin), site-level HR/Admin
teams, department/reporting managers, functional specialists (Payroll
Admin, Finance, Recruiter), and every employee at an onboarded site
(self-service).

**Multi-site architecture:** the platform is built around a strict
Super Admin → Site → Organization → Employees → Modules hierarchy (see
Section 7). Every business record (employee, attendance entry, leave
request, payslip, asset, expense, …) carries a `siteId`, and every
non-Super-Admin account is restricted to the sites explicitly mapped to
it.

**Centralized HR management:** a Site Admin/HR Admin configures their
site's organization structure and master data once (departments,
designations, shifts, leave types, salary components, …), after which
every downstream module (attendance, leave, payroll, performance,
training) reads from that same configuration — there is no duplicate
data entry per module.

**Covered domains** (each detailed in its own section below): Employee
Lifecycle (§11), Attendance (§12), Leave (§13), Payroll (§14),
Recruitment (§15), Onboarding (§16), Performance (§17), Training (§18),
Assets (§19), Expenses (§20), Reports (§21).

## 3. Business Objectives

1. Centralize employee master data (personal, contact, employment,
   organization, statutory, bank, emergency, nominee, experience,
   documents, salary, manager, shift, site) in one record per employee.
2. Support multiple physical/legal sites under one platform, each
   independently configurable and data-isolated.
3. Enforce role-based access control down to the feature-action level
   (view/create/edit/delete/approve/reject/export/import/manage) for
   every module.
4. Manage the full employee lifecycle: joining through confirmation,
   transfer, promotion, manager/shift changes, salary revision, and
   exit/final settlement.
5. Track attendance (punch in/out, late/early/overtime detection,
   regularization) and reconcile it against leave and payroll.
6. Manage leave end-to-end: types, balances, approval workflow,
   attendance sync, and payroll (LOP) impact.
7. Process payroll: versioned salary structures, payroll runs
   (Processing → Approved → Locked), payslips, loan EMIs, LOP.
8. Run recruitment from requisition through offer acceptance, handing
   off cleanly into Onboarding.
9. Onboard new hires with a task/document checklist and buddy
   assignment, ending in real Employee + Salary Structure creation.
10. Manage performance via cycles, goals, weighted scoring, and
    appraisals that can trigger a salary revision or promotion.
11. Manage training: programs, requests, capacity-limited enrollment,
    assessment, and skill updates.
12. Track assets across their lifecycle: assignment, return,
    maintenance, retirement, disposal — visible during offboarding.
13. Manage travel and expense claims through a two-step
    (Manager → Finance) approval to reimbursement.
14. Provide role-scoped dashboards and a cross-module reporting suite
    with site/date/dimension filters.
15. Provide a reusable, auditable Approval Engine with self-approval
    prevention, used consistently across the modules above.

## 4. Scope

### Currently Implemented

Everything described in Sections 5–29 of this document: multi-site RBAC,
site onboarding wizard, organization structure, employee master, employee
lifecycle events (see the caveats in §11), attendance + regularization,
leave (with approval-mode configuration), payroll (without statutory
tax/PF/ESI compliance calculations — see §14), recruitment through
offer acceptance, onboarding, performance cycles/appraisals, training
and skills, asset lifecycle, expense/travel claims, in-app notifications,
global search, reports/analytics, and a shared Approval Engine.

### Future / Not Yet Implemented

- A real backend (NestJS API, Prisma, MySQL) — see §31. Today every store
  is `localStorage`-backed in the browser (see §26, §31).
- Server-verified authentication (JWT/session store), real password
  hashing, MFA.
- Statutory payroll calculations: TDS (income-tax slabs/regimes), ESI,
  and a compliant PF wage-ceiling calculation. `TaxDeclaration` records
  are captured but not applied to payslip calculation today.
- Leave accrual engine (monthly/periodic balance accrual) — the balance
  model has `accrued`/`carryForward` fields, but nothing currently
  computes them.
- Email/SMS/push notification delivery — notifications are in-app only
  today; an `EmailSettings` shape exists in Settings but is not wired to
  send anything.
- Real file upload/storage for employee documents — `fileRef` is a
  filename/reference string only.
- Any third-party integration (payroll processor, biometric device,
  background-check vendor, job board, calendar/email provider).
- Automated test suite — no `test` script or Jest/Vitest/Playwright
  configuration exists in this repository at the time of this document.

## 5. User Roles

All roles are defined in `src/lib/rbac-data.ts` (`seedRoles` /
`seedRolePermissions`), are marked `isSystem: true`, and are always
present as **role configuration** regardless of tenant data state (see
§8, §27). Site scope is **not** stored on the role itself — it comes from
the `siteIds` on the specific `UserAccount` holding that role, except
Super Admin, which is hard-coded to bypass every site check.

| Role | Purpose (verbatim from code) | Typical user | Site scope |
|---|---|---|---|
| Super Admin | Full platform access across every tenant site. | Platform operator | Platform-wide (no `siteIds`) |
| Site Admin | Full administrative access within their own site only — cannot see or switch to other sites. | Client's on-site administrator | Own site only |
| HR Admin | Manages HR configuration, employees and access across the org. | Central/site HR lead | Mapped site(s) |
| HR Manager | Runs day-to-day HR operations: employees, attendance, leave, recruitment. | Operational HR | Mapped site(s) |
| Payroll Admin | Owns payroll processing and payslip distribution. | Payroll specialist | Mapped site(s) |
| Finance | Views payroll costs and financial reports. | Finance/accounts | Mapped site(s) |
| Department Head | Oversees a department's people, leave and performance. | Head of a department | Mapped site(s) |
| Manager | Manages a direct-reporting team. | Line/team manager | Mapped site(s) |
| Recruiter | Runs the hiring pipeline: openings, candidates, interviews and offers. No payroll or employee salary/bank access. | Talent acquisition | Mapped site(s) |
| Hiring Manager | Raises and approves requisitions for their own team; views candidates and interviews for their open roles. | Manager who is hiring | Mapped site(s) |
| Employee | Self-service access to own profile, attendance and leave. | Every regular employee | Own site(s) |
| Auditor | Read-only access across modules for compliance review. | Internal/external audit | Mapped site(s) |

**Modules accessible and actions available per role** — the platform has
19 feature modules and 33 individually-permissioned features (see §26 for
the full catalog). Rather than repeat all 33 rows per role, the table
below summarizes each role's *effective* footprint; the complete,
row-by-row grant matrix is in `docs/BRD-Complete.md`.

| Role | Effective footprint |
|---|---|
| Super Admin | `manage` on all 33 features (bypasses the permission map entirely — hard-coded bypass in `access-control-context.tsx`). |
| Site Admin | `manage` on every operational module (Employees, Organization, Masters, Attendance, Leave, full Payroll, Onboarding, Offboarding, Recruitment, Performance, Training, Assets, Expenses, Access Control > Users, Events) within their site; `view`-only on platform-level concerns (Sites, Roles, Permissions are **not** granted). |
| HR Admin | `manage` on most operational modules; narrower on Leave (view/edit/approve/reject), Payroll (view/export payslips, no salary/bank edit), Settings, and Access Control (view-only on Roles/Permissions). |
| HR Manager | Broad operational access (create/edit) across Employees, Attendance, Leave, Recruitment, Performance, Training; `view`-only on Payroll payslips. |
| Payroll Admin | `manage` on all five Payroll features (Payslips, Salary, Bank, Loans, Tax) plus Masters and Offboarding; `view`-only elsewhere. |
| Finance | `view`/`export` on Payroll and Reports; `manage` on Expense Claims; `view`/`create`/`approve` on Travel. No payroll edit rights. |
| Department Head | `view`/`approve` across their department's Attendance, Leave, Requisitions, Reviews, Expenses; no create/edit on Employees or Payroll. |
| Manager | Same shape as Department Head but narrower (e.g., no create/approve on Performance Cycles, only `view`/`edit` on Reviews). |
| Recruiter | `manage` on Job Openings and Hiring Pipeline; `view`/`create` on Requisitions; no Payroll, no Employee edit. |
| Hiring Manager | `view`/`create`/`approve` on Requisitions for their own team; `view`-only on the Pipeline. |
| Employee | `view`/`create` only, no approvals — own Attendance, own Leave, own Loans, own Expenses, own Training requests, own Asset requests, own Tax declaration. |
| Auditor | `view` (plus `export` on Reports) across virtually every module; no create/edit/approve anywhere. |

## 6. Super Admin

The Super Admin is the platform operator, not a site employee (its
`UserAccount.employeeId` is the sentinel `"SUPERADMIN"`, deliberately not
`EMP001`, so the first real employee ever created doesn't collide with it
— see `rbac-data.ts`). Its responsibilities:

- **Platform-level access**: bypasses every RBAC and site-scope check
  (`canFeature`/`canModule` short-circuit to `true` whenever
  `isSuperAdmin` is true — see `access-control-context.tsx`).
- **Site creation and onboarding**: the only role that can run the Site
  Onboarding Wizard (§8) to create a new tenant site.
- **Site administration**: can view and switch into any site (`isAllSites`
  toggle in `site-context.tsx`), unlike every other role which is
  confined to its mapped sites.
- **Role and permission management**: the only role granted
  `access-control.roles` / `access-control.permissions` edit/manage — a
  deliberate privilege-escalation guard (see §26).
- **Global configuration**: platform-wide `settings.organization` and
  global-scope Master records (`scope: "global"` in `master-data.ts`).
- **Cross-site access**: the only role permitted to move an employee
  across sites (`transferEmployee`'s cross-site branch in
  `employee-lifecycle-context.tsx` is Super-Admin-gated).

## 7. Multi-Site Architecture

```
Super Admin (platform)
  |
  v
Sites  (site-context.tsx: sitesStore — one Site record per tenant)
  |
  v
Organization  (org-context.tsx: OrgUnit tree scoped by siteId — Company,
               Business Unit, Division, Department, Sub Department,
               Branch, Plant, Location, Cost Center, Profit Center)
  |
  v
Employees  (employee-context.tsx: employeesStore, siteId required)
  |
  v
Modules  (Attendance, Leave, Payroll, Recruitment, Onboarding,
          Offboarding, Performance, Training, Assets, Expenses — every
          record in every module carries a siteId)
```

**Site isolation**: enforced primarily at the data layer.
`useSiteFilter()` (in `site-context.tsx`) is applied by every module's
list page to scope records to the current account's `mappedSites`.
Direct-URL access to a specific record (e.g. `/employees/[id]`,
`/onboarding/[id]`) is additionally guarded per-page (see the "Direct-URL
Guard" column in `docs/architecture-audit.md`'s per-module table).

**Non-Super-Admin restriction**: every other account's `siteIds` array
defines the sites it can reach. Site Admin is explicitly documented as
"cannot see or switch to other sites" — even though its permission grant
looks similar in shape to Super Admin's, it is bounded by `siteIds` at
the data layer, not by the permission map itself.

## 8. Site Onboarding

The Site Onboarding Wizard (`src/components/sites/site-onboarding-wizard.tsx`,
reached from `/sites/new`) is a multi-step flow, Super-Admin-only:

1. **Basic Information** — site name, code, legal name, site type,
   industry, address, contact email/phone, timezone, currency.
2. **Organization Setup** — initial organization structure seed for the
   new site.
3. **Site Admin** — creates the first `UserAccount` for the new site,
   assigned the Site Admin role and scoped to only this site.
4. **Initial Configuration** — package plan selection (`packageFeatures`
   in `mock-data.ts` — a static plan/feature catalog, not tenant data)
   and status (`Active` / `Trial` / `Suspended`).
5. **Review** — summary of everything captured across the prior steps.
6. **Create** — writes the new `Site` record (`sitesStore`) and the
   accompanying Site Admin `UserAccount`; `onboardingCompletedOn` is
   stamped on the `Site` record.

What gets created: exactly one `Site` record and one `UserAccount` (Site
Admin, role `role-site-admin`, `siteIds: [newSiteId]`). No employees,
attendance, leave, or payroll records are created by this wizard — those
are added afterward by the new Site Admin (§9 onward), consistent with
"fresh install starts empty" (§27).

## 9. Organization Structure

Modeled as a single `OrgUnit` tree per site (`org-data.ts`, `org-context.tsx`),
one `type` per node:

| Unit type | Notes |
|---|---|
| Company | Root of the tree for a site |
| Business Unit | Under Company |
| Division | Under Business Unit |
| Department | Referenced directly by `Employee.departmentId` |
| Sub Department | Under Department |
| Branch | |
| Plant | |
| Location | |
| Cost Center | Referenced by `Employee.costCenterId` and by the `EmployeeSiteMapping` overlay (§10) |
| Profit Center | Referenced by `Employee.profitCenterId`, same overlay |

Each unit carries `siteId`, `parentId` (forming the tree), `status`
(Active/Inactive), an optional `headEmployeeId`, and is audit-logged
(`orgAuditStore`). Grade (`JobGrade`) and Designation are **not** part of
this tree — they are separate Master Data types (§ below) referenced by
`Employee.gradeId` / `Employee.designationId`.

## 10. Employee Master

The full field set actually present on `Employee` and its related types
(`src/lib/types.ts`):

- **Personal**: `firstName`, `lastName`, `profilePhotoUrl`, `gender`
  (Male/Female/Other), `maritalStatus` (Single/Married/Other),
  `dateOfBirth` *(field exists in the type; no current form captures it)*,
  `skills[]`, `education[]` (`degree`, `school`, `years`).
- **Contact**: `email` (work, required), `personalEmail`, `phone`
  (required), `alternatePhone`, `addressLine1`, `city`, `state`,
  `country`, `pincode`.
- **Employment**: `designation`, `designationId`, `dateOfJoining`,
  `employmentTypeId`, `employeeTypeId`, `employmentStage` (Probation /
  Confirmed / On Notice / Exited), `confirmationDate`,
  `probationPeriodMonths`.
- **Organization**: legacy display fields `department`/`location`, plus
  structured FKs `companyId`, `businessUnitId`, `departmentId`,
  `subDepartmentId`, `plantId`, `costCenterId`, `profitCenterId`,
  `locationId`, `gradeId`, `siteId` (required), `siteIds[]`.
- **Statutory**: `pan`, `pfNumber`, `uan`, `esiNumber` — storage only, no
  calculations derive from these fields.
- **Bank**: a separate `EmployeeBankDetail` record (not embedded) —
  account holder, bank name, account number, IFSC, branch, account type
  (Savings/Current) — gated behind the sensitive `payroll.bank` feature.
- **Emergency Contact**: embedded array on `Employee` — name,
  relationship, phone, alternate phone, address.
- **Nominee**: embedded array — name, relationship, date of birth,
  contact, `percentage` (validated to sum to 100 across an employee's
  nominees).
- **Previous Experience**: embedded array — company, designation, start
  date, end date, responsibilities.
- **Documents**: a separate `EmployeeDocumentRecord` per document — type,
  document number, issue/expiry date, `fileRef` (filename/reference
  string only — no real upload storage), status (Pending/Verified/Rejected).
- **Salary**: a separate, **append-only/versioned** `EmployeeSalaryStructure`
  per effective date — CTC, earnings lines, deduction lines, gross
  monthly. Never overwritten; payroll always reads whichever version was
  effective for the month being processed (§14).
- **Manager**: `reportingManagerId` (canonical, FK to another employee's
  `employeeId`, self-referential, cycle-checked) plus a legacy
  `reportingTo` display field.
- **Shift**: `shiftId`, FK to a Master record of type `Shift`.
- **Site**: `siteId` (home/tenant site, required) plus `siteIds[]`
  (additional sites the employee can switch between).

**Relationships**: Employee → Site (many-to-one + optional many-to-many),
Employee → Department/OrgUnit (dual model: legacy text fields alongside
structured FKs into the single `OrgUnit` tree), Employee → Manager
(self-referential, cycle-prevented), Employee → Salary Structure
(one-to-many, versioned), Employee → Shift (many-to-one, via Masters),
Employee → Bank Details / Documents (separate one-to-one/one-to-many
stores, not embedded).

## 11. Employee Lifecycle

Backed by `lifecycle-store.ts` (`lifecycleEventsStore`, append-only,
capped at 1000 most recent events) and written to by three different
modules. Verified implementation status per event type:

| Lifecycle event | Implemented? | Where |
|---|---|---|
| Joining | **Not a logged event** — only a display label derived from `dateOfJoining` in the Employee Profile timeline. | — |
| Probation | Tracked via `employmentStage: "Probation"` + `probationPeriodMonths`; `lifecycle-engine.ts` provides pure date-math helpers (`calculateProbationEndDate`, `isProbationOverdue`, `isProbationDueSoon`). | `lifecycle-engine.ts` |
| Confirmation | Implemented | `employee-lifecycle-context.tsx: confirmEmployee()` |
| Transfer | Implemented — site/department/sub-dept/plant/location/cost-center/profit-center/manager, all in one call; cross-site restricted to Super Admin | `employee-lifecycle-context.tsx: transferEmployee()` |
| Promotion | Implemented — new designation and/or grade | `employee-lifecycle-context.tsx: promoteEmployee()` |
| Manager Change | Implemented two ways: as a sub-event of Transfer, and as a standalone `changeManager()` (same-site, cycle-checked) | `employee-lifecycle-context.tsx` |
| Shift Change | Implemented — future-effective only, does not retroactively touch past attendance | `employee-lifecycle-context.tsx: changeShift()` |
| Salary Revision | Implemented, but logged from the Employee Profile page's Salary tab after `saveSalaryStructure()`, not from the lifecycle context itself | `employees/[id]/page.tsx` |
| Resignation / Notice Period | Implemented as `"Notice Started"` | `offboarding-context.tsx` |
| Exit | Implemented as `"Exit Completed"` | `offboarding-context.tsx` |
| Final Settlement | Implemented as `FullAndFinalSettlement` embedded in the Offboarding case (not its own lifecycle event) | `offboarding-context.tsx` |

Two status fields are deliberately kept separate: `EmployeeStatus`
(`Active`/`Inactive` — binary, drives eligibility elsewhere) and
`EmploymentStage` (`Probation`/`Confirmed`/`On Notice`/`Exited` — the
finer-grained stage HR tracks).

## 12. Attendance

- **My / Team / Site Attendance**: the same `attendance-context.tsx` data,
  scoped differently per page via `useSiteFilter` and reporting-line
  checks.
- **Punch In / Punch Out**: `AttendanceRecord.punchIn`/`punchOut`
  (time-of-day strings); `deriveFields()` computes everything else.
- **Late / Early Leaving**: `lateMinutes = max(0, punchIn − shiftStart − gracePeriod)`;
  `earlyLeavingMinutes = max(0, shiftEnd − punchOut)`.
- **Overtime**: `overtimeHours = max(0, workedHours − standardHours)`
  (standard hours default to 8 if no shift is resolved).
- **Missing Punch**: automatic status when `punchIn` exists but
  `punchOut` doesn't.
- **Regularization**: `AttendanceRegularization` requests (one Pending
  per employee/date), approved/rejected by the direct manager or a
  broad-scope HR/Admin user; self-approval blocked; approval
  creates/updates the underlying Attendance record.
- **Approval**: regularization decisions are mirrored into the shared
  Approval Engine audit trail (passive mirror — the module keeps its own
  authorization logic).
- **Leave → Attendance integration**: approving a Leave request writes
  `"On Leave"` Attendance records directly for every applicable date,
  preserving a `preLeaveSnapshot` so cancellation can revert it (§13).

`AttendanceStatus` values: `Present | Absent | Half Day | Late | On Leave
| Weekend | Holiday | Missing Punch`.

## 13. Leave

- **Leave Types**: a Master Data type (`LeaveType`), with attributes
  `paid`, `requiresApproval`, `requiresDocument`, `maxConsecutiveDays`,
  `minNoticeDays`, `maxDaysPerYear`.
- **Leave Balance**: `available = opening + accrued + carryForward − used − pending`;
  `opening` falls back to the LeaveType's configured `maxDaysPerYear` if
  no balance record exists yet. `accrued`/`carryForward` default to 0 —
  there is no accrual engine that populates them (see §4, Future).
- **Apply**: validates working-day count (excludes weekly-offs and
  holidays), half-day (only for single-date requests), max consecutive
  days, minimum notice, required document, and (for paid types only)
  sufficient balance. `requiresApproval: false` auto-approves instantly.
- **Statuses**: `Pending | Approved | Rejected | Cancelled`.
- **Half Day**: only valid when `from === to` and resolves to exactly one
  working date (`days = 0.5`).
- **Working-day calculation**: counts only the site's configured working
  days minus its holiday calendar.
- **Holidays**: per-site holiday calendar (`SiteConfig.holiday.holidays`).
- **Paid / Unpaid Leave**: `LeaveType.attributes.paid` — paid types are
  balance-checked; unpaid types have no balance ceiling but always count
  as Loss of Pay in payroll.
- **Manager / HR Approval**: `SiteConfig.leave.approvalMode` — one of
  `Manager`, `HR`, or `Manager then HR` (genuine two-step, gated by the
  Approval Engine). Self-approval is always blocked.
- **Approval history**: every request creates an `ApprovalInstance` (even
  auto-approved ones), so Approval History is always populated.
- **Attendance integration**: see §12 — approval writes `"On Leave"`
  records; cancellation of an approved-but-not-started request reverts
  them.
- **Payroll integration**: approved leave is authoritative for LOP —
  a paid leave day is never LOP; an unpaid leave day always is,
  regardless of any Attendance record (§14).

## 14. Payroll

- **Salary Structure**: `EmployeeSalaryStructure` — CTC, earnings lines,
  deduction lines, gross monthly, an `effectiveFrom` date, and a `reason`
  (e.g. "Annual increment", "Promotion").
- **Salary Components**: driven by site-configurable `SalaryComponent`
  Master records (codes `BASIC`, `HRA`, `OALW`, `PF`, `PT`); default
  split if unconfigured: Basic 50% of gross, HRA 40% of Basic, PF 12% of
  Basic, Professional Tax a fixed amount, remainder → Other/Special
  Allowance.
- **Salary Versioning**: strictly **append-only** — every save creates a
  new version; a month's payroll always reads whichever version was
  effective for that month, so re-processing history never changes.
- **Payroll Run**: one per site+month. Status: `Processing → Approved →
  Locked`.
- **Processing**: creates the run plus one payslip per employee who has a
  salary structure.
- **Approval**: `Processing → Approved` only.
- **Lock**: `Approved → Locked` only; locking is also the point at which
  outstanding **Loan EMI** balances are actually decremented.
- **Payslip**: gross earnings + Overtime line − LOP deduction line − Loan
  EMI line − other deductions = net pay.
- **LOP (Loss of Pay)**: a working day with **no Attendance record at
  all** counts as LOP (same as an explicit Absent); Absent/Missing Punch
  = 1 day; Half Day = 0.5 day; an approved paid leave day is never LOP;
  an approved unpaid leave day is always LOP (leave data overrides
  Attendance status for this calculation).
- **Overtime**: `perHourRate × 1.5 × overtimeHours` — an explicitly
  documented convention, not a statutory calculation.
- **Loan EMI**: `EmployeeLoan` — only one Pending loan per employee at a
  time; approving a loan sets it directly to `Active` (not a separate
  "Approved" state); self-approval blocked.
- **Leave integration**: see §13.
- **Historical salary handling**: `salaryHistoryFor()` returns every
  version, oldest-first — the real Salary History shown on the Employee
  Profile.

> **Statutory calculations are NOT currently implemented.** No TDS
> (income-tax slab/regime) calculation exists. No ESI calculation exists.
> PF and Professional Tax exist only as generic, site-configurable
> percentage/fixed deductions — not a compliant PF wage-ceiling
> calculation, no employer/employee split, no admin/EDLI charges.
> `TaxDeclaration` records (Section 80C/80D, regime) are captured but are
> **not read anywhere in the payslip calculation.**

## 15. Recruitment

Fixed, non-configurable workflow (unlike Leave's configurable approval
mode):

```
Requisition (Pending Approval)
  --Approval Engine: Reporting Manager -> HR-->  Approved / Rejected / Cancelled
      |
      v
Job Opening (Draft -> Open -> On Hold -> Closed / Cancelled)
      |  (openings can also be created directly, without a requisition)
      v
Candidate -> Application
      Applied -> Screening -> Interview -> Selected -> Offer -> Offer Accepted -> Hired
      (Rejected / Withdrawn reachable from any non-terminal stage)
      |
      v
Interview (Scheduled -> Completed / Cancelled) + Feedback
      |
      v
Offer (Draft -> Sent -> Accepted / Rejected / Expired / Withdrawn)
      |
      v
Offer Acceptance --> creates a real Onboarding case (useOnboarding().createCase)
      |
      v
Onboarding completion --> creates the real Employee record, flips
                           Application to "Hired"
```

Every stage in this checklist exists and is implemented as described;
"Selection" is not a separate record — it is the `Selected` application
stage.

## 16. Onboarding

- **Onboarding case**: status `Pre-boarding → In Progress → Completed /
  Cancelled` (moves to In Progress automatically on the first task
  update).
- **Tasks**: seeded from templates; each has a `category` (Employee or
  Manager/Buddy — gates who can act on it) and a `mandatory` flag.
- **Documents**: seeded from templates; flow is Upload → Verify (HR) →
  Send for Signature → Signed. A relieving-letter-type document is
  excluded from the "mandatory" gate (it may not exist for a first
  job).
- **Buddy**: `buddyId` is a plain field set at case creation; a buddy can
  act on Manager-category tasks and documents.
- **Employee creation**: `completeOnboarding()` — gated on all mandatory
  tasks done and all mandatory documents cleared — creates the real
  Employee record (`employmentStage: "Probation"`).
- **Salary structure integration**: if the case carries offer
  CTC/earnings/deductions (from the Recruitment offer), `completeOnboarding`
  also saves the employee's first `EmployeeSalaryStructure`.

## 17. Performance

```
Cycle: Draft -> Open -> Self Review -> Manager Review -> [HR Review] -> Completed -> Closed
                                                          (skipped if cycle.requiresHRReview === false)

Review Case: Draft -> Goals Assigned -> Self Review -> Manager Review -> [HR Review] -> Completed
             (capped by the cycle's own status — a case can lag but never run ahead)
```

- **Goals**: `weight` (must sum to exactly 100 before self-review can be
  submitted), KPI, target, measurement, employee-set `achievement`
  (0–100), `managerRating` (1–5).
- **Weighted Score**: `Σ(weight/100 × managerRating)` per goal — never
  renormalized.
- **Self Review / Manager Review / HR Review**: sequential; HR Review is
  skippable per-cycle.
- **Rating**: `managerRating` per goal (1–5); a case's `finalScore` is
  computed on manager-review submission.
- **Appraisal**: `Draft → Pending Approval → Approved/Rejected → Applied`;
  requires the review case to be `Completed`; `proposedCtcAnnual`
  computed from an increment percentage.
- **Salary Revision / Promotion**: `applyAppraisal()` is the only place
  Performance touches Payroll/Lifecycle — it saves a new (append-only)
  salary structure version when CTC changed, and calls
  `promoteEmployee()` (Lifecycle) when marked as a promotion.

Self-approval is blocked throughout (an employee cannot review/rate
themself).

## 18. Training

- **Training Program**: status `Draft → Published → In Progress →
  Completed`, `Cancelled` reachable from any non-terminal state. Creating
  a program auto-creates one default session.
- **Training Category**: a Master Data type referenced by `categoryId` —
  no separate category engine.
- **Training Request**: employee-initiated, mirrored as a Reporting
  Manager approval step in the Approval Engine.
- **Approval**: `decideTrainingRequest()` — self-approval blocked;
  approval creates the enrollment automatically.
- **Enrollment**: `Registered → Approved → In Progress → Completed /
  Failed / No Show`, `Cancelled` reachable from any non-terminal state.
- **Capacity**: `isProgramFull()` checks active enrollment count against
  `program.capacity`, enforced on both direct enrollment and
  request-approval paths.
- **Sessions**: date/time/trainer/location per program; attendance is
  recorded per session per enrollment.
- **Assessment**: trainer/manager-only (never self) — score, result,
  feedback.
- **Completion**: sets `Completed` + completion date + certificate
  reference; blocked for self-completion.
- **Skill Update Proposal**: created automatically on completion **only
  if** the program has a `relatedSkillId` **and** the result was
  `Passed` — always a `Pending` proposal, never a silent overwrite.
- **Employee Skills**: a separate, manually-approved decision
  (`decideSkillUpdateProposal`, self-decision blocked) writes a new,
  **append-only** `EmployeeSkill` record.
- **Skill History**: full ordered history per employee; "current" skill
  is always the latest by creation timestamp.
- Also present (not in a typical checklist but implemented):
  `TrainingRequirement` (scoped to Employee/Department/Designation/Grade/
  Skill) plus gap analysis (`trainingNeedsFor`).

## 19. Asset Management

- **Asset Master / Type**: `AssetType` Master Data type; asset status:
  `Available | Assigned | Under Maintenance | Damaged | Retired |
  Disposed | Lost`.
- **Inventory**: `asset-context.tsx` (`assetsStore`).
- **Assignment**: `assignAsset()` — sets status `Assigned` + condition.
- **Return**: `nextStatusAfterReturn()` — back to `Available`, unless the
  returned condition is `Damaged`, in which case the asset stays
  `Damaged` (never silently marked available).
- **Maintenance**: `Reported → In Progress → Completed`; blocked for
  already-Retired/Disposed assets.
- **Retirement**: `→ Retired` (blocked if already Disposed).
- **Disposal**: requires the asset already be `Retired`; creates an
  `AssetDisposal` record with a reason.
- **Asset Request**: `Pending → Approved/Rejected → Assigned` (links a
  specific asset on fulfillment).
- **Offboarding integration**: the offboarding case surfaces pending
  asset returns as a clearance blocker. Note: `asset-engine.ts` defines
  `isAssetClearanceComplete()`, but `offboarding-context.tsx` computes
  this inline rather than calling it — a minor duplication, not a
  missing feature (the clearance check itself works correctly).

## 20. Expenses

- **Travel Request**: `Pending | Approved | Rejected | Cancelled |
  Completed`; includes travel-advance fields.
- **Expense Claim**: `Draft → Submitted → Manager Approved → Finance
  Approved → Reimbursed`, with `Rejected`/`Cancelled` off-ramps —
  genuine two-step approval.
- **Expense Lines**: `ExpenseItem[]`; the claim total is always derived
  from line items, never entered directly.
- **Receipts/References**: `receiptReference` per line item, required
  when the expense category is configured as `requiresReceipt`.
- **Manager Approval**: `managerDecideClaim()`.
- **Finance Approval**: `financeDecideClaim()` — requires the claim
  already be `Manager Approved`; self-approval blocked.
- **Reimbursement / Settlement**: `markReimbursed()` requires `Finance
  Approved`; `getTravelSettlement()` derives estimated vs. claimed vs.
  approved vs. reimbursed live from linked claims (never a stored,
  independently-editable figure).
- **Reports**: see §21.

## 21. Reports & Analytics

Report tabs (`src/app/(app)/reports/page.tsx`, backed by
`report-selectors.ts`): **Overview, Attendance, Leave, Payroll**
(gated by payroll permission), **Approvals** (gated), **Workforce,
Performance, Training, Assets, Expenses, Recruitment**. Employee
self-service sees a reduced set: **My Attendance, My Leave, My Payroll.**

Common filters across most tabs: site (or "All Sites"), a date range
(defaulting to first-of-month → today), and dimension filters —
department, sub-department, designation, grade, employment type,
employee type, location, plant, status, employee.

Selector families in `report-selectors.ts`: Workforce/Headcount,
Attendance (incl. absenteeism, late-coming, overtime), Leave (incl.
utilization), Payroll (incl. LOP trend), Approvals (incl. SLA by
module), Lifecycle/Site (joiners, exits, site comparison), Recruitment
(funnel, source-wise hiring, conversion), Performance (rating
distribution, promotion/salary-revision recommendations), Training
(completion, skill distribution), Assets, Expenses.

## 22. Dashboard

Four role-specific variants, selected in `src/app/(app)/dashboard/page.tsx`:

| Variant | Who sees it | What it shows |
|---|---|---|
| Global Super Admin Dashboard | Super Admin | Cross-site totals, per-site drill-in |
| Site Dashboard | Site Admin / HR Admin (broad in-site scope) | Site headcount, department distribution, attendance trend, leave summary, probation/exit summaries, recent activity |
| Team Dashboard | Manager / anyone with direct reports | Same shape, scoped to direct + indirect reports |
| Employee Dashboard | Self-service employee | Own attendance/leave/team-events view |

If the Super Admin has zero sites, an **Empty Platform State** is shown
instead — "Create Your First Site" and (dev/demo builds only) "Load Demo
Data" (see §27, §32).

## 23. Approval Workflow

A single, reusable Approval Engine (`approval-engine.ts` /
`approval-context.tsx`) underlies Leave, Regularization, Loans, Payroll,
Recruitment Requisitions, and mirrors decisions from Performance,
Training, and Expenses.

- **Approver types**: `REPORTING_MANAGER | DEPARTMENT_HEAD | HR |
  SITE_ADMIN | PAYROLL_ADMIN | SPECIFIC_USER`.
- **Multi-step**: an ordered `WorkflowStep[]` chain; e.g. Leave's
  `"Manager then HR"` mode is Reporting Manager (order 0) then HR
  (order 1) — a genuinely gating two-step approval. Recruitment
  Requisitions are always Reporting Manager → HR.
- **Self-approval prevention**: checked **first, unconditionally**, in
  `isAuthorizedApprover()` — `if (subjectEmployeeId === currentUserEmployeeId) return false`
  — before any role/permission logic runs, so no permission combination
  can bypass it. Independently re-checked inside each consuming module
  (Leave, Regularization, Loans, Training, Performance, Expenses) as
  defense in depth.
- **Approval history**: every `ApprovalInstance` carries an append-only
  `actions[]` log (`APPLY | APPROVE | REJECT | CANCEL`, each with actor,
  timestamp, previous/new status, optional comment) — never mutated,
  only appended to.
- Two operating modes: **active gate** (the engine itself controls
  whether the record can advance — Leave's multi-step mode, Requisitions)
  vs. **passive mirror** (the owning module keeps its own authorization
  logic and pushes a record into the shared audit trail afterward —
  Regularization, Loans, Payroll, single-step Leave).

## 24. Notifications

`notification-context.tsx` — **in-app only**. `AppNotification` records
carry `employeeId`, `type`, `title`, `message`, `module`, an optional
deep link, and a `read` flag. `myNotifications` is always scoped to the
current user. Triggered ad hoc from feature contexts (confirmed:
Training request decisions, Expense manager/finance decisions).

**No email/SMS/push provider is wired.** An `EmailSettings` shape exists
in the Settings module (SMTP host/port/username/password fields), but it
is configuration-only plumbing — nothing in the codebase sends an email.
This is a deliberate "foundation only" scope documented directly in
`types.ts`.

## 25. Search

The Topbar's global search box (`src/components/layout/global-search.tsx`)
is a real, scoped implementation (not decorative — see the Phase 17 fix
noted in `docs/architecture-audit.md`). It searches across the modules
the current user has visibility into, respecting the same site/RBAC
scoping as the rest of the app.

## 26. RBAC & Security

- **Authentication**: `src/lib/auth.ts` — email/password against
  `accountsStore`. Lockout after `MAX_FAILED_ATTEMPTS` (5) for
  `LOCKOUT_MINUTES` (15). Every attempt (success/failure/lockout) is
  logged to `securityEventsStore`.
- **Password handling**: `hashPassword()` in `rbac-data.ts` is
  **base64 encoding with a `mock$` prefix — explicitly not a
  cryptographic hash.** The source comment states this directly: there
  is no backend, so this obfuscates rather than hashes; a real
  deployment must verify credentials and issue sessions server-side.
- **Session**: a client-only base64-encoded cookie (`src/lib/auth.ts`) —
  **not a JWT, not server-verified.** Session expiry is checked both at
  the Next.js proxy/middleware layer (optimistic, cookie-only) and
  client-side (a 30-second poll, defense in depth for a tab left open
  past expiry).
- **Permissions**: feature-action grants (§5, §26 detail in
  `docs/BRD-Complete.md`), resolved via `canFeature`/`canModule` in
  `access-control-context.tsx`.
- **Roles**: 12 system roles (§5); always-present configuration.
- **Site isolation**: `siteIds` on the account + `useSiteFilter()` at
  every list page (§7).
- **Direct URL protection**: `route-permissions.ts` maps every route
  prefix to a module; a page-level guard blocks navigation to a module
  the account has no view access to. Per-record routes (e.g.
  `/employees/[id]`, `/onboarding/[id]`) additionally re-check the
  record's own `siteId` against the account's mapped sites.
- **Self-approval protection**: see §23.
- **Data-layer authorization**: mutation functions (e.g.
  `createAccount`, `setAccountRoles`, `updateRole`,
  `setRoleFeatureActions`) independently re-validate the caller's
  permission and site scope — not just the UI button being hidden. This
  is a documented, deliberate "defense in depth" convention applied from
  Phase 12 onward (see `docs/architecture-audit.md`).

## 27. Data Ownership

Each domain has exactly one `localStorage`-backed store as its source of
truth (full store → future-table mapping is in
`docs/production-readiness.md`):

| Domain | Store(s) |
|---|---|
| Accounts / Roles / Sessions / Security | `rbac-store.ts` |
| Sites | `site-context.tsx` (`sitesStore`) |
| Organization | `org-store.ts` |
| Masters | `master-store.ts` |
| Employees (+ Bank, Documents) | `employee-store.ts` |
| Employee Lifecycle | `lifecycle-store.ts` |
| Attendance / Regularization | `attendance-store.ts`, `regularization-store.ts` |
| Leave | `leave-store.ts` |
| Payroll | `payroll-store.ts` |
| Recruitment | `recruitment-store.ts` |
| Onboarding / Offboarding | `onboarding-store.ts`, `offboarding-store.ts` |
| Performance | `performance-store.ts` |
| Training / Skills | `training-store.ts`, `skill-store.ts` |
| Assets | `asset-store.ts` |
| Expenses | `expense-store.ts` |
| Approval instances | `approval-store.ts` |
| Notifications | `notification-store.ts` |
| Events | `event-store.ts` |
| Settings | `settings-store.ts`, `site-config-store.ts` |

`mock-data.ts` is **not** a data-ownership source for any of the above in
production use — it is raw seed material consumed only by the opt-in
"Load Demo Data" path (§32). As part of this phase's cleanup, several
Organization-module screens and the Masters "Designation → Department"
field were found reading directly from `mock-data.ts` instead of these
real stores; this has been corrected (see `docs/production-readiness.md`
§ this-phase addendum).

## 28. Business Rules

Extracted directly from source (see §12–§20 for full detail); highlights:

- No self-approval, anywhere, ever — enforced at the shared Approval
  Engine level and independently inside every consuming module.
- Salary structures and employee skills are append-only/versioned —
  never overwritten, so historical payroll/skill-history stays accurate
  even after a later change.
- A working day with no attendance record is treated as Loss of Pay,
  identical to an explicit Absent — there is no "benefit of the doubt."
  Approved leave (paid or unpaid) always overrides this.
- Only one Pending loan request, and one Pending attendance
  regularization request, per employee at a time.
- Reporting-manager assignment is cycle-checked (`wouldCreateReportingCycle`)
  before it's allowed to save.
- Cross-site employee transfer is Super-Admin-only.
- A payroll run can only move forward (`Processing → Approved → Locked`),
  never backward; locking is irreversible and is the trigger for actual
  loan-balance decrementing.

## 29. Integrations

### Current

None. The application has no outbound integration to any third-party
system. (`EmailSettings` in Settings is configuration-only, unused —
see §24.)

### Future

Per `docs/production-readiness.md`: a NestJS REST API, Prisma ORM, and a
MySQL database (§31) — the only concretely planned architectural change.
No specific third-party vendor (payroll processor, biometric device,
job board, background-check, calendar/email provider) is currently
scoped or scheduled.

## 30. Non-Functional Requirements

**Current architecture reality** (not yet production-grade — see
`docs/production-readiness.md` for the full assessment):

- **Security**: RBAC, site isolation, and self-approval checks all run
  client-side in the browser bundle — not a security boundary a real
  deployment can rely on. Session is not server-verified; passwords are
  not cryptographically hashed.
- **Performance**: all data lives in a single browser's `localStorage`
  (5–10MB typical browser quota); no pagination at the storage layer
  (list pages paginate client-side over an already-fetched-in-full
  array).
- **Scalability**: none today — `localStorage` is per-browser,
  per-device; there is no shared backend, so two devices for the same
  account do not see the same data.
- **Auditability**: strong at the application layer — most domains have
  either a dedicated append-only audit store (Organization, Masters,
  Assets, Expenses, Offboarding, Onboarding, Recruitment, Leave) or rely
  on the shared Approval Engine's action history plus the domain's own
  status-transition fields (Attendance, Payroll, Training, Performance,
  Recruitment where no dedicated audit store exists — a documented,
  deliberate inconsistency, not an oversight).
- **Multi-tenancy / Data isolation**: enforced by convention (`siteId` on
  every record + `useSiteFilter`), not by an actual multi-tenant
  database or row-level security — see §7.
- **Maintainability**: every module from Phase 12 onward follows one
  layered pattern (types → master-data → rbac-data → engine → store →
  context → page), documented in `docs/architecture-audit.md`.

**Future-state / assumed requirements** (not yet implemented — see §31):
server-side authorization enforcement, encrypted credential storage,
horizontal scalability via a real database, and formal SLAs — none of
these exist today and should not be assumed present.

## 31. Future Backend Architecture (Target, NOT Current)

```
Next.js frontend  (current: also the entire "backend," via localStorage)
      |
      v
NestJS REST API        <-- NOT IMPLEMENTED
      |
      v
Prisma ORM              <-- NOT IMPLEMENTED
      |
      v
MySQL database           <-- NOT IMPLEMENTED
```

This is explicitly the **target architecture**, not a description of
anything that exists today. `docs/production-readiness.md` documents the
full store → future-table mapping, the API boundary implied by each
context's existing action functions (already shaped like RPC calls —
input object in, `{ ok, message }` out), and the specific multi-store
operations that must become real database transactions (Recruitment →
Onboarding → Employee → Salary Structure; Payroll Run → Payslips → Lock;
Leave Approval → Attendance → Balance; Expense Approval →
Reimbursement; Asset Return → Offboarding Clearance; Lifecycle events
that patch the Employee record in the same call).

## 32. Out of Scope

Explicitly deferred by prior phases (per `docs/production-readiness.md`
§6): a real database (PostgreSQL/MongoDB/MySQL), a NestJS/any API
server, Redis, Docker, an email/SMS provider, AI features, and any
external integration. This phase (18B) adds no backend work either — it
is documentation plus frontend data-source correctness (§32 continued
below, §Part-E–L of the phase instructions) only.

**"Load Demo Data"** remains as an explicit developer/demo utility,
gated behind `isDemoDataEnabled` (`process.env.NODE_ENV !== "production"`
in `demo-seed.ts`) — Next.js inlines `NODE_ENV` at build time, so this
evaluates to a hard `false` in a production build and the affordance
never renders for a real user. It is never invoked automatically and
never affects a fresh production install (see §27, `docs/production-readiness.md`).

## 33. Risks / Limitations

Documented honestly, not minimized:

1. **No real backend** — the entire application is a client-side
   prototype today; every "authorization check" can, in principle, be
   bypassed by a user with browser devtools access. Acceptable for a
   demo/pre-sales tool; not acceptable for a production HR system
   handling real PII/payroll data.
2. **No statutory payroll compliance** — TDS/ESI are entirely absent, and
   PF/PT are generic configurable deductions, not compliant
   calculations. A client relying on this for real payroll processing
   would be non-compliant.
3. **Passwords are not cryptographically hashed** — see §26.
4. **No leave accrual engine** — balances must currently be seeded/set
   directly; nothing periodically credits accrual.
5. **No real document storage** — uploaded "documents" are filename
   references only, not stored files.
6. **No automated test suite** — regressions are currently caught only
   by `tsc --noEmit`, `next build`, and manual verification; there is no
   `npm test` script or CI test job in this repository today.
7. **Per-browser data** — `localStorage` means data does not follow a
   user across devices/browsers, and clearing browser storage destroys
   all tenant data with no backup.
8. **Minor engine/module duplication** — e.g. `asset-engine.ts`'s
   `isAssetClearanceComplete()` exists but isn't called by
   `offboarding-context.tsx`, which recomputes the same check inline
   (feature works correctly either way; a cleanup opportunity, not a
   defect).

## 34. Future Roadmap

Suggested logical next phases (none implemented, none scheduled — for
planning discussion only):

1. **Backend migration**: implement the NestJS/Prisma/MySQL stack
   described in §31, porting each context's action functions 1:1 to REST
   endpoints with identical input/output contracts.
2. **Real authentication**: server-issued sessions, bcrypt/argon2
   password hashing, MFA, httpOnly+secure cookies, CSRF protection.
3. **Statutory payroll compliance**: TDS slab/regime calculation wired to
   the already-captured `TaxDeclaration` records; compliant PF
   wage-ceiling and ESI calculations.
4. **Leave accrual engine**: periodic (monthly/annual) balance accrual
   and carry-forward computation.
5. **Notification delivery**: wire the existing `EmailSettings`
   configuration to an actual email provider; add SMS/push as needed.
6. **Real document storage**: object storage (e.g. S3-compatible) behind
   the existing `fileRef` field.
7. **Automated testing**: unit tests for the engine layer (pure
   functions — highest ROI, easiest to test), integration tests for
   context actions, and end-to-end tests for the critical flows (login,
   site onboarding, leave apply→approve, payroll run→lock).

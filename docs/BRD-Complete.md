# Business Requirements Document — Complete Reference Edition

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | Business Requirements Document — Complete Reference Edition |
| Product Name | Summet HRMS |
| Version | 1.0 (Phase 18B) |
| Date | 2026-08-17 |
| Status | Draft — reflects the currently implemented frontend only |
| Prepared For | Summet HRMS stakeholders / client onboarding |
| Prepared By | Engineering (derived from a full read-only audit of `summeet_hrms_fe`) |

This is the **companion reference edition** to [`docs/BRD.md`](./BRD.md).
Read `BRD.md` first for the narrative (executive summary, objectives,
scope, per-module business rules, architecture). This document does not
repeat that narrative — it exists to hold the **exhaustive, row-by-row
detail** that would make `BRD.md` unreadable if inlined: the complete
RBAC grant matrix, the complete status/enum glossary, the complete
Master Data catalog, and the complete report/selector catalog. Every
table below is sourced directly from code, cited by file.

Sections 2–34 below map 1:1 to `BRD.md`'s section numbers; a section is
only expanded here if it has appendix-level detail worth adding. Sections
with nothing to add beyond `BRD.md` simply point back to it.

## 2–4. Executive Summary, Objectives, Scope

No appendix content beyond `BRD.md` §2–§4.

## 5. User Roles — Full RBAC Grant Matrix

All 12 roles are defined in `src/lib/rbac-data.ts` (`seedRoles`), always
present as system configuration (`isSystem: true`), independent of
whether any tenant data exists (see §27, §32). The grant model:
`grant(...featureIds)` = `"manage"` (which implies every other action the
feature supports); `grantActions({...})` = an explicit action list per
feature. Action codes used below: **V**=view, **C**=create, **E**=edit,
**D**=delete, **A**=approve, **R**=reject, **X**=export, **I**=import,
**M**=manage (implies all other actions on that feature). A blank cell
means no grant.

Super Admin is omitted from the per-feature columns below — it is
`grant(...ALL_FEATURE_IDS)` (full `manage` on every feature listed) and,
independently, `canFeature`/`canModule` hard-bypass to `true` whenever
`isSuperAdmin` is true (`access-control-context.tsx`), so the map is
moot for that role in practice.

Legend for the role-column headers: **SA**=Site Admin, **HA**=HR Admin,
**HM**=HR Manager, **PA**=Payroll Admin, **FI**=Finance,
**DH**=Department Head, **MG**=Manager, **RC**=Recruiter,
**HG**=Hiring Manager, **EM**=Employee, **AU**=Auditor.

### Dashboard

| Feature | SA | HA | HM | PA | FI | DH | MG | RC | HG | EM | AU |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `dashboard.overview` | V | V | V | V | V | V | V | V | V | V | V |

### Access Control

| Feature | SA | HA | HM | PA | FI | DH | MG | RC | HG | EM | AU |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `access-control.users` | M | M | | | | | | | | | |
| `access-control.roles` | | V | | | | | | | | | |
| `access-control.permissions` | | V | | | | | | | | | |
| `access-control.security` | V | V | | | | | | | | | |
| `access-control.menu` | V | V,E | | | | | | | | | |

### Sites

`sites.tenants` (or equivalent Tenant Sites feature) — granted only to
Super Admin (via the blanket `ALL_FEATURE_IDS` grant); no other role in
`seedRolePermissions` references it, consistent with Site
creation/administration being platform-only (§6 of `BRD.md`).

### Employees

| Feature | SA | HA | HM | PA | FI | DH | MG | RC | HG | EM | AU |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `employees.directory` | M | M | V,C,E,X | V | | V | V | V | V | V | V |
| `employees.documents` | M | M | V,E | | | | | | | | |
| `employees.lifecycle` *(sensitive)* | M | M | V,C,E | | | V | V | | | | V |
| `employees.skills` | M | M | V,C,E | | | V,E | V,E | | | V | V |

### Onboarding / Offboarding

| Feature | SA | HA | HM | PA | FI | DH | MG | RC | HG | EM | AU |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `onboarding.cases` | M | M | V,C,E | | | V,E | V,E | V,C | V | V | V |
| `offboarding.cases` *(sensitive)* | M | M | V,C,E | V,E,M | V | V | V | | | V,C | V |

### Organization

| Feature | SA | HA | HM | PA | FI | DH | MG | RC | HG | EM | AU |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `organization.structure` | M | M | V,E | | | V | | V | | V | |
| `organization.site-mapping` | M | V,E | | | | | | | | | V |

### Masters

| Feature | SA | HA | HM | PA | FI | DH | MG | RC | HG | EM | AU |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `masters.records` | M | M | V,E | V,E | | | | | | | V |

### Attendance / Leave

| Feature | SA | HA | HM | PA | FI | DH | MG | RC | HG | EM | AU |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `attendance.records` | M | M | V,E,A,R,X | | V | V,E,A,R | V,A,R | | | V,C | V |
| `leave.requests` | M | V,E,A,R | V,E,A,R | | V | V,A,R | V,A,R | | | V,C | V |

### Payroll *(all five sub-features are `sensitive` except Payslips is also marked sensitive)*

| Feature | SA | HA | HM | PA | FI | DH | MG | RC | HG | EM | AU |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `payroll.payslips` *(sensitive)* | M | V,X | V | V,X,M | V,X | | | | | | V |
| `payroll.salary` *(sensitive)* | M | | | V,E,M | V | | | | | | |
| `payroll.bank` *(sensitive)* | M | | | V,E,M | | | | | | | |
| `payroll.loans` *(sensitive)* | M | V,A,R | | V,A,R,M | V | | | | | V,C | V |
| `payroll.tax` *(sensitive)* | M | V,E | | V,E,M | V | | | | | V,C,E | V |

### Recruitment

| Feature | SA | HA | HM | PA | FI | DH | MG | RC | HG | EM | AU |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `recruitment.requisitions` | M | M | V,C,E,A,R | | | V,C,A | V,C,A | V,C | V,C,A | | V |
| `recruitment.openings` | M | M | V,C,E | | | | | V,C,E,M | | | V |
| `recruitment.pipeline` | M | M | V,C,E | | | V | V | V,C,E,M | V | | V |

### Performance *(Appraisal is `sensitive`)*

| Feature | SA | HA | HM | PA | FI | DH | MG | RC | HG | EM | AU |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `performance.cycles` | M | M | V,C,E | | | V | V | | | | V |
| `performance.reviews` | M | M | V,C,E,A | | | V,C,E,A | V,E | | | V,C,E | V |
| `performance.appraisal` *(sensitive)* | M | M | V,C | | | | | | | | V |

### Training

| Feature | SA | HA | HM | PA | FI | DH | MG | RC | HG | EM | AU |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `training.programs` | M | M | V,C,E | | | V | V | | | V | V |
| `training.requests` | M | M | V,C,E,A,R | | | V,A,R | V,A,R | | | V,C | V |

### Assets

| Feature | SA | HA | HM | PA | FI | DH | MG | RC | HG | EM | AU |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `assets.inventory` | M | M | V,C,E | | | V | V | | | V | V |
| `assets.requests` | M | M | V,A,R | | | V,A,R | V,A,R | | | V,C | V |

### Expenses

| Feature | SA | HA | HM | PA | FI | DH | MG | RC | HG | EM | AU |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `expenses.claims` | M | V,C,A,R | V,C,A,R | | V,C,A,R,M | V,C,A,R | V,C,A,R | V,C | V,C | V,C | V |
| `expenses.travel` | M | V,C,A,R | V,C,A,R | | V,C,A | V,C,A,R | V,C,A,R | V,C | V,C | V,C | V |

### Reports / Settings / Events

| Feature | SA | HA | HM | PA | FI | DH | MG | RC | HG | EM | AU |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `reports.analytics` | V,X | V,X | V,X | V,X | V,X | V | V | V | V | V | V,X |
| `settings.organization` | | V,E | | | | | | | | | |
| `events.calendar` | M | V,C,E,D | V,C,E | | | V | V | V | V | V | V |

*Source: `src/lib/rbac-data.ts` lines 126–394 (`seedRolePermissions`),
read in full. Every cell above is a direct transcription, not an
inference.*

## 6–9. Super Admin, Multi-Site Architecture, Site Onboarding, Organization Structure

No appendix content beyond `BRD.md` §6–§9.

## 10. Employee Master — Full Field Reference

| Category | Field | Type / Notes |
|---|---|---|
| Core | `id`, `employeeId`, `name` | string, required |
| Core | `status` | `EmployeeStatus`: `Active \| Inactive` |
| Core | `isAdminAccount` | optional bool — flags records that only back an admin login (not real headcount) |
| Personal | `firstName`, `lastName` | optional string |
| Personal | `profilePhotoUrl` | optional string |
| Personal | `gender` | `Male \| Female \| Other` |
| Personal | `maritalStatus` | `Single \| Married \| Other` |
| Personal | `dateOfBirth` | optional — **no current form captures this** |
| Personal | `skills[]` | string array (legacy; see also the versioned `EmployeeSkill` store in Training/Skills) |
| Personal | `education[]` | `{ degree, school, years }` |
| Contact | `email` | required, work email |
| Contact | `personalEmail`, `phone` (required), `alternatePhone` | optional/required as noted |
| Contact | `addressLine1`, `city`, `state`, `country`, `pincode` | optional string |
| Employment | `designation`, `designationId` | legacy text + FK |
| Employment | `dateOfJoining` | required |
| Employment | `employmentTypeId`, `employeeTypeId` | FK into Masters |
| Employment | `employmentStage` | `Probation \| Confirmed \| On Notice \| Exited` |
| Employment | `confirmationDate`, `probationPeriodMonths` | optional |
| Organization | `department`, `location` | legacy display fields |
| Organization | `companyId`, `businessUnitId`, `departmentId`, `subDepartmentId`, `plantId`, `costCenterId`, `profitCenterId`, `locationId` | FK into `OrgUnit` tree |
| Organization | `gradeId` | FK into `JobGrade` master |
| Organization | `siteId` (required), `siteIds[]` | home site + additional accessible sites |
| Statutory | `pan`, `pfNumber`, `uan`, `esiNumber` | storage only, no calculations |
| Bank *(separate `EmployeeBankDetail`)* | `id`, `employeeId`, `siteId`, `accountHolderName`, `bankName`, `accountNumber`, `ifsc`, `branch`, `accountType` (`Savings \| Current`), `updatedOn`, `updatedBy` | one record per employee, gated by `payroll.bank` |
| Emergency Contact *(embedded array)* | `id`, `name`, `relationship`, `phone`, `alternatePhone`, `address` | |
| Nominee *(embedded array)* | `id`, `name`, `relationship`, `dateOfBirth`, `contact`, `percentage` | percentages must sum to 100 |
| Previous Experience *(embedded array)* | `id`, `company`, `designation`, `startDate`, `endDate`, `responsibilities` | |
| Documents *(separate `EmployeeDocumentRecord`)* | `id`, `employeeId`, `siteId`, `documentType`, `documentNumber`, `issueDate`, `expiryDate`, `fileRef`, `status` (`Pending \| Verified \| Rejected`), `uploadedOn`, `verifiedBy`, `verifiedOn` | `fileRef` is a filename/reference string only — no real file storage |
| Salary *(separate, append-only `EmployeeSalaryStructure`)* | `id`, `employeeId`, `siteId`, `effectiveFrom`, `ctcAnnual`, `earnings[]`, `deductions[]`, `grossMonthly`, `updatedOn`, `updatedBy`, `reason` | never mutated — always a new version |
| Manager | `reportingTo` (legacy), `reportingManagerId` (canonical FK, self-referential) | cycle-checked via `wouldCreateReportingCycle` |
| Shift | `shiftId` | FK to a `MasterRecord` of type `Shift` |

## 11. Employee Lifecycle — Event Type Reference

See `BRD.md` §11 for the full implementation-status table. Additional
detail: `EmployeeStatus` (`Active|Inactive`) and `EmploymentStage`
(`Probation|Confirmed|On Notice|Exited`) are deliberately independent
fields — changing one does not change the other. Offboarding's
`SeparationType` (`Resignation|Termination|Retirement|Absconding`) is a
*reason* captured on the `SeparationCase`, not a `LifecycleEventType`
value in its own right; only the two summary events `"Notice Started"`
and `"Exit Completed"` are actually written to the lifecycle event log
for any separation, regardless of `SeparationType`. `SeparationStatus`:
`Pending Approval | Approved | Clearance In Progress | Settlement
Pending | Completed | Rejected | Withdrawn`. `SettlementStatus`
(Full & Final Settlement, embedded in the case): `Pending | Processing |
Paid`.

## 12–20. Module Status/Enum Glossary

Exact enum values, consolidated by module (all confirmed directly
against source):

| Module | Field | Values |
|---|---|---|
| Attendance | `AttendanceStatus` | `Present \| Absent \| Half Day \| Late \| On Leave \| Weekend \| Holiday \| Missing Punch` |
| Regularization | `RegularizationStatus` | `Pending \| Approved \| Rejected` *(no `Cancelled` — withdrawal is a hard delete)* |
| Leave | `LeaveStatus` | `Pending \| Approved \| Rejected \| Cancelled` |
| Leave | `SiteLeaveConfig.approvalMode` | `Manager \| HR \| Manager then HR` |
| Payroll | `PayrollRunStatus` | `Processing \| Approved \| Locked` |
| Payroll | `LoanStatus` | `Pending \| Approved \| Rejected \| Active \| Closed` *(approval sets it directly to `Active`, not a separate "Approved" resting state)* |
| Payroll | `TaxDeclaration` status | `Draft \| Submitted \| Verified \| Rejected` *(captured, not applied to payslip calc)* |
| Recruitment | Requisition status | `Pending Approval \| Approved \| Rejected \| Cancelled` |
| Recruitment | `JobOpeningStatus` | `Draft \| Open \| On Hold \| Closed \| Cancelled` |
| Recruitment | `ApplicationStage` | `Applied \| Screening \| Interview \| Selected \| Offer \| Offer Accepted \| Hired` (+ `Rejected \| Withdrawn` from any non-terminal stage) |
| Recruitment | Interview status | `Scheduled \| Completed \| Cancelled` |
| Recruitment | Offer status | `Draft \| Sent \| Accepted \| Rejected \| Expired \| Withdrawn` |
| Onboarding | Case status | `Pre-boarding \| In Progress \| Completed \| Cancelled` |
| Onboarding | `OnboardingTaskStatus` | `Pending \| In Progress \| Completed \| Not Applicable` |
| Onboarding | `DocumentStatus` | `Pending \| Uploaded \| Verified \| Rejected` |
| Onboarding | `signatureStatus` | `Not Required \| Not Sent \| Sent \| Viewed \| Signed \| Declined` |
| Performance | `PerformanceCycleStatus` | `Draft \| Open \| Self Review \| Manager Review \| HR Review \| Completed \| Closed` |
| Performance | `PerformanceReviewStage` | `Draft \| Goals Assigned \| Self Review \| Manager Review \| HR Review \| Completed` |
| Performance | `AppraisalStatus` | `Draft \| Pending Approval \| Approved \| Rejected \| Applied` |
| Training | `TrainingProgramStatus` | `Draft \| Published \| In Progress \| Completed \| Cancelled` |
| Training | `TrainingEnrollmentStatus` | `Registered \| Approved \| In Progress \| Completed \| Failed \| No Show \| Cancelled` |
| Assets | `AssetStatus` | `Available \| Assigned \| Under Maintenance \| Damaged \| Retired \| Disposed \| Lost` |
| Assets | Maintenance status | `Reported \| In Progress \| Completed` |
| Assets | `AssetRequest` status | `Pending \| Approved \| Rejected \| Assigned` |
| Expenses | `TravelRequestStatus` | `Pending \| Approved \| Rejected \| Cancelled \| Completed` |
| Expenses | `ExpenseClaimStatus` | `Draft \| Submitted \| Manager Approved \| Finance Approved \| Reimbursed` (+ `Rejected \| Cancelled`) |
| Approval Engine | `ApprovalInstanceStatus` | `Pending \| Approved \| Rejected \| Cancelled` |
| Approval Engine | `ApprovalActionType` | `APPLY \| APPROVE \| REJECT \| CANCEL` |
| Approval Engine | `ApproverType` | `REPORTING_MANAGER \| DEPARTMENT_HEAD \| HR \| SITE_ADMIN \| PAYROLL_ADMIN \| SPECIFIC_USER` |
| Approval Engine | `ApprovalModule` | `Leave \| Regularization \| Expense \| Loan \| Payroll \| Requisition \| Employee \| Offboarding \| Performance \| Appraisal \| Training \| Asset` |
| Events | `EventStatus` | `Scheduled \| Cancelled` |

## 21. Reports & Analytics — Full Selector Catalog

All exported functions from `report-selectors.ts`, grouped by area:

- **Workforce/Headcount**: `buildReportEmployeeRows`, `getHeadcountReport`
- **Attendance**: `getAttendanceReport`, `getAttendanceBreakdown`,
  `getAbsenteeismReport`, `getLateComingReport`,
  `getLateComingBreakdown`, `getOvertimeReport`
- **Leave**: `getLeaveBreakdown`, `getLeaveUtilizationReport`
- **Payroll**: `getPayrollReport`, `getPayrollBreakdown`, `getLopReport`,
  `getLopBreakdown`, `getLopMonthlyTrend`
- **Approvals**: `getApprovalReport`, `getApprovalBreakdownByModule`,
  `getApprovalSlaByModule`, `formatDuration`
- **Lifecycle/Site**: `getJoinersReport`, `getExitReport`,
  `getMonthlyTrend`, `getSiteComparisonReport`, `latestRunPerSite`,
  `getEmployeeLifecycleEventsByType`
- **Recruitment**: `getRecruitmentFunnelReport`, `getInterviewsOnDate`,
  `getRequisitionReport`, `getHiringBreakdown`, `getSourceWiseHiring`,
  `getInterviewConversionReport`, `getOfferConversionReport`
- **Performance**: `getPerformanceCompletionReport`,
  `getGoalCompletionReport`, `getRatingDistribution`,
  `getPerformanceRatingBreakdown`, `getPromotionRecommendations`,
  `getSalaryRevisionRecommendations`
- **Training**: `getTrainingProgramReport`, `getTrainingBreakdown`,
  `getSkillDistribution`
- **Assets**: `getAssetReport`, `getAssetsByType`, `getAssetsByDimension`,
  `getAssetsByEmployee`
- **Expenses**: `getExpenseReport`, `getTravelReport`,
  `getExpensesByCategory`, `getExpensesByDimension`,
  `getExpensesByEmployee`, `getTravelByType`, `getMonthlyExpenseTrend`

Filter dimensions applied at the page level before calling these
selectors: `department | subDepartment | designation | grade |
employmentType | employeeType | location | plant | status | employeeId`,
plus site and a date range (default: first-of-month → today).

## 22–26. Dashboard, Approval Workflow, Notifications, Search, RBAC & Security

No additional appendix content beyond `BRD.md` §22–§26 and the RBAC
matrix in this document's §5.

## 27. Data Ownership — Master Data Type Catalog

Every browsable Master Data type in `masterTypeConfig`
(`src/lib/master-data.ts`):

Department *(catalog-only — deep-links to Organization)*, Designation,
Job Grade, Employment Type, Employee Type, Location *(catalog-only)*,
Plant *(catalog-only)*, Shift, Shift Type, Leave Type, Holiday Type,
Salary Component, Allowance, Deduction, Qualification, Skill, Document
Type, Separation Reason, Recruitment Source, Cost Center, Profit Center,
Bank, Country, State, City, Goal Category, Performance Rating, Skill
Level, Training Category, Asset Type, Expense Category.

**Important distinction**: Department, Location, Plant, Cost Center, and
Profit Center exist in **two places** — as structural nodes in the
Organization `OrgUnit` hierarchy (`org-data.ts` — the actual source of
truth, site-scoped, tree-structured) and, for cataloging/reference
purposes only, as `managedExternally` entries in the Masters UI that
deep-link out to Organization rather than offering independent CRUD.
There is no separate "Business Unit" or "Sub Department" Master Data
type — those exist only as `OrgUnitType` values in the Organization tree.

As of this phase, the Designation master's "Department" field resolves
its dropdown options live from the real Organization > Department units
(`master-manager.tsx`), not from a static list — see §32/production-readiness.md
addendum for why this changed.

## 28–31. Business Rules, Integrations, NFRs, Future Architecture

No appendix content beyond `BRD.md` §28–§31.

## 32. Out of Scope / Fresh-Install Reference

See `docs/production-readiness.md` for the complete store-empty audit
performed in this phase, and `BRD.md` §27/§32 for the summary. Every
store listed in `BRD.md` §27 starts with zero records except
`rbac-store.ts`'s `accountsStore`, which starts with exactly
`[superAdminAccount]` — one platform account, not tied to any site, not
backed by an `Employee` record. Role/permission **configuration**
(`seedRoles`, `seedRolePermissions`, the feature catalog) is always
fully present — this is platform config, not tenant business data, and
is correctly excluded from the "starts empty" rule (see §5 above, §27 of
`BRD.md`).

## 33–34. Risks/Limitations, Future Roadmap

No appendix content beyond `BRD.md` §33–§34.

# Architecture Audit (Phase 17)

Full-domain audit of the current localStorage-backed frontend, ahead of a
future API/database migration. Every module follows the same layered
pattern established from Phase 12 onward:

```
types.ts (shape)
  -> master-data.ts (configurable lookups, where applicable)
  -> rbac-data.ts (feature catalog + per-role grants)
  -> <domain>-engine.ts (pure functions, no store/React)
  -> <domain>-store.ts (createLocalStorageStore-backed)
  -> <domain>-context.tsx (React provider, useSyncExternalStore)
  -> page(s) UI (site-filtered via useSiteFilter, gated via <Can>/canFeature)
```

Modules built before this pattern was established (Auth/RBAC scaffolding,
Sites, Organization, early Employee/Attendance/Leave) are noted where they
diverge.

## Per-module summary

| Module | Store(s) | Context | Engine/Selectors | Site scoping | Audit trail | Direct-URL guard |
|---|---|---|---|---|---|---|
| Auth/Session | rbac-store (accounts) + cookie | access-control-context | — | N/A (platform-level) | securityEventsStore | `AccessGuard` (module-level only) |
| RBAC | rbac-store (roles, rolePermissions, accounts, deviceSessions, securityEvents) | access-control-context | rbac-data.ts (featureCatalog, grant/grantActions) | Accounts carry `siteIds`; enforced in context (Phase 17 fix — see below) | securityEventsStore | `/access-control/*` gated by `AccessControl` module |
| Sites | site-context (`sitesStore`) | site-context | — | Is the scoping primitive for every other module (`mappedSites`, `useSiteFilter`) | none (no per-site audit log) | `/sites/[id]/edit` — no explicit notFound guard beyond the module gate |
| Organization | org-store (`orgUnitsStore`, `orgAuditStore`) | org-context | — | `siteId` on every unit | orgAuditStore | `/organization/units/[type]/[id]` |
| Masters | master-store (`masterRecordsStore`, `masterAuditStore`) | master-context | master-data.ts (masterTypeConfig) | `scope: "tenant" \| "global"` per type; tenant records carry `siteId` | masterAuditStore | `/masters/[type]` |
| Employees | employee-store (employees, bank details, documents) | employee-context | — | `siteId`/`siteIds` per employee | none dedicated (folded into Lifecycle events) | `/employees/[id]` (own-profile + mappedSites check) |
| Employee Lifecycle | lifecycle-store (`lifecycleEventsStore`) | employee-lifecycle-context | lifecycle-engine.ts | via employee's siteId | lifecycleEventsStore (append-only) | via Employee Profile guard |
| Attendance | attendance-store | attendance-context | attendance-context (summarizeAttendance) | `siteId` per record | none dedicated | no per-record detail route (list-only) |
| Regularization | regularization-store | regularization-context | — | via attendance record's siteId | none dedicated | list-only |
| Leave | leave-store | leave-context | leave-engine.ts (calculateLeaveDays, computeLeaveBalanceSummary) | `siteId` per request | leaveAuditStore | list-only; Approval Engine mirrors decisions |
| Payroll | payroll-store (salaryStructures, payrollRuns, payslips, loans, taxDeclarations) | payroll-context | payroll-engine.ts (buildDefaultSalaryLines, calculatePayslip) | `siteId` per run/payslip | none dedicated (relies on append-only SalaryStructure versioning) | `/payroll/payslip` |
| Recruitment | recruitment-store (requisitions, openings, pipeline, candidates, applications, interviews, offers) | recruitment-context | recruitment-engine.ts | `siteId` on requisition/opening | recruitmentAuditStore | single-page, no per-record route |
| Onboarding | onboarding-store | onboarding-context | — | via case's siteId | onboardingAuditStore | `/onboarding/[id]` |
| Offboarding | offboarding-store | offboarding-context | — | via case's siteId | offboardingAuditStore | `/offboarding/[id]` |
| Performance | performance-store (cycles, goals, review cases, appraisals) | performance-context | performance-engine.ts (weighted score) | `siteId` per cycle | none dedicated (status transitions are the record) | `/performance/[cycleId]` |
| Training/Skills | training-store, skill-store | training-context, skills-context | training-engine.ts, skill-engine.ts | `siteId` per program/enrollment | none dedicated | `/training/[programId]` |
| Assets | asset-store (assets, assignments, maintenance, disposals, requests, audit) | asset-context | asset-engine.ts | `siteId` per asset | assetAuditStore | `/assets/[assetId]` |
| Expenses/Travel | expense-store (travelRequests, expenseClaims, audit) | expense-context | expense-engine.ts | `siteId` per record | expenseAuditStore | `/expenses/claims/[claimId]`, `/expenses/travel/[requestId]` |
| Approval Engine | approval-store (`approvalInstancesStore`) | approval-context | approval-engine.ts | `siteId` per instance | `ApprovalAction[]` on the instance itself | consumed by owning module's own guard |
| Notifications (new, Phase 17) | notification-store (`notificationsStore`) | notification-context | — | N/A — scoped by recipient `employeeId`, never by site | is itself the record | no detail route (opens the related record) |
| Dashboard | reads other modules' stores | — | dashboard-selectors.ts | derived from viewer's site/role | — | `/dashboard` |
| Reports | reads other modules' stores | — | report-selectors.ts | `effectiveSiteIds` computed per viewer | — | `/reports` |
| Events | event-store (`eventsStore`) | event-context | — | optional `siteId` (global events allowed) | none dedicated | list-only |
| Settings | settings-store (`appSettingsStore`), site-config-store | settings-context, site-config-context | — | SiteConfig is per-site; AppSettings is platform-wide | none dedicated | `/settings` |

## Findings from this audit (fixed in Phase 17)

1. **Access Control > Users / Security pages leaked cross-site data.**
   `accounts`, `employees`, and `securityEvents` were read unscoped — a
   Site/HR Admin could view and CSV-export every account and every security
   event across every site, not just their own. Fixed: both pages now scope
   through `mappedSites`, matching every other module's list page.
2. **`access-control-context.tsx` mutations had no independent
   authorization.** `createAccount`, `setAccountRoles`, `setAccountStatus`,
   `unlockAccount`, `revokeDeviceSession`, `updateRole`, `deleteRole`, and
   `setRoleFeatureActions` relied entirely on the UI's `<Can>` gating —
   calling them directly (bypassing the button) had no permission check, no
   site-scope check, and (for the role/permission functions) no defense
   against privilege escalation. All eight now independently re-validate
   the caller's permission and, where relevant, site scope — the same
   "defense in depth" convention established for every domain built from
   Phase 12 onward (self-approval blocks, `isDirectManagerOf` checks, etc.).
3. **`site-form.tsx` (Edit Site) silently dropped fields on save.** It
   rebuilt the `Site` object from a fixed field list instead of spreading
   `initial` first, so `legalName`/`siteType`/`industry`/`email`/`phone`/
   `timezone`/`currency` — all captured at creation via the onboarding
   wizard — were wiped on every edit. Fixed: the form now exposes and
   preserves every field the wizard captures.
4. **`AccessControlProvider` flashed "Access Restricted" on every
   navigation** for ~300ms before the session cookie was checked (the check
   runs in a `useEffect`, so the first render always saw an unauthenticated
   `currentAccount`). Fixed with an explicit `sessionResolved` flag —
   `AccessGuard` now shows a neutral loading state until the first real
   check completes, never a false "Forbidden".
5. **Super Admin's own "My Profile" link 404'd** before "Load Demo Data" was
   ever clicked, because the Super Admin account's `employeeId` is a
   sentinel (`"SUPERADMIN"`) with no matching `Employee` record. Fixed with
   a dedicated `/profile` platform-level page; the Topbar now routes there
   whenever no real Employee record resolves.
6. **Events (`hrms_events`) and Expenses (`hrms_travel_requests` /
   `hrms_expense_claims`, fixed in Phase 16) stores seeded themselves by
   default** instead of starting empty and being populated only by "Load
   Demo Data" — violating the "fresh install has only the Super Admin
   account" convention every other module follows. Fixed for Events in this
   phase (moved into `demo-seed.ts`).
7. **The Topbar's notification bell and search box were decorative.** The
   bell mixed a few real computed counts with a hardcoded `recentActivities`
   array (removed — see Notifications section); the search input had no
   `onChange` handler at all. Both replaced with real, scoped implementations
   (see below).

## Not changed in this phase

- **Per-module mutation authorization** was spot-checked, not exhaustively
  re-audited across all ~40 context files. The pattern established from
  Phase 12 onward (self/site checks inside every action function, not just
  the UI) was verified to hold in Assets, Training, Performance, Expenses,
  Offboarding, and Employee Lifecycle — the modules built under that
  discipline from the start. Older modules (Attendance, Leave, Payroll,
  Recruitment, Onboarding) were not re-walked function-by-function in this
  phase; they were extensively live-tested for RBAC/site isolation in their
  own build phases and no new gap was found in the spot-checks performed
  here. A full line-by-line re-audit of every mutation in every module is a
  reasonable next hardening pass but was out of proportion for this phase.
- **`Attendance`, `Regularization`, `Leave`, `Recruitment`, `Performance`,
  `Payroll`, `Training`, `Onboarding`** don't have a dedicated audit-trail
  store the way Assets/Expenses/Offboarding/Organization/Masters do — Leave
  is the exception (`leaveAuditStore`). This is a pre-existing inconsistency,
  not a bug; each module's own status-transition fields plus the shared
  Approval Engine history already capture "what happened," so this wasn't
  treated as a correctness gap worth a forced retrofit.
- **Demo event dates** (`event-data.ts`) are fixed 2024 dates, unrelated to
  "today." Moving them into `demo-seed.ts` (this phase) makes the module
  real and store-backed; refreshing the dates to be relative-to-today is a
  cosmetic follow-up, not done here to avoid touching content beyond the
  wiring bug.

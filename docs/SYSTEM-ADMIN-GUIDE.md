# Summet HRMS — System Admin / Super Admin Guide

*This guide is for the platform-level Super Admin — the one account that
exists before any site, employee, or client user does. It is not a
per-site HR guide; for that, see [`docs/CLIENT-ONBOARDING-GUIDE.md`](./CLIENT-ONBOARDING-GUIDE.md).*

## Who the Super Admin is

The Super Admin is a platform operator, not an employee of any client
site. Its account (`account-superadmin`) is seeded on every fresh
install, is not tied to any `siteIds`, and is not backed by a real
`Employee` record — the platform synthesizes a minimal identity for it
(`resolveEmployeeForAccount` in `src/lib/employee-store.ts`) so its own
profile page and topbar never crash for lack of one.

`canFeature`/`canModule` in `access-control-context.tsx` grant the Super
Admin every action on every feature unconditionally — it is not
meaningfully restricted by the role/permission map the way every other
role is.

## Responsibilities

### Create and onboard sites

Only the Super Admin can run the Site Onboarding Wizard (`/sites/new`):
Basic Information → Organization Setup → Site Admin creation → Initial
Configuration (package plan, status) → Review → Create. This is the only
way a new tenant site — and its first Site Admin account — comes into
existence.

### Configure sites (only as far as bootstrapping requires)

The wizard seeds an initial organization structure and creates the
site's first Site Admin. Beyond that, day-to-day configuration
(remaining organization units, master data, leave/attendance/payroll
policy) is the new Site Admin's job, not yours — see "What Super Admin
should NOT normally do" below.

### Create Site Admins

Every new site needs exactly one initial Site Admin, created as part of
onboarding. If a site's Site Admin account is later locked out or needs
replacing, the Super Admin can create/unlock a replacement from Access
Control > Users (with `siteIds` scoped to that one site).

### Manage roles

The 12 system roles (Super Admin, Site Admin, HR Admin, HR Manager,
Payroll Admin, Finance, Department Head, Manager, Recruiter, Hiring
Manager, Employee, Auditor — see `docs/BRD.md` §5) are platform
configuration, not per-site data. Only the Super Admin (and, view-only,
HR Admin) can see Access Control > Roles / Permissions; only the Super
Admin can edit a role's feature-action grants
(`access-control.roles`/`access-control.permissions` `edit`/`manage` is
Super-Admin-only in the seeded permission map).

**This is a deliberate privilege-escalation guard** — `updateRole`,
`deleteRole`, and `setRoleFeatureActions` in `access-control-context.tsx`
independently re-check this permission at the data layer (not just hide
the button), because `setRoleFeatureActions` in particular could grant
any role — including one's own — `manage` on anything if it weren't
locked down.

### Manage permissions

Same guard as above — the feature catalog (33+ features across 19
modules, see `docs/BRD-Complete.md` §5) is fixed platform configuration.
Changing what a role can do platform-wide is a Super-Admin-only action
and should be treated as a rare, deliberate change, not routine
administration.

### Manage users

The Super Admin can create, view, and act on any account across every
site (unlike a Site Admin, who is confined to accounts at their own
mapped sites). Use this for platform-level account issues — a locked-out
Site Admin, a cross-site access problem — not as your default way of
managing a client's day-to-day users.

### Security

- Review Access Control > Security & Audit Log periodically — every
  login attempt (success, failure, lockout) is recorded there
  (`securityEventsStore`).
- Device sessions: a user can only revoke their own sessions; the Super
  Admin can revoke *any* session platform-wide — reserve this for actual
  incident response.
- Remember the platform's current authentication is development-grade
  (see `docs/production-readiness.md` §2) — session cookies are
  client-only and not server-verified, and passwords are not
  cryptographically hashed. Do not treat this deployment as meeting a
  real security bar until the backend migration described in
  `docs/BRD.md` §31 is complete.

### Audit

Most modules maintain their own append-only audit trail (Organization,
Masters, Assets, Expenses, Offboarding, Onboarding, Recruitment, Leave),
and every Approval Engine instance keeps a full action history. Use
these, plus the Security & Audit Log, when investigating "who did what."
Note: Attendance, Payroll, Training, and Performance rely on their own
status-transition fields and the shared Approval Engine's history rather
than a dedicated audit store — a documented, deliberate inconsistency
(see `docs/architecture-audit.md`), not a gap to "fix" by editing data
directly.

### Global masters

Master Data records with `scope: "global"` (as opposed to `"tenant"`)
apply across every site and are Super-Admin territory — tenant-scoped
Master records are each site's own to configure (§5 of
`docs/CLIENT-ONBOARDING-GUIDE.md`).

### Site isolation

Verify, especially after onboarding a new site, that:

- The new Site Admin's account has `siteIds` containing *only* that
  site.
- `isAllSites` (the cross-site toggle) is a Super-Admin-only affordance
  — no other role should ever be able to switch into a site it isn't
  mapped to. If you ever see this happen, treat it as a security bug,
  not a feature request.

### Troubleshooting (platform-level)

| Situation | What to check |
|---|---|
| A Site Admin is locked out | Access Control > Users — unlock, or check `lockedUntil` |
| A site's data looks empty right after onboarding | Expected — a fresh site has 0 employees/attendance/leave/payroll/etc. by design (see "Fresh-Install State" below); the new Site Admin must configure and populate it |
| An account can see another site's data | Check its `siteIds` immediately — this should never happen and indicates a site-isolation defect, not a permissions tweak |
| "Load Demo Data" is visible in a production deployment | It should not be — this affordance is gated behind `process.env.NODE_ENV !== "production"` (`src/lib/demo-seed.ts`) and is inlined to `false` at build time in a production build. If it appears in production, the deployment was not built with `NODE_ENV=production` |

## Fresh-Install State (what a brand-new deployment looks like)

- **Users**: exactly one — the Super Admin. No Site Admin, HR Admin, HR
  Manager, Manager, Employee, Recruiter, Hiring Manager, Finance, or any
  other account exists until the Super Admin onboards a site (which
  creates its Site Admin) and that Site Admin creates further accounts.
- **Sites**: 0.
- **Everything else** (Employees, Attendance, Leave Requests/Balances,
  Payroll Runs/Payslips/Salary Structures/Loans, Recruitment/Candidates,
  Onboarding/Offboarding Cases, Performance Cycles/Goals, Training
  Programs/Requests, Employee Skills, Assets/Assignments,
  Expenses/Travel Requests/Claims, Events): 0.
- **Role/permission definitions**: fully present. These are system
  configuration, not client data — see `docs/BRD-Complete.md` §32 for
  why this is correct and not a violation of "starts empty."
- **Dashboard**: shows a real empty-platform welcome state ("Total
  Sites: 0 · Total Employees: 0"), not fabricated statistics.
- **"Load Demo Data"**: visible only in a non-production build, and only
  from the empty-platform states (Dashboard, Sites page). Clicking it
  hydrates a full sample dataset for development/demo purposes. It never
  runs automatically and never appears in a production build.

## What Super Admin should NOT normally do

- **Day-to-day HR operations inside a client's site** — approving that
  site's leave requests, processing that site's payroll, managing that
  site's employee records. That's the Site Admin/HR team's job. The
  Super Admin operating routinely inside a client's operational data
  blurs the isolation model the whole platform is built around and
  should be the exception (real support/escalation), not the norm.
- **Creating employee/HR user accounts directly inside a site** except
  when bootstrapping (the wizard's Site Admin step) or handling an
  actual lockout/escalation. Ongoing user management for a site belongs
  to that site's Site Admin.
- **Editing role/permission definitions casually.** These are shared,
  platform-wide configuration — a change affects every site
  simultaneously. Treat it with the same care as a schema migration.
- **Using "Load Demo Data" against a real client's environment.** It is
  a development/demo utility only — see Part G of the phase instructions
  and `docs/production-readiness.md`'s addendum for this phase.

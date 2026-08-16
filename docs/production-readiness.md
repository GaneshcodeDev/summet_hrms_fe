# Production Readiness (Phase 17)

This document describes the current architecture, what must change before a
real production deployment, and how the existing frontend code maps onto a
future backend. **Nothing in this document has been implemented** — no
database, no API server, no auth service. That is explicitly out of scope
for this phase (see AGENTS.md / Phase 17 instructions); this is the
migration plan, not the migration.

## 1. Current architecture

```
Browser
  React Context providers (one per domain, see architecture-audit.md)
    -> createLocalStorageStore (src/lib/local-store.ts)
       -> window.localStorage (per-tab, per-browser, per-device)
  Session: a signed-nothing base64 cookie (src/lib/auth.ts) — NOT a JWT,
           NOT server-verified, purely a client-side convenience.
```

There is no server. Every "mutation" is a synchronous JS function that
reads the current localStorage snapshot, computes a new one, and writes it
back — see `local-store.ts`'s `createLocalStorageStore`. RBAC, site
isolation, and self-approval checks all run in the browser, in the same
JS bundle a user could open devtools and inspect or (in principle) bypass.
This is fine for a prototype and demo; it is explicitly **not** a security
boundary a production deployment can rely on.

## 2. Password / auth security (section 3)

`hashPassword()` in `rbac-data.ts` is base64 encoding with a `mock$`
prefix, not a cryptographic hash — this was already honestly documented in
that file before this phase:

> "Demo-only password store. There is no backend in this project... this
> obfuscates rather than cryptographically hashes. A real deployment must
> verify credentials and issue sessions server-side, never in client JS."

This phase did not change that mechanism and does not add a fake stronger
hash — a fake hash would suggest a security property that still isn't
there (client-side hashing can't stop someone with devtools access from
reading `accountsStore`'s plaintext-equivalent contents either way). The
honest fix is server-side auth, not a better client-side disguise.

**Before production**: passwords must never reach the browser at all.
Authentication must move to a real backend (bcrypt/argon2 hashing,
server-issued signed session tokens — JWT or opaque + server session store,
httpOnly + secure cookies, CSRF protection). The entire `auth.ts`
login/session/lockout flow is a placeholder for that server.

## 3. Store -> future backend entity mapping

Every `<domain>Store` maps to one or more tables. This list is the API
boundary in embryo — each store's public functions (create/update/delete)
are what becomes a REST/RPC endpoint.

| Frontend store | Future table(s) |
|---|---|
| `employee-store.ts` (`employeesStore`) | `employees` |
| `employee-store.ts` (`bankDetailsStore`) | `employee_bank_details` |
| `employee-store.ts` (`employeeDocumentsStore`) | `employee_documents` |
| `rbac-store.ts` (`accountsStore`) | `user_accounts` |
| `rbac-store.ts` (`rolesStore`, `rolePermissionsStore`) | `roles`, `role_permissions` |
| `rbac-store.ts` (`deviceSessionsStore`) | `sessions` (server-managed, not client-writable) |
| `rbac-store.ts` (`securityEventsStore`) | `security_audit_log` |
| `site-context.tsx` (`sitesStore`) | `sites` |
| `site-config-store.ts` | `site_configs` |
| `org-store.ts` (`orgUnitsStore`) | `org_units` |
| `master-store.ts` (`masterRecordsStore`) | `master_records` (or one table per `MasterType` if query patterns demand it) |
| `attendance-store.ts` | `attendance_records` |
| `regularization-store.ts` | `attendance_regularizations` |
| `leave-store.ts` (requests/balances/audit) | `leave_requests`, `leave_balances`, `leave_audit_log` |
| `payroll-store.ts` (salaryStructures/payrollRuns/payslips) | `salary_structures` (append-only/versioned), `payroll_runs`, `payslips` |
| `payroll-store.ts` (employeeLoans/taxDeclarations) | `employee_loans`, `tax_declarations` |
| `recruitment-store.ts` | `job_requisitions`, `job_openings`, `candidates`, `applications`, `interviews`, `offers`, `recruitment_audit_log` |
| `onboarding-store.ts` | `onboarding_cases`, `onboarding_audit_log` |
| `offboarding-store.ts` | `separation_cases`, `offboarding_audit_log` |
| `performance-store.ts` | `performance_cycles`, `performance_goals`, `performance_review_cases`, `appraisal_decisions` |
| `training-store.ts` | `training_programs`, `training_sessions`, `training_enrollments`, `training_attendance`, `training_requests`, `training_requirements` |
| `skill-store.ts` | `employee_skills`, `skill_update_proposals` |
| `asset-store.ts` | `assets`, `asset_assignments`, `asset_maintenance`, `asset_disposals`, `asset_requests`, `asset_audit_log` |
| `expense-store.ts` | `travel_requests`, `expense_claims` (with `expense_items` as a child table), `expense_audit_log` |
| `approval-store.ts` (`approvalInstancesStore`) | `approval_instances`, `approval_actions` |
| `notification-store.ts` (new, Phase 17) | `notifications` |
| `event-store.ts` | `company_events` |
| `settings-store.ts` (`appSettingsStore`) | `app_settings` (singleton row or key/value) |
| `lifecycle-store.ts` | `employee_lifecycle_events` |

## 4. API boundary — context operations that become endpoints

Every exported action from a `*-context.tsx` is already shaped like an RPC
call (input object in, `{ ok, message }` or a typed result out) — this was
a deliberate convention from Phase 9 onward specifically to make this
migration mechanical later. Representative examples (not exhaustive — the
pattern is identical across every module):

```
createEmployee(input)        -> POST   /api/employees
updateEmployee(id, patch)    -> PATCH  /api/employees/:id
approveLeave(id, note?)      -> POST   /api/leave/:id/approve
processPayroll(...)          -> POST   /api/payroll/runs
assignAsset(assetId, empId)  -> POST   /api/assets/:id/assign
returnAsset(assignmentId)    -> POST   /api/asset-assignments/:id/return
submitExpenseClaim(...)      -> POST   /api/expense-claims/:id/submit
managerDecideClaim(...)      -> POST   /api/expense-claims/:id/manager-decision
financeDecideClaim(...)      -> POST   /api/expense-claims/:id/finance-decision
markReimbursed(...)          -> POST   /api/expense-claims/:id/reimburse
completeOnboarding(...)      -> POST   /api/onboarding/:id/complete
recordMirroredAction(...)    -> internal only — becomes server-side logic invoked by
                                 the endpoints above, never its own public endpoint
```

**Public behavior must not change** when this migration happens: same
input shape, same `{ ok, message }`-style result, same validation rules
(self-approval blocked, site-scope enforced, status-transition guards).
The only thing moving is *where* those checks run — from browser JS to a
server that can't be bypassed by editing localStorage or calling the
function from devtools.

## 5. Transactional boundaries (must become real DB transactions)

These are the operations that currently mutate multiple stores in
sequence, with no atomicity guarantee beyond "it's all synchronous JS on
one thread." A real backend must wrap each of these in a database
transaction so a failure partway through can't leave inconsistent state.

1. **Recruitment -> Onboarding -> Employee -> Salary Structure**
   (`completeOnboarding` in onboarding-context.tsx / the recruitment→
   onboarding handoff): candidate becomes an employee record, gets an
   initial salary structure, and the onboarding case is marked complete —
   three stores, one logical event.
2. **Payroll Run -> Payslips -> Lock** (`payroll-engine.ts` /
   `payroll-context.tsx`'s run-processing flow): one run fans out into N
   payslips (one per employee); once "locked," historical payslips must
   never be recomputed even if the employee's salary structure changes
   later (this is why `EmployeeSalaryStructure` is append-only/versioned —
   see architecture-audit.md).
3. **Leave Approval -> Attendance -> Balance** (`leave-context.tsx`'s
   `finalizeApproval`): approving a leave request marks the corresponding
   Attendance records as "On Leave" and decrements the Leave Balance —
   three writes that must succeed or fail together.
4. **Expense Approval -> Reimbursement** (`expense-context.tsx`): Manager
   approval, Finance approval, and reimbursement are already modeled as
   separate steps on purpose (see Phase 16) — each is its own transaction
   boundary, but the two-step approval-instance update (status +
   `ApprovalAction` append) within a single step must be atomic.
5. **Asset Return -> Asset status -> Offboarding clearance**
   (`asset-context.tsx`'s `returnAsset`, read by `offboarding-context.tsx`
   via `activeAssignmentsForEmployee`): returning an asset must update the
   assignment AND the asset's status AND be immediately visible to the
   offboarding case's clearance check — currently guaranteed only because
   everything reads the same synchronous in-memory store.
6. **Employee Confirmation/Transfer/Promotion** (`employee-lifecycle-
   context.tsx`): each of these writes an append-only `LifecycleEvent` AND
   patches the `Employee` record's current fields (stage, site,
   designation) in the same call — must be one transaction.

## 6. What's explicitly NOT done in this phase

Per the Phase 17 stop condition: no PostgreSQL/MongoDB, no NestJS/API
server, no Redis, no Docker, no email/SMS provider, no AI, no external
integrations. This document is the plan for that work, not the work
itself. The localStorage architecture is preserved and hardened in place.

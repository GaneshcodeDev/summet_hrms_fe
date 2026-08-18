# Summet HRMS — Client Onboarding Guide

*Your company's site has been onboarded into Summet HRMS. This guide
walks your administrator through what to configure next, and gives every
role a starting point.*

## 1. Welcome

Summet HRMS is a multi-site Human Resource Management System covering
the full employee lifecycle: organization structure, employee records,
attendance, leave, payroll, recruitment, onboarding, performance,
training, assets, and expense/travel claims — all scoped to your
company's site and isolated from every other site on the platform.

Your site has already been created by the platform's Super Admin, along
with your first **Site Admin** account. Everything from here — your
organization structure, your employees, your policies — is configured
and owned by your team.

## 2. Login

Everyone signs in at the same login page with their work email and
password. What you see after login depends entirely on your role:

- **Site Admin** — full administrative access to your site: organization
  setup, masters, employees, roles, users, and every operational module.
- **HR/Admin roles** (HR Admin, HR Manager, Payroll Admin, Finance) —
  access to the modules relevant to their function (see the RBAC section
  of the internal BRD for the exact list per role).
- **Manager / Department Head** — a team-scoped dashboard plus approval
  queues for their direct reports (leave, attendance regularization,
  expenses, training requests, and more).
- **Employee** — a self-service view: own profile, own attendance, own
  leave, own payslips, own expense/training/asset requests.

Passwords are set by your Site Admin when an account is created. This
guide does not include any password — if you don't have yours, ask your
Site Admin to reset it.

## 3. First Login Checklist

Before adding real employees, your Site Admin should configure, in this
order:

1. Organization structure (§4)
2. Master data — shifts, employment types, leave types, salary
   components, etc. (§5)
3. Leave and attendance policy (§8, §9)
4. Salary components (§10)
5. Roles/users you'll need beyond the first Site Admin (§19)
6. Only then: add employees (§6)

Configuring in this order matters — employee records reference
Department, Designation, Shift, Employment Type, and Leave Type, so
those must exist first.

## 4. Organization Setup

Your organization is a single tree per site:

```
Site
 └─ Company
     └─ Business Unit
         └─ Division
             └─ Department
                 └─ Sub Department
```

Alongside this tree, you also configure: Branch, Plant, Location, Cost
Center, and Profit Center (each a node type in the same structure).

**Why configure this first**: every employee record references a
Department (and optionally Business Unit, Plant, Location, Cost Center,
Profit Center) by ID, not by free text. An employee cannot be
meaningfully placed in the organization until these nodes exist.

Go to **Organization > Structure** to build this tree, node by node,
under your site's Company root.

## 5. Master Data Setup

Under **Masters**, configure the reusable lookup lists your organization
needs:

- **Shift** — shift name, start/end time (used for late/early/overtime
  calculation)
- **Employment Type** / **Employee Type** — full-time, part-time,
  contract, intern, etc.
- **Job Grade** — pay/seniority bands
- **Leave Type** — with attributes: paid or unpaid, requires approval,
  requires a supporting document, max consecutive days, minimum notice
  days, max days per year
- **Salary Component** — Basic, HRA, PF, Professional Tax, and any
  custom earning/deduction lines, each with a configurable rate
- **Skill**, **Training Category** — for the Training module
- **Asset Type**, **Expense Category** — for Assets and Expenses
- Plus: Qualification, Document Type, Separation Reason, Recruitment
  Source, Bank, Country/State/City, Goal Category, Performance Rating,
  Skill Level

Designation is also configured here, and its "Department" field draws
its list live from whatever Departments you've created in Organization
(§4) — so Organization structure really does need to come first.

## 6. Employee Setup

Once Organization and Masters are ready, add employees under
**Employees > Add Employee**. The form is organized the same way the
employee record itself is:

- **Personal** — name, gender, marital status, education
- **Contact** — work email (required), phone (required), personal
  email, address
- **Employment** — designation, date of joining, employment type,
  employee type, probation period
- **Organization** — department, business unit, plant, location, cost
  center, profit center, grade, site
- **Manager** — reporting manager (drives approvals — see §7)
- **Shift** — assigned shift
- **Statutory** — PAN, PF number, UAN, ESI number (stored as reference
  data — see §10 for what payroll actually calculates from these today)
- **Bank** — account holder, bank, account number, IFSC, branch
- **Emergency Contact** — one or more contacts
- **Nominee** — one or more nominees (percentages must total 100%)
- **Previous Experience** — prior employment history
- **Documents** — ID proofs, offer letter, etc. (reference/filename
  only — see §20 on what this platform does and does not store)

## 7. Manager Setup

The **Reporting Manager** field on an employee's record is not cosmetic
— it drives approvals across the platform:

- **Attendance** — regularization requests route to the direct manager
  by default.
- **Leave** — depending on your configured approval mode (§9), the
  manager may be the sole approver or the first of two steps.
- **Performance** — the manager runs Manager Review and rates goals.
- **Training** — training requests route to the manager for approval.
- **Approvals generally** — the shared Approval Engine resolves
  "Reporting Manager" as one of its standard approver types across
  every module above, plus Expenses and Asset Requests.

Set this correctly before relying on approvals — an employee with no
manager assigned has no one to route manager-level approvals to.

## 8. Attendance Setup

Configure per-site attendance policy (accessible from **Settings** /
your Site Configuration):

- **Shift** — start/end time per shift (Master Data, §5)
- **Working days** — which days of the week count as working days for
  leave-day and payroll calculations
- **Grace period** — minutes of leeway before a late punch-in counts as
  Late
- **Attendance** — employees punch in/out; the system derives Present,
  Absent, Half Day, Late, Missing Punch, and Overtime automatically
- **Regularization** — employees (or managers, on their behalf) can
  request a correction to a specific day's attendance, which routes for
  approval

## 9. Leave Setup

For each **Leave Type** (§5) you configure:

- **Paid or unpaid** — paid types are checked against the employee's
  balance; unpaid types have no balance ceiling but always reduce pay
  (see §10).
- **Entitlement** — the default annual day count.
- **Carry Forward** — the balance model supports a carried-forward
  component, though your current setup does not automatically compute
  it period-over-period; treat balances as something you set/adjust
  directly for now.
- **Approval configuration** — choose Manager only, HR only, or Manager
  then HR (a genuine two-step approval) at the site level.
- **Other rules per type**: whether a supporting document is required,
  maximum consecutive days, minimum advance notice.

Approving a leave request automatically marks the employee's Attendance
as "On Leave" for every affected day and updates their balance —
you don't need to do this separately.

## 10. Payroll Setup

1. **Salary Components** (§5) — configure your Basic/HRA/PF/Professional
   Tax rates (or accept the platform defaults) plus any custom
   components.
2. **Salary Structure** — set each employee's CTC and component
   breakdown under their profile's Salary tab. Every change creates a
   new dated version — nothing is overwritten, so past payroll runs
   always reflect what was actually in force at the time.
3. **Bank Details** — captured per employee (§6).
4. **Loans** — employees can request a salary advance/loan; Payroll
   Admin or HR Admin approves and it's deducted as an EMI each payroll
   run until repaid.
5. **Payroll Processing** — under **Payroll**, process a run for a
   site+month (creates one payslip per employee with a salary
   structure), then Approve, then Lock. Locking is final — it commits
   loan EMI deductions and no further edits are possible for that run.

**Important**: this platform does not currently calculate TDS, ESI, or a
statutory (wage-ceiling-compliant) PF figure. PF and Professional Tax are
configurable percentage/fixed deductions only. If your organization needs
statutory tax compliance, run that calculation outside this platform
until it's added (see the internal BRD's Future Roadmap).

## 11. Recruitment

`Requisition (raised by a manager) → Approval (Manager, then HR) →
Job Opening → Candidates apply → Screening → Interview → Selected →
Offer → Offer Accepted`. Accepting an offer automatically creates an
Onboarding case for that candidate — you don't need to create it
separately.

## 12. Onboarding

Once an offer is accepted (or an onboarding case is created directly),
HR and the assigned buddy/manager work through a task and document
checklist (ID verification, IT setup, welcome tasks, etc.). Completing
every mandatory task and clearing every mandatory document lets HR
complete the case, which creates the employee's real record and — if
offer salary details were captured — their first salary structure.

## 13. Performance

`Cycle created (Draft → Open) → Goals assigned per employee → Employee
Self Review → Manager Review (with per-goal ratings) → optional HR
Review → Completed`. A completed review case can be turned into an
**Appraisal** — a proposed CTC increase and/or promotion — which, once
approved, automatically applies a new salary structure version and/or
promotion event.

## 14. Training

`Program created (with capacity, sessions, optional linked skill) →
Employees request or are enrolled directly → Approval (if requested) →
Sessions run, attendance tracked → Trainer records assessment →
Completion`. If a program is linked to a Skill and the employee passes,
a Skill Update Proposal is created for HR/manager approval — it never
silently updates an employee's skill record.

## 15. Assets

`Inventory registered (with Asset Type) → Assigned to an employee →
Returned (condition recorded — a damaged return keeps the asset marked
Damaged, not Available) → Maintenance if needed → Retired → Disposed`.
Employees can also raise an Asset Request, which routes for approval
before an asset is assigned.

## 16. Expenses

`Travel Request (optional advance) → Expense Claim with line items and
receipts → Manager Approval → Finance Approval → Reimbursement`. The
claim total is always the sum of its line items — there's no separate
"total" field to keep in sync.

## 17. Reports

Under **Reports**, your team has access to (subject to role permissions):
Overview, Attendance, Leave, Payroll, Approvals, Workforce, Performance,
Training, Assets, Expenses, and Recruitment — each filterable by date
range and by department/designation/grade/location/employment type/
employee. Employees themselves see a reduced self-service set: My
Attendance, My Leave, My Payroll.

## 18. Dashboard

- **Site Admin / HR Admin** see site-wide headcount, department
  distribution, attendance trend, leave summary, probation and exit
  summaries, and recent activity.
- **Manager / Department Head** see the same shape of information,
  scoped to their team.
- **Employee** sees their own attendance/leave snapshot and upcoming
  company events.

## 19. User & Permission Management

Your Site Admin manages who has access under **Access Control > Users**:
create an account for an employee, assign one or more of the platform's
system roles (HR Admin, HR Manager, Payroll Admin, Finance, Department
Head, Manager, Recruiter, Hiring Manager, Employee, Auditor), and
activate/deactivate/unlock accounts as people join, change roles, or
leave. Site Admin can view (but not edit) the definitions of roles and
permissions themselves — those are platform-level configuration.

## 20. Security

- **Never share passwords** over chat, email, or in a document like this
  one. Reset a forgotten password through the proper flow instead.
- **Use the correct role for the job** — grant the narrowest role that
  lets someone do their work (e.g., a Recruiter role for recruiting
  staff, not Site Admin).
- **Deactivate users who leave** your organization promptly, from
  Access Control > Users.
- **Do not grant unnecessary permissions.** Every role's access is
  intentionally scoped — resist the urge to give everyone broad access
  "just in case."
- Be aware this platform's current authentication is a
  development-grade implementation (documented in the internal BRD's
  security section) — treat it accordingly until a hardened backend is
  in place.

## 21. Employee Exit

`Resignation/notice initiated → Notice period tracked → Asset return
required for clearance → Full & Final Settlement computed → Case
completed`. The employee's stage moves to "On Notice" and then "Exited";
their employee status can be set to Inactive once the exit is complete.

## 22. Daily HR Operations

**Daily**
- Review attendance exceptions (Missing Punch, Late)
- Action pending leave and regularization approvals
- Check pending requests (expenses, training, assets) awaiting your
  decision

**Weekly**
- Clear the pending-approvals backlog across modules
- Review attendance exceptions trend
- Check recruitment pipeline movement
- Check onboarding case progress for new hires

**Monthly**
- Process, approve, and lock payroll
- Close out the month's attendance
- Review leave balances
- Review and reimburse settled expenses
- Pull monthly reports for review

## 23. Troubleshooting

| Situation | Likely cause / what to check |
|---|---|
| Employee cannot log in | Account may be Inactive or locked (5 failed attempts locks for 15 minutes) — check Access Control > Users |
| Manager cannot approve a request | Confirm the employee's Reporting Manager field actually points to them; confirm the manager's role has the relevant Approve permission |
| Employee not visible in a list | Check the employee's `siteId`/site mapping — most lists are scoped to the current site |
| Wrong site showing | Non-Super-Admin accounts only see sites mapped to them — check Access Control > Users for that account's site mapping |
| Wrong department on an employee | Edit the employee record's Organization tab; confirm the Department node exists under the correct site in Organization > Structure |
| Payroll not processed | Confirm every employee expected in the run has a Salary Structure configured — a run only creates payslips for employees who do |
| Leave balance looks wrong | Balances are opening + accrued + carry-forward − used − pending; check whether an approved/cancelled request already adjusted it |
| Asset not showing | Check its current status (Assigned/Under Maintenance/Retired/Disposed) — the Inventory view may be filtered |

## 24. Support / Escalation

**System Administrator:**
[Name]

**HR Admin:**
[Name]

**Support Email:**
[Email]

**Support Phone:**
[Phone]

*(Fill in your organization's actual contacts above — none are
pre-filled in this template.)*

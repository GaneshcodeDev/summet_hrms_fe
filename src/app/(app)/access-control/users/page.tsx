"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Info, KeyRound, Lock, Plus, ShieldAlert, Unlock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyRow, TBody, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { Can } from "@/components/auth/permission-gate";
import { useAccessControl } from "@/lib/access-control-context";
import { useSite } from "@/lib/site-context";
import { useNow } from "@/lib/use-now";
import { useEmployees } from "@/lib/employee-context";
import { downloadCsv } from "@/lib/utils";
import type { AccountStatus } from "@/lib/types";

export default function AccessControlUsersPage() {
  const { accounts, roles, createAccount, setAccountRoles, setAccountStatus, unlockAccount } = useAccessControl();
  const { sites } = useSite();
  const { employees } = useEmployees();
  const now = useNow();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [addOpen, setAddOpen] = useState(false);
  const [createdCredential, setCreatedCredential] = useState<{ name: string; email: string; password: string } | null>(null);
  const [rolesModalFor, setRolesModalFor] = useState<string | null>(null);
  const [deactivateFor, setDeactivateFor] = useState<string | null>(null);

  const roleNameById = useMemo(() => Object.fromEntries(roles.map((r) => [r.id, r.name])), [roles]);
  const unassignedEmployees = employees.filter((e) => !accounts.some((a) => a.employeeId === e.employeeId));

  const filtered = accounts.filter((a) => {
    const matchesSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "All Roles" || a.roleIds.some((id) => roleNameById[id] === roleFilter);
    const matchesStatus = statusFilter === "All Status" || a.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulkSetStatus(status: AccountStatus) {
    selected.forEach((id) => setAccountStatus(id, status));
    setSelected(new Set());
  }

  function handleAddUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const employeeId = String(form.get("employeeId") ?? "");
    const roleIds = form.getAll("roleIds").map(String);
    const siteIds = form.getAll("siteIds").map(String);
    if (!employeeId || roleIds.length === 0 || siteIds.length === 0) return;

    const result = createAccount({ employeeId, roleIds, siteIds });
    if (result) {
      setCreatedCredential({ name: result.account.name, email: result.account.email, password: result.tempPassword });
    }
  }

  function closeAddModal() {
    setAddOpen(false);
    setCreatedCredential(null);
  }

  function exportUsers() {
    downloadCsv(
      "users.csv",
      ["Name", "Email", "Roles", "Status", "Last Login"],
      filtered.map((a) => [
        a.name,
        a.email,
        a.roleIds.map((id) => roleNameById[id]).join("; "),
        a.status,
        a.lastLogin ? new Date(a.lastLogin).toLocaleString() : "Never",
      ]),
    );
  }

  const rolesModalAccount = accounts.find((a) => a.id === rolesModalFor);
  const deactivateAccount = accounts.find((a) => a.id === deactivateFor);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {accounts.length} user account{accounts.length === 1 ? "" : "s"} across the organization
        </p>
        <div className="flex items-center gap-2">
          <Can feature="access-control.users" action="export">
            <Button variant="outline" onClick={exportUsers}>
              Export
            </Button>
          </Can>
          <Can feature="access-control.users" action="create">
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add User
            </Button>
          </Can>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-auto">
            <option>All Roles</option>
            {roles.map((r) => (
              <option key={r.id}>{r.name}</option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
          </Select>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center justify-between border-b border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-sm dark:border-indigo-500/20 dark:bg-indigo-500/10">
            <span className="font-medium text-indigo-700 dark:text-indigo-300">{selected.size} selected</span>
            <div className="flex items-center gap-3">
              <button onClick={() => bulkSetStatus("Active")} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                Activate
              </button>
              <button onClick={() => bulkSetStatus("Inactive")} className="font-medium text-rose-600 hover:underline dark:text-rose-400">
                Deactivate
              </button>
              <button onClick={() => setSelected(new Set())} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                Clear
              </button>
            </div>
          </div>
        )}

        <Table>
          <THead>
            <Th className="w-8">
              <input
                type="checkbox"
                checked={selected.size > 0 && filtered.every((a) => selected.has(a.id))}
                onChange={(e) =>
                  setSelected(e.target.checked ? new Set(filtered.map((a) => a.id)) : new Set())
                }
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
              />
            </Th>
            <Th>User</Th>
            <Th>Roles</Th>
            <Th>Status</Th>
            <Th>Last Login</Th>
            <Th>Actions</Th>
          </THead>
          <TBody>
            {filtered.map((account) => {
              const locked = Boolean(account.lockedUntil && now !== null && new Date(account.lockedUntil).getTime() > now);
              return (
                <Tr key={account.id} hoverable>
                  <Td>
                    <input
                      type="checkbox"
                      checked={selected.has(account.id)}
                      onChange={() => toggleSelected(account.id)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
                    />
                  </Td>
                  <Td>
                    <Link href={`/employees/${account.employeeId}`} className="flex items-center gap-3 hover:underline">
                      <Avatar name={account.name} size="sm" />
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">{account.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{account.email}</p>
                      </div>
                    </Link>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {account.roleIds.map((id) => (
                        <Badge key={id} tone="indigo">
                          {roleNameById[id] ?? "Unknown"}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={account.status} />
                      {locked && (
                        <span title={`Locked until ${new Date(account.lockedUntil!).toLocaleTimeString()}`}>
                          <Lock className="h-3.5 w-3.5 text-rose-500" />
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>{account.lastLogin ? new Date(account.lastLogin).toLocaleDateString() : "Never"}</Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-3">
                      <Can feature="access-control.users" action="edit">
                        <button
                          onClick={() => setRolesModalFor(account.id)}
                          className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          Roles
                        </button>
                      </Can>
                      <Can feature="access-control.users" action="manage">
                        {locked ? (
                          <button
                            onClick={() => unlockAccount(account.id)}
                            className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                          >
                            <Unlock className="h-3.5 w-3.5" /> Unlock
                          </button>
                        ) : account.status === "Active" ? (
                          <button
                            onClick={() => setDeactivateFor(account.id)}
                            className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => setAccountStatus(account.id, "Active")}
                            className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                          >
                            Activate
                          </button>
                        )}
                      </Can>
                    </div>
                  </Td>
                </Tr>
              );
            })}
            {filtered.length === 0 && <EmptyRow colSpan={6}>No users match your filters.</EmptyRow>}
          </TBody>
        </Table>
      </Card>

      <Modal open={addOpen} onClose={closeAddModal} title="Add User">
        {createdCredential ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Check className="h-4 w-4 shrink-0" /> Account created for {createdCredential.name}.
            </div>
            <div className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/60 p-3.5 text-xs text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
              <div className="mb-1 flex items-center gap-1.5 font-medium">
                <Info className="h-3.5 w-3.5" /> Temporary credentials
              </div>
              <p>
                Email: <span className="font-mono">{createdCredential.email}</span>
              </p>
              <p>
                Temporary password: <span className="font-mono">{createdCredential.password}</span>
              </p>
              <p className="mt-1.5">The user must change this password on first sign-in.</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={closeAddModal}>Done</Button>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleAddUser}>
            <Field label="Employee">
              <Select name="employeeId" required defaultValue="">
                <option value="" disabled>
                  Select an employee without an account
                </option>
                {unassignedEmployees.map((e) => (
                  <option key={e.employeeId} value={e.employeeId}>
                    {e.name} &middot; {e.designation}
                  </option>
                ))}
              </Select>
              {unassignedEmployees.length === 0 && (
                <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                  Every employee already has a user account.
                </p>
              )}
            </Field>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Roles</span>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                {roles
                  .filter((r) => r.status === "Active")
                  .map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <input type="checkbox" name="roleIds" value={r.id} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800" />
                      {r.name}
                    </label>
                  ))}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Site Access</span>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                {sites.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input type="checkbox" name="siteIds" value={s.id} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800" />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeAddModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={unassignedEmployees.length === 0}>
                <KeyRound className="h-4 w-4" /> Create Account
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(rolesModalAccount)} onClose={() => setRolesModalFor(null)} title={`Assign Roles — ${rolesModalAccount?.name ?? ""}`}>
        {rolesModalAccount && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const roleIds = form.getAll("roleIds").map(String);
              if (roleIds.length === 0) return;
              setAccountRoles(rolesModalAccount.id, roleIds);
              setRolesModalFor(null);
            }}
          >
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              {roles
                .filter((r) => r.status === "Active")
                .map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      name="roleIds"
                      value={r.id}
                      defaultChecked={rolesModalAccount.roleIds.includes(r.id)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
                    />
                    {r.name}
                  </label>
                ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setRolesModalFor(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Roles</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(deactivateAccount)} onClose={() => setDeactivateFor(null)} title="Deactivate User">
        {deactivateAccount && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {deactivateAccount.name} will immediately lose the ability to sign in. You can reactivate this
                account at any time.
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeactivateFor(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setAccountStatus(deactivateAccount.id, "Inactive");
                  setDeactivateFor(null);
                }}
              >
                Deactivate
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

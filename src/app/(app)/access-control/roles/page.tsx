"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Lock, Plus, Settings2, ShieldAlert, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { Can } from "@/components/auth/permission-gate";
import { useAccessControl } from "@/lib/access-control-context";

export default function AccessControlRolesPage() {
  const { roles, accounts, addRole, updateRole, deleteRole } = useAccessControl();

  const [addOpen, setAddOpen] = useState(false);
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const editRole = roles.find((r) => r.id === editRoleId);
  const roleToDelete = roles.find((r) => r.id === deleteRoleId);

  function userCount(roleId: string) {
    return accounts.filter((a) => a.roleIds.includes(roleId)).length;
  }

  function handleAddRole(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const cloneFromRoleId = String(form.get("cloneFromRoleId") ?? "") || undefined;
    if (!name) return;
    addRole({ name, description, cloneFromRoleId });
    setAddOpen(false);
    e.currentTarget.reset();
  }

  function handleEditRole(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editRole) return;
    const form = new FormData(e.currentTarget);
    updateRole(editRole.id, {
      name: String(form.get("name") ?? editRole.name).trim(),
      description: String(form.get("description") ?? editRole.description).trim(),
    });
    setEditRoleId(null);
  }

  function handleDelete() {
    if (!roleToDelete) return;
    const result = deleteRole(roleToDelete.id);
    if (!result.ok) {
      setDeleteError(
        result.reason === "system"
          ? "System roles can't be deleted."
          : "This role is assigned to one or more users — reassign them first.",
      );
      return;
    }
    setDeleteRoleId(null);
    setDeleteError(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {roles.length} configurable role{roles.length === 1 ? "" : "s"}
        </p>
        <Can feature="access-control.roles" action="create">
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Role
          </Button>
        </Can>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => (
          <Card key={role.id} className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">{role.name}</p>
                  {role.isSystem && <Lock className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600" />}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{role.description}</p>
              </div>
              <StatusBadge status={role.status} />
            </div>

            <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <Users className="h-3.5 w-3.5" />
              {userCount(role.id)} user{userCount(role.id) === 1 ? "" : "s"} assigned
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
              <Link
                href={`/access-control/permissions?role=${role.id}`}
                className="flex items-center gap-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                <Settings2 className="h-3.5 w-3.5" /> Permissions
              </Link>
              <Can feature="access-control.roles" action="edit">
                <button
                  onClick={() => setEditRoleId(role.id)}
                  className="font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Edit
                </button>
                <button
                  onClick={() =>
                    updateRole(role.id, { status: role.status === "Active" ? "Inactive" : "Active" })
                  }
                  className="font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {role.status === "Active" ? "Deactivate" : "Activate"}
                </button>
              </Can>
              <Can feature="access-control.roles" action="delete">
                {!role.isSystem && (
                  <button
                    onClick={() => {
                      setDeleteRoleId(role.id);
                      setDeleteError(null);
                    }}
                    className="font-medium text-rose-600 hover:underline dark:text-rose-400"
                  >
                    Delete
                  </button>
                )}
              </Can>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Role">
        <form className="space-y-4" onSubmit={handleAddRole}>
          <Field label="Role Name">
            <Input name="name" required placeholder="e.g. Regional HR Lead" />
          </Field>
          <Field label="Description">
            <Textarea name="description" rows={3} placeholder="What this role is responsible for" />
          </Field>
          <Field label="Clone permissions from (optional)">
            <Select name="cloneFromRoleId" defaultValue="">
              <option value="">Start with no permissions</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Role</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(editRole)} onClose={() => setEditRoleId(null)} title="Edit Role">
        {editRole && (
          <form className="space-y-4" onSubmit={handleEditRole}>
            <Field label="Role Name">
              <Input name="name" required defaultValue={editRole.name} disabled={editRole.isSystem} />
            </Field>
            <Field label="Description">
              <Textarea name="description" rows={3} defaultValue={editRole.description} />
            </Field>
            {editRole.isSystem && (
              <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                <Lock className="h-3.5 w-3.5" /> System role names can&apos;t be renamed.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditRoleId(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(roleToDelete)} onClose={() => setDeleteRoleId(null)} title="Delete Role">
        {roleToDelete && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This will permanently delete the &apos;{roleToDelete.name}&apos; role and its permission grants. This
                can&apos;t be undone.
              </span>
            </div>
            {deleteError && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteRoleId(null)}>
                Cancel
              </Button>
              <Button onClick={handleDelete}>Delete Role</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

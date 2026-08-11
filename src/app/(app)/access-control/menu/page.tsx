"use client";

import { FormEvent, useState } from "react";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useAccessControl } from "@/lib/access-control-context";
import { useMenu } from "@/lib/menu-context";
import { useToast } from "@/lib/toast-context";
import { menuIconNames, resolveMenuIcon } from "@/lib/menu-data";
import { actionsGrantedFor, featuresByModule } from "@/lib/rbac-data";
import { permissionModules } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { MenuItem, PermissionModule } from "@/lib/types";

export default function MenuManagementPage() {
  const { roles, rolePermissions } = useAccessControl();
  const { menuItems, canManageMenu, createMenuItem, updateMenuItem, deleteMenuItem } = useMenu();

  /** Does `roleId` have real view access to `module`? (independent of who's currently logged in) */
  function roleHasModuleView(roleId: string, module: PermissionModule) {
    if (roles.find((r) => r.id === roleId)?.name === "Super Admin") return true;
    const features = featuresByModule[module] ?? [];
    return features.some((f) => actionsGrantedFor(rolePermissions[roleId], f.id).includes("view"));
  }

  function defaultVisibleRoleIds(item: MenuItem) {
    return roles.filter((r) => (item.module ? roleHasModuleView(r.id, item.module) : true)).map((r) => r.id);
  }
  const toast = useToast();

  const [formTarget, setFormTarget] = useState<{ parentId: string | null; initial?: MenuItem } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);

  const topLevel = [...menuItems].filter((m) => m.parentId === null).sort((a, b) => a.order - b.order);
  const childrenOf = (id: string) => [...menuItems].filter((m) => m.parentId === id).sort((a, b) => a.order - b.order);

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formTarget) return;
    const form = new FormData(e.currentTarget);
    const moduleValue = String(form.get("module") ?? "");
    const input = {
      label: String(form.get("label") ?? "").trim(),
      icon: String(form.get("icon") ?? "FolderTree"),
      href: String(form.get("href") ?? "").trim(),
      parentId: formTarget.parentId,
      module: (moduleValue || undefined) as PermissionModule | undefined,
    };
    const result = formTarget.initial
      ? updateMenuItem(formTarget.initial.id, input)
      : createMenuItem(input);
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setFormTarget(null);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const result = deleteMenuItem(deleteTarget.id);
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setDeleteTarget(null);
  }

  function toggleRole(item: MenuItem, roleId: string) {
    const current = item.roleIds ?? defaultVisibleRoleIds(item);
    const next = current.includes(roleId) ? current.filter((r) => r !== roleId) : [...current, roleId];
    const result = updateMenuItem(item.id, { roleIds: next });
    if (!result.ok) toast.error(result.message);
  }

  function resetToDefault(item: MenuItem) {
    const result = updateMenuItem(item.id, { roleIds: undefined });
    (result.ok ? toast.success : toast.error)(result.ok ? "Reset to default module permissions." : result.message);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Menus &amp; Submenus</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Controls what appears in the sidebar and in what order. This is a presentation layer — the underlying
            module permission (Permission Matrix) still governs real page access.
          </p>
        </div>
        {canManageMenu && (
          <Button size="sm" onClick={() => setFormTarget({ parentId: null })}>
            <Plus className="h-4 w-4" /> Add Menu
          </Button>
        )}
      </div>

      <Card className="divide-y divide-slate-100 dark:divide-slate-800">
        {topLevel.map((item) => {
          const Icon = resolveMenuIcon(item.icon);
          const children = childrenOf(item.id);
          return (
            <div key={item.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.label}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {item.href} {item.module && `· ${item.module}`}
                    </p>
                  </div>
                </div>
                {canManageMenu && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setFormTarget({ parentId: item.id })}
                      className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      + Submenu
                    </button>
                    <button
                      onClick={() => setFormTarget({ parentId: item.parentId, initial: item })}
                      className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {children.length > 0 && (
                <div className="ml-11 mt-3 space-y-2 border-l border-slate-100 pl-4 dark:border-slate-800">
                  {children.map((child) => {
                    const ChildIcon = resolveMenuIcon(child.icon);
                    return (
                      <div key={child.id} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <ChildIcon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                          <div>
                            <p className="text-sm text-slate-600 dark:text-slate-300">{child.label}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">{child.href}</p>
                          </div>
                        </div>
                        {canManageMenu && (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setFormTarget({ parentId: child.parentId, initial: child })}
                              className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(child)}
                              className="text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </Card>

      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Role Visibility</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Decide which roles see each menu item. Items left on <Badge tone="slate">Default</Badge> follow the
          linked module&apos;s normal permission.
        </p>

        <Card className="mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-500">
                  <th className="sticky left-0 z-10 min-w-[200px] bg-slate-50 px-4 py-3 font-medium dark:bg-slate-800/60">
                    Menu Item
                  </th>
                  {roles.map((r) => (
                    <th key={r.id} className="min-w-[110px] px-2 py-3 text-center font-medium">
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...menuItems]
                  .sort((a, b) => a.order - b.order)
                  .map((item) => {
                    const isCustom = item.roleIds !== undefined;
                    const effective = item.roleIds ?? defaultVisibleRoleIds(item);
                    return (
                      <tr key={item.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                        <td className="sticky left-0 bg-white px-4 py-2.5 dark:bg-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("font-medium", item.parentId ? "pl-4 text-slate-500 dark:text-slate-400" : "text-slate-700 dark:text-slate-200")}>
                              {item.label}
                            </span>
                            <Badge tone={isCustom ? "indigo" : "slate"} className="px-1.5 py-0.5 text-[10px]">
                              {isCustom ? "Custom" : "Default"}
                            </Badge>
                          </div>
                          {isCustom && canManageMenu && (
                            <button
                              onClick={() => resetToDefault(item)}
                              className="mt-0.5 text-xs text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400"
                            >
                              Reset to default
                            </button>
                          )}
                        </td>
                        {roles.map((role) => (
                          <td key={role.id} className="px-2 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={effective.includes(role.id)}
                              disabled={!canManageMenu}
                              onChange={() => toggleRole(item, role.id)}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal
        open={Boolean(formTarget)}
        onClose={() => setFormTarget(null)}
        title={formTarget?.initial ? "Edit Menu Item" : formTarget?.parentId ? "Add Submenu" : "Add Menu"}
      >
        {formTarget && (
          <form className="space-y-4" onSubmit={handleSave}>
            <Field label="Label">
              <Input name="label" required defaultValue={formTarget.initial?.label} placeholder="e.g. Events" />
            </Field>
            <Field label="Link (href)">
              <Input name="href" required defaultValue={formTarget.initial?.href} placeholder="e.g. /events" />
            </Field>
            <Field label="Icon">
              <Select name="icon" defaultValue={formTarget.initial?.icon ?? "FolderTree"}>
                {menuIconNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Linked Module (optional — governs real page access)">
              <Select name="module" defaultValue={formTarget.initial?.module ?? ""}>
                <option value="">None</option>
                {permissionModules.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Linking a module doesn&apos;t grant access by itself — it only means this item respects that module&apos;s
              existing permission when deciding who sees it.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormTarget(null)}>
                Cancel
              </Button>
              <Button type="submit">{formTarget.initial ? "Save Changes" : "Add"}</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Remove Menu Item">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Remove <span className="font-medium text-slate-700 dark:text-slate-200">{deleteTarget.label}</span> from
              the sidebar? Its page keeps working — this only hides the shortcut.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                Remove
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

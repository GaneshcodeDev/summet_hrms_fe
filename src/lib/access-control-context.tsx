"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { employeesStore, findEmployeeByEmployeeId, resolveEmployeeForAccount } from "@/lib/employee-store";
import { actionsGrantedFor, featuresByModule, hashPassword } from "@/lib/rbac-data";
import {
  accountsStore,
  deviceSessionsStore,
  findAccountById,
  logSecurityEvent,
  rolePermissionsStore,
  rolesStore,
  securityEventsStore,
  updateAccount,
} from "@/lib/rbac-store";
import { getSession } from "@/lib/auth";
import type {
  AccountStatus,
  DeviceSession,
  Employee,
  PermissionAction,
  PermissionModule,
  Role,
  RolePermissionMap,
  SecurityEvent,
  UserAccount,
} from "@/lib/types";

export interface ResolvedUser extends Employee {
  /** Primary (first-assigned) role display name — kept for components that only show one role. */
  role: string;
  roles: Role[];
  account: UserAccount | undefined;
}

interface AccessControlContextValue {
  roles: Role[];
  rolePermissions: Record<string, RolePermissionMap>;
  accounts: UserAccount[];
  deviceSessions: DeviceSession[];
  securityEvents: SecurityEvent[];

  currentAccount: UserAccount | undefined;
  currentRoles: Role[];
  currentUser: ResolvedUser;
  isSuperAdmin: boolean;
  /** False until the session cookie has been checked at least once on the client — gate rendering on this, not on canModule/canFeature, to avoid an "Access Restricted" flash. */
  sessionResolved: boolean;

  canFeature: (featureId: string, action: PermissionAction) => boolean;
  canModule: (module: PermissionModule, action: PermissionAction) => boolean;

  addRole: (input: { name: string; description: string; cloneFromRoleId?: string }) => string;
  updateRole: (id: string, patch: Partial<Pick<Role, "name" | "description" | "status">>) => void;
  deleteRole: (id: string) => { ok: boolean; reason?: "system" | "in_use" };
  setRoleFeatureActions: (roleId: string, featureId: string, actions: PermissionAction[]) => void;

  createAccount: (input: {
    employeeId: string;
    roleIds: string[];
    siteIds: string[];
    /** If provided (e.g. Site Admin creation, where an admin sets a real password), used as-is instead of generating one. */
    password?: string;
  }) => { account: UserAccount; tempPassword: string } | undefined;
  setAccountRoles: (accountId: string, roleIds: string[]) => void;
  setAccountStatus: (accountId: string, status: AccountStatus) => void;
  unlockAccount: (accountId: string) => void;
  revokeDeviceSession: (sessionId: string) => void;
}

const AccessControlContext = createContext<AccessControlContextValue | undefined>(undefined);

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function generateTempPassword() {
  return `Welcome${Math.floor(1000 + Math.random() * 9000)}!`;
}

function mergeGrantedActions(
  roleIds: string[],
  rolePermissions: Record<string, RolePermissionMap>,
  featureId: string,
): Set<PermissionAction> {
  const granted = new Set<PermissionAction>();
  for (const roleId of roleIds) {
    for (const action of actionsGrantedFor(rolePermissions[roleId], featureId)) {
      granted.add(action);
    }
  }
  return granted;
}

export function AccessControlProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const roles = useSyncExternalStore(rolesStore.subscribe, rolesStore.getSnapshot, rolesStore.getServerSnapshot);
  const rolePermissions = useSyncExternalStore(
    rolePermissionsStore.subscribe,
    rolePermissionsStore.getSnapshot,
    rolePermissionsStore.getServerSnapshot,
  );
  const accounts = useSyncExternalStore(accountsStore.subscribe, accountsStore.getSnapshot, accountsStore.getServerSnapshot);
  const deviceSessions = useSyncExternalStore(
    deviceSessionsStore.subscribe,
    deviceSessionsStore.getSnapshot,
    deviceSessionsStore.getServerSnapshot,
  );
  const securityEvents = useSyncExternalStore(
    securityEventsStore.subscribe,
    securityEventsStore.getSnapshot,
    securityEventsStore.getServerSnapshot,
  );

  const [sessionAccountId, setSessionAccountId] = useState<string | undefined>(undefined);
  // Distinguishes "haven't checked the session cookie yet" from "checked it
  // and there's no account" — getSession() only works client-side (reads
  // document.cookie), so the very first render (both the SSR pass and the
  // initial client hydration pass) can never know the real session yet.
  // Without this flag, AccessGuard briefly saw an unauthenticated
  // currentAccount and flashed "Access Restricted" before this effect ran
  // (~300ms). Now it renders a neutral loading state until the first real
  // check completes.
  const [sessionResolved, setSessionResolved] = useState(false);

  useEffect(() => {
    function checkSession(): boolean {
      const session = getSession();
      setSessionAccountId(session?.accountId);
      setSessionResolved(true);
      return Boolean(session);
    }
    if (!checkSession()) {
      router.replace("/login?reason=expired");
      return;
    }
    // Client-side defense in depth: proxy.ts already blocks expired sessions on
    // navigation, but a session can also expire while the tab stays open.
    const interval = setInterval(() => {
      if (!checkSession()) router.replace("/login?reason=expired");
    }, 30_000);
    return () => clearInterval(interval);
  }, [router]);

  const currentAccount = useMemo(
    () => (sessionAccountId ? accounts.find((a) => a.id === sessionAccountId) : undefined),
    [accounts, sessionAccountId],
  );

  const currentRoles = useMemo(
    () => (currentAccount ? roles.filter((r) => currentAccount.roleIds.includes(r.id)) : []),
    [roles, currentAccount],
  );

  // Plain-module subscription (no EmployeeProvider dependency needed — see
  // employee-store.ts) so currentUser stays live if the signed-in person's
  // own employee record changes, without creating a provider cycle (Employee
  // itself depends on useAccessControl for permission checks).
  const employeesSnapshot = useSyncExternalStore(
    employeesStore.subscribe,
    employeesStore.getSnapshot,
    employeesStore.getServerSnapshot,
  );

  const currentUser = useMemo<ResolvedUser>(() => {
    if (!currentAccount) {
      const placeholder = resolveEmployeeForAccount(
        {
          id: "unauthenticated",
          employeeId: "",
          name: "Guest",
          email: "",
          roleIds: [],
          status: "Inactive",
          siteIds: [],
          passwordHash: "",
          failedLoginAttempts: 0,
          createdOn: "",
        },
        employeesSnapshot,
      );
      return { ...placeholder, role: "No Role Assigned", roles: [], account: undefined };
    }
    const employee = resolveEmployeeForAccount(currentAccount, employeesSnapshot);
    return {
      ...employee,
      role: currentRoles[0]?.name ?? "No Role Assigned",
      roles: currentRoles,
      account: currentAccount,
    };
  }, [currentAccount, currentRoles, employeesSnapshot]);

  const isSuperAdmin = currentRoles.some((r) => r.name === "Super Admin");

  const canFeature = useCallback(
    (featureId: string, action: PermissionAction) => {
      if (isSuperAdmin) return true;
      if (!currentAccount) return false;
      return mergeGrantedActions(currentAccount.roleIds, rolePermissions, featureId).has(action);
    },
    [isSuperAdmin, currentAccount, rolePermissions],
  );

  const canModule = useCallback(
    (module: PermissionModule, action: PermissionAction) => {
      if (isSuperAdmin) return true;
      const features = featuresByModule[module] ?? [];
      return features.some((f) => canFeature(f.id, action));
    },
    [isSuperAdmin, canFeature],
  );

  const addRole = useCallback<AccessControlContextValue["addRole"]>(
    ({ name, description, cloneFromRoleId }) => {
      const id = `role-${slugify(name)}-${Date.now().toString(36)}`;
      rolesStore.update((rs) => [
        ...rs,
        { id, name, description, isSystem: false, status: "Active", createdOn: new Date().toISOString().slice(0, 10) },
      ]);
      rolePermissionsStore.update((rp) => ({
        ...rp,
        [id]: cloneFromRoleId ? { ...(rp[cloneFromRoleId] ?? {}) } : {},
      }));
      logSecurityEvent({ type: "role_created", actorName: currentUser.name, detail: `Created role '${name}'`, ip: "—" });
      return id;
    },
    [currentUser.name],
  );

  // Roles/permissions are global (not site-scoped), and setRoleFeatureActions
  // in particular is a direct privilege-escalation vector (it can grant any
  // role — including one's own — "manage" on anything), so these three
  // independently require access-control.roles/permissions "edit"/"manage"
  // rather than trusting the Roles/Permissions page's own <Can> gating
  // (section 6). Super Admin is exempt via canFeature's own bypass.
  const updateRole = useCallback<AccessControlContextValue["updateRole"]>(
    (id, patch) => {
      if (!canFeature("access-control.roles", "edit") && !canFeature("access-control.roles", "manage")) return;
      rolesStore.update((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    [canFeature],
  );

  const deleteRole = useCallback<AccessControlContextValue["deleteRole"]>(
    (id) => {
      if (!canFeature("access-control.roles", "delete") && !canFeature("access-control.roles", "manage")) {
        return { ok: false };
      }
      const role = rolesStore.getSnapshot().find((r) => r.id === id);
      if (!role) return { ok: false };
      if (role.isSystem) return { ok: false, reason: "system" };
      if (accountsStore.getSnapshot().some((a) => a.roleIds.includes(id))) return { ok: false, reason: "in_use" };
      rolesStore.update((rs) => rs.filter((r) => r.id !== id));
      rolePermissionsStore.update((rp) => {
        const next = { ...rp };
        delete next[id];
        return next;
      });
      return { ok: true };
    },
    [canFeature],
  );

  const setRoleFeatureActions = useCallback<AccessControlContextValue["setRoleFeatureActions"]>(
    (roleId, featureId, actions) => {
      if (!canFeature("access-control.permissions", "edit") && !canFeature("access-control.permissions", "manage")) return;
      rolePermissionsStore.update((rp) => ({
        ...rp,
        [roleId]: { ...rp[roleId], [featureId]: actions },
      }));
      const role = rolesStore.getSnapshot().find((r) => r.id === roleId);
      logSecurityEvent({
        type: "role_permissions_updated",
        actorName: currentUser.name,
        detail: `Updated '${featureId}' permissions for role '${role?.name ?? roleId}'`,
        ip: "—",
      });
    },
    [currentUser.name, canFeature],
  );

  const createAccount = useCallback<AccessControlContextValue["createAccount"]>(
    ({ employeeId, roleIds, siteIds, password }) => {
      // Data-layer authorization, independent of the "Add User" button being
      // hidden for the wrong role (section 6): a non-Super-Admin can only
      // create an account for an employee at one of their own mapped sites,
      // and can only grant access to sites they themselves can reach. Uses
      // currentAccount.siteIds directly rather than the Site module's
      // mappedSites — SiteProvider is a descendant of AccessControlProvider
      // in the tree (see layout.tsx), so this context can't call useSite().
      if (!isSuperAdmin && !canFeature("access-control.users", "create")) return undefined;
      const employee = findEmployeeByEmployeeId(employeeId);
      if (!employee) return undefined;
      if (accountsStore.getSnapshot().some((a) => a.employeeId === employeeId)) return undefined;
      if (!isSuperAdmin) {
        const callerSites = currentAccount?.siteIds ?? [];
        if (!callerSites.includes(employee.siteId)) return undefined;
        if (siteIds.some((id) => !callerSites.includes(id))) return undefined;
      }

      const tempPassword = password?.trim() || generateTempPassword();
      const account: UserAccount = {
        id: `account-${employeeId}-${Date.now().toString(36)}`,
        employeeId,
        name: employee.name,
        email: employee.email,
        roleIds,
        status: "Active",
        siteIds,
        passwordHash: hashPassword(tempPassword),
        mustChangePassword: !password,
        failedLoginAttempts: 0,
        createdOn: new Date().toISOString().slice(0, 10),
      };
      accountsStore.update((accs) => [account, ...accs]);
      logSecurityEvent({
        type: "role_assigned",
        accountId: account.id,
        actorName: currentUser.name,
        detail: `Created account for ${employee.name}`,
        ip: "—",
      });
      return { account, tempPassword };
    },
    [currentUser.name, isSuperAdmin, canFeature, currentAccount],
  );

  // Shared data-layer guard for every account mutation below (section 6) —
  // previously these had NO independent check at all (not even a feature
  // permission, let alone site scope), relying entirely on the "Roles" /
  // "Deactivate" / "Unlock" buttons being hidden by <Can> in the UI. A
  // non-Super-Admin may only act on an account whose OWN site overlaps
  // their mapped sites, and only with the matching feature action granted.
  const canActOnAccount = useCallback(
    (accountId: string, action: PermissionAction) => {
      if (isSuperAdmin) return true;
      if (!canFeature("access-control.users", action) && !canFeature("access-control.users", "manage")) return false;
      const target = findAccountById(accountId);
      const callerSites = currentAccount?.siteIds ?? [];
      return Boolean(target && target.siteIds.some((id) => callerSites.includes(id)));
    },
    [isSuperAdmin, canFeature, currentAccount],
  );

  const setAccountRoles = useCallback<AccessControlContextValue["setAccountRoles"]>(
    (accountId, roleIds) => {
      if (!canActOnAccount(accountId, "edit")) return;
      updateAccount(accountId, { roleIds });
      const account = findAccountById(accountId);
      logSecurityEvent({
        type: "role_assigned",
        accountId,
        actorName: currentUser.name,
        detail: `Updated role assignment for ${account?.name ?? accountId}`,
        ip: "—",
      });
    },
    [currentUser.name, canActOnAccount],
  );

  const setAccountStatus = useCallback<AccessControlContextValue["setAccountStatus"]>(
    (accountId, status) => {
      if (!canActOnAccount(accountId, "manage")) return;
      updateAccount(accountId, { status });
      const account = findAccountById(accountId);
      logSecurityEvent({
        type: "user_status_changed",
        accountId,
        actorName: currentUser.name,
        detail: `Set ${account?.name ?? accountId} to ${status}`,
        ip: "—",
      });
    },
    [currentUser.name, canActOnAccount],
  );

  const unlockAccount = useCallback<AccessControlContextValue["unlockAccount"]>(
    (accountId) => {
      if (!canActOnAccount(accountId, "manage")) return;
      updateAccount(accountId, { lockedUntil: undefined, failedLoginAttempts: 0 });
      const account = findAccountById(accountId);
      logSecurityEvent({
        type: "account_unlocked",
        accountId,
        actorName: currentUser.name,
        detail: `Unlocked ${account?.name ?? accountId}`,
        ip: "—",
      });
    },
    [currentUser.name, canActOnAccount],
  );

  // A user may only revoke their OWN device sessions (the only path the UI
  // exposes — see employees/[id]/page.tsx's Security tab); Super Admin can
  // revoke any, for real incident response.
  const revokeDeviceSession = useCallback<AccessControlContextValue["revokeDeviceSession"]>(
    (sessionId) => {
      const session = deviceSessionsStore.getSnapshot().find((s) => s.id === sessionId);
      if (!session) return;
      if (!isSuperAdmin && session.accountId !== currentAccount?.id) return;
      deviceSessionsStore.update((sessions) => sessions.filter((s) => s.id !== sessionId));
    },
    [isSuperAdmin, currentAccount],
  );

  const value = useMemo<AccessControlContextValue>(
    () => ({
      roles,
      rolePermissions,
      accounts,
      deviceSessions,
      securityEvents,
      currentAccount,
      currentRoles,
      currentUser,
      isSuperAdmin,
      sessionResolved,
      canFeature,
      canModule,
      addRole,
      updateRole,
      deleteRole,
      setRoleFeatureActions,
      createAccount,
      setAccountRoles,
      setAccountStatus,
      unlockAccount,
      revokeDeviceSession,
    }),
    [
      roles,
      rolePermissions,
      accounts,
      deviceSessions,
      securityEvents,
      currentAccount,
      currentRoles,
      currentUser,
      isSuperAdmin,
      sessionResolved,
      canFeature,
      canModule,
      addRole,
      updateRole,
      deleteRole,
      setRoleFeatureActions,
      createAccount,
      setAccountRoles,
      setAccountStatus,
      unlockAccount,
      revokeDeviceSession,
    ],
  );

  return <AccessControlContext.Provider value={value}>{children}</AccessControlContext.Provider>;
}

export function useAccessControl() {
  const ctx = useContext(AccessControlContext);
  if (!ctx) throw new Error("useAccessControl must be used within an AccessControlProvider");
  return ctx;
}

export function useCurrentUser(): ResolvedUser {
  return useAccessControl().currentUser;
}

export function useCan() {
  const { canFeature, canModule } = useAccessControl();
  return { canFeature, canModule };
}

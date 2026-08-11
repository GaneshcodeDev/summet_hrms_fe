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
import { currentUser as fallbackUser, employees, getEmployeeById } from "@/lib/mock-data";
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

  canFeature: (featureId: string, action: PermissionAction) => boolean;
  canModule: (module: PermissionModule, action: PermissionAction) => boolean;

  addRole: (input: { name: string; description: string; cloneFromRoleId?: string }) => string;
  updateRole: (id: string, patch: Partial<Pick<Role, "name" | "description" | "status">>) => void;
  deleteRole: (id: string) => { ok: boolean; reason?: "system" | "in_use" };
  setRoleFeatureActions: (roleId: string, featureId: string, actions: PermissionAction[]) => void;

  createAccount: (input: { employeeId: string; roleIds: string[]; siteIds: string[] }) => { account: UserAccount; tempPassword: string } | undefined;
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

  useEffect(() => {
    function checkSession(): boolean {
      const session = getSession();
      setSessionAccountId(session?.accountId);
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

  const currentUser = useMemo<ResolvedUser>(() => {
    // EMP001 always exists in the seed employee list, so this default is never undefined in practice.
    const defaultEmployee = getEmployeeById(fallbackUser.employeeId)!;
    if (!currentAccount) {
      return { ...defaultEmployee, role: fallbackUser.role, roles: [], account: undefined };
    }
    const employee = getEmployeeById(currentAccount.employeeId) ?? defaultEmployee;
    return {
      ...employee,
      role: currentRoles[0]?.name ?? "No Role Assigned",
      roles: currentRoles,
      account: currentAccount,
    };
  }, [currentAccount, currentRoles]);

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

  const updateRole = useCallback<AccessControlContextValue["updateRole"]>((id, patch) => {
    rolesStore.update((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const deleteRole = useCallback<AccessControlContextValue["deleteRole"]>((id) => {
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
  }, []);

  const setRoleFeatureActions = useCallback<AccessControlContextValue["setRoleFeatureActions"]>(
    (roleId, featureId, actions) => {
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
    [currentUser.name],
  );

  const createAccount = useCallback<AccessControlContextValue["createAccount"]>(
    ({ employeeId, roleIds, siteIds }) => {
      const employee = employees.find((e) => e.employeeId === employeeId);
      if (!employee) return undefined;
      if (accountsStore.getSnapshot().some((a) => a.employeeId === employeeId)) return undefined;

      const tempPassword = generateTempPassword();
      const account: UserAccount = {
        id: `account-${employeeId}-${Date.now().toString(36)}`,
        employeeId,
        name: employee.name,
        email: employee.email,
        roleIds,
        status: "Active",
        siteIds,
        passwordHash: hashPassword(tempPassword),
        mustChangePassword: true,
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
    [currentUser.name],
  );

  const setAccountRoles = useCallback<AccessControlContextValue["setAccountRoles"]>(
    (accountId, roleIds) => {
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
    [currentUser.name],
  );

  const setAccountStatus = useCallback<AccessControlContextValue["setAccountStatus"]>(
    (accountId, status) => {
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
    [currentUser.name],
  );

  const unlockAccount = useCallback<AccessControlContextValue["unlockAccount"]>(
    (accountId) => {
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
    [currentUser.name],
  );

  const revokeDeviceSession = useCallback<AccessControlContextValue["revokeDeviceSession"]>((sessionId) => {
    deviceSessionsStore.update((sessions) => sessions.filter((s) => s.id !== sessionId));
  }, []);

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

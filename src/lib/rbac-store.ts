"use client";

import { createLocalStorageStore } from "@/lib/local-store";
import { seedRolePermissions, seedRoles, superAdminAccount } from "@/lib/rbac-data";
import type {
  DeviceSession,
  Role,
  RolePermissionMap,
  SecurityEvent,
  UserAccount,
} from "@/lib/types";

/**
 * Plain (non-React) persistence for accounts/roles/sessions/audit events.
 * Kept separate from AccessControlProvider so auth.ts can read and write it
 * from pages that render outside the app shell (login, forgot/reset password)
 * without needing a provider mounted.
 *
 * Roles/permissions are platform configuration, not tenant data, so they're
 * always fully seeded. Accounts/sessions/security events start with just the
 * Super Admin — the real empty-state product experience — see demo-seed.ts
 * for the optional rich demo dataset.
 */
export const rolesStore = createLocalStorageStore<Role[]>("hrms_roles", seedRoles);
export const rolePermissionsStore = createLocalStorageStore<Record<string, RolePermissionMap>>(
  "hrms_role_permissions",
  seedRolePermissions,
);
export const accountsStore = createLocalStorageStore<UserAccount[]>("hrms_accounts", [superAdminAccount]);
export const deviceSessionsStore = createLocalStorageStore<DeviceSession[]>("hrms_device_sessions", []);
export const securityEventsStore = createLocalStorageStore<SecurityEvent[]>("hrms_security_events", []);

export function logSecurityEvent(event: Omit<SecurityEvent, "id" | "timestamp">) {
  const entry: SecurityEvent = {
    ...event,
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  securityEventsStore.update((events) => [entry, ...events].slice(0, 300));
  return entry;
}

export function findAccountByEmail(email: string): UserAccount | undefined {
  return accountsStore.getSnapshot().find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
}

export function findAccountById(id: string): UserAccount | undefined {
  return accountsStore.getSnapshot().find((a) => a.id === id);
}

export function updateAccount(id: string, patch: Partial<UserAccount>) {
  accountsStore.update((accounts) => accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)));
}

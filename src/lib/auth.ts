"use client";

import { hashPassword, verifyPassword } from "@/lib/rbac-data";
import {
  deviceSessionsStore,
  findAccountByEmail,
  findAccountById,
  logSecurityEvent,
  updateAccount,
} from "@/lib/rbac-store";
import type { UserAccount } from "@/lib/types";

const SESSION_COOKIE = "hrms_session";
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
const SESSION_HOURS = 8;
const REMEMBER_DAYS = 30;
const RESET_TOKEN_MINUTES = 30;
const RESET_TOKENS_KEY = "hrms_reset_tokens";

export interface SessionPayload {
  accountId: string;
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
  remember: boolean;
}

function encodeSession(payload: SessionPayload): string {
  return btoa(encodeURIComponent(JSON.stringify(payload)));
}

function decodeSession(raw: string): SessionPayload | null {
  try {
    return JSON.parse(decodeURIComponent(atob(raw))) as SessionPayload;
  } catch {
    return null;
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

function detectDevice(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "iPhone/iPad · iOS";
  if (/Android/.test(ua)) return "Android device";
  if (/Mac/.test(ua)) return "Mac · macOS";
  if (/Windows/.test(ua)) return "PC · Windows";
  return "Unknown device";
}

function detectBrowser(): string {
  if (typeof navigator === "undefined") return "Unknown browser";
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "Browser";
}

/** Reads and validates the session cookie; clears it (and returns null) once expired. */
export function getSession(): SessionPayload | null {
  const raw = readCookie(SESSION_COOKIE);
  if (!raw) return null;
  const payload = decodeSession(raw);
  if (!payload || payload.expiresAt < Date.now()) {
    if (payload) clearCookie(SESSION_COOKIE);
    return null;
  }
  return payload;
}

export function getCurrentAccount(): UserAccount | undefined {
  const session = getSession();
  return session ? findAccountById(session.accountId) : undefined;
}

export type LoginError = "invalid_credentials" | "locked" | "inactive";
export type LoginResult = { ok: true } | { ok: false; error: LoginError; lockedUntil?: string };

export function login(email: string, password: string, remember: boolean): LoginResult {
  const ip = "203.0.113.10"; // no real network layer in this client-only demo
  const account = findAccountByEmail(email);

  if (!account) {
    logSecurityEvent({ type: "login_failed", actorName: email || "unknown", detail: "No account for this email", ip });
    return { ok: false, error: "invalid_credentials" };
  }

  if (account.lockedUntil && new Date(account.lockedUntil).getTime() > Date.now()) {
    logSecurityEvent({ type: "login_failed", accountId: account.id, actorName: account.name, detail: "Login attempted while locked", ip });
    return { ok: false, error: "locked", lockedUntil: account.lockedUntil };
  }

  if (account.status === "Inactive") {
    logSecurityEvent({ type: "login_failed", accountId: account.id, actorName: account.name, detail: "Login attempted on inactive account", ip });
    return { ok: false, error: "inactive" };
  }

  if (!verifyPassword(password, account.passwordHash)) {
    const attempts = account.failedLoginAttempts + 1;
    const locked = attempts >= MAX_FAILED_ATTEMPTS;
    const lockedUntil = locked ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : undefined;
    updateAccount(account.id, { failedLoginAttempts: attempts, lockedUntil });
    logSecurityEvent({
      type: locked ? "account_locked" : "login_failed",
      accountId: account.id,
      actorName: account.name,
      detail: locked
        ? `Account locked for ${LOCKOUT_MINUTES} minutes after ${attempts} failed attempts`
        : `Invalid password (attempt ${attempts} of ${MAX_FAILED_ATTEMPTS})`,
      ip,
    });
    return locked ? { ok: false, error: "locked", lockedUntil } : { ok: false, error: "invalid_credentials" };
  }

  const now = Date.now();
  const expiresAt = now + (remember ? REMEMBER_DAYS * 24 * 3_600_000 : SESSION_HOURS * 3_600_000);
  const sessionId = `sess-${now}-${Math.random().toString(36).slice(2, 8)}`;
  writeCookie(SESSION_COOKIE, encodeSession({ accountId: account.id, sessionId, issuedAt: now, expiresAt, remember }), Math.round((expiresAt - now) / 1000));

  updateAccount(account.id, { failedLoginAttempts: 0, lockedUntil: undefined, lastLogin: new Date(now).toISOString() });
  deviceSessionsStore.update((sessions) => [
    {
      id: sessionId,
      accountId: account.id,
      device: detectDevice(),
      browser: detectBrowser(),
      location: "Current session",
      ip,
      createdAt: new Date(now).toISOString(),
      lastActiveAt: new Date(now).toISOString(),
      remember,
    },
    ...sessions,
  ]);
  logSecurityEvent({ type: "login_success", accountId: account.id, actorName: account.name, detail: remember ? "Signed in (remember me)" : "Signed in", ip });

  return { ok: true };
}

export function logout() {
  const session = getSession();
  if (session) {
    const account = findAccountById(session.accountId);
    deviceSessionsStore.update((sessions) => sessions.filter((s) => s.id !== session.sessionId));
    if (account) {
      logSecurityEvent({ type: "logout", accountId: account.id, actorName: account.name, detail: "Signed out", ip: "—" });
    }
  }
  clearCookie(SESSION_COOKIE);
}

/** Ends every session for the account except the current one. */
export function revokeOtherSessions(accountId: string) {
  const session = getSession();
  deviceSessionsStore.update((sessions) =>
    sessions.filter((s) => s.accountId !== accountId || s.id === session?.sessionId),
  );
}

export function revokeSession(sessionId: string) {
  deviceSessionsStore.update((sessions) => sessions.filter((s) => s.id !== sessionId));
}

export type ChangePasswordError = "not_authenticated" | "invalid_current_password" | "same_as_current";

export function changePassword(currentPassword: string, newPassword: string): { ok: boolean; error?: ChangePasswordError } {
  const account = getCurrentAccount();
  if (!account) return { ok: false, error: "not_authenticated" };
  if (!verifyPassword(currentPassword, account.passwordHash)) return { ok: false, error: "invalid_current_password" };
  if (verifyPassword(newPassword, account.passwordHash)) return { ok: false, error: "same_as_current" };
  updateAccount(account.id, { passwordHash: hashPassword(newPassword), mustChangePassword: false });
  logSecurityEvent({ type: "password_changed", accountId: account.id, actorName: account.name, detail: "Password changed by user", ip: "—" });
  return { ok: true };
}

interface ResetToken {
  token: string;
  accountId: string;
  expiresAt: number;
}

function readResetTokens(): ResetToken[] {
  try {
    return JSON.parse(localStorage.getItem(RESET_TOKENS_KEY) ?? "[]") as ResetToken[];
  } catch {
    return [];
  }
}

function writeResetTokens(tokens: ResetToken[]) {
  localStorage.setItem(RESET_TOKENS_KEY, JSON.stringify(tokens));
}

/** Always succeeds without revealing whether the email exists (prevents account enumeration). */
export function requestPasswordReset(email: string): { token?: string } {
  const account = findAccountByEmail(email);
  if (!account) return {};
  const token = `${account.id}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const tokens = readResetTokens().filter((t) => t.accountId !== account.id);
  tokens.push({ token, accountId: account.id, expiresAt: Date.now() + RESET_TOKEN_MINUTES * 60_000 });
  writeResetTokens(tokens);
  logSecurityEvent({ type: "password_reset_requested", accountId: account.id, actorName: account.name, detail: "Password reset link requested", ip: "—" });
  return { token };
}

export function verifyResetToken(token: string): { valid: boolean; email?: string } {
  const entry = readResetTokens().find((t) => t.token === token);
  if (!entry || entry.expiresAt < Date.now()) return { valid: false };
  const account = findAccountById(entry.accountId);
  return { valid: Boolean(account), email: account?.email };
}

export function resetPassword(token: string, newPassword: string): { ok: boolean } {
  const entry = readResetTokens().find((t) => t.token === token);
  if (!entry || entry.expiresAt < Date.now()) return { ok: false };
  const account = findAccountById(entry.accountId);
  if (!account) return { ok: false };
  updateAccount(account.id, { passwordHash: hashPassword(newPassword), failedLoginAttempts: 0, lockedUntil: undefined });
  writeResetTokens(readResetTokens().filter((t) => t.token !== token));
  logSecurityEvent({ type: "password_reset_completed", accountId: account.id, actorName: account.name, detail: "Password reset completed", ip: "—" });
  return { ok: true };
}

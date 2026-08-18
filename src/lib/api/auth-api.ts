"use client";

import { apiFetch } from "./api-client";
import { clearTokens, setTokens } from "./token-store";

export interface BackendRole {
  id: string;
  name: string;
}

export interface BackendUser {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  isLocked: boolean;
  roles: BackendRole[];
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: BackendUser;
}

/** Returns the backend user on success, or null on any failure (unknown email, wrong password, backend unreachable, ...). */
export async function backendLogin(email: string, password: string): Promise<BackendUser | null> {
  try {
    const result = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      unauthenticated: true,
    });
    setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    return result.user;
  } catch {
    clearTokens();
    return null;
  }
}

export async function backendLogout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    // best-effort — logout is stateless server-side anyway (see docs/auth-rbac.md)
  } finally {
    clearTokens();
  }
}

export async function backendMe(): Promise<(BackendUser & { permissions: string[] }) | null> {
  try {
    return await apiFetch<BackendUser & { permissions: string[] }>("/auth/me");
  } catch {
    return null;
  }
}

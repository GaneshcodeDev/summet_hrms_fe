"use client";

/**
 * Holds the real backend's JWT pair, entirely separate from the existing
 * local session cookie (lib/auth.ts). Most local accounts never have a
 * backend counterpart (see rbac-data.ts backendBridgeAccount comment) —
 * pages that call the API check `isBackendConnected()` and show an honest
 * "not connected to live data" state rather than crashing when it's false.
 */
const STORAGE_KEY = "hrms_backend_tokens";

export interface BackendTokens {
  accessToken: string;
  refreshToken: string;
}

function readTokens(): BackendTokens | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BackendTokens) : null;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return readTokens()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return readTokens()?.refreshToken ?? null;
}

export function setTokens(tokens: BackendTokens): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function isBackendConnected(): boolean {
  return getAccessToken() !== null;
}

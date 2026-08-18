"use client";

import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./token-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message: string;
  errors?: string[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** True when the backend genuinely can't be reached at all (down, wrong URL, CORS) — distinct from a normal 4xx. */
export class ApiUnreachableError extends Error {
  constructor(cause: unknown) {
    super("The backend API is unreachable.");
    this.name = "ApiUnreachableError";
    this.cause = cause;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) return false;
        const body = (await response.json()) as ApiEnvelope<{ accessToken: string; refreshToken: string }>;
        if (!body.data) return false;
        setTokens({ accessToken: body.data.accessToken, refreshToken: body.data.refreshToken ?? refreshToken });
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Skip the Authorization header entirely (login/refresh calls). */
  unauthenticated?: boolean;
}

/**
 * Thin fetch wrapper for the real backend (summet_hrms_be): attaches the
 * access token, retries exactly once after a transparent refresh on a 401,
 * and normalizes both the `{success,data,message}` envelope and error
 * shapes into a single typed surface. Network failures (backend down) are
 * distinguished from real HTTP error responses so callers can show an
 * honest "not connected" state instead of a generic crash.
 */
export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", body, unauthenticated = false } = options;

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = unauthenticated ? null : getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      return await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (cause) {
      throw new ApiUnreachableError(cause);
    }
  };

  let response = await doFetch();

  if (response.status === 401 && !unauthenticated) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await doFetch();
    } else {
      clearTokens();
    }
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(`Unexpected response from the API (HTTP ${response.status}).`, response.status);
  }

  if (!response.ok || !envelope.success) {
    throw new ApiError(envelope.message ?? `Request failed (HTTP ${response.status}).`, response.status, envelope.errors);
  }

  return envelope.data as T;
}

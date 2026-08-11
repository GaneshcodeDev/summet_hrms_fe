import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

interface SessionPayload {
  accountId: string;
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
  remember: boolean;
}

/**
 * Optimistic check only — reads the session cookie's claimed expiry without
 * touching account data (there's no database; account state lives in
 * localStorage, which Proxy/edge code can't reach). Real per-permission
 * authorization happens client-side in AccessGuard/`<Can>`, which is the
 * pattern Next.js recommends for Proxy-based auth checks.
 */
function readSession(request: NextRequest): SessionPayload | null {
  const raw = request.cookies.get("hrms_session")?.value;
  if (!raw) return null;
  try {
    const payload = JSON.parse(decodeURIComponent(atob(raw))) as SessionPayload;
    if (!payload.expiresAt || payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = readSession(request);
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!session && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname + search);
    if (request.cookies.get("hrms_session")?.value) {
      // A cookie existed but failed validation (expired/malformed) — tell the login page why.
      loginUrl.searchParams.set("reason", "expired");
    }
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("hrms_session");
    return response;
  }

  if (session && (pathname === "/login" || pathname === "/forgot-password" || pathname === "/reset-password")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (session && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

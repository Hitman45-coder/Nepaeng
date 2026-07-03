import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { accessFor, guardForPath, type Access } from "@/lib/rbac";

/**
 * Edge middleware enforcing authentication + route-level RBAC.
 *
 * - Unauthenticated users are redirected to /login (pages) or get 401 (API).
 * - Users with `mustResetPassword` are funnelled to /change-password.
 * - Page prefixes are gated via ROUTE_GUARDS (see src/lib/rbac.ts). Blocked
 *   roles are sent to /403 (pages) or get 403 (API).
 *
 * Field-level rules (e.g. hiding financials from ENGINEER) are enforced inside
 * the relevant pages/components and API handlers, not here.
 */

const PUBLIC_PAGES = ["/login", "/403"];
const PUBLIC_API = ["/api/auth/login"];

const RANK: Record<Access, number> = { none: 0, read: 1, write: 2 };

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api");

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  // ---- Public routes -------------------------------------------------------
  if (PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    // If already logged in, bounce away from the login page.
    if (session && pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }
  if (PUBLIC_API.includes(pathname)) {
    return NextResponse.next();
  }

  // ---- Authentication ------------------------------------------------------
  if (!session) {
    if (isApi) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ---- Forced password reset ----------------------------------------------
  const isChangePwPage = pathname === "/change-password";
  const isChangePwApi = pathname === "/api/auth/change-password";
  const isLogoutApi = pathname === "/api/auth/logout";
  if (
    session.mustResetPassword &&
    !isChangePwPage &&
    !isChangePwApi &&
    !isLogoutApi
  ) {
    if (isApi) {
      return NextResponse.json(
        { error: "Password reset required" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  // ---- Route-level RBAC ----------------------------------------------------
  const guard = guardForPath(pathname);
  if (guard) {
    const granted = accessFor(session.role, guard.resource);
    if (RANK[granted] < RANK[guard.access]) {
      if (isApi) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/403", req.url));
    }
  }

  // Root -> dashboard
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/|.*\\..*).*)"],
};

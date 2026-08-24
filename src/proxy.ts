import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { isAuthDevBypassActive } from "@/lib/config/env";

// Next.js 16 renamed the middleware convention to "proxy" (same runtime
// behavior/signature, new required export name).
const PUBLIC_PATH_PREFIXES = ["/login", "/api/auth", "/api/cron/scan", "/api/oauth/google/callback"];

export async function proxy(request: NextRequest) {
  // Dev/mock mode: no real session exists, so route protection is a no-op
  // and identity is resolved server-side via the seeded Dev User instead
  // (see lib/auth/session.ts). Never active when NODE_ENV=production.
  if (isAuthDevBypassActive()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const session = await auth();
  if (!session?.teamMemberId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

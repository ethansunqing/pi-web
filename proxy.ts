import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { isApiRequestOriginAllowed, shouldCheckApiRequestOrigin } from "@/lib/request-security";

const intlMiddleware = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API requests: enforce cross-origin check (upstream security hardening).
  if (pathname.startsWith("/api")) {
    if (shouldCheckApiRequestOrigin(request) && !isApiRequestOriginAllowed(request)) {
      return NextResponse.json(
        { error: "Cross-origin API requests are not allowed" },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  // Non-API requests: next-intl locale routing (local i18n).
  return intlMiddleware(request);
}

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next|_vercel|.*\\..*).*)", "/api/:path*"],
};

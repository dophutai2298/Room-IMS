import { updateSession } from "@insforge/sdk/ssr/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { getAppBackend } from "@/lib/backend/selection";
import { updateSupabaseSession } from "@/lib/supabase/proxy";
import { isSupabaseFoundationApiPath, isSupabaseFoundationPagePath } from "@/lib/supabase/migration-slice";

const protectedRoutePrefixes = [
  "/",
  "/rooms",
  "/tenants",
  "/invoices",
  "/utility-pricing",
  "/staff",
];

export async function proxy(request: NextRequest) {
  if (getAppBackend() === "supabase") {
    const { pathname } = request.nextUrl;
    if (pathname.startsWith("/api/") && !isSupabaseFoundationApiPath(pathname)) {
      return NextResponse.json({
        ok: false,
        error: {
          kind: "unavailable",
          code: "MIGRATION_SLICE_NOT_READY",
          message: "This feature has not migrated to Supabase yet.",
          status: 503,
        },
      }, { status: 503 });
    }
    if (!pathname.startsWith("/api/") && !isSupabaseFoundationPagePath(pathname)) {
      return NextResponse.redirect(new URL("/rooms", request.url));
    }
    const session = await updateSupabaseSession(request);
    const isProtected = protectedRoutePrefixes.some((route) =>
      route === "/" ? pathname === "/" : pathname.startsWith(route),
    );

    if (isProtected && !session.authenticated) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("next", pathname);
      const redirect = NextResponse.redirect(signInUrl);
      session.response.cookies.getAll().forEach((cookie) =>
        redirect.cookies.set(cookie),
      );
      return redirect;
    }

    return session.response;
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next({ request });
  }

  const response = NextResponse.next({ request });

  const session = await updateSession({
    requestCookies: request.cookies,
    responseCookies: response.cookies,
  });

  const { pathname } = request.nextUrl;
  const isProtectedRoute = protectedRoutePrefixes.some((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route),
  );
  const isSignedIn = Boolean(session.accessToken);

  if (isProtectedRoute && !isSignedIn) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/rooms/:path*",
    "/tenants/:path*",
    "/invoices/:path*",
    "/utility-pricing/:path*",
    "/staff/:path*",
    "/api/:path*",
  ],
};

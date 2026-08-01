import { updateSession } from "@insforge/sdk/ssr/middleware";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutePrefixes = ["/", "/rooms", "/invoices"];

export async function proxy(request: NextRequest) {
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
  matcher: ["/", "/rooms/:path*", "/invoices/:path*"],
};

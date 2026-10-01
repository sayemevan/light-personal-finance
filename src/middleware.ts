import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Route protection. Unauthenticated users are redirected to the sign-in page;
 * authenticated users hitting the sign-in page are sent to the dashboard.
 */
const PUBLIC_ROUTES = ["/sign-in"];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = Boolean(req.auth);
  const isPublic = PUBLIC_ROUTES.some((route) =>
    nextUrl.pathname.startsWith(route),
  );

  if (!isLoggedIn && !isPublic) {
    // API callers need a real 401, not a redirect to an HTML page: fetch would
    // follow it and treat the sign-in page as a successful response.
    if (nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "UNAUTHENTICATED", message: "You must be signed in." },
        },
        { status: 401 },
      );
    }
    const signInUrl = new URL("/sign-in", nextUrl);
    signInUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Run on everything except Next internals, static assets and the auth API.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

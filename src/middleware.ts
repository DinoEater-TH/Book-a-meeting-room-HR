import { NextResponse } from "next/server";
import { auth, googleAuthConfigured } from "@/lib/auth-next";

const PROTECTED_PREFIXES = ["/book", "/admin"];

export default auth((request) => {
  const { pathname } = request.nextUrl;

  // Local development without Google OAuth credentials: everything is open.
  if (!googleAuthConfigured) return NextResponse.next();

  const signedIn = Boolean(request.auth?.user);
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !signedIn) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (signedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/book", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:png|jpg|svg|ico)$).*)"],
};

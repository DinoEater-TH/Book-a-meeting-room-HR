import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "authjs.session-token";
const SECURE_SESSION_COOKIE = "__Secure-authjs.session-token";

/** Clears Auth.js session cookies (including chunked ones) and returns to login. */
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });

  for (const { name } of request.cookies.getAll()) {
    const isSessionCookie =
      name === SESSION_COOKIE ||
      name.startsWith(`${SESSION_COOKIE}.`) ||
      name === SECURE_SESSION_COOKIE ||
      name.startsWith(`${SECURE_SESSION_COOKIE}.`);
    if (!isSessionCookie) continue;

    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: name.startsWith("__Secure-"),
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}

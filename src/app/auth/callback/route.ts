import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth-next";

/** Legacy bookmark helper – Auth.js signs in through /api/auth/callback/google. */
export async function GET(request: NextRequest) {
  const session = await auth();
  const rawNext = request.nextUrl.searchParams.get("next") || "/book";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/book";

  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.redirect(new URL(next, request.url));
}

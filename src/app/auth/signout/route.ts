import { NextResponse, type NextRequest } from "next/server";
import { signOut } from "@/lib/auth-next";

export async function POST(request: NextRequest) {
  await signOut({ redirect: false });
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}

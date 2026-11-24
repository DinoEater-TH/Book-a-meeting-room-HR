import type { SessionUser } from "./types";
import { ALLOWED_EMAIL_DOMAIN } from "./config";
import { auth, googleAuthConfigured } from "./auth-next";

export { ALLOWED_EMAIL_DOMAIN };

export function authConfigured(): boolean {
  return googleAuthConfigured;
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = ALLOWED_EMAIL_DOMAIN.trim().toLowerCase();
  return email.trim().toLowerCase().endsWith(`@${domain}`);
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(email: string | null | undefined): boolean {
  const admins = adminEmails();
  if (admins.length === 0) return !authConfigured(); // dev mode: everyone is admin
  if (!email) return false;
  return admins.includes(email.trim().toLowerCase());
}

/**
 * Returns the signed-in Google user, or `null` when nobody is signed in.
 * Without OAuth credentials a stand-in user keeps local development usable.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  if (!authConfigured()) {
    return { email: "dev@kku.ac.th", name: "ผู้ใช้ทดลอง (โหมดพัฒนา)" };
  }

  const session = await auth();
  const email = session?.user?.email;
  if (!isAllowedEmail(email)) return null;

  return {
    email: email!,
    name: session?.user?.name?.trim() || email!.split("@")[0],
    avatarUrl: session?.user?.image ?? undefined,
  };
}

export class UnauthorizedError extends Error {
  constructor(message = "ต้องเข้าสู่ระบบก่อนใช้งาน") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

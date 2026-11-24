"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/config";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: `ต้องใช้บัญชี @${ALLOWED_EMAIL_DOMAIN} เท่านั้น กรุณาลองบัญชีอื่น`,
  OAuthSignin: "ไม่สามารถเชื่อมต่อ Google ได้ กรุณาลองใหม่",
  OAuthCallback: "เข้าสู่ระบบกับ Google ไม่สำเร็จ กรุณาลองใหม่",
  OAuthCreateAccount: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่",
  Configuration: "ยังตั้งค่าการเข้าสู่ระบบไม่เรียบร้อย กรุณาติดต่อผู้ดูแลระบบ",
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export default function LoginForm({ authEnabled }: { authEnabled: boolean }) {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const domain = searchParams.get("domain") || ALLOWED_EMAIL_DOMAIN;
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    setMessage(null);
    try {
      await signIn("google", { callbackUrl: "/book" });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setLoading(false);
    }
  }

  const shownError = error
    ? error === "domain"
      ? `ต้องใช้บัญชี @${domain} เท่านั้น กรุณาลองบัญชีอื่น`
      : ERROR_MESSAGES[error] || "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่"
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl text-white shadow-lg shadow-emerald-600/20">
            ห
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">ระบบจองห้องประชุม</h1>
          <p className="mt-1 text-sm text-slate-500">กองทรัพยากรบุคคล</p>
        </div>

        <div className="card p-7">
          <h2 className="text-lg font-semibold">เข้าสู่ระบบเพื่อจองห้อง</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            เฉพาะบัญชี Google ของมหาวิทยาลัย (<span className="font-medium text-slate-700">@{domain}</span>) เท่านั้นที่สามารถใช้งานระบบได้
          </p>

          {(shownError || message) && (
            <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {shownError || message}
            </div>
          )}

          {authEnabled ? (
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleMark />
              {loading ? "กำลังเชื่อมต่อ..." : "เข้าสู่ระบบด้วย Google"}
            </button>
          ) : (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">โหมดพัฒนา</p>
              <p className="mt-1">ยังไม่ได้ตั้งค่า Google Login จึงไม่ต้องล็อกอิน</p>
              <Link
                href="/book"
                className="mt-3 inline-flex rounded-lg bg-amber-900 px-4 py-2 font-medium text-white hover:bg-amber-800"
              >
                เข้าสู่ระบบทดลอง →
              </Link>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          ห้องประชุมกาลพฤกษ์ 10 · ห้อง SMART Meeting
        </p>
      </div>
    </main>
  );
}

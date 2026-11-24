import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import { googleAuthConfigured } from "@/lib/auth-next";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <LoginForm authEnabled={googleAuthConfigured} />
    </Suspense>
  );
}

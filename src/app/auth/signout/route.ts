import { signOut } from "@/lib/auth-next";

export async function POST() {
  // Let Auth.js write the expiring cookies and redirect itself.
  await signOut({ redirectTo: "/login" });
}

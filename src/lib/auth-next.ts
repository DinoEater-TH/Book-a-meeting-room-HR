import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { ALLOWED_EMAIL_DOMAIN } from "./config";

/**
 * Google sign-in handled directly by the app (Auth.js). No Supabase involved.
 * When the OAuth credentials are absent the app falls back to local dev mode.
 */
export const googleAuthConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  // A fallback keeps middleware happy in local dev before real credentials exist.
  secret: process.env.AUTH_SECRET || "temporary-dev-secret-not-for-production",
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          hd: ALLOWED_EMAIL_DOMAIN,
          prompt: "select_account",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    /** Server-side enforcement – `hd` in Google is only a hint to the account picker. */
    async signIn({ user }) {
      if (!googleAuthConfigured) return false;
      const email = user.email?.trim().toLowerCase();
      return Boolean(email && email.endsWith(`@${ALLOWED_EMAIL_DOMAIN.toLowerCase()}`));
    },
  },
});

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    /** True when the signed-in user granted Gmail send permission. */
    emailConnected?: boolean;
    user: DefaultSession["user"];
  }
}

import { getToken } from "next-auth/jwt";

type StoredToken = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

/** Reads the encrypted Auth.js cookie without exposing tokens to the browser. */
async function readJwt(req: Request): Promise<StoredToken | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  for (const secureCookie of [true, false]) {
    const cookieName = secureCookie
      ? "__Secure-authjs.session-token"
      : "authjs.session-token";
    const token = await getToken({
      req,
      secret,
      salt: cookieName,
      cookieName,
      secureCookie,
    });
    if (token) return token as StoredToken;
  }
  return null;
}

/** Returns a usable Gmail access token, refreshing an expired one if possible. */
export async function getGmailAccessToken(req: Request): Promise<string | null> {
  const stored = await readJwt(req);
  if (!stored?.accessToken) return null;

  if (!stored.expiresAt || stored.expiresAt * 1000 > Date.now() + 60_000) {
    return stored.accessToken;
  }
  if (!stored.refreshToken) return null;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        refresh_token: stored.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

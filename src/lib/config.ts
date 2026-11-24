/** Public, client-safe configuration. */
export const ALLOWED_EMAIL_DOMAIN = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN || "kku.ac.th";

/**
 * The spreadsheet ID is public (it appears in the sharing link / documentation),
 * so we keep a fallback here instead of storing it as a hosted env var.
 */
export const SPREADSHEET_ID =
  process.env.GOOGLE_SHEETS_ID ||
  "1IByz6Lg7pqOb1e_WOdW_tE05_GPgEJiPdMgKNDqHhsQ";

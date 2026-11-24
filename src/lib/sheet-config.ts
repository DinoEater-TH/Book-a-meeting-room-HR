import { google } from "googleapis";
import { SPREADSHEET_ID } from "./config";

const CONFIG_TAB = "_Config";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

/** Secrets are cached per server instance to avoid extra Sheets reads. */
const cache = new Map<string, string | null>();

function serviceAccountAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) return null;
  return new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: SCOPES,
  });
}

/**
 * Reads one cell from the hidden `_Config` tab.
 * Environment variables take priority when present.
 */
export async function getConfigCell(cell: string): Promise<string | null> {
  if (cache.has(cell)) return cache.get(cell) ?? null;

  const auth = serviceAccountAuth();
  if (!auth) return null;

  try {
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${CONFIG_TAB}'!${cell}`,
    });
    const value = String(res.data.values?.[0]?.[0] ?? "").trim() || null;
    cache.set(cell, value);
    return value;
  } catch (error) {
    console.error(`[sheet-config] ไม่สามารถอ่าน ${CONFIG_TAB}!${cell}`, error);
    return null;
  }
}

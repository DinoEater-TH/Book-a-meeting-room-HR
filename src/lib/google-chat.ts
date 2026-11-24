import { google } from "googleapis";
import { SPREADSHEET_ID } from "./config";

const CONFIG_TAB = "_Config";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

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
 * The Chat webhook is a secret, so it is kept outside the repository.
 * Hosted environments may provide it as GOOGLE_CHAT_WEBHOOK_URL; locally
 * (and on Netlify, where only five secrets are stored) it lives in a hidden
 * `_Config` tab of the same Google Sheet.
 */
export async function getGoogleChatWebhookUrl(): Promise<string | null> {
  const direct = process.env.GOOGLE_CHAT_WEBHOOK_URL?.trim();
  if (direct) return direct;

  const auth = serviceAccountAuth();
  if (!auth) return null;

  try {
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${CONFIG_TAB}'!A2`,
    });
    return String(res.data.values?.[0]?.[0] ?? "").trim() || null;
  } catch (error) {
    console.error("[google-chat] ไม่สามารถอ่าน webhook config ได้", error);
    return null;
  }
}

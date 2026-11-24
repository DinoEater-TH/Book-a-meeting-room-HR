import { google } from "googleapis";
import { SPREADSHEET_ID } from "./config";

const LOG_TAB = "_UsageLog";
const HEADER = ["timestamp", "email", "name", "action", "detail"];
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

export type UsageEntry = {
  email: string;
  name?: string;
  action: string;
  detail?: string;
};

export type UsageLogRow = {
  timestamp: string;
  email: string;
  name: string;
  action: string;
  detail: string;
};

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

type SheetsClient = ReturnType<typeof google.sheets>;

/** Avoid repeating metadata/header reads on every request. */
let logTabReady = false;

/** Creates the hidden log tab on first use and keeps its header up to date. */
async function ensureTab(sheets: SheetsClient): Promise<void> {
  if (logTabReady) return;
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties(sheetId,title,hidden)",
  });
  const existing = meta.data.sheets?.find((sheet) => sheet.properties?.title === LOG_TAB);
  const sheetId = existing?.properties?.sheetId;

  if (sheetId == null) {
    let created;
    try {
      created = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: LOG_TAB } } }] },
      });
    } catch (error) {
      // Another server instance may have created it at the same time.
      if (String(error).includes("already exists")) {
        logTabReady = true;
        return;
      }
      throw error;
    }
    const newId = created.data.replies?.[0]?.addSheet?.properties?.sheetId;
    if (newId == null) throw new Error("Cannot create usage log tab");
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${LOG_TAB}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId: newId, hidden: true },
              fields: "hidden",
            },
          },
        ],
      },
    });
    logTabReady = true;
    return;
  }

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${LOG_TAB}'!A1:E1`,
  });
  const current = (headerRes.data.values?.[0] ?? []).map((cell) => String(cell ?? ""));
  if (current.length !== HEADER.length || HEADER.some((column, index) => current[index] !== column)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${LOG_TAB}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
  }
  if (!existing?.properties?.hidden) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId, hidden: true },
              fields: "hidden",
            },
          },
        ],
      },
    });
  }
  logTabReady = true;
}

/** Best-effort audit entry. Failures are logged but never block the request. */
export async function logUsage(entry: UsageEntry): Promise<void> {
  const auth = serviceAccountAuth();
  if (!auth) return;
  try {
    const sheets = google.sheets({ version: "v4", auth });
    await ensureTab(sheets);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${LOG_TAB}'!A:E`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            new Date().toISOString(),
            entry.email,
            entry.name ?? "",
            entry.action,
            entry.detail ?? "",
          ],
        ],
      },
    });
  } catch (error) {
    console.error(
      "[usage-log] ไม่สามารถบันทึกประวัติการใช้งาน",
      error instanceof Error ? error.message : error,
    );
  }
}

/** Newest first. Only called from the admin-only page. */
export async function getUsageLogs(limit = 300): Promise<UsageLogRow[]> {
  const auth = serviceAccountAuth();
  if (!auth) return [];
  try {
    const sheets = google.sheets({ version: "v4", auth });
    await ensureTab(sheets);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${LOG_TAB}'!A2:E`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    return (res.data.values ?? [])
      .map((row) => ({
        timestamp: String(row[0] ?? ""),
        email: String(row[1] ?? ""),
        name: String(row[2] ?? ""),
        action: String(row[3] ?? ""),
        detail: String(row[4] ?? ""),
      }))
      .filter((row) => row.timestamp)
      .reverse()
      .slice(0, limit);
  } catch (error) {
    console.error(
      "[usage-log] ไม่สามารถอ่านประวัติการใช้งาน",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

/**
 * One-off migration of bookings that had a shaded time range in the old
 * monthly calendar tabs. Rows without a shaded range were intentionally
 * excluded from scripts/legacy-bookings.json.
 *
 *   node scripts/import-legacy.mjs --dry-run
 *   npm run import:legacy
 *
 * With Google Sheets credentials configured the rows are appended to the
 * "Bookings" tab. Without them they are merged into .data/bookings.json
 * (local development mode). Re-running is safe: existing ids are skipped.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Minimal .env.local loader – avoids an extra dependency for this script. */
async function loadLocalEnv() {
  try {
    const raw = await fs.readFile(path.join(root, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      let value = rawValue.trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // No .env.local – rely on the process environment.
  }
}

await loadLocalEnv();

const dryRun = process.argv.includes("--dry-run");
const seedPath = path.join(root, "scripts", "legacy-bookings.json");
const seed = JSON.parse(await fs.readFile(seedPath, "utf8"));

const IMPORTED_AT = "2026-11-24T00:00:00.000Z";
const bookings = seed.map((row, index) => ({
  id: `legacy_${String(index + 1).padStart(3, "0")}_${row.date}`,
  roomId: row.roomId,
  date: row.date,
  startHour: row.startHour,
  endHour: row.endHour,
  title: row.title,
  requesterName: row.requesterName || "-",
  requesterEmail: "legacy@imported.local",
  note: "",
  createdAt: IMPORTED_AT,
}));

const sheetId = process.env.GOOGLE_SHEETS_ID;
const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY;
const tabName = process.env.GOOGLE_SHEETS_TAB || "Bookings";
const useSheets = Boolean(sheetId && clientEmail && privateKey);

const header = [
  "id", "roomId", "date", "startHour", "endHour",
  "title", "requesterName", "requesterEmail", "note", "createdAt",
];

function toRow(booking) {
  return [
    booking.id, booking.roomId, booking.date,
    String(booking.startHour), String(booking.endHour),
    booking.title, booking.requesterName, booking.requesterEmail,
    booking.note, booking.createdAt,
  ];
}

async function importToSheets() {
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const quoted = `'${tabName.replace(/'/g, "''")}'`;

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  let existingTab = meta.data.sheets?.find((s) => s.properties?.title === tabName);

  if (!existingTab) {
    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    });
    existingTab = { properties: { sheetId: created.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0 } };
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${quoted}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [header] },
    });
  }

  const current = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${quoted}!A2:A`,
  });
  const ids = new Set((current.data.values ?? []).map((row) => String(row[0] ?? "")));
  const missing = bookings.filter((booking) => !ids.has(booking.id));

  if (missing.length && !dryRun) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${quoted}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: missing.map(toRow) },
    });
  }

  return { backend: `Google Sheets · ${tabName}`, inserted: missing.length, skipped: bookings.length - missing.length };
}

async function importToLocalFile() {
  const dataPath = path.join(root, ".data", "bookings.json");
  let existing = [];
  try {
    existing = JSON.parse(await fs.readFile(dataPath, "utf8"));
  } catch {
    // first run
  }
  const ids = new Set(existing.map((booking) => booking.id));
  const missing = bookings.filter((booking) => !ids.has(booking.id));

  if (missing.length && !dryRun) {
    await fs.mkdir(path.dirname(dataPath), { recursive: true });
    await fs.writeFile(dataPath, JSON.stringify([...existing, ...missing], null, 2), "utf8");
  }

  return { backend: "Local dev (.data/bookings.json)", inserted: missing.length, skipped: bookings.length - missing.length };
}

const result = useSheets ? await importToSheets() : await importToLocalFile();

console.log(`Legacy bookings: ${bookings.length}`);
console.log(`Date range: ${bookings[0].date} → ${bookings[bookings.length - 1].date}`);
console.log(`Backend: ${result.backend}`);
if (dryRun) {
  console.log(`DRY RUN – would insert ${result.inserted}, skip ${result.skipped}`);
} else {
  console.log(`Inserted: ${result.inserted}`);
  console.log(`Skipped (already exists): ${result.skipped}`);
}

/**
 * Creates/updates one readable monthly summary tab per month that has bookings.
 * The tab names start with "สรุป " so the original 14 calendar tabs are never
 * touched. Source of truth is the single `Bookings` tab.
 *
 *   npm run report:monthly -- --dry-run   # preview using .data/bookings.json
 *   npm run report:monthly                # create/refresh tabs in Google Sheets
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadLocalEnv() {
  try {
    const raw = await fs.readFile(path.join(root, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  } catch {
    // no .env.local
  }
}

await loadLocalEnv();

const dryRun = process.argv.includes("--dry-run");
const MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const ROOMS = [
  { id: "room10", name: "ห้องประชุมกาลพฤกษ์ 10" },
  { id: "smart", name: "ห้อง SMART Meeting" },
];
const HOURS = Array.from({ length: 10 }, (_, i) => 8 + i); // 08:00–17:00
const PINK = { red: 244 / 255, green: 204 / 255, blue: 204 / 255 };
const LIGHT_GRAY = { red: 217 / 255, green: 217 / 255, blue: 217 / 255 };

function monthLabel(isoDate) {
  const [year, month] = isoDate.split("-").map(Number);
  const shortYear = String((year + 543) % 100).padStart(2, "0");
  return { key: isoDate.slice(0, 7), name: `${MONTHS[month - 1]} ${shortYear}`, buddhistYear: year + 543 };
}

function readLocalBookings() {
  return fs.readFile(path.join(root, ".data", "bookings.json"), "utf8")
    .then((raw) => JSON.parse(raw))
    .catch(() => []);
}

async function readSheetBookings(sheets, spreadsheetId, tabName) {
  const quoted = `'${tabName.replace(/'/g, "''")}'`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoted}!A2:J`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return (res.data.values ?? []).map((row) => {
    const [id, roomId, date, startHour, endHour, title, requesterName, requesterEmail, note, createdAt] = row;
    if (!id || !date) return null;
    return {
      id, roomId, date,
      startHour: Number(startHour), endHour: Number(endHour),
      title, requesterName, requesterEmail, note, createdAt,
    };
  }).filter(Boolean);
}

function buildValues(monthBookings, label) {
  const values = [[`สรุปการจอง · ${label.name} · พ.ศ. ${label.buddhistYear}`]];
  const header = ["วันที่", "วัตถุประสงค์", ...HOURS.map((h) => `${String(h).padStart(2, "0")}:00`), "ผู้ขอใช้ห้อง", "หมายเหตุ"];
  const shadedCells = [];
  let cursor = 1; // next row index (0-based)

  for (const room of ROOMS) {
    values.push([]);
    values.push([room.name]);
    values.push(header);
    cursor += 3;
    const rows = monthBookings
      .filter((booking) => booking.roomId === room.id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour);

    for (const booking of rows) {
      const cells = Array(14).fill("");
      cells[0] = booking.date;
      cells[1] = booking.title || "";
      cells[12] = booking.requesterName || "";
      cells[13] = booking.note || "";
      for (const hour of HOURS) {
        if (hour >= booking.startHour && hour < booking.endHour) {
          cells[2 + (hour - 8)] = "●";
          shadedCells.push({ row: cursor, column: 2 + (hour - 8) });
        }
      }
      values.push(cells);
      cursor += 1;
    }
    if (rows.length === 0) {
      values.push(["ยังไม่มีการจอง"]);
      cursor += 1;
    }
  }

  return { values, shadedCells };
}

const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY;
const tabName = process.env.GOOGLE_SHEETS_TAB || "Bookings";
const useSheets = Boolean(spreadsheetId && clientEmail && privateKey);

if (!useSheets && !dryRun) {
  throw new Error("ต้องตั้งค่า GOOGLE_SHEETS_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY ก่อนสร้างแท็บจริง");
}

const bookings = useSheets
  ? await readSheetBookings(
      google.sheets({
        version: "v4",
        auth: new google.auth.JWT({
          email: clientEmail,
          key: privateKey.replace(/\\n/g, "\n"),
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        }),
      }),
      spreadsheetId,
      tabName,
    )
  : await readLocalBookings();

const groups = new Map();
for (const booking of bookings) {
  const label = monthLabel(booking.date);
  if (!groups.has(label.key)) groups.set(label.key, { label, bookings: [] });
  groups.get(label.key).bookings.push(booking);
}

console.log(`Bookings found: ${bookings.length}`);
console.log(`Months to summarise: ${groups.size}`);

if (dryRun) {
  for (const { label, bookings: list } of groups.values()) {
    console.log(`  สรุป ${label.name} (${list.length} รายการ)`);
  }
  console.log("DRY RUN – ไม่ได้สร้างแท็บจริง");
} else {
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  for (const { label, bookings: list } of groups.values()) {
    const title = `สรุป ${label.name}`;
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    const existing = meta.data.sheets?.find((sheet) => sheet.properties?.title === title);

    if (existing?.properties?.sheetId != null) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ deleteSheet: { sheetId: existing.properties.sheetId } }] },
      });
    }

    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    const sheetId = created.data.replies?.[0]?.addSheet?.properties?.sheetId;
    if (sheetId == null) throw new Error(`ไม่สามารถสร้างแท็บ ${title}`);

    const { values, shadedCells } = buildValues(list, label);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${title.replace(/'/g, "''")}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values },
    });

    const requests = [
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 14 },
          cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 12 } } },
          fields: "userEnteredFormat.textFormat",
        },
      },
    ];

    let offset = 1;
    for (const room of ROOMS) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: offset + 1, endRowIndex: offset + 2, startColumnIndex: 0, endColumnIndex: 14 },
          cell: { userEnteredFormat: { backgroundColor: LIGHT_GRAY, textFormat: { bold: true } } },
          fields: "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat",
        },
      });
      const roomRows = list.filter((booking) => booking.roomId === room.id).length;
      offset += 3 + Math.max(roomRows, 1);
    }

    for (const cell of shadedCells) {
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: cell.row,
            endRowIndex: cell.row + 1,
            startColumnIndex: cell.column,
            endColumnIndex: cell.column + 1,
          },
          cell: { userEnteredFormat: { backgroundColor: PINK } },
          fields: "userEnteredFormat.backgroundColor",
        },
      });
    }

    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    console.log(`สร้างแท็บแล้ว: ${title} (${list.length} รายการ)`);
  }
}

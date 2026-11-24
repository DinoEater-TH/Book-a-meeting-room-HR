import { google } from "googleapis";
import type { Booking, NewBooking } from "../types";
import {
  bookingToRow,
  newId,
  rowToBooking,
  SHEET_COLUMNS,
  sortBookings,
  type BookingStore,
} from "./provider";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

/**
 * Google Sheets backed store.
 *
 * The spreadsheet must be shared with the service account email as "Editor".
 * All bookings live in a single normalised tab (default: "Bookings") so that
 * concurrent reads/writes stay simple and conflict checks are cheap.
 */
export class GoogleSheetBookingStore implements BookingStore {
  readonly isMock = false;
  readonly backendName: string;

  private readonly spreadsheetId: string;
  private readonly tabName: string;
  private readonly sheets: ReturnType<typeof google.sheets>;
  private sheetIdCache: number | null = null;

  constructor() {
    this.spreadsheetId = requiredEnv("GOOGLE_SHEETS_ID");
    this.tabName = process.env.GOOGLE_SHEETS_TAB || "Bookings";
    this.backendName = `Google Sheets · ${this.tabName}`;

    const auth = new google.auth.JWT({
      email: requiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      key: requiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
      scopes: SCOPES,
    });

    this.sheets = google.sheets({ version: "v4", auth });
  }

  private get quotedTab(): string {
    return `'${this.tabName.replace(/'/g, "''")}'`;
  }

  /** Creates the bookings tab + header row the first time it is used. */
  private async ensureTab(): Promise<number> {
    if (this.sheetIdCache !== null) return this.sheetIdCache;

    const meta = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });

    const existing = meta.data.sheets?.find((s) => s.properties?.title === this.tabName);
    if (existing?.properties?.sheetId != null) {
      this.sheetIdCache = existing.properties.sheetId;
      return this.sheetIdCache;
    }

    const created = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: this.tabName } } }] },
    });

    const sheetId = created.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
    this.sheetIdCache = sheetId;

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.quotedTab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...SHEET_COLUMNS]] },
    });

    return sheetId;
  }

  async list(range?: { from: string; to: string }): Promise<Booking[]> {
    await this.ensureTab();

    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.quotedTab}!A2:J`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const rows = (res.data.values ?? []) as string[][];
    const bookings = rows
      .map((row) => rowToBooking(row.map((cell) => (cell == null ? "" : String(cell)))))
      .filter((b): b is Booking => b !== null);

    const filtered = range
      ? bookings.filter((b) => b.date >= range.from && b.date <= range.to)
      : bookings;

    return sortBookings(filtered);
  }

  private monthlyTitle(isoDate: string): string {
    const months = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
    ];
    const [year, month] = isoDate.split("-").map(Number);
    const shortYear = String((year + 543) % 100).padStart(2, "0");
    return `สรุป ${months[month - 1]} ${shortYear}`;
  }

  /** Rebuilds the human-readable summary tab for one month. Never touches legacy tabs. */
  private async refreshMonthlyTab(isoDate: string): Promise<void> {
    const title = this.monthlyTitle(isoDate);
    const monthPrefix = isoDate.slice(0, 7);
    const bookings = (await this.list()).filter((booking) => booking.date.startsWith(monthPrefix));
    const [year] = isoDate.split("-").map(Number);
    const hours = Array.from({ length: 10 }, (_, i) => 8 + i);
    const rooms = [
      { id: "room10" as const, name: "ห้องประชุมกาลพฤกษ์ 10" },
      { id: "smart" as const, name: "ห้อง SMART Meeting" },
    ];
    const values: string[][] = [[`สรุปการจอง · ${title.replace("สรุป ", "")} · พ.ศ. ${year + 543}`]];
    const header = ["วันที่", "วัตถุประสงค์", ...hours.map((h) => `${String(h).padStart(2, "0")}:00`), "ผู้ขอใช้ห้อง", "หมายเหตุ"];
    const shaded: Array<{ row: number; column: number }> = [];
    let cursor = 1;

    for (const room of rooms) {
      values.push([]);
      values.push([room.name]);
      values.push(header);
      cursor += 3;
      const rows = bookings
        .filter((booking) => booking.roomId === room.id)
        .sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour);
      for (const booking of rows) {
        const cells = Array(14).fill("");
        cells[0] = booking.date;
        cells[1] = booking.title;
        cells[12] = booking.requesterName;
        cells[13] = booking.note ?? "";
        for (const hour of hours) {
          if (hour >= booking.startHour && hour < booking.endHour) {
            const column = 2 + (hour - 8);
            cells[column] = "●";
            shaded.push({ row: cursor, column });
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

    const meta = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    const existing = meta.data.sheets?.find((sheet) => sheet.properties?.title === title);
    if (existing?.properties?.sheetId != null) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { requests: [{ deleteSheet: { sheetId: existing.properties.sheetId } }] },
      });
    }

    const created = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    const sheetId = created.data.replies?.[0]?.addSheet?.properties?.sheetId;
    if (sheetId == null) return;

    const escapedTitle = title.replace(/'/g, "''");
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `'${escapedTitle}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values },
    });

    const pink = { red: 244 / 255, green: 204 / 255, blue: 204 / 255 };
    const gray = { red: 217 / 255, green: 217 / 255, blue: 217 / 255 };
    const requests: object[] = [
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 14 },
          cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 12 } } },
          fields: "userEnteredFormat.textFormat",
        },
      },
    ];
    let offset = 1;
    for (const room of rooms) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: offset + 1, endRowIndex: offset + 2, startColumnIndex: 0, endColumnIndex: 14 },
          cell: { userEnteredFormat: { backgroundColor: gray, textFormat: { bold: true } } },
          fields: "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat",
        },
      });
      const count = bookings.filter((booking) => booking.roomId === room.id).length;
      offset += 3 + Math.max(count, 1);
    }
    for (const cell of shaded) {
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: cell.row,
            endRowIndex: cell.row + 1,
            startColumnIndex: cell.column,
            endColumnIndex: cell.column + 1,
          },
          cell: { userEnteredFormat: { backgroundColor: pink } },
          fields: "userEnteredFormat.backgroundColor",
        },
      });
    }
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { requests },
    });
  }

  private async safeRefresh(isoDate: string): Promise<void> {
    try {
      await this.refreshMonthlyTab(isoDate);
    } catch (error) {
      console.error(`[sheets] ไม่สามารถสร้างแท็บสรุป ${isoDate}`, error);
    }
  }

  async create(input: NewBooking): Promise<Booking> {
    await this.ensureTab();

    const booking: Booking = {
      ...input,
      id: newId(),
      createdAt: new Date().toISOString(),
    };

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.quotedTab}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [bookingToRow(booking)] },
    });

    await this.safeRefresh(booking.date);
    return booking;
  }

  async update(id: string, patch: Parameters<BookingStore["update"]>[1]): Promise<Booking | null> {
    await this.ensureTab();

    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.quotedTab}!A2:J`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const rows = (res.data.values ?? []) as string[][];
    const offset = rows.findIndex((row) => String(row[0] ?? "") === id);
    if (offset === -1) return null;

    const existing = rowToBooking(rows[offset].map((cell) => (cell == null ? "" : String(cell))));
    if (!existing) return null;

    const updated: Booking = { ...existing, ...patch, note: patch.note || undefined };
    const rowNumber = offset + 2; // +1 for header, +1 for 1-based rows

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.quotedTab}!A${rowNumber}:J${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [bookingToRow(updated)] },
    });

    await this.safeRefresh(existing.date);
    if (updated.date !== existing.date) await this.safeRefresh(updated.date);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const sheetId = await this.ensureTab();

    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.quotedTab}!A2:A`,
    });

    const ids = ((res.data.values ?? []) as string[][]).map((row) => String(row[0] ?? ""));
    const offset = ids.findIndex((value) => value === id);
    if (offset === -1) return;

    const removedDate = String(res.data.values?.[offset]?.[2] ?? "");

    // +1 for the header row
    const rowIndex = offset + 1;

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });

    if (removedDate) await this.safeRefresh(removedDate);
  }
}

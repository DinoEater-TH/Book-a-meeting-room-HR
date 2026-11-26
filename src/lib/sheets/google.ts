import { google } from "googleapis";
import { SPREADSHEET_ID } from "../config";
import { THAI_MONTHS } from "../dates";
import { CLOSE_HOUR, OPEN_HOUR, type Booking, type NewBooking } from "../types";
import {
  bookingToRow,
  newId,
  rowToBooking,
  SHEET_COLUMNS,
  sortBookings,
  type BookingStore,
} from "./provider";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

/** Marker row used to find and rebuild our own block inside a legacy tab. */
const LEGACY_BLOCK_HEADER = "การจองจากแอป";
/** Legacy tabs only render 08:00–17:00; we extend the app block to 24:00. */
const LEGACY_HOURS = Array.from(
  { length: CLOSE_HOUR - OPEN_HOUR },
  (_, index) => OPEN_HOUR + index,
);
const LEGACY_LAST_COLUMN = 2 + LEGACY_HOURS.length + 3; // date, title, hours, requester, id, note
const LEGACY_PINK = { red: 244 / 255, green: 204 / 255, blue: 204 / 255 };
const LEGACY_GRAY = { red: 217 / 255, green: 217 / 255, blue: 217 / 255 };
const LEGACY_WHITE = { red: 1, green: 1, blue: 1 };

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
 * concurrent reads/writes stay simple and conflict checks are cheap. A readable
 * copy is mirrored into the original monthly tabs (created when missing) so
 * the legacy sheets stay useful alongside the app.
 */
export class GoogleSheetBookingStore implements BookingStore {
  readonly isMock = false;
  readonly backendName: string;

  private readonly spreadsheetId: string;
  private readonly tabName: string;
  private readonly sheets: ReturnType<typeof google.sheets>;
  private sheetIdCache: number | null = null;

  constructor() {
    this.spreadsheetId = SPREADSHEET_ID;
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
      // Older sheets only had 10 columns. Extend the header so new request
      // columns are labelled without touching any existing booking rows.
      const headerRes = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.quotedTab}!A1:O1`,
      });
      const currentHeader = (headerRes.data.values?.[0] ?? []).map((cell) => String(cell ?? ""));
      if (
        currentHeader.length < SHEET_COLUMNS.length ||
        SHEET_COLUMNS.some((column, index) => currentHeader[index] !== column)
      ) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.quotedTab}!A1`,
          valueInputOption: "RAW",
          requestBody: { values: [[...SHEET_COLUMNS]] },
        });
      }
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
      range: `${this.quotedTab}!A2:O`,
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
    const [year, month] = isoDate.split("-").map(Number);
    const shortYear = String((year + 543) % 100).padStart(2, "0");
    return `สรุป ${THAI_MONTHS[month - 1]} ${shortYear}`;
  }

  /**
   * Existing legacy tabs use several year formats (full B.E., short B.E., or
   * no year at all). Match them after collapsing repeated spaces.
   */
  private legacyTitleVariants(isoDate: string): string[] {
    const [year, month] = isoDate.split("-").map(Number);
    const name = THAI_MONTHS[month - 1] ?? "";
    if (!name) return [];
    const shortYear = String((year + 543) % 100).padStart(2, "0");
    return [`${name} ${year + 543}`, `${name} ${shortYear}`, name];
  }

  private static normalizeSheetTitle(title: string): string {
    return title.replace(/\s+/g, " ").trim();
  }

  private async ensureLegacySheet(isoDate: string): Promise<{ sheetId: number; title: string }> {
    const variants = this.legacyTitleVariants(isoDate);
    if (variants.length === 0) throw new Error(`Invalid month in date: ${isoDate}`);

    const meta = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    const sheets = meta.data.sheets ?? [];

    for (const variant of variants) {
      const wanted = GoogleSheetBookingStore.normalizeSheetTitle(variant);
      const found = sheets.find(
        (sheet) =>
          sheet.properties?.title &&
          GoogleSheetBookingStore.normalizeSheetTitle(sheet.properties.title) === wanted,
      );
      const foundTitle = found?.properties?.title;
      if (found?.properties?.sheetId != null && foundTitle) {
        return { sheetId: found.properties.sheetId, title: foundTitle };
      }
    }

    const title = variants[0];
    const created = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    const sheetId = created.data.replies?.[0]?.addSheet?.properties?.sheetId;
    if (sheetId == null) throw new Error(`Could not create legacy tab: ${title}`);
    return { sheetId, title };
  }

  private legacyDateLabel(isoDate: string): string {
    const [year, month, day] = isoDate.split("-").map(Number);
    return `${day} ${THAI_MONTHS[month - 1] ?? ""} ${year + 543}`;
  }

  /**
   * Mirrors every booking for one month into the original monthly tab. The
   * app-owned block is rebuilt from `Bookings` each time, so edits and deletes
   * clean up their own shading without touching the staff's older rows above.
   * Bookings that touch two hours (e.g. 09:01–10:53) shade both hour columns.
   */
  private async syncLegacyMonth(isoDate: string): Promise<void> {
    const { sheetId, title } = await this.ensureLegacySheet(isoDate);
    const escapedTitle = title.replace(/'/g, "''");
    const tab = `'${escapedTitle}'`;

    const current = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${tab}!A1:U`,
    });
    const values = (current.data.values ?? []) as string[][];
    const markerIndex = values.findIndex(
      (row) => String(row[0] ?? "").trim() === LEGACY_BLOCK_HEADER,
    );
    const startRow =
      markerIndex >= 0 ? markerIndex : values.length === 0 ? 0 : values.length + 1;

    if (markerIndex >= 0) {
      const endRow = Math.max(values.length, markerIndex + 1);
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: `${tab}!A${markerIndex + 1}:U${endRow}`,
      });
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: markerIndex,
                  endRowIndex: endRow,
                  startColumnIndex: 0,
                  endColumnIndex: LEGACY_LAST_COLUMN,
                },
                cell: { userEnteredFormat: { backgroundColor: LEGACY_WHITE } },
                fields: "userEnteredFormat.backgroundColor",
              },
            },
          ],
        },
      });
    }

    const monthPrefix = isoDate.slice(0, 7);
    const bookings = (await this.list())
      .filter((booking) => booking.date.startsWith(monthPrefix))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.startHour - b.startHour ||
          a.roomId.localeCompare(b.roomId),
      );

    const rows: string[][] = [
      [LEGACY_BLOCK_HEADER],
      [
        "วันที่",
        "วัตถุประสงค์",
        ...LEGACY_HOURS.map((hour) => `${String(hour).padStart(2, "0")}:00`),
        "ผู้ขอใช้ห้อง",
        "รหัสจอง",
        "หมายเหตุ",
      ],
    ];
    if (bookings.length === 0) rows.push(["ยังไม่มีการจองจากแอป"]);

    const shaded: Array<{ row: number; column: number }> = [];
    bookings.forEach((booking, index) => {
      const cells = Array(LEGACY_LAST_COLUMN).fill("");
      cells[0] = this.legacyDateLabel(booking.date);
      cells[1] = booking.title;
      cells[LEGACY_LAST_COLUMN - 3] = booking.requesterName || booking.requesterEmail;
      cells[LEGACY_LAST_COLUMN - 2] = booking.id;
      cells[LEGACY_LAST_COLUMN - 1] = booking.note ?? "";

      const firstHour = Math.max(OPEN_HOUR, Math.floor(booking.startHour));
      const lastHour = Math.min(CLOSE_HOUR, Math.ceil(booking.endHour));
      for (let hour = firstHour; hour < lastHour; hour += 1) {
        const column = 2 + (hour - OPEN_HOUR);
        cells[column] = "●";
        shaded.push({ row: startRow + 2 + index, column });
      }
      rows.push(cells);
    });

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${tab}!A${startRow + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });

    const headerRequests: object[] = [
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: startRow,
            endRowIndex: startRow + 2,
            startColumnIndex: 0,
            endColumnIndex: LEGACY_LAST_COLUMN,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: LEGACY_GRAY,
              textFormat: { bold: true },
            },
          },
          fields: "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat",
        },
      },
    ];
    for (const cell of shaded) {
      headerRequests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: cell.row,
            endRowIndex: cell.row + 1,
            startColumnIndex: cell.column,
            endColumnIndex: cell.column + 1,
          },
          cell: { userEnteredFormat: { backgroundColor: LEGACY_PINK } },
          fields: "userEnteredFormat.backgroundColor",
        },
      });
    }
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { requests: headerRequests },
    });
  }

  /** Rebuilds the human-readable `สรุป ...` summary tab for one month. */
  private async refreshMonthlyTab(isoDate: string): Promise<void> {
    const title = this.monthlyTitle(isoDate);
    const monthPrefix = isoDate.slice(0, 7);
    const bookings = (await this.list()).filter((booking) => booking.date.startsWith(monthPrefix));
    const [year] = isoDate.split("-").map(Number);
    const hours = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i);
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
        const cells = Array(2 + hours.length + 2).fill("");
        cells[0] = booking.date;
        cells[1] = booking.title;
        cells[cells.length - 2] = booking.requesterName;
        cells[cells.length - 1] = booking.note ?? "";
        for (const hour of hours) {
          // A 30-minute booking still shades the hours it touches.
          if (booking.startHour < hour + 1 && booking.endHour > hour) {
            const column = 2 + (hour - OPEN_HOUR);
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

  private async safeSyncLegacy(isoDate: string): Promise<void> {
    try {
      await this.syncLegacyMonth(isoDate);
    } catch (error) {
      console.error(`[sheets] ไม่สามารถซิงค์ข้อมูลไปแท็บเดิม ${isoDate}`, error);
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
    await this.safeSyncLegacy(booking.date);
    return booking;
  }

  async update(id: string, patch: Parameters<BookingStore["update"]>[1]): Promise<Booking | null> {
    await this.ensureTab();

    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.quotedTab}!A2:O`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const rows = (res.data.values ?? []) as string[][];
    const offset = rows.findIndex((row) => String(row[0] ?? "") === id);
    if (offset === -1) return null;

    const existing = rowToBooking(rows[offset].map((cell) => (cell == null ? "" : String(cell))));
    if (!existing) return null;

    const updated: Booking = {
      ...existing,
      ...patch,
      note: patch.note || undefined,
      equipmentNote: (patch.equipmentNote ?? existing.equipmentNote) || undefined,
      onlineLinkNote: (patch.onlineLinkNote ?? existing.onlineLinkNote) || undefined,
      meetingLink: (patch.meetingLink ?? existing.meetingLink) || undefined,
    };
    const rowNumber = offset + 2; // +1 for header, +1 for 1-based rows

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.quotedTab}!A${rowNumber}:O${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [bookingToRow(updated)] },
    });

    await this.safeRefresh(existing.date);
    await this.safeSyncLegacy(existing.date);
    if (updated.date !== existing.date) {
      await this.safeRefresh(updated.date);
      await this.safeSyncLegacy(updated.date);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const sheetId = await this.ensureTab();

    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.quotedTab}!A2:O`,
    });

    const rows = (res.data.values ?? []) as string[][];
    const offset = rows.findIndex((row) => String(row[0] ?? "") === id);
    if (offset === -1) return;

    const removedDate = String(rows[offset]?.[2] ?? "");

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

    if (removedDate) {
      await this.safeRefresh(removedDate);
      await this.safeSyncLegacy(removedDate);
    }
  }
}

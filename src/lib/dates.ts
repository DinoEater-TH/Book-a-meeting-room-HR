export const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

export const THAI_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

export const THAI_WEEKDAYS = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
];

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Local-time ISO date (no UTC shifting). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses "YYYY-MM-DD" as local noon to avoid DST/UTC edge cases. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** The app is used in Thailand; never rely on the host machine's time zone. */
const THAILAND_TIME_ZONE = "Asia/Bangkok";

export function bangkokNow(): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: THAILAND_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const hour = Number(part("hour"));
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    hour: Number.isFinite(hour) ? hour : 0,
  };
}

export function todayISO(): string {
  return bangkokNow().date;
}

/** True when a slot's start hour has already begun in Thailand. */
export function isPastSlot(date: string, startHour: number): boolean {
  if (!isISODate(date)) return false;
  const now = bangkokNow();
  if (date < now.date) return true;
  if (date > now.date) return false;
  return startHour <= now.hour;
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function addMonths(iso: string, months: number): string {
  const date = parseISODate(iso);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return toISODate(date);
}

/** Monday-first week start. */
export function startOfWeek(iso: string): string {
  const date = parseISODate(iso);
  const dow = date.getDay(); // 0 = Sunday
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(iso, diff);
}

export function monthRange(iso: string): { from: string; to: string } {
  const date = parseISODate(iso);
  const from = toISODate(new Date(date.getFullYear(), date.getMonth(), 1));
  const to = toISODate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  return { from, to };
}

export function buddhistYear(iso: string): number {
  return parseISODate(iso).getFullYear() + 543;
}

export function formatThaiDate(iso: string, opts: { weekday?: boolean; short?: boolean } = {}): string {
  const date = parseISODate(iso);
  const day = date.getDate();
  const month = opts.short ? THAI_MONTHS_SHORT[date.getMonth()] : THAI_MONTHS[date.getMonth()];
  const year = date.getFullYear() + 543;
  const base = opts.short ? `${day} ${month} ${String(year).slice(-2)}` : `${day} ${month} ${year}`;
  if (opts.weekday) return `วัน${THAI_WEEKDAYS[date.getDay()]}ที่ ${base}`;
  return base;
}

export function formatThaiMonthYear(iso: string): string {
  const date = parseISODate(iso);
  return `${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
}

export function weekdayName(iso: string): string {
  return THAI_WEEKDAYS[parseISODate(iso).getDay()];
}

export function relativeDayLabel(iso: string): string | null {
  const today = todayISO();
  if (iso === today) return "วันนี้";
  if (iso === addDays(today, 1)) return "พรุ่งนี้";
  if (iso === addDays(today, -1)) return "เมื่อวาน";
  return null;
}

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function rangeLabel(startHour: number, endHour: number): string {
  return `${hourLabel(startHour)} – ${hourLabel(endHour)}`;
}

export function isWeekend(iso: string): boolean {
  const dow = parseISODate(iso).getDay();
  return dow === 0 || dow === 6;
}

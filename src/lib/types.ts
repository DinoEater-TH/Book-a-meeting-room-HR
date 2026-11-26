export type RoomId = "room10" | "smart";

export type Booking = {
  id: string;
  roomId: RoomId;
  /** ISO date, e.g. "2026-11-24" */
  date: string;
  /** Start time in hours; 9.5 means 09:30. Range 8..23.5 */
  startHour: number;
  /** End time (exclusive) in hours; 24 means 24:00 */
  endHour: number;
  /** วัตถุประสงค์การใช้ห้อง */
  title: string;
  requesterName: string;
  requesterEmail: string;
  note?: string;
  /** ความช่วยเหลือเพิ่มเติมสำหรับการประชุม */
  needsEquipment?: boolean;
  equipmentNote?: string;
  /** ต้องการเจ้าหน้าที่ดูแลการประชุม (ใช้คอลัมน์เดิม needsOnlineLink ใน Sheets) */
  needsOnlineLink?: boolean;
  /** รายละเอียดที่ต้องการให้เจ้าหน้าที่ดูแล (คอลัมน์เดิม onlineLinkNote) */
  onlineLinkNote?: string;
  /** ลิงก์ประชุมที่ผู้ดูแลระบบเป็นคนใส่ให้ (เฉพาะ pongka@kku.ac.th) */
  meetingLink?: string;
  /** ISO timestamp */
  createdAt: string;
};

export type NewBooking = Omit<Booking, "id" | "createdAt" | "requesterName" | "requesterEmail"> & {
  requesterName: string;
  requesterEmail: string;
};

/** Fields a user (or admin) is allowed to change on an existing booking. */
export type BookingEditFields = Pick<
  Booking,
  "roomId" | "date" | "startHour" | "endHour" | "title"
> & {
  note?: string;
  needsEquipment?: boolean;
  equipmentNote?: string;
  /** ต้องการเจ้าหน้าที่ดูแลการประชุม (ใช้คอลัมน์เดิม needsOnlineLink ใน Sheets) */
  needsOnlineLink?: boolean;
  /** รายละเอียดที่ต้องการให้เจ้าหน้าที่ดูแล (คอลัมน์เดิม onlineLinkNote) */
  onlineLinkNote?: string;
  meetingLink?: string;
};

export type SessionUser = {
  email: string;
  name: string;
  avatarUrl?: string;
  /** ผู้ใช้ให้สิทธิ์ส่งอีเมลผ่าน Gmail แล้วหรือไม่ */
  emailConnected?: boolean;
};

export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 24;
/** Bookings can start or end every 30 minutes. */
export const SLOT_STEP = 0.5;

/** Every 30-minute start time from 08:00 to 23:30. */
export const SLOT_HOURS: number[] = Array.from(
  { length: Math.round((CLOSE_HOUR - OPEN_HOUR) / SLOT_STEP) },
  (_, i) => OPEN_HOUR + i * SLOT_STEP,
);

/** Hour rows drawn in the day timeline; each row holds two 30-minute slots. */
export const HOUR_ROWS: number[] = Array.from(
  { length: CLOSE_HOUR - OPEN_HOUR },
  (_, i) => OPEN_HOUR + i,
);

function isSlotTime(value: number): boolean {
  return (
    Number.isFinite(value) &&
    Math.abs(value / SLOT_STEP - Math.round(value / SLOT_STEP)) < 1e-9
  );
}

export function isValidSlotRange(startHour: number, endHour: number): boolean {
  return (
    isSlotTime(startHour) &&
    isSlotTime(endHour) &&
    startHour >= OPEN_HOUR &&
    endHour <= CLOSE_HOUR &&
    endHour > startHour
  );
}

export function overlaps(
  a: { date: string; startHour: number; endHour: number; roomId: RoomId },
  b: { date: string; startHour: number; endHour: number; roomId: RoomId },
): boolean {
  return (
    a.roomId === b.roomId &&
    a.date === b.date &&
    a.startHour < b.endHour &&
    b.startHour < a.endHour
  );
}

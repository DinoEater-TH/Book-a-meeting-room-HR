import type { Booking, NewBooking, RoomId } from "./types";
import { isISODate } from "./dates";
import { isRoomId } from "./rooms";
import { isValidSlotRange } from "./types";

export type ParsedBookingInput = {
  roomId: RoomId;
  date: string;
  startHour: number;
  endHour: number;
  title: string;
  note?: string;
  needsEquipment: boolean;
  equipmentNote?: string;
  needsOnlineLink: boolean;
  onlineLinkNote?: string;
  meetingLink?: string;
};

export type ParseResult =
  | { ok: true; value: ParsedBookingInput }
  | { ok: false; error: string };

const MAX_TITLE = 200;
const MAX_NOTE = 500;

/** Email placeholder used by the one-time legacy import. */
export const LEGACY_EMAIL = "legacy@imported.local";

/** Imported placeholder email — these rows have no sign-in owner. */
export function isLegacyBooking(booking: Pick<Booking, "requesterEmail">): boolean {
  return booking.requesterEmail.trim().toLowerCase() === LEGACY_EMAIL;
}

/** Rows where the requester did not provide their own name. */
export function isUnnamedBooking(booking: Pick<Booking, "requesterName">): boolean {
  return !booking.requesterName.trim();
}

function parseYesNo(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    return ["true", "yes", "1", "ต้องการ"].includes(value.trim().toLowerCase());
  }
  return false;
}


export function parseBookingInput(body: unknown): ParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  }

  const raw = body as Record<string, unknown>;

  const roomId = typeof raw.roomId === "string" ? raw.roomId : "";
  if (!isRoomId(roomId)) return { ok: false, error: "ไม่พบห้องประชุมที่เลือก" };

  const date = typeof raw.date === "string" ? raw.date : "";
  if (!isISODate(date)) return { ok: false, error: "รูปแบบวันที่ไม่ถูกต้อง" };

  const startHour = Number(raw.startHour);
  const endHour = Number(raw.endHour);
  if (!isValidSlotRange(startHour, endHour)) {
    return { ok: false, error: "ช่วงเวลาไม่ถูกต้อง (08:00 – 24:00)" };
  }

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return { ok: false, error: "กรุณากรอกวัตถุประสงค์การใช้ห้อง" };
  if (title.length > MAX_TITLE) return { ok: false, error: "วัตถุประสงค์ยาวเกินไป" };

  const note = typeof raw.note === "string" ? raw.note.trim() : "";
  if (note.length > MAX_NOTE) return { ok: false, error: "หมายเหตุยาวเกินไป" };

  const needsEquipment = parseYesNo(raw.needsEquipment);
  const equipmentNote = typeof raw.equipmentNote === "string" ? raw.equipmentNote.trim() : "";
  if (equipmentNote.length > MAX_NOTE) return { ok: false, error: "รายละเอียดอุปกรณ์ยาวเกินไป" };

  const needsOnlineLink = parseYesNo(raw.needsOnlineLink);
  const onlineLinkNote = typeof raw.onlineLinkNote === "string" ? raw.onlineLinkNote.trim() : "";
  if (onlineLinkNote.length > MAX_NOTE) return { ok: false, error: "รายละเอียดลิงก์ประชุมออนไลน์ยาวเกินไป" };

  const meetingLink = typeof raw.meetingLink === "string" ? raw.meetingLink.trim() : "";
  if (meetingLink.length > MAX_NOTE) return { ok: false, error: "ลิงก์ประชุมยาวเกินไป" };
  if (meetingLink) {
    try {
      const url = new URL(meetingLink);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("bad protocol");
    } catch {
      return { ok: false, error: "ลิงก์ประชุมต้องเป็น URL ที่เริ่มด้วย http:// หรือ https://" };
    }
  }

  return {
    ok: true,
    value: {
      roomId,
      date,
      startHour,
      endHour,
      title,
      note: note || undefined,
      needsEquipment,
      equipmentNote: needsEquipment ? equipmentNote || undefined : undefined,
      needsOnlineLink,
      onlineLinkNote: needsOnlineLink ? onlineLinkNote || undefined : undefined,
      meetingLink: meetingLink || undefined,
    },
  };
}

export function toNewBooking(
  input: ParsedBookingInput,
  requester: { name: string; email: string },
): NewBooking {
  return {
    ...input,
    requesterName: requester.name,
    requesterEmail: requester.email,
  };
}

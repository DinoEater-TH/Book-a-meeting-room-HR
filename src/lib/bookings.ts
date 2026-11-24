import type { NewBooking, RoomId } from "./types";
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
};

export type ParseResult =
  | { ok: true; value: ParsedBookingInput }
  | { ok: false; error: string };

const MAX_TITLE = 200;
const MAX_NOTE = 500;

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
    return { ok: false, error: "ช่วงเวลาไม่ถูกต้อง (08:00 – 18:00)" };
  }

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return { ok: false, error: "กรุณากรอกวัตถุประสงค์การใช้ห้อง" };
  if (title.length > MAX_TITLE) return { ok: false, error: "วัตถุประสงค์ยาวเกินไป" };

  const note = typeof raw.note === "string" ? raw.note.trim() : "";
  if (note.length > MAX_NOTE) return { ok: false, error: "หมายเหตุยาวเกินไป" };

  return {
    ok: true,
    value: {
      roomId,
      date,
      startHour,
      endHour,
      title,
      note: note || undefined,
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

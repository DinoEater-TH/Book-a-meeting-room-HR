import type { Booking, BookingEditFields, NewBooking } from "../types";

export interface BookingStore {
  /** true when data is not persisted to Google Sheets (local dev fallback) */
  readonly isMock: boolean;
  list(range?: { from: string; to: string }): Promise<Booking[]>;
  create(input: NewBooking): Promise<Booking>;
  /** Edit the booking's details while keeping its owner and id. */
  update(id: string, patch: BookingEditFields): Promise<Booking | null>;
  remove(id: string): Promise<void>;
  /** Human readable name of where data is stored */
  readonly backendName: string;
}

export const SHEET_COLUMNS = [
  "id",
  "roomId",
  "date",
  "startHour",
  "endHour",
  "title",
  "requesterName",
  "requesterEmail",
  "note",
  "createdAt",
  "needsEquipment",
  "equipmentNote",
  "needsOnlineLink",
  "onlineLinkNote",
  "meetingLink",
] as const;

function parseBool(value: string | undefined): boolean {
  return String(value ?? "").trim().toLowerCase() === "true";
}

export function rowToBooking(row: string[]): Booking | null {
  const [
    id, roomId, date, startHour, endHour, title, requesterName, requesterEmail,
    note, createdAt, needsEquipment, equipmentNote, needsOnlineLink, onlineLinkNote,
    meetingLink,
  ] = row;
  if (!id || !roomId || !date) return null;
  const start = Number(startHour);
  const end = Number(endHour);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return {
    id,
    roomId: roomId as Booking["roomId"],
    date,
    startHour: start,
    endHour: end,
    title: title ?? "",
    requesterName: requesterName ?? "",
    requesterEmail: requesterEmail ?? "",
    note: note || undefined,
    createdAt: createdAt || new Date().toISOString(),
    needsEquipment: parseBool(needsEquipment),
    equipmentNote: equipmentNote || undefined,
    needsOnlineLink: parseBool(needsOnlineLink),
    onlineLinkNote: onlineLinkNote || undefined,
    meetingLink: meetingLink || undefined,
  };
}

export function bookingToRow(booking: Booking): string[] {
  return [
    booking.id,
    booking.roomId,
    booking.date,
    String(booking.startHour),
    String(booking.endHour),
    booking.title,
    booking.requesterName,
    booking.requesterEmail,
    booking.note ?? "",
    booking.createdAt,
    String(Boolean(booking.needsEquipment)),
    booking.equipmentNote ?? "",
    String(Boolean(booking.needsOnlineLink)),
    booking.onlineLinkNote ?? "",
    booking.meetingLink ?? "",
  ];
}

export function newId(): string {
  return `bk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function sortBookings(bookings: Booking[]): Booking[] {
  return [...bookings].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.roomId !== b.roomId) return a.roomId < b.roomId ? -1 : 1;
    return a.startHour - b.startHour;
  });
}

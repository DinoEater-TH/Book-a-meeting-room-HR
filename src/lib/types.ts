export type RoomId = "room10" | "smart";

export type Booking = {
  id: string;
  roomId: RoomId;
  /** ISO date, e.g. "2026-11-24" */
  date: string;
  /** Start hour in 24h format, 8..17 */
  startHour: number;
  /** End hour (exclusive), 9..18 */
  endHour: number;
  /** วัตถุประสงค์การใช้ห้อง */
  title: string;
  requesterName: string;
  requesterEmail: string;
  note?: string;
  /** ISO timestamp */
  createdAt: string;
};

export type NewBooking = Omit<Booking, "id" | "createdAt" | "requesterName" | "requesterEmail"> & {
  requesterName: string;
  requesterEmail: string;
};

export type SessionUser = {
  email: string;
  name: string;
  avatarUrl?: string;
};

export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 18;

/** Hours that can start a booking: 8:00 - 17:00 */
export const SLOT_HOURS: number[] = Array.from(
  { length: CLOSE_HOUR - OPEN_HOUR },
  (_, i) => OPEN_HOUR + i,
);

export function isValidSlotRange(startHour: number, endHour: number): boolean {
  return (
    Number.isInteger(startHour) &&
    Number.isInteger(endHour) &&
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

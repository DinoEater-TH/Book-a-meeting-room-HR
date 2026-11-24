import { promises as fs } from "node:fs";
import path from "node:path";
import type { Booking, NewBooking } from "../types";
import { newId, sortBookings, type BookingStore } from "./provider";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "bookings.json");

async function readAll(): Promise<Booking[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(bookings: Booking[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(bookings, null, 2), "utf8");
}

/**
 * Local-development store. Data lives in `.data/bookings.json`
 * and is intentionally git-ignored.
 */
export class MockBookingStore implements BookingStore {
  readonly isMock = true;
  readonly backendName = "ไฟล์ทดลอง (.data/bookings.json)";

  async list(range?: { from: string; to: string }): Promise<Booking[]> {
    const all = await readAll();
    const filtered = range
      ? all.filter((b) => b.date >= range.from && b.date <= range.to)
      : all;
    return sortBookings(filtered);
  }

  async create(input: NewBooking): Promise<Booking> {
    const all = await readAll();
    const booking: Booking = {
      ...input,
      id: newId(),
      createdAt: new Date().toISOString(),
    };
    all.push(booking);
    await writeAll(all);
    return booking;
  }

  async update(id: string, patch: Parameters<BookingStore["update"]>[1]): Promise<Booking | null> {
    const all = await readAll();
    const index = all.findIndex((booking) => booking.id === id);
    if (index === -1) return null;
    const updated: Booking = { ...all[index], ...patch, note: patch.note || undefined };
    all[index] = updated;
    await writeAll(all);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const all = await readAll();
    await writeAll(all.filter((b) => b.id !== id));
  }
}

import { GoogleSheetBookingStore } from "./google";
import { MockBookingStore } from "./mock";
import type { BookingStore } from "./provider";

export type { BookingStore } from "./provider";

let store: BookingStore | null = null;

export function sheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEETS_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY,
  );
}

export function getBookingStore(): BookingStore {
  if (store) return store;
  store = sheetsConfigured() ? new GoogleSheetBookingStore() : new MockBookingStore();
  return store;
}

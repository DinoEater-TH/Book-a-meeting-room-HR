/**
 * Soft, high-contrast pastel palettes used to distinguish bookings by the
 * requester's email. Class names are literal strings so Tailwind keeps them.
 */
export type BookingPalette = {
  border: string;
  bg: string;
  text: string;
  dot: string;
};

export const BOOKING_PALETTES: BookingPalette[] = [
  { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-800", dot: "bg-emerald-500" },
  { border: "border-brand-200", bg: "bg-brand-50", text: "text-brand-700", dot: "bg-brand-500" },
  { border: "border-violet-200", bg: "bg-violet-50", text: "text-violet-800", dot: "bg-violet-500" },
  { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-800", dot: "bg-amber-500" },
  { border: "border-rose-200", bg: "bg-rose-50", text: "text-rose-800", dot: "bg-rose-500" },
  { border: "border-cyan-200", bg: "bg-cyan-50", text: "text-cyan-800", dot: "bg-cyan-500" },
  { border: "border-brand-200", bg: "bg-brand-50", text: "text-brand-800", dot: "bg-brand-700" },
  { border: "border-brand-200", bg: "bg-brand-50", text: "text-brand-900", dot: "bg-brand-800" },
  { border: "border-teal-200", bg: "bg-teal-50", text: "text-teal-800", dot: "bg-teal-500" },
  { border: "border-fuchsia-200", bg: "bg-fuchsia-50", text: "text-fuchsia-800", dot: "bg-fuchsia-500" },
];

/**
 * Assign one distinct colour per email address, sorted so the mapping stays
 * stable while the visible booking set does not change.
 */
export function buildPaletteByEmail(emails: string[]): Record<string, BookingPalette> {
  const unique = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))].sort();
  const map: Record<string, BookingPalette> = {};
  unique.forEach((email, index) => {
    map[email] = BOOKING_PALETTES[index % BOOKING_PALETTES.length];
  });
  return map;
}

export function paletteForEmail(
  paletteByEmail: Record<string, BookingPalette>,
  email: string,
): BookingPalette {
  return paletteByEmail[email.trim().toLowerCase()] ?? BOOKING_PALETTES[0];
}

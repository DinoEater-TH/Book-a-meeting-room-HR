"use client";

import type { Booking, RoomId } from "@/lib/types";
import { HOUR_ROWS, OPEN_HOUR, CLOSE_HOUR, SLOT_STEP } from "@/lib/types";
import { hourLabel, isPastSlot, rangeLabel } from "@/lib/dates";
import { paletteForEmail, type BookingPalette } from "@/lib/colors";
import type { Room } from "@/lib/rooms";

const SLOT_HEIGHT = 46;

type Props = {
  room: Room;
  date?: string;
  bookings: Booking[];
  paletteByEmail: Record<string, BookingPalette>;
  onSlotClick: (roomId: RoomId, hour: number) => void;
  onBookingClick: (booking: Booking) => void;
};

type PlacedBooking = { booking: Booking; column: number; columns: number };

export default function RoomTimeline({ room, date, bookings, paletteByEmail, onSlotClick, onBookingClick }: Props) {
  const ordered = [...bookings].sort((a, b) => a.startHour - b.startHour || b.endHour - a.endHour);

  // Imported legacy rows can overlap. Lay them out side by side so none is hidden.
  const placed: PlacedBooking[] = [];
  let cluster: PlacedBooking[] = [];
  let clusterEnd = -1;

  function flushCluster() {
    const columns = Math.max(...cluster.map((item) => item.column)) + 1;
    cluster.forEach((item) => { item.columns = columns; });
    placed.push(...cluster);
    cluster = [];
    clusterEnd = -1;
  }

  for (const booking of ordered) {
    if (cluster.length && booking.startHour >= clusterEnd) flushCluster();
    const busyColumns = new Set(
      cluster.filter((item) => item.booking.endHour > booking.startHour).map((item) => item.column),
    );
    let column = 0;
    while (busyColumns.has(column)) column += 1;
    cluster.push({ booking, column, columns: 1 });
    clusterEnd = Math.max(clusterEnd, booking.endHour);
  }
  if (cluster.length) flushCluster();

  function handleGridClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = event.clientY - rect.top;
    const row = Math.max(0, Math.min(HOUR_ROWS.length - 1, Math.floor(offset / SLOT_HEIGHT)));
    const withinRow = offset - row * SLOT_HEIGHT;
    const hour = OPEN_HOUR + row + (withinRow >= SLOT_HEIGHT / 2 ? SLOT_STEP : 0);
    if (hour >= CLOSE_HOUR) return;
    if (date && isPastSlot(date, hour)) return;
    onSlotClick(room.id, hour);
  }

  return (
    <section className="card overflow-hidden">
      <header className="flex items-start justify-between gap-3 border-b border-brand-50 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {room.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={room.logo}
                alt={`โลโก้${room.name}`}
                className="size-9 shrink-0 object-contain"
              />
            ) : (
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${room.accent.bg}`}>
                {room.id === "room10" ? "10" : "SM"}
              </span>
            )}
            <h2 className="truncate text-base font-semibold text-brand-900">{room.name}</h2>
          </div>
          <p className="mt-1.5 pl-[46px] text-xs text-slate-500">
            {room.location} · {room.capacity}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          {bookings.length} รายการ
        </span>
      </header>

      <div className="px-4 py-4 sm:px-5">
        <div className="flex gap-2">
          <div className="w-12 shrink-0 pt-0 sm:w-14">
            {HOUR_ROWS.map((hour) => (
              <div
                key={hour}
                style={{ height: SLOT_HEIGHT }}
                className="flex flex-col items-end justify-between py-0.5 pr-1 text-right leading-none tabular-nums"
              >
                <span className="text-xs font-medium text-slate-400">{hourLabel(hour)}</span>
                <span className="text-[10px] text-slate-300">{hourLabel(hour + SLOT_STEP)}</span>
              </div>
            ))}
          </div>

          <div
            role="grid"
            aria-label={`ตารางเวลาห้อง${room.name}`}
            onClick={handleGridClick}
            className="relative flex-1 cursor-crosshair overflow-hidden rounded-xl border border-brand-100 bg-brand-50/80"
          >
            {Array.from({ length: HOUR_ROWS.length * 2 }, (_, index) => {
              const slot = OPEN_HOUR + index * SLOT_STEP;
              const past = Boolean(date && isPastSlot(date, slot));
              return (
                <div
                  key={slot}
                  style={{ height: SLOT_HEIGHT / 2 }}
                  className={`border-b last:border-b-0 ${
                    index % 2 === 0 ? "border-brand-100" : "border-dashed border-brand-50"
                  } ${
                    past
                      ? "bg-brand-100/80"
                      : Math.floor(slot) % 2 === 0
                        ? "bg-white/40"
                        : ""
                  }`}
                />
              );
            })}

            {placed.map(({ booking, column, columns }) => {
              const top = (booking.startHour - OPEN_HOUR) * SLOT_HEIGHT;
              const height = (booking.endHour - booking.startHour) * SLOT_HEIGHT - 2;
              const palette = paletteForEmail(paletteByEmail, booking.requesterEmail);
              return (
                <button
                  key={booking.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onBookingClick(booking);
                  }}
                  style={{
                    top: top + 1,
                    height,
                    left: `calc(${(column / columns) * 100}% + 6px)`,
                    width: `calc(${100 / columns}% - 12px)`,
                  }}
                  className={`absolute overflow-hidden rounded-lg border px-2.5 py-1 text-left shadow-sm transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${palette.border} ${palette.bg}`}
                >
                  <p className={`truncate text-xs font-semibold ${palette.text}`}>
                    {booking.title}
                  </p>
                  {height >= 68 && (
                    <>
                      <p className="mt-0.5 truncate text-[11px] tabular-nums text-slate-500">
                        {rangeLabel(booking.startHour, booking.endHour)}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">{booking.requesterName}</p>
                    </>
                  )}
                  {height < 68 && (
                    <p className="truncate text-[10px] tabular-nums text-slate-500">
                      {rangeLabel(booking.startHour, booking.endHour)} · {booking.requesterName}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-3 pl-14 text-[11px] text-slate-400">
          เวลาทำการ {hourLabel(OPEN_HOUR)} – {hourLabel(CLOSE_HOUR)} น. · คลิกช่องว่างเพื่อจอง
        </p>
      </div>
    </section>
  );
}

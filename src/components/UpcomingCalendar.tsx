"use client";

import { useMemo, useState } from "react";
import type { Booking } from "@/lib/types";
import {
  THAI_WEEKDAYS,
  addDays,
  addMonths,
  formatThaiDate,
  formatThaiMonthYear,
  monthRange,
  parseISODate,
  todayISO,
} from "@/lib/dates";
import { paletteForEmail, type BookingPalette } from "@/lib/colors";

type Props = {
  bookings: Booking[];
  paletteByEmail: Record<string, BookingPalette>;
  onBookingClick: (booking: Booking) => void;
  onDayClick: (date: string) => void;
};

type View = "week" | "month";

function timeLabel(booking: Booking): string {
  return `${String(booking.startHour).padStart(2, "0")}:00–${String(booking.endHour).padStart(2, "0")}:00`;
}

function requesterLabel(booking: Booking): string {
  return booking.requesterName.trim() || "ไม่ระบุชื่อ";
}

/** Thai calendars usually start on Sunday, matching the weekday header. */
function startOfWeekSunday(iso: string): string {
  return addDays(iso, -parseISODate(iso).getDay());
}

export default function UpcomingCalendar({
  bookings,
  paletteByEmail,
  onBookingClick,
  onDayClick,
}: Props) {
  const today = todayISO();
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(today);

  const byDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const booking of bookings) {
      const list = map.get(booking.date) ?? [];
      list.push(booking);
      map.set(booking.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startHour - b.startHour || a.roomId.localeCompare(b.roomId));
    }
    return map;
  }, [bookings]);

  const days = useMemo(() => {
    if (view === "week") {
      const first = startOfWeekSunday(anchor);
      return Array.from({ length: 7 }, (_, index) => addDays(first, index));
    }
    const { from } = monthRange(anchor);
    const first = startOfWeekSunday(from);
    return Array.from({ length: 42 }, (_, index) => addDays(first, index));
  }, [view, anchor]);

  const maxChips = view === "week" ? 3 : 2;

  function move(direction: number) {
    setAnchor((current) =>
      view === "week" ? addDays(current, direction * 7) : addMonths(current, direction),
    );
  }

  function goToday() {
    setAnchor(today);
  }

  const legend = useMemo(() => {
    const seen = new Map<string, string>();
    for (const booking of bookings) {
      const email = booking.requesterEmail.trim().toLowerCase();
      if (!seen.has(email)) seen.set(email, requesterLabel(booking));
    }
    return [...seen.entries()].slice(0, 10);
  }, [bookings]);

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-900">ปฏิทินการจองล่วงหน้า</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              {bookings.length} รายการ
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {view === "week"
              ? `${formatThaiDate(days[0], { short: true })} – ${formatThaiDate(days[6], { short: true })}`
              : formatThaiMonthYear(anchor)}
            {" · คลิกวันที่เพื่อจองห้อง"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            {(["week", "month"] as View[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  view === mode
                    ? "bg-white text-orange-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {mode === "week" ? "รายสัปดาห์" : "รายเดือน"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => move(-1)}
            className="flex size-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            aria-label={view === "week" ? "สัปดาห์ก่อนหน้า" : "เดือนก่อนหน้า"}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goToday}
            className="h-8 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-700"
          >
            วันนี้
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="flex size-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            aria-label={view === "week" ? "สัปดาห์ถัดไป" : "เดือนถัดไป"}
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80">
        {THAI_WEEKDAYS.map((day, index) => (
          <div
            key={day}
            className={`px-2 py-2 text-center text-[11px] font-semibold ${
              index === 0 ? "text-rose-600" : index === 6 ? "text-orange-600" : "text-slate-500"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((iso) => {
          const list = byDate.get(iso) ?? [];
          const isToday = iso === today;
          const outsideMonth = view === "month" && !iso.startsWith(anchor.slice(0, 7));
          const isPast = iso < today;
          return (
            <div
              key={iso}
              role="button"
              tabIndex={0}
              aria-label={`${formatThaiDate(iso, { weekday: true })} มี ${list.length} รายการจอง · คลิกเพื่อจอง`}
              onClick={() => onDayClick(iso)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onDayClick(iso);
                }
              }}
              className={`min-h-[92px] border-b border-r border-slate-100 p-1.5 text-left transition sm:min-h-[112px] sm:p-2 ${
                outsideMonth || isPast ? "bg-slate-50/70" : "cursor-pointer bg-white hover:bg-orange-50/40"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`flex size-6 items-center justify-center text-xs font-semibold tabular-nums ${
                    isToday
                      ? "rounded-full bg-orange-600 text-white"
                      : outsideMonth || isPast
                        ? "text-slate-300"
                        : "text-slate-700"
                  }`}
                >
                  {parseISODate(iso).getDate()}
                </span>
                {list.length > 0 && (
                  <span className="text-[10px] font-medium text-slate-400">{list.length}</span>
                )}
              </div>

              {list.length > 0 && (
                <div className="mt-1 space-y-1">
                  {list.slice(0, maxChips).map((booking) => {
                    const palette = paletteForEmail(paletteByEmail, booking.requesterEmail);
                    return (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onBookingClick(booking);
                        }}
                        title={`${timeLabel(booking)} · ${booking.title} · ${requesterLabel(booking)}`}
                        className={`block w-full truncate rounded border px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight transition hover:brightness-95 ${palette.border} ${palette.bg} ${palette.text}`}
                      >
                        {timeLabel(booking)} {booking.title}
                      </button>
                    );
                  })}
                  {list.length > maxChips && (
                    <p className="text-[10px] text-slate-400">+{list.length - maxChips} อีก</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {legend.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <span className="text-[11px] font-semibold text-slate-500">สีตามผู้จอง</span>
          {legend.map(([email, name]) => {
            const palette = paletteForEmail(paletteByEmail, email);
            return (
              <span key={email} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <span className={`size-2 rounded-full ${palette.dot}`} />
                {name}
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}

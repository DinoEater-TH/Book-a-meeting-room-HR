"use client";

import { useMemo, useState } from "react";
import type { Booking, RoomId, SessionUser } from "@/lib/types";
import { ROOMS, getRoom } from "@/lib/rooms";
import {
  addDays,
  formatThaiDate,
  relativeDayLabel,
  todayISO,
  weekdayName,
} from "@/lib/dates";
import RoomTimeline from "./RoomTimeline";
import BookingDialog from "./BookingDialog";
import UpcomingCalendar from "./UpcomingCalendar";
import { buildPaletteByEmail } from "@/lib/colors";

type DialogState =
  | { type: "create"; roomId: RoomId; hour: number }
  | { type: "detail"; booking: Booking }
  | null;

type Tab = "board" | "mine" | "upcoming";

type Props = {
  user: SessionUser;
  initialBookings: Booking[];
  isMock: boolean;
  backendName: string;
  isAdminUser: boolean;
};

function timeLabel(booking: Booking): string {
  return `${String(booking.startHour).padStart(2, "0")}:00–${String(booking.endHour).padStart(2, "0")}:00`;
}

export default function BookingBoard({ user, initialBookings, isMock, backendName, isAdminUser }: Props) {
  const [date, setDate] = useState(todayISO);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [tab, setTab] = useState<Tab>("board");
  const [toast, setToast] = useState<string | null>(null);

  const dayBookings = useMemo(
    () => bookings.filter((booking) => booking.date === date),
    [bookings, date],
  );

  const myBookings = useMemo(
    () =>
      bookings
        .filter((booking) => booking.requesterEmail.toLowerCase() === user.email.toLowerCase())
        .sort((a, b) => (a.date === b.date ? a.startHour - b.startHour : a.date.localeCompare(b.date))),
    [bookings, user.email],
  );

  const upcomingBookings = useMemo(
    () =>
      bookings
        .filter((booking) => booking.date >= todayISO())
        .sort((a, b) =>
          a.date === b.date
            ? a.roomId.localeCompare(b.roomId) || a.startHour - b.startHour
            : a.date.localeCompare(b.date),
        ),
    [bookings],
  );

  const isMine = (booking: Booking) =>
    booking.requesterEmail.toLowerCase() === user.email.toLowerCase();

  const paletteByEmail = useMemo(
    () => buildPaletteByEmail(upcomingBookings.map((booking) => booking.requesterEmail)),
    [upcomingBookings],
  );

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3500);
  }

  function handleCreated(booking: Booking) {
    setBookings((current) => [...current, booking]);
    setDialog(null);
    showToast("จองห้องประชุมเรียบร้อยแล้ว");
  }

  function handleCancelled(id: string) {
    setBookings((current) => current.filter((booking) => booking.id !== id));
    setDialog(null);
    showToast("ยกเลิกการจองเรียบร้อยแล้ว");
  }

  function handleUpdated(updated: Booking) {
    setBookings((current) => current.map((booking) => (booking.id === updated.id ? updated : booking)));
    setDialog(null);
    showToast("แก้ไขการจองเรียบร้อยแล้ว");
  }

  function handleLinkSaved(updated: Booking) {
    setBookings((current) => current.map((booking) => (booking.id === updated.id ? updated : booking)));
    setDialog((current) =>
      current?.type === "detail" && current.booking.id === updated.id
        ? { ...current, booking: updated }
        : current,
    );
    showToast("บันทึก ลิงก์การประชุมเรียบร้อยแล้ว");
  }

  const initials = user.name.trim().slice(0, 1).toUpperCase() || "U";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="โลโก้ระบบจองห้องประชุม"
              className="size-10 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-slate-900 sm:text-base">
                ระบบจองห้องประชุม
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">กองทรัพยากรบุคคล</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAdminUser && (
              <a
                href="/log"
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-orange-50 hover:text-orange-700"
              >
                ประวัติการใช้งาน
              </a>
            )}
            <div className="flex items-center gap-2 border-slate-200 pl-3 sm:border-l">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
                {initials}
              </span>
              <div className="hidden min-w-0 sm:block">
                <p className="max-w-40 truncate text-xs font-semibold text-slate-800">{user.name}</p>
                <p className="max-w-40 truncate text-[11px] text-slate-400">{user.email}</p>
              </div>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ออกจากระบบ
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {isMock && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <strong className="font-semibold">กำลังใช้ {backendName}</strong> — ข้อมูลจะไม่ถูกเขียนลง Google Sheets จนกว่าจะตั้งค่า Service Account
          </div>
        )}

        <div className="card mb-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-xs font-medium text-slate-500">วันที่ที่กำลังดู</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {formatThaiDate(date, { weekday: true })}
              </h2>
              {relativeDayLabel(date) && (
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                  {relativeDayLabel(date)}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">วัน{weekdayName(date)} · {formatThaiDate(date)}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDate(addDays(date, -1))}
              className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              aria-label="วันก่อนหน้า"
            >
              ‹
            </button>
            <input
              type="date"
              value={date}
              onChange={(event) => event.target.value && setDate(event.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              aria-label="เลือกวันที่"
            />
            <button
              type="button"
              onClick={() => setDate(addDays(date, 1))}
              className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              aria-label="วันถัดไป"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setDate(todayISO())}
              className="h-9 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-700"
            >
              วันนี้
            </button>
          </div>
        </div>

        <div className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
          <button
            type="button"
            onClick={() => setTab("board")}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === "board"
                ? "border-orange-600 text-orange-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            ตารางการจอง
          </button>
          <button
            type="button"
            onClick={() => setTab("upcoming")}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === "upcoming"
                ? "border-orange-600 text-orange-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            รายการจองล่วงหน้า ({upcomingBookings.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("mine")}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === "mine"
                ? "border-orange-600 text-orange-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            รายการของฉัน ({myBookings.length})
          </button>
        </div>

        {tab === "board" ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded border border-slate-200 bg-white" /> ช่องว่าง
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded border border-orange-200 bg-orange-50" />
                <span className="size-3 rounded border border-sky-200 bg-sky-50 -ml-1" />
                <span className="size-3 rounded border border-violet-200 bg-violet-50 -ml-1" /> สีแยกตามอีเมลผู้จอง
              </span>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {ROOMS.map((room) => (
                <RoomTimeline
                  key={room.id}
                  room={room}
                  bookings={dayBookings.filter((booking) => booking.roomId === room.id)}
                  paletteByEmail={paletteByEmail}
                  onSlotClick={(roomId, hour) => setDialog({ type: "create", roomId, hour })}
                  onBookingClick={(booking) => setDialog({ type: "detail", booking })}
                />
              ))}
            </div>
          </>
        ) : tab === "upcoming" ? (
          <UpcomingCalendar
            bookings={upcomingBookings}
            paletteByEmail={paletteByEmail}
            onBookingClick={(booking) => setDialog({ type: "detail", booking })}
          />
        ) : (
          <section className="card divide-y divide-slate-100 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-900">รายการจองของฉัน</h2>
              {isAdminUser && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                  สิทธิ์ผู้ดูแลระบบ
                </span>
              )}
            </div>
            {myBookings.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-slate-400">ยังไม่มีรายการจอง</p>
            ) : (
              myBookings.map((booking) => {
                const room = getRoom(booking.roomId);
                const past = booking.date < todayISO();
                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => setDialog({ type: "detail", booking })}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                  >
                    <div className="w-24 shrink-0">
                      <p className={`text-sm font-semibold ${past ? "text-slate-400" : "text-slate-800"}`}>
                        {formatThaiDate(booking.date, { short: true })}
                      </p>
                      <p className="text-[11px] text-slate-400">{timeLabel(booking)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${past ? "text-slate-400" : "text-slate-800"}`}>
                        {booking.title}
                      </p>
                      <p className="truncate text-xs text-slate-400">{room?.shortName}</p>
                    </div>
                    <span className="text-slate-300">›</span>
                  </button>
                );
              })
            )}
          </section>
        )}

        <footer className="mt-10 pb-4 text-center text-xs text-slate-400">
          ระบบจองห้องประชุม · กองทรัพยากรบุคคล
        </footer>
      </main>

      {dialog?.type === "create" && (
        <BookingDialog
          mode="create"
          room={getRoom(dialog.roomId)!}
          date={date}
          initialHour={dialog.hour}
          dayBookings={dayBookings}
          onClose={() => setDialog(null)}
          onCreated={handleCreated}
        />
      )}
      {dialog?.type === "detail" && (
        <BookingDialog
          mode="detail"
          booking={dialog.booking}
          room={getRoom(dialog.booking.roomId)!}
          allBookings={bookings}
          canEdit={isMine(dialog.booking) || isAdminUser}
          isAdmin={isAdminUser}
          isOwner={isMine(dialog.booking)}
          onClose={() => setDialog(null)}
          onCancelled={handleCancelled}
          onUpdated={handleUpdated}
          onLinkSaved={handleLinkSaved}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

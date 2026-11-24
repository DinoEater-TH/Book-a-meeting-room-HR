"use client";

import { useMemo, useState } from "react";
import type { Booking, RoomId } from "@/lib/types";
import { CLOSE_HOUR, OPEN_HOUR, overlaps, SLOT_HOURS } from "@/lib/types";
import { isLegacyBooking, isUnnamedBooking } from "@/lib/bookings";
import { formatThaiDate, hourLabel, rangeLabel } from "@/lib/dates";
import { ROOMS, type Room } from "@/lib/rooms";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20";

const EQUIPMENT_OPTIONS = ["ทีวี", "ไมค์", "pointer", "กล้อง", "อื่นๆ"] as const;
type EquipmentOption = (typeof EQUIPMENT_OPTIONS)[number];

function splitEquipment(value: string): { choice: string; other: string } {
  if (!value) return { choice: "", other: "" };
  if ((EQUIPMENT_OPTIONS as readonly string[]).includes(value)) {
    return { choice: value, other: "" };
  }
  return { choice: "อื่นๆ", other: value };
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className="animate-pop-in w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl"
      >
        {children}
      </div>
      <button type="button" aria-label="ปิด" onClick={onClose} className="sr-only">
        ปิด
      </button>
    </div>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      aria-label="ปิด"
    >
      <svg viewBox="0 0 20 20" className="size-5" fill="currentColor" aria-hidden="true">
        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
      </svg>
    </button>
  );
}

type BookingValues = {
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

type FormProps = {
  eyebrow: string;
  heading: string;
  initialRoomId: RoomId;
  initialDate: string;
  initialHour: number;
  initialEndHour: number;
  initialTitle?: string;
  initialNote?: string;
  initialNeedsEquipment?: boolean;
  initialEquipmentNote?: string;
  initialNeedsOnlineLink?: boolean;
  initialOnlineLinkNote?: string;
  initialMeetingLink?: string;
  allBookings: Booking[];
  excludeId?: string;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (values: BookingValues) => Promise<Booking>;
  onSaved: (booking: Booking) => void;
  onClose: () => void;
};

function YesNoSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      <select
        value={value ? "true" : "false"}
        onChange={(event) => onChange(event.target.value === "true")}
        className={inputClass}
      >
        <option value="false">ไม่ต้องการ</option>
        <option value="true">ต้องการ</option>
      </select>
    </label>
  );
}

function BookingForm({
  eyebrow,
  heading,
  initialRoomId,
  initialDate,
  initialHour,
  initialEndHour,
  initialTitle = "",
  initialNote = "",
  initialNeedsEquipment = false,
  initialEquipmentNote = "",
  initialNeedsOnlineLink = false,
  initialOnlineLinkNote = "",
  initialMeetingLink = "",
  allBookings,
  excludeId,
  submitLabel,
  busyLabel,
  onSubmit,
  onSaved,
  onClose,
}: FormProps) {
  const [roomId, setRoomId] = useState<RoomId>(initialRoomId);
  const [date, setDate] = useState(initialDate);
  const [startHour, setStartHour] = useState(initialHour);
  const [endHour, setEndHour] = useState(initialEndHour);
  const [title, setTitle] = useState(initialTitle);
  const [note, setNote] = useState(initialNote);
  const [needsEquipment, setNeedsEquipment] = useState(initialNeedsEquipment);
  const initialEquipment = splitEquipment(initialEquipmentNote);
  const [equipmentChoice, setEquipmentChoice] = useState(initialEquipment.choice);
  const [equipmentOther, setEquipmentOther] = useState(initialEquipment.other);
  const [needsOnlineLink, setNeedsOnlineLink] = useState(initialNeedsOnlineLink);
  const [onlineLinkNote, setOnlineLinkNote] = useState(initialOnlineLinkNote);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conflict = useMemo(
    () =>
      allBookings
        .filter((booking) => booking.id !== excludeId && booking.date === date)
        .find((booking) => overlaps(booking, { roomId, date, startHour, endHour })),
    [allBookings, excludeId, roomId, date, startHour, endHour],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("กรุณากรอกวัตถุประสงค์การใช้ห้อง");
      return;
    }
    if (conflict) {
      setError("ช่วงเวลานี้ถูกจองแล้ว กรุณาเลือกช่วงเวลาอื่น");
      return;
    }

    setSubmitting(true);
    try {
      const booking = await onSubmit({
        roomId,
        date,
        startHour,
        endHour,
        title: title.trim(),
        note: note.trim(),
        needsEquipment,
        equipmentNote: needsEquipment
          ? equipmentChoice === "อื่นๆ"
            ? equipmentOther.trim()
            : equipmentChoice
          : "",
        needsOnlineLink,
        onlineLinkNote: needsOnlineLink ? onlineLinkNote.trim() : "",
        meetingLink: initialMeetingLink || undefined,
      });
      onSaved(booking);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-orange-600">{eyebrow}</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{heading}</h2>
            <p className="mt-1 text-sm text-slate-500">{formatThaiDate(date, { weekday: true })}</p>
          </div>
          <CloseButton onClose={onClose} />
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">ห้องประชุม</span>
              <select
                value={roomId}
                onChange={(event) => setRoomId(event.target.value as RoomId)}
                className={inputClass}
              >
                {ROOMS.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">วันที่</span>
              <input
                type="date"
                value={date}
                onChange={(event) => event.target.value && setDate(event.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">เวลาเริ่ม</span>
              <select
                value={startHour}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setStartHour(value);
                  if (endHour <= value) setEndHour(Math.min(value + 1, CLOSE_HOUR));
                }}
                className={inputClass}
              >
                {SLOT_HOURS.map((hour) => (
                  <option key={hour} value={hour}>
                    {hourLabel(hour)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">เวลาสิ้นสุด</span>
              <select value={endHour} onChange={(event) => setEndHour(Number(event.target.value))} className={inputClass}>
                {Array.from({ length: CLOSE_HOUR - startHour }, (_, i) => startHour + i + 1).map((hour) => (
                  <option key={hour} value={hour}>
                    {hourLabel(hour)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              ชื่อเรื่องที่จอง / วัตถุประสงค์การใช้ห้อง <span className="text-rose-500">*</span>
            </span>
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="เช่น ประชุมประจำเดือน กองทรัพยากรบุคคล"
              maxLength={200}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">หมายเหตุ (ไม่บังคับ)</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="ข้อมูลเพิ่มเติม เช่น จำนวนผู้เข้าประชุม"
              rows={2}
              maxLength={500}
              className={`${inputClass} resize-none`}
            />
          </label>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs font-semibold text-slate-700">ความช่วยเหลือเพิ่มเติมสำหรับการประชุม</p>
            <YesNoSelect
              label="ต้องการใช้อุปกรณ์ในการประชุมหรือไม่?"
              value={needsEquipment}
              onChange={setNeedsEquipment}
            />
            {needsEquipment && (
              <div className="space-y-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">ระบุอุปกรณ์ที่ต้องการ</span>
                  <select
                    value={equipmentChoice}
                    onChange={(event) => setEquipmentChoice(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">-- เลือกอุปกรณ์ --</option>
                    {EQUIPMENT_OPTIONS.map((option: EquipmentOption) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                {equipmentChoice === "อื่นๆ" && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">ระบุเพิ่มเติม</span>
                    <input
                      value={equipmentOther}
                      onChange={(event) => setEquipmentOther(event.target.value)}
                      placeholder="เช่น กระดานไวท์บอร์ด, สาย HDMI"
                      maxLength={500}
                      className={inputClass}
                    />
                  </label>
                )}
              </div>
            )}

            <YesNoSelect
              label="ต้องการลิงก์สำหรับประชุมออนไลน์หรือไม่?"
              value={needsOnlineLink}
              onChange={setNeedsOnlineLink}
            />
            {needsOnlineLink && (
              <>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  เรื่องประชุม วันที่ และระยะเวลาการประชุมจะถูกส่งแจ้งผ่าน Google Chat ให้ pongka@kku.ac.th โดยอัตโนมัติ
                </p>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">
                    รายละเอียดเพิ่มเติม (ไม่บังคับ)
                  </span>
                  <textarea
                    value={onlineLinkNote}
                    onChange={(event) => setOnlineLinkNote(event.target.value)}
                    placeholder="เช่น ต้องการลิงก์ Google Meet สำหรับผู้เข้าร่วมจากต่างจังหวัด"
                    rows={2}
                    maxLength={500}
                    className={`${inputClass} resize-none`}
                  />
                </label>
              </>
            )}
          </div>

          {conflict && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              <strong className="font-semibold">ช่วงเวลาทับกัน:</strong> {conflict.title} ·{" "}
              {rangeLabel(conflict.startHour, conflict.endHour)} · {conflict.requesterName}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting || Boolean(conflict)}
              className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? busyLabel : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
}

async function readResponse(res: Response) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด กรุณาลองใหม่");
  return data.booking as Booking;
}

type CreateProps = {
  mode: "create";
  room: Room;
  date: string;
  initialHour: number;
  dayBookings: Booking[];
  onClose: () => void;
  onCreated: (booking: Booking) => void;
};

type DetailProps = {
  mode: "detail";
  booking: Booking;
  room: Room;
  allBookings: Booking[];
  canEdit: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  onClose: () => void;
  onCancelled: (id: string) => void;
  onUpdated: (booking: Booking) => void;
  onLinkSaved: (booking: Booking) => void;
};

export default function BookingDialog(props: CreateProps | DetailProps) {
  if (props.mode === "detail") return <DetailDialog {...props} />;

  return (
    <BookingForm
      eyebrow="จองห้องประชุม"
      heading={props.room.name}
      initialRoomId={props.room.id}
      initialDate={props.date}
      initialHour={props.initialHour}
      initialEndHour={Math.min(props.initialHour + 1, CLOSE_HOUR)}
      allBookings={props.dayBookings}
      submitLabel="ยืนยันการจอง"
      busyLabel="กำลังจอง..."
      onClose={props.onClose}
      onSaved={props.onCreated}
      onSubmit={async (values) =>
        readResponse(
          await fetch("/api/bookings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          }),
        )
      }
    />
  );
}

function EditDialog({
  booking,
  room,
  allBookings,
  onClose,
  onUpdated,
}: {
  booking: Booking;
  room: Room;
  allBookings: Booking[];
  onClose: () => void;
  onUpdated: (booking: Booking) => void;
}) {
  return (
    <BookingForm
      eyebrow="แก้ไขการจอง"
      heading={room.name}
      initialRoomId={booking.roomId}
      initialDate={booking.date}
      initialHour={booking.startHour}
      initialEndHour={booking.endHour}
      initialTitle={booking.title}
      initialNote={booking.note}
      initialNeedsEquipment={booking.needsEquipment}
      initialEquipmentNote={booking.equipmentNote}
      initialNeedsOnlineLink={booking.needsOnlineLink}
      initialOnlineLinkNote={booking.onlineLinkNote}
      initialMeetingLink={booking.meetingLink}
      allBookings={allBookings}
      excludeId={booking.id}
      submitLabel="บันทึกการแก้ไข"
      busyLabel="กำลังบันทึก..."
      onClose={onClose}
      onSaved={onUpdated}
      onSubmit={async (values) =>
        readResponse(
          await fetch(`/api/bookings/${booking.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          }),
        )
      }
    />
  );
}

function DetailDialog({ booking, room, allBookings, canEdit, isAdmin, isOwner, onClose, onCancelled, onUpdated, onLinkSaved }: DetailProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [linkInput, setLinkInput] = useState(booking.meetingLink ?? "");
  const [linkSaving, setLinkSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const unnamed = isUnnamedBooking(booking);
  const legacy = isLegacyBooking(booking);
  const noName = !booking.requesterName.trim();

  if (editing) {
    return (
      <EditDialog
        booking={booking}
        room={room}
        allBookings={allBookings}
        onClose={onClose}
        onUpdated={(updated) => {
          setEditing(false);
          onUpdated(updated);
        }}
      />
    );
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ยกเลิกไม่สำเร็จ");
        return;
      }
      onCancelled(booking.id);
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setBusy(false);
    }
  }

  async function saveLink() {
    setLinkSaving(true);
    setError(null);
    try {
      const updated = await readResponse(
        await fetch(`/api/bookings/${booking.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: booking.roomId,
            date: booking.date,
            startHour: booking.startHour,
            endHour: booking.endHour,
            title: booking.title,
            note: booking.note,
            needsEquipment: booking.needsEquipment,
            equipmentNote: booking.equipmentNote,
            needsOnlineLink: booking.needsOnlineLink,
            onlineLinkNote: booking.onlineLinkNote,
            meetingLink: linkInput.trim(),
          }),
        }),
      );
      onLinkSaved(updated);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึก ลิงก์ไม่สำเร็จ");
    } finally {
      setLinkSaving(false);
    }
  }

  async function copyLink() {
    if (!booking.meetingLink) return;
    try {
      await navigator.clipboard.writeText(booking.meetingLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้วก๊อปปี้เอง");
    }
  }

  const details: [string, string][] = [
    ["ห้องประชุม", room.name],
    ["วันที่", formatThaiDate(booking.date, { weekday: true })],
    ["เวลา", `${rangeLabel(booking.startHour, booking.endHour)} น.`],
    ["ผู้ขอใช้ห้อง", noName ? "ไม่ได้ระบุชื่อ (ข้อมูลนำเข้าเก่า)" : booking.requesterName],
    ...(booking.requesterEmail && booking.requesterEmail !== "legacy@imported.local"
      ? ([["อีเมล", booking.requesterEmail]] as [string, string][])
      : []),
    ...(booking.note ? ([["หมายเหตุ", booking.note]] as [string, string][]) : []),
    [
      "อุปกรณ์",
      booking.needsEquipment
        ? `ต้องการ${booking.equipmentNote ? ` · ${booking.equipmentNote}` : ""}`
        : "ไม่ต้องการ",
    ],
    [
      "ลิงก์ประชุมออนไลน์",
      booking.needsOnlineLink
        ? `ต้องการ${booking.onlineLinkNote ? ` · ${booking.onlineLinkNote}` : ""}`
        : "ไม่ต้องการ",
    ],
  ];

  return (
    <ModalShell onClose={onClose}>
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">รายละเอียดการจอง</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{booking.title}</h2>
            {unnamed && (
              <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                {legacy && !noName
                  ? "ข้อมูลนำเข้าเก่า · ทุกคนแก้ไข/ยกเลิกได้"
                  : "ไม่ได้ระบุชื่อ · ทุกคนแก้ไข/ยกเลิกได้"}
              </span>
            )}
          </div>
          <CloseButton onClose={onClose} />
        </div>

        <dl className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-100">
          {details.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[110px_1fr] gap-3 px-4 py-3 text-sm">
              <dt className="text-slate-500">{label}</dt>
              <dd className="break-words font-medium text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>

        {booking.needsOnlineLink && (
          <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/60 p-4">
            <p className="text-xs font-semibold text-sky-900">ลิงก์การประชุมออนไลน์</p>
            {booking.meetingLink ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <a
                  href={booking.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 break-all text-sm font-medium text-sky-800 underline underline-offset-2"
                >
                  {booking.meetingLink}
                </a>
                <button
                  type="button"
                  onClick={copyLink}
                  className="rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                >
                  {copied ? "คัดลอกแล้ว ✓" : "คัดลอกลิงก์"}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-sky-800/80">
                {isAdmin ? "ยังไม่มีลิงก์ — กรุณาวางลิงก์ด้านล่าง" : "รอผู้ดูแลระบบใส่ลิงก์การประชุมให้"}
              </p>
            )}

            {isAdmin && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={linkInput}
                  onChange={(event) => setLinkInput(event.target.value)}
                  placeholder="วางลิงก์ Google Meet / Zoom ที่นี่"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={saveLink}
                  disabled={linkSaving}
                  className="shrink-0 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
                >
                  {linkSaving ? "กำลังบันทึก..." : "บันทึก ลิงก์"}
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
            {error}
          </div>
        )}

        {canEdit && (
          <p className="mt-4 text-[11px] text-slate-400">
            {unnamed || legacy
              ? "ข้อมูลนำเข้าเก่า ทุกคนสามารถแก้ไขหรือยกเลิกได้"
              : isOwner
                ? "คุณเป็นผู้จองรายการนี้ สามารถแก้ไขหรือยกเลิกได้"
                : "ผู้ดูแลระบบสามารถแก้ไขหรือยกเลิกได้"}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            ปิด
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
            >
              แก้ไข
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
            >
              {busy ? "กำลังยกเลิก..." : "ยกเลิกการจอง"}
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

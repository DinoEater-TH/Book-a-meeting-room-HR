"use client";

import { useMemo, useState } from "react";
import type { Booking, RoomId } from "@/lib/types";
import { CLOSE_HOUR, OPEN_HOUR, overlaps, SLOT_HOURS, SLOT_STEP } from "@/lib/types";
import { isLegacyBooking, isUnnamedBooking } from "@/lib/bookings";
import { formatThaiDate, hourLabel, isPastSlot, rangeLabel, todayISO } from "@/lib/dates";
import { ROOMS, type Room } from "@/lib/rooms";

const inputClass =
  "w-full rounded-xl border border-brand-100 bg-white px-3 py-2.5 text-sm text-brand-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

const EQUIPMENT_OPTIONS = ["Smart TV", "ไมโคโฟน", "Pointer", "กล้อง webcam"] as const;
type EquipmentOption = (typeof EQUIPMENT_OPTIONS)[number];

/** Older bookings used Thai/short labels; map them to the current wording. */
const EQUIPMENT_ALIASES: Record<string, string> = {
  "ทีวี": "Smart TV",
  "tv": "Smart TV",
  "smart tv": "Smart TV",
  "ไมค์": "ไมโคโฟน",
  "ไมโครโฟน": "ไมโคโฟน",
  "ไมโคโฟน": "ไมโคโฟน",
  "mic": "ไมโคโฟน",
  "microphone": "ไมโคโฟน",
  "pointer": "Pointer",
  "โปอินเตอร์": "Pointer",
  "กล้อง": "กล้อง webcam",
  "webcam": "กล้อง webcam",
  "กล้อง webcam": "กล้อง webcam",
  "camera": "กล้อง webcam",
};

/** Old free-text placeholders from the removed "อื่นๆ" option are not equipment. */
const EQUIPMENT_IGNORED = new Set(["อื่นๆ", "อื่น ๆ", "other", "others"]);

function splitEquipment(value?: string): { choices: string[]; other: string } {
  if (!value?.trim()) return { choices: [], other: "" };
  const choices: string[] = [];
  const others: string[] = [];

  for (const raw of value.split(/[,،]/)) {
    const token = raw.trim();
    if (!token || EQUIPMENT_IGNORED.has(token.toLowerCase())) continue;
    const mapped = EQUIPMENT_ALIASES[token.toLowerCase()] ?? EQUIPMENT_ALIASES[token];
    if (mapped) {
      if (!choices.includes(mapped)) choices.push(mapped);
    } else if (!others.includes(token)) {
      others.push(token);
    }
  }
  return { choices, other: others.join(", ") };
}

function serializeEquipment(choices: string[], other: string): string | undefined {
  const extra = other.trim();
  const parts = [...choices];
  if (extra) parts.push(extra);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className="animate-pop-in flex max-h-[100dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
      >
        <div className="overflow-y-auto overscroll-contain p-6">{children}</div>
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
      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-brand-100 hover:text-slate-600"
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
  onBusyChange?: (message: string | null) => void;
  /** Editing an existing past booking may keep its original slot. */
  allowPast?: boolean;
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
  onBusyChange,
  allowPast = false,
}: FormProps) {
  const [roomId, setRoomId] = useState<RoomId>(initialRoomId);
  const [date, setDate] = useState(initialDate);
  const [startHour, setStartHour] = useState(initialHour);
  const [endHour, setEndHour] = useState(initialEndHour);
  const [title, setTitle] = useState(initialTitle);
  const [note, setNote] = useState(initialNote);
  const initialEquipment = splitEquipment(initialEquipmentNote);
  const [equipmentChoices, setEquipmentChoices] = useState<string[]>(initialEquipment.choices);
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

  const pastSlot = isPastSlot(date, startHour);
  const keepExistingPast =
    allowPast &&
    date === initialDate &&
    startHour === initialHour &&
    endHour === initialEndHour;
  const blockedPast = pastSlot && !keepExistingPast;

  const startHours = useMemo(() => {
    const hours = SLOT_HOURS.filter((hour) => !isPastSlot(date, hour));
    if (allowPast && pastSlot && !hours.includes(startHour)) hours.push(startHour);
    return hours.sort((a, b) => a - b);
  }, [date, startHour, allowPast, pastSlot]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (blockedPast) {
      setError("ไม่สามารถจองเวลาที่ผ่านไปแล้วได้ กรุณาเลือกวันที่และเวลาใหม่");
      return;
    }
    if (!title.trim()) {
      setError("กรุณากรอกวัตถุประสงค์การใช้ห้อง");
      return;
    }
    if (conflict) {
      setError("ช่วงเวลานี้ถูกจองแล้ว กรุณาเลือกช่วงเวลาอื่น");
      return;
    }

    const equipmentNote = serializeEquipment(equipmentChoices, equipmentOther);

    setSubmitting(true);
    onBusyChange?.(busyLabel);
    try {
      const booking = await onSubmit({
        roomId,
        date,
        startHour,
        endHour,
        title: title.trim(),
        note: note.trim(),
        needsEquipment: Boolean(equipmentNote),
        equipmentNote: equipmentNote ?? "",
        needsOnlineLink,
        onlineLinkNote: needsOnlineLink ? onlineLinkNote.trim() : "",
        meetingLink: initialMeetingLink || undefined,
      });
      onBusyChange?.(null);
      onSaved(booking);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setSubmitting(false);
      onBusyChange?.(null);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{eyebrow}</p>
            <h2 className="mt-1 text-xl font-bold text-brand-900">{heading}</h2>
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
                min={allowPast ? undefined : todayISO()}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) return;
                  setDate(value);
                  if (allowPast || !isPastSlot(value, startHour)) return;
                  const first = SLOT_HOURS.find((hour) => !isPastSlot(value, hour));
                  if (first !== undefined) {
                    setStartHour(first);
                    setEndHour(first + SLOT_STEP);
                  }
                }}
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
                  if (endHour <= value) setEndHour(Math.min(value + SLOT_STEP, CLOSE_HOUR));
                }}
                className={inputClass}
              >
                {startHours.length === 0 && (
                  <option value={startHour}>{hourLabel(startHour)}</option>
                )}
                {startHours.map((hour) => (
                  <option key={hour} value={hour}>
                    {hourLabel(hour)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">เวลาสิ้นสุด</span>
              <select value={endHour} onChange={(event) => setEndHour(Number(event.target.value))} className={inputClass}>
                {Array.from(
                  { length: Math.round((CLOSE_HOUR - startHour) / SLOT_STEP) },
                  (_, i) => startHour + (i + 1) * SLOT_STEP,
                ).map((hour) => (
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

          <div className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/70 p-3">
            <p className="text-xs font-semibold text-slate-700">ความช่วยเหลือเพิ่มเติมสำหรับการประชุม</p>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600">
                อุปกรณ์ที่ต้องการ (เลือกได้หลายรายการ)
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {EQUIPMENT_OPTIONS.map((option: EquipmentOption) => {
                  const checked = equipmentChoices.includes(option);
                  return (
                    <label
                      key={option}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition ${
                        checked
                          ? "border-brand-300 bg-brand-50 font-medium text-brand-800"
                          : "border-brand-100 bg-white text-slate-700 hover:bg-brand-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setEquipmentChoices((current) =>
                            event.target.checked
                              ? [...current, option]
                              : current.filter((item) => item !== option),
                          );
                        }}
                        className="size-4 accent-brand-700"
                      />
                      {option}
                    </label>
                  );
                })}
              </div>
              <label className="mt-2 block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  ระบุอุปกรณ์เพิ่มเติม (ไม่บังคับ)
                </span>
                <input
                  value={equipmentOther}
                  onChange={(event) => setEquipmentOther(event.target.value)}
                  placeholder="เช่น กระดานไวท์บอร์ด, สาย HDMI"
                  maxLength={500}
                  className={inputClass}
                />
              </label>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                ความต้องการอุปกรณ์จะถูกส่งแจ้งผ่าน Google Chat ให้ pongka@kku.ac.th โดยอัตโนมัติ
              </p>
            </div>

            <YesNoSelect
              label="ต้องการเจ้าหน้าที่ดูแลการประชุมหรือไม่?"
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
                    รายละเอียดที่ต้องการให้เจ้าหน้าที่ดูแล (ไม่บังคับ)
                  </span>
                  <textarea
                    value={onlineLinkNote}
                    onChange={(event) => setOnlineLinkNote(event.target.value)}
                    placeholder="เช่น ต้องการเจ้าหน้าที่เปิดห้องและตั้งค่าอุปกรณ์ก่อนประชุม"
                    rows={2}
                    maxLength={500}
                    className={`${inputClass} resize-none`}
                  />
                </label>
              </>
            )}
          </div>

          {blockedPast && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
              ไม่สามารถจองเวลาที่ผ่านไปแล้วได้ กรุณาเลือกวันที่และเวลาใหม่
            </div>
          )}
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
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-brand-100"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting || Boolean(conflict) || blockedPast}
              className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
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
  onBusyChange: (message: string | null) => void;
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
  onBusyChange: (message: string | null) => void;
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
      initialEndHour={Math.min(props.initialHour + SLOT_STEP, CLOSE_HOUR)}
      allBookings={props.dayBookings}
      submitLabel="ยืนยันการจอง"
      busyLabel="กำลังจอง..."
      onClose={props.onClose}
      onSaved={props.onCreated}
      onBusyChange={props.onBusyChange}
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
  onBusyChange,
}: {
  booking: Booking;
  room: Room;
  allBookings: Booking[];
  onClose: () => void;
  onUpdated: (booking: Booking) => void;
  onBusyChange: (message: string | null) => void;
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
      onBusyChange={onBusyChange}
      allowPast
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

function DetailDialog({ booking, room, allBookings, canEdit, isAdmin, isOwner, onClose, onCancelled, onUpdated, onLinkSaved, onBusyChange }: DetailProps) {
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
        onBusyChange={onBusyChange}
        onUpdated={(updated) => {
          setEditing(false);
          onUpdated(updated);
        }}
      />
    );
  }

  async function cancel() {
    setBusy(true);
    onBusyChange?.("กำลังยกเลิกการจอง...");
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ยกเลิกไม่สำเร็จ");
        return;
      }
      onBusyChange?.(null);
      onCancelled(booking.id);
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setBusy(false);
      onBusyChange?.(null);
    }
  }

  async function saveLink() {
    setLinkSaving(true);
    onBusyChange?.("กำลังบันทึก ลิงก์การประชุม...");
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
      onBusyChange?.(null);
      onLinkSaved(updated);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึก ลิงก์ไม่สำเร็จ");
    } finally {
      setLinkSaving(false);
      onBusyChange?.(null);
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
      "เจ้าหน้าที่ดูแลการประชุม",
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
            <h2 className="mt-1 text-xl font-bold text-brand-900">{booking.title}</h2>
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

        <dl className="mt-6 divide-y divide-slate-100 rounded-xl border border-brand-50">
          {details.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[110px_1fr] gap-3 px-4 py-3 text-sm">
              <dt className="text-slate-500">{label}</dt>
              <dd className="break-words font-medium text-brand-900">{value}</dd>
            </div>
          ))}
        </dl>

        {(booking.meetingLink || isAdmin) && (
          <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
            <p className="text-xs font-semibold text-brand-900">ลิงก์การประชุมออนไลน์</p>
            {booking.meetingLink ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <a
                  href={booking.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 break-all text-sm font-medium text-brand-800 underline underline-offset-2"
                >
                  {booking.meetingLink}
                </a>
                <button
                  type="button"
                  onClick={copyLink}
                  className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
                >
                  {copied ? "คัดลอกแล้ว ✓" : "คัดลอกลิงก์"}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-brand-800/80">
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
                  className="shrink-0 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-50"
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
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-brand-100"
          >
            ปิด
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
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

import { LEGACY_EMAIL } from "./bookings";
import { formatThaiDate, rangeLabel } from "./dates";
import { getRoom } from "./rooms";
import { getConfigCell } from "./sheet-config";
import type { Booking } from "./types";

export type BookingEmailAction = "created" | "updated" | "cancelled";

const ACTION_LABEL: Record<BookingEmailAction, string> = {
  created: "ยืนยันการจอง",
  updated: "แจ้งการแก้ไขการจอง",
  cancelled: "แจ้งการยกเลิกการจอง",
};

let warnedMissingKey = false;

/** Best-effort confirmation email to the booker. Never blocks a booking. */
export async function notifyBookerByEmail(booking: Booking, action: BookingEmailAction) {
  const to = booking.requesterEmail.trim().toLowerCase();
  if (!to || to === LEGACY_EMAIL || !to.includes("@")) return;

  const apiKey = process.env.RESEND_API_KEY?.trim() || (await getConfigCell("B2"));
  if (!apiKey) {
    if (!warnedMissingKey) {
      console.warn("[email] ยังไม่ได้ตั้งค่า Resend API key (RESEND_API_KEY หรือ _Config!B2)");
      warnedMissingKey = true;
    }
    return;
  }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    (await getConfigCell("B3")) ||
    "onboarding@resend.dev";

  const room = getRoom(booking.roomId);
  const label = ACTION_LABEL[action];
  const subject = `[ระบบจองห้องประชุม] ${label} · ${booking.title} · ${formatThaiDate(booking.date, { short: true })}`;

  const lines = [
    `เรียน ${booking.requesterName || "ผู้ใช้"}`,
    "",
    `${label} รายการจองห้องประชุมของท่านเรียบร้อยแล้ว`,
    "",
    `เรื่อง: ${booking.title}`,
    `ห้อง: ${room?.name ?? booking.roomId}`,
    `วันที่: ${formatThaiDate(booking.date, { weekday: true })}`,
    `เวลา: ${rangeLabel(booking.startHour, booking.endHour)} น.`,
  ];

  if (booking.note) lines.push(`หมายเหตุ: ${booking.note}`);
  if (booking.needsEquipment) {
    lines.push(`อุปกรณ์ที่ต้องการ: ${booking.equipmentNote || "ระบุไว้ในคำขอ"}`);
  }
  if (booking.needsOnlineLink) {
    lines.push(
      `เจ้าหน้าที่ดูแลการประชุม: ต้องการ${booking.onlineLinkNote ? ` (${booking.onlineLinkNote})` : ""}`,
    );
  }
  if (booking.meetingLink) lines.push(`ลิงก์การประชุม: ${booking.meetingLink}`);

  lines.push("", "ระบบจองห้องประชุม · กองทรัพยากรบุคคล");

  const payload = JSON.stringify({ from, to: [to], subject, text: lines.join("\n") });
  let lastError: unknown;

  // One quick retry smooths over transient network failures.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: payload,
      });
      if (res.ok) return;
      if (res.status < 500) {
        console.error("[email] Resend ตอบกลับสถานะ", res.status);
        return;
      }
      lastError = `status ${res.status}`;
    } catch (error) {
      lastError = error;
    }
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.error(
    "[email] ส่งอีเมลแจ้งผู้จองไม่สำเร็จ",
    lastError instanceof Error ? lastError.message : lastError,
  );
}

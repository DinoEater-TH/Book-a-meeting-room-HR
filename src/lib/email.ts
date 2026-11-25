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

/** Sends from the booker's own Gmail so no verified sending domain is needed. */
async function sendViaGmail(
  accessToken: string,
  to: string,
  subject: string,
  text: string,
): Promise<boolean> {
  const message = [
    "From: me",
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(text, "utf8").toString("base64"),
  ].join("\r\n");

  try {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: Buffer.from(message, "utf8").toString("base64url") }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[email] Gmail ตอบกลับสถานะ", res.status, detail.slice(0, 500));
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      "[email] ส่งอีเมลผ่าน Gmail ไม่สำเร็จ",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/** Resend is kept as a fallback for sessions without Gmail permission. */
async function sendViaResend(to: string, subject: string, text: string) {
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
  const payload = JSON.stringify({ from, to: [to], subject, text });
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

/** Best-effort confirmation email to the booker. Never blocks a booking. */
export async function notifyBookerByEmail(
  booking: Booking,
  action: BookingEmailAction,
  accessToken?: string | null,
) {
  const to = booking.requesterEmail.trim().toLowerCase();
  if (!to || to === LEGACY_EMAIL || !to.includes("@")) return;

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
  const text = lines.join("\n");

  if (accessToken && (await sendViaGmail(accessToken, to, subject, text))) return;
  await sendViaResend(to, subject, text);
}

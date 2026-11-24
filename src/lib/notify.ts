import { formatThaiDate, rangeLabel } from "./dates";
import { getGoogleChatWebhookUrl } from "./google-chat";
import { getRoom } from "./rooms";
import type { Booking } from "./types";

/** Sends a notification only when the booking asks for meeting support. */
export async function notifyMeetingSupport(booking: Booking, action: "created" | "updated") {
  if (!booking.needsEquipment && !booking.needsOnlineLink) return;

  const webhook = await getGoogleChatWebhookUrl();
  if (!webhook) {
    console.warn("[notify] Google Chat webhook is not configured");
    return;
  }

  const room = getRoom(booking.roomId);
  const lines = [
    `🔔 ${action === "created" ? "คำขอช่วยเหลือการประชุมใหม่" : "แก้ไขคำขอช่วยเหลือการประชุม"}`,
    `เรื่อง: ${booking.title}`,
    `วันที่: ${formatThaiDate(booking.date, { weekday: true })}`,
    `เวลา: ${rangeLabel(booking.startHour, booking.endHour)} น.`,
    `ห้อง: ${room?.name ?? booking.roomId}`,
    `ผู้จอง: ${booking.requesterName} (${booking.requesterEmail})`,
  ];

  if (booking.needsEquipment) {
    lines.push(`อุปกรณ์: ${booking.equipmentNote || "ต้องการ (ไม่ได้ระบุรายละเอียด)"}`);
  }
  if (booking.needsOnlineLink) {
    lines.push(
      `ลิงก์ประชุมออนไลน์: ต้องการ${booking.onlineLinkNote ? ` (${booking.onlineLinkNote})` : ""}`,
    );
  }
  if (booking.meetingLink) {
    lines.push(`ลิงก์ประชุมที่ใส่ให้แล้ว: ${booking.meetingLink}`);
  }
  if (booking.note) {
    lines.push(`หมายเหตุ: ${booking.note}`);
  }

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ text: lines.join("\n") }),
    });
    if (!res.ok) {
      console.error("[notify] Google Chat ตอบกลับสถานะ", res.status);
    }
  } catch (error) {
    console.error("[notify] ส่งข้อความ Google Chat ไม่สำเร็จ", error instanceof Error ? error.message : error);
  }
}

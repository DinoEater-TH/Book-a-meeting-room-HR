import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, isAdmin, UnauthorizedError } from "@/lib/auth";
import { isLegacyBooking, parseBookingInput } from "@/lib/bookings";
import { hourLabel } from "@/lib/dates";
import { notifyBookerByEmail } from "@/lib/email";
import { getGmailAccessToken } from "@/lib/google-access-token";
import { notifyMeetingSupport } from "@/lib/notify";
import { getBookingStore } from "@/lib/sheets";
import { logUsage } from "@/lib/usage-log";
import { overlaps } from "@/lib/types";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  console.error("[bookings API]", error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 },
  );
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "ข้อมูล JSON ไม่ถูกต้อง" }, { status: 400 });
    }

    const store = getBookingStore();
    const all = await store.list();
    const booking = all.find((item) => item.id === id);
    if (!booking) {
      return NextResponse.json({ error: "ไม่พบรายการจองนี้" }, { status: 404 });
    }

    const admin = isAdmin(user.email);
    // Legacy rows have no sign-in owner, so any signed-in user may manage them.
    const canEdit =
      isLegacyBooking(booking) ||
      booking.requesterEmail.toLowerCase() === user.email.toLowerCase() ||
      admin;
    if (!canEdit) {
      return NextResponse.json({ error: "คุณสามารถแก้ไขได้เฉพาะรายการของตนเอง" }, { status: 403 });
    }

    // A past booking may keep its original slot (e.g. admin adding a link),
    // but no one may move a booking back into the past.
    const raw = (body ?? {}) as Record<string, unknown>;
    const keepPastSlot =
      raw.date === booking.date &&
      Number(raw.startHour) === booking.startHour &&
      Number(raw.endHour) === booking.endHour;
    const parsed = parseBookingInput(body, { allowPast: keepPastSlot });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // Only pongka@kku.ac.th may add or change the meeting link.
    if (!admin) parsed.value.meetingLink = undefined;

    const conflict = all.find(
      (item) => item.id !== id && overlaps(item, parsed.value),
    );
    if (conflict) {
      return NextResponse.json(
        {
          error: `ช่วงเวลานี้ถูกจองแล้ว: ${conflict.title} (${hourLabel(conflict.startHour)}–${hourLabel(conflict.endHour)})`,
        },
        { status: 409 },
      );
    }

    const updated = await store.update(id, parsed.value);
    if (!updated) {
      return NextResponse.json({ error: "ไม่พบรายการจองนี้" }, { status: 404 });
    }
    const accessToken = await getGmailAccessToken(request);
    await Promise.all([
      notifyMeetingSupport(updated, "updated"),
      notifyBookerByEmail(updated, "updated", accessToken),
    ]);
    await logUsage({
      email: user.email,
      name: user.name,
      action: "แก้ไขการจอง",
      detail: `${updated.title} · ${updated.date} ${hourLabel(updated.startHour)}–${hourLabel(updated.endHour)}`,
    });
    revalidatePath("/book");

    return NextResponse.json({ booking: updated });
  } catch (error) {
    return errorResponse(error, "เกิดข้อผิดพลาดในการแก้ไข");
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id } = await params;
    const store = getBookingStore();

    const all = await store.list();
    const booking = all.find((item) => item.id === id);
    if (!booking) {
      return NextResponse.json({ error: "ไม่พบรายการจองนี้" }, { status: 404 });
    }

    const admin = isAdmin(user.email);
    const canDelete =
      isLegacyBooking(booking) ||
      booking.requesterEmail.toLowerCase() === user.email.toLowerCase() ||
      admin;
    if (!canDelete) {
      return NextResponse.json({ error: "คุณสามารถยกเลิกได้เฉพาะรายการของตนเอง" }, { status: 403 });
    }

    await store.remove(id);
    const accessToken = await getGmailAccessToken(request);
    await notifyBookerByEmail(booking, "cancelled", accessToken);
    await logUsage({
      email: user.email,
      name: user.name,
      action: "ยกเลิกการจอง",
      detail: `${booking.title} · ${booking.date}`,
    });
    revalidatePath("/book");

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("[bookings DELETE]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการยกเลิก" },
      { status: 500 },
    );
  }
}

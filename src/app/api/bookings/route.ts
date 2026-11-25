import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { isAdmin, requireUser, UnauthorizedError } from "@/lib/auth";
import { parseBookingInput, toNewBooking } from "@/lib/bookings";
import { isISODate, monthRange, todayISO } from "@/lib/dates";
import { notifyBookerByEmail } from "@/lib/email";
import { getGmailAccessToken } from "@/lib/google-access-token";
import { notifyMeetingSupport } from "@/lib/notify";
import { getBookingStore } from "@/lib/sheets";
import { logUsage } from "@/lib/usage-log";
import { overlaps } from "@/lib/types";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  console.error("[bookings API]", error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการประมวลผล" },
    { status: 500 },
  );
}

export async function GET(request: NextRequest) {
  try {
    await requireUser();

    const params = request.nextUrl.searchParams;
    const fromParam = params.get("from");
    const toParam = params.get("to");
    const fallback = monthRange(todayISO());

    const from = fromParam && isISODate(fromParam) ? fromParam : fallback.from;
    const to = toParam && isISODate(toParam) ? toParam : fallback.to;

    const store = getBookingStore();
    const bookings = await store.list({ from, to });

    return NextResponse.json({
      bookings,
      backend: store.backendName,
      isMock: store.isMock,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "ข้อมูล JSON ไม่ถูกต้อง" }, { status: 400 });
    }

    const parsed = parseBookingInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // Only pongka@kku.ac.th may add a meeting link.
    if (!isAdmin(user.email)) parsed.value.meetingLink = undefined;

    const store = getBookingStore();
    const sameDay = await store.list({ from: parsed.value.date, to: parsed.value.date });
    const conflict = sameDay.find((booking) => overlaps(booking, parsed.value));
    if (conflict) {
      return NextResponse.json(
        {
          error: `ช่วงเวลานี้ถูกจองแล้ว: ${conflict.title} (${String(conflict.startHour).padStart(2, "0")}:00–${String(conflict.endHour).padStart(2, "0")}:00)`,
        },
        { status: 409 },
      );
    }

    const booking = await store.create(toNewBooking(parsed.value, user));
    const accessToken = await getGmailAccessToken(request);
    await Promise.all([
      notifyMeetingSupport(booking, "created"),
      notifyBookerByEmail(booking, "created", accessToken),
    ]);
    await logUsage({
      email: user.email,
      name: user.name,
      action: "สร้างการจอง",
      detail: `${booking.title} · ${booking.date} ${String(booking.startHour).padStart(2, "0")}:00–${String(booking.endHour).padStart(2, "0")}:00`,
    });
    revalidatePath("/book");

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

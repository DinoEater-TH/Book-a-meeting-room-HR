import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { parseBookingInput, toNewBooking } from "@/lib/bookings";
import { isISODate, monthRange, todayISO } from "@/lib/dates";
import { getBookingStore } from "@/lib/sheets";
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
    revalidatePath("/book");

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

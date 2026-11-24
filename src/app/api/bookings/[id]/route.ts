import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, isAdmin, UnauthorizedError } from "@/lib/auth";
import { parseBookingInput } from "@/lib/bookings";
import { getBookingStore } from "@/lib/sheets";
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

    const parsed = parseBookingInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const store = getBookingStore();
    const all = await store.list();
    const booking = all.find((item) => item.id === id);
    if (!booking) {
      return NextResponse.json({ error: "ไม่พบรายการจองนี้" }, { status: 404 });
    }

    const canEdit =
      booking.requesterEmail.toLowerCase() === user.email.toLowerCase() || isAdmin(user.email);
    if (!canEdit) {
      return NextResponse.json({ error: "คุณสามารถแก้ไขได้เฉพาะรายการของตนเอง" }, { status: 403 });
    }

    const conflict = all.find(
      (item) => item.id !== id && overlaps(item, parsed.value),
    );
    if (conflict) {
      return NextResponse.json(
        {
          error: `ช่วงเวลานี้ถูกจองแล้ว: ${conflict.title} (${String(conflict.startHour).padStart(2, "0")}:00–${String(conflict.endHour).padStart(2, "0")}:00)`,
        },
        { status: 409 },
      );
    }

    const updated = await store.update(id, parsed.value);
    if (!updated) {
      return NextResponse.json({ error: "ไม่พบรายการจองนี้" }, { status: 404 });
    }
    revalidatePath("/book");

    return NextResponse.json({ booking: updated });
  } catch (error) {
    return errorResponse(error, "เกิดข้อผิดพลาดในการแก้ไข");
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
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

    const canDelete =
      booking.requesterEmail.toLowerCase() === user.email.toLowerCase() || isAdmin(user.email);
    if (!canDelete) {
      return NextResponse.json({ error: "คุณสามารถยกเลิกได้เฉพาะรายการของตนเอง" }, { status: 403 });
    }

    await store.remove(id);
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

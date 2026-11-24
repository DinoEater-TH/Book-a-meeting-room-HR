import { requireUser, isAdmin } from "@/lib/auth";
import { getBookingStore } from "@/lib/sheets";
import { logUsage } from "@/lib/usage-log";
import BookingBoard from "@/components/BookingBoard";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const user = await requireUser();
  const store = getBookingStore();
  const bookings = await store.list();
  await logUsage({
    email: user.email,
    name: user.name,
    action: "เข้าใช้งานระบบ",
    detail: "เปิดหน้าจองห้องประชุม",
  });

  return (
    <BookingBoard
      user={user}
      initialBookings={bookings}
      isMock={store.isMock}
      backendName={store.backendName}
      isAdminUser={isAdmin(user.email)}
    />
  );
}

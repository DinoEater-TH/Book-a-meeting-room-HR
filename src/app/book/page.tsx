import { requireUser, isAdmin } from "@/lib/auth";
import { getBookingStore } from "@/lib/sheets";
import BookingBoard from "@/components/BookingBoard";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const user = await requireUser();
  const store = getBookingStore();
  const bookings = await store.list();

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

import { getBookingByManageToken } from "@/lib/booking";
import { ManageBookingView, type ManageBookingDTO } from "./ManageBookingView";

// Booking status can change at any time (self-cancel, admin no-show/complete)
// and the token is only known at request time — this must never be cached.
export const dynamic = "force-dynamic";

const CANCELLATION_DEADLINE_HOURS = 24;

export const metadata = {
  title: "Foglalásod — Bloom Szépségszalon",
};

export default async function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await getBookingByManageToken(token);

  if (!booking) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-4 py-8 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-primary-hover">Bloom Szépségszalon</p>
        <h1 className="mt-2 text-xl font-semibold text-ink">Ez a foglalás nem található</h1>
        <p className="mt-2 text-sm text-ink-soft max-w-sm">
          A link vagy elavult, vagy hibásan érkezett. Ha kérdésed van a foglalásoddal kapcsolatban, hívj
          minket telefonon.
        </p>
      </div>
    );
  }

  const dto: ManageBookingDTO = {
    status: booking.status,
    customerName: booking.customerName,
    cancelledAt: booking.cancelledAt ? booking.cancelledAt.toISOString() : null,
    segments: booking.segments.map((s) => ({
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      serviceName: s.service.name,
      employeeName: s.employee.name,
      price: s.service.price,
    })),
  };

  return (
    <ManageBookingView token={token} booking={dto} cancellationDeadlineHours={CANCELLATION_DEADLINE_HOURS} />
  );
}

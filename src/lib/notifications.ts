/**
 * Confirmation + reminder notifications. Stubbed to a log line for now —
 * no Resend/Twilio credentials are configured in this environment. Wiring
 * up real delivery means: swap `send` below for `resend.emails.send(...)`,
 * and turn `scheduleReminder` into a queued/cron job (e.g. a `remind_at`
 * column checked by a periodic worker, or a Vercel Cron route) that fires
 * 24h before `Booking`'s earliest segment start. The call sites
 * (src/app/foglalas/actions.ts) are already in place and non-blocking, so
 * neither swap requires touching the booking flow itself.
 */

export type BookingNotificationPayload = {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  startTime: Date;
  serviceNames: string[];
  employeeNames: string[];
};

export async function sendBookingConfirmation(payload: BookingNotificationPayload): Promise<void> {
  console.log(
    `[notifications] confirmation → ${payload.customerEmail} — ${payload.serviceNames.join(" + ")} ` +
      `${payload.employeeNames.join(" és ")} ${payload.startTime.toISOString()} (booking ${payload.bookingId})`,
  );
}

export async function scheduleReminder(payload: BookingNotificationPayload): Promise<void> {
  console.log(
    `[notifications] reminder scheduled for 24h before ${payload.startTime.toISOString()} → ${payload.customerPhone} (booking ${payload.bookingId})`,
  );
}

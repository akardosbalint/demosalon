import { prisma } from "@/lib/prisma";
import { sendBookingReminder, type BookingNotificationPayload } from "@/lib/notifications";

const REMINDER_WINDOW_HOURS = 24;

/**
 * Finds CONFIRMED bookings whose earliest segment starts within the next
 * REMINDER_WINDOW_HOURS and haven't had a reminder sent yet, sends one, and
 * stamps `reminderSentAt` so a re-run (overlapping cron tick, retry) never
 * double-sends. Driven by `/api/cron/reminders` — see that route for how
 * this gets triggered on a schedule.
 */
export async function sendDueReminders(now: Date = new Date()): Promise<{ sent: number; failed: number }> {
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60_000);

  const candidates = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      reminderSentAt: null,
      segments: { some: { startTime: { gte: now, lte: windowEnd } } },
    },
    include: {
      segments: { include: { employee: true, service: true }, orderBy: { startTime: "asc" } },
    },
  });

  let sent = 0;
  let failed = 0;

  for (const booking of candidates) {
    const earliest = booking.segments[0];
    // A multi-service booking's *first* segment must be the one inside the
    // window — the DB filter above matches if any segment qualifies, which
    // isn't precise enough on its own.
    if (!earliest || earliest.startTime < now || earliest.startTime > windowEnd) continue;

    const payload: BookingNotificationPayload = {
      bookingId: booking.id,
      manageToken: booking.manageToken,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail ?? undefined,
      customerPhone: booking.customerPhone,
      startTime: earliest.startTime,
      serviceNames: [...new Set(booking.segments.map((s) => s.service.name))],
      employeeNames: [...new Set(booking.segments.map((s) => s.employee.name))],
    };

    try {
      await sendBookingReminder(payload);
      await prisma.booking.update({ where: { id: booking.id }, data: { reminderSentAt: now } });
      sent++;
    } catch (err) {
      console.error(`[reminders] failed for booking ${booking.id}:`, err);
      failed++;
    }
  }

  return { sent, failed };
}

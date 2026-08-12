/**
 * Confirmation + reminder delivery. Real Resend (email) and Twilio (SMS)
 * integration, each independently gated on its own env vars — when a
 * provider isn't configured (e.g. this sandbox, or a fresh checkout before
 * secrets are set), that channel falls back to a console log instead of
 * throwing, so booking creation is never blocked by missing credentials.
 * A provider error (bad key, rate limit, invalid number) is caught and
 * logged the same way — never allowed to fail the caller.
 *
 * Reminders are *not* scheduled in-process (a serverless function can't
 * hold a 24h timer). Instead `src/lib/reminders.ts` + the
 * `/api/cron/reminders` route scan for CONFIRMED bookings starting soon
 * and call `sendBookingReminder` — see that route for the cron wiring.
 */

import { Resend } from "resend";
import Twilio from "twilio";

export type BookingNotificationPayload = {
  bookingId: string;
  manageToken: string;
  customerName: string;
  // Optional — admin-entered phone bookings may have no email on file
  // (see prisma/schema.prisma Booking.customerEmail). Email delivery is
  // simply skipped when absent; SMS still goes out.
  customerEmail?: string;
  customerPhone: string;
  startTime: Date;
  serviceNames: string[];
  employeeNames: string[];
};

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL ?? "Bloom Szépségszalon <booking@bloomszepsegszalon.hu>";
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;
const twilioClient =
  twilioAccountSid && twilioAuthToken ? Twilio(twilioAccountSid, twilioAuthToken) : null;

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

function manageUrl(manageToken: string): string {
  return `${appUrl}/foglalas/kezeles/${manageToken}`;
}

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("hu-HU", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Budapest",
  }).format(date);
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  logLabel: string,
  bookingId: string,
): Promise<void> {
  if (!resend) {
    console.log(
      `[notifications] (RESEND_API_KEY nincs beállítva — csak napló) ${logLabel} email → ${to} ` +
        `(booking ${bookingId}): ${subject}`,
    );
    return;
  }
  try {
    await resend.emails.send({ from: resendFromEmail, to, subject, html });
  } catch (err) {
    console.error(`[notifications] Resend email küldés sikertelen (booking ${bookingId}):`, err);
  }
}

async function sendSms(to: string, body: string, logLabel: string, bookingId: string): Promise<void> {
  if (!twilioClient || !twilioFromNumber) {
    console.log(
      `[notifications] (Twilio nincs beállítva — csak napló) ${logLabel} SMS → ${to} ` +
        `(booking ${bookingId}): ${body}`,
    );
    return;
  }
  try {
    await twilioClient.messages.create({ from: twilioFromNumber, to, body });
  } catch (err) {
    console.error(`[notifications] Twilio SMS küldés sikertelen (booking ${bookingId}):`, err);
  }
}

function emailShell(bodyHtml: string): string {
  return `<!doctype html>
<html lang="hu">
  <body style="margin:0;padding:0;background:#faf7f2;font-family:Georgia,'Times New Roman',serif;color:#2b2320;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#c98a6b;padding:24px 32px;">
                <span style="font-size:20px;color:#ffffff;letter-spacing:0.02em;">Bloom Szépségszalon</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${bodyHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function confirmationEmailHtml(args: {
  customerName: string;
  when: string;
  services: string;
  employees: string;
  manageHref: string;
}): string {
  return emailShell(`
    <p style="font-size:16px;margin:0 0 16px;">Kedves ${args.customerName}!</p>
    <p style="font-size:16px;margin:0 0 16px;">Foglalásod visszaigazoltuk:</p>
    <p style="font-size:16px;font-weight:bold;margin:0 0 4px;">${args.when}</p>
    <p style="font-size:15px;margin:0 0 16px;color:#5c534c;">${args.services} — ${args.employees}</p>
    <p style="font-size:14px;margin:0 0 24px;color:#5c534c;">
      24 órával előtte emlékeztetünk. Ha módosítanád vagy lemondanád, itt teheted meg:
    </p>
    <p style="margin:0;">
      <a href="${args.manageHref}" style="display:inline-block;background:#c98a6b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;">Foglalásom kezelése</a>
    </p>
  `);
}

function reminderEmailHtml(args: { customerName: string; when: string; services: string; manageHref: string }): string {
  return emailShell(`
    <p style="font-size:16px;margin:0 0 16px;">Kedves ${args.customerName}!</p>
    <p style="font-size:16px;margin:0 0 16px;">Emlékeztetőül: holnapra vár rád az időpontod:</p>
    <p style="font-size:16px;font-weight:bold;margin:0 0 4px;">${args.when}</p>
    <p style="font-size:15px;margin:0 0 24px;color:#5c534c;">${args.services}</p>
    <p style="font-size:14px;margin:0 0 24px;color:#5c534c;">
      Ha közben mégsem tudsz jönni, itt mondhatod le legkésőbb az időpont előtt 24 óráig:
    </p>
    <p style="margin:0;">
      <a href="${args.manageHref}" style="display:inline-block;background:#c98a6b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;">Foglalásom kezelése</a>
    </p>
  `);
}

export async function sendBookingConfirmation(payload: BookingNotificationPayload): Promise<void> {
  const when = formatWhen(payload.startTime);
  const services = payload.serviceNames.join(" + ");
  const employees = payload.employeeNames.join(" és ");
  const href = manageUrl(payload.manageToken);

  const tasks: Promise<void>[] = [
    sendSms(
      payload.customerPhone,
      `Bloom Szépségszalon: foglalásod visszaigazolva — ${when}, ${services}. Kezelés: ${href}`,
      "visszaigazolás",
      payload.bookingId,
    ),
  ];
  if (payload.customerEmail) {
    tasks.push(
      sendEmail(
        payload.customerEmail,
        "Foglalás visszaigazolva — Bloom Szépségszalon",
        confirmationEmailHtml({ customerName: payload.customerName, when, services, employees, manageHref: href }),
        "visszaigazolás",
        payload.bookingId,
      ),
    );
  }
  await Promise.allSettled(tasks);
}

export async function sendBookingReminder(payload: BookingNotificationPayload): Promise<void> {
  const when = formatWhen(payload.startTime);
  const services = payload.serviceNames.join(" + ");
  const href = manageUrl(payload.manageToken);

  const tasks: Promise<void>[] = [
    sendSms(
      payload.customerPhone,
      `Bloom Szépségszalon emlékeztető: holnap, ${when} — ${services}. Lemondás: ${href}`,
      "emlékeztető",
      payload.bookingId,
    ),
  ];
  if (payload.customerEmail) {
    tasks.push(
      sendEmail(
        payload.customerEmail,
        "Emlékeztető — holnapi időpontod a Bloom Szépségszalonban",
        reminderEmailHtml({ customerName: payload.customerName, when, services, manageHref: href }),
        "emlékeztető",
        payload.bookingId,
      ),
    );
  }
  await Promise.allSettled(tasks);
}

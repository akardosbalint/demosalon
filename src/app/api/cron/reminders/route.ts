import { NextRequest, NextResponse } from "next/server";
import { sendDueReminders } from "@/lib/reminders";

// Never cache/prerender a cron endpoint — every invocation must re-query
// "what's due right now".
export const dynamic = "force-dynamic";

/**
 * Triggered on a schedule by an external cron (Vercel Cron, cron-job.org,
 * a GitHub Actions workflow — anything that can issue a GET with a bearer
 * token on an interval). See README "Emlékeztető cron" for wiring.
 *
 * Requires CRON_SECRET to be set — fails closed (500) rather than running
 * unauthenticated, since anyone who could hit this without a token could
 * force reminders out ahead of schedule.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET nincs beállítva a szerveren." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDueReminders();
  return NextResponse.json({ ok: true, ...result });
}

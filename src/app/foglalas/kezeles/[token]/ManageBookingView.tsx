"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDuration, formatPrice } from "@/lib/format";
import { formatTimeInTimezone } from "@/lib/timezone";
import { cancelMyBookingAction } from "./actions";

export type ManageSegmentDTO = {
  startTime: string;
  endTime: string;
  serviceName: string;
  employeeName: string;
  price: number;
};

export type ManageBookingDTO = {
  status: "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  customerName: string;
  cancelledAt: string | null;
  segments: ManageSegmentDTO[];
};

function formatDateLabel(iso: string): string {
  return new Intl.DateTimeFormat("hu-HU", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(
    new Date(iso),
  );
}

export function ManageBookingView({
  token,
  booking,
  cancellationDeadlineHours,
}: {
  token: string;
  booking: ManageBookingDTO;
  cancellationDeadlineHours: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const earliestStart = booking.segments.reduce(
    (min, s) => (s.startTime < min ? s.startTime : min),
    booking.segments[0]?.startTime ?? new Date().toISOString(),
  );
  const latestEnd = booking.segments.reduce(
    (max, s) => (s.endTime > max ? s.endTime : max),
    booking.segments[0]?.endTime ?? new Date().toISOString(),
  );
  const deadline = new Date(new Date(earliestStart).getTime() - cancellationDeadlineHours * 60 * 60_000);
  const withinDeadline = new Date() < deadline;
  const totalPrice = booking.segments.reduce((sum, s) => sum + s.price, 0);
  const totalMinutes = Math.round((new Date(latestEnd).getTime() - new Date(earliestStart).getTime()) / 60_000);

  async function handleCancel() {
    setSubmitting(true);
    setError(null);
    const result = await cancelMyBookingAction(token);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-8">
      <p className="text-sm font-medium uppercase tracking-widest text-primary-hover">Bloom Szépségszalon</p>
      <h1 className="mt-2 text-xl font-semibold text-ink">Foglalásod</h1>
      <p className="text-sm text-ink-soft mb-6">{booking.customerName}</p>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="font-semibold text-ink capitalize">{formatDateLabel(earliestStart)}</p>
        <div className="mt-3 flex flex-col gap-2">
          {booking.segments.map((s, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink">
                {formatTimeInTimezone(new Date(s.startTime))} · {s.serviceName}
              </span>
              <span className="text-ink-soft whitespace-nowrap">{s.employeeName}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm font-medium text-ink border-t border-border pt-3">
          {formatDuration(totalMinutes)} · {formatPrice(totalPrice)}
        </p>
      </div>

      <div className="mt-5">
        {booking.status === "CANCELLED" && (
          <div className="rounded-2xl bg-border/60 p-4 text-sm text-ink-soft">
            Ez a foglalás le van mondva
            {booking.cancelledAt && ` (${formatDateLabel(booking.cancelledAt)})`}. Ha mégis időpontot
            szeretnél, foglalj újat a{" "}
            <Link href="/foglalas" className="text-primary-hover font-medium underline">
              foglalási oldalon
            </Link>
            .
          </div>
        )}

        {booking.status === "COMPLETED" && (
          <div className="rounded-2xl bg-success-soft p-4 text-sm text-ink">
            Ez az időpont már megtörtént — reméljük élvezted! Ha újra jönnél, itt tudsz{" "}
            <Link href="/foglalas" className="text-primary-hover font-medium underline">
              foglalni
            </Link>
            .
          </div>
        )}

        {booking.status === "NO_SHOW" && (
          <div className="rounded-2xl bg-danger-soft p-4 text-sm text-ink">
            Ezt az időpontot sajnos elmulasztottad. Ha új időpontot szeretnél,{" "}
            <Link href="/foglalas" className="text-primary-hover font-medium underline">
              itt tudsz foglalni
            </Link>
            .
          </div>
        )}

        {booking.status === "CONFIRMED" && !withinDeadline && (
          <div className="rounded-2xl bg-danger-soft p-4 text-sm text-ink">
            A lemondási határidő ({cancellationDeadlineHours} óra) már lejárt — ezt sajnos csak telefonon
            tudjuk módosítani.
          </div>
        )}

        {booking.status === "CONFIRMED" && withinDeadline && !confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="w-full rounded-xl border border-border py-3 text-sm font-medium text-ink hover:bg-card transition-colors"
          >
            Foglalás lemondása
          </button>
        )}

        {booking.status === "CONFIRMED" && withinDeadline && confirming && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm text-ink mb-3">Biztosan lemondod ezt az időpontot?</p>
            {error && (
              <p role="alert" className="mb-3 rounded-lg bg-danger-soft text-danger text-sm p-2">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={handleCancel}
                className="flex-1 rounded-xl bg-danger text-white font-semibold py-2.5 text-sm disabled:opacity-50"
              >
                {submitting ? "Lemondás…" : "Igen, lemondom"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm text-ink"
              >
                Mégse
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

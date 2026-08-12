import { prisma } from "@/lib/prisma";

export type ComboPopularity = {
  comboId: string;
  comboName: string;
  matchCount: number;
  totalBookings: number;
  /** Rounded percent of all bookings in the window that matched this exact
   * combo's service set. Null — not 0 — when there isn't enough data yet,
   * so callers can distinguish "genuinely unpopular" from "no data" and
   * never display a fabricated number. */
  percent: number | null;
};

function comboKey(serviceIds: string[]): string {
  return [...new Set(serviceIds)].sort().join("|");
}

/**
 * Real, computed combo popularity — never a seeded/curated number. A
 * "match" is a booking whose full set of distinct services is exactly one
 * predefined ServiceCombo's service set (not a superset or subset). Shared
 * by the admin stats page (src/app/admin/(dashboard)/statisztika) and the
 * guest-facing "a vendégek X%-a ezt választja" badge (src/lib/catalog.ts),
 * so the two surfaces can never drift onto different numbers.
 *
 * The window intentionally has no upper bound — like the other stats in
 * src/lib/admin.ts, this reads "the last `days` days through to any
 * already-booked future appointment", which is what "what are people
 * currently choosing" should mean for a salon that books ahead.
 */
export async function getComboPopularity(days = 90): Promise<ComboPopularity[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60_000);

  const [combos, segments] = await Promise.all([
    prisma.serviceCombo.findMany({ include: { items: true } }),
    // Cancelled bookings have their segments deleted (see cancelBooking),
    // so this naturally only ever sees non-cancelled bookings.
    prisma.bookingSegment.findMany({
      where: { startTime: { gte: since } },
      select: { bookingId: true, serviceId: true },
    }),
  ]);

  const servicesByBooking = new Map<string, Set<string>>();
  for (const seg of segments) {
    if (!servicesByBooking.has(seg.bookingId)) servicesByBooking.set(seg.bookingId, new Set());
    servicesByBooking.get(seg.bookingId)!.add(seg.serviceId);
  }

  const bookingKeys = [...servicesByBooking.values()].map((set) => comboKey([...set]));
  const totalBookings = bookingKeys.length;

  return combos.map((combo) => {
    const key = comboKey(combo.items.map((i) => i.serviceId));
    const matchCount = bookingKeys.filter((k) => k === key).length;
    return {
      comboId: combo.id,
      comboName: combo.name,
      matchCount,
      totalBookings,
      percent: totalBookings > 0 && matchCount > 0 ? Math.round((matchCount / totalBookings) * 100) : null,
    };
  });
}

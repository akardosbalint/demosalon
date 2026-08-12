import { getPopularServices, getUtilizationStats } from "@/lib/admin";
import { getComboPopularity } from "@/lib/stats";

const PERIOD_DAYS = 30;

export default async function AdminStatsPage() {
  const [utilization, popularServices, comboPopularity] = await Promise.all([
    getUtilizationStats(PERIOD_DAYS),
    getPopularServices(PERIOD_DAYS),
    getComboPopularity(PERIOD_DAYS),
  ]);

  const maxBookingCount = Math.max(1, ...popularServices.map((s) => s.bookingCount));
  // Sorted by actual match count, not the editorial popularityScore field —
  // this section must reflect what guests are really booking. Combos with
  // zero matches stay in the list (unlike the guest-facing badge, which
  // hides them) so admins get full visibility into what isn't landing.
  const sortedCombos = [...comboPopularity].sort((a, b) => b.matchCount - a.matchCount);
  const totalComboBookings = comboPopularity[0]?.totalBookings ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-ink">Statisztika</h1>
        <p className="text-sm text-ink-soft mt-1">Az elmúlt {PERIOD_DAYS} nap adatai alapján.</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-ink-soft mb-3 uppercase tracking-wide">
          Kihasználtság alkalmazottanként
        </h2>
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
          {utilization.length === 0 && (
            <p className="text-sm text-ink-soft">Nincs még aktív alkalmazott.</p>
          )}
          {utilization.map((row) => (
            <div key={row.employeeId}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-ink">{row.employeeName}</span>
                <span className="text-ink-soft">
                  {row.utilizationPercent}% · {Math.round(row.bookedMinutes / 60)} óra lefoglalva
                </span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-primary-soft overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, row.utilizationPercent)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-faint mt-2">
          A kihasználtság a lefoglalt percek aránya a napi 10 órás nyitvatartáshoz képest,
          {" "}
          {PERIOD_DAYS} napra vetítve — tájékoztató jellegű becslés, nem veszi figyelembe a
          munkarendi kivételeket (szabadság, műszakváltás).
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink-soft mb-3 uppercase tracking-wide">
          Legnépszerűbb szolgáltatások
        </h2>
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
          {popularServices.length === 0 && (
            <p className="text-sm text-ink-soft">Még nincs elég adat.</p>
          )}
          {popularServices.map((row) => (
            <div key={row.serviceId}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-ink">{row.serviceName}</span>
                <span className="text-ink-soft">{row.bookingCount} alkalom</span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-accent-soft overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${(row.bookingCount / maxBookingCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink-soft mb-3 uppercase tracking-wide">
          Legnépszerűbb szolgáltatás-kombinációk
        </h2>
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
          {totalComboBookings === 0 && (
            <p className="text-sm text-ink-soft">Még nincs elég adat.</p>
          )}
          {sortedCombos.map((row) => (
            <div key={row.comboId}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-ink">{row.comboName}</span>
                <span className="text-ink-soft">
                  {row.matchCount} alkalom{row.percent !== null ? ` · ${row.percent}%` : ""}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-primary-soft overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${totalComboBookings > 0 ? (row.matchCount / totalComboBookings) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-faint mt-2">
          Egy foglalás akkor számít egy kombináció találatának, ha a foglalt szolgáltatások
          halmaza pontosan megegyezik a kombináció összetételével — nem csak részhalmaza vagy
          bővebb annál.
        </p>
      </section>
    </div>
  );
}

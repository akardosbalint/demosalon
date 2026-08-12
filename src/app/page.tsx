import Link from "next/link";
import { getActiveEmployeesWithQualifications, getServicesAndCombos } from "@/lib/catalog";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/booking";
import { getEmployeeSchedules, type EmployeeSchedule } from "@/lib/staffing";
import { formatDuration, formatPrice } from "@/lib/format";

export const metadata = {
  title: "Bloom Szépségszalon — Foglalj időpontot percek alatt",
  description:
    "Hajvágás, festés, manikűr, szemöldök és még sok más — foglalj online, regisztráció nélkül, a Bloom Szépségszalonban.",
};

// Real service/combo/employee data, read fresh on every request — same
// reasoning as src/app/foglalas/page.tsx: a static build would bake in
// stale IDs and prices after any DB change.
export const dynamic = "force-dynamic";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

// Monday-first display order; EmployeeSchedule.week itself stays indexed
// 0 (Sunday) .. 6 (Saturday) to match the DB/booking-engine convention.
const WEEKDAY_SHORT = ["V", "H", "K", "Sze", "Cs", "P", "Szo"];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** A compact "K · Sze · Cs · P · Szo · 9:00–19:00"-style summary of when an
 * employee works — real data from the same EmployeeAvailability rows the
 * booking engine itself enforces (src/lib/booking.ts), not a guess. */
function formatSchedule(schedule: EmployeeSchedule | undefined): string {
  if (!schedule || !schedule.configured) {
    return `Minden nap · ${DEFAULT_BUSINESS_HOURS.startHour}:00–${DEFAULT_BUSINESS_HOURS.endHour}:00`;
  }
  const workingDays = DISPLAY_ORDER.filter((d) => schedule.week[d] !== null);
  if (workingDays.length === 0) return "Jelenleg nem fogad időpontot";

  const dayLabel = workingDays.map((d) => WEEKDAY_SHORT[d]).join(" · ");
  const hourSpans = new Set(workingDays.map((d) => `${schedule.week[d]!.startHour}–${schedule.week[d]!.endHour}`));
  if (hourSpans.size === 1) {
    return `${dayLabel} · ${[...hourSpans][0].replace("–", ":00–")}:00`;
  }
  return dayLabel;
}

/** A simple 5-petal flower built from rotated ellipses — decorative only,
 * no fabricated "real" photo or claim behind it. */
function Flower({ className, petalColor }: { className?: string; petalColor: string }) {
  return (
    <svg viewBox="-30 -30 60 60" className={className} aria-hidden="true">
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse key={angle} cx="0" cy="-15" rx="8.5" ry="13.5" transform={`rotate(${angle})`} fill={petalColor} />
      ))}
      <circle r="6" fill="var(--color-primary)" />
    </svg>
  );
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12 0 L14.83 9.17 L24 12 L14.83 14.83 L12 24 L9.17 14.83 L0 12 L9.17 9.17 Z" />
    </svg>
  );
}

const TRUST_CHIPS = [
  "Nincs szükség regisztrációra",
  "Garantáltan nincs dupla foglalás",
  "Azonnali visszaigazolás e-mailben és SMS-ben",
  "24 órán belül önállóan lemondható",
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Válaszd ki, mire van szükséged",
    body: "Egyetlen szolgáltatás vagy egy összeállított kombináció — bármit foglalhatsz egy menetben.",
  },
  {
    step: "2",
    title: "Válassz szakembert",
    body: "Kiválasztod a kedvenced, vagy ránk bízod, hogy megtaláljuk az első szabad időpontot bárkinél.",
  },
  {
    step: "3",
    title: "Foglald le — és kész",
    body: "Pár kattintás, nincs fiók, nincs telefonhívás. A visszaigazolás azonnal megérkezik.",
  },
];

const FAQ = [
  {
    q: "Kell regisztrálnom a foglaláshoz?",
    a: "Nem. Csak a neved, a telefonszámod és az e-mail címed kérjük — fiók létrehozása nélkül is lefoglalhatod az időpontot.",
  },
  {
    q: "Mi van, ha mégsem tudok elmenni?",
    a: "A visszaigazolásban kapott linken bármikor megnézheted és lemondhatod a foglalást — legkésőbb az időpont előtt 24 órával, telefonhívás nélkül.",
  },
  {
    q: "Honnan tudom, hogy sikerült a foglalás?",
    a: "Azonnal visszaigazolást kapsz e-mailben és SMS-ben, benne minden részlettel és a foglalás-kezelő linkkel.",
  },
  {
    q: "Válogathatok a szakemberek közül?",
    a: "Igen — kiválaszthatod a kedvenc szakembered, vagy rábízhatod a rendszerre, hogy megtalálja nála (vagy bárkinél) az első szabad időpontot.",
  },
  {
    q: "Mennyi ideig tart lefoglalni egy időpontot?",
    a: "Körülbelül két percig: szolgáltatás, szakember, majd nap és időpont kiválasztása — utána már csak a visszaigazolásra kell várni.",
  },
];

export default async function LandingPage() {
  const [{ services, combos }, employees, schedules] = await Promise.all([
    getServicesAndCombos(),
    getActiveEmployeesWithQualifications(),
    getEmployeeSchedules(),
  ]);

  const featuredCombos = combos.filter((c) => c.isFeatured);
  const scheduleByEmployee = new Map(schedules.map((s) => [s.employeeId, s]));

  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl tracking-tight text-ink">Bloom Szépségszalon</span>
        <nav className="hidden items-center gap-6 text-sm font-medium text-ink-soft sm:flex">
          <a href="#szolgaltatasok" className="hover:text-ink transition-colors">
            Szolgáltatások
          </a>
          <a href="#csapat" className="hover:text-ink transition-colors">
            Csapat
          </a>
          <a href="#gyik" className="hover:text-ink transition-colors">
            GYIK
          </a>
        </nav>
        <Link
          href="/foglalas"
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-primary-hover"
        >
          Időpont foglalása
        </Link>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-32 h-96 w-96 rounded-full bg-primary-soft blur-3xl opacity-70"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-blush-soft blur-3xl opacity-70"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/3 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent-soft blur-3xl opacity-40"
        />

        <Flower
          petalColor="var(--color-blush)"
          className="pointer-events-none absolute left-1 top-3 h-11 w-11 -rotate-12 opacity-90 sm:left-[8%] sm:top-16 sm:h-20 sm:w-20"
        />
        <Flower
          petalColor="var(--color-accent-soft)"
          className="pointer-events-none absolute right-1 top-3 h-8 w-8 rotate-45 opacity-80 sm:right-[10%] sm:top-28 sm:h-14 sm:w-14"
        />
        <Sparkle className="pointer-events-none absolute left-[20%] top-2 h-3.5 w-3.5 text-blush sm:top-10 sm:left-[24%] sm:h-4 sm:w-4" />
        <Sparkle className="pointer-events-none absolute right-[18%] top-56 hidden h-5 w-5 text-primary sm:block sm:right-[22%]" />
        <Sparkle className="pointer-events-none absolute right-[12%] top-4 h-3 w-3 text-accent sm:right-[6%] sm:top-8" />

        <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-6 pb-16 pt-10 text-center sm:pt-16">
          <p className="text-sm font-medium uppercase tracking-widest text-primary-hover">
            Hajápolás · Köröm · Szemöldök &amp; szempilla
          </p>
          <h1 className="max-w-2xl text-balance font-display text-4xl leading-tight text-ink sm:text-6xl">
            Foglalj időpontot percek alatt, regisztráció nélkül
          </h1>
          <p className="max-w-xl text-lg text-ink-soft">
            Válaszd ki a szolgáltatást vagy a kedvenc szakembered, nézd meg az élő szabad
            időpontokat, és mi összehangoljuk a többit — a helyszínen csak élvezned kell.
          </p>
          <div className="mt-2 flex flex-col items-center gap-3">
            <Link
              href="/foglalas"
              className="rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-soft transition-colors hover:bg-primary-hover"
            >
              Időpont foglalása
            </Link>
            <p className="text-xs text-ink-faint">Nincs regisztráció · 2 perc alatt kész</p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {TRUST_CHIPS.map((chip) => (
              <span key={chip} className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-success">
                  <path
                    fillRule="evenodd"
                    d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.415 0l-3.5-3.5a1 1 0 111.415-1.415L8.5 12.086l6.79-6.795a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {chip}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-card/60">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 className="text-center font-display text-2xl text-ink sm:text-3xl">Hogyan működik</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                  {item.step}
                </span>
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="text-sm text-ink-soft">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured combos */}
      {featuredCombos.length > 0 && (
        <section className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Vendégeink kedvencei</h2>
          <p className="mt-1 font-display text-2xl text-ink sm:text-3xl">Összeállított kombinációk</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {featuredCombos.map((combo) => {
              const items = combo.items;
              const minutes = items.reduce(
                (sum, i, idx) =>
                  sum + i.service.durationMinutes + (idx < items.length - 1 ? i.service.processingTimeMinutes : 0),
                0,
              );
              const price = items.reduce((sum, i) => sum + i.service.price, 0);
              return (
                <Link
                  key={combo.id}
                  href="/foglalas"
                  className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-soft-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-ink">{combo.name}</p>
                    {combo.realPopularityPercent !== null && (
                      <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                        a vendégek {combo.realPopularityPercent}%-a ezt választja
                      </span>
                    )}
                  </div>
                  {combo.description && <p className="text-sm text-ink-soft">{combo.description}</p>}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink">
                      kb. {formatDuration(minutes)} · {formatPrice(price)}
                    </p>
                    <span className="text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Foglalom →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Services */}
      <section id="szolgaltatasok" className="scroll-mt-20 border-t border-border bg-card/60">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Kínálatunk</h2>
          <p className="mt-1 font-display text-2xl text-ink sm:text-3xl">Válassz szolgáltatást</p>
          <p className="mt-2 text-sm text-ink-soft">
            {services.length} szolgáltatás, {employees.length} szakember — és tetszőlegesen kombinálhatod őket.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <div
                key={s.id}
                className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary/40"
              >
                <div>
                  <p className="font-medium text-ink">{s.name}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">{s.description}</p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <p className="font-semibold text-ink">{formatPrice(s.price)}</p>
                  <p className="text-ink-faint">{formatDuration(s.durationMinutes)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section id="csapat" className="scroll-mt-20 mx-auto w-full max-w-5xl px-6 py-16">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Csapatunk</h2>
        <p className="mt-1 font-display text-2xl text-ink sm:text-3xl">Kitől kérhetsz időpontot</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((e) => (
            <div key={e.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-hover">
                  {initials(e.name)}
                </span>
                <div>
                  <p className="font-semibold text-ink">{e.name}</p>
                  <p className="text-sm text-ink-faint">{e.experienceYears} év tapasztalat</p>
                </div>
              </div>
              <p className="text-sm text-ink-soft">{e.bio}</p>
              <p className="mt-auto flex items-center gap-1.5 text-xs font-medium text-ink-faint">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                    clipRule="evenodd"
                  />
                </svg>
                {formatSchedule(scheduleByEmployee.get(e.id))}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="gyik" className="scroll-mt-20 border-t border-border bg-card/60">
        <div className="mx-auto w-full max-w-3xl px-6 py-16">
          <h2 className="text-center font-display text-2xl text-ink sm:text-3xl">Gyakori kérdések</h2>
          <div className="mt-8 flex flex-col gap-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-border bg-card px-5 py-4 shadow-soft [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
                  {item.q}
                  <span className="shrink-0 text-lg text-ink-faint transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-ink-soft">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border bg-primary-soft">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-6 py-16 text-center">
          <p className="font-display text-2xl text-ink sm:text-3xl">Készen állsz a foglalásra?</p>
          <p className="max-w-md text-ink-soft">
            Nyitva {DEFAULT_BUSINESS_HOURS.startHour}:00–{DEFAULT_BUSINESS_HOURS.endHour}:00 — foglalj
            online, amikor neked kényelmes.
          </p>
          <Link
            href="/foglalas"
            className="mt-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-soft transition-colors hover:bg-primary-hover"
          >
            Időpont foglalása
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-5xl flex-col items-center gap-1 px-6 pb-24 pt-8 text-center text-sm text-ink-faint sm:pb-8">
        <p>© {new Date().getFullYear()} Bloom Szépségszalon</p>
        <Link href="/admin/login" className="text-ink-faint underline decoration-dotted hover:text-ink-soft">
          Admin belépés
        </Link>
      </footer>

      {/* Mobile sticky CTA — the page is long on a phone; keep booking one thumb-tap away. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-cream/95 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:hidden">
        <Link
          href="/foglalas"
          className="block rounded-xl bg-primary py-3 text-center text-sm font-semibold text-white shadow-soft transition-colors hover:bg-primary-hover"
        >
          Időpont foglalása
        </Link>
      </div>
    </main>
  );
}

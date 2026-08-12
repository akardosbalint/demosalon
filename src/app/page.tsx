import Link from "next/link";
import { getActiveEmployeesWithQualifications, getServicesAndCombos } from "@/lib/catalog";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/booking";
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

const VALUE_PROPS = [
  {
    title: "Nincs szükség regisztrációra",
    body: "Válaszd ki a szolgáltatást, add meg az elérhetőséged, és kész — fiók nélkül is foglalhatsz.",
  },
  {
    title: "Valódi, élő szabad időpontok",
    body: "Amit a naptárban látsz, azt foglalhatod is — a rendszer garantáltan nem enged két vendéget egy időpontra.",
  },
  {
    title: "Bármikor módosíthatod",
    body: "A visszaigazolásban kapott linkkel saját magad mondhatod le a foglalást, akár telefonhívás nélkül.",
  },
];

export default async function LandingPage() {
  const [{ services, combos }, employees] = await Promise.all([
    getServicesAndCombos(),
    getActiveEmployeesWithQualifications(),
  ]);

  const featuredCombos = combos.filter((c) => c.isFeatured);

  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight text-ink">Bloom Szépségszalon</span>
        <Link
          href="/foglalas"
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-primary-hover"
        >
          Időpont foglalása
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-5 px-6 pb-20 pt-10 text-center sm:pt-16">
        <p className="text-sm font-medium uppercase tracking-widest text-primary-hover">
          Hajápolás · Köröm · Szemöldök &amp; szempilla
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-ink sm:text-5xl">
          Foglalj időpontot percek alatt, regisztráció nélkül
        </h1>
        <p className="max-w-xl text-lg text-ink-soft">
          Válaszd ki a szolgáltatást vagy a kedvenc szakembered, nézd meg az élő szabad
          időpontokat, és mi összehangoljuk a többit — a helyszínen csak élvezned kell.
        </p>
        <Link
          href="/foglalas"
          className="mt-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-soft transition-colors hover:bg-primary-hover"
        >
          Időpont foglalása
        </Link>
      </section>

      {/* Value props */}
      <section className="border-y border-border bg-card/60">
        <div className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-14 sm:grid-cols-3">
          {VALUE_PROPS.map((v) => (
            <div key={v.title} className="flex flex-col gap-2">
              <span className="h-1.5 w-8 rounded-full bg-primary" aria-hidden="true" />
              <p className="font-semibold text-ink">{v.title}</p>
              <p className="text-sm text-ink-soft">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured combos */}
      {featuredCombos.length > 0 && (
        <section className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Vendégeink kedvencei
          </h2>
          <p className="mt-1 text-2xl font-semibold text-ink">Összeállított kombinációk</p>
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
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-primary/50"
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
                  <p className="text-sm font-medium text-ink">
                    kb. {formatDuration(minutes)} · {formatPrice(price)}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Services */}
      <section className="border-t border-border bg-card/60">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Kínálatunk</h2>
          <p className="mt-1 text-2xl font-semibold text-ink">Válassz szolgáltatást</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <div
                key={s.id}
                className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft"
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
      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Csapatunk</h2>
        <p className="mt-1 text-2xl font-semibold text-ink">Kitől kérhetsz időpontot</p>
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
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border bg-primary-soft">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-6 py-16 text-center">
          <p className="text-2xl font-semibold text-ink">Készen állsz a foglalásra?</p>
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

      <footer className="mx-auto flex w-full max-w-5xl flex-col items-center gap-1 px-6 py-8 text-center text-sm text-ink-faint">
        <p>© {new Date().getFullYear()} Bloom Szépségszalon</p>
        <Link href="/admin/login" className="text-ink-faint underline decoration-dotted hover:text-ink-soft">
          Admin belépés
        </Link>
      </footer>
    </main>
  );
}

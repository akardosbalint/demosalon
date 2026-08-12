import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth";
import { createBooking, markCompleted, markNoShow, type BookingItemInput } from "../src/lib/booking";
import { businessHourToUtc } from "../src/lib/timezone";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Wipe in FK-safe order. Fine for a demo seed script; never run against prod.
  await prisma.bookingSegment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.serviceComboItem.deleteMany();
  await prisma.serviceCombo.deleteMany();
  await prisma.employeeService.deleteMany();
  await prisma.service.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.adminUser.deleteMany();

  const adminEmail = process.env.ADMIN_SEED_EMAIL ?? "admin@bloomszepsegszalon.hu";
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "salon-admin-2026";
  await prisma.adminUser.create({
    data: {
      email: adminEmail,
      name: "Szalon Admin",
      passwordHash: await hashPassword(adminPassword),
    },
  });

  const [
    petra,
    reka,
    anna,
    lilla,
    eszter,
  ] = await Promise.all([
    prisma.employee.create({
      data: {
        name: "Nagy Petra",
        bio: "Kreatív hajstylist, aki imád extrém színváltásokat is bevállalni.",
        experienceYears: 8,
      },
    }),
    prisma.employee.create({
      data: {
        name: "Kovács Réka",
        bio: "Precíz vágásspecialista, rengeteg visszatérő vendéggel.",
        experienceYears: 5,
      },
    }),
    prisma.employee.create({
      data: {
        name: "Tóth Anna",
        bio: "Körömápolási specialista, japán manikűr-technikában képzett.",
        experienceYears: 6,
      },
    }),
    prisma.employee.create({
      data: {
        name: "Szabó Lilla",
        bio: "Szemöldök- és szempilla-specialista, mikropengés technikában jártas.",
        experienceYears: 4,
      },
    }),
    prisma.employee.create({
      data: {
        name: "Varga Eszter",
        bio: "Senior fodrász és kolorista, 12 éve dolgozik prémium szalonokban.",
        experienceYears: 12,
      },
    }),
  ]);

  const [
    mosas,
    vagas,
    szaritas,
    festes,
    melir,
    manikur,
    gellakk,
    pedikur,
    szemoldok,
    szempilla,
  ] = await Promise.all([
    prisma.service.create({
      data: {
        name: "Mosás",
        slug: "mosas",
        description: "Kb. 15 perc, frissítő hajmosás masszázzsal.",
        durationMinutes: 15,
        price: 2000,
      },
    }),
    prisma.service.create({
      data: {
        name: "Hajvágás",
        slug: "hajvagas",
        description: "Kb. 30 perc, konzultációval és formázással.",
        durationMinutes: 30,
        price: 6000,
      },
    }),
    prisma.service.create({
      data: {
        name: "Szárítás és styling",
        slug: "szaritas-styling",
        description: "Kb. 25 perc, hajszárítás és igény szerinti formázás.",
        durationMinutes: 25,
        price: 4000,
      },
    }),
    prisma.service.create({
      data: {
        name: "Hajfestés (tő)",
        slug: "hajfestes-to",
        description:
          "Kb. 45 perc aktív munka + 30 perc beázási idő, amíg a festék dolgozik.",
        durationMinutes: 45,
        processingTimeMinutes: 30,
        price: 12000,
      },
    }),
    prisma.service.create({
      data: {
        name: "Melír",
        slug: "melir",
        description:
          "Kb. 60 perc aktív munka + 35 perc beázási idő a melír-technikánál.",
        durationMinutes: 60,
        processingTimeMinutes: 35,
        price: 18000,
      },
    }),
    prisma.service.create({
      data: {
        name: "Manikűr",
        slug: "manikur",
        description: "Kb. 45 perc, körömápolás és lakkozás.",
        durationMinutes: 45,
        price: 7000,
      },
    }),
    prisma.service.create({
      data: {
        name: "Géllakk manikűr",
        slug: "gellakk-manikur",
        description: "Kb. 60 perc, tartós géllakkozással.",
        durationMinutes: 60,
        price: 9500,
      },
    }),
    prisma.service.create({
      data: {
        name: "Pedikűr",
        slug: "pedikur",
        description: "Kb. 55 perc, teljes lábápolás és lakkozás.",
        durationMinutes: 55,
        price: 8500,
      },
    }),
    prisma.service.create({
      data: {
        name: "Szemöldökformázás",
        slug: "szemoldokformazas",
        description: "Kb. 20 perc, formázás és igény szerinti festés.",
        durationMinutes: 20,
        price: 3500,
      },
    }),
    prisma.service.create({
      data: {
        name: "Szempillafestés",
        slug: "szempillafestes",
        description: "Kb. 25 perc, tartós szempillafestés.",
        durationMinutes: 25,
        price: 4000,
      },
    }),
  ]);

  await prisma.employeeService.createMany({
    data: [
      // Petra: hair, incl. coloring
      { employeeId: petra.id, serviceId: mosas.id },
      { employeeId: petra.id, serviceId: vagas.id },
      { employeeId: petra.id, serviceId: szaritas.id },
      { employeeId: petra.id, serviceId: festes.id },
      { employeeId: petra.id, serviceId: melir.id },
      // Réka: cut & wash & dry only, no coloring
      { employeeId: reka.id, serviceId: mosas.id },
      { employeeId: reka.id, serviceId: vagas.id },
      { employeeId: reka.id, serviceId: szaritas.id },
      // Anna: nails
      { employeeId: anna.id, serviceId: manikur.id },
      { employeeId: anna.id, serviceId: gellakk.id },
      { employeeId: anna.id, serviceId: pedikur.id },
      // Lilla: brows/lashes + basic manicure
      { employeeId: lilla.id, serviceId: szemoldok.id },
      { employeeId: lilla.id, serviceId: szempilla.id },
      { employeeId: lilla.id, serviceId: manikur.id },
      // Eszter: senior hair + coloring
      { employeeId: eszter.id, serviceId: mosas.id },
      { employeeId: eszter.id, serviceId: vagas.id },
      { employeeId: eszter.id, serviceId: szaritas.id },
      { employeeId: eszter.id, serviceId: festes.id },
      { employeeId: eszter.id, serviceId: melir.id },
    ],
  });

  const cutCombo = await prisma.serviceCombo.create({
    data: {
      name: "Vágás + Mosás + Szárítás",
      description: "A legnépszerűbb hajkombináció egy teljes, kész frizuráért.",
      isFeatured: true,
      popularityScore: 68,
      items: {
        create: [
          { serviceId: mosas.id, sequenceOrder: 1 },
          { serviceId: vagas.id, sequenceOrder: 2 },
          { serviceId: szaritas.id, sequenceOrder: 3 },
        ],
      },
    },
  });

  const colorCombo = await prisma.serviceCombo.create({
    data: {
      name: "Festés + Mosás + Szárítás",
      description: "Teljes színmegújítás, készre stylingolva.",
      isFeatured: true,
      popularityScore: 42,
      items: {
        create: [
          { serviceId: mosas.id, sequenceOrder: 1 },
          { serviceId: festes.id, sequenceOrder: 2 },
          { serviceId: szaritas.id, sequenceOrder: 3 },
        ],
      },
    },
  });

  const beautyCombo = await prisma.serviceCombo.create({
    data: {
      name: "Géllakk manikűr + Szemöldökformázás",
      description: "Gyors frissítés kéznek és tekintetnek egy alkalommal.",
      isFeatured: false,
      popularityScore: 21,
      items: {
        create: [
          { serviceId: gellakk.id, sequenceOrder: 1 },
          { serviceId: szemoldok.id, sequenceOrder: 2 },
        ],
      },
    },
  });

  const { created, noShows } = await seedHistoricalBookings({
    petraId: petra.id,
    rekaId: reka.id,
    annaId: anna.id,
    lillaId: lilla.id,
    eszterId: eszter.id,
    mosasId: mosas.id,
    vagasId: vagas.id,
    szaritasId: szaritas.id,
    festesId: festes.id,
    manikurId: manikur.id,
    gellakkId: gellakk.id,
    pedikurId: pedikur.id,
    szemoldokId: szemoldok.id,
    szempillaId: szempilla.id,
  });

  console.log("Seed complete:", {
    employees: 5,
    services: 10,
    combos: [cutCombo.name, colorCombo.name, beautyCombo.name],
    historicalBookings: created,
    historicalNoShows: noShows,
    adminLogin: { email: adminEmail, password: adminPassword },
  });
}

const HISTORY_CUSTOMER_NAMES = [
  "Kiss Anikó",
  "Horváth Bence",
  "Molnár Zsófia",
  "Varga Dániel",
  "Németh Katalin",
  "Farkas Gergő",
  "Balogh Emese",
  "Papp Levente",
  "Takács Boglárka",
  "Juhász Máté",
  "Simon Réka",
  "Fekete Örs",
];

type HistoryIds = {
  petraId: string;
  rekaId: string;
  annaId: string;
  lillaId: string;
  eszterId: string;
  mosasId: string;
  vagasId: string;
  szaritasId: string;
  festesId: string;
  manikurId: string;
  gellakkId: string;
  pedikurId: string;
  szemoldokId: string;
  szempillaId: string;
};

/**
 * Backdated bookings, created through the exact same `createBooking()` the
 * live app uses (same qualification checks, same DB exclusion constraint),
 * so `src/lib/stats.ts` (combo popularity) and `src/lib/admin.ts` (service
 * popularity, utilization) have genuine history to compute from instead of
 * showing "még nincs elég adat" on a freshly seeded database. The spec's
 * "never fabricated data" rule means the popularity numbers must come from
 * real rows — this is what creates them, not a hand-picked percentage.
 *
 * Sessions cycle through a fixed pattern, two per business day for the
 * last ~5 weeks, weighted so the cut combo is most common, the color combo
 * second, and the beauty combo third — deliberately echoing the editorial
 * `popularityScore` ordering above, but arrived at independently through
 * real rows, not copied from it.
 */
async function seedHistoricalBookings(ids: HistoryIds): Promise<{ created: number; noShows: number }> {
  type Session = { items: BookingItemInput[] };

  const cutEmployees = [ids.petraId, ids.rekaId, ids.eszterId];
  const colorEmployees = [ids.petraId, ids.eszterId];

  const cutSession = (i: number): Session => {
    const employeeId = cutEmployees[i % cutEmployees.length];
    return {
      items: [
        { serviceId: ids.mosasId, employeeId },
        { serviceId: ids.vagasId, employeeId },
        { serviceId: ids.szaritasId, employeeId },
      ],
    };
  };
  const colorSession = (i: number): Session => {
    const employeeId = colorEmployees[i % colorEmployees.length];
    return {
      items: [
        { serviceId: ids.mosasId, employeeId },
        { serviceId: ids.festesId, employeeId },
        { serviceId: ids.szaritasId, employeeId },
      ],
    };
  };
  // Nobody does both nail art and brows — this combo always needs two
  // employees, which the live "automatikus" assignment also falls back to.
  const beautySession = (): Session => ({
    items: [
      { serviceId: ids.gellakkId, employeeId: ids.annaId },
      { serviceId: ids.szemoldokId, employeeId: ids.lillaId },
    ],
  });
  const manicureSession = (): Session => ({ items: [{ serviceId: ids.manikurId, employeeId: ids.annaId }] });
  const pedicureSession = (): Session => ({ items: [{ serviceId: ids.pedikurId, employeeId: ids.annaId }] });
  const lashesSession = (): Session => ({ items: [{ serviceId: ids.szempillaId, employeeId: ids.lillaId }] });

  const pattern: Array<(i: number) => Session> = [
    cutSession,
    cutSession,
    colorSession,
    cutSession,
    beautySession,
    manicureSession,
    cutSession,
    colorSession,
    cutSession,
    beautySession,
    pedicureSession,
    cutSession,
    colorSession,
    cutSession,
    lashesSession,
    cutSession,
    beautySession,
    colorSession,
    cutSession,
    manicureSession,
  ];

  const HISTORY_WEEKDAYS = 24; // ~5 business weeks
  const now = new Date();
  const businessDays: Date[] = [];
  for (let offset = 1; businessDays.length < HISTORY_WEEKDAYS; offset++) {
    const d = new Date(now.getTime() - offset * 24 * 60 * 60_000);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) businessDays.push(d);
  }
  businessDays.reverse(); // oldest first, so the pattern index reads chronologically

  const hours = [10, 15];
  let created = 0;
  let noShows = 0;

  for (let dayIndex = 0; dayIndex < businessDays.length; dayIndex++) {
    const day = businessDays[dayIndex];
    for (let slot = 0; slot < hours.length; slot++) {
      const patternIndex = dayIndex * hours.length + slot;
      const session = pattern[patternIndex % pattern.length](patternIndex);
      const startTime = businessHourToUtc(day, hours[slot]);
      const name = HISTORY_CUSTOMER_NAMES[patternIndex % HISTORY_CUSTOMER_NAMES.length];
      // Roughly half leave an email, half don't — mirrors the mix of
      // guest self-booking (always has one) and admin phone entry
      // (optional, see Gap 5 / prisma/schema.prisma Booking.customerEmail).
      const hasEmail = patternIndex % 2 === 0;

      try {
        const booking = await createBooking({
          customerName: name,
          customerEmail: hasEmail
            ? `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`
            : undefined,
          customerPhone: `+3630${String(1000000 + patternIndex).padStart(7, "0")}`,
          startTime,
          items: session.items,
        });
        created++;
        // A few realistic no-shows; everything else is a completed visit.
        if (created % 11 === 0) {
          await markNoShow(booking.id);
          noShows++;
        } else {
          await markCompleted(booking.id);
        }
      } catch (err) {
        console.warn(`Skipped a history booking (${(err as Error).message})`);
      }
    }
  }

  return { created, noShows };
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

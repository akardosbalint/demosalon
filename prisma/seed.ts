import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth";

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

  console.log("Seed complete:", {
    employees: 5,
    services: 10,
    combos: [cutCombo.name, colorCombo.name, beautyCombo.name],
    adminLogin: { email: adminEmail, password: adminPassword },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

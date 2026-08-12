import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export async function resetDb() {
  await prisma.bookingSegment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.serviceComboItem.deleteMany();
  await prisma.serviceCombo.deleteMany();
  await prisma.employeeService.deleteMany();
  await prisma.employeeAvailability.deleteMany();
  await prisma.service.deleteMany();
  await prisma.employee.deleteMany();
}

function unique(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

export async function createTestEmployee(overrides: { name?: string; active?: boolean } = {}) {
  return prisma.employee.create({
    data: {
      name: overrides.name ?? unique("Employee"),
      bio: "Teszt szakember.",
      experienceYears: 3,
      active: overrides.active ?? true,
    },
  });
}

export async function createTestService(
  overrides: {
    name?: string;
    durationMinutes?: number;
    processingTimeMinutes?: number;
    price?: number;
    active?: boolean;
  } = {},
) {
  const name = overrides.name ?? unique("Service");
  return prisma.service.create({
    data: {
      name,
      slug: unique("service-slug"),
      description: "Teszt szolgáltatás.",
      durationMinutes: overrides.durationMinutes ?? 30,
      processingTimeMinutes: overrides.processingTimeMinutes ?? 0,
      price: overrides.price ?? 5000,
      active: overrides.active ?? true,
    },
  });
}

export async function qualify(employeeId: string, serviceId: string) {
  await prisma.employeeService.create({ data: { employeeId, serviceId } });
}

/** Gives a test employee an explicit weekly schedule — once any row exists
 * for them, weekdays not listed here become days off (see
 * src/lib/booking.ts segmentWithinAvailability). */
export async function setAvailability(
  employeeId: string,
  week: { dayOfWeek: number; startHour: number; endHour: number }[],
) {
  await prisma.employeeAvailability.createMany({
    data: week.map((w) => ({ employeeId, ...w })),
  });
}

export function customer(overrides: Partial<{ customerName: string; customerEmail: string; customerPhone: string }> = {}) {
  return {
    customerName: overrides.customerName ?? "Teszt Vendég",
    customerEmail: overrides.customerEmail ?? `${unique("vendeg")}@example.com`,
    customerPhone: overrides.customerPhone ?? "+36301234567",
  };
}

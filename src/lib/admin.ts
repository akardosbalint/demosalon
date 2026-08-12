import { prisma } from "@/lib/prisma";
import { localDayRangeUtc } from "@/lib/timezone";

export function dateKeyToDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export async function getDaySegments(dateKey: string) {
  const { start, end } = localDayRangeUtc(dateKeyToDate(dateKey));
  return prisma.bookingSegment.findMany({
    where: { startTime: { lt: end }, endTime: { gt: start } },
    include: {
      booking: {
        select: { id: true, customerName: true, customerPhone: true, status: true, notes: true },
      },
      service: { select: { id: true, name: true } },
      employee: { select: { id: true, name: true } },
    },
    orderBy: { startTime: "asc" },
  });
}

export async function getActiveEmployeesForCalendar() {
  return prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export type UtilizationStat = {
  employeeId: string;
  employeeName: string;
  bookedMinutes: number;
  availableMinutes: number;
  utilizationPercent: number;
};

export type PopularServiceStat = {
  serviceId: string;
  serviceName: string;
  bookingCount: number;
};

/**
 * Utilization per employee and most-booked services over the last `days`
 * days (default 30), counting only non-cancelled bookings (cancelled ones
 * have no segments left, so they're excluded automatically — see
 * cancelBooking in src/lib/booking.ts).
 */
export async function getUtilizationStats(
  days = 30,
  businessHoursMinutesPerDay = 10 * 60,
): Promise<UtilizationStat[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60_000);
  const employees = await prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  // Prisma's groupBy can't sum a computed duration (endTime - startTime), so
  // the per-employee booked-minutes total is accumulated manually below.
  const rows = await prisma.bookingSegment.findMany({
    where: { startTime: { gte: since } },
    select: { employeeId: true, startTime: true, endTime: true },
  });

  const minutesByEmployee = new Map<string, number>();
  for (const row of rows) {
    const minutes = (row.endTime.getTime() - row.startTime.getTime()) / 60_000;
    minutesByEmployee.set(row.employeeId, (minutesByEmployee.get(row.employeeId) ?? 0) + minutes);
  }

  const availableMinutes = days * businessHoursMinutesPerDay;

  return employees.map((e) => {
    const bookedMinutes = minutesByEmployee.get(e.id) ?? 0;
    return {
      employeeId: e.id,
      employeeName: e.name,
      bookedMinutes: Math.round(bookedMinutes),
      availableMinutes,
      utilizationPercent: Math.round((bookedMinutes / availableMinutes) * 100),
    };
  });
}

export async function getPopularServices(days = 30, limit = 8): Promise<PopularServiceStat[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60_000);
  const grouped = await prisma.bookingSegment.groupBy({
    by: ["serviceId"],
    where: { startTime: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { serviceId: "desc" } },
    take: limit,
  });
  const services = await prisma.service.findMany({
    where: { id: { in: grouped.map((g) => g.serviceId) } },
  });
  const nameById = new Map(services.map((s) => [s.id, s.name]));

  return grouped.map((g) => ({
    serviceId: g.serviceId,
    serviceName: nameById.get(g.serviceId) ?? "Ismeretlen",
    bookingCount: g._count._all,
  }));
}

import { prisma } from "@/lib/prisma";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/booking";
import { InvalidBookingRequestError } from "@/lib/booking-errors";

export const WEEKDAY_LABELS = ["Vasárnap", "Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat"];

export type DayAvailability = { dayOfWeek: number; startHour: number; endHour: number } | null;

export type EmployeeSchedule = {
  employeeId: string;
  employeeName: string;
  active: boolean;
  /** False when the employee has zero EmployeeAvailability rows — every
   * `week` entry is then null too, but that must NOT be read as "never
   * works": src/lib/booking.ts treats an unconfigured employee as
   * available every day within the salon's default hours. Callers that
   * display the schedule (not just edit it) need this to avoid showing
   * a fully-unconfigured employee as fully booked off. */
  configured: boolean;
  /** Index 0 = Sunday .. 6 = Saturday. Null means "not working that day". */
  week: DayAvailability[];
};

/** Every employee's current weekly schedule, for the admin "Munkarend"
 * editor and the landing page's team section. */
export async function getEmployeeSchedules(): Promise<EmployeeSchedule[]> {
  const employees = await prisma.employee.findMany({
    orderBy: { name: "asc" },
    include: { availability: true },
  });

  return employees.map((e) => {
    const byDay = new Map(e.availability.map((a) => [a.dayOfWeek, a]));
    return {
      employeeId: e.id,
      employeeName: e.name,
      active: e.active,
      configured: e.availability.length > 0,
      week: Array.from({ length: 7 }, (_, dayOfWeek) => {
        const row = byDay.get(dayOfWeek);
        return row ? { dayOfWeek, startHour: row.startHour, endHour: row.endHour } : null;
      }),
    };
  });
}

export type WeekInput = Array<{ dayOfWeek: number; startHour: number; endHour: number } | null>;

/**
 * Replaces one employee's whole week in a single transaction — the editor
 * always submits all 7 days together, so a partial write (some days saved,
 * others not) is never a state the UI can produce, but the transaction
 * still guards against a failure mid-write leaving one.
 */
export async function setEmployeeWeeklySchedule(employeeId: string, week: WeekInput): Promise<void> {
  if (week.length !== 7) {
    throw new InvalidBookingRequestError("A heti beosztásnak mind a 7 napot tartalmaznia kell.");
  }
  for (const day of week) {
    if (!day) continue;
    if (day.startHour < DEFAULT_BUSINESS_HOURS.startHour || day.endHour > DEFAULT_BUSINESS_HOURS.endHour) {
      throw new InvalidBookingRequestError(
        `A munkaidő nem lóghat ki a szalon nyitvatartásából (${DEFAULT_BUSINESS_HOURS.startHour}:00–${DEFAULT_BUSINESS_HOURS.endHour}:00).`,
      );
    }
    if (day.startHour >= day.endHour) {
      throw new InvalidBookingRequestError("A kezdés órának a zárás óra előtt kell lennie.");
    }
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!employee) {
    throw new InvalidBookingRequestError("Ez a szakember nem található.");
  }

  await prisma.$transaction([
    prisma.employeeAvailability.deleteMany({ where: { employeeId } }),
    prisma.employeeAvailability.createMany({
      data: week
        .filter((d): d is { dayOfWeek: number; startHour: number; endHour: number } => d !== null)
        .map((d) => ({ employeeId, dayOfWeek: d.dayOfWeek, startHour: d.startHour, endHour: d.endHour })),
    }),
  ]);
}

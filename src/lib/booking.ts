import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  planSequentialSegments,
  type PlanServiceInput,
  type PlannedSegment,
} from "@/lib/scheduling";
import {
  BookingConflictError,
  CancellationWindowPassedError,
  EmployeeNotQualifiedError,
  InvalidBookingRequestError,
  isExclusionViolation,
} from "@/lib/booking-errors";
import { findEmployeesQualifiedForAll, getActiveEmployeesWithQualifications } from "@/lib/catalog";
import { SALON_TIMEZONE, businessHourToUtc } from "@/lib/timezone";

type PrismaTx = Prisma.TransactionClient;

/**
 * Business hours as local wall-clock bounds in the salon's timezone
 * (`timeZone`, defaulting to Europe/Budapest). Everything is still stored
 * and compared in UTC — `businessHourToUtc` (src/lib/timezone.ts) converts
 * these to the correct UTC instant per calendar date, DST included.
 */
export type BusinessHours = { startHour: number; endHour: number; timeZone?: string };
export const DEFAULT_BUSINESS_HOURS: BusinessHours = { startHour: 9, endHour: 19 };

export type BookingItemInput = {
  serviceId: string;
  employeeId: string;
};

export type CreateBookingInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes?: string;
  startTime: Date;
  items: BookingItemInput[];
};

async function loadAndValidatePlanItems(
  tx: PrismaTx,
  items: BookingItemInput[],
): Promise<PlanServiceInput[]> {
  if (items.length === 0) {
    throw new InvalidBookingRequestError("Legalább egy szolgáltatást ki kell választani.");
  }

  const serviceIds = [...new Set(items.map((i) => i.serviceId))];
  const employeeIds = [...new Set(items.map((i) => i.employeeId))];

  const [services, employees, qualifications] = await Promise.all([
    tx.service.findMany({ where: { id: { in: serviceIds } } }),
    tx.employee.findMany({ where: { id: { in: employeeIds } } }),
    tx.employeeService.findMany({
      where: { employeeId: { in: employeeIds }, serviceId: { in: serviceIds } },
    }),
  ]);

  const serviceById = new Map(services.map((s) => [s.id, s]));
  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const qualified = new Set(qualifications.map((q) => `${q.employeeId}:${q.serviceId}`));

  return items.map((item) => {
    const service = serviceById.get(item.serviceId);
    if (!service || !service.active) {
      throw new InvalidBookingRequestError("Az egyik kiválasztott szolgáltatás már nem elérhető.");
    }
    const employee = employeeById.get(item.employeeId);
    if (!employee || !employee.active) {
      throw new InvalidBookingRequestError("Az egyik kiválasztott szakember jelenleg nem elérhető.");
    }
    if (!qualified.has(`${item.employeeId}:${item.serviceId}`)) {
      throw new EmployeeNotQualifiedError(
        `${employee.name} nem végzi ezt a szolgáltatást: ${service.name}.`,
      );
    }
    return {
      employeeId: employee.id,
      serviceId: service.id,
      durationMinutes: service.durationMinutes,
      processingTimeMinutes: service.processingTimeMinutes,
    };
  });
}

async function assertSegmentsFreeInMemory(tx: PrismaTx, segments: PlannedSegment[]) {
  // Best-effort pre-check so obviously-taken slots fail fast with a clean
  // domain error instead of relying solely on the DB round-trip. This is a
  // convenience layer only — the EXCLUDE constraint below is the actual
  // guarantee, since two concurrent transactions can both pass this check
  // before either commits.
  for (const segment of segments) {
    const conflict = await tx.bookingSegment.findFirst({
      where: {
        employeeId: segment.employeeId,
        startTime: { lt: segment.endTime },
        endTime: { gt: segment.startTime },
      },
    });
    if (conflict) {
      throw new BookingConflictError(
        "Sajnos ezt az időpontot épp most foglalta le valaki más — itt a legközelebbi szabad időpont:",
      );
    }
  }
}

export type BookingWithSegments = Prisma.BookingGetPayload<{ include: { segments: true } }>;

/**
 * Creates a booking as a single atomic transaction: validate → plan segments
 * → insert. The database-level EXCLUDE constraint on booking_segments is the
 * real double-booking guarantee — the in-memory check above only makes the
 * common case fail fast; this catch is what makes it correct under
 * concurrency, because Postgres evaluates the constraint at INSERT time
 * inside the same transaction that's about to commit.
 */
export async function createBooking(input: CreateBookingInput): Promise<BookingWithSegments> {
  try {
    return await prisma.$transaction(async (tx) => {
      const planItems = await loadAndValidatePlanItems(tx, input.items);
      const segments = planSequentialSegments(input.startTime, planItems);

      await assertSegmentsFreeInMemory(tx, segments);

      const booking = await tx.booking.create({
        data: {
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          notes: input.notes,
        },
      });

      try {
        await tx.bookingSegment.createMany({
          data: segments.map((s) => ({
            bookingId: booking.id,
            employeeId: s.employeeId,
            serviceId: s.serviceId,
            startTime: s.startTime,
            endTime: s.endTime,
            sequenceOrder: s.sequenceOrder,
          })),
        });
      } catch (err) {
        if (isExclusionViolation(err)) {
          throw new BookingConflictError(
            "Sajnos ezt az időpontot épp most foglalta le valaki más — itt a legközelebbi szabad időpont:",
          );
        }
        throw err;
      }

      return tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: { segments: true },
      });
    });
  } catch (err) {
    if (err instanceof BookingConflictError) {
      err.suggestion =
        (await findNextAvailableSlot({
          items: input.items,
          earliestStart: input.startTime,
        }).catch(() => null)) ?? undefined;
    }
    throw err;
  }
}

export type CancelBookingInput = {
  bookingId: string;
  cancelledBy: "customer" | "admin";
  cancellationDeadlineHours?: number;
  now?: Date;
};

/**
 * Cancelling frees the slot by deleting the booking's segments (so the
 * EXCLUDE constraint no longer sees them) while keeping the Booking row,
 * with status=CANCELLED, for audit and stats. Per-segment historical detail
 * is intentionally not retained past cancellation for this MVP.
 */
export async function cancelBooking(input: CancelBookingInput) {
  const now = input.now ?? new Date();
  const deadlineHours = input.cancellationDeadlineHours ?? 24;

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: input.bookingId },
      include: { segments: true },
    });
    if (!booking) {
      throw new InvalidBookingRequestError("Ez a foglalás nem található.");
    }
    if (booking.status === "CANCELLED") {
      throw new InvalidBookingRequestError("Ez a foglalás már le van mondva.");
    }

    if (input.cancelledBy === "customer" && booking.segments.length > 0) {
      const earliestStart = booking.segments.reduce(
        (min, s) => (s.startTime < min ? s.startTime : min),
        booking.segments[0].startTime,
      );
      const deadline = new Date(earliestStart.getTime() - deadlineHours * 60 * 60_000);
      if (now > deadline) {
        throw new CancellationWindowPassedError(
          `A lemondási határidő (${deadlineHours} óra) már lejárt — ezt sajnos csak telefonon tudjuk módosítani.`,
        );
      }
    }

    await tx.bookingSegment.deleteMany({ where: { bookingId: booking.id } });
    return tx.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", cancelledAt: now },
    });
  });
}

export type FindNextAvailableSlotInput = {
  items: BookingItemInput[];
  earliestStart: Date;
  searchWindowDays?: number;
  stepMinutes?: number;
  businessHours?: BusinessHours;
};

/**
 * Scans forward in fixed steps for the first start time at which every
 * segment of the plan is free for its assigned employee. Read-only and
 * therefore inherently racy against concurrent bookings — it exists to
 * produce a helpful suggestion, not as part of the correctness guarantee.
 */
export async function findNextAvailableSlot(
  input: FindNextAvailableSlotInput,
): Promise<{ startTime: Date; endTime: Date } | null> {
  const stepMinutes = input.stepMinutes ?? 15;
  const searchWindowDays = input.searchWindowDays ?? 14;
  const businessHours = input.businessHours ?? DEFAULT_BUSINESS_HOURS;

  const planItems = await loadAndValidatePlanItems(prisma, input.items);
  const totalActiveAndGapMinutes = planItems.reduce(
    (sum, item, index) =>
      sum + item.durationMinutes + (index < planItems.length - 1 ? item.processingTimeMinutes : 0),
    0,
  );

  const timeZone = businessHours.timeZone ?? SALON_TIMEZONE;
  let candidate = roundUpToStep(input.earliestStart, stepMinutes);

  for (let day = 0; day < searchWindowDays; day++) {
    const dayAnchor = new Date(candidate);
    const dayOpen = businessHourToUtc(dayAnchor, businessHours.startHour, timeZone);
    const dayClose = businessHourToUtc(dayAnchor, businessHours.endHour, timeZone);

    let slot = candidate < dayOpen ? dayOpen : candidate;

    while (slot.getTime() + totalActiveAndGapMinutes * 60_000 <= dayClose.getTime()) {
      const segments = planSequentialSegments(slot, planItems);

      const busy = await anySegmentBusy(segments);
      if (!busy) {
        return { startTime: segments[0].startTime, endTime: segments[segments.length - 1].endTime };
      }
      slot = new Date(slot.getTime() + stepMinutes * 60_000);
    }

    candidate = businessHourToUtc(addDays(dayAnchor, 1), businessHours.startHour, timeZone);
  }

  return null;
}

async function anySegmentBusy(segments: PlannedSegment[]): Promise<boolean> {
  for (const segment of segments) {
     
    const conflict = await prisma.bookingSegment.findFirst({
      where: {
        employeeId: segment.employeeId,
        startTime: { lt: segment.endTime },
        endTime: { gt: segment.startTime },
      },
      select: { id: true },
    });
    if (conflict) return true;
  }
  return false;
}

function roundUpToStep(date: Date, stepMinutes: number): Date {
  const ms = stepMinutes * 60_000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export type ListSlotsForDateInput = {
  items: BookingItemInput[];
  date: Date;
  stepMinutes?: number;
  businessHours?: BusinessHours;
};

/**
 * All fitting start times for one specific calendar day — the data behind
 * the "14:30 / 15:15 / …" clickable blocks in the time-picker step. Slots
 * before `now` are excluded so a same-day view never offers the past.
 */
export async function listAvailableSlotsForDate(
  input: ListSlotsForDateInput,
): Promise<{ startTime: Date; endTime: Date }[]> {
  const stepMinutes = input.stepMinutes ?? 15;
  const businessHours = input.businessHours ?? DEFAULT_BUSINESS_HOURS;
  const timeZone = businessHours.timeZone ?? SALON_TIMEZONE;

  const planItems = await loadAndValidatePlanItems(prisma, input.items);
  const totalActiveAndGapMinutes = planItems.reduce(
    (sum, item, index) =>
      sum + item.durationMinutes + (index < planItems.length - 1 ? item.processingTimeMinutes : 0),
    0,
  );

  const dayOpen = businessHourToUtc(input.date, businessHours.startHour, timeZone);
  const dayClose = businessHourToUtc(input.date, businessHours.endHour, timeZone);
  const now = new Date();
  let slot = roundUpToStep(dayOpen > now ? dayOpen : now, stepMinutes);
  if (slot < dayOpen) slot = dayOpen;

  const results: { startTime: Date; endTime: Date }[] = [];
  while (slot.getTime() + totalActiveAndGapMinutes * 60_000 <= dayClose.getTime()) {
    const segments = planSequentialSegments(slot, planItems);

    const busy = await anySegmentBusy(segments);
    if (!busy) {
      results.push({
        startTime: segments[0].startTime,
        endTime: segments[segments.length - 1].endTime,
      });
    }
    slot = new Date(slot.getTime() + stepMinutes * 60_000);
  }

  return results;
}

export type AutoAssignmentResult = {
  items: BookingItemInput[];
  slot: { startTime: Date; endTime: Date };
  /** True when no single employee covers the whole combo alone. */
  requiresMultipleEmployees: boolean;
};

/**
 * Resolves the "Az első szabad időpontot kérem" flow: finds the earliest
 * slot across every employee who can single-handedly perform the whole
 * combo. If nobody can (or none of them has room in the search window),
 * falls back to a fixed one-employee-per-service assignment (first
 * qualified, active employee for each service) and searches that instead.
 *
 * This is a deliberately simple heuristic, not a full combinatorial
 * optimizer over every possible multi-employee split — reasonable for a
 * salon-sized team, and easy to extend later if needed.
 */
export async function resolveAutoAssignment(
  serviceIds: string[],
  earliestStart: Date,
  options?: { searchWindowDays?: number; stepMinutes?: number },
): Promise<AutoAssignmentResult | null> {
  const employees = await getActiveEmployeesWithQualifications();
  const soloCandidates = findEmployeesQualifiedForAll(employees, serviceIds);

  let best: AutoAssignmentResult | null = null;
  for (const employee of soloCandidates) {
    const items = serviceIds.map((serviceId) => ({ serviceId, employeeId: employee.id }));
     
    const slot = await findNextAvailableSlot({ items, earliestStart, ...options });
    if (slot && (!best || slot.startTime < best.slot.startTime)) {
      best = { items, slot, requiresMultipleEmployees: false };
    }
  }
  if (best) return best;

  const fallbackItems: BookingItemInput[] = [];
  for (const serviceId of serviceIds) {
    const candidate = employees.find((e) => e.serviceIds.includes(serviceId));
    if (!candidate) return null; // nobody on the team offers this service
    fallbackItems.push({ serviceId, employeeId: candidate.id });
  }
  const fallbackSlot = await findNextAvailableSlot({
    items: fallbackItems,
    earliestStart,
    ...options,
  });
  if (!fallbackSlot) return null;

  return {
    items: fallbackItems,
    slot: fallbackSlot,
    requiresMultipleEmployees: new Set(fallbackItems.map((i) => i.employeeId)).size > 1,
  };
}

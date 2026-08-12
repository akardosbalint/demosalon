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
import { SALON_TIMEZONE, businessHourToUtc, localDateOnly, localWeekday } from "@/lib/timezone";

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
  // Optional: phone-only customers (typically admin-entered) may not have
  // one. Guests booking themselves are still asked for it client-side —
  // they need it to receive the confirmation and the self-service manage
  // link — but the database doesn't enforce that, the guest form does.
  customerEmail?: string;
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

export type BookingForManagement = Prisma.BookingGetPayload<{
  include: { segments: { include: { employee: true; service: true } } };
}>;

/**
 * Looks up a booking by its unguessable manage token (not by primary key) —
 * this is what backs the guest-facing "/foglalas/kezeles/[token]" self-service
 * page. Returns null rather than throwing so the page can render a clean
 * "not found" state instead of a stack trace for a stale/mistyped link.
 */
export async function getBookingByManageToken(token: string): Promise<BookingForManagement | null> {
  if (!token) return null;
  return prisma.booking.findUnique({
    where: { manageToken: token },
    include: { segments: { include: { employee: true, service: true }, orderBy: { startTime: "asc" } } },
  });
}

/**
 * The self-service counterpart to `cancelBooking`: resolves the booking by
 * manage token first (never by trusting a client-supplied booking id), then
 * cancels it as the customer — so the 24h deadline still applies exactly as
 * it would from the admin-triggered path, just scoped to whoever holds the
 * link.
 */
export async function cancelBookingByManageToken(token: string, now?: Date) {
  const booking = await prisma.booking.findUnique({ where: { manageToken: token }, select: { id: true } });
  if (!booking) {
    throw new InvalidBookingRequestError("Ez a foglalás nem található.");
  }
  return cancelBooking({ bookingId: booking.id, cancelledBy: "customer", now });
}

/**
 * Admin-only: marks a past booking as a no-show. Unlike cancellation, this
 * doesn't delete the booking's segments — the appointment time has already
 * passed, so there's no future slot to free, and keeping the segments
 * preserves accurate utilization stats.
 */
export async function markNoShow(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new InvalidBookingRequestError("Ez a foglalás nem található.");
  }
  if (booking.status === "CANCELLED") {
    throw new InvalidBookingRequestError("Egy lemondott foglalás nem jelölhető no-show-nak.");
  }
  return prisma.booking.update({ where: { id: bookingId }, data: { status: "NO_SHOW" } });
}

export async function markCompleted(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new InvalidBookingRequestError("Ez a foglalás nem található.");
  }
  if (booking.status === "CANCELLED") {
    throw new InvalidBookingRequestError("Egy lemondott foglalás nem jelölhető megtörténtnek.");
  }
  return prisma.booking.update({ where: { id: bookingId }, data: { status: "COMPLETED" } });
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
  const employeeIds = planItems.map((p) => p.employeeId);
  const availabilityByEmployee = await loadAvailabilityByEmployee(employeeIds);

  const timeZone = businessHours.timeZone ?? SALON_TIMEZONE;
  let candidate = roundUpToStep(input.earliestStart, stepMinutes);

  // One query covering the whole search window instead of one per candidate
  // slot — see loadBusySegments. +1 day of slack so the last day's close-of-
  // business segments are fully covered.
  const windowEnd = new Date(candidate.getTime() + (searchWindowDays + 1) * 24 * 60 * 60_000);
  const busyByEmployee = await loadBusySegments(employeeIds, candidate, windowEnd);

  for (let day = 0; day < searchWindowDays; day++) {
    const dayAnchor = new Date(candidate);
    const dayOpen = businessHourToUtc(dayAnchor, businessHours.startHour, timeZone);
    const dayClose = businessHourToUtc(dayAnchor, businessHours.endHour, timeZone);

    let slot = candidate < dayOpen ? dayOpen : candidate;

    while (slot.getTime() + totalActiveAndGapMinutes * 60_000 <= dayClose.getTime()) {
      const segments = planSequentialSegments(slot, planItems);

      const unavailable = isPlanUnavailable(segments, availabilityByEmployee, busyByEmployee, timeZone);
      if (!unavailable) {
        return { startTime: segments[0].startTime, endTime: segments[segments.length - 1].endTime };
      }
      slot = new Date(slot.getTime() + stepMinutes * 60_000);
    }

    candidate = businessHourToUtc(addDays(dayAnchor, 1), businessHours.startHour, timeZone);
  }

  return null;
}

type BusyInterval = { startTime: Date; endTime: Date };

/**
 * Fetches every existing booking segment for the given employees within
 * [windowStart, windowEnd) in a single query, so the slot-scanning loops in
 * findNextAvailableSlot/listAvailableSlotsForDate can check each candidate
 * slot in memory instead of issuing one DB round-trip per slot. That
 * per-slot query used to run once per 15-minute step across the whole
 * search window — ~30-90 sequential round-trips for a single day's slot
 * list — which is unnoticeable against localhost but adds up to several
 * real seconds against a networked database (e.g. Supabase); this
 * collapses it to one query regardless of how many slots get evaluated.
 */
async function loadBusySegments(
  employeeIds: string[],
  windowStart: Date,
  windowEnd: Date,
): Promise<Map<string, BusyInterval[]>> {
  if (employeeIds.length === 0) return new Map();
  const rows = await prisma.bookingSegment.findMany({
    where: {
      employeeId: { in: [...new Set(employeeIds)] },
      startTime: { lt: windowEnd },
      endTime: { gt: windowStart },
    },
    select: { employeeId: true, startTime: true, endTime: true },
  });
  const map = new Map<string, BusyInterval[]>();
  for (const row of rows) {
    if (!map.has(row.employeeId)) map.set(row.employeeId, []);
    map.get(row.employeeId)!.push({ startTime: row.startTime, endTime: row.endTime });
  }
  return map;
}

function anySegmentBusy(segments: PlannedSegment[], busyByEmployee: Map<string, BusyInterval[]>): boolean {
  for (const segment of segments) {
    const busy = busyByEmployee.get(segment.employeeId);
    if (!busy) continue;
    for (const b of busy) {
      if (segment.startTime < b.endTime && b.startTime < segment.endTime) return true;
    }
  }
  return false;
}

/** One employee's recurring weekly hours: dayOfWeek (0 Sun .. 6 Sat) → working window. */
type WeeklyAvailability = Map<number, { startHour: number; endHour: number }>;

/**
 * Loads each employee's configured weekly schedule (src/app/admin/(dashboard)/munkarend
 * manages these rows). An employee with no rows at all isn't in the
 * returned map — segmentWithinAvailability treats that as "unconfigured,
 * always available within business hours", matching pre-availability-
 * feature behavior so employees nobody has scheduled yet (or test
 * fixtures) keep working exactly as before.
 */
async function loadAvailabilityByEmployee(employeeIds: string[]): Promise<Map<string, WeeklyAvailability>> {
  if (employeeIds.length === 0) return new Map();
  const rows = await prisma.employeeAvailability.findMany({
    where: { employeeId: { in: [...new Set(employeeIds)] } },
  });
  const map = new Map<string, WeeklyAvailability>();
  for (const row of rows) {
    if (!map.has(row.employeeId)) map.set(row.employeeId, new Map());
    map.get(row.employeeId)!.set(row.dayOfWeek, { startHour: row.startHour, endHour: row.endHour });
  }
  return map;
}

/** True if `segment` falls entirely within its employee's configured working
 * hours for that local calendar day (or the employee has no schedule
 * configured at all — see loadAvailabilityByEmployee). */
function segmentWithinAvailability(
  segment: PlannedSegment,
  availabilityByEmployee: Map<string, WeeklyAvailability>,
  timeZone: string,
): boolean {
  const weekly = availabilityByEmployee.get(segment.employeeId);
  if (!weekly) return true;

  const hours = weekly.get(localWeekday(segment.startTime, timeZone));
  if (!hours) return false; // has a schedule, but not configured to work this weekday

  const dayAnchor = localDateOnly(segment.startTime, timeZone);
  const windowStart = businessHourToUtc(dayAnchor, hours.startHour, timeZone);
  const windowEnd = businessHourToUtc(dayAnchor, hours.endHour, timeZone);
  return segment.startTime >= windowStart && segment.endTime <= windowEnd;
}

function isPlanUnavailable(
  segments: PlannedSegment[],
  availabilityByEmployee: Map<string, WeeklyAvailability>,
  busyByEmployee: Map<string, BusyInterval[]>,
  timeZone: string,
): boolean {
  if (segments.some((s) => !segmentWithinAvailability(s, availabilityByEmployee, timeZone))) return true;
  return anySegmentBusy(segments, busyByEmployee);
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
  const employeeIds = planItems.map((p) => p.employeeId);
  const availabilityByEmployee = await loadAvailabilityByEmployee(employeeIds);

  const dayOpen = businessHourToUtc(input.date, businessHours.startHour, timeZone);
  const dayClose = businessHourToUtc(input.date, businessHours.endHour, timeZone);
  const now = new Date();
  let slot = roundUpToStep(dayOpen > now ? dayOpen : now, stepMinutes);
  if (slot < dayOpen) slot = dayOpen;

  // One query covering the whole day instead of one per candidate slot —
  // see loadBusySegments.
  const busyByEmployee = await loadBusySegments(employeeIds, dayOpen, dayClose);

  const results: { startTime: Date; endTime: Date }[] = [];
  while (slot.getTime() + totalActiveAndGapMinutes * 60_000 <= dayClose.getTime()) {
    const segments = planSequentialSegments(slot, planItems);

    const unavailable = isPlanUnavailable(segments, availabilityByEmployee, busyByEmployee, timeZone);
    if (!unavailable) {
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

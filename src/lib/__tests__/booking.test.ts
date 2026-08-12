import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { cancelBooking, createBooking } from "@/lib/booking";
import {
  BookingConflictError,
  CancellationWindowPassedError,
  EmployeeNotQualifiedError,
} from "@/lib/booking-errors";
import { createTestEmployee, createTestService, customer, qualify, resetDb } from "./testUtils";

beforeEach(async () => {
  await resetDb();
});

describe("createBooking", () => {
  it("creates a booking with one segment for a single service", async () => {
    const employee = await createTestEmployee();
    const service = await createTestService({ durationMinutes: 30 });
    await qualify(employee.id, service.id);

    const startTime = new Date("2026-09-01T10:00:00.000Z");
    const booking = await createBooking({
      ...customer(),
      startTime,
      items: [{ serviceId: service.id, employeeId: employee.id }],
    });

    expect(booking.status).toBe("CONFIRMED");
    expect(booking.segments).toHaveLength(1);
    expect(booking.segments[0].startTime).toEqual(startTime);
    expect(booking.segments[0].endTime).toEqual(new Date("2026-09-01T10:30:00.000Z"));
  });

  it("chains a combo across services with a processing-time gap into separate segments", async () => {
    const employee = await createTestEmployee();
    const dye = await createTestService({ durationMinutes: 45, processingTimeMinutes: 30 });
    const dry = await createTestService({ durationMinutes: 25 });
    await qualify(employee.id, dye.id);
    await qualify(employee.id, dry.id);

    const startTime = new Date("2026-09-01T09:00:00.000Z");
    const booking = await createBooking({
      ...customer(),
      startTime,
      items: [
        { serviceId: dye.id, employeeId: employee.id },
        { serviceId: dry.id, employeeId: employee.id },
      ],
    });

    expect(booking.segments).toHaveLength(2);
    const [seg1, seg2] = booking.segments.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    expect(seg1.startTime).toEqual(new Date("2026-09-01T09:00:00.000Z"));
    expect(seg1.endTime).toEqual(new Date("2026-09-01T09:45:00.000Z"));
    expect(seg2.startTime).toEqual(new Date("2026-09-01T10:15:00.000Z"));
    expect(seg2.endTime).toEqual(new Date("2026-09-01T10:40:00.000Z"));

    // The 30-minute gap has no segment: another booking can use the employee then.
    const anotherService = await createTestService({ durationMinutes: 20 });
    await qualify(employee.id, anotherService.id);
    const gapBooking = await createBooking({
      ...customer(),
      startTime: new Date("2026-09-01T09:50:00.000Z"),
      items: [{ serviceId: anotherService.id, employeeId: employee.id }],
    });
    expect(gapBooking.status).toBe("CONFIRMED");
  });

  it("rejects a booking when the employee does not perform the requested service", async () => {
    const employee = await createTestEmployee();
    const service = await createTestService();
    // Intentionally not qualifying the employee for the service.

    await expect(
      createBooking({
        ...customer(),
        startTime: new Date("2026-09-01T10:00:00.000Z"),
        items: [{ serviceId: service.id, employeeId: employee.id }],
      }),
    ).rejects.toBeInstanceOf(EmployeeNotQualifiedError);
  });

  it("rejects an overlapping booking for the same employee and rolls back cleanly", async () => {
    const employee = await createTestEmployee();
    const service = await createTestService({ durationMinutes: 30 });
    await qualify(employee.id, service.id);

    await createBooking({
      ...customer(),
      startTime: new Date("2026-09-01T10:00:00.000Z"),
      items: [{ serviceId: service.id, employeeId: employee.id }],
    });

    await expect(
      createBooking({
        ...customer(),
        startTime: new Date("2026-09-01T10:15:00.000Z"), // overlaps 10:00-10:30
        items: [{ serviceId: service.id, employeeId: employee.id }],
      }),
    ).rejects.toBeInstanceOf(BookingConflictError);

    // Rollback verification: only the first booking's segment exists.
    const segments = await prisma.bookingSegment.findMany({ where: { employeeId: employee.id } });
    expect(segments).toHaveLength(1);
    const bookings = await prisma.booking.findMany();
    expect(bookings).toHaveLength(1);
  });

  it("attaches a concrete next-available-slot suggestion to the conflict error", async () => {
    const employee = await createTestEmployee();
    const service = await createTestService({ durationMinutes: 30 });
    await qualify(employee.id, service.id);

    await createBooking({
      ...customer(),
      startTime: new Date("2026-09-01T10:00:00.000Z"),
      items: [{ serviceId: service.id, employeeId: employee.id }],
    });

    let caught: BookingConflictError | undefined;
    try {
      await createBooking({
        ...customer(),
        startTime: new Date("2026-09-01T10:00:00.000Z"),
        items: [{ serviceId: service.id, employeeId: employee.id }],
      });
    } catch (err) {
      caught = err as BookingConflictError;
    }

    expect(caught).toBeInstanceOf(BookingConflictError);
    expect(caught?.suggestion).toBeDefined();
    // The suggestion must not overlap the already-booked 10:00-10:30 slot.
    expect(caught!.suggestion!.startTime.getTime()).toBeGreaterThanOrEqual(
      new Date("2026-09-01T10:30:00.000Z").getTime(),
    );
  });

  it("allows two different employees to be booked at the exact same time", async () => {
    const e1 = await createTestEmployee();
    const e2 = await createTestEmployee();
    const service = await createTestService({ durationMinutes: 30 });
    await qualify(e1.id, service.id);
    await qualify(e2.id, service.id);

    const startTime = new Date("2026-09-01T10:00:00.000Z");
    const b1 = await createBooking({
      ...customer(),
      startTime,
      items: [{ serviceId: service.id, employeeId: e1.id }],
    });
    const b2 = await createBooking({
      ...customer(),
      startTime,
      items: [{ serviceId: service.id, employeeId: e2.id }],
    });

    expect(b1.status).toBe("CONFIRMED");
    expect(b2.status).toBe("CONFIRMED");
  });
});

describe("cancelBooking", () => {
  it("frees the slot so it can be rebooked, and deletes the segments", async () => {
    const employee = await createTestEmployee();
    const service = await createTestService({ durationMinutes: 30 });
    await qualify(employee.id, service.id);
    const startTime = new Date("2026-09-01T10:00:00.000Z");

    const booking = await createBooking({
      ...customer(),
      startTime,
      items: [{ serviceId: service.id, employeeId: employee.id }],
    });

    await cancelBooking({ bookingId: booking.id, cancelledBy: "admin" });

    const cancelled = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(cancelled.status).toBe("CANCELLED");
    const remainingSegments = await prisma.bookingSegment.findMany({
      where: { bookingId: booking.id },
    });
    expect(remainingSegments).toHaveLength(0);

    // The freed slot can now be booked again.
    const rebooked = await createBooking({
      ...customer(),
      startTime,
      items: [{ serviceId: service.id, employeeId: employee.id }],
    });
    expect(rebooked.status).toBe("CONFIRMED");
  });

  it("blocks self-service cancellation past the deadline, but allows admin override", async () => {
    const employee = await createTestEmployee();
    const service = await createTestService({ durationMinutes: 30 });
    await qualify(employee.id, service.id);

    const startTime = new Date("2026-09-01T10:00:00.000Z");
    const booking = await createBooking({
      ...customer(),
      startTime,
      items: [{ serviceId: service.id, employeeId: employee.id }],
    });

    const twoHoursBefore = new Date("2026-09-01T08:00:00.000Z");
    await expect(
      cancelBooking({
        bookingId: booking.id,
        cancelledBy: "customer",
        cancellationDeadlineHours: 24,
        now: twoHoursBefore,
      }),
    ).rejects.toBeInstanceOf(CancellationWindowPassedError);

    // Admin can still cancel regardless of the customer-facing deadline.
    const cancelled = await cancelBooking({
      bookingId: booking.id,
      cancelledBy: "admin",
      now: twoHoursBefore,
    });
    expect(cancelled.status).toBe("CANCELLED");
  });
});

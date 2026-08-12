import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createBooking } from "@/lib/booking";
import { BookingConflictError } from "@/lib/booking-errors";
import { createTestEmployee, createTestService, customer, qualify, resetDb } from "./testUtils";

beforeEach(async () => {
  await resetDb();
});

/**
 * The scenario the whole EXCLUDE-constraint design exists for: two guests
 * hit "Book" on the very last open slot for the same employee at effectively
 * the same instant. Only one may win. This can only be proven with real
 * concurrent transactions against the real database — an in-process mutex or
 * a "check then write" app-level guard would not catch this, which is
 * exactly why the guarantee lives in Postgres (EXCLUDE USING gist) rather
 * than in application code.
 */
describe("concurrent booking of the same slot", () => {
  it("lets exactly one of two simultaneous requests for the identical slot succeed", async () => {
    const employee = await createTestEmployee();
    const service = await createTestService({ durationMinutes: 30 });
    await qualify(employee.id, service.id);

    const startTime = new Date("2026-09-01T14:00:00.000Z");
    const attempt = () =>
      createBooking({
        ...customer(),
        startTime,
        items: [{ serviceId: service.id, employeeId: employee.id }],
      });

    const [resultA, resultB] = await Promise.allSettled([attempt(), attempt()]);

    const outcomes = [resultA, resultB];
    const fulfilled = outcomes.filter((r) => r.status === "fulfilled");
    const rejected = outcomes.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(BookingConflictError);

    // The database, not just the application, must agree there is only one.
    const segments = await prisma.bookingSegment.findMany({ where: { employeeId: employee.id } });
    expect(segments).toHaveLength(1);
    const bookings = await prisma.booking.findMany({ where: { status: "CONFIRMED" } });
    expect(bookings).toHaveLength(1);
  });

  it("still allows only one winner under a higher-concurrency stress burst (8 simultaneous attempts)", async () => {
    const employee = await createTestEmployee();
    const service = await createTestService({ durationMinutes: 30 });
    await qualify(employee.id, service.id);

    const startTime = new Date("2026-09-01T16:00:00.000Z");
    const attempts = Array.from({ length: 8 }, () =>
      createBooking({
        ...customer(),
        startTime,
        items: [{ serviceId: service.id, employeeId: employee.id }],
      }),
    );

    const results = await Promise.allSettled(attempts);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(7);
    for (const r of rejected as PromiseRejectedResult[]) {
      expect(r.reason).toBeInstanceOf(BookingConflictError);
    }

    const segments = await prisma.bookingSegment.findMany({ where: { employeeId: employee.id } });
    expect(segments).toHaveLength(1);
  });

  it("allows a losing bidder to successfully rebook the very next slot", async () => {
    const employee = await createTestEmployee();
    const service = await createTestService({ durationMinutes: 30 });
    await qualify(employee.id, service.id);

    const startTime = new Date("2026-09-01T14:00:00.000Z");
    const attempt = () =>
      createBooking({
        ...customer(),
        startTime,
        items: [{ serviceId: service.id, employeeId: employee.id }],
      });

    const [resultA, resultB] = await Promise.allSettled([attempt(), attempt()]);
    const loser = [resultA, resultB].find((r) => r.status === "rejected") as
      | PromiseRejectedResult
      | undefined;
    expect(loser).toBeDefined();
    const conflict = loser!.reason as BookingConflictError;

    expect(conflict.suggestion).toBeDefined();
    const retry = await createBooking({
      ...customer(),
      startTime: conflict.suggestion!.startTime,
      items: [{ serviceId: service.id, employeeId: employee.id }],
    });
    expect(retry.status).toBe("CONFIRMED");
  });
});

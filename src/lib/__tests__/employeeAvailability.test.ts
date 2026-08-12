import { beforeEach, describe, expect, it } from "vitest";
import { findNextAvailableSlot, listAvailableSlotsForDate } from "@/lib/booking";
import { createTestEmployee, createTestService, qualify, resetDb, setAvailability } from "./testUtils";

beforeEach(async () => {
  await resetDb();
});

// 2026-09-02 is a Wednesday (UTC day 3) — matches the existing
// availability.test.ts fixtures, kept consistent here.
const WEDNESDAY = new Date("2026-09-02T00:00:00.000Z");
const UTC_BUSINESS_HOURS = { startHour: 9, endHour: 19, timeZone: "UTC" };

describe("employee-specific weekly availability", () => {
  it("offers no slots on a day the employee isn't scheduled to work", async () => {
    const employee = await createTestEmployee();
    const service = await createTestService({ durationMinutes: 30 });
    await qualify(employee.id, service.id);
    // Scheduled every day except Wednesday (3).
    await setAvailability(employee.id, [
      { dayOfWeek: 1, startHour: 9, endHour: 19 },
      { dayOfWeek: 2, startHour: 9, endHour: 19 },
      { dayOfWeek: 4, startHour: 9, endHour: 19 },
      { dayOfWeek: 5, startHour: 9, endHour: 19 },
    ]);

    const slots = await listAvailableSlotsForDate({
      items: [{ serviceId: service.id, employeeId: employee.id }],
      date: WEDNESDAY,
      stepMinutes: 30,
      businessHours: UTC_BUSINESS_HOURS,
    });

    expect(slots).toEqual([]);
  });

  it("only offers slots inside the employee's configured hours for that day", async () => {
    const employee = await createTestEmployee();
    const service = await createTestService({ durationMinutes: 30 });
    await qualify(employee.id, service.id);
    await setAvailability(employee.id, [{ dayOfWeek: 3, startHour: 12, endHour: 15 }]);

    const slots = await listAvailableSlotsForDate({
      items: [{ serviceId: service.id, employeeId: employee.id }],
      date: WEDNESDAY,
      stepMinutes: 30,
      businessHours: UTC_BUSINESS_HOURS,
    });

    const slotTimes = slots.map((s) => s.startTime.toISOString());
    expect(slotTimes).not.toContain("2026-09-02T09:00:00.000Z");
    expect(slotTimes).toContain("2026-09-02T12:00:00.000Z");
    // The last 30-min slot that still ends by 15:00.
    expect(slotTimes).toContain("2026-09-02T14:30:00.000Z");
    expect(slotTimes).not.toContain("2026-09-02T15:00:00.000Z");
  });

  it("stays fully available (legacy default) for an employee with no configured schedule at all", async () => {
    const employee = await createTestEmployee();
    const service = await createTestService({ durationMinutes: 30 });
    await qualify(employee.id, service.id);

    const slots = await listAvailableSlotsForDate({
      items: [{ serviceId: service.id, employeeId: employee.id }],
      date: WEDNESDAY,
      stepMinutes: 30,
      businessHours: UTC_BUSINESS_HOURS,
    });

    expect(slots.map((s) => s.startTime.toISOString())).toContain("2026-09-02T09:00:00.000Z");
  });

  it("findNextAvailableSlot skips a day off and lands on the employee's next working day", async () => {
    const employee = await createTestEmployee();
    const service = await createTestService({ durationMinutes: 30 });
    await qualify(employee.id, service.id);
    // Off Wednesday (3), working Thursday (4).
    await setAvailability(employee.id, [{ dayOfWeek: 4, startHour: 9, endHour: 19 }]);

    const result = await findNextAvailableSlot({
      items: [{ serviceId: service.id, employeeId: employee.id }],
      earliestStart: WEDNESDAY,
      businessHours: UTC_BUSINESS_HOURS,
    });

    expect(result).not.toBeNull();
    expect(result!.startTime.toISOString()).toBe("2026-09-03T09:00:00.000Z");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { createBooking, listAvailableSlotsForDate, resolveAutoAssignment } from "@/lib/booking";
import { createTestEmployee, createTestService, customer, qualify, resetDb } from "./testUtils";

beforeEach(async () => {
  await resetDb();
});

describe("listAvailableSlotsForDate", () => {
  it("lists stepped slots for an empty day and excludes an already-booked window", async () => {
    const employee = await createTestEmployee();
    const service = await createTestService({ durationMinutes: 30 });
    await qualify(employee.id, service.id);

    await createBooking({
      ...customer(),
      startTime: new Date("2026-09-02T10:00:00.000Z"),
      items: [{ serviceId: service.id, employeeId: employee.id }],
    });

    const slots = await listAvailableSlotsForDate({
      items: [{ serviceId: service.id, employeeId: employee.id }],
      date: new Date("2026-09-02T00:00:00.000Z"),
      stepMinutes: 30,
      businessHours: { startHour: 9, endHour: 12, timeZone: "UTC" },
    });

    const slotTimes = slots.map((s) => s.startTime.toISOString());
    expect(slotTimes).toContain("2026-09-02T09:00:00.000Z");
    // 09:30-10:00 does not overlap the 10:00-10:30 booking (half-open ranges).
    expect(slotTimes).toContain("2026-09-02T09:30:00.000Z");
    // But starting exactly at 10:00 does.
    expect(slotTimes).not.toContain("2026-09-02T10:00:00.000Z");
    expect(slotTimes).toContain("2026-09-02T10:30:00.000Z");
  });
});

describe("resolveAutoAssignment", () => {
  it("assigns the single employee who covers the whole combo, when free", async () => {
    const generalist = await createTestEmployee({ name: "Generalist" });
    const cutOnly = await createTestEmployee({ name: "CutOnly" });
    const wash = await createTestService({ durationMinutes: 15 });
    const cut = await createTestService({ durationMinutes: 30 });
    await qualify(generalist.id, wash.id);
    await qualify(generalist.id, cut.id);
    await qualify(cutOnly.id, cut.id);

    const result = await resolveAutoAssignment(
      [wash.id, cut.id],
      new Date("2026-09-02T09:00:00.000Z"),
    );

    expect(result).not.toBeNull();
    expect(result!.requiresMultipleEmployees).toBe(false);
    expect(new Set(result!.items.map((i) => i.employeeId)).size).toBe(1);
    expect(result!.items[0].employeeId).toBe(generalist.id);
  });

  it("falls back to a multi-employee split when nobody covers the whole combo alone", async () => {
    const hair = await createTestEmployee({ name: "Hair" });
    const nails = await createTestEmployee({ name: "Nails" });
    const cut = await createTestService({ durationMinutes: 30 });
    const manicure = await createTestService({ durationMinutes: 45 });
    await qualify(hair.id, cut.id);
    await qualify(nails.id, manicure.id);

    const result = await resolveAutoAssignment(
      [cut.id, manicure.id],
      new Date("2026-09-02T09:00:00.000Z"),
    );

    expect(result).not.toBeNull();
    expect(result!.requiresMultipleEmployees).toBe(true);
    const employeeIds = result!.items.map((i) => i.employeeId).sort();
    expect(employeeIds).toEqual([hair.id, nails.id].sort());
  });

  it("skips a busy solo-qualified employee in favor of one who is free earlier", async () => {
    const busy = await createTestEmployee({ name: "Busy" });
    const free = await createTestEmployee({ name: "Free" });
    const service = await createTestService({ durationMinutes: 30 });
    await qualify(busy.id, service.id);
    await qualify(free.id, service.id);

    const earliestStart = new Date("2026-09-02T09:00:00.000Z");
    await createBooking({
      ...customer(),
      startTime: earliestStart,
      items: [{ serviceId: service.id, employeeId: busy.id }],
    });

    const result = await resolveAutoAssignment([service.id], earliestStart);

    expect(result).not.toBeNull();
    expect(result!.items[0].employeeId).toBe(free.id);
    expect(result!.slot.startTime).toEqual(earliestStart);
  });
});

import { describe, expect, it } from "vitest";
import {
  getComboWindow,
  getRequiredEmployeeIds,
  planConflictsWithBusy,
  planSequentialSegments,
  rangesOverlap,
} from "@/lib/scheduling";

const START = new Date("2026-09-01T09:00:00.000Z");

describe("planSequentialSegments", () => {
  it("chains services back-to-back when there is no processing time", () => {
    const segments = planSequentialSegments(START, [
      { employeeId: "e1", serviceId: "wash", durationMinutes: 15, processingTimeMinutes: 0 },
      { employeeId: "e1", serviceId: "cut", durationMinutes: 30, processingTimeMinutes: 0 },
      { employeeId: "e1", serviceId: "dry", durationMinutes: 25, processingTimeMinutes: 0 },
    ]);

    expect(segments).toHaveLength(3);
    expect(segments[0].startTime).toEqual(new Date("2026-09-01T09:00:00.000Z"));
    expect(segments[0].endTime).toEqual(new Date("2026-09-01T09:15:00.000Z"));
    // No gap: segment 2 starts exactly when segment 1 ends.
    expect(segments[1].startTime).toEqual(segments[0].endTime);
    expect(segments[1].endTime).toEqual(new Date("2026-09-01T09:45:00.000Z"));
    expect(segments[2].startTime).toEqual(segments[1].endTime);
    expect(segments[2].endTime).toEqual(new Date("2026-09-01T10:10:00.000Z"));

    expect(segments.map((s) => s.sequenceOrder)).toEqual([1, 2, 3]);
  });

  it("leaves a gap with no segment during processing time", () => {
    // Dye (45 min work + 30 min developing) then dry (25 min), same employee.
    const segments = planSequentialSegments(START, [
      { employeeId: "e1", serviceId: "dye", durationMinutes: 45, processingTimeMinutes: 30 },
      { employeeId: "e1", serviceId: "dry", durationMinutes: 25, processingTimeMinutes: 0 },
    ]);

    expect(segments[0].startTime).toEqual(new Date("2026-09-01T09:00:00.000Z"));
    expect(segments[0].endTime).toEqual(new Date("2026-09-01T09:45:00.000Z"));
    // The gap (09:45–10:15) has no segment covering it — that's the whole point:
    // the employee is free there for someone else's booking.
    expect(segments[1].startTime).toEqual(new Date("2026-09-01T10:15:00.000Z"));
    expect(segments[1].endTime).toEqual(new Date("2026-09-01T10:40:00.000Z"));

    const gapStart = segments[0].endTime;
    const gapEnd = segments[1].startTime;
    expect(gapEnd.getTime() - gapStart.getTime()).toBe(30 * 60_000);
  });

  it("supports chaining across two different employees", () => {
    const segments = planSequentialSegments(START, [
      { employeeId: "hair-1", serviceId: "dye", durationMinutes: 45, processingTimeMinutes: 30 },
      { employeeId: "nails-1", serviceId: "manicure", durationMinutes: 45, processingTimeMinutes: 0 },
    ]);

    expect(getRequiredEmployeeIds(segments).sort()).toEqual(["hair-1", "nails-1"]);
    expect(segments[1].startTime.getTime() - segments[0].endTime.getTime()).toBe(30 * 60_000);
  });

  it("throws when given an empty service list", () => {
    expect(() => planSequentialSegments(START, [])).toThrow();
  });
});

describe("getComboWindow", () => {
  it("reports active vs. waiting minutes across a combo with a processing gap", () => {
    const segments = planSequentialSegments(START, [
      { employeeId: "e1", serviceId: "dye", durationMinutes: 45, processingTimeMinutes: 30 },
      { employeeId: "e1", serviceId: "dry", durationMinutes: 25, processingTimeMinutes: 0 },
    ]);
    const window = getComboWindow(segments);

    expect(window.activeMinutes).toBe(70); // 45 + 25
    expect(window.totalMinutes).toBe(100); // 45 + 30 + 25
    expect(window.waitingMinutes).toBe(30);
    expect(window.start).toEqual(segments[0].startTime);
    expect(window.end).toEqual(segments[1].endTime);
  });
});

describe("rangesOverlap", () => {
  it("treats ranges as half-open — touching endpoints do not overlap", () => {
    const a = new Date("2026-09-01T10:00:00Z");
    const b = new Date("2026-09-01T10:30:00Z");
    const c = new Date("2026-09-01T11:00:00Z");
    expect(rangesOverlap(a, b, b, c)).toBe(false);
    expect(rangesOverlap(a, c, b, c)).toBe(true);
  });
});

describe("planConflictsWithBusy", () => {
  it("detects a conflict only for the matching employee", () => {
    const segments = planSequentialSegments(START, [
      { employeeId: "e1", serviceId: "cut", durationMinutes: 30, processingTimeMinutes: 0 },
    ]);
    const busyElsewhere = [
      { startTime: new Date("2026-09-01T09:00:00Z"), endTime: new Date("2026-09-01T09:30:00Z") },
    ];
    expect(planConflictsWithBusy(segments, "e2", busyElsewhere)).toBe(false);
    expect(planConflictsWithBusy(segments, "e1", busyElsewhere)).toBe(true);
  });
});

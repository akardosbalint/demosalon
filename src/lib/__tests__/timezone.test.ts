import { describe, expect, it } from "vitest";
import { businessHourToUtc, dateKeyInTimezone, formatTimeInTimezone } from "@/lib/timezone";

describe("businessHourToUtc", () => {
  it("converts a summer (CEST, UTC+2) local hour correctly", () => {
    // 2026-07-15 is well inside CEST.
    const result = businessHourToUtc(new Date("2026-07-15T00:00:00Z"), 9);
    expect(result.toISOString()).toBe("2026-07-15T07:00:00.000Z");
  });

  it("converts a winter (CET, UTC+1) local hour correctly", () => {
    // 2026-01-15 is well inside CET.
    const result = businessHourToUtc(new Date("2026-01-15T00:00:00Z"), 9);
    expect(result.toISOString()).toBe("2026-01-15T08:00:00.000Z");
  });

  it("lands on the correct side of the DST transition on the boundary date", () => {
    // 2026-10-25 is the day CEST -> CET switches in Europe/Budapest (03:00 -> 02:00 local).
    // 09:00 local that morning is already after the switch, so still UTC+1.
    const afterSwitch = businessHourToUtc(new Date("2026-10-25T00:00:00Z"), 9);
    expect(afterSwitch.toISOString()).toBe("2026-10-25T08:00:00.000Z");
  });
});

describe("formatTimeInTimezone / dateKeyInTimezone round-trip", () => {
  it("formats a business-hour instant back to the original local hour", () => {
    const instant = businessHourToUtc(new Date("2026-07-15T00:00:00Z"), 14);
    expect(formatTimeInTimezone(instant)).toBe("14:00");
    expect(dateKeyInTimezone(instant)).toBe("2026-07-15");
  });
});

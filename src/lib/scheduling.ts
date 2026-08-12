// Pure, DB-free scheduling math. Kept separate from booking.ts so the
// segment-planning rules can be unit tested without a database.

export type PlanServiceInput = {
  employeeId: string;
  serviceId: string;
  durationMinutes: number;
  /**
   * Minutes after this service ends during which the customer is occupied
   * (e.g. hair dye developing) but the employee performing it is free to
   * take another guest. Chaining accounts for this by leaving a gap with no
   * BookingSegment in it, rather than by blocking the employee's calendar.
   */
  processingTimeMinutes: number;
};

export type PlannedSegment = {
  employeeId: string;
  serviceId: string;
  startTime: Date;
  endTime: Date;
  sequenceOrder: number;
};

/**
 * Lays out an ordered list of services back-to-back starting at `startTime`,
 * inserting a gap after any service that has processing time. Works whether
 * consecutive services share an employee or not — the gap is just an absence
 * of a segment, so it's automatically free capacity for anyone's calendar.
 */
export function planSequentialSegments(
  startTime: Date,
  items: PlanServiceInput[],
): PlannedSegment[] {
  if (items.length === 0) {
    throw new Error("planSequentialSegments requires at least one service");
  }

  let cursor = startTime.getTime();
  return items.map((item, index) => {
    const segmentStart = new Date(cursor);
    const segmentEnd = new Date(cursor + item.durationMinutes * 60_000);
    cursor = segmentEnd.getTime() + item.processingTimeMinutes * 60_000;
    return {
      employeeId: item.employeeId,
      serviceId: item.serviceId,
      startTime: segmentStart,
      endTime: segmentEnd,
      sequenceOrder: index + 1,
    };
  });
}

export type ComboWindow = {
  start: Date;
  end: Date;
  /** Minutes actually worked across all segments. */
  activeMinutes: number;
  /** Minutes from first segment start to last segment end, including gaps. */
  totalMinutes: number;
  waitingMinutes: number;
};

export function getComboWindow(segments: PlannedSegment[]): ComboWindow {
  if (segments.length === 0) {
    throw new Error("getComboWindow requires at least one segment");
  }
  const start = segments[0].startTime;
  const end = segments[segments.length - 1].endTime;
  const activeMinutes = segments.reduce(
    (sum, s) => sum + (s.endTime.getTime() - s.startTime.getTime()) / 60_000,
    0,
  );
  const totalMinutes = (end.getTime() - start.getTime()) / 60_000;
  return { start, end, activeMinutes, totalMinutes, waitingMinutes: totalMinutes - activeMinutes };
}

export function getRequiredEmployeeIds(segments: PlannedSegment[]): string[] {
  return [...new Set(segments.map((s) => s.employeeId))];
}

export type BusyInterval = { startTime: Date; endTime: Date };

/** True if [aStart,aEnd) and [bStart,bEnd) share any instant (half-open, matching tstzrange default). */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/** Checks a candidate plan against a single employee's already-known busy intervals, in memory. */
export function planConflictsWithBusy(
  segments: PlannedSegment[],
  employeeId: string,
  busy: BusyInterval[],
): boolean {
  return segments
    .filter((s) => s.employeeId === employeeId)
    .some((s) => busy.some((b) => rangesOverlap(s.startTime, s.endTime, b.startTime, b.endTime)));
}

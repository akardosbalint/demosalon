// Dependency-free IANA timezone conversion, correct across DST transitions.
// Everything is stored and computed in UTC; this is the one seam where a
// salon-local wall-clock hour (e.g. "opens at 9") gets converted to the
// right UTC instant for a specific calendar date.

export const SALON_TIMEZONE = "Europe/Budapest";

/**
 * Minutes to ADD to a UTC instant to get local wall-clock time in `timeZone`
 * (i.e. localTime = utcInstant + offset). Uses the standard
 * format-then-diff trick: no timezone database dependency needed because
 * `Intl` ships one.
 */
function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asIfUtc - date.getTime()) / 60_000;
}

/**
 * Converts a local wall-clock hour on a given calendar date into the
 * correct UTC instant, respecting DST for that specific date. `dateOnly`
 * only needs to carry the right year/month/day (as UTC fields) — business
 * hours are far enough from midnight that they never land on a different
 * calendar day after conversion.
 */
export function businessHourToUtc(
  dateOnly: Date,
  hour: number,
  timeZone: string = SALON_TIMEZONE,
): Date {
  const naiveUtc = new Date(
    Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth(), dateOnly.getUTCDate(), hour, 0, 0, 0),
  );
  const offsetMinutes = getTimezoneOffsetMinutes(naiveUtc, timeZone);
  return new Date(naiveUtc.getTime() - offsetMinutes * 60_000);
}

export function formatTimeInTimezone(date: Date, timeZone: string = SALON_TIMEZONE): string {
  return new Intl.DateTimeFormat("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
}

export function formatDateInTimezone(date: Date, timeZone: string = SALON_TIMEZONE): string {
  return new Intl.DateTimeFormat("hu-HU", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(date);
}

/** YYYY-MM-DD for `date` as seen in `timeZone` — the calendar day a UTC instant belongs to locally. */
export function dateKeyInTimezone(date: Date, timeZone: string = SALON_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}

/** Local wall-clock hour (0-23) of `date` in `timeZone`, for daypart grouping. */
export function localHourInTimezone(date: Date, timeZone: string = SALON_TIMEZONE): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", hour: "2-digit" }).format(date),
  );
}

/** Minutes since local midnight (0-1439) of `date` in `timeZone` — for positioning on a day-grid. */
export function localMinutesOfDay(date: Date, timeZone: string = SALON_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/** The [00:00, 24:00) local-calendar-day window for `dateOnly`, as UTC instants. */
export function localDayRangeUtc(
  dateOnly: Date,
  timeZone: string = SALON_TIMEZONE,
): { start: Date; end: Date } {
  const start = businessHourToUtc(dateOnly, 0, timeZone);
  const nextDay = new Date(
    Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth(), dateOnly.getUTCDate() + 1),
  );
  const end = businessHourToUtc(nextDay, 0, timeZone);
  return { start, end };
}

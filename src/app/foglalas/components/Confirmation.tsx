import { formatTimeInTimezone } from "@/lib/timezone";

export function Confirmation({
  employeeNames,
  startTimeISO,
  serviceNames,
}: {
  employeeNames: string[];
  startTimeISO: string;
  serviceNames: string[];
}) {
  const date = new Date(startTimeISO);
  const dateLabel = new Intl.DateTimeFormat("hu-HU", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
  const timeLabel = formatTimeInTimezone(date);

  const names = employeeNames.join(" és ");
  const verb = employeeNames.length > 1 ? "várnak" : "vár";

  return (
    <div className="flex flex-col items-center text-center gap-4 py-8">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success text-3xl">
        ✓
      </span>
      <h1 className="text-2xl font-semibold text-ink">Foglalva!</h1>
      <p className="text-lg text-ink">
        {names} {verb} rád {dateLabel}, {timeLabel}-kor.
      </p>
      <p className="text-sm text-ink-soft">{serviceNames.join(" + ")}</p>
      <p className="text-sm text-ink-soft mt-4">
        Emailben elküldjük a visszaigazolást, és 24 órával előtte emlékeztetünk — így nem
        maradsz le róla.
      </p>
    </div>
  );
}

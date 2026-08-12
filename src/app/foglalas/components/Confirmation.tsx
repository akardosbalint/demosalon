import Link from "next/link";
import { formatTimeInTimezone } from "@/lib/timezone";

export function Confirmation({
  employeeNames,
  startTimeISO,
  serviceNames,
  manageToken,
}: {
  employeeNames: string[];
  startTimeISO: string;
  serviceNames: string[];
  manageToken: string;
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
  const manageHref = `/foglalas/kezeles/${manageToken}`;

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

      <div className="mt-4 w-full max-w-sm rounded-2xl border border-border bg-card p-4 text-left shadow-soft">
        <p className="text-sm font-medium text-ink">Módosítanád vagy lemondanád?</p>
        <p className="text-sm text-ink-soft mt-1">
          Ezt a linket küldjük emailben is — mentsd el, innen bármikor lemondhatod az időpontot
          (a foglalás előtt 24 óráig).
        </p>
        <Link
          href={manageHref}
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-primary-soft text-primary-hover font-medium py-2.5 text-sm hover:bg-primary-soft-hover transition-colors"
        >
          Foglalásom kezelése
        </Link>
      </div>
    </div>
  );
}

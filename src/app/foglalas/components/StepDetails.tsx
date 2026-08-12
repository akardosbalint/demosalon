import { capitalizeFirst, formatDuration, formatPrice } from "@/lib/format";
import { formatTimeInTimezone } from "@/lib/timezone";
import type { SlotDTO } from "../types";

export type BookingSummary = {
  serviceNames: string[];
  employeeNames: string[];
  totalMinutes: number;
  totalPrice: number;
};

export function StepDetails({
  summary,
  slot,
  customerName,
  customerEmail,
  customerPhone,
  notes,
  onChangeName,
  onChangeEmail,
  onChangePhone,
  onChangeNotes,
  onSubmit,
  errorMessage,
  suggestion,
  onAcceptSuggestion,
}: {
  summary: BookingSummary;
  slot: SlotDTO;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
  onChangeName: (v: string) => void;
  onChangeEmail: (v: string) => void;
  onChangePhone: (v: string) => void;
  onChangeNotes: (v: string) => void;
  onSubmit: () => void;
  errorMessage: string | null;
  suggestion: SlotDTO | null;
  onAcceptSuggestion: () => void;
}) {
  const dateLabel = new Intl.DateTimeFormat("hu-HU", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(slot.startTime));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink mb-1">Már csak pár adat, és kész</h1>
        <p className="text-sm text-ink-soft">Nem kell regisztrálnod — elég az elérhetőséged.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <p className="font-semibold text-ink">{summary.serviceNames.join(" + ")}</p>
        <p className="text-sm text-ink-soft mt-1">{summary.employeeNames.join(" és ")}</p>
        <p className="text-sm text-ink-soft mt-1">
          {capitalizeFirst(dateLabel)}, {formatTimeInTimezone(new Date(slot.startTime))}
        </p>
        <p className="text-sm font-medium text-ink mt-2">
          {formatDuration(summary.totalMinutes)} · {formatPrice(summary.totalPrice)}
        </p>
      </div>

      <form
        id="booking-details-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Teljes név</span>
          <input
            type="text"
            required
            value={customerName}
            onChange={(e) => onChangeName(e.target.value)}
            autoComplete="name"
            className="rounded-xl border border-border bg-card px-4 py-3 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">E-mail cím</span>
          <input
            type="email"
            required
            value={customerEmail}
            onChange={(e) => onChangeEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            className="rounded-xl border border-border bg-card px-4 py-3 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Telefonszám</span>
          <input
            type="tel"
            required
            value={customerPhone}
            onChange={(e) => onChangePhone(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
            placeholder="+36 30 123 4567"
            className="rounded-xl border border-border bg-card px-4 py-3 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Megjegyzés (opcionális)</span>
          <textarea
            value={notes}
            onChange={(e) => onChangeNotes(e.target.value)}
            rows={2}
            className="rounded-xl border border-border bg-card px-4 py-3 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </label>

        {errorMessage && (
          <div role="alert" className="rounded-2xl bg-danger-soft text-danger text-sm p-4">
            <p>{errorMessage}</p>
            {suggestion && (
              <button
                type="button"
                onClick={onAcceptSuggestion}
                className="mt-3 rounded-xl bg-danger text-white text-sm font-medium px-4 py-2"
              >
                {formatTimeInTimezone(new Date(suggestion.startTime))} —{" "}
                {new Intl.DateTimeFormat("hu-HU", { month: "long", day: "numeric" }).format(
                  new Date(suggestion.startTime),
                )}
                , foglalom ezt helyette
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

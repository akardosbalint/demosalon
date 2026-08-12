"use client";

import { dateKeyInTimezone, formatTimeInTimezone, localHourInTimezone } from "@/lib/timezone";
import type { SlotDTO } from "../types";

const DAY_CHIP_COUNT = 10;

function buildDayChips(): { key: string; label: string; weekday: string }[] {
  const chips = [];
  const now = new Date();
  for (let i = 0; i < DAY_CHIP_COUNT; i++) {
    const d = new Date(now.getTime() + i * 24 * 60 * 60_000);
    const key = dateKeyInTimezone(d);
    const weekday = new Intl.DateTimeFormat("hu-HU", { weekday: "short" }).format(d);
    const dayNum = new Intl.DateTimeFormat("hu-HU", { day: "numeric" }).format(d);
    chips.push({ key, label: i === 0 ? "Ma" : i === 1 ? "Holnap" : dayNum, weekday });
  }
  return chips;
}

function groupByDaypart(slots: SlotDTO[]) {
  const groups: { label: string; slots: SlotDTO[] }[] = [
    { label: "Reggel", slots: [] },
    { label: "Délután", slots: [] },
    { label: "Este", slots: [] },
  ];
  for (const slot of slots) {
    const hour = localHourInTimezone(new Date(slot.startTime));
    if (hour < 12) groups[0].slots.push(slot);
    else if (hour < 17) groups[1].slots.push(slot);
    else groups[2].slots.push(slot);
  }
  return groups.filter((g) => g.slots.length > 0);
}

export function StepTime({
  selectedDateKey,
  onSelectDateKey,
  slots,
  slotsLoading,
  selectedSlot,
  onSelectSlot,
  emptySuggestion,
  onAcceptSuggestion,
}: {
  selectedDateKey: string | null;
  onSelectDateKey: (key: string) => void;
  slots: SlotDTO[];
  slotsLoading: boolean;
  selectedSlot: SlotDTO | null;
  onSelectSlot: (slot: SlotDTO) => void;
  emptySuggestion: SlotDTO | null;
  onAcceptSuggestion: () => void;
}) {
  const dayChips = buildDayChips();
  const groups = groupByDaypart(slots);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink mb-1">Mikor jönnél?</h1>
        <p className="text-sm text-ink-soft">Válassz napot, majd egy neked megfelelő időpontot.</p>
      </div>

      <div
        role="tablist"
        aria-label="Nap kiválasztása"
        className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory"
      >
        {dayChips.map((chip) => {
          const active = chip.key === selectedDateKey;
          return (
            <button
              key={chip.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelectDateKey(chip.key)}
              className={`snap-start shrink-0 flex flex-col items-center rounded-2xl border px-4 py-2.5 min-w-[4.25rem] transition-colors ${
                active ? "border-primary bg-primary text-white" : "border-border bg-card text-ink"
              }`}
            >
              <span className="text-[11px] uppercase opacity-80">{chip.weekday}</span>
              <span className="font-semibold">{chip.label}</span>
            </button>
          );
        })}
      </div>

      {slotsLoading && <p className="text-sm text-ink-soft">Szabad időpontok keresése…</p>}

      {!slotsLoading && groups.length > 0 && (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="text-sm font-semibold text-ink-soft mb-2">{group.label}</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {group.slots.map((slot) => {
                  const active = selectedSlot?.startTime === slot.startTime;
                  return (
                    <button
                      key={slot.startTime}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelectSlot(slot)}
                      className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-card text-ink hover:border-primary/50"
                      }`}
                    >
                      {formatTimeInTimezone(new Date(slot.startTime))}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {!slotsLoading && groups.length === 0 && (
        <div className="rounded-2xl bg-primary-soft p-4 text-sm text-ink">
          <p className="font-medium mb-2">Nincs szabad hely ezen a napon.</p>
          {emptySuggestion ? (
            <>
              <p className="text-ink-soft mb-3">
                A legközelebbi szabad időpont:{" "}
                <strong className="text-ink">
                  {new Intl.DateTimeFormat("hu-HU", { month: "long", day: "numeric" }).format(
                    new Date(emptySuggestion.startTime),
                  )}
                  , {formatTimeInTimezone(new Date(emptySuggestion.startTime))}
                </strong>
              </p>
              <button
                type="button"
                onClick={onAcceptSuggestion}
                className="rounded-xl bg-primary text-white text-sm font-medium px-4 py-2 hover:bg-primary-hover transition-colors"
              >
                Mutassuk ezt az időpontot?
              </button>
            </>
          ) : (
            <p className="text-ink-soft">
              A következő 2 hétben sajnos nincs szabad időpont — kérjük, hívj minket telefonon.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { updateEmployeeScheduleAction } from "./actions";
import { WEEKDAY_LABELS, type EmployeeScheduleDTO, type WeekInput } from "./types";

// Hungarian week display order (Monday first); dayOfWeek values stay
// JS-native (0 Sunday .. 6 Saturday) everywhere else, this array is only
// the display order.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

type DayState = { active: boolean; startHour: number; endHour: number };

function toDayState(week: EmployeeScheduleDTO["week"], businessHours: { startHour: number; endHour: number }): DayState[] {
  return week.map((day) =>
    day
      ? { active: true, startHour: day.startHour, endHour: day.endHour }
      : { active: false, startHour: businessHours.startHour, endHour: businessHours.endHour },
  );
}

export function ScheduleEditor({
  schedule,
  businessHours,
}: {
  schedule: EmployeeScheduleDTO;
  businessHours: { startHour: number; endHour: number };
}) {
  const [days, setDays] = useState<DayState[]>(() => toDayState(schedule.week, businessHours));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const hourOptions = Array.from(
    { length: businessHours.endHour - businessHours.startHour + 1 },
    (_, i) => businessHours.startHour + i,
  );

  function updateDay(dayOfWeek: number, patch: Partial<DayState>) {
    setDays((prev) => prev.map((d, i) => (i === dayOfWeek ? { ...d, ...patch } : d)));
    setSavedAt(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const week: WeekInput = days.map((d, dayOfWeek) =>
      d.active ? { dayOfWeek, startHour: d.startHour, endHour: d.endHour } : null,
    );
    const result = await updateEmployeeScheduleAction(schedule.employeeId, week);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSavedAt(Date.now());
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink">
          {schedule.employeeName}
          {!schedule.active && <span className="ml-2 text-xs font-normal text-ink-faint">(inaktív)</span>}
        </p>
      </div>

      <div className="mt-3 flex flex-col divide-y divide-border">
        {DISPLAY_ORDER.map((dayOfWeek) => {
          const day = days[dayOfWeek];
          return (
            <div key={dayOfWeek} className="flex flex-wrap items-center gap-3 py-2">
              <label className="flex w-32 shrink-0 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={day.active}
                  onChange={(e) => updateDay(dayOfWeek, { active: e.target.checked })}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                {WEEKDAY_LABELS[dayOfWeek]}
              </label>
              {day.active ? (
                <div className="flex items-center gap-2 text-sm text-ink-soft">
                  <select
                    value={day.startHour}
                    onChange={(e) => updateDay(dayOfWeek, { startHour: Number(e.target.value) })}
                    className="rounded-lg border border-border bg-card px-2 py-1"
                  >
                    {hourOptions.map((h) => (
                      <option key={h} value={h} disabled={h >= day.endHour}>
                        {h}:00
                      </option>
                    ))}
                  </select>
                  <span>–</span>
                  <select
                    value={day.endHour}
                    onChange={(e) => updateDay(dayOfWeek, { endHour: Number(e.target.value) })}
                    className="rounded-lg border border-border bg-card px-2 py-1"
                  >
                    {hourOptions.map((h) => (
                      <option key={h} value={h} disabled={h <= day.startHour}>
                        {h}:00
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="text-sm text-ink-faint">Szabadnap</span>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-danger-soft text-danger text-sm p-2">
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {saving ? "Mentés…" : "Mentés"}
        </button>
        {savedAt && <span className="text-sm text-success">Elmentve.</span>}
      </div>
    </div>
  );
}

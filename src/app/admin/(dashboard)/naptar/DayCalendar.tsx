"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatTimeInTimezone, localMinutesOfDay } from "@/lib/timezone";
import { cancelBookingAdminAction, markCompletedAction, markNoShowAction } from "./actions";
import { NewBookingPanel } from "./NewBookingPanel";
import type {
  CalendarEmployee,
  CalendarEmployeeWithQualifications,
  CalendarSegment,
  CalendarService,
} from "./types";

const DAY_OPEN_HOUR = 9;
const DAY_CLOSE_HOUR = 19;
const DAY_OPEN_MINUTES = DAY_OPEN_HOUR * 60;
const DAY_SPAN_MINUTES = (DAY_CLOSE_HOUR - DAY_OPEN_HOUR) * 60;
const PX_PER_MINUTE = 1.1;
const GRID_HEIGHT = DAY_SPAN_MINUTES * PX_PER_MINUTE;

function addDaysToKey(dateKey: string, delta: number): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const STATUS_STYLES: Record<CalendarSegment["status"], string> = {
  CONFIRMED: "bg-primary-soft border-primary text-ink",
  COMPLETED: "bg-success-soft border-success text-ink",
  NO_SHOW: "bg-danger-soft border-danger text-ink",
  CANCELLED: "bg-border border-border text-ink-faint",
};

export function DayCalendar({
  dateKey,
  employees,
  segments,
  services,
  employeesWithQualifications,
}: {
  dateKey: string;
  employees: CalendarEmployee[];
  segments: CalendarSegment[];
  services: CalendarService[];
  employeesWithQualifications: CalendarEmployeeWithQualifications[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<CalendarSegment | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showNewBooking, setShowNewBooking] = useState(false);

  function goToDate(key: string) {
    router.push(`/admin/naptar?date=${key}`);
  }

  async function runAction(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setActionPending(true);
    setActionError(null);
    const result = await fn();
    setActionPending(false);
    if (!result.ok) {
      setActionError(result.message ?? "Váratlan hiba történt.");
      return;
    }
    setSelected(null);
    router.refresh();
  }

  const hourMarks = Array.from({ length: DAY_CLOSE_HOUR - DAY_OPEN_HOUR + 1 }, (_, i) => DAY_OPEN_HOUR + i);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToDate(addDaysToKey(dateKey, -1))}
            className="h-9 w-9 rounded-lg border border-border bg-card text-ink"
            aria-label="Előző nap"
          >
            ←
          </button>
          <input
            type="date"
            value={dateKey}
            onChange={(e) => goToDate(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-ink"
          />
          <button
            type="button"
            onClick={() => goToDate(addDaysToKey(dateKey, 1))}
            className="h-9 w-9 rounded-lg border border-border bg-card text-ink"
            aria-label="Következő nap"
          >
            →
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowNewBooking(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors"
        >
          + Új foglalás
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <div
          className="grid min-w-[640px]"
          style={{ gridTemplateColumns: `4rem repeat(${employees.length}, 1fr)` }}
        >
          <div />
          {employees.map((e) => (
            <div key={e.id} className="border-b border-l border-border px-3 py-2 text-sm font-semibold text-ink">
              {e.name}
            </div>
          ))}

          <div className="relative" style={{ height: GRID_HEIGHT }}>
            {hourMarks.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 w-full border-t border-border text-[11px] text-ink-faint px-1"
                style={{ top: (hour - DAY_OPEN_HOUR) * 60 * PX_PER_MINUTE }}
              >
                {hour}:00
              </div>
            ))}
          </div>

          {employees.map((employee) => (
            <div
              key={employee.id}
              className="relative border-l border-border"
              style={{ height: GRID_HEIGHT }}
            >
              {hourMarks.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 w-full border-t border-border"
                  style={{ top: (hour - DAY_OPEN_HOUR) * 60 * PX_PER_MINUTE }}
                />
              ))}
              {segments
                .filter((s) => s.employeeId === employee.id)
                .map((segment) => {
                  const startMin = localMinutesOfDay(new Date(segment.startTime)) - DAY_OPEN_MINUTES;
                  const endMin = localMinutesOfDay(new Date(segment.endTime)) - DAY_OPEN_MINUTES;
                  const top = Math.max(0, startMin) * PX_PER_MINUTE;
                  const height = Math.max(18, (endMin - Math.max(0, startMin)) * PX_PER_MINUTE);
                  return (
                    <button
                      key={segment.id}
                      type="button"
                      onClick={() => {
                        setSelected(segment);
                        setActionError(null);
                      }}
                      className={`absolute left-0.5 right-0.5 rounded-lg border px-1.5 py-1 text-left text-[11px] leading-tight overflow-hidden hover:opacity-90 transition-opacity ${STATUS_STYLES[segment.status]}`}
                      style={{ top, height }}
                    >
                      <span className="block font-semibold">
                        {formatTimeInTimezone(new Date(segment.startTime))}
                      </span>
                      <span className="block truncate">{segment.customerName}</span>
                      <span className="block truncate opacity-80">{segment.serviceName}</span>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-20 flex items-end sm:items-center justify-center bg-ink/40 px-4 py-6"
          onClick={() => !actionPending && setSelected(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-soft-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-semibold text-ink">{selected.customerName}</p>
            <p className="text-sm text-ink-soft">{selected.customerPhone}</p>
            <p className="text-sm text-ink-soft mt-2">{selected.serviceName}</p>
            <p className="text-sm text-ink-soft">
              {formatTimeInTimezone(new Date(selected.startTime))} –{" "}
              {formatTimeInTimezone(new Date(selected.endTime))}
            </p>

            {actionError && (
              <p role="alert" className="mt-3 rounded-lg bg-danger-soft text-danger text-sm p-2">
                {actionError}
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2">
              {selected.status === "CONFIRMED" && (
                <>
                  <button
                    type="button"
                    disabled={actionPending}
                    onClick={() => runAction(() => markCompletedAction(selected.bookingId))}
                    className="rounded-lg bg-success-soft text-success font-medium py-2 text-sm disabled:opacity-50"
                  >
                    Megtörtént
                  </button>
                  <button
                    type="button"
                    disabled={actionPending}
                    onClick={() => runAction(() => markNoShowAction(selected.bookingId))}
                    className="rounded-lg bg-danger-soft text-danger font-medium py-2 text-sm disabled:opacity-50"
                  >
                    Nem jött el (no-show)
                  </button>
                  <button
                    type="button"
                    disabled={actionPending}
                    onClick={() => runAction(() => cancelBookingAdminAction(selected.bookingId))}
                    className="rounded-lg border border-border font-medium py-2 text-sm text-ink disabled:opacity-50"
                  >
                    Lemondás
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg py-2 text-sm text-ink-soft"
              >
                Bezár
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewBooking && (
        <NewBookingPanel
          dateKey={dateKey}
          services={services}
          employeesWithQualifications={employeesWithQualifications}
          onClose={() => setShowNewBooking(false)}
          onCreated={() => {
            setShowNewBooking(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

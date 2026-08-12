"use client";

import { useState } from "react";
import { formatDuration } from "@/lib/format";
import { formatTimeInTimezone } from "@/lib/timezone";
import {
  createManualBookingAction,
  fetchAdminAutoAssignmentAction,
  fetchAdminSlotsAction,
} from "./actions";
import type { BookingItem, CalendarEmployeeWithQualifications, CalendarService, SlotDTO } from "./types";

export function NewBookingPanel({
  dateKey,
  services,
  employeesWithQualifications,
  onClose,
  onCreated,
}: {
  dateKey: string;
  services: CalendarService[];
  employeesWithQualifications: CalendarEmployeeWithQualifications[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [date, setDate] = useState(dateKey);

  const [resolvedItems, setResolvedItems] = useState<BookingItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotDTO[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotDTO | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const eligibleEmployees = employeesWithQualifications.filter((e) =>
    selectedServiceIds.every((id) => e.serviceIds.includes(id)),
  );

  function toggleService(id: string) {
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setResolvedItems(null);
    setSlots([]);
    setSelectedSlot(null);
  }

  async function handleSearch() {
    setSearching(true);
    setSearchError(null);
    setSlots([]);
    setSelectedSlot(null);

    let items: BookingItem[];
    if (mode === "auto") {
      const result = await fetchAdminAutoAssignmentAction(
        selectedServiceIds,
        new Date(`${date}T00:00:00.000Z`).toISOString(),
      );
      if (!result) {
        setSearchError("Nincs szabad időpont a következő 2 hétben ehhez a kombinációhoz.");
        setSearching(false);
        return;
      }
      items = result.items;
    } else {
      if (!selectedEmployeeId) {
        setSearchError("Válassz szakembert.");
        setSearching(false);
        return;
      }
      items = selectedServiceIds.map((serviceId) => ({ serviceId, employeeId: selectedEmployeeId }));
    }

    setResolvedItems(items);
    const daySlots = await fetchAdminSlotsAction(items, date);
    setSlots(daySlots);
    setSearching(false);
    if (daySlots.length === 0) {
      setSearchError("Ezen a napon nincs szabad időpont — próbálj másik napot.");
    }
  }

  async function handleSubmit() {
    if (!resolvedItems || !selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await createManualBookingAction({
      customerName,
      customerEmail: customerEmail.trim() || undefined,
      customerPhone,
      notes: notes || undefined,
      startTimeISO: selectedSlot.startTime,
      items: resolvedItems,
    });
    setSubmitting(false);
    if (result.ok) {
      onCreated();
      return;
    }
    setSubmitError(
      result.suggestion
        ? `${result.message} ${formatTimeInTimezone(new Date(result.suggestion.startTime))}`
        : result.message,
    );
  }

  const totalMinutes = selectedServiceIds.reduce((sum, id, index) => {
    const s = services.find((x) => x.id === id);
    if (!s) return sum;
    const gap = index < selectedServiceIds.length - 1 ? s.processingTimeMinutes : 0;
    return sum + s.durationMinutes + gap;
  }, 0);

  const canSearch = selectedServiceIds.length > 0 && (mode === "auto" || selectedEmployeeId);
  // Email is optional for phone-in customers — but if one is typed, it must
  // be well-formed rather than silently dropped as garbage.
  const trimmedEmail = customerEmail.trim();
  const emailValid = trimmedEmail === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const canSubmit =
    resolvedItems &&
    selectedSlot &&
    customerName.trim().length > 1 &&
    customerPhone.trim().length > 5 &&
    emailValid;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl bg-card p-5 shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">Új foglalás (telefonos)</h2>
          <button type="button" onClick={onClose} className="text-ink-soft text-xl leading-none">
            ×
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-ink mb-2">Szolgáltatások</p>
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
              {services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={selectedServiceIds.includes(s.id)}
                    onChange={() => toggleService(s.id)}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  {s.name} · {formatDuration(s.durationMinutes)}
                </label>
              ))}
            </div>
            {totalMinutes > 0 && (
              <p className="text-xs text-ink-soft mt-1">Összesen kb. {formatDuration(totalMinutes)}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-ink">Szakember</p>
            <div className="flex gap-3 text-sm text-ink">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={mode === "manual"}
                  onChange={() => {
                    setMode("manual");
                    setResolvedItems(null);
                    setSlots([]);
                  }}
                />
                Kiválasztom
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={mode === "auto"}
                  onChange={() => {
                    setMode("auto");
                    setResolvedItems(null);
                    setSlots([]);
                  }}
                />
                Automatikus (első szabad)
              </label>
            </div>
            {mode === "manual" && (
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink"
              >
                <option value="">Válassz…</option>
                {eligibleEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Nap</span>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSlots([]);
                setSelectedSlot(null);
              }}
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink"
            />
          </label>

          <button
            type="button"
            disabled={!canSearch || searching}
            onClick={handleSearch}
            className="rounded-xl border border-primary text-primary font-medium py-2 text-sm disabled:opacity-50"
          >
            {searching ? "Keresés…" : "Szabad időpontok keresése"}
          </button>

          {searchError && <p className="text-sm text-danger">{searchError}</p>}

          {slots.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.startTime}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={`rounded-lg border py-2 text-sm ${
                    selectedSlot?.startTime === slot.startTime
                      ? "border-primary bg-primary text-white"
                      : "border-border text-ink"
                  }`}
                >
                  {formatTimeInTimezone(new Date(slot.startTime))}
                </button>
              ))}
            </div>
          )}

          {selectedSlot && (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <input
                type="text"
                placeholder="Teljes név"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink"
              />
              <input
                type="email"
                placeholder="E-mail cím (opcionális)"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink"
              />
              {!emailValid && (
                <p className="text-xs text-danger -mt-1.5">Nem tűnik érvényes e-mail címnek.</p>
              )}
              <input
                type="tel"
                placeholder="Telefonszám"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink"
              />
              <textarea
                placeholder="Megjegyzés (opcionális)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink resize-none"
              />
              {submitError && <p className="text-sm text-danger">{submitError}</p>}
              <button
                type="button"
                disabled={!canSubmit || submitting}
                onClick={handleSubmit}
                className="rounded-xl bg-primary text-white font-semibold py-2.5 text-sm disabled:opacity-50 hover:bg-primary-hover transition-colors"
              >
                {submitting ? "Foglalás…" : "Foglalás rögzítése"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

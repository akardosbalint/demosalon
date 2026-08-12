"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAutoAssignmentAction,
  fetchFirstAvailableForItemsAction,
  fetchSlotsForItemsAction,
  submitBookingAction,
} from "./actions";
import { ProgressBar } from "./components/ProgressBar";
import { StepServices } from "./components/StepServices";
import { StepEmployee } from "./components/StepEmployee";
import { StepTime } from "./components/StepTime";
import { StepDetails } from "./components/StepDetails";
import { StickyFooter } from "./components/StickyFooter";
import { Confirmation } from "./components/Confirmation";
import { dateKeyInTimezone } from "@/lib/timezone";
import type { BookingItem, ComboDTO, EmployeeDTO, Mode, ServiceDTO, SlotDTO } from "./types";

type Step = 1 | 2 | 3 | 4;

export function BookingWizard({
  services,
  combos,
  employees,
}: {
  services: ServiceDTO[];
  combos: ComboDTO[];
  employees: EmployeeDTO[];
}) {
  const [step, setStep] = useState<Step>(1);

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  const [mode, setMode] = useState<Mode | null>(null);
  const [favoriteEmployeeId, setFavoriteEmployeeId] = useState<string | null>(null);
  const [resolvingEmployee, setResolvingEmployee] = useState(false);
  const [employeeStepError, setEmployeeStepError] = useState<string | null>(null);

  const [resolvedItems, setResolvedItems] = useState<BookingItem[] | null>(null);

  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotDTO[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotDTO | null>(null);
  const [emptySuggestion, setEmptySuggestion] = useState<SlotDTO | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuggestion, setSubmitSuggestion] = useState<SlotDTO | null>(null);

  const [confirmed, setConfirmed] = useState<{
    startTimeISO: string;
    serviceNames: string[];
    employeeNames: string[];
    manageToken: string;
  } | null>(null);

  const servicesById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const employeesById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const eligibleFavorites = useMemo(
    () => employees.filter((e) => selectedServiceIds.every((id) => e.serviceIds.includes(id))),
    [employees, selectedServiceIds],
  );
  const requiresMultipleEmployees = selectedServiceIds.length > 0 && eligibleFavorites.length === 0;
  // When nobody on the team covers the whole combo, auto-assignment is the
  // only option — derived, not synced via effect, so there's no extra render.
  const effectiveMode: Mode | null = requiresMultipleEmployees ? "auto" : mode;

  const totalMinutes = useMemo(
    () =>
      selectedServiceIds.reduce((sum, id, index) => {
        const service = servicesById.get(id);
        if (!service) return sum;
        const gap = index < selectedServiceIds.length - 1 ? service.processingTimeMinutes : 0;
        return sum + service.durationMinutes + gap;
      }, 0),
    [selectedServiceIds, servicesById],
  );
  const totalPrice = useMemo(
    () => selectedServiceIds.reduce((sum, id) => sum + (servicesById.get(id)?.price ?? 0), 0),
    [selectedServiceIds, servicesById],
  );

  const detailsValid =
    customerName.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim()) &&
    customerPhone.trim().length > 5;

  // Refetch the day's slots whenever the resolved employee assignment or the
  // chosen date changes. `slotsLoading`/`emptySuggestion` are armed by the
  // callers that change these two values (see setSelectedDateKey call
  // sites below), not synchronously in this effect body — the effect only
  // resolves them once the async fetch actually completes.
  useEffect(() => {
    if (!resolvedItems || !selectedDateKey) return;
    let cancelled = false;
    fetchSlotsForItemsAction(resolvedItems, selectedDateKey)
      .then(async (found) => {
        if (cancelled) return;
        setSlots(found);
        setSlotsLoading(false);
        if (found.length === 0) {
          const earliestStart = new Date(`${selectedDateKey}T23:59:00.000Z`).toISOString();
          const suggestion = await fetchFirstAvailableForItemsAction(resolvedItems, earliestStart);
          if (!cancelled) setEmptySuggestion(suggestion);
        }
      })
      .catch(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedItems, selectedDateKey]);

  function invalidateFromServices() {
    setMode(null);
    setFavoriteEmployeeId(null);
    invalidateFromEmployee();
  }

  function invalidateFromEmployee() {
    setResolvedItems(null);
    setSelectedDateKey(null);
    setSlots([]);
    setSelectedSlot(null);
    setEmptySuggestion(null);
    setEmployeeStepError(null);
  }

  function toggleService(id: string) {
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    invalidateFromServices();
  }

  function selectCombo(combo: ComboDTO) {
    setSelectedServiceIds(combo.serviceIds);
    invalidateFromServices();
  }

  function selectMode(next: Mode) {
    setMode(next);
    setFavoriteEmployeeId(null);
    invalidateFromEmployee();
  }

  function selectFavoriteEmployee(id: string) {
    setFavoriteEmployeeId(id);
    invalidateFromEmployee();
  }

  async function goToTimeStep() {
    setEmployeeStepError(null);
    setResolvingEmployee(true);
    try {
      let items: BookingItem[];
      let initialSlot: SlotDTO | null;

      if (effectiveMode === "favorite" && favoriteEmployeeId) {
        items = selectedServiceIds.map((serviceId) => ({ serviceId, employeeId: favoriteEmployeeId }));
        initialSlot = await fetchFirstAvailableForItemsAction(items, new Date().toISOString());
      } else {
        const result = await fetchAutoAssignmentAction(selectedServiceIds, new Date().toISOString());
        if (!result) {
          setEmployeeStepError(
            "Sajnos a következő 2 hétben nincs szabad időpont ehhez a kombinációhoz — kérjük, hívj minket telefonon.",
          );
          setResolvingEmployee(false);
          return;
        }
        items = result.items;
        initialSlot = result.slot;
      }

      setResolvedItems(items);
      if (initialSlot) {
        setSlotsLoading(true);
        setEmptySuggestion(null);
        setSelectedDateKey(dateKeyInTimezone(new Date(initialSlot.startTime)));
        setSelectedSlot(initialSlot);
      }
      setStep(3);
    } catch {
      setEmployeeStepError("Váratlan hiba történt, próbáld újra.");
    } finally {
      setResolvingEmployee(false);
    }
  }

  function acceptTimeSuggestion() {
    if (!emptySuggestion) return;
    setSlotsLoading(true);
    setEmptySuggestion(null);
    setSelectedDateKey(dateKeyInTimezone(new Date(emptySuggestion.startTime)));
    setSelectedSlot(emptySuggestion);
  }

  async function handleSubmit(overrideSlot?: SlotDTO) {
    const slot = overrideSlot ?? selectedSlot;
    if (!slot || !resolvedItems) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuggestion(null);

    const serviceNames = selectedServiceIds
      .map((id) => servicesById.get(id)?.name)
      .filter((n): n is string => Boolean(n));
    const employeeNames = [...new Set(resolvedItems.map((i) => i.employeeId))]
      .map((id) => employeesById.get(id)?.name)
      .filter((n): n is string => Boolean(n));

    const result = await submitBookingAction({
      customerName,
      customerEmail,
      customerPhone,
      notes: notes || undefined,
      startTimeISO: slot.startTime,
      items: resolvedItems,
      serviceNames,
      employeeNames,
    });

    setSubmitting(false);
    if (result.ok) {
      setConfirmed({
        startTimeISO: result.startTime,
        serviceNames,
        employeeNames,
        manageToken: result.manageToken,
      });
    } else {
      setSubmitError(result.message);
      setSubmitSuggestion(result.suggestion ?? null);
    }
  }

  function acceptSubmitSuggestion() {
    if (!submitSuggestion) return;
    const slot = submitSuggestion;
    setSelectedSlot(slot);
    setSubmitSuggestion(null);
    setSubmitError(null);
    void handleSubmit(slot);
  }

  function goBack() {
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  }

  if (confirmed) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-10">
        <Confirmation
          employeeNames={confirmed.employeeNames}
          startTimeISO={confirmed.startTimeISO}
          serviceNames={confirmed.serviceNames}
          manageToken={confirmed.manageToken}
        />
      </div>
    );
  }

  const primaryProps = (() => {
    if (step === 1) {
      return {
        label: "Tovább",
        disabled: selectedServiceIds.length === 0,
        onPrimary: () => setStep(2),
      };
    }
    if (step === 2) {
      const ready = effectiveMode === "auto" || (effectiveMode === "favorite" && Boolean(favoriteEmployeeId));
      return {
        label: resolvingEmployee ? "Keresés…" : "Tovább",
        disabled: !ready || resolvingEmployee,
        onPrimary: () => void goToTimeStep(),
      };
    }
    if (step === 3) {
      return {
        label: "Tovább",
        disabled: !selectedSlot,
        onPrimary: () => setStep(4),
      };
    }
    return {
      label: submitting ? "Foglalás…" : "Időpont lefoglalása",
      disabled: submitting || !detailsValid,
      formId: "booking-details-form",
    };
  })();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-xl">
          <p className="font-semibold text-ink">Bloom Szépségszalon</p>
          <div className="mt-3">
            <ProgressBar step={step} />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-xl px-4 py-6">
        {step === 1 && (
          <StepServices
            services={services}
            combos={combos}
            selectedServiceIds={selectedServiceIds}
            onToggleService={toggleService}
            onSelectCombo={selectCombo}
          />
        )}

        {step === 2 && (
          <>
            <StepEmployee
              eligibleEmployees={eligibleFavorites}
              requiresMultipleEmployees={requiresMultipleEmployees}
              mode={effectiveMode}
              favoriteEmployeeId={favoriteEmployeeId}
              onSelectMode={selectMode}
              onSelectFavoriteEmployee={selectFavoriteEmployee}
            />
            {employeeStepError && (
              <p role="alert" className="mt-4 rounded-2xl bg-danger-soft text-danger text-sm p-4">
                {employeeStepError}
              </p>
            )}
          </>
        )}

        {step === 3 && (
          <StepTime
            selectedDateKey={selectedDateKey}
            onSelectDateKey={(key) => {
              setSlotsLoading(true);
              setEmptySuggestion(null);
              setSelectedDateKey(key);
              setSelectedSlot(null);
            }}
            slots={slots}
            slotsLoading={slotsLoading}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
            emptySuggestion={emptySuggestion}
            onAcceptSuggestion={acceptTimeSuggestion}
          />
        )}

        {step === 4 && selectedSlot && (
          <StepDetails
            summary={{
              serviceNames: selectedServiceIds
                .map((id) => servicesById.get(id)?.name)
                .filter((n): n is string => Boolean(n)),
              employeeNames: resolvedItems
                ? [...new Set(resolvedItems.map((i) => i.employeeId))]
                    .map((id) => employeesById.get(id)?.name)
                    .filter((n): n is string => Boolean(n))
                : [],
              totalMinutes,
              totalPrice,
            }}
            slot={selectedSlot}
            customerName={customerName}
            customerEmail={customerEmail}
            customerPhone={customerPhone}
            notes={notes}
            onChangeName={setCustomerName}
            onChangeEmail={setCustomerEmail}
            onChangePhone={setCustomerPhone}
            onChangeNotes={setNotes}
            onSubmit={() => void handleSubmit()}
            errorMessage={submitError}
            suggestion={submitSuggestion}
            onAcceptSuggestion={acceptSubmitSuggestion}
          />
        )}
      </main>

      <StickyFooter
        step={step}
        onBack={goBack}
        primaryLabel={primaryProps.label}
        primaryDisabled={primaryProps.disabled}
        onPrimary={"onPrimary" in primaryProps ? primaryProps.onPrimary : undefined}
        primaryFormId={"formId" in primaryProps ? primaryProps.formId : undefined}
        summary={step < 4 ? { minutes: totalMinutes, price: totalPrice } : null}
      />
    </div>
  );
}

"use server";

import {
  createBooking,
  listAvailableSlotsForDate,
  findNextAvailableSlot,
  resolveAutoAssignment,
  type BookingItemInput,
} from "@/lib/booking";
import {
  BookingConflictError,
  EmployeeNotQualifiedError,
  InvalidBookingRequestError,
} from "@/lib/booking-errors";
import { sendBookingConfirmation, type BookingNotificationPayload } from "@/lib/notifications";

export type SlotDTO = { startTime: string; endTime: string };

function dateKeyToDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function toSlotDTO(slot: { startTime: Date; endTime: Date }): SlotDTO {
  return { startTime: slot.startTime.toISOString(), endTime: slot.endTime.toISOString() };
}

export async function fetchSlotsForItemsAction(
  items: BookingItemInput[],
  dateKey: string,
): Promise<SlotDTO[]> {
  const slots = await listAvailableSlotsForDate({ items, date: dateKeyToDate(dateKey) });
  return slots.map(toSlotDTO);
}

export async function fetchFirstAvailableForItemsAction(
  items: BookingItemInput[],
  earliestStartISO: string,
): Promise<SlotDTO | null> {
  const slot = await findNextAvailableSlot({ items, earliestStart: new Date(earliestStartISO) });
  return slot ? toSlotDTO(slot) : null;
}

export type AutoAssignmentDTO = {
  items: BookingItemInput[];
  slot: SlotDTO;
  requiresMultipleEmployees: boolean;
} | null;

export async function fetchAutoAssignmentAction(
  serviceIds: string[],
  earliestStartISO: string,
): Promise<AutoAssignmentDTO> {
  const result = await resolveAutoAssignment(serviceIds, new Date(earliestStartISO));
  if (!result) return null;
  return {
    items: result.items,
    slot: toSlotDTO(result.slot),
    requiresMultipleEmployees: result.requiresMultipleEmployees,
  };
}

export type SubmitBookingInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes?: string;
  startTimeISO: string;
  items: BookingItemInput[];
  serviceNames: string[];
  employeeNames: string[];
};

export type SubmitBookingResult =
  | { ok: true; bookingId: string; manageToken: string; startTime: string; endTime: string }
  | { ok: false; message: string; suggestion?: SlotDTO };

export async function submitBookingAction(input: SubmitBookingInput): Promise<SubmitBookingResult> {
  try {
    const booking = await createBooking({
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      notes: input.notes,
      startTime: new Date(input.startTimeISO),
      items: input.items,
    });
    const start = booking.segments.reduce(
      (min, s) => (s.startTime < min ? s.startTime : min),
      booking.segments[0].startTime,
    );
    const end = booking.segments.reduce(
      (max, s) => (s.endTime > max ? s.endTime : max),
      booking.segments[0].endTime,
    );

    const notificationPayload: BookingNotificationPayload = {
      bookingId: booking.id,
      manageToken: booking.manageToken,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      startTime: start,
      serviceNames: input.serviceNames,
      employeeNames: input.employeeNames,
    };
    // Never let a notification hiccup fail an already-confirmed booking.
    // The 24h-before reminder is sent separately, by the cron-driven scan
    // in src/lib/reminders.ts — not here, since nothing running inside this
    // request can hold a timer for hours.
    await sendBookingConfirmation(notificationPayload).catch((err) => {
      console.error(`[foglalas] confirmation notification failed for booking ${booking.id}:`, err);
    });

    return {
      ok: true,
      bookingId: booking.id,
      manageToken: booking.manageToken,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    };
  } catch (err) {
    if (err instanceof BookingConflictError) {
      return {
        ok: false,
        message: err.message,
        suggestion: err.suggestion ? toSlotDTO(err.suggestion) : undefined,
      };
    }
    if (err instanceof EmployeeNotQualifiedError || err instanceof InvalidBookingRequestError) {
      return { ok: false, message: err.message };
    }
    throw err;
  }
}

"use server";

import { revalidatePath } from "next/cache";
import {
  createBooking,
  cancelBooking,
  markNoShow,
  markCompleted,
  listAvailableSlotsForDate,
  resolveAutoAssignment,
  type BookingItemInput,
} from "@/lib/booking";
import {
  BookingConflictError,
  EmployeeNotQualifiedError,
  InvalidBookingRequestError,
} from "@/lib/booking-errors";

export type SlotDTO = { startTime: string; endTime: string };

function dateKeyToDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export async function fetchAdminSlotsAction(
  items: BookingItemInput[],
  dateKey: string,
): Promise<SlotDTO[]> {
  const slots = await listAvailableSlotsForDate({ items, date: dateKeyToDate(dateKey) });
  return slots.map((s) => ({ startTime: s.startTime.toISOString(), endTime: s.endTime.toISOString() }));
}

export async function fetchAdminAutoAssignmentAction(
  serviceIds: string[],
  earliestStartISO: string,
): Promise<{ items: BookingItemInput[]; slot: SlotDTO } | null> {
  const result = await resolveAutoAssignment(serviceIds, new Date(earliestStartISO));
  if (!result) return null;
  return {
    items: result.items,
    slot: {
      startTime: result.slot.startTime.toISOString(),
      endTime: result.slot.endTime.toISOString(),
    },
  };
}

export type CreateManualBookingInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes?: string;
  startTimeISO: string;
  items: BookingItemInput[];
};

export type CreateManualBookingResult =
  | { ok: true }
  | { ok: false; message: string; suggestion?: SlotDTO };

export async function createManualBookingAction(
  input: CreateManualBookingInput,
): Promise<CreateManualBookingResult> {
  try {
    await createBooking({
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      notes: input.notes,
      startTime: new Date(input.startTimeISO),
      items: input.items,
    });
    revalidatePath("/admin/naptar");
    return { ok: true };
  } catch (err) {
    if (err instanceof BookingConflictError) {
      return {
        ok: false,
        message: err.message,
        suggestion: err.suggestion
          ? {
              startTime: err.suggestion.startTime.toISOString(),
              endTime: err.suggestion.endTime.toISOString(),
            }
          : undefined,
      };
    }
    if (err instanceof EmployeeNotQualifiedError || err instanceof InvalidBookingRequestError) {
      return { ok: false, message: err.message };
    }
    throw err;
  }
}

export async function cancelBookingAdminAction(bookingId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await cancelBooking({ bookingId, cancelledBy: "admin" });
    revalidatePath("/admin/naptar");
    return { ok: true };
  } catch (err) {
    if (err instanceof InvalidBookingRequestError) return { ok: false, message: err.message };
    throw err;
  }
}

export async function markNoShowAction(bookingId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await markNoShow(bookingId);
    revalidatePath("/admin/naptar");
    return { ok: true };
  } catch (err) {
    if (err instanceof InvalidBookingRequestError) return { ok: false, message: err.message };
    throw err;
  }
}

export async function markCompletedAction(bookingId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await markCompleted(bookingId);
    revalidatePath("/admin/naptar");
    return { ok: true };
  } catch (err) {
    if (err instanceof InvalidBookingRequestError) return { ok: false, message: err.message };
    throw err;
  }
}

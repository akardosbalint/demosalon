"use server";

import { revalidatePath } from "next/cache";
import { cancelBookingByManageToken } from "@/lib/booking";
import { CancellationWindowPassedError, InvalidBookingRequestError } from "@/lib/booking-errors";

export type CancelMyBookingResult = { ok: true } | { ok: false; message: string };

export async function cancelMyBookingAction(token: string): Promise<CancelMyBookingResult> {
  try {
    await cancelBookingByManageToken(token);
    revalidatePath(`/foglalas/kezeles/${token}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof CancellationWindowPassedError || err instanceof InvalidBookingRequestError) {
      return { ok: false, message: err.message };
    }
    throw err;
  }
}

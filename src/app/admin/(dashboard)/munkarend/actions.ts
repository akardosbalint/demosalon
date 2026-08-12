"use server";

import { revalidatePath } from "next/cache";
import { setEmployeeWeeklySchedule, type WeekInput } from "@/lib/staffing";
import { InvalidBookingRequestError } from "@/lib/booking-errors";

export type UpdateScheduleResult = { ok: true } | { ok: false; message: string };

export async function updateEmployeeScheduleAction(
  employeeId: string,
  week: WeekInput,
): Promise<UpdateScheduleResult> {
  try {
    await setEmployeeWeeklySchedule(employeeId, week);
    revalidatePath("/admin/munkarend");
    revalidatePath("/admin/naptar");
    return { ok: true };
  } catch (err) {
    if (err instanceof InvalidBookingRequestError) {
      return { ok: false, message: err.message };
    }
    throw err;
  }
}

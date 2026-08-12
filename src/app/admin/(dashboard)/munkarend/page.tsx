import { getEmployeeSchedules } from "@/lib/staffing";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/booking";
import { ScheduleEditor } from "./ScheduleEditor";

// Schedules change from this very page — never cache a stale week.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Munkarend — Bloom Admin",
};

export default async function StaffSchedulePage() {
  const schedules = await getEmployeeSchedules();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Munkarend</h1>
        <p className="text-sm text-ink-soft mt-1">
          Állítsd be, mely napokon és milyen időtartományban dolgozik az egyes szakemberek — a
          foglalási naptár (vendégoldal és admin egyaránt) csak ezeken belül ajánl fel időpontot.
          A munkaidő nem lóghat ki a szalon nyitvatartásából ({DEFAULT_BUSINESS_HOURS.startHour}:00–
          {DEFAULT_BUSINESS_HOURS.endHour}:00).
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {schedules.map((schedule) => (
          <ScheduleEditor key={schedule.employeeId} schedule={schedule} businessHours={DEFAULT_BUSINESS_HOURS} />
        ))}
      </div>
    </div>
  );
}

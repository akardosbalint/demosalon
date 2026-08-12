import { getActiveEmployeesForCalendar, getDaySegments } from "@/lib/admin";
import { getActiveEmployeesWithQualifications, getServicesAndCombos } from "@/lib/catalog";
import { dateKeyInTimezone } from "@/lib/timezone";
import { DayCalendar } from "./DayCalendar";

export default async function AdminNaptarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const dateKey = params.date ?? dateKeyInTimezone(new Date());

  const [employees, segments, { services }, employeesWithQualifications] = await Promise.all([
    getActiveEmployeesForCalendar(),
    getDaySegments(dateKey),
    getServicesAndCombos(),
    getActiveEmployeesWithQualifications(),
  ]);

  const employeeDTOs = employees.map((e) => ({ id: e.id, name: e.name }));
  const segmentDTOs = segments.map((s) => ({
    id: s.id,
    employeeId: s.employeeId,
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    serviceName: s.service.name,
    bookingId: s.booking.id,
    customerName: s.booking.customerName,
    customerPhone: s.booking.customerPhone,
    status: s.booking.status,
  }));
  const serviceDTOs = services.map((s) => ({
    id: s.id,
    name: s.name,
    durationMinutes: s.durationMinutes,
    processingTimeMinutes: s.processingTimeMinutes,
  }));

  return (
    <DayCalendar
      dateKey={dateKey}
      employees={employeeDTOs}
      segments={segmentDTOs}
      services={serviceDTOs}
      employeesWithQualifications={employeesWithQualifications}
    />
  );
}

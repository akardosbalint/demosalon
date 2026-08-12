// Client-safe DTOs — deliberately not importing from src/lib/staffing.ts
// (which pulls in the Prisma client via src/lib/booking.ts) so this stays
// importable from ScheduleEditor.tsx ("use client").

export const WEEKDAY_LABELS = ["Vasárnap", "Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat"];

export type DayAvailability = { dayOfWeek: number; startHour: number; endHour: number } | null;

export type EmployeeScheduleDTO = {
  employeeId: string;
  employeeName: string;
  active: boolean;
  week: DayAvailability[];
};

export type WeekInput = Array<{ dayOfWeek: number; startHour: number; endHour: number } | null>;

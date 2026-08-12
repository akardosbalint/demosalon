export type CalendarEmployee = { id: string; name: string };

export type CalendarSegment = {
  id: string;
  employeeId: string;
  startTime: string;
  endTime: string;
  serviceName: string;
  bookingId: string;
  customerName: string;
  customerPhone: string;
  status: "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
};

export type CalendarService = {
  id: string;
  name: string;
  durationMinutes: number;
  processingTimeMinutes: number;
};

export type CalendarEmployeeWithQualifications = {
  id: string;
  name: string;
  serviceIds: string[];
};

export type SlotDTO = { startTime: string; endTime: string };
export type BookingItem = { serviceId: string; employeeId: string };

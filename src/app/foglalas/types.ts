export type ServiceDTO = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  processingTimeMinutes: number;
  price: number;
};

export type ComboDTO = {
  id: string;
  name: string;
  description: string | null;
  isFeatured: boolean;
  /** Real percent of recent bookings that chose exactly this combo — null
   * (never 0) when there isn't enough booking history yet. See src/lib/stats.ts. */
  realPopularityPercent: number | null;
  serviceIds: string[];
};

export type EmployeeDTO = {
  id: string;
  name: string;
  bio: string;
  photoUrl: string | null;
  experienceYears: number;
  serviceIds: string[];
};

export type Mode = "favorite" | "auto";

export type BookingItem = { serviceId: string; employeeId: string };

export type SlotDTO = { startTime: string; endTime: string };

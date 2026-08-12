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
  popularityScore: number;
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

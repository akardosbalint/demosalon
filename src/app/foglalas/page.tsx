import { getActiveEmployeesWithQualifications, getServicesAndCombos } from "@/lib/catalog";
import { BookingWizard } from "./BookingWizard";

export const metadata = {
  title: "Időpontfoglalás — Bloom Szépségszalon",
};

export default async function FoglalasPage() {
  const [{ services, combos }, employees] = await Promise.all([
    getServicesAndCombos(),
    getActiveEmployeesWithQualifications(),
  ]);

  const serviceDTOs = services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.durationMinutes,
    processingTimeMinutes: s.processingTimeMinutes,
    price: s.price,
  }));

  const comboDTOs = combos.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    isFeatured: c.isFeatured,
    popularityScore: c.popularityScore,
    serviceIds: c.items.map((i) => i.serviceId),
  }));

  return (
    <BookingWizard services={serviceDTOs} combos={comboDTOs} employees={employees} />
  );
}

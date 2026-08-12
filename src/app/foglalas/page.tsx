import { getActiveEmployeesWithQualifications, getServicesAndCombos } from "@/lib/catalog";
import { BookingWizard } from "./BookingWizard";

export const metadata = {
  title: "Időpontfoglalás — Bloom Szépségszalon",
};

// Without this, Next.js statically prerenders this page at build time (no
// cookies/params force it dynamic on their own) and bakes in whatever
// service/employee IDs existed at build time. Any DB change after
// deploy — a new service, a price edit, a reseed — then makes every visitor's
// client hold IDs the server no longer recognizes, crashing step 2→3 of the
// booking flow. Service/employee data must be read fresh on every request.
export const dynamic = "force-dynamic";

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

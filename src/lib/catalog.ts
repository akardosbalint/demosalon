import { prisma } from "@/lib/prisma";
import { getComboPopularity } from "@/lib/stats";

export async function getServicesAndCombos() {
  const [services, combos, popularity] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.serviceCombo.findMany({
      // popularityScore is now an editorial ordering hint only — see the
      // schema comment. The displayed percentage comes from real booking
      // history (below), never from this field.
      orderBy: { popularityScore: "desc" },
      include: {
        items: {
          orderBy: { sequenceOrder: "asc" },
          include: { service: true },
        },
      },
    }),
    getComboPopularity(),
  ]);

  const percentByComboId = new Map(popularity.map((p) => [p.comboId, p.percent]));
  const combosWithRealPopularity = combos.map((combo) => ({
    ...combo,
    realPopularityPercent: percentByComboId.get(combo.id) ?? null,
  }));

  return { services, combos: combosWithRealPopularity };
}

export async function getActiveEmployeesWithQualifications() {
  const employees = await prisma.employee.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { employeeServices: { select: { serviceId: true } } },
  });

  return employees.map((e) => ({
    id: e.id,
    name: e.name,
    bio: e.bio,
    photoUrl: e.photoUrl,
    experienceYears: e.experienceYears,
    serviceIds: e.employeeServices.map((es) => es.serviceId),
  }));
}

export type EmployeeWithQualifications = Awaited<
  ReturnType<typeof getActiveEmployeesWithQualifications>
>[number];

/** Employees who, alone, can perform every one of the given services. */
export function findEmployeesQualifiedForAll(
  employees: EmployeeWithQualifications[],
  serviceIds: string[],
): EmployeeWithQualifications[] {
  return employees.filter((e) => serviceIds.every((id) => e.serviceIds.includes(id)));
}

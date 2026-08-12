import { prisma } from "@/lib/prisma";

export async function getServicesAndCombos() {
  const [services, combos] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.serviceCombo.findMany({
      orderBy: { popularityScore: "desc" },
      include: {
        items: {
          orderBy: { sequenceOrder: "asc" },
          include: { service: true },
        },
      },
    }),
  ]);

  return { services, combos };
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

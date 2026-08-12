import type { EmployeeDTO, Mode } from "../types";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent font-semibold">
      {initials(name)}
    </span>
  );
}

export function StepEmployee({
  eligibleEmployees,
  requiresMultipleEmployees,
  mode,
  favoriteEmployeeId,
  onSelectMode,
  onSelectFavoriteEmployee,
}: {
  eligibleEmployees: EmployeeDTO[];
  requiresMultipleEmployees: boolean;
  mode: Mode | null;
  favoriteEmployeeId: string | null;
  onSelectMode: (mode: Mode) => void;
  onSelectFavoriteEmployee: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink mb-1">Kihez szeretnél menni?</h1>
        <p className="text-sm text-ink-soft">
          Válaszd ki a kedvenc szakembered, vagy bízd ránk, hogy ki ér rá leghamarabb.
        </p>
      </div>

      {requiresMultipleEmployees && (
        <div className="rounded-2xl bg-accent-soft text-accent text-sm p-4">
          Ehhez a kombinációhoz 2 szakember szükséges — ezt automatikusan összehangoljuk neked.
        </div>
      )}

      {!requiresMultipleEmployees && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onSelectMode("favorite")}
            aria-pressed={mode === "favorite"}
            className={`rounded-2xl border p-4 text-left transition-colors ${
              mode === "favorite" ? "border-primary bg-primary-soft" : "border-border bg-card"
            }`}
          >
            <p className="font-semibold text-ink">Van kedvenc szakemberem</p>
            <p className="text-sm text-ink-soft mt-1">Kiválasztom, kihez szeretnék menni.</p>
          </button>
          <button
            type="button"
            onClick={() => onSelectMode("auto")}
            aria-pressed={mode === "auto"}
            className={`rounded-2xl border p-4 text-left transition-colors ${
              mode === "auto" ? "border-primary bg-primary-soft" : "border-border bg-card"
            }`}
          >
            <p className="font-semibold text-ink">Az első szabad időpontot kérem</p>
            <p className="text-sm text-ink-soft mt-1">
              Automatikusan a legkorábbi szabad időpontot foglaljuk le.
            </p>
          </button>
        </div>
      )}

      {!requiresMultipleEmployees && mode === "favorite" && (
        <div className="flex flex-col gap-2">
          {eligibleEmployees.map((employee) => {
            const selected = favoriteEmployeeId === employee.id;
            return (
              <button
                key={employee.id}
                type="button"
                onClick={() => onSelectFavoriteEmployee(employee.id)}
                aria-pressed={selected}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                  selected ? "border-primary bg-primary-soft" : "border-border bg-card"
                }`}
              >
                <Avatar name={employee.name} />
                <span className="flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-ink">{employee.name}</span>
                    <span className="text-xs text-ink-faint whitespace-nowrap">
                      {employee.experienceYears} év tapasztalat
                    </span>
                  </span>
                  <span className="block text-sm text-ink-soft mt-0.5">{employee.bio}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

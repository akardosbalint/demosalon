import { formatDuration, formatPrice } from "@/lib/format";
import type { ComboDTO, ServiceDTO } from "../types";

function estimateComboMinutes(serviceIds: string[], servicesById: Map<string, ServiceDTO>): number {
  return serviceIds.reduce((sum, id, index) => {
    const service = servicesById.get(id);
    if (!service) return sum;
    const gap = index < serviceIds.length - 1 ? service.processingTimeMinutes : 0;
    return sum + service.durationMinutes + gap;
  }, 0);
}

export function StepServices({
  services,
  combos,
  selectedServiceIds,
  onToggleService,
  onSelectCombo,
}: {
  services: ServiceDTO[];
  combos: ComboDTO[];
  selectedServiceIds: string[];
  onToggleService: (id: string) => void;
  onSelectCombo: (combo: ComboDTO) => void;
}) {
  const servicesById = new Map(services.map((s) => [s.id, s]));
  const featuredCombos = combos.filter((c) => c.isFeatured);

  const isComboActive = (combo: ComboDTO) =>
    combo.serviceIds.length === selectedServiceIds.length &&
    combo.serviceIds.every((id) => selectedServiceIds.includes(id));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-ink mb-1">Milyen szolgáltatásra jössz?</h1>
        <p className="text-sm text-ink-soft">
          Válassz egyet vagy kombinálj többet is — a teljes időtartamot és árat automatikusan
          kiszámoljuk.
        </p>
      </div>

      {featuredCombos.length > 0 && (
        <section aria-labelledby="combos-heading">
          <h2 id="combos-heading" className="text-sm font-semibold text-ink-soft mb-3 uppercase tracking-wide">
            Népszerű kombinációk
          </h2>
          <div className="flex flex-col gap-3">
            {featuredCombos.map((combo) => {
              const minutes = estimateComboMinutes(combo.serviceIds, servicesById);
              const price = combo.serviceIds.reduce(
                (sum, id) => sum + (servicesById.get(id)?.price ?? 0),
                0,
              );
              const active = isComboActive(combo);
              return (
                <button
                  key={combo.id}
                  type="button"
                  onClick={() => onSelectCombo(combo)}
                  aria-pressed={active}
                  className={`text-left rounded-2xl border p-4 shadow-soft transition-colors ${
                    active
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{combo.name}</p>
                      <p className="text-sm text-ink-soft mt-0.5">
                        {combo.serviceIds
                          .map((id) => servicesById.get(id)?.name)
                          .filter(Boolean)
                          .join(" + ")}
                      </p>
                    </div>
                    {combo.popularityScore > 0 && (
                      <span className="shrink-0 rounded-full bg-accent-soft text-accent text-xs font-medium px-2.5 py-1">
                        a vendégek {combo.popularityScore}%-a ezt választja
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-ink mt-3">
                    kb. {formatDuration(minutes)} · {formatPrice(price)}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="services-heading">
        <h2 id="services-heading" className="text-sm font-semibold text-ink-soft mb-3 uppercase tracking-wide">
          Vagy állítsd össze magad
        </h2>
        <div className="flex flex-col gap-2">
          {services.map((service) => {
            const checked = selectedServiceIds.includes(service.id);
            return (
              <label
                key={service.id}
                className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition-colors ${
                  checked ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleService(service.id)}
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-primary)]"
                />
                <span className="flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-ink">{service.name}</span>
                    <span className="text-sm font-medium text-ink whitespace-nowrap">
                      {formatPrice(service.price)}
                    </span>
                  </span>
                  <span className="block text-sm text-ink-soft mt-0.5">
                    {formatDuration(service.durationMinutes)} · {service.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}

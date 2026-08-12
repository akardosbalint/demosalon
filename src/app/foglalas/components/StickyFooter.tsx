import { formatDuration, formatPrice } from "@/lib/format";

export function StickyFooter({
  step,
  onBack,
  primaryLabel,
  primaryDisabled,
  onPrimary,
  primaryFormId,
  summary,
}: {
  step: 1 | 2 | 3 | 4;
  onBack: () => void;
  primaryLabel: string;
  primaryDisabled: boolean;
  onPrimary?: () => void;
  primaryFormId?: string;
  summary?: { minutes: number; price: number } | null;
}) {
  return (
    <div className="sticky bottom-0 inset-x-0 border-t border-border bg-cream/95 backdrop-blur px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <div className="mx-auto max-w-xl flex items-center gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Vissza az előző lépésre"
            className="shrink-0 h-12 w-12 rounded-xl border border-border bg-card text-ink flex items-center justify-center"
          >
            ←
          </button>
        )}
        <div className="flex-1 flex items-center gap-3 min-w-0">
          {summary && summary.minutes > 0 && (
            <div className="hidden sm:block text-sm text-ink-soft whitespace-nowrap">
              {formatDuration(summary.minutes)} · {formatPrice(summary.price)}
            </div>
          )}
          <button
            type={primaryFormId ? "submit" : "button"}
            form={primaryFormId}
            onClick={primaryFormId ? undefined : onPrimary}
            disabled={primaryDisabled}
            className="flex-1 rounded-xl bg-primary text-white font-semibold py-3.5 disabled:opacity-50 hover:bg-primary-hover transition-colors"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

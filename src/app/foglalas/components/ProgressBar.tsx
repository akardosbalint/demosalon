const STEP_LABELS = ["Szolgáltatás", "Szakember", "Időpont", "Adatok"];

export function ProgressBar({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div aria-label={`${step}. lépés a ${STEP_LABELS.length}-ból`} className="w-full">
      <div className="flex items-center justify-between text-xs font-medium text-ink-soft mb-2">
        <span>
          {step}/{STEP_LABELS.length}. lépés
        </span>
        <span>{STEP_LABELS[step - 1]}</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={STEP_LABELS.length}
        className="flex gap-1.5"
      >
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < step ? "bg-primary" : "bg-primary-soft"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

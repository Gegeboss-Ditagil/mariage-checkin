'use client';

export function CounterStepper({
  value,
  min = 0,
  max = 99,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-6">
      <button
        type="button"
        aria-label="Diminuer"
        className="btn-secondary h-16 w-16 text-3xl"
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className="min-w-[4ch] text-center text-5xl font-bold tabular-nums">{value}</span>
      <button
        type="button"
        aria-label="Augmenter"
        className="btn-secondary h-16 w-16 text-3xl"
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

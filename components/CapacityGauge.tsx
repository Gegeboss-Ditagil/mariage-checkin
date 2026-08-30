export function CapacityGauge({
  percent,
  size = 'md',
  showLabel = true,
  warningAt,
}: {
  percent: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  /** Position (0-100) d'un seuil d'alerte à marquer sur la jauge, ex: la
   * limite des 400 places officielles dans une jauge graduée sur 410
   * (officielles + réserve). Au-delà de ce seuil, la barre passe en rouge
   * même si `percent` n'a pas encore atteint 95 -- pour que "on est dans la
   * réserve, ce n'est plus la capacité normale" soit visible d'un coup d'œil. */
  warningAt?: number;
}) {
  const rawPct = Math.max(0, Math.min(100, percent));
  const pct = Math.round(rawPct);
  const overWarning = warningAt !== undefined && rawPct > warningAt;
  const isOver = warningAt !== undefined ? overWarning : pct >= 95;
  const color = isOver ? '#ef4444' : pct >= 75 ? '#eab308' : '#22c55e';
  const textColor =
    isOver ? 'text-status-over' : pct >= 75 ? 'text-status-partial' : 'text-status-complete';
  const height = size === 'lg' ? 'h-4' : size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className="w-full">
      <div
        className={'relative w-full overflow-hidden rounded-full ' + height}
        style={{ backgroundColor: 'rgba(148, 163, 184, 0.3)' }}
      >
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: pct + '%', backgroundColor: color }} />
        {warningAt !== undefined && warningAt > 0 && warningAt < 100 && (
          <div
            className="absolute inset-y-0 w-0.5 bg-accent/40"
            style={{ left: warningAt + '%' }}
            title="Seuil des places officielles"
          />
        )}
      </div>
      {showLabel && <p className={'mt-1 text-right text-xs font-bold tabular-nums ' + textColor}>{pct}%</p>}
    </div>
  );
}


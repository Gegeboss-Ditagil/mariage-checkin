export function CapacityGauge({
  percent,
  size = 'md',
  showLabel = true,
}: {
  percent: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const color = pct >= 95 ? '#ef4444' : pct >= 75 ? '#eab308' : '#22c55e';
  const textColor = pct >= 95 ? 'text-status-over' : pct >= 75 ? 'text-status-partial' : 'text-status-complete';
  const height = size === 'lg' ? 'h-4' : size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className="w-full">
      <div className={'w-full overflow-hidden rounded-full ' + height} style={{ backgroundColor: 'rgba(148, 163, 184, 0.3)' }}>
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: pct + '%', backgroundColor: color }} />
      </div>
      {showLabel && <p className={'mt-1 text-right text-xs font-bold tabular-nums ' + textColor}>{pct}%</p>}
    </div>
  );
}


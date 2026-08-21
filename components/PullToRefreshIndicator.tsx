'use client';

// Petit indicateur affiché en haut de l'écran pendant qu'on tire vers le
// bas, puis pendant le refresh lui-même. Volontairement discret et rapide
// (pas de texte alarmant) pour ne pas inquiéter l'équipe en plein service.
export function PullToRefreshIndicator({
  pulling,
  pullDistance,
  refreshing,
  pullThreshold,
}: {
  pulling: boolean;
  pullDistance: number;
  refreshing: boolean;
  pullThreshold: number;
}) {
  if (!pulling && !refreshing) return null;

  const ready = pullDistance >= pullThreshold;

  return (
    <div
      className="flex items-center justify-center gap-2 overflow-hidden text-xs text-black/50 transition-[height] duration-150"
      style={{ height: refreshing ? 36 : Math.min(pullDistance, 60) }}
    >
      <span
        className={
          'h-3 w-3 rounded-full border-2 border-gold-500 border-t-transparent ' +
          (refreshing || ready ? 'animate-spin' : '')
        }
      />
      <span>{refreshing ? 'Actualisation…' : ready ? 'Relâchez pour actualiser' : 'Tirez pour actualiser'}</span>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { AccountMenu } from '@/components/AccountMenu';

export function TopBar({
  title,
  backHref,
  right,
  onTitleClick,
}: {
  title: string;
  backHref?: string;
  right?: React.ReactNode;
  onTitleClick?: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 bg-night-900/90 backdrop-blur border-b border-dashed border-gold-500/35 dark:bg-white/[0.04] dark:border-white/10 dark:border-solid">
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-1">
        <div className="flex min-w-0 items-center gap-2">
          {backHref && (
            <Link
              href={backHref}
              aria-label="Retour"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold-400/30 bg-night-800/80 text-2xl font-bold leading-none text-gold-200 shadow-card active:scale-[0.95] transition-transform dark:bg-white/[0.06] dark:border-white/10"
            >
              ‹
            </Link>
          )}
          {onTitleClick ? (
            <button type="button" onClick={onTitleClick} aria-label={'Modifier « ' + title + ' »'} className="flex min-w-0 items-center gap-1.5 truncate font-display text-lg font-semibold uppercase tracking-wide text-cream">
              <span className="truncate">{title}</span>
              <span aria-hidden className="shrink-0 text-sm text-gold-300">✎</span>
            </button>
          ) : (
            <h1 className="truncate font-display text-lg font-semibold uppercase tracking-wide text-cream">{title}</h1>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {right}
          <AccountMenu />
        </div>
      </div>

      <div className="pb-2" />
    </header>
  );
}

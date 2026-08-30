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
    <header className="sticky top-0 z-10 bg-glass backdrop-blur border-b border-hairline">
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-1">
        <div className="flex min-w-0 items-center gap-2">
          {backHref && (
            <Link
              href={backHref}
              aria-label="Retour"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-2xl font-bold leading-none text-accent shadow-card active:scale-[0.95] transition-transform"
            >
              ‹
            </Link>
          )}
          {onTitleClick ? (
            <button type="button" onClick={onTitleClick} aria-label={'Modifier « ' + title + ' »'} className="flex min-w-0 items-center gap-1.5 truncate font-display text-lg font-semibold text-text">
              <span className="truncate">{title}</span>
              <span aria-hidden className="shrink-0 text-sm text-accent">✎</span>
            </button>
          ) : (
            <h1 className="truncate font-display text-lg font-semibold text-text">{title}</h1>
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

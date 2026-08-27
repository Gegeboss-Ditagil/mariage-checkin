'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSessionName } from '@/hooks/useSessionName';

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
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const name = useSessionName();

  async function handleLogout() {
    if (typeof window !== 'undefined' && !window.confirm('Se déconnecter ?')) {
      return;
    }
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Meme si la requete echoue (hors ligne), on renvoie vers /login :
      // le cookie de session sera de toute facon invalide/expire cote serveur.
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <header className="sticky top-0 z-10 bg-night-900/90 backdrop-blur border-b border-dashed border-gold-500/35">
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-1">
        <div className="flex min-w-0 items-center gap-2">
          {backHref && (
            <Link
              href={backHref}
              aria-label="Retour"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold-400/30 bg-night-800/80 text-2xl font-bold leading-none text-gold-200 shadow-card active:scale-[0.95] transition-transform"
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
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Se déconnecter"
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-status-over/60 bg-status-over/15 text-lg leading-none text-status-over active:scale-[0.95] transition-transform disabled:opacity-40"
          >
            ⏻
          </button>
        </div>
      </div>

      {name && (
        <p className="truncate px-4 pb-2 text-right text-[11px] font-medium uppercase tracking-wide text-cream/40">
          Connecté : {name}
        </p>
      )}
    </header>
  );
}

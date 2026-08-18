'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function TopBar({
  title,
  backHref,
  right,
}: {
  title: string;
  backHref?: string;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

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
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-night-900/90 backdrop-blur px-4 py-3.5 border-b border-dashed border-gold-500/35">
      <div className="flex min-w-0 items-center gap-2">
        {backHref && (
          <Link
            href={backHref}
            className="-ml-1 px-1 text-2xl leading-none text-gold-300"
            aria-label="Retour"
          >
            ‹
          </Link>
        )}
        <h1 className="truncate font-display text-lg font-semibold uppercase tracking-wide text-cream">
          {title}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {right}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          aria-label="Se déconnecter"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gold-400/25 text-base leading-none text-gold-300/80 active:scale-[0.95] transition-transform disabled:opacity-40"
        >
          ⏻
        </button>
      </div>
    </header>
  );
}

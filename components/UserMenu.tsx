'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSessionName } from '@/hooks/useSessionName';

// Initiales (ex: "Jean-Claude Onokoko" -> "JO") pour le badge rond, utilisees
// quand il n'y a pas de photo de profil.
function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Badge utilisateur flottant en haut a droite, pour les pages qui n'ont pas
 * de TopBar (ecrans d'accueil scan/placement). Un clic ouvre une petite carte
 * avec le nom complet et le bouton de deconnexion.
 */
export function UserMenu() {
  const router = useRouter();
  const name = useSessionName();
  const [open, setOpen] = useState(false);
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

  if (!name) return null;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
      )}
      <div className="fixed right-4 top-4 z-20">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu utilisateur"
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-gold-400/40 bg-night-800/90 text-sm font-bold text-gold-200 shadow-card backdrop-blur active:scale-[0.95] transition-transform"
        >
          {initials(name)}
        </button>

        {open && (
          <div className="absolute right-0 top-12 w-56 rounded-xl2 border border-gold-400/20 bg-night-800 p-3 shadow-card">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-lg leading-none text-cream/60 active:scale-[0.95] transition-transform"
            >
              ×
            </button>
            <p className="truncate pr-6 text-xs font-medium uppercase tracking-wide text-cream/40">
              Connecté
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-cream">{name}</p>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="mt-3 w-full rounded-xl2 border-2 border-status-over/60 bg-status-over/15 py-2 text-sm font-semibold text-status-over disabled:opacity-40"
            >
              {loggingOut ? 'Déconnexion...' : 'Se déconnecter'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

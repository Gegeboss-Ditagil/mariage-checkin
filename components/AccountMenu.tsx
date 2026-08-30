'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSessionName } from '@/hooks/useSessionName';
import { useSessionRole } from '@/hooks/useSessionRole';
import { useTheme, ThemePref } from '@/hooks/useTheme';
import { hasCapability } from '@/lib/permissions';
import { ROLE_LABELS } from '@/lib/types';

const THEME_CHOICES: { pref: ThemePref; label: string }[] = [
  { pref: 'dark', label: 'Sombre' },
  { pref: 'light', label: 'Clair' },
  { pref: 'system', label: 'Auto' },
];

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AccountMenu({ floating = false }: { floating?: boolean }) {
  const router = useRouter();
  const name = useSessionName();
  const role = useSessionRole();
  const { pref, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') setOpen(false); }
    function closeOutside(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOutside);
    };
  }, [open]);

  async function handleLogout() {
    if (typeof window !== 'undefined' && !window.confirm('Se déconnecter ?')) return;
    setLoggingOut(true);
    try { await fetch('/api/auth/logout', { method: 'POST' }); }
    catch { /* La redirection reste possible même si le réseau vient de tomber. */ }
    finally { router.replace('/login'); router.refresh(); }
  }

  if (!name) return null;
  const canHistory = hasCapability(role, 'viewHistory');
  const canAdmin = hasCapability(role, 'adminPanel');
  const canGuestApproval = hasCapability(role, 'guestApproval');

  return (
    <div ref={containerRef} className={floating ? 'fixed right-4 top-4 z-30' : 'relative z-30'}>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open} aria-label="Ouvrir le menu du compte" className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-glass text-xs font-bold text-accent shadow-card backdrop-blur active:scale-[0.95] transition-transform">
        {initials(name)}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 w-64 overflow-hidden rounded-xl2 border border-hairline bg-glass p-3 text-left shadow-elev-2 backdrop-blur">
          <p className="truncate text-sm font-semibold text-text">{name}</p>
          <p className="mb-3 truncate text-xs text-text-faint">{role ? ROLE_LABELS[role] : 'Compte connecté'}</p>

          <div className="border-t border-hairline pt-2">
            <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-text-faint">Thème</p>
            <div role="radiogroup" aria-label="Thème de l'application" className="flex gap-1.5 px-3 pb-2">
              {THEME_CHOICES.map((choice) => (
                <button
                  key={choice.pref}
                  type="button"
                  role="radio"
                  aria-checked={pref === choice.pref}
                  onClick={() => setTheme(choice.pref)}
                  className={
                    'flex-1 rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors ' +
                    (pref === choice.pref
                      ? 'bg-accent text-on-accent'
                      : 'bg-surface-2 text-text-muted hover:bg-accent-tint')
                  }
                >
                  {choice.label}
                </button>
              ))}
            </div>
            <p className="px-3 pb-2 text-[11px] text-text-faint">Auto suit l&apos;iPhone</p>
          </div>

          <div className="space-y-1 border-y border-hairline py-2">
            {canGuestApproval && <Link role="menuitem" href="/approbations" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm font-medium text-text hover:bg-accent-tint">📷 Approbations</Link>}
            {canHistory && <Link role="menuitem" href="/history" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm font-medium text-text hover:bg-accent-tint">≡ Historique</Link>}
            {canAdmin && <Link role="menuitem" href="/admin" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm font-medium text-text hover:bg-accent-tint">⚙ Administration</Link>}
            {!canGuestApproval && !canHistory && !canAdmin && <p className="px-3 py-2 text-xs text-text-faint">Aucun raccourci supplémentaire</p>}
          </div>
          <button role="menuitem" type="button" onClick={handleLogout} disabled={loggingOut} className="mt-2 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-status-over hover:bg-status-over/10 disabled:opacity-40">
            {loggingOut ? 'Déconnexion…' : '⏻ Se déconnecter'}
          </button>
        </div>
      )}
    </div>
  );
}

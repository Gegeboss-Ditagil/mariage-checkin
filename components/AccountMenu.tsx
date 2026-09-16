'use client';

import { Link } from 'next-view-transitions';
import { useTransitionRouter as useRouter } from 'next-view-transitions';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionName } from '@/hooks/useSessionName';
import { useSessionRole } from '@/hooks/useSessionRole';
import { useTheme, ThemePref } from '@/hooks/useTheme';
import { usePolling } from '@/hooks/usePolling';
import { hasCapability } from '@/lib/permissions';
import { ROLE_LABELS } from '@/lib/types';
import { clearGuestApprovalsCache } from '@/lib/guestApprovalClientCache';
import { syncAppBadge, clearAppBadge } from '@/lib/appBadge';

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
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [approvalAlert, setApprovalAlert] = useState<{ id: string; name: string } | null>(null);
  const previousPendingRef = useRef<number | null>(null);
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

  const loadPendingApprovals = useCallback(async () => {
    // cache: 'no-store' -- sans ca, Safari/PWA pouvait reutiliser une
    // reponse HTTP mise en cache pour cette meme URL sondee toutes les 5s,
    // figeant le badge (retour Gersom du 02/09/2026, valeur "hard coded").
    const response = await fetch('/api/guest-approvals?count=pending', { cache: 'no-store' }).catch(() => null);
    if (!response?.ok) return;
    const data = await response.json();
    const nextCount = data.pending_count || 0;
    if (previousPendingRef.current !== null && nextCount > previousPendingRef.current && data.latest?.id) {
      setApprovalAlert({ id: data.latest.id, name: data.latest.nom_invite || 'Nouvel invité' });
      window.setTimeout(() => setApprovalAlert(null), 8000);
    }
    previousPendingRef.current = nextCount;
    setPendingApprovals(nextCount);
    syncAppBadge(nextCount);
  }, []);

  const canPollApprovals = hasCapability(role, 'viewGuestApprovals');

  useEffect(() => {
    if (!canPollApprovals) return;
    void loadPendingApprovals();
  }, [loadPendingApprovals, canPollApprovals]);

  // Sondage maille a la visibilite de l'onglet : mis en pause automatiquement
  // quand l'app passe en arriere-plan (voir hooks/usePolling.ts).
  usePolling(loadPendingApprovals, canPollApprovals ? 5000 : 0);

  async function handleLogout() {
    if (typeof window !== 'undefined' && !window.confirm('Se déconnecter ?')) return;
    setLoggingOut(true);
    try { await fetch('/api/auth/logout', { method: 'POST' }); }
    catch { /* La redirection reste possible même si le réseau vient de tomber. */ }
    finally {
      clearGuestApprovalsCache();
      // Le badge sur l'icône de l'app est partagé par tout appareil, pas par
      // compte -- l'effacer à la déconnexion évite qu'il reste figé pour un
      // compte suivant sur un appareil partagé.
      clearAppBadge();
      router.replace('/login');
      router.refresh();
    }
  }

  if (!name) return null;
  const canHistory = hasCapability(role, 'viewHistory');
  const canAdmin = hasCapability(role, 'adminPanel');
  const canGuestApproval = hasCapability(role, 'viewGuestApprovals');

  return (
    // En paysage, la barre de navigation devient une bande verticale collee
    // au bord droit (voir components/BottomNav.tsx) -- le bouton de compte
    // flottant (utilise sur /scan et /placement via UserMenu) se retrouvait
    // pile dessus, superpose au premier onglet (Recherche) : "les deux SS
    // qui vont par-dessus le bouton recherche" (retour de Gersom le
    // 13/09/2026). Bascule a gauche uniquement en paysage (portrait
    // inchange), avec la meme marge de securite que la bande de droite
    // (env(safe-area-inset-left), pour l'encoche/coin arrondi de ce cote
    // quand le telephone est tenu appareil photo a gauche).
    <div
      ref={containerRef}
      className={
        floating
          ? 'fixed right-4 top-4 z-30 landscape:right-auto landscape:left-[calc(1rem+env(safe-area-inset-left))]'
          : 'relative z-30'
      }
    >
      {approvalAlert && (
        <Link
          href={'/approbations?request=' + approvalAlert.id}
          onClick={() => setApprovalAlert(null)}
          // Meme raison qu'au-dessus : en paysage, cette bannière plein
          // largeur (left-4 right-4) passerait sous la bande de navigation
          // verticale de droite -- son bord droit s'arrete desormais avant
          // elle (largeur de la bande, landscape:w-20, plus sa marge de
          // securite).
          className="fixed left-4 right-4 top-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 glass-toast text-sm landscape:left-[calc(1rem+env(safe-area-inset-left))] landscape:right-[calc(5rem+env(safe-area-inset-right)+0.75rem)]"
        >
          <span><strong>Nouvelle approbation</strong><span className="block truncate text-text-muted">{approvalAlert.name}</span></span>
          <span className="font-semibold text-accent">Ouvrir</span>
        </Link>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open} aria-label="Ouvrir le menu du compte" className="relative flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-glass text-xs font-bold text-accent shadow-card backdrop-blur active:scale-[0.95] transition-transform">
        {initials(name)}
        {/* Badge persistant (pas seulement dans le menu deroulant) -- demande
            de Gersom le 02/09/2026 : "un petit numero ou une petite cloche
            en haut" pour voir d'un coup d'oeil qu'il y a des approbations en
            attente, sans avoir a ouvrir le menu. */}
        {canGuestApproval && pendingApprovals > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full border-2 border-bg bg-status-over px-1 text-center text-[10px] font-bold leading-4 text-white">
            {pendingApprovals > 99 ? '99+' : pendingApprovals}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className={
            // Le bouton bascule a gauche en paysage seulement en variante
            // flottante (voir plus haut) -- le panneau doit s'ouvrir vers la
            // DROITE dans ce cas (sinon ses 16rem de large partiraient hors
            // ecran vers la gauche). En variante non flottante (TopBar), le
            // conteneur est deja cale a droite de la colonne de contenu dans
            // les deux orientations : aucun changement necessaire.
            'absolute top-12 w-64 overflow-hidden rounded-xl2 border border-hairline bg-glass p-3 text-left shadow-elev-2 backdrop-blur ' +
            (floating ? 'right-0 landscape:right-auto landscape:left-0' : 'right-0')
          }
        >
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
            {canGuestApproval && (
              <Link role="menuitem" href="/approbations" onClick={() => setOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-text hover:bg-accent-tint">
                <span>📷 Approbations</span>
                {pendingApprovals > 0 && (
                  <span className="min-w-5 rounded-full bg-status-over px-1.5 text-center text-[10px] font-bold leading-5 text-white">
                    {pendingApprovals > 99 ? '99+' : pendingApprovals}
                  </span>
                )}
              </Link>
            )}
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

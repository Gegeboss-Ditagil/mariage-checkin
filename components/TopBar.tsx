'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AccountMenu } from '@/components/AccountMenu';
import { useSessionRole } from '@/hooks/useSessionRole';

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
  const role = useSessionRole();
  const pathname = usePathname();
  // Pour les comptes de supervision (admin et visibilite), Retour ramene
  // normalement au tableau de bord depuis un ecran operationnel. Cette regle
  // ne s'applique jamais quand on est deja sur /dashboard : sa propre fleche
  // Retour choisit sa cible explicitement (voir app/dashboard/page.tsx) et
  // ne doit jamais etre reecrite vers elle-meme (boucle, corrige le
  // 02/09/2026 -- Remy et l'admin restaient bloques sur la page d'accueil
  // avant ce correctif).
  const onDashboard = pathname === '/dashboard' || pathname?.startsWith('/dashboard/');
  const effectiveBackHref =
    backHref && backHref !== '/' && !onDashboard && (role === 'admin' || role === 'visibilite') ? '/dashboard' : backHref;
  return (
    <header className="sticky top-0 z-10 bg-glass backdrop-blur border-b border-hairline">
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-1">
        <div className="flex min-w-0 items-center gap-2">
          {effectiveBackHref && (
            <Link
              href={effectiveBackHref}
              aria-label="Retour"
              className="glass-icon-button text-2xl font-bold leading-none"
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

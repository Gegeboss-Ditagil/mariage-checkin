'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApprovalIcon } from '@/components/icons';
import { hasCapability } from '@/lib/permissions';
import { usePolling } from '@/hooks/usePolling';
import type { Role } from '@/lib/types';

/**
 * Raccourci volontairement place juste au-dessus de la jauge du scanner.
 * Le menu du compte reste la porte d'entree globale; ce bouton offre aux
 * approbateurs un acces immediat pendant qu'ils surveillent la porte.
 */
export function GuestApprovalsShortcut({ role }: { role: Role }) {
  const [pendingCount, setPendingCount] = useState(0);

  const loadPendingCount = useCallback(async () => {
    // cache: 'no-store' -- voir AccountMenu.tsx pour le meme correctif
    // (badge fige par une reponse HTTP mise en cache, retour Gersom du
    // 02/09/2026).
    const response = await fetch('/api/guest-approvals?count=pending', { cache: 'no-store' }).catch(() => null);
    if (!response?.ok) return;
    const data = await response.json();
    setPendingCount(data.pending_count || 0);
  }, []);

  const canPollApprovals = hasCapability(role, 'viewGuestApprovals');

  useEffect(() => {
    if (!canPollApprovals) return;
    void loadPendingCount();
  }, [loadPendingCount, canPollApprovals]);

  // Sondage maille a la visibilite de l'onglet (voir hooks/usePolling.ts).
  usePolling(loadPendingCount, canPollApprovals ? 5000 : 0);

  if (!hasCapability(role, 'viewGuestApprovals')) return null;

  return (
    <Link
      href="/approbations"
      className="mx-auto mb-3 flex min-h-14 w-[calc(100%-1.5rem)] max-w-md shrink-0 items-center justify-center gap-3 rounded-2xl border border-hairline bg-glass px-5 py-3 font-semibold text-accent shadow-card backdrop-blur-xl transition-transform active:scale-[0.98] landscape:mx-2 landscape:w-auto landscape:max-w-none"
    >
      <span className="relative">
        <ApprovalIcon className="h-6 w-6" />
        {pendingCount > 0 && (
          <span className="absolute -right-3 -top-2 min-w-5 rounded-full bg-status-over px-1 text-center text-[10px] font-bold leading-5 text-white">
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}
      </span>
      <span>{pendingCount > 0 ? `${pendingCount} approbation${pendingCount > 1 ? 's' : ''} en attente` : 'Approbations'}</span>
    </Link>
  );
}

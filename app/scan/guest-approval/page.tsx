'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/TopBar';
import { useSessionRole } from '@/hooks/useSessionRole';
import { hasCapability } from '@/lib/permissions';

/** Ancienne URL conservée comme redirection. La capture se fait maintenant
 * depuis le flux vidéo déjà ouvert sur /scan, sans lancer l'app Caméra. */
export default function GuestApprovalPage() {
  const router = useRouter();
  const role = useSessionRole();
  useEffect(() => {
    if (role && hasCapability(role, 'submitGuestApproval')) router.replace('/scan');
  }, [role, router]);

  if (role && !hasCapability(role, 'submitGuestApproval')) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
        <TopBar title="Invité surprise" backHref="/scan" />
        <p className="mt-8 text-lg font-semibold">Accès réservé</p>
        <p className="text-sm text-text-faint">
          Seuls l'admin et les agents placeurs peuvent prendre la photo. Voyez un agent placeur directement.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Photo d’approbation" backHref="/scan" />
      <div className="flex flex-1 items-center justify-center px-6 text-center text-text-muted">
        La photo se prend désormais directement avec le bouton central du scanner, sans ouvrir l’application Caméra.
      </div>
    </div>
  );
}

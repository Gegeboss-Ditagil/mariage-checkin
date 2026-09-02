'use client';

import Link from 'next/link';
import { hasCapability } from '@/lib/permissions';
import type { Role } from '@/lib/types';

/**
 * Bouton rond en verre "+ Invité" vers /tables/add -- demande de Gersom le
 * 02/09/2026 : "plus un bouton que juste du texte" (auparavant un simple
 * lien texte sur /plan-table), et ajouté au même endroit (coin supérieur
 * droit, à côté du menu du compte) sur /dashboard. Réservé à `addInvitation`
 * (admin/directeur uniquement, jamais placeur/agent_checkin/visibilite --
 * "assure que cette fonction est active seulement... pour directeur de
 * festin et admin afin qu'il puisse vraiment ajouter quelqu'un très
 * rapidement... sans passer par le système d'approbation"). Composant
 * partagé pour ne pas dupliquer cette garde à chaque emplacement.
 */
export function AddInvitationButton({ role }: { role: Role | null }) {
  if (!hasCapability(role, 'addInvitation')) return null;
  return (
    <Link href="/tables/add" aria-label="Ajouter un invité" className="glass-icon-button text-2xl font-bold leading-none">
      +
    </Link>
  );
}

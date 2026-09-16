import { InvitationStatut, STATUS_COLORS, STATUS_LABELS } from '@/lib/types';
import clsx from 'clsx';

// Variante compacte (16/09/2026, retour de Gersom, capture d'écran
// `/tables/[tableId]`) : "le bouton, où c'est écrit non arrivé ou arrivé, ça
// prend trop d'espace sur la ligne... on peut enlever la petite étiquette à
// côté, ça libère plus d'espace pour le nom" — sur cette page, la ligne
// cumule déjà le nom, le compteur "X/Y" et jusqu'à quatre boutons ronds
// (📍/🪑/✅/⇄), contrairement à /search, /staff et /dashboard/liste qui ont
// chacun leur propre ligne pour le nom (badge texte inchangé là, aucun
// problème d'espace signalé). Un simple point coloré remplace le pavé texte
// -- vert/jaune repris de STATUS_COLORS (complet/partiel, déjà ce qu'ils
// étaient), mais rouge pour non_arrive (au lieu du gris `--status-none`,
// repris ailleurs par /dashboard pour son propre indicateur "Non arrivées"
// -- le changer globalement aurait rendu ce tuile visuellement identique à
// "Excédent", déjà rouge) : "en vert c'est arrivé, en jaune partiellement,
// en rouge n'est pas arrivé" est la demande explicite. `excedent` reste
// rouge aussi (lui aussi un signal d'attention) -- le compteur X/Y affiché
// juste à côté distingue déjà les deux cas sans ambiguïté. Le libellé
// textuel reste disponible via `title`/`aria-label`, jamais perdu, juste
// plus affiché en permanence sur la ligne.
const COMPACT_DOT_COLOR: Record<InvitationStatut, string> = {
  complet: 'bg-status-complete',
  partiel: 'bg-status-partial',
  non_arrive: 'bg-status-over',
  excedent: 'bg-status-over',
};

export function StatusBadge({
  statut,
  className,
  compact = false,
}: {
  statut: InvitationStatut;
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span
        aria-label={STATUS_LABELS[statut]}
        title={STATUS_LABELS[statut]}
        className={clsx('inline-block h-2.5 w-2.5 shrink-0 rounded-full', COMPACT_DOT_COLOR[statut], className)}
      />
    );
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white',
        STATUS_COLORS[statut],
        className
      )}
    >
      {STATUS_LABELS[statut]}
    </span>
  );
}

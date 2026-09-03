'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { ComponentType, useCallback, useEffect, useState } from 'react';
import { Role } from '@/lib/types';
import { ApprovalIcon, CameraIcon, GaugeIcon, GridIcon, ScanIcon, SearchIcon, StaffIcon } from '@/components/icons';
import { hasCapability } from '@/lib/permissions';
import { usePolling } from '@/hooks/usePolling';

type NavItem = { href: string; label: string; icon: ComponentType<{ className?: string }>; badge?: number };

const SEARCH_ITEM: NavItem = { href: '/search', label: 'Recherche', icon: SearchIcon };
const PLAN_ITEM: NavItem = { href: '/plan-table', label: 'Plan', icon: GridIcon };
const SCAN_ITEM: NavItem = { href: '/scan', label: 'Scan', icon: ScanIcon };
const DASHBOARD_ITEM: NavItem = { href: '/dashboard', label: 'Bord', icon: GaugeIcon };
const AGENDA_ITEM: NavItem = { href: '/agenda', label: 'Agenda', icon: StaffIcon };
const APPROVALS_ITEM: NavItem = { href: '/approbations', label: 'Approbations', icon: ApprovalIcon };

// Barre operationnelle de base. Les variantes par role plus bas remplacent
// certains raccourcis sans modifier les autorisations serveur.
const STAFF_ITEMS: NavItem[] = [
  { href: '/scan', label: 'Scan', icon: ScanIcon },
  { href: '/search', label: 'Recherche', icon: SearchIcon },
  { href: '/plan-table', label: 'Plan', icon: GridIcon },
  { href: '/dashboard', label: 'Bord', icon: GaugeIcon },
  { href: '/staff', label: 'Staff', icon: StaffIcon },
];

// agent_checkin (accueil) : meme barre que le staff complet -- il garde le
// scan/recherche/dashboard/tables et peut confirmer les arrivees. Les actions
// de deplacement restent masquees et bloquees par la matrice de permissions.
const SCAN_ONLY_ITEMS = STAFF_ITEMS;

// visibilite (Luis, David) : lecture seule -- pas de Scan, pas de Placement.
// A quand meme la capacite viewStaff (lib/permissions.ts) : garde l'onglet.
const READ_ONLY_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Bord', icon: GaugeIcon },
  { href: '/plan-table', label: 'Plan', icon: GridIcon },
  { href: '/search', label: 'Recherche', icon: SearchIcon },
  { href: '/staff', label: 'Staff', icon: StaffIcon },
];

const ITEMS: Record<string, NavItem[]> = {
  directeur: [
    { href: '/search', label: 'Recherche', icon: SearchIcon },
    { href: '/plan-table', label: 'Plan', icon: GridIcon },
    { href: '/dashboard', label: 'Bord', icon: GaugeIcon },
    { href: '/scan', label: 'Scan', icon: ScanIcon },
    { href: '/agenda', label: 'Agenda', icon: StaffIcon },
  ],
  placeur: STAFF_ITEMS,
  agent_checkin: SCAN_ONLY_ITEMS,
  visibilite: READ_ONLY_ITEMS,
  admin: [
    { href: '/search', label: 'Recherche', icon: SearchIcon },
    { href: '/plan-table', label: 'Plan', icon: GridIcon },
    { href: '/scan', label: 'Scan', icon: ScanIcon },
    { href: '/dashboard', label: 'Bord', icon: GaugeIcon },
    { href: '/agenda', label: 'Agenda', icon: StaffIcon },
  ],
};

// Approbations vit toujours dans AccountMenu pour tous les approbateurs
// (badge inclus). Elle apparait aussi dans la barre du bas sur /dashboard
// pour admin/directeur (pas d'autre raccourci rapide sur cette page), mais
// pas sur /scan, qui a deja son propre gros bouton dedie (voir
// GuestApprovalsShortcut) -- voir le bloc contextuel plus bas.

// Bouton central surelevé : Scan pour la plupart des roles (leur action la
// plus frequente), mais Tableau de bord pour le directeur de festin --
// demande de Gersom le 30/08/2026 pour Remy et Tuzola : leur travail
// commence par surveiller le remplissage, pas par scanner des QR (ça reste
// accessible en onglet lateral). Roles absents de cette table gardent Scan
// par defaut.
const CENTRAL_HREF: Record<string, string> = {
  directeur: '/dashboard',
};

// Ordre canonique pour repartir les onglets restants 2 a gauche/2 a droite
// (portrait) ou 2 en haut/2 en bas (paysage) autour du bouton central, quel
// que soit celui qui a ete choisi comme central pour ce role.
const SIDE_ORDER = ['/scan', '/search', '/plan-table', '/dashboard', '/agenda', '/staff', '/approbations'];

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const content = <>
    <span className={clsx('bottom-nav-icon-tile relative', active && 'bottom-nav-icon-tile-active')}>
      <Icon className="h-[30px] w-[30px]" />
      {!!item.badge && <span className="absolute -right-3 -top-2 min-w-5 rounded-full bg-status-over px-1 text-center text-[10px] leading-5 text-white">{item.badge > 99 ? '99+' : item.badge}</span>}
    </span>
    {item.label}
  </>;
  const className = clsx(
    'flex min-h-[76px] flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl py-2 text-[11px] font-semibold transition-colors landscape:min-h-0 landscape:py-0',
    active ? 'text-accent' : 'text-text-muted active:text-text'
  );
  return (
    <Link href={item.href} className={className}>{content}</Link>
  );
}

// Barre "verre liquide" (30/08/2026, demande de Gersom : le bar precedent
// etait trop discret -- "difficile a voir", contraste trop faible, cibles
// trop petites). Repris du langage visuel iOS recent : pilule flottante en
// verre depoli, legerement surelevee du bord, icones plus grandes, libelles
// en text-muted (55% d'opacite) plutot que text-faint (42%, illisible sur
// fond sombre) pour les onglets inactifs.
//
// En paysage (telephone tourne, ou iPad), la pilule horizontale devient une
// bande verticale fixee au bord droit -- "les boutons vont a la droite au
// lieu de rester en bas", le contenu de la page reste seul responsable du
// defilement vertical (voir le patron de page h-dvh + landscape:flex-row
// applique aux ecrans qui utilisent ce composant). Le bouton central se
// souleve alors vers la gauche (vers le contenu) plutot que vers le haut.
export function BottomNav({ role, onCentralAction }: { role: Role; onCentralAction?: () => void }) {
  const pathname = usePathname();
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

  // Sondage maille a la visibilite de l'onglet (voir hooks/usePolling.ts) :
  // la mise a jour du badge n'a aucun interet quand l'ecran est en arriere-plan.
  usePolling(loadPendingCount, canPollApprovals ? 15000 : 0);

  const isAdminDirector = role === 'admin' || role === 'directeur';

  // Navigation contextuelle admin/directeur, affinee le 02/09/2026 (retour
  // de Remy en test : sur /scan, le bouton central redevenait Tableau de
  // bord au lieu de rester l'appareil photo, et Approbations -- deja un
  // gros bouton dedie juste au-dessus de la jauge sur cette page, voir
  // GuestApprovalsShortcut -- doublonnait inutilement la barre du bas.
  // Depuis le dashboard, Scan reste le gros bouton central. Depuis le
  // scanner, le centre reste l'appareil photo (jamais un aller-retour vers
  // Bord) et Tableau de bord prend la place liberee par Approbations, qui
  // reste accessible via le menu du compte (badge conserve).
  let central: NavItem;
  let left: NavItem[];
  let right: NavItem[];

  if (isAdminDirector && pathname.startsWith('/dashboard')) {
    central = SCAN_ITEM;
    left = [SEARCH_ITEM, PLAN_ITEM];
    right = [AGENDA_ITEM, { ...APPROVALS_ITEM, badge: pendingCount }];
  } else if (isAdminDirector && pathname.startsWith('/agenda')) {
    central = SCAN_ITEM;
    left = [SEARCH_ITEM, PLAN_ITEM];
    right = [AGENDA_ITEM, DASHBOARD_ITEM];
  } else if (isAdminDirector && pathname.startsWith('/scan')) {
    central = SCAN_ITEM;
    left = [SEARCH_ITEM, PLAN_ITEM];
    right = [AGENDA_ITEM, DASHBOARD_ITEM];
  } else {
    const roleItems = ITEMS[role] ?? ITEMS.agent_checkin;
    const items = roleItems.map((item) =>
      item.href === '/approbations' ? { ...item, badge: pendingCount } : item
    );
    const centralHref = CENTRAL_HREF[role] ?? '/scan';
    const found = items.find((item) => item.href === centralHref);

    // Pas de bouton central quand le role n'a pas l'onglet vise (visibilite,
    // qui n'a ni Scan ni Bord en central ici puisqu'il n'a pas Scan du
    // tout) : pilule/bande a onglets plats, comme avant.
    if (!found) {
      return (
        <nav
          className={clsx(
            'bottom-nav-glass z-10 mx-auto flex w-[calc(100%-2rem)] max-w-md shrink-0 items-center justify-between',
            'min-h-[96px] border border-hairline px-2.5 py-2 shadow-elev-2 safe-bottom',
            'landscape:mx-0 landscape:mb-0 landscape:h-full landscape:w-20 landscape:max-w-none landscape:flex-col',
            'landscape:justify-center landscape:gap-2 landscape:rounded-none landscape:rounded-l-3xl landscape:border-y-0',
            'landscape:border-r-0 landscape:px-1 landscape:py-4 landscape:safe-right'
          )}
        >
          {items.map((item) => (
            <SideLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
          ))}
        </nav>
      );
    }

    central = found;
    // Repartition confirmee par la maquette : deux onglets de chaque cote du
    // bouton central, dans un ordre stable -- pas un simple decoupage en
    // deux moities de `rest` (l'ordre metier de STAFF_ITEMS ne colle pas
    // exactement a l'ordre visuel voulu par la maquette). Fonctionne quel
    // que soit l'onglet choisi comme central pour ce role (Scan pour la
    // plupart des roles, Tableau de bord pour le directeur de festin en
    // dehors de /scan et /dashboard -- voir CENTRAL_HREF).
    const rest = items.filter((item) => item.href !== centralHref);
    const sorted = [...rest].sort((a, b) => SIDE_ORDER.indexOf(a.href) - SIDE_ORDER.indexOf(b.href));
    const mid = Math.ceil(sorted.length / 2);
    left = sorted.slice(0, mid);
    right = sorted.slice(mid);
  }

  const CentralGlyph = central.icon;
  const centralActive = pathname.startsWith(central.href);
  // Sur /scan, l'action photo prend la place du raccourci central. Vrai
  // pour tous les roles qui peuvent soumettre une approbation, y compris
  // admin/directeur dont le central reste toujours '/scan' sur cette page.
  const photoActionActive = !!onCentralAction && pathname.startsWith('/scan') && central.href === '/scan';

  return (
    <nav
      className={clsx(
        'bottom-nav-glass z-10 mx-auto flex min-h-[96px] w-[calc(100%-2rem)] max-w-md shrink-0 items-center',
        'border border-hairline px-2.5 py-2 shadow-elev-2 safe-bottom',
        'landscape:mx-0 landscape:mb-0 landscape:h-full landscape:w-20 landscape:max-w-none landscape:flex-col',
        'landscape:rounded-none landscape:rounded-l-3xl landscape:border-y-0 landscape:border-r-0 landscape:px-1',
        'landscape:py-4 landscape:safe-right'
      )}
    >
      {left.map((item) => (
        <SideLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
      ))}

      <div className="flex flex-1 justify-center landscape:w-full landscape:flex-none">
        {photoActionActive ? (
          <button
            type="button"
            onClick={onCentralAction}
            aria-label="Prendre une photo pour approbation"
            className={clsx(
              'bottom-nav-central -mt-8 flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-accent text-on-accent',
              'shadow-elev-2 transition-transform active:scale-[0.96] landscape:-ml-6 landscape:mt-0',
              centralActive && 'ring-2 ring-accent ring-offset-2 ring-offset-bg'
            )}
          >
            <CameraIcon className="h-10 w-10" />
          </button>
        ) : (
          <Link
            href={central.href}
            aria-label={central.label}
            className={clsx(
              'bottom-nav-central -mt-8 flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-accent text-on-accent',
              'shadow-elev-2 transition-transform active:scale-[0.96] landscape:-ml-6 landscape:mt-0',
              centralActive && 'ring-2 ring-accent ring-offset-2 ring-offset-bg'
            )}
          >
            <CentralGlyph className="h-10 w-10" />
          </Link>
        )}
      </div>

      {right.map((item) => (
        <SideLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
      ))}
    </nav>
  );
}

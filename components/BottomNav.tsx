'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { ComponentType, useEffect, useState } from 'react';
import { Role } from '@/lib/types';
import { CameraIcon, GaugeIcon, GridIcon, ScanIcon, SearchIcon, StaffIcon } from '@/components/icons';
import { hasCapability } from '@/lib/permissions';

type NavItem = { href: string; label: string; icon: ComponentType<{ className?: string }>; badge?: number };

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
    { href: '/agenda', label: 'Agenda', icon: StaffIcon },
    { href: '/staff', label: 'Staff', icon: StaffIcon },
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

// Approbations vit dans AccountMenu pour tous les approbateurs. Cela garde
// Scan disponible dans la barre admin et remet Bord dans la navigation du
// scanner, sans changer les autorisations serveur.

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
  return (
    <Link
      href={item.href}
      className={clsx(
        'flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-3 text-xs font-semibold transition-colors landscape:min-h-0 landscape:py-0',
        active ? 'text-accent' : 'text-text-muted active:text-text'
      )}
    >
      <span className="relative">
        <Icon className="h-7 w-7" />
        {!!item.badge && <span className="absolute -right-3 -top-2 min-w-5 rounded-full bg-status-over px-1 text-center text-[10px] leading-5 text-white">{item.badge > 99 ? '99+' : item.badge}</span>}
      </span>
      {item.label}
    </Link>
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

  useEffect(() => {
    if (!hasCapability(role, 'viewGuestApprovals')) return;
    let active = true;
    const load = async () => {
      const response = await fetch('/api/guest-approvals?count=pending').catch(() => null);
      if (!response?.ok || !active) return;
      const data = await response.json();
      setPendingCount(data.pending_count || 0);
    };
    void load();
    const timer = window.setInterval(load, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [role]);

  const roleItems = ITEMS[role] ?? ITEMS.agent_checkin;
  const items = roleItems.map((item) =>
    item.href === '/approbations' ? { ...item, badge: pendingCount } : item
  );

  const centralHref = CENTRAL_HREF[role] ?? '/scan';
  const centralItem = items.find((item) => item.href === centralHref);
  const rest = items.filter((item) => item.href !== centralHref);

  // Pas de bouton central quand le role n'a pas l'onglet vise (visibilite,
  // qui n'a ni Scan ni Bord en central ici puisqu'il n'a pas Scan du tout) :
  // pilule/bande a onglets plats, comme avant.
  if (!centralItem) {
    return (
      <nav
        className={clsx(
          'z-10 mx-auto mb-5 flex w-[calc(100%-1.5rem)] max-w-md shrink-0 items-center justify-between',
          'min-h-[84px] rounded-3xl border border-hairline bg-glass px-2 py-2 shadow-elev-2 backdrop-blur-2xl safe-bottom',
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

  // Repartition confirmee par la maquette : deux onglets de chaque cote du
  // bouton central, dans un ordre stable -- pas un simple decoupage en deux
  // moities de `rest` (l'ordre metier de STAFF_ITEMS ne colle pas exactement
  // a l'ordre visuel voulu par la maquette). Fonctionne quel que soit
  // l'onglet choisi comme central pour ce role (Scan pour la plupart des
  // roles, Tableau de bord pour le directeur de festin -- voir CENTRAL_HREF).
  const sorted = [...rest].sort((a, b) => SIDE_ORDER.indexOf(a.href) - SIDE_ORDER.indexOf(b.href));
  const mid = Math.ceil(sorted.length / 2);
  const left = sorted.slice(0, mid);
  const right = sorted.slice(mid);
  const CentralGlyph = centralItem.icon;
  const centralActive = pathname.startsWith(centralItem.href);
  // Sur /scan, l'action photo prend temporairement la place du raccourci
  // central du role. Le directeur conserve donc Bord comme centre ailleurs,
  // tout en obtenant le declencheur photo quand la camera est ouverte.
  const photoActionActive = !!onCentralAction && pathname.startsWith('/scan');

  return (
    <nav
      className={clsx(
        'z-10 mx-auto mb-5 flex min-h-[84px] w-[calc(100%-1.5rem)] max-w-md shrink-0 items-center',
        'rounded-3xl border border-hairline bg-glass px-2 py-2 shadow-elev-2 backdrop-blur-2xl safe-bottom',
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
              '-mt-7 flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent',
              'shadow-elev-2 transition-transform active:scale-[0.96] landscape:-ml-6 landscape:mt-0',
              centralActive && 'ring-2 ring-accent ring-offset-2 ring-offset-bg'
            )}
          >
            <CameraIcon className="h-9 w-9" />
          </button>
        ) : (
          <Link
            href={centralItem.href}
            aria-label={centralItem.label}
            className={clsx(
              '-mt-7 flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent',
              'shadow-elev-2 transition-transform active:scale-[0.96] landscape:-ml-6 landscape:mt-0',
              centralActive && 'ring-2 ring-accent ring-offset-2 ring-offset-bg'
            )}
          >
            <CentralGlyph className="h-9 w-9" />
          </Link>
        )}
      </div>

      {right.map((item) => (
        <SideLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
      ))}
    </nav>
  );
}

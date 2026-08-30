'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { ComponentType } from 'react';
import { Role } from '@/lib/types';
import { GaugeIcon, GridIcon, ScanIcon, SearchIcon, StaffIcon } from '@/components/icons';

type NavItem = { href: string; label: string; icon: ComponentType<{ className?: string }> };

// directeur et placeur ont exactement le meme acces operationnel (voir
// middleware.ts) donc la meme barre de navigation.
// "Placement" a ete retire (19/08/2026) : cet onglet faisait doublon avec
// Scan + Recherche (meme camera QR, meme recherche par nom/table), Gersom a
// demande a le supprimer pour simplifier la barre a 4 boutons.
// Staff ajoute (30/08/2026, maquette Atrium/Maison) : 5e onglet a droite du
// bouton Scan central, pour tout role ayant la capacite viewStaff.
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
  directeur: STAFF_ITEMS,
  placeur: STAFF_ITEMS,
  agent_checkin: SCAN_ONLY_ITEMS,
  visibilite: READ_ONLY_ITEMS,
  admin: [
    { href: '/scan', label: 'Scan', icon: ScanIcon },
    { href: '/dashboard', label: 'Bord', icon: GaugeIcon },
    { href: '/plan-table', label: 'Plan', icon: GridIcon },
    { href: '/search', label: 'Recherche', icon: SearchIcon },
    { href: '/staff', label: 'Staff', icon: StaffIcon },
  ],
};

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
// autour du bouton central, quel que soit celui qui a ete choisi comme
// central pour ce role.
const SIDE_ORDER = ['/scan', '/search', '/plan-table', '/dashboard', '/staff'];

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={clsx(
        'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium',
        active ? 'text-accent' : 'text-text-faint'
      )}
    >
      <Icon className="h-5 w-5" />
      {item.label}
    </Link>
  );
}

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = ITEMS[role] ?? ITEMS.agent_checkin;

  const centralHref = CENTRAL_HREF[role] ?? '/scan';
  const centralItem = items.find((item) => item.href === centralHref);
  const rest = items.filter((item) => item.href !== centralHref);

  // Pas de bouton central quand le role n'a pas l'onglet vise (visibilite,
  // qui n'a ni Scan ni Bord en central ici puisqu'il n'a pas Scan du tout) :
  // barre plate a onglets, comme avant.
  if (!centralItem) {
    return (
      <nav className="sticky bottom-0 z-10 flex border-t border-hairline bg-glass backdrop-blur safe-bottom">
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

  return (
    <nav className="sticky bottom-0 z-10 flex items-end border-t border-hairline bg-glass backdrop-blur safe-bottom">
      {left.map((item) => (
        <SideLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
      ))}

      <div className="flex flex-1 justify-center">
        <Link
          href={centralItem.href}
          aria-label={centralItem.label}
          className={clsx(
            '-mt-6 mb-1.5 flex h-[66px] w-[66px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-elev-2 active:scale-[0.96] transition-transform',
            centralActive && 'ring-2 ring-accent ring-offset-2 ring-offset-bg'
          )}
        >
          <CentralGlyph className="h-7 w-7" />
        </Link>
      </div>

      {right.map((item) => (
        <SideLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
      ))}
    </nav>
  );
}

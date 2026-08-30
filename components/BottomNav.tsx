'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { ComponentType } from 'react';
import { Role } from '@/lib/types';
import { GaugeIcon, GridIcon, ScanIcon, SearchIcon } from '@/components/icons';

type NavItem = { href: string; label: string; icon: ComponentType<{ className?: string }> };

// directeur et placeur ont exactement le meme acces operationnel (voir
// middleware.ts) donc la meme barre de navigation.
// "Placement" a ete retire (19/08/2026) : cet onglet faisait doublon avec
// Scan + Recherche (meme camera QR, meme recherche par nom/table), Gersom a
// demande a le supprimer pour simplifier la barre a 4 boutons.
const STAFF_ITEMS: NavItem[] = [
  { href: '/scan', label: 'Scan', icon: ScanIcon },
  { href: '/search', label: 'Recherche', icon: SearchIcon },
  { href: '/plan-table', label: 'Plan', icon: GridIcon },
  { href: '/dashboard', label: 'Bord', icon: GaugeIcon },
];

// agent_checkin (accueil) : meme barre que le staff complet -- il garde le
// scan/recherche/dashboard/tables et peut confirmer les arrivees. Les actions
// de deplacement restent masquees et bloquees par la matrice de permissions.
const SCAN_ONLY_ITEMS = STAFF_ITEMS;

// visibilite (Luis, David) : lecture seule -- pas de Scan, pas de Placement.
const READ_ONLY_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Bord', icon: GaugeIcon },
  { href: '/plan-table', label: 'Plan', icon: GridIcon },
  { href: '/search', label: 'Recherche', icon: SearchIcon },
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
  ],
};

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

  const scanItem = items.find((item) => item.href === '/scan');
  const rest = items.filter((item) => item.href !== '/scan');

  // Pas de bouton central quand le role n'a pas Scan (visibilite) : barre
  // plate a 3 onglets, comme avant.
  if (!scanItem) {
    return (
      <nav className="sticky bottom-0 z-10 flex border-t border-hairline bg-glass backdrop-blur safe-bottom">
        {items.map((item) => (
          <SideLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
        ))}
      </nav>
    );
  }

  const mid = Math.floor(rest.length / 2);
  const left = rest.slice(0, mid);
  const right = rest.slice(mid);
  const ScanGlyph = scanItem.icon;
  const scanActive = pathname.startsWith(scanItem.href);

  return (
    <nav className="sticky bottom-0 z-10 flex items-end border-t border-hairline bg-glass backdrop-blur safe-bottom">
      {left.map((item) => (
        <SideLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
      ))}

      <div className="flex flex-1 justify-center">
        <Link
          href={scanItem.href}
          aria-label={scanItem.label}
          className={clsx(
            '-mt-6 mb-1.5 flex h-[66px] w-[66px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-elev-2 active:scale-[0.96] transition-transform',
            scanActive && 'ring-2 ring-accent ring-offset-2 ring-offset-bg'
          )}
        >
          <ScanGlyph className="h-7 w-7" />
        </Link>
      </div>

      {right.map((item) => (
        <SideLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
      ))}
    </nav>
  );
}

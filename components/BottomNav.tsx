'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Role } from '@/lib/types';

// directeur et placeur ont exactement le meme acces operationnel (voir
// middleware.ts) donc la meme barre de navigation.
// "Placement" a ete retire (19/08/2026) : cet onglet faisait doublon avec
// Scan + Recherche (meme camera QR, meme recherche par nom/table), Gersom a
// demande a le supprimer pour simplifier la barre a 4 boutons.
const STAFF_ITEMS = [
  { href: '/scan', label: 'Scan', icon: '▣' },
  { href: '/search', label: 'Recherche', icon: '⌕' },
  { href: '/plan-table', label: 'Plan', icon: '▦' },
  { href: '/dashboard', label: 'Bord', icon: '◔' },
];

// agent_checkin (accueil) : meme barre que le staff complet -- il garde le
// scan/recherche/dashboard/tables et peut confirmer les arrivees. Les actions
// de deplacement restent masquees et bloquees par la matrice de permissions.
const SCAN_ONLY_ITEMS = STAFF_ITEMS;

// visibilite (Luis, David) : lecture seule -- pas de Scan, pas de Placement.
const READ_ONLY_ITEMS = [
  { href: '/dashboard', label: 'Bord', icon: '◔' },
  { href: '/plan-table', label: 'Plan', icon: '▦' },
  { href: '/search', label: 'Recherche', icon: '⌕' },
];

const ITEMS: Record<string, { href: string; label: string; icon: string }[]> = {
  directeur: STAFF_ITEMS,
  placeur: STAFF_ITEMS,
  agent_checkin: SCAN_ONLY_ITEMS,
  visibilite: READ_ONLY_ITEMS,
  admin: [
    { href: '/scan', label: 'Scan', icon: '▣' },
    { href: '/dashboard', label: 'Bord', icon: '◔' },
    { href: '/plan-table', label: 'Plan', icon: '▦' },
    { href: '/search', label: 'Recherche', icon: '⌕' },
  ],
};

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = ITEMS[role] ?? ITEMS.agent_checkin;

  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-black/5 bg-white/95 backdrop-blur safe-bottom">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium',
              active ? 'text-ink' : 'text-black/40'
            )}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}


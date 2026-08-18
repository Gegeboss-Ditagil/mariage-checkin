'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Role } from '@/lib/types';

const ITEMS: Record<string, { href: string; label: string; icon: string }[]> = {
  agent_checkin: [
    { href: '/scan', label: 'Scan', icon: '▣' },
    { href: '/search', label: 'Recherche', icon: '⌕' },
    { href: '/tables', label: 'Tables', icon: '▦' },
    { href: '/dashboard', label: 'Bord', icon: '◔' },
  ],
  admin: [
    { href: '/scan', label: 'Scan', icon: '▣' },
    { href: '/dashboard', label: 'Bord', icon: '◔' },
    { href: '/tables', label: 'Tables', icon: '▦' },
    { href: '/history', label: 'Historique', icon: '≡' },
    { href: '/admin', label: 'Admin', icon: '⚙' },
  ],
  placeur: [
    { href: '/placement', label: 'Placement', icon: '▣' },
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

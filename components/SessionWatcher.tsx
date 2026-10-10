'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const INTERVAL_MS = 20_000;
const PUBLIC = ['/login', '/approve', '/offline'];

function cookieRole(): string | null {
  const match = document.cookie.match(/(?:^|; )wc_role=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// v1.78.0, demande de Gersom : un rôle changé par un admin doit fonctionner
// « directement après ». Toutes les 20 s (onglet visible) et au retour sur
// l'app, on demande au serveur l'état réel du compte : rôle changé -> la page
// se recharge avec la nouvelle barre de navigation et les nouveaux droits ;
// compte désactivé -> retour à la connexion.
export function SessionWatcher() {
  const pathname = usePathname();

  useEffect(() => {
    if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))) return;
    let stopped = false;
    async function check() {
      if (stopped || document.visibilityState !== 'visible' || !navigator.onLine) return;
      const before = cookieRole();
      if (!before) return;
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (res.status === 401) {
          window.location.assign('/login');
          return;
        }
        if (!res.ok) return;
        const { role } = (await res.json()) as { role: string };
        if (role && role !== before) window.location.reload();
      } catch {
        /* réseau : on réessaiera */
      }
    }
    const timer = window.setInterval(check, INTERVAL_MS);
    const onVisible = () => void check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pathname]);

  return null;
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { warmGuestApprovals } from '@/lib/guestApprovalClientCache';

const SPLASH_DURATION_MS = 3000;

export function SplashScreen({
  next,
  warmApprovals = false,
  version,
}: {
  next: string;
  warmApprovals?: boolean;
  version?: string;
}) {
  const router = useRouter();
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Le splash n'est plus seulement decoratif : Next charge deja le code de
    // la destination et les approbateurs chargent la liste + les six
    // premieres photos pendant ces trois secondes.
    router.prefetch(next);
    if (warmApprovals) void warmGuestApprovals();
    const fadeTimer = setTimeout(() => setFading(true), SPLASH_DURATION_MS);
    const navTimer = setTimeout(() => router.replace(next), SPLASH_DURATION_MS + 350);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(navTimer);
    };
  }, [next, router, warmApprovals]);

  return (
    <div
      onClick={() => router.replace(next)}
      className={
        'fixed inset-0 z-50 flex items-center justify-center bg-bg bg-cover bg-center bg-no-repeat transition-opacity duration-300 ' +
        (fading ? 'opacity-0' : 'opacity-100')
      }
      style={{ backgroundImage: "url('/images/splash-bg.jpg')" }}
    >
      {/* Numero de version (package.json, lu au build) : toujours savoir sur
          quelle version on ouvre l'app, sans ouvrir les outils de dev. */}
      {version ? (
        <span
          className="absolute bottom-3 right-4 text-xs font-semibold tracking-wide text-white/80"
          style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.65)' }}
        >
          v{version}
        </span>
      ) : null}
    </div>
  );
}

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
  // Numero de version affiche discretement en bas a droite (ex. "v1.39.2"),
  // uniquement fourni par app/page.tsx (splash avant connexion) -- absent
  // sur l'usage post-connexion (app/dashboard/page.tsx), qui n'a pas ce
  // besoin de tracabilite.
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
      {version && (
        // Décalé le 13/09/2026 (retour de Gersom : "c'est trop en bas à
        // droite... une translation d'à peu près 1 cm à l'angle 315°") --
        // 315° (cap boussole, sens horaire depuis le nord) pointe vers le
        // nord-ouest : le badge remonte donc légèrement vers le centre au
        // lieu de rester collé dans l'angle exact de l'écran. Un vecteur de
        // 1 cm à 315° se décompose en ~0,71 cm vers le haut et ~0,71 cm vers
        // la gauche (cos 45° = sin 45° ≈ 0,71).
        <span
          className="pointer-events-none absolute bottom-3 right-4 text-[11px] font-medium text-white/70"
          style={{ transform: 'translate(-0.71cm, -0.71cm)' }}
        >
          v{version}
        </span>
      )}
    </div>
  );
}

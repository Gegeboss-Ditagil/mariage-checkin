'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useTheme, ThemePref } from '@/hooks/useTheme';
import { useSessionRole } from '@/hooks/useSessionRole';
import { landingPathForRole } from '@/lib/permissions';

// Ecran affiche une seule fois, juste apres la premiere connexion reussie
// (voir app/login/page.tsx) -- le drapeau checkin-theme-chosen en
// localStorage empeche qu'il revienne aux connexions suivantes. Accessible a
// tous les roles authentifies (bypass des prefixes de canAccessPath dans
// middleware.ts : purement une preference d'affichage, aucune donnee
// sensible).
const CHOICES: { pref: ThemePref; title: string; subtitle: string }[] = [
  { pref: 'dark', title: 'Sombre — Maison', subtitle: 'recommandé en soirée' },
  { pref: 'light', title: 'Clair — Atrium', subtitle: 'meilleur en plein jour' },
  { pref: 'system', title: 'Automatique', subtitle: 'suit le réglage de votre iPhone' },
];

export default function ThemeOnboardingPage() {
  return (
    <Suspense fallback={null}>
      <ThemeOnboardingForm />
    </Suspense>
  );
}

function ThemeOnboardingForm() {
  const router = useRouter();
  const params = useSearchParams();
  const role = useSessionRole();
  const { pref, setTheme, markThemeChosen } = useTheme();

  function continueToApp() {
    markThemeChosen();
    const next = params.get('next');
    router.replace(next || (role ? landingPathForRole(role) : '/scan'));
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center gap-8 bg-bg px-6 py-10">
      <div className="text-center">
        <p className="eyebrow">Bienvenue</p>
        <h1 className="mt-1 text-2xl font-semibold text-text">Choisissez votre thème</h1>
        <p className="mt-1 text-sm text-text-muted">Modifiable à tout moment depuis le menu du compte.</p>
      </div>

      <div role="radiogroup" aria-label="Thème de l'application" className="space-y-3">
        {CHOICES.map((choice) => {
          const checked = pref === choice.pref;
          return (
            <button
              key={choice.pref}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setTheme(choice.pref)}
              className={
                'flex w-full min-h-tap items-center gap-4 rounded-xl2 border px-4 py-3.5 text-left transition-colors ' +
                (checked ? 'border-accent bg-accent-tint' : 'border-hairline bg-surface')
              }
            >
              <span
                aria-hidden
                className={
                  'h-10 w-10 shrink-0 rounded-full border ' +
                  (choice.pref === 'dark'
                    ? 'border-[#c2a26a] bg-[#14141a]'
                    : choice.pref === 'light'
                      ? 'border-hairline bg-[#f4f4f7]'
                      : 'border-hairline bg-gradient-to-br from-[#f4f4f7] to-[#14141a]')
                }
              />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-text">{choice.title}</span>
                <span className="block text-xs text-text-muted">{choice.subtitle}</span>
              </span>
              <span
                aria-hidden
                className={
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ' +
                  (checked ? 'border-accent bg-accent text-on-accent' : 'border-hairline text-transparent')
                }
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>

      <button type="button" className="btn-primary w-full" onClick={continueToApp}>
        Continuer vers le scan
      </button>
    </div>
  );
}

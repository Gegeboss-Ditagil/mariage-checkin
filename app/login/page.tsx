'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoldSeal } from '@/components/BrandMotif';
import { landingPathForRole } from '@/lib/permissions';
import { Role } from '@/lib/types';
import { useTheme } from '@/hooks/useTheme';

const THEME_CHOSEN_KEY = 'checkin-theme-chosen';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function firstName(fullName: string): string {
  return fullName.trim().split(' ')[0] || fullName;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { theme } = useTheme();
  const [nomAffichage, setNomAffichage] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [nextHref, setNextHref] = useState<string | null>(null);

  useEffect(() => {
    if (!welcomeName || !nextHref) return;
    const timer = setTimeout(() => {
      router.replace(nextHref);
      router.refresh();
    }, 2200);
    return () => clearTimeout(timer);
  }, [welcomeName, nextHref, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'pin', nom_affichage: nomAffichage, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Connexion impossible');
        return;
      }
      const next = params.get('next');
      // Directeur de festin et Visibilite atterrissent sur le tableau de
      // bord : c'est ce qu'ils regardent en priorite. Agent placeur (comme
      // Agent scan) atterrit sur /scan -- son travail commence par scanner
      // ou chercher un invite, pas par consulter le tableau de bord (retour
      // arriere le 20/08/2026 : /dashboard ne convenait pas pour ce role).
      const fallback = landingPathForRole(data.user.role as Role);
      const target = next || fallback;
      // Ecran de choix de theme une seule fois, juste apres la toute
      // premiere connexion reussie (drapeau checkin-theme-chosen) -- voir
      // app/onboarding/theme/page.tsx. Preserve la destination initiale via
      // ?next= pour ne pas casser une redirection profonde (ex: lien direct
      // vers une fiche invite envoye par un autre agent).
      const alreadyChosen = window.localStorage.getItem(THEME_CHOSEN_KEY) === '1';
      setNextHref(alreadyChosen ? target : `/onboarding/theme?next=${encodeURIComponent(target)}`);
      setWelcomeName(data.user.nom_complet || data.user.nom_affichage);
    } catch {
      setError('Erreur reseau - verifiez votre connexion');
    } finally {
      setLoading(false);
    }
  }

  if (welcomeName) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-status-complete px-6 text-center text-white">
        <p className="font-display text-2xl font-bold">Bienvenue, {firstName(welcomeName)} !</p>
        <p className="text-lg font-medium">Merci pour votre aide aujourd'hui 🙏</p>
        <button
          className="mt-6 rounded-xl2 border-2 border-white/70 px-6 py-2.5 text-sm font-semibold"
          onClick={() => {
            if (nextHref) {
              router.replace(nextHref);
              router.refresh();
            }
          }}
        >
          Continuer →
        </button>
      </div>
    );
  }

  const dark = theme === 'dark';

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-bg px-6 py-10">
      <div className="relative flex flex-col items-center text-center">
        {/* Halo champagne discret derriere le sceau en Maison ; carte neutre en Atrium (maquette). */}
        {dark && (
          <div
            aria-hidden
            className="absolute -top-6 h-40 w-40 rounded-full opacity-40 blur-2xl"
            style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }}
          />
        )}
        <GoldSeal size={104} />
        <p className="eyebrow mt-6">Check-in Staff</p>
        <p className="font-name mt-1 text-2xl font-semibold text-text">Nelly &amp; Gersom</p>
        <p className="text-xs uppercase tracking-[0.2em] text-text-faint">Dos Goncalves</p>
      </div>

      <div className="relative mt-10 w-full max-w-sm rounded-xl3 border border-hairline bg-surface p-6 shadow-elev-2 dark:backdrop-blur">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Votre nom
            </label>
            <input
              className="w-full rounded-xl2 border-2 border-hairline bg-surface-2 px-4 py-4 text-lg text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
              placeholder="Ex: Dos"
              value={nomAffichage}
              onChange={(e) => setNomAffichage(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Code PIN
            </label>
            <input
              className="w-full rounded-xl2 border-2 border-hairline bg-surface-2 px-4 py-4 text-lg tracking-[0.6em] text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
              placeholder="****"
              inputMode="numeric"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="text-sm font-medium text-status-over">{error}</p>}

          <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>

      <p className="relative mt-8 max-w-xs text-center text-sm text-text-faint">
        Merci pour vos efforts :) Vous êtes la meilleure équipe !
      </p>
    </div>
  );
}


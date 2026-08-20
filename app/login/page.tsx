'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoldSeal, FlightPath, StarField } from '@/components/BrandMotif';

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
      const fallback =
        data.user.role === 'directeur' || data.user.role === 'visibilite' ? '/dashboard' : '/scan';
      setNextHref(next || fallback);
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

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-night-radial px-6 py-10">
      <StarField />
      <FlightPath className="absolute left-1/2 top-6 h-20 w-56 -translate-x-1/2" />

      <div className="relative flex flex-col items-center text-center">
        <GoldSeal size={104} />
        <p className="eyebrow mt-6">Check-in Staff</p>
        <p className="mt-1 font-display text-2xl font-semibold text-cream">Nelly &amp; Gersom</p>
        <p className="text-xs uppercase tracking-[0.2em] text-cream/45">Dos Goncalves</p>
      </div>

      <div className="relative mt-10 w-full max-w-sm rounded-xl3 border border-gold-400/20 bg-night-800/80 p-6 shadow-card backdrop-blur">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-cream/50">
              Votre nom
            </label>
            <input
              className="w-full rounded-xl2 border-2 border-gold-400/25 bg-night-900/70 px-4 py-4 text-lg text-cream placeholder:text-cream/30 focus:border-gold-400 focus:outline-none"
              placeholder="Ex: Dos"
              value={nomAffichage}
              onChange={(e) => setNomAffichage(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-cream/50">
              Code PIN
            </label>
            <input
              className="w-full rounded-xl2 border-2 border-gold-400/25 bg-night-900/70 px-4 py-4 text-lg tracking-[0.6em] text-cream placeholder:text-cream/30 focus:border-gold-400 focus:outline-none"
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

      <p className="relative mt-8 max-w-xs text-center text-sm text-cream/40">
        Merci pour vos efforts :) Vous êtes la meilleure équipe !
      </p>
    </div>
  );
}


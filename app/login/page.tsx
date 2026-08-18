'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoldSeal, FlightPath, StarField } from '@/components/BrandMotif';
import { InstallAppButton } from '@/components/InstallAppButton';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<'equipe' | 'admin'>('equipe');
  const [nomAffichage, setNomAffichage] = useState('');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const body =
        tab === 'admin' ? { mode: 'password', email, password } : { mode: 'pin', nom_affichage: nomAffichage, pin };
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Connexion impossible');
        return;
      }
      const next = params.get('next');
      const fallback = data.user.role === 'placeur' ? '/placement' : '/scan';
      router.replace(next || fallback);
      router.refresh();
    } catch {
      setError('Erreur reseau - verifiez votre connexion');
    } finally {
      setLoading(false);
    }
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
        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setTab('equipe')}
            className={
              'flex-1 rounded-xl2 border py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors ' +
              (tab === 'equipe'
                ? 'border-gold-400/70 bg-gold-400/15 text-gold-200'
                : 'border-cream/10 bg-transparent text-cream/40')
            }
          >
            Equipe
          </button>
          <button
            type="button"
            onClick={() => setTab('admin')}
            className={
              'flex-1 rounded-xl2 border py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors ' +
              (tab === 'admin'
                ? 'border-gold-400/70 bg-gold-400/15 text-gold-200'
                : 'border-cream/10 bg-transparent text-cream/40')
            }
          >
            Admin
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {tab === 'admin' ? (
            <>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-cream/50">
                  Email
                </label>
                <input
                  className="w-full rounded-xl2 border-2 border-gold-400/25 bg-night-900/70 px-4 py-4 text-lg text-cream placeholder:text-cream/30 focus:border-gold-400 focus:outline-none"
                  placeholder="admin@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-cream/50">
                  Mot de passe
                </label>
                <input
                  className="w-full rounded-xl2 border-2 border-gold-400/25 bg-night-900/70 px-4 py-4 text-lg text-cream placeholder:text-cream/30 focus:border-gold-400 focus:outline-none"
                  placeholder="........"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-cream/50">
                  Votre nom
                </label>
                <input
                  className="w-full rounded-xl2 border-2 border-gold-400/25 bg-night-900/70 px-4 py-4 text-lg text-cream placeholder:text-cream/30 focus:border-gold-400 focus:outline-none"
                  placeholder="Ex: Agent001"
                  value={nomAffichage}
                  onChange={(e) => setNomAffichage(e.target.value)}
                  autoComplete="username"
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
            </>
          )}

          {error && <p className="text-sm font-medium text-status-over">{error}</p>}

          <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>

      <p className="relative mt-8 max-w-xs text-center text-sm text-cream/40">
        Merci pour vos efforts :) Vous etes la meilleure equipe !
      </p>

      <InstallAppButton />
    </div>
  );
}

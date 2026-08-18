'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div
      className="relative flex min-h-dvh flex-col justify-end bg-[#1a2942] bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/images/login-bg.jpg')" }}
    >
      {/* Voile degrade pour que la carte de connexion reste lisible sur l'image */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-[#0f1a2e] via-[#0f1a2e]/80 to-transparent" />

      <div className="relative rounded-t-[2rem] bg-white px-6 pb-10 pt-8 shadow-[0_-12px_48px_rgba(0,0,0,0.45)]">
        <div className="mb-7 text-center">
          <p className="font-display text-2xl">{process.env.NEXT_PUBLIC_EVENT_NAME || 'Check-in'}</p>
          <p className="mt-1 text-sm uppercase tracking-wide text-black/50">Page de connexion pour le staff</p>
          <p className="mt-3 text-black/70">Merci pour vos efforts :) Vous etes la meilleure equipe!</p>
        </div>

        <div className="mb-6 flex gap-3">
          <button
            type="button"
            onClick={() => setTab('equipe')}
            className={
              'flex-1 rounded-xl2 border-2 py-3 text-sm font-semibold transition-colors ' +
              (tab === 'equipe'
                ? 'border-ink bg-ink text-white shadow-card'
                : 'border-black/15 bg-white text-black/50')
            }
          >
            Equipe
          </button>
          <button
            type="button"
            onClick={() => setTab('admin')}
            className={
              'flex-1 rounded-xl2 border-2 py-3 text-sm font-semibold transition-colors ' +
              (tab === 'admin'
                ? 'border-ink bg-ink text-white shadow-card'
                : 'border-black/15 bg-white text-black/50')
            }
          >
            Admin
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-black/60">Votre nom</label>
            <input
              className="w-full rounded-xl2 border-2 border-black/15 px-4 py-4 text-lg focus:border-ink focus:outline-none"
              placeholder={tab === 'admin' ? 'Ex: Gersom Dos' : 'Ex: Agent001'}
              value={nomAffichage}
              onChange={(e) => setNomAffichage(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-black/60">Code PIN</label>
            <input
              className="w-full rounded-xl2 border-2 border-black/15 px-4 py-4 text-lg tracking-[0.6em] focus:border-ink focus:outline-none"
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
    </div>
  );
}

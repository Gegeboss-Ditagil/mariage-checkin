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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#0f1a2e] via-[#0f1a2e]/70 to-transparent" />

      <div className="relative rounded-t-[2rem] bg-white/95 px-6 pb-10 pt-7 shadow-[0_-8px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">
        <div className="mb-6 text-center">
          <p className="font-display text-2xl">{process.env.NEXT_PUBLIC_EVENT_NAME || 'Check-in'}</p>
          <p className="mt-1 text-black/50">Connexion equipe d'accueil</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-black/60">Votre nom</label>
            <input
              className="w-full rounded-xl2 border border-black/10 px-4 py-3.5 text-lg"
              placeholder="Ex: Gersom Dos"
              value={nomAffichage}
              onChange={(e) => setNomAffichage(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-black/60">Code PIN</label>
            <input
              className="w-full rounded-xl2 border border-black/10 px-4 py-3.5 text-lg tracking-[0.5em]"
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

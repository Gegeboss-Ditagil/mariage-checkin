'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<'pin' | 'password'>('pin');
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

    const body =
      mode === 'pin'
        ? { mode: 'pin', nom_affichage: nomAffichage, pin }
        : { mode: 'password', email, password };

    try {
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
      router.replace(next || (data.user.role === 'placeur' ? '/placement' : '/scan'));
      router.refresh();
    } catch {
      setError('Erreur réseau — vérifiez votre connexion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-10">
      <div className="mb-10 text-center">
        <p className="font-display text-3xl">{process.env.NEXT_PUBLIC_EVENT_NAME || 'Check-in'}</p>
        <p className="mt-1 text-black/50">Connexion équipe d'accueil</p>
      </div>

      <div className="mb-6 flex rounded-xl2 bg-black/5 p-1">
        <button
          type="button"
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${mode === 'pin' ? 'bg-white shadow-card' : 'text-black/50'}`}
          onClick={() => setMode('pin')}
        >
          Agent / Placeur (PIN)
        </button>
        <button
          type="button"
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${mode === 'password' ? 'bg-white shadow-card' : 'text-black/50'}`}
          onClick={() => setMode('password')}
        >
          Admin
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'pin' ? (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-black/60">Votre nom</label>
              <input
                className="w-full rounded-xl2 border border-black/10 px-4 py-3.5 text-lg"
                placeholder="Agent 1"
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
                placeholder="••••"
                inputMode="numeric"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-black/60">Email</label>
              <input
                className="w-full rounded-xl2 border border-black/10 px-4 py-3.5 text-lg"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-black/60">Mot de passe</label>
              <input
                className="w-full rounded-xl2 border border-black/10 px-4 py-3.5 text-lg"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </>
        )}

        {error && <p className="text-sm font-medium text-status-over">{error}</p>}

        <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}

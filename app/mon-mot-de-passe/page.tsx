'use client';

import { useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { useSessionRole } from '@/hooks/useSessionRole';
import { landingPathForRole } from '@/lib/permissions';

// v1.69.0, demande de Gersom le 07/10/2026 : "j'aimerais que les gens aient
// la possibilité de modifier leur mot de passe eux-mêmes" -- ouvert a TOUS
// les roles (voir lib/permissions.ts, canAccessPath), contrairement a
// /mots-de-passe (reinitialiser le compte d'AUTRUI, reserve a
// managePasswords). Exige toujours le secret ACTUEL avant d'en accepter un
// nouveau -- jamais une reinitialisation a l'aveugle.
export default function MonMotDePassePage() {
  const role = useSessionRole();
  const isAdmin = role === 'admin';
  const [currentSecret, setCurrentSecret] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [confirmSecret, setConfirmSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const label = isAdmin ? 'mot de passe' : 'PIN';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (newSecret !== confirmSecret) {
      setError('Les deux saisies du nouveau ' + label + ' ne correspondent pas');
      return;
    }
    if (!isAdmin && !/^\d{4}$/.test(newSecret)) {
      setError('Le nouveau PIN doit contenir exactement 4 chiffres');
      return;
    }
    if (isAdmin && newSecret.length < 6) {
      setError('Le nouveau mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setSubmitting(true);
    const res = await fetch('/api/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentSecret, newSecret }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || 'Changement impossible');
      return;
    }

    setCurrentSecret('');
    setNewSecret('');
    setConfirmSecret('');
    setSuccess(true);
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg">
      <TopBar title={'Mon ' + label} backHref={role ? landingPathForRole(role) : '/dashboard'} />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="card mb-4 space-y-2">
          <h1 className="font-display text-xl">Changer mon {label}</h1>
          <p className="text-sm text-text-muted">
            {isAdmin
              ? 'Saisissez votre mot de passe actuel, puis le nouveau (au moins 6 caractères).'
              : 'Saisissez votre PIN actuel, puis le nouveau (4 chiffres).'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-text-muted">{isAdmin ? 'Mot de passe actuel' : 'PIN actuel'}</span>
            <input
              type={isAdmin ? 'password' : 'tel'}
              inputMode={isAdmin ? undefined : 'numeric'}
              maxLength={isAdmin ? undefined : 4}
              autoComplete="current-password"
              className="w-full rounded-xl2 border-2 border-hairline bg-surface px-4 py-3 text-lg focus:border-accent focus:outline-none"
              value={currentSecret}
              onChange={(e) => setCurrentSecret(e.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-text-muted">{isAdmin ? 'Nouveau mot de passe' : 'Nouveau PIN (4 chiffres)'}</span>
            <input
              type={isAdmin ? 'password' : 'tel'}
              inputMode={isAdmin ? undefined : 'numeric'}
              maxLength={isAdmin ? undefined : 4}
              autoComplete="new-password"
              className="w-full rounded-xl2 border-2 border-hairline bg-surface px-4 py-3 text-lg focus:border-accent focus:outline-none"
              value={newSecret}
              onChange={(e) => setNewSecret(e.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-text-muted">Confirmer le nouveau {label}</span>
            <input
              type={isAdmin ? 'password' : 'tel'}
              inputMode={isAdmin ? undefined : 'numeric'}
              maxLength={isAdmin ? undefined : 4}
              autoComplete="new-password"
              className="w-full rounded-xl2 border-2 border-hairline bg-surface px-4 py-3 text-lg focus:border-accent focus:outline-none"
              value={confirmSecret}
              onChange={(e) => setConfirmSecret(e.target.value)}
              required
            />
          </label>

          {error && <p className="rounded-xl2 bg-status-over/10 p-3 text-sm text-status-over">{error}</p>}
          {success && <p className="rounded-xl2 bg-status-complete/10 p-3 text-sm text-status-complete">{label === 'mot de passe' ? 'Mot de passe' : 'PIN'} changé avec succès.</p>}

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? '…' : 'Changer mon ' + label}
          </button>
        </form>
      </div>
      {role && <BottomNav role={role} />}
    </div>
  );
}

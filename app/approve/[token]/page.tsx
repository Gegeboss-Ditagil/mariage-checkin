'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Statut = 'en_attente' | 'approuve' | 'refuse';

interface ApprovalPublicData {
  cote: 'Nelly' | 'Gege';
  nom_invite: string;
  nombre_invites: number;
  statut: Statut;
  photo_signed_url: string | null;
}

/**
 * Page PUBLIQUE (voir middleware.ts) -- ouverte via le lien SMS envoyé au
 * parent, sans connexion, sans navigation. Un clic (Approuver/Refuser)
 * possible : /api/public/guest-approvals/[token]/decide invalide le token
 * après usage (statut != 'en_attente' rend un 409 "déjà traité").
 */
export default function ApproveGuestPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ApprovalPublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [decided, setDecided] = useState<'approuve' | 'refuse' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/public/guest-approvals/' + token)
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const json = await res.json();
        setData(json);
        if (json.statut !== 'en_attente') setDecided(json.statut);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);

  async function decide(decision: 'approuve' | 'refuse') {
    setDeciding(true);
    setError(null);
    try {
      const res = await fetch('/api/public/guest-approvals/' + token + '/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const json = await res.json();
      if (res.status === 409) {
        setDecided(json.statut);
        return;
      }
      if (!res.ok) {
        setError('Erreur — réessayez');
        return;
      }
      setDecided(decision);
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setDeciding(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-4 py-8">
      <p className="eyebrow">Mariage Nelly &amp; Gersom</p>

      {loading && <p className="text-text-faint">Chargement…</p>}

      {!loading && notFound && (
        <div className="card w-full max-w-sm text-center">
          <p className="text-lg font-semibold">Lien introuvable</p>
          <p className="mt-1 text-sm text-text-faint">Ce lien n'est plus valide.</p>
        </div>
      )}

      {!loading && data && (
        <div className="card w-full max-w-sm space-y-4 text-center">
          {data.photo_signed_url && (
            <img
              src={data.photo_signed_url}
              alt={data.nom_invite}
              className="mx-auto max-h-72 w-full rounded-xl2 border border-hairline object-cover"
            />
          )}
          <div>
            <p className="font-display text-xl font-semibold">{data.nom_invite}</p>
            <p className="text-sm text-text-muted">
              {data.nombre_invites} invité{data.nombre_invites > 1 ? 's' : ''} · Côté{' '}
              {data.cote === 'Gege' ? 'Gégé' : 'Nelly'}
            </p>
          </div>

          {decided ? (
            <p
              className={
                'rounded-xl2 p-3 text-sm font-semibold ' +
                (decided === 'approuve'
                  ? 'bg-status-complete/15 text-status-complete'
                  : 'bg-status-over/15 text-status-over')
              }
            >
              {decided === 'approuve' ? '✅ Demande déjà approuvée' : '❌ Demande déjà refusée'}
              <span className="mt-1 block text-xs font-normal text-text-faint">Merci, c'est déjà traité.</span>
            </p>
          ) : (
            <div className="space-y-2">
              {error && <p className="text-sm font-medium text-status-over">{error}</p>}
              <button
                type="button"
                disabled={deciding}
                onClick={() => decide('approuve')}
                className="btn-primary w-full disabled:opacity-50"
              >
                {deciding ? '…' : '✅ Approuver'}
              </button>
              <button
                type="button"
                disabled={deciding}
                onClick={() => decide('refuse')}
                className="btn-danger w-full disabled:opacity-50"
              >
                {deciding ? '…' : '❌ Refuser'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

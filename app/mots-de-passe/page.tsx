'use client';

import { useEffect, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { ROLE_LABELS, Role } from '@/lib/types';
import { useSessionRole } from '@/hooks/useSessionRole';

type PasswordUserRow = {
  id: string;
  nom_affichage: string;
  nom_complet: string | null;
  role: Role;
  active: boolean;
  canReset: boolean;
  // undefined pour un role sans canViewPasswordHint (jamais renvoye par
  // l'API dans ce cas) ; null si le compte n'a encore jamais ete
  // reinitialise depuis ce systeme.
  hint?: string | null;
};

// v1.65.0, retour de Gersom (message vocal, 03/10/2026) : "les directeurs
// de festin... peuvent faire la réinitialisation du mot de passe... sauf
// aux admins. Les admins peuvent faire la même chose et... réinitialiser
// les mots de passe des directeurs de festin. Et l'admin principal...
// peut le faire pour tout le monde... voir les mots de passe [avec]
// anonymisation... seulement les deux derniers caractères". Ecran dedie,
// separe de /admin/users (creation de compte/changement de role, reserve a
// l'admin) -- voir lib/permissions.ts (canResetPassword/canViewPasswordHint)
// pour la seule source de verite.
export default function PasswordsPage() {
  const role = useSessionRole();
  const [users, setUsers] = useState<PasswordUserRow[]>([]);
  const [canViewHints, setCanViewHints] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [result, setResult] = useState<{ nom_affichage: string; pin: string } | null>(null);

  function load() {
    setLoading(true);
    fetch('/api/passwords', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users || []);
        setCanViewHints(d.canViewHints === true);
      })
      .catch(() => setError('Chargement impossible'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function resetPassword(u: PasswordUserRow) {
    setError(null);
    setResettingId(u.id);
    const res = await fetch('/api/passwords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id }),
    });
    const data = await res.json();
    setResettingId(null);
    if (!res.ok) {
      setError(data.error || 'Réinitialisation impossible');
      return;
    }
    setResult({ nom_affichage: data.nom_affichage, pin: data.pin });
    load();
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg">
      <TopBar title="Mots de passe" backHref="/dashboard" />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="card mb-4 space-y-2">
          <h1 className="font-display text-xl">Gérer les mots de passe</h1>
          <p className="text-sm text-text-muted">
            Réinitialiser génère un nouveau code à 4 chiffres aléatoire — communiquez-le vous-même à la personne juste après.
            {canViewHints && " Vous pouvez aussi voir un indice (les deux derniers chiffres) du dernier code généré, pour le rappeler avant de réinitialiser pour de bon."}
          </p>
        </div>

        {error && <p className="mb-3 rounded-xl2 bg-status-over/10 p-3 text-sm text-status-over">{error}</p>}
        {loading ? (
          <p className="py-10 text-center text-text-muted">Chargement…</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className={'font-medium' + (u.active ? '' : ' opacity-50')}>{u.nom_affichage}</p>
                  <p className="text-sm text-text-faint">{ROLE_LABELS[u.role] || u.role}</p>
                  {canViewHints && (
                    <p className="mt-0.5 text-xs text-text-faint">
                      {u.hint ? 'Dernier indice : ' + u.hint : 'Aucun indice (jamais réinitialisé depuis cet écran)'}
                    </p>
                  )}
                </div>
                {u.canReset ? (
                  <button
                    type="button"
                    className="shrink-0 rounded-full border border-hairline bg-surface-2 px-3 py-1.5 text-xs font-semibold text-accent disabled:opacity-50"
                    disabled={resettingId === u.id}
                    onClick={() => resetPassword(u)}
                  >
                    {resettingId === u.id ? '…' : 'Réinitialiser'}
                  </button>
                ) : (
                  <span className="shrink-0 text-xs text-text-faint">Non autorisé</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {role && <BottomNav role={role} />}

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-sm space-y-3 text-center">
            <p className="font-semibold">Nouveau code pour {result.nom_affichage}</p>
            <p className="font-display text-3xl tracking-[0.3em]">{result.pin}</p>
            <p className="text-sm text-text-muted">Communiquez-le directement à la personne — il ne sera plus jamais affiché en clair.</p>
            <button type="button" className="btn-primary w-full" onClick={() => setResult(null)}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

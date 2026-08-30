'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/TopBar';
import { useSessionRole } from '@/hooks/useSessionRole';
import { useOnline } from '@/hooks/useOnline';

/**
 * Ajout d'UNE invitation individuelle le jour J (invite de derniere minute,
 * absent de la liste importee) -- distinct de l'import CSV en masse
 * (/admin/import, reserve a l'admin). Ouvert a admin/directeur/placeur, en
 * ligne avec ce qu'ils peuvent deja faire (modifier/deplacer les tables).
 */
export default function AddInvitationPage() {
  const router = useRouter();
  const role = useSessionRole();
  const online = useOnline();
  const [nom, setNom] = useState('');
  const [nombrePrevu, setNombrePrevu] = useState('1');
  const [tableNumber, setTableNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAdd = role === 'admin' || role === 'directeur' || role === 'placeur';

  async function handleSubmit() {
    if (!nom.trim()) {
      setError('Le nom est obligatoire');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/invitations/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom_affichage: nom.trim(),
          nombre_prevu: Number(nombrePrevu) || 1,
          table_number: tableNumber.trim() ? Number(tableNumber.trim()) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la création');
        setSubmitting(false);
        return;
      }
      // Direction directe vers le check-in de la nouvelle invitation : le
      // cas d'usage typique est un invite qui se presente EN MEME TEMPS
      // qu'on l'ajoute.
      router.push('/checkin/' + data.invitation.id);
    } catch {
      setError('Erreur réseau — réessayez');
      setSubmitting(false);
    }
  }

  if (role && !canAdd) {
    return (
      <div className="flex min-h-dvh flex-col">
        <TopBar title="Ajouter un invité" backHref="/tables" />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-lg font-semibold">Accès réservé</p>
          <p className="text-sm text-text-faint">
            Seuls l'admin, les directeurs de festin et les agents placeurs peuvent ajouter un invité.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Ajouter un invité" backHref="/tables" />

      <div className="flex-1 space-y-4 px-4 py-4">
        <p className="text-sm text-text-faint">
          Pour un invité de dernière minute, absent de la liste importée. Il sera aussitôt disponible dans la
          recherche et sur sa table.
        </p>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-faint">Nom</label>
          <input
            autoFocus
            className="w-full rounded-xl2 border-2 border-hairline bg-surface px-4 py-3 text-lg focus:border-accent focus:outline-none"
            placeholder="Prénom Nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-faint">
            Nombre de personnes
          </label>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            className="w-full rounded-xl2 border-2 border-hairline bg-surface px-4 py-3 text-lg focus:border-accent focus:outline-none"
            value={nombrePrevu}
            onChange={(e) => setNombrePrevu(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-faint">
            Table (optionnel)
          </label>
          <input
            inputMode="numeric"
            className="w-full rounded-xl2 border-2 border-hairline bg-surface px-4 py-3 text-lg focus:border-accent focus:outline-none"
            placeholder="Numéro de table"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
          />
          <p className="mt-1 text-xs text-text-faint">
            Laissez vide si la table n'est pas encore décidée — l'invité pourra être placé ensuite depuis sa fiche.
          </p>
        </div>

        {error && <p className="text-sm font-medium text-status-over">{error}</p>}
      </div>

      <div className="px-4 pb-6">
        <button
          className="btn-primary w-full"
          disabled={submitting || !online || !nom.trim()}
          onClick={handleSubmit}
        >
          {submitting ? '…' : !online ? 'HORS LIGNE' : 'AJOUTER ET CHECK-IN'}
        </button>
      </div>
    </div>
  );
}

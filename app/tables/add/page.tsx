'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/TopBar';
import { TablePicker } from '@/components/TablePicker';
import { useSessionRole } from '@/hooks/useSessionRole';
import { useOnline } from '@/hooks/useOnline';
import { hasCapability } from '@/lib/permissions';
import { ETIQUETTES_RAPIDES } from '@/lib/tags';
import { createClient } from '@/lib/supabase/client';
import { computeTableCapacities, TableCapacity } from '@/lib/capacity';
import { InvitationRow, OverflowAssignmentRow, TableRow } from '@/lib/types';

/**
 * Ajout d'UNE invitation individuelle le jour J (invite de derniere minute,
 * absent de la liste importee) -- distinct de l'import CSV en masse
 * (/admin/import, reserve a l'admin). Capacite dediee `addInvitation`
 * (admin/directeur, voir lib/permissions.ts) : ouverte au directeur le
 * 02/09/2026, demande explicite de Gersom apres le test de Remy -- jusque
 * la, le formulaire etait visible mais la creation echouait toujours
 * silencieusement en 401 pour ce role (bug jamais remarque, cette page
 * n'ayant aucun lien entrant dans l'appli avant ce correctif -- voir le
 * bouton "+" ajoute sur /plan-table).
 */
export default function AddInvitationPage() {
  const router = useRouter();
  const role = useSessionRole();
  const online = useOnline();
  const [nom, setNom] = useState('');
  const [nombrePrevu, setNombrePrevu] = useState('1');
  const [telephone, setTelephone] = useState('');
  const [tableId, setTableId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [usages, setUsages] = useState<TableCapacity[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAdd = hasCapability(role, 'addInvitation');
  const canTag = hasCapability(role, 'manageTags');

  useEffect(() => {
    if (!canAdd) return;
    let active = true;
    (async () => {
      const supabase = createClient();
      const [{ data: tbls }, { data: invs }, { data: ov }] = await Promise.all([
        supabase.from('tables').select('*').order('number'),
        supabase.from('invitations').select('*'),
        supabase.from('overflow_assignments').select('*'),
      ]);
      if (!active) return;
      setUsages(
        computeTableCapacities(
          (tbls as TableRow[]) || [],
          (invs as InvitationRow[]) || [],
          (ov as OverflowAssignmentRow[]) || []
        )
      );
    })();
    return () => { active = false; };
  }, [canAdd]);

  function toggleTag(tag: string) {
    setTags((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));
  }

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
          table_id: tableId || undefined,
          telephone: telephone.trim() || undefined,
          tags,
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
        <TopBar title="Ajouter un invité" backHref="/plan-table" />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-lg font-semibold">Accès réservé</p>
          <p className="text-sm text-text-faint">Seuls l'admin et les directeurs de festin peuvent ajouter un invité.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Ajouter un invité" backHref="/plan-table" />

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
            Téléphone (optionnel)
          </label>
          <input
            type="tel"
            inputMode="tel"
            className="w-full rounded-xl2 border-2 border-hairline bg-surface px-4 py-3 text-lg focus:border-accent focus:outline-none"
            placeholder="+33 6 12 34 56 78"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
          />
          <p className="mt-1 text-xs text-text-faint">Indicatif du pays inclus (+33, +1, +243…).</p>
        </div>

        {canTag && (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-faint">
              Étiquettes (optionnel)
            </label>
            <div className="flex flex-wrap gap-2">
              {ETIQUETTES_RAPIDES.map((e) => (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => toggleTag(e.value)}
                  className={
                    'rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-colors ' +
                    (tags.includes(e.value)
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-hairline bg-surface text-text-muted')
                  }
                >
                  {e.label}
                </button>
              ))}
            </div>
            {tags.includes('SERVICES') && (
              <p className="mt-1 text-xs text-text-faint">Staff : visible de tout le monde sur l'écran Staff.</p>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-faint">
            Table (optionnel)
          </label>
          {usages.length > 0 ? (
            <TablePicker
              usages={usages}
              selectedTableId={tableId}
              onSelect={(id) => setTableId(id === tableId ? null : id)}
              minimumEstimatedFree={0}
            />
          ) : (
            <p className="text-sm text-text-faint">Chargement des tables…</p>
          )}
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

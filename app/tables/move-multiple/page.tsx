'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, OverflowAssignmentRow, TableRow } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { TablePicker } from '@/components/TablePicker';
import { useOnline } from '@/hooks/useOnline';
import { computeTableCapacities, TableCapacity } from '@/lib/capacity';
import { clearBulkMoveSelection, readBulkMoveSelection } from '@/lib/bulkMoveSession';

/**
 * Etape "choisir la table de destination" pour un deplacement en lot
 * (mode 'transfer') ou pour la premiere moitie d'un echange (mode
 * 'exchange-pick-b' : ici on choisit juste la table B, la selection de qui
 * en sort se fait ensuite sur /tables/[tableId] avec ?echangeAvec=...).
 * La selection elle-meme (invitationIds + table de depart) est deja en
 * sessionStorage, ecrite par /tables/[tableId] (voir lib/bulkMoveSession.ts).
 */
export default function DeplacerEnLotPage() {
  const router = useRouter();
  const online = useOnline();

  const [selection] = useState(() => readBulkMoveSelection());
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [usages, setUsages] = useState<TableCapacity[]>([]);
  const [chosenTableId, setChosenTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selection) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    let active = true;

    async function load() {
      const [{ data: invs }, { data: tables }, { data: assignments }] = await Promise.all([
        // UNE seule requete pour toutes les invitations : la selection en est
        // un sous-ensemble et `usages` a besoin du dataset complet pour
        // computeTableCapacities. Avant, deux fetches sequentiels (selected
        // puis all) partaient a chaque chargement.
        supabase.from('invitations').select('*'),
        supabase.from('tables').select('*').order('is_reserve', { ascending: true }).order('number'),
        supabase.from('overflow_assignments').select('*'),
      ]);
      if (!active) return;
      const allInvs = (invs as InvitationRow[]) || [];
      const selectedIds = new Set(selection!.invitationIds);
      setInvitations(allInvs.filter((i) => selectedIds.has(i.id)));
      const tbls = (tables as TableRow[]) || [];
      // Toutes les invitations selectionnees viennent de la meme table
      // (fromTableId) : toutes les autres, non exclues, sont des
      // destinations valides.
      setUsages(
        computeTableCapacities(tbls, allInvs, (assignments as OverflowAssignmentRow[]) || [])
      );
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [selection]);

  const totalPersonnes = invitations.reduce((s, i) => s + i.nombre_prevu, 0);

  async function handleConfirm() {
    if (!selection || !chosenTableId) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('CONNEXION REQUISE');
      return;
    }

    if (selection.mode === 'exchange-pick-b') {
      // La table B est choisie : direction /tables/[tableId] pour selectionner
      // qui en sort, en gardant la selection A en sessionStorage (elle sera
      // relue la-bas via echangeAvec).
      router.push('/tables/' + chosenTableId + '?echangeAvec=' + selection.fromTableId);
      return;
    }

    const cible = usages.find((u) => u.table.id === chosenTableId);
    const confirmMsg =
      'Transférer ' +
      selection.invitationIds.length +
      ' invitation' + (selection.invitationIds.length > 1 ? 's' : '') +
      ' (' + totalPersonnes + ' personne' + (totalPersonnes > 1 ? 's' : '') + ') vers la table ' +
      (cible ? cible.table.number : '?') +
      ' ?';
    if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/move-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_ids: selection.invitationIds, new_table_id: chosenTableId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Échec du transfert');
        return;
      }
      clearBulkMoveSelection();
      router.push('/tables/' + chosenTableId + '?deplace=1');
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setSubmitting(false);
    }
  }

  if (!selection) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-text-muted">Aucune sélection en cours</p>
        <p className="text-sm text-text-faint">
          Sélectionnez d'abord des invités depuis l'écran d'une table, puis « Transférer » ou « Échanger ».
        </p>
        <button className="btn-primary" onClick={() => router.push('/tables')}>
          Retour aux tables
        </button>
      </div>
    );
  }

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-text-faint">Chargement…</div>;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        title={selection.mode === 'exchange-pick-b' ? 'Échanger avec quelle table ?' : 'Transférer vers quelle table ?'}
        backHref={'/tables/' + selection.fromTableId}
      />

      <div className="flex-1 space-y-4 px-4 py-4">
        <div className="card">
          <p className="text-sm font-bold uppercase tracking-wide text-accent">
            {selection.invitationIds.length} invitation{selection.invitationIds.length > 1 ? 's' : ''} sélectionnée
            {selection.invitationIds.length > 1 ? 's' : ''}
          </p>
          <p className="mt-1 text-text-muted">
            {totalPersonnes} personne{totalPersonnes > 1 ? 's' : ''} :{' '}
            {invitations.map((i) => i.nom_affichage).join(', ') || '…'}
          </p>
        </div>

        <TablePicker
          usages={usages}
          excludeTableId={selection.fromTableId}
          selectedTableId={chosenTableId}
          onSelect={setChosenTableId}
        />

        {error && <p className="text-sm font-medium text-status-over">{error}</p>}
      </div>

      <div className="px-4 pb-6">
        <button
          className="btn-primary w-full"
          disabled={!chosenTableId || submitting || !online}
          onClick={handleConfirm}
        >
          {submitting
            ? '…'
            : !online
            ? 'HORS LIGNE'
            : selection.mode === 'exchange-pick-b'
            ? 'CHOISIR CETTE TABLE POUR L’ÉCHANGE'
            : 'TRANSFÉRER VERS CETTE TABLE'}
        </button>
      </div>
    </div>
  );
}

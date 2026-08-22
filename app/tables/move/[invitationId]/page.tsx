'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, OverflowAssignmentRow, TableRow } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { TablePicker } from '@/components/TablePicker';
import { useOnline } from '@/hooks/useOnline';
import { computeTableCapacities, TableCapacity } from '@/lib/capacity';

export default function DeplacerInvitationPage() {
  const { invitationId } = useParams<{ invitationId: string }>();
  const router = useRouter();
  const online = useOnline();

  const [invitation, setInvitation] = useState<InvitationRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [currentTable, setCurrentTable] = useState<TableRow | null>(null);
  const [usages, setUsages] = useState<TableCapacity[]>([]);
  const [chosenTableId, setChosenTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const { data: inv } = await supabase
        .from('invitations')
        .select('*')
        .eq('id', invitationId)
        .maybeSingle();

      if (!active) return;

      if (!inv) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setInvitation(inv as InvitationRow);

      const [{ data: tables }, { data: allInvs }, { data: assignments }] = await Promise.all([
        supabase.from('tables').select('*').order('is_reserve', { ascending: true }).order('number'),
        supabase.from('invitations').select('*'),
        supabase.from('overflow_assignments').select('*'),
      ]);

      if (!active) return;

      const tbls = (tables as TableRow[]) || [];
      setCurrentTable(tbls.find((t) => t.id === (inv as InvitationRow).table_id) || null);
      setUsages(
        computeTableCapacities(
          tbls,
          (allInvs as InvitationRow[]) || [],
          (assignments as OverflowAssignmentRow[]) || []
        )
      );
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel('move-' + invitationId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'overflow_assignments' }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [invitationId]);

  async function handleMove() {
    if (!invitation || !chosenTableId) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('CONNEXION REQUISE');
      return;
    }
    const cible = usages.find((u) => u.table.id === chosenTableId);
    const confirmMsg =
      'Déplacer ' +
      invitation.nom_affichage +
      ' (' +
      invitation.nombre_prevu +
      ' personne' +
      (invitation.nombre_prevu > 1 ? 's' : '') +
      ') vers la table ' +
      (cible ? cible.table.number : '?') +
      ' ?';
    if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: freshTable } = await supabase
        .from('tables')
        .select('*')
        .eq('id', chosenTableId)
        .maybeSingle();
      if (!freshTable) {
        setError("Cette table n'existe plus — choisissez-en une autre");
        setSubmitting(false);
        return;
      }
      const res = await fetch('/api/move-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: invitation.id, new_table_id: chosenTableId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'invitation_not_found') {
          // Quelqu'un d'autre a deja deplace/traite cette invitation entre
          // temps (plusieurs agents actifs en meme temps) : on redirige au
          // lieu de laisser la personne bloquee sur un ecran perime.
          setError('Deja deplacee par quelqu\'un d\'autre entre-temps — retour aux tables…');
          setTimeout(() => router.push('/tables'), 1200);
          return;
        }
        setError(
          data.error === 'table_not_found'
            ? 'Cette table n\'existe plus — choisissez-en une autre'
            : data.error === 'same_table'
            ? 'Deja assignee a cette table'
            : data.error || 'Échec du déplacement'
        );
        return;
      }
      router.push('/tables/' + chosenTableId + '?deplace=1');
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-black/70">Invitation introuvable</p>
        <button className="btn-primary" onClick={() => router.push('/tables')}>
          Retour aux tables
        </button>
      </div>
    );
  }

  if (loading || !invitation) {
    return <div className="flex min-h-dvh items-center justify-center/50">Chargement…</div>;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        title="Déplacer vers une table"
        backHref={currentTable ? '/tables/' + currentTable.id : '/tables'}
      />

      <div className="flex-1 space-y-4 px-4 py-4">
        <div className="card">
          <p className="text-sm font-bold uppercase tracking-wide text-gold-600">{invitation.nom_affichage}</p>
          <p className="mt-1 text-black/60">
            {invitation.nombre_prevu} personne{invitation.nombre_prevu > 1 ? 's' : ''} · actuellement à{' '}
            {currentTable ? 'Table ' + currentTable.number : 'aucune table'}
          </p>
        </div>

        <TablePicker
          usages={usages}
          excludeTableId={invitation.table_id}
          selectedTableId={chosenTableId}
          onSelect={setChosenTableId}
        />

        {error && <p className="text-sm font-medium text-status-over">{error}</p>}
      </div>

      <div className="px-4 pb-6">
        <button
          className="btn-primary w-full"
          disabled={!chosenTableId || submitting || !online}
          onClick={handleMove}
        >
          {submitting ? '…' : !online ? 'HORS LIGNE' : 'DÉPLACER VERS CETTE TABLE'}
        </button>
      </div>
    </div>
  );
}

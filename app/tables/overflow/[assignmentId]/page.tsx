'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, OverflowAssignmentRow, TableRow } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { useOnline } from '@/hooks/useOnline';
import { computeTableCapacities, TableCapacity } from '@/lib/capacity';

export default function GererExcedentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const router = useRouter();
  const online = useOnline();

  const [assignment, setAssignment] = useState<OverflowAssignmentRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [nomAffichage, setNomAffichage] = useState('');
  const [currentTable, setCurrentTable] = useState<TableRow | null>(null);
  const [reserveUsages, setReserveUsages] = useState<TableCapacity[]>([]);
  const [chosenTableId, setChosenTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmFullTable, setConfirmFullTable] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const { data: a } = await supabase
        .from('overflow_assignments')
        .select('*')
        .eq('id', assignmentId)
        .maybeSingle();

      if (!active) return;

      if (!a) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const assign = a as OverflowAssignmentRow;
      setAssignment(assign);

      const [{ data: inv }, { data: allTables }, { data: allAssignments }, { data: allInvs }] = await Promise.all([
        supabase.from('invitations').select('nom_affichage').eq('id', assign.invitation_id).maybeSingle(),
        supabase.from('tables').select('*').order('is_reserve', { ascending: false }).order('number'),
        supabase.from('overflow_assignments').select('*'),
        supabase.from('invitations').select('*'),
      ]);

      if (!active) return;

      setNomAffichage(inv?.nom_affichage || 'Invité');

      const tables = (allTables as TableRow[]) || [];
      const usages = computeTableCapacities(
        tables,
        (allInvs as InvitationRow[]) || [],
        (allAssignments as OverflowAssignmentRow[]) || []
      );

      setCurrentTable(tables.find((t) => t.id === assign.reserve_table_id) || null);
      setReserveUsages(usages);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [assignmentId]);

  async function handleMove() {
    if (!assignment || !chosenTableId) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('CONNEXION REQUISE');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/overflow/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignment.id, new_reserve_table_id: chosenTableId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'assignment_not_found') {
          // Un autre agent a deja retire/deplace cette affectation entre
          // temps (plusieurs agents actifs en meme temps sur le meme groupe
          // d'excedent) : on redirige au lieu de laisser la personne bloquee.
          setError('Deja traite par quelqu\'un d\'autre entre-temps — retour aux tables…');
          setTimeout(() => router.push('/tables'), 1200);
          return;
        }
        setError(
          data.error === 'reserve_table_full'
            ? 'Cette table est complète — choisissez-en une autre'
            : data.error === 'reserve_table_not_found'
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

  async function handleUnassign() {
    if (!assignment) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('CONNEXION REQUISE');
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm('Retirer ces ' + assignment.nombre_personnes + ' personne(s) de cette table de réserve ?')) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/overflow/unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignment.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'assignment_not_found') {
          setError('Deja retire par quelqu\'un d\'autre entre-temps — retour aux tables…');
          setTimeout(() => router.push('/tables'), 1200);
          return;
        }
        setError(data.error || 'Échec du retrait');
        return;
      }
      router.push('/tables/' + assignment.reserve_table_id);
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-text-muted">Affectation introuvable</p>
        <p className="text-sm text-text-faint">Elle a peut-être déjà été retirée ou déplacée.</p>
        <button className="btn-primary" onClick={() => router.push('/tables')}>
          Retour aux tables
        </button>
      </div>
    );
  }

  if (loading || !assignment) {
    return <div className="flex min-h-dvh items-center justify-center/50">Chargement…</div>;
  }

  const autresTables = reserveUsages.filter((u) => u.table.id !== assignment.reserve_table_id);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Gérer l'excédent" backHref={'/tables/' + assignment.reserve_table_id} />

      <div className="flex-1 space-y-4 px-4 py-4">
        <div className="card border-2 border-status-over/30 bg-status-over/5">
          <p className="text-sm font-bold uppercase tracking-wide text-status-over">
            {nomAffichage} · +{assignment.nombre_personnes} personne{assignment.nombre_personnes > 1 ? 's' : ''}
          </p>
          <p className="mt-1 text-text-muted">
            Actuellement à {currentTable ? 'Table ' + currentTable.number : 'une table de réserve'}
          </p>
        </div>

        <div>
          <p className="mb-2 font-semibold ">Déplacer vers une autre table</p>
          <div className="space-y-2">
            {autresTables.length === 0 && (
              <p className="text-sm text-text-faint">Aucune autre table disponible.</p>
            )}
            {autresTables.map((u) => {
              // "Complet" est un avertissement, pas un blocage : voir le
              // commentaire equivalent dans checkin/[invitationId]/page.tsx.
              const full = u.libresEstimees < assignment.nombre_personnes;
              const selected = chosenTableId === u.table.id;
              return (
                <button
                  key={u.table.id}
                  onClick={() => {
                    setChosenTableId(u.table.id);
                    setConfirmFullTable(false);
                  }}
                  className={
                    'flex w-full items-center justify-between rounded-xl2 border-2 px-4 py-3 text-left ' +
                    (selected
                      ? 'border-accent bg-accent-tint '
                      : full
                      ? 'border-status-over/30 bg-status-over/5 '
                      : 'border-hairline bg-surface ')
                  }
                >
                  <span className="font-semibold">
                    Table {u.table.number}
                    {u.table.is_reserve ? ' (réserve)' : ''}
                  </span>
                  <span className={'text-sm ' + (full ? 'text-status-over' : '')}>
                    {full ? 'COMPLET (prévu)' : u.occupationEstimee + ' / ' + u.table.capacity + ' places'}
                    {' · '}
                    {u.libresMaintenant} libre{u.libresMaintenant > 1 ? 's' : ''} maintenant
                  </span>
                </button>
              );
            })}
          </div>
          {chosenTableId &&
            autresTables.find((u) => u.table.id === chosenTableId) &&
            autresTables.find((u) => u.table.id === chosenTableId)!.libresEstimees < assignment.nombre_personnes && (
              <label className="mt-2 flex items-start gap-2 rounded-xl2 border-2 border-status-over/30 bg-status-over/5 p-3 text-sm text-status-over">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0"
                  checked={confirmFullTable}
                  onChange={(e) => setConfirmFullTable(e.target.checked)}
                />
                <span>⚠️ Cette table affiche complet — je confirme que des places seront réellement libres.</span>
              </label>
            )}
        </div>

        {error && <p className="text-sm font-medium text-status-over">{error}</p>}
      </div>

      <div className="space-y-3 px-4 pb-6">
        <button
          className="btn-primary w-full"
          disabled={
            !chosenTableId ||
            submitting ||
            !online ||
            (!!chosenTableId &&
              !!autresTables.find((u) => u.table.id === chosenTableId) &&
              autresTables.find((u) => u.table.id === chosenTableId)!.libresEstimees < assignment.nombre_personnes &&
              !confirmFullTable)
          }
          onClick={handleMove}
        >
          {submitting ? '…' : !online ? 'HORS LIGNE' : 'DÉPLACER VERS CETTE TABLE'}
        </button>
        <button className="btn-danger w-full" disabled={submitting || !online} onClick={handleUnassign}>
          RETIRER DE CETTE TABLE
        </button>
      </div>
    </div>
  );
}


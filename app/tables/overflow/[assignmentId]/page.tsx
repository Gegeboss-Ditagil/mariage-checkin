'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { OverflowAssignmentRow, TableRow } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { useOnline } from '@/hooks/useOnline';

interface ReserveUsage {
  table: TableRow;
  used: number;
  available: number;
}

export default function GererExcedentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const router = useRouter();
  const online = useOnline();

  const [assignment, setAssignment] = useState<OverflowAssignmentRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [nomAffichage, setNomAffichage] = useState('');
  const [currentTable, setCurrentTable] = useState<TableRow | null>(null);
  const [reserveUsages, setReserveUsages] = useState<ReserveUsage[]>([]);
  const [chosenTableId, setChosenTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      const [{ data: inv }, { data: reserveTables }, { data: allAssignments }] = await Promise.all([
        supabase.from('invitations').select('nom_affichage').eq('id', assign.invitation_id).maybeSingle(),
        supabase.from('tables').select('*').eq('is_reserve', true).order('number'),
        supabase.from('overflow_assignments').select('reserve_table_id, nombre_personnes'),
      ]);

      if (!active) return;

      setNomAffichage(inv?.nom_affichage || 'Invité');

      const usedByTable = new Map<string, number>();
      (allAssignments || []).forEach((o: any) => {
        usedByTable.set(o.reserve_table_id, (usedByTable.get(o.reserve_table_id) || 0) + o.nombre_personnes);
      });

      const tables = (reserveTables as TableRow[]) || [];
      const usages: ReserveUsage[] = tables.map((t) => {
        const used = usedByTable.get(t.id) || 0;
        return { table: t, used, available: t.capacity - used };
      });

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
      router.push('/tables/' + chosenTableId);
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
        <p className="text-lg font-semibold text-cream/80">Affectation introuvable</p>
        <p className="text-sm text-cream/50">Elle a peut-être déjà été retirée ou déplacée.</p>
        <button className="btn-primary" onClick={() => router.push('/tables')}>
          Retour aux tables
        </button>
      </div>
    );
  }

  if (loading || !assignment) {
    return <div className="flex min-h-dvh items-center justify-center text-cream/50">Chargement…</div>;
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
          <p className="mt-1 text-cream/60">
            Actuellement à {currentTable ? 'Table ' + currentTable.number : 'une table de réserve'}
          </p>
        </div>

        <div>
          <p className="mb-2 font-semibold text-cream">Déplacer vers une autre table de réserve</p>
          <div className="space-y-2">
            {autresTables.length === 0 && (
              <p className="text-sm text-cream/40">Aucune autre table de réserve disponible.</p>
            )}
            {autresTables.map((u) => {
              const full = u.available < assignment.nombre_personnes;
              const selected = chosenTableId === u.table.id;
              return (
                <button
                  key={u.table.id}
                  disabled={full}
                  onClick={() => setChosenTableId(u.table.id)}
                  className={
                    'flex w-full items-center justify-between rounded-xl2 border-2 px-4 py-3 text-left ' +
                    (full
                      ? 'border-cream/5 bg-cream/5 text-cream/30'
                      : selected
                      ? 'border-gold-400 bg-gold-400/10 text-cream'
                      : 'border-gold-400/20 bg-night-800 text-cream')
                  }
                >
                  <span className="font-semibold">Table {u.table.number}</span>
                  <span className="text-sm">
                    {full ? 'COMPLET' : u.used + ' / ' + u.table.capacity + ' places utilisées'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-sm font-medium text-status-over">{error}</p>}
      </div>

      <div className="space-y-3 px-4 pb-6">
        <button
          className="btn-primary w-full"
          disabled={!chosenTableId || submitting || !online}
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

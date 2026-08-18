'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, TableRow } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { useOnline } from '@/hooks/useOnline';

interface TableUsage {
  table: TableRow;
  prevu: number;
}

function volCode(number: number): string | null {
  if (number < 1 || number > 40) return null;
  const padded = String(number).padStart(3, '0');
  return number <= 7 ? 'Vol-F' + padded : 'Vol-T' + padded;
}

export default function DeplacerInvitationPage() {
  const { invitationId } = useParams<{ invitationId: string }>();
  const router = useRouter();
  const online = useOnline();

  const [invitation, setInvitation] = useState<InvitationRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [currentTable, setCurrentTable] = useState<TableRow | null>(null);
  const [usages, setUsages] = useState<TableUsage[]>([]);
  const [query, setQuery] = useState('');
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

      const [{ data: tables }, { data: allInvs }] = await Promise.all([
        supabase.from('tables').select('*').eq('is_reserve', false).order('number'),
        supabase.from('invitations').select('table_id, nombre_prevu'),
      ]);

      if (!active) return;

      const prevuByTable = new Map<string, number>();
      (allInvs || []).forEach((i: any) => {
        if (!i.table_id) return;
        prevuByTable.set(i.table_id, (prevuByTable.get(i.table_id) || 0) + i.nombre_prevu);
      });

      const tbls = (tables as TableRow[]) || [];
      setCurrentTable(tbls.find((t) => t.id === (inv as InvitationRow).table_id) || null);
      setUsages(tbls.map((t) => ({ table: t, prevu: prevuByTable.get(t.id) || 0 })));
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [invitationId]);

  const filtered = useMemo(() => {
    const list = usages.filter((u) => u.table.id !== invitation?.table_id);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) => {
      const vol = volCode(u.table.number) || '';
      return (
        String(u.table.number).includes(q) ||
        (u.table.label || '').toLowerCase().includes(q) ||
        vol.toLowerCase().includes(q)
      );
    });
  }, [usages, query, invitation]);

  async function handleMove() {
    if (!invitation || !chosenTableId) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('CONNEXION REQUISE');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/tables/move-invitation', {
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
      router.push('/tables/' + chosenTableId);
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-cream/80">Invitation introuvable</p>
        <button className="btn-primary" onClick={() => router.push('/tables')}>
          Retour aux tables
        </button>
      </div>
    );
  }

  if (loading || !invitation) {
    return <div className="flex min-h-dvh items-center justify-center text-cream/50">Chargement…</div>;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        title="Déplacer vers une table"
        backHref={currentTable ? '/tables/' + currentTable.id : '/tables'}
      />

      <div className="flex-1 space-y-4 px-4 py-4">
        <div className="card">
          <p className="text-sm font-bold uppercase tracking-wide text-gold-300">{invitation.nom_affichage}</p>
          <p className="mt-1 text-cream/60">
            {invitation.nombre_prevu} personne{invitation.nombre_prevu > 1 ? 's' : ''} · actuellement à{' '}
            {currentTable ? 'Table ' + currentTable.number : 'aucune table'}
          </p>
        </div>

        <input
          className="w-full rounded-xl2 border-2 border-gold-400/25 bg-night-800 px-4 py-3 text-cream placeholder:text-cream/30 focus:border-gold-400 focus:outline-none"
          placeholder="Rechercher une table (numéro, ville, vol…)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="space-y-2">
          {filtered.length === 0 && <p className="text-sm text-cream/40">Aucune table trouvée.</p>}
          {filtered.map((u) => {
            const selected = chosenTableId === u.table.id;
            const proche = u.prevu >= u.table.capacity;
            const vol = volCode(u.table.number);
            return (
              <button
                key={u.table.id}
                onClick={() => setChosenTableId(u.table.id)}
                className={
                  'flex w-full items-center justify-between rounded-xl2 border-2 px-4 py-3 text-left ' +
                  (selected ? 'border-gold-400 bg-gold-400/10 text-cream' : 'border-gold-400/20 bg-night-800 text-cream')
                }
              >
                <span className="min-w-0">
                  <span className="block font-semibold">
                    Table {u.table.number}
                    {u.table.label ? ' — ' + u.table.label : ''}
                  </span>
                  {vol && <span className="block text-xs text-cream/40">{vol}</span>}
                </span>
                <span className={'shrink-0 text-sm ' + (proche ? 'text-status-over' : 'text-cream/50')}>
                  {u.prevu} / {u.table.capacity} places prévues
                </span>
              </button>
            );
          })}
        </div>

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

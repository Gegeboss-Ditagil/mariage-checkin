'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, TableRow, OverflowAssignmentRow } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { StatusBadge } from '@/components/StatusBadge';

export default function TableDetailPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const [table, setTable] = useState<TableRow | null>(null);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [overflow, setOverflow] = useState<OverflowAssignmentRow[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const [{ data: t }, { data: invs }, { data: ov }] = await Promise.all([
        supabase.from('tables').select('*').eq('id', tableId).maybeSingle(),
        supabase.from('invitations').select('*').eq('table_id', tableId).order('nom_affichage'),
        supabase.from('overflow_assignments').select('*').eq('reserve_table_id', tableId),
      ]);
      if (!active) return;
      setTable(t as TableRow | null);
      setInvitations((invs as InvitationRow[]) || []);
      setOverflow((ov as OverflowAssignmentRow[]) || []);
    }

    load();
    const channel = supabase
      .channel(`table-detail-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations', filter: `table_id=eq.${tableId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'overflow_assignments', filter: `reserve_table_id=eq.${tableId}` }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [tableId]);

  const prevu = invitations.reduce((s, i) => s + i.nombre_prevu, 0);
  const arrive = invitations.reduce((s, i) => s + i.nombre_arrive, 0);
  const overflowTotal = overflow.reduce((s, o) => s + o.nombre_personnes, 0);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title={table ? `Table ${table.number}` : 'Table'} backHref="/tables" />

      <div className="px-4 py-4">
        <div className="card mb-4 grid grid-cols-3 text-center">
          <div>
            <p className="text-xs uppercase text-black/40">Prévu</p>
            <p className="text-2xl font-bold">{prevu}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-black/40">Arrivés</p>
            <p className="text-2xl font-bold text-status-complete">{arrive}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-black/40">Restants</p>
            <p className="text-2xl font-bold text-status-partial">{Math.max(0, prevu - arrive)}</p>
          </div>
        </div>

        {table?.is_reserve && (
          <p className="mb-4 text-sm text-black/50">
            {overflowTotal} / {table.capacity} places de réserve utilisées
          </p>
        )}

        <ul className="divide-y divide-black/5">
          {invitations.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between py-3">
              <span className="font-medium">{inv.nom_affichage}</span>
              <span className="flex items-center gap-2 text-sm">
                {inv.nombre_arrive}/{inv.nombre_prevu}
                <StatusBadge statut={inv.statut} />
              </span>
            </li>
          ))}
          {table?.is_reserve &&
            overflow.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-3 text-black/60">
                <span>Excédent affecté</span>
                <span>+{o.nombre_personnes}</span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, TableRow, OverflowAssignmentRow } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { useSessionRole } from '@/hooks/useSessionRole';

export default function DashboardPage() {
  const role = useSessionRole();
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [overflow, setOverflow] = useState<OverflowAssignmentRow[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const [{ data: invs }, { data: tbls }, { data: ov }] = await Promise.all([
        supabase.from('invitations').select('*'),
        supabase.from('tables').select('*').order('number'),
        supabase.from('overflow_assignments').select('*'),
      ]);
      if (!active) return;
      setInvitations((invs as InvitationRow[]) || []);
      setTables((tbls as TableRow[]) || []);
      setOverflow((ov as OverflowAssignmentRow[]) || []);
    }

    load();

    const channel = supabase
      .channel('dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'overflow_assignments' }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const stats = useMemo(() => {
    const attendus = invitations.reduce((s, i) => s + i.nombre_prevu, 0);
    const arrives = invitations.reduce((s, i) => s + i.nombre_arrive, 0);
    const restants = Math.max(0, attendus - arrives);
    const taux = attendus > 0 ? (arrives / attendus) * 100 : 0;

    return {
      attendus,
      arrives,
      restants,
      taux,
      tablesCompletes: invitations.filter((i) => i.statut === 'complet').length,
      tablesPartielles: invitations.filter((i) => i.statut === 'partiel').length,
      nonArrives: invitations.filter((i) => i.statut === 'non_arrive').length,
      supplementaires: invitations.reduce((s, i) => s + Math.max(0, i.nombre_arrive - i.nombre_prevu), 0),
    };
  }, [invitations]);

  const reserveTables = tables.filter((t) => t.is_reserve);
  const usageByTable = new Map<string, number>();
  overflow.forEach((o) => usageByTable.set(o.reserve_table_id, (usageByTable.get(o.reserve_table_id) || 0) + o.nombre_personnes));

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Tableau de bord" />

      <div className="flex-1 space-y-6 px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Invités attendus" value={stats.attendus} />
          <StatTile label="Arrivés" value={stats.arrives} accent="text-status-complete" />
          <StatTile label="Restants" value={stats.restants} accent="text-status-partial" />
          <StatTile label="Taux d'arrivée" value={`${stats.taux.toFixed(1)}%`} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <MiniStat label="Complètes" value={stats.tablesCompletes} color="bg-status-complete" />
          <MiniStat label="Partielles" value={stats.tablesPartielles} color="bg-status-partial" />
          <MiniStat label="Non arrivées" value={stats.nonArrives} color="bg-status-none" />
          <MiniStat label="Supplémentaires" value={stats.supplementaires} color="bg-status-over" />
        </div>

        <div>
          <p className="mb-2 font-semibold">Tables de réserve</p>
          <div className="space-y-2">
            {reserveTables.map((t) => {
              const used = usageByTable.get(t.id) || 0;
              const full = used >= t.capacity;
              return (
                <div key={t.id} className="card flex items-center justify-between py-3">
                  <span className="font-semibold">Table {t.number}</span>
                  <span className={full ? 'font-bold text-status-over' : 'text-black/60'}>
                    {full ? 'COMPLET' : `${used} / ${t.capacity} places utilisées`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {role && <BottomNav role={role} />}
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="card text-center">
      <p className="text-xs uppercase tracking-wide text-black/40">{label}</p>
      <p className={`mt-1 text-4xl font-bold tabular-nums ${accent || ''}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl2 bg-white p-3 shadow-card">
      <span className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        {label}
      </span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

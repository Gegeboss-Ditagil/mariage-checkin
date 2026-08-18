'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, TableRow } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { useSessionRole } from '@/hooks/useSessionRole';

export default function TablesPage() {
  const role = useSessionRole();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const [{ data: t }, { data: i }] = await Promise.all([
        supabase.from('tables').select('*').order('number'),
        supabase.from('invitations').select('*'),
      ]);
      if (!active) return;
      setTables((t as TableRow[]) || []);
      setInvitations((i as InvitationRow[]) || []);
    }

    load();
    const channel = supabase
      .channel('tables-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const normales = tables.filter((t) => !t.is_reserve);
  const reserve = tables.filter((t) => t.is_reserve);

  function summary(tableId: string) {
    const invs = invitations.filter((i) => i.table_id === tableId);
    const prevu = invs.reduce((s, i) => s + i.nombre_prevu, 0);
    const arrive = invs.reduce((s, i) => s + i.nombre_arrive, 0);
    return { prevu, arrive, restant: Math.max(0, prevu - arrive), count: invs.length };
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Tables" />

      <div className="flex-1 px-4 py-4">
        <p className="mb-2 text-sm font-semibold text-black/50">Tables normales</p>
        <div className="mb-6 grid grid-cols-2 gap-3">
          {normales.map((t) => {
            const s = summary(t.id);
            return (
              <Link key={t.id} href={`/tables/${t.id}`} className="card">
                <p className="font-bold">Table {t.number}</p>
                {t.label && <p className="truncate text-xs text-black/40">{t.label}</p>}
                <p className="mt-1 text-sm text-black/60">
                  {s.arrive}/{s.prevu} arrivés
                </p>
              </Link>
            );
          })}
        </div>

        <p className="mb-2 text-sm font-semibold text-black/50">Tables de réserve</p>
        <div className="grid grid-cols-2 gap-3">
          {reserve.map((t) => (
            <Link key={t.id} href={`/tables/${t.id}`} className="card border-2 border-status-partial/40">
              <p className="font-bold">Table {t.number}</p>
              <p className="text-xs text-black/40">Réserve</p>
            </Link>
          ))}
        </div>
      </div>

      {role && <BottomNav role={role} />}
    </div>
  );
}

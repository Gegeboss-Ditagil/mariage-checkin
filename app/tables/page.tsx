'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, TableRow } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';
import { useSessionRole } from '@/hooks/useSessionRole';

function volCode(number: number): string | null {
  if (number < 1 || number > 40) return null;
  const padded = String(number).padStart(3, '0');
  return number <= 7 ? 'Vol-F' + padded : 'Vol-T' + padded;
}

export default function TablesPage() {
  const role = useSessionRole();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [query, setQuery] = useState('');

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

  const filteredTables = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter((t) => {
      const vol = volCode(t.number) || '';
      return (
        String(t.number).includes(q) ||
        (t.label || '').toLowerCase().includes(q) ||
        (t.zone || '').toLowerCase().includes(q) ||
        vol.toLowerCase().includes(q)
      );
    });
  }, [tables, query]);

  const normales = filteredTables.filter((t) => !t.is_reserve);
  const reserve = filteredTables.filter((t) => t.is_reserve);

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
        <input
          className="mb-4 w-full rounded-xl2 border-2 border-gold-400/25 bg-night-800 px-4 py-3 text-cream placeholder:text-cream/30 focus:border-gold-400 focus:outline-none"
          placeholder="Rechercher une table (numéro, ville, vol…)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {filteredTables.length === 0 && (
          <p className="py-6 text-center text-cream/50">Aucune table pour « {query} »</p>
        )}

        {normales.length > 0 && (
          <>
            <p className="mb-2 text-sm font-semibold text-cream/50">Tables normales</p>
            <div className="mb-6 grid grid-cols-2 gap-3">
              {normales.map((t) => {
                const s = summary(t.id);
                const vol = volCode(t.number);
                return (
                  <Link key={t.id} href={'/tables/' + t.id} className="card">
                    <p className="font-display text-lg font-bold text-cream">Table {t.number}</p>
                    {t.label && <p className="truncate text-xs text-cream/40">{t.label}</p>}
                    {vol && <p className="truncate text-xs text-cream/30">{vol}</p>}
                    <p className="mt-1 text-sm text-cream/60">
                      {s.arrive}/{s.prevu} arrivés
                    </p>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {reserve.length > 0 && (
          <>
            <p className="mb-2 text-sm font-semibold text-cream/50">Tables de réserve</p>
            <div className="grid grid-cols-2 gap-3">
              {reserve.map((t) => (
                <Link key={t.id} href={'/tables/' + t.id} className="card border-2 border-status-partial/40">
                  <p className="font-display text-lg font-bold text-cream">Table {t.number}</p>
                  <p className="text-xs text-cream/40">Réserve</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {role && <BottomNav role={role} />}
    </div>
  );
}

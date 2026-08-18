'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, TableRow } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { TopBar } from '@/components/TopBar';
import { restants } from '@/lib/statusLogic';

function volCode(number: number): string | null {
  if (number < 1 || number > 40) return null;
  const padded = String(number).padStart(3, '0');
  return number <= 7 ? 'Vol-F' + padded : 'Vol-T' + padded;
}

function extractPrenoms(notes: string | null): string | null {
  if (!notes) return null;
  const marker = 'Membres:';
  const idx = notes.indexOf(marker);
  if (idx === -1) return null;
  const after = notes.slice(idx + marker.length).trim();
  if (!after) return null;
  const noms = after
    .split(',')
    .map(function (part) {
      const trimmed = part.trim();
      const premierMot = trimmed.split(' ')[0];
      return premierMot;
    })
    .filter(Boolean);
  if (noms.length === 0) return null;
  return noms.join(', ');
}

export default function TablePage() {
  const { tableId } = useParams<{ tableId: string }>();
  const router = useRouter();
  const [table, setTable] = useState<TableRow | null>(null);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const [{ data: t }, { data: invs }] = await Promise.all([
        supabase.from('tables').select('*').eq('id', tableId).maybeSingle(),
        supabase
          .from('invitations')
          .select('*')
          .eq('table_id', tableId)
          .order('nom_affichage'),
      ]);
      if (!active) return;

      // Filet de securite : si l'identifiant dans l'URL ne correspond a
      // aucune table, c'est probablement en fait un identifiant d'invitation
      // (mauvais lien/bouton quelque part) -- on redirige alors directement
      // vers la fiche de cette invitation plutot que d'afficher une page vide.
      if (!t) {
        const { data: inv } = await supabase
          .from('invitations')
          .select('id')
          .eq('id', tableId)
          .maybeSingle();
        if (inv) {
          router.replace('/checkin/' + tableId);
          return;
        }
      }

      setTable(t as TableRow | null);
      setInvitations((invs as InvitationRow[]) || []);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel('table-' + tableId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invitations', filter: 'table_id=eq.' + tableId },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [tableId]);

  const titre = table
    ? 'Table ' +
      table.number +
      (table.label ? ' — ' + table.label : '') +
      (volCode(table.number) ? ' — ' + volCode(table.number) : '')
    : 'Table';

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title={titre} backHref="/scan" />

      {loading && <p className="p-4 text-center text-black/50">Chargement…</p>}

      {!loading && invitations.length === 0 && (
        <p className="p-6 text-center text-black/50">Aucune invitation associée à cette table.</p>
      )}

      <ul className="flex-1 divide-y divide-black/5 px-4">
        {invitations.map((inv) => {
          const prenoms = extractPrenoms(inv.notes);
          return (
            <li key={inv.id}>
              <button
                className="flex w-full items-center justify-between gap-3 py-4 text-left"
                onClick={() => router.push('/checkin/' + inv.id)}
              >
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{inv.nom_affichage}</p>
                  {prenoms && <p className="truncate text-xs font-medium text-gold-700">{prenoms}</p>}
                  <p className="text-sm text-black/50">
                    {inv.nombre_arrive}/{inv.nombre_prevu} personnes
                    {inv.statut === 'partiel' && ' · ' + restants(inv.nombre_prevu, inv.nombre_arrive) + ' restantes'}
                  </p>
                </div>
                <StatusBadge statut={inv.statut} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

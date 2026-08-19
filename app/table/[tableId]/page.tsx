'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, TableRow, OverflowAssignmentRow } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { TopBar } from '@/components/TopBar';
import { restants } from '@/lib/statusLogic';
import { useSessionRole } from '@/hooks/useSessionRole';

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
  const role = useSessionRole();
  const canModify = role === 'admin' || role === 'directeur' || role === 'placeur';
  const [table, setTable] = useState<TableRow | null>(null);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  // Excedents assignes a CETTE table (venant d'un autre groupe/table) : sans
  // ca, une personne qui scanne le QR code de la table ne voit jamais les
  // excedents qui y ont ete places -- risque de les rater completement ou de
  // les re-assigner par erreur en double le jour J.
  const [overflow, setOverflow] = useState<OverflowAssignmentRow[]>([]);
  const [overflowNoms, setOverflowNoms] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const [{ data: t }, { data: invs }, { data: ov }] = await Promise.all([
        supabase.from('tables').select('*').eq('id', tableId).maybeSingle(),
        supabase
          .from('invitations')
          .select('*')
          .eq('table_id', tableId)
          .order('nom_affichage'),
        supabase.from('overflow_assignments').select('*').eq('reserve_table_id', tableId),
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
      const overflowRows = (ov as OverflowAssignmentRow[]) || [];
      setOverflow(overflowRows);

      const invIds = Array.from(new Set(overflowRows.map((o) => o.invitation_id)));
      if (invIds.length > 0) {
        const { data: noms } = await supabase
          .from('invitations')
          .select('id, nom_affichage')
          .in('id', invIds);
        if (!active) return;
        const map = new Map<string, string>();
        (noms || []).forEach((n: any) => map.set(n.id, n.nom_affichage));
        setOverflowNoms(map);
      } else {
        setOverflowNoms(new Map());
      }

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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'overflow_assignments', filter: 'reserve_table_id=eq.' + tableId },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [tableId]);

  const prevu = invitations.reduce((s, i) => s + i.nombre_prevu, 0);
  const arrive = invitations.reduce((s, i) => s + i.nombre_arrive, 0);
  const overflowTotal = overflow.reduce((s, o) => s + o.nombre_personnes, 0);

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

      {!loading && table && (
        <div className="px-4 pt-3">
          <div className="card mb-2 grid grid-cols-3 text-center">
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
          {overflow.length > 0 && (
            <p className="mb-2 text-sm text-status-over">
              +{overflowTotal} personne{overflowTotal > 1 ? 's' : ''} en excédent assignée{overflowTotal > 1 ? 's' : ''}{' '}
              ici ({overflowTotal} / {table.capacity} places de la table)
            </p>
          )}
        </div>
      )}

      {!loading && invitations.length === 0 && overflow.length === 0 && (
        <p className="p-6 text-center text-black/50">Aucune invitation associée à cette table.</p>
      )}

      <ul className="flex-1 divide-y divide-gold-400/10 px-4">
        {invitations.map((inv) => {
          const prenoms = extractPrenoms(inv.notes);
          return (
            <li key={inv.id} className="flex items-center gap-1">
              {canModify && <button
                className="flex min-w-0 flex-1 items-center justify-between gap-3 py-4 text-left"
                onClick={() => router.push('/checkin/' + inv.id)}
              >
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{inv.nom_affichage}</p>
                  {prenoms && <p className="truncate text-xs font-medium text-gold-600">{prenoms}</p>}
                  <p className="text-sm text-black/50">
                    {inv.nombre_arrive}/{inv.nombre_prevu} personnes
                    {inv.statut === 'partiel' && ' · ' + restants(inv.nombre_prevu, inv.nombre_arrive) + ' restantes'}
                  </p>
                </div>
                <StatusBadge statut={inv.statut} />
              </button>}
              <button
                type="button"
                aria-label="Déplacer vers une autre table"
                onClick={() => router.push('/tables/move/' + inv.id)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-300/40 text-base text-gold-600/80 active:scale-[0.95] transition-transform"
              >
                ⇄
              </button>
            </li>
          );
        })}

        {overflow.map((o) => canModify ? (
          <li key={o.id}>
            <button
              className="flex w-full items-center justify-between gap-3 py-4 text-left active:scale-[0.98] transition-transform"
              onClick={() => router.push('/tables/overflow/' + o.id)}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-black/70">
                  {overflowNoms.get(o.invitation_id) || 'Excédent affecté'}
                </p>
                <p className="text-xs text-black/40">Toucher pour retirer ou déplacer</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-status-over">+{o.nombre_personnes}</span>
            </button>
          </li>
        ) : (
          <li key={o.id} className="flex items-center justify-between gap-3 py-4">
            <p className="truncate font-medium text-black/70">{overflowNoms.get(o.invitation_id) || 'Excédent affecté'}</p>
            <span className="shrink-0 text-sm font-semibold text-status-over">+{o.nombre_personnes}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}



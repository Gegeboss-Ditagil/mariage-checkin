'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, TableRow, OverflowAssignmentRow } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { StatusBadge } from '@/components/StatusBadge';
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

export default function TableDetailPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const router = useRouter();
  const role = useSessionRole();
  const canModify = role === 'admin' || role === 'directeur' || role === 'placeur';
  const [table, setTable] = useState<TableRow | null>(null);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [overflow, setOverflow] = useState<OverflowAssignmentRow[]>([]);
  const [overflowNoms, setOverflowNoms] = useState<Map<string, string>>(new Map());

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

      // Filet de securite : si l'identifiant dans l'URL ne correspond a
      // aucune table, c'est probablement en fait un identifiant d'invitation
      // -- on redirige alors directement vers la fiche de cette invitation.
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

      // Noms des invitations en excedent, pour affichage (au lieu d'une
      // ligne anonyme "Excedent affecte").
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
    }

    load();
    const channel = supabase
      .channel('table-detail-' + tableId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invitations', filter: 'table_id=eq.' + tableId },
        load
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'overflow_assignments', filter: 'reserve_table_id=eq.' + tableId },
        load
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
    <div className="flex min-h-dvh flex-col bg-night-radial text-cream">
      <TopBar title={titre} backHref="/tables" />

      <div className="px-4 py-4">
        <div className="card-night mb-4 grid grid-cols-3 text-center">
          <div>
            <p className="text-xs uppercase text-cream/40">Prévu</p>
            <p className="text-2xl font-bold">{prevu}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-cream/40">Arrivés</p>
            <p className="text-2xl font-bold text-status-complete">{arrive}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-cream/40">Restants</p>
            <p className="text-2xl font-bold text-status-partial">{Math.max(0, prevu - arrive)}</p>
          </div>
        </div>

        {/* L'excedent peut desormais etre assigne a N'IMPORTE QUELLE table
            (pas seulement les tables de reserve) : cet avertissement ne doit
            donc plus dependre de is_reserve, sinon un excedent place sur une
            table normale devient invisible ici. */}
        {overflow.length > 0 && (
          <p className="mb-4 text-sm text-status-over">
            +{overflowTotal} personne{overflowTotal > 1 ? 's' : ''} en excédent · {overflowTotal + arrive} / {table?.capacity} places de la table utilisées
          </p>
        )}

        <ul className="divide-y divide-gold-400/10">
          {invitations.map((inv) => {
            const prenoms = extractPrenoms(inv.notes);
            return (
              <li key={inv.id} className="flex items-center gap-1">
                {canModify && <button
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 py-3 text-left"
                  onClick={() => router.push('/checkin/' + inv.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{inv.nom_affichage}</p>
                    {prenoms && <p className="truncate text-xs font-medium text-gold-300">{prenoms}</p>}
                  </div>
                  <span className="flex shrink-0 items-center gap-2 text-sm">
                    {inv.nombre_arrive}/{inv.nombre_prevu}
                    <StatusBadge statut={inv.statut} />
                  </span>
                </button>}
                <button
                  type="button"
                  aria-label="Déplacer vers une autre table"
                  onClick={() => router.push('/tables/move/' + inv.id)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-400/25 text-base text-gold-300/80 active:scale-[0.95] transition-transform"
                >
                  ⇄
                </button>
              </li>
            );
          })}
          {overflow.map((o) => canModify ? (
              <li key={o.id}>
                <button
                  className="flex w-full items-center justify-between gap-3 py-3 text-left active:scale-[0.98] transition-transform"
                  onClick={() => router.push('/tables/overflow/' + o.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-cream/80">
                      {overflowNoms.get(o.invitation_id) || 'Excédent affecté'}
                    </p>
                    <p className="text-xs text-cream/40">Toucher pour retirer ou déplacer</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-status-over">
                    +{o.nombre_personnes}
                  </span>
                </button>
              </li>
            ) : (
              <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                <p className="truncate font-medium text-cream/80">{overflowNoms.get(o.invitation_id) || 'Excédent affecté'}</p>
                <span className="shrink-0 text-sm font-semibold text-status-over">+{o.nombre_personnes}</span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}




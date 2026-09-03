'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { InvitationRow, TableRow, OverflowAssignmentRow } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { TopBar } from '@/components/TopBar';
import { restants } from '@/lib/statusLogic';
import { useSessionRole } from '@/hooks/useSessionRole';
import { hasCapability } from '@/lib/permissions';
import { extractPrenoms } from '@/lib/membersNotes';
import {
  clearBulkMoveSelection,
  readBulkMoveSelection,
  saveBulkMoveSelection,
} from '@/lib/bulkMoveSession';
import { debounce } from '@/lib/debounce';

function volCode(number: number): string | null {
  if (number < 1 || number > 40) return null;
  const padded = String(number).padStart(3, '0');
  return number <= 7 ? 'Vol-F' + padded : 'Vol-T' + padded;
}

export default function TablePage() {
  const { tableId } = useParams<{ tableId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = useSessionRole();
  // Tous les agents operationnels doivent voir les invitations et ouvrir le
  // check-in. Seuls admin/directeur/placeur peuvent afficher l'action de
  // deplacement. Garder ces deux permissions separees evite le bug ou un
  // agent scan ne voyait que les fleches, sans aucun nom sur la table.
  const canMoveGuests = hasCapability(role, 'moveGuests');
  const canCheckin = hasCapability(role, 'checkin');
  const [table, setTable] = useState<TableRow | null>(null);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  // Excedents assignes a CETTE table (venant d'un autre groupe/table) : sans
  // ca, une personne qui scanne le QR code de la table ne voit jamais les
  // excedents qui y ont ete places -- risque de les rater completement ou de
  // les re-assigner par erreur en double le jour J.
  const [overflow, setOverflow] = useState<OverflowAssignmentRow[]>([]);
  const [overflowNoms, setOverflowNoms] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // -- Selection multiple (transfert/echange en lot) -------------------------
  // Voir /tables/[tableId] pour le detail du parcours ; identique ici, la
  // seule difference est le point d'entree (scan QR au lieu de la liste).
  const echangeAvecTableId = searchParams.get('echangeAvec');
  const [echangeIdsA, setEchangeIdsA] = useState<string[] | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [swapSubmitting, setSwapSubmitting] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  useEffect(() => {
    if (!echangeAvecTableId) return;
    const pending = readBulkMoveSelection();
    if (pending && pending.mode === 'exchange-pick-b' && pending.fromTableId === echangeAvecTableId) {
      setEchangeIdsA(pending.invitationIds);
      setSelectMode(true);
    } else {
      setEchangeIdsA(null);
    }
  }, [echangeAvecTableId]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function annulerSelection() {
    setSelectMode(false);
    setSelectedIds(new Set());
    if (echangeAvecTableId) {
      clearBulkMoveSelection();
      router.replace('/table/' + tableId);
    }
  }

  function lancerTransfert() {
    if (selectedIds.size === 0 || !table) return;
    saveBulkMoveSelection({
      invitationIds: Array.from(selectedIds),
      fromTableId: table.id,
      mode: 'transfer',
    });
    router.push('/tables/move-multiple');
  }

  function lancerEchange() {
    if (selectedIds.size === 0 || !table) return;
    saveBulkMoveSelection({
      invitationIds: Array.from(selectedIds),
      fromTableId: table.id,
      mode: 'exchange-pick-b',
    });
    router.push('/tables/move-multiple');
  }

  async function confirmerEchange() {
    if (!table || !echangeAvecTableId || !echangeIdsA || selectedIds.size === 0) return;
    const confirmMsg =
      'Échanger ' +
      echangeIdsA.length +
      ' invitation' + (echangeIdsA.length > 1 ? 's' : '') +
      ' contre ' +
      selectedIds.size +
      ' invitation' + (selectedIds.size > 1 ? 's' : '') +
      ' ?';
    if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) return;
    setSwapSubmitting(true);
    setSwapError(null);
    try {
      const res = await fetch('/api/swap-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids_out_of_a: echangeIdsA,
          table_a: echangeAvecTableId,
          ids_out_of_b: Array.from(selectedIds),
          table_b: table.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSwapError(data.error || 'Échec de l’échange');
        return;
      }
      clearBulkMoveSelection();
      router.push('/table/' + tableId);
    } catch {
      setSwapError('Erreur réseau — réessayez');
    } finally {
      setSwapSubmitting(false);
    }
  }

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    // Corrige le 03/09/2026 (retour de Gersom : "je vois comme l'ancienne
    // page en premier et ensuite je vois la nouvelle") -- Next.js reutilise
    // cette meme instance de composant en passant d'une table a une autre
    // (seul tableId change), donc sans ce reset l'ancienne table restait
    // affichee integralement (loading deja a false depuis le premier
    // montage) pendant que la nouvelle requete etait encore en vol.
    setLoading(true);
    setTable(null);
    setInvitations([]);
    setOverflow([]);
    setOverflowNoms(new Map());

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

    // Regroupe une rafale d'evenements (reimport CSV, correction en lot) en
    // un seul rechargement -- voir lib/debounce.ts.
    const debouncedLoad = debounce(load, 400);
    const channel = supabase
      .channel('table-' + tableId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invitations', filter: 'table_id=eq.' + tableId },
        debouncedLoad
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'overflow_assignments', filter: 'reserve_table_id=eq.' + tableId },
        debouncedLoad
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

      {loading && <p className="p-4 text-center text-text-faint">Chargement…</p>}

      {!loading && table && (
        <div className="px-4 pt-3">
          <div className="card mb-2 grid grid-cols-3 text-center">
            <div>
              <p className="text-xs uppercase text-text-faint">Prévu</p>
              <p className="text-2xl font-bold">{prevu}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-text-faint">Arrivés</p>
              <p className="text-2xl font-bold text-status-complete">{arrive}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-text-faint">Restants</p>
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
        <p className="p-6 text-center text-text-faint">Aucune invitation associée à cette table.</p>
      )}

      {!loading && (
        <div className="px-4">
          {echangeAvecTableId && echangeIdsA && (
            <p className="mb-3 rounded-xl2 border-2 border-accent/40 bg-accent-tint p-3 text-sm font-semibold text-accent">
              Sélectionnez qui quitte cette table en échange de {echangeIdsA.length} invitation
              {echangeIdsA.length > 1 ? 's' : ''} venant de l'autre table.
            </p>
          )}
          {canMoveGuests && !echangeAvecTableId && (
            <button
              type="button"
              onClick={() => (selectMode ? annulerSelection() : setSelectMode(true))}
              className="mb-3 text-sm font-semibold text-accent underline underline-offset-2"
            >
              {selectMode ? 'Annuler la sélection' : 'Sélectionner plusieurs invités'}
            </button>
          )}
        </div>
      )}

      <ul className="flex-1 divide-y divide-hairline px-4 pb-24">
        {invitations.map((inv) => {
          const prenoms = extractPrenoms(inv.notes);
          const checked = selectedIds.has(inv.id);
          const body = (
            <>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{inv.nom_affichage}</p>
                {prenoms && <p className="truncate text-xs font-medium text-accent">{prenoms}</p>}
                <p className="text-sm text-text-faint">
                  {inv.nombre_arrive}/{inv.nombre_prevu} personnes
                  {inv.statut === 'partiel' && ' · ' + restants(inv.nombre_prevu, inv.nombre_arrive) + ' restantes'}
                </p>
              </div>
              <StatusBadge statut={inv.statut} />
            </>
          );
          return (
            <li key={inv.id} className="flex items-center gap-1">
              {selectMode ? (
                <label className="flex min-w-0 flex-1 items-center gap-3 py-4">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelected(inv.id)}
                    className="h-5 w-5 shrink-0 rounded border-2 border-hairline accent-accent"
                  />
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-3">{body}</span>
                </label>
              ) : canCheckin ? (
                <button
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 py-4 text-left"
                  onClick={() => router.push('/checkin/' + inv.id)}
                >
                  {body}
                </button>
              ) : (
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 py-4">{body}</div>
              )}
              {canMoveGuests && !selectMode && (
                <button
                  type="button"
                  aria-label="Déplacer vers une autre table"
                  onClick={() => router.push('/tables/move/' + inv.id)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline text-base text-accent/80 active:scale-[0.95] transition-transform"
                >
                  ⇄
                </button>
              )}
            </li>
          );
        })}

        {overflow.map((o) => canMoveGuests ? (
          <li key={o.id}>
            <button
              className="flex w-full items-center justify-between gap-3 py-4 text-left active:scale-[0.98] transition-transform"
              onClick={() => router.push('/tables/overflow/' + o.id)}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-text-muted">
                  {overflowNoms.get(o.invitation_id) || 'Excédent affecté'}
                </p>
                <p className="text-xs text-text-faint">Toucher pour retirer ou déplacer</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-status-over">+{o.nombre_personnes}</span>
            </button>
          </li>
        ) : (
          <li key={o.id} className="flex items-center justify-between gap-3 py-4">
            <p className="truncate font-medium text-text-muted">{overflowNoms.get(o.invitation_id) || 'Excédent affecté'}</p>
            <span className="shrink-0 text-sm font-semibold text-status-over">+{o.nombre_personnes}</span>
          </li>
        ))}
      </ul>

      {selectMode && selectedIds.size > 0 && (
        <div className="selection-action-dock">
          <p className="mb-2 text-center text-sm font-semibold text-text-muted">
            {selectedIds.size} invitation{selectedIds.size > 1 ? 's' : ''} sélectionnée{selectedIds.size > 1 ? 's' : ''}
          </p>
          {swapError && <p className="mb-2 text-center text-sm font-medium text-status-over">{swapError}</p>}
          {echangeAvecTableId && echangeIdsA ? (
            <button
              type="button"
              className="btn-primary w-full"
              disabled={swapSubmitting}
              onClick={confirmerEchange}
            >
              {swapSubmitting
                ? '…'
                : 'Confirmer l’échange (' + echangeIdsA.length + ' ⇄ ' + selectedIds.size + ')'}
            </button>
          ) : (
            <div className="flex gap-2">
              <button type="button" className="selection-action-button" onClick={lancerTransfert}>
                ⇄ Transférer
              </button>
              <button type="button" className="selection-action-button" onClick={lancerEchange}>
                ⇋ Échanger
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { debounce } from '@/lib/debounce';
import {
  LiveSeatGuest,
  LiveSeatInvitation,
  LiveSeatOverflow,
  LiveSeatPerson,
  buildLiveSeats,
  photographedSeats,
  tablePeopleNames,
} from '@/lib/liveSeats';

const INVITATION_COLUMNS = 'id, nom_affichage, notes, nombre_prevu, nombre_arrive, ne_viendra_pas, table_id';

/**
 * v1.74.0 : sièges du dessin d'une table, calculés depuis les VRAIES données
 * (voir lib/liveSeats.ts) et tenus à jour en temps réel -- un invité surprise
 * approuvé, un excédent envoyé en réserve (tables 1 et 42), un déplacement
 * ou un « ne viendra pas » apparaît sur le dessin sans recharger la page.
 * Tant que la première lecture n'a pas répondu, renvoie les sièges du PDF
 * (aucun flash « Vide » sur les tables déjà connues).
 */
export function useLiveTableSeats(
  table: { id: string; number: number; capacity: number } | null
): { seats: (LiveSeatPerson | null)[] | null; live: boolean } {
  const [seats, setSeats] = useState<(LiveSeatPerson | null)[] | null>(null);
  // Vrai dès que `seats` vient des vraies données (et plus du repli PDF).
  const [live, setLive] = useState(false);
  const knownInvitationIds = useRef<Set<string>>(new Set());
  const knownGuestIds = useRef<Set<string>>(new Set());
  const tableId = table?.id ?? null;
  const tableNumber = table?.number ?? null;
  const capacity = table?.capacity ?? 0;

  useEffect(() => {
    if (!tableId || tableNumber === null) {
      setSeats(null);
      setLive(false);
      return;
    }
    let cancelled = false;
    setSeats(photographedSeats(tableNumber, capacity));
    setLive(false);
    const supabase = createClient();

    async function load() {
      try {
        const { data: here, error } = await supabase.from('invitations').select(INVITATION_COLUMNS).eq('table_id', tableId);
        if (error || cancelled) return;
        const hereRows = (here || []) as (LiveSeatInvitation & { table_id: string })[];
        const hereIds = hereRows.map((i) => i.id);
        const overflowFilter = hereIds.length > 0
          ? 'reserve_table_id.eq.' + tableId + ',invitation_id.in.(' + hereIds.join(',') + ')'
          : 'reserve_table_id.eq.' + tableId;
        const { data: ov, error: ovError } = await supabase
          .from('overflow_assignments')
          .select('id, invitation_id, nombre_personnes, created_at, reserve_table_id')
          .or(overflowFilter);
        if (ovError || cancelled) return;
        const overflow = (ov || []) as (LiveSeatOverflow & { reserve_table_id: string })[];
        const incomingOverflowIds = new Set(overflow.filter((o) => o.reserve_table_id === tableId).map((o) => o.id));

        const invitationsById = new Map<string, LiveSeatInvitation>(hereRows.map((i) => [i.id, i]));
        const missing = Array.from(new Set(overflow.map((o) => o.invitation_id))).filter((id) => !invitationsById.has(id));
        if (missing.length > 0) {
          const { data: sources } = await supabase.from('invitations').select(INVITATION_COLUMNS).in('id', missing);
          for (const s of (sources || []) as LiveSeatInvitation[]) invitationsById.set(s.id, s);
        }
        if (cancelled) return;

        const allIds = Array.from(invitationsById.keys());
        const guestsByInvitation = new Map<string, LiveSeatGuest[]>();
        const guestIds = new Set<string>();
        if (allIds.length > 0) {
          const { data: links, error: linkError } = await supabase
            .from('invitation_guests')
            .select('invitation_id, guests(id, nom_affichage, arrival_status, is_unplanned, created_at)')
            .in('invitation_id', allIds);
          if (linkError || cancelled) return;
          for (const link of (links || []) as unknown as { invitation_id: string; guests: (LiveSeatGuest & { id: string }) | null }[]) {
            if (!link.guests) continue;
            guestIds.add(link.guests.id);
            guestsByInvitation.set(link.invitation_id, [...(guestsByInvitation.get(link.invitation_id) || []), link.guests]);
          }
        }
        knownInvitationIds.current = new Set(allIds);
        knownGuestIds.current = guestIds;
        const people = tablePeopleNames({
          tableInvitationIds: hereIds,
          invitationsById,
          guestsByInvitation,
          overflow,
          incomingOverflowIds,
        });
        if (!cancelled) {
          setSeats(buildLiveSeats(tableNumber!, people, capacity));
          setLive(true);
        }
      } catch {
        // Réseau faible : on garde le dernier dessin connu, le prochain
        // événement temps réel (ou retour au premier plan) relancera.
      }
    }

    void load();
    const reload = debounce(() => void load(), 400);
    const idOf = (payload: { new?: Record<string, unknown> | null; old?: Record<string, unknown> | null }, key: string) =>
      String((payload.new && payload.new[key]) || (payload.old && payload.old[key]) || '');
    const channel = supabase
      .channel('live-seats-' + tableId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, (payload) => {
        const nextTable = (payload.new as Record<string, unknown> | null)?.table_id;
        if (nextTable === tableId || knownInvitationIds.current.has(idOf(payload, 'id'))) reload();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'overflow_assignments' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitation_guests' }, (payload) => {
        if (knownInvitationIds.current.has(idOf(payload, 'invitation_id'))) reload();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, (payload) => {
        if (knownGuestIds.current.has(idOf(payload, 'id'))) reload();
      })
      .subscribe();
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', reload);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', reload);
      supabase.removeChannel(channel);
    };
  }, [tableId, tableNumber, capacity]);

  return { seats, live };
}

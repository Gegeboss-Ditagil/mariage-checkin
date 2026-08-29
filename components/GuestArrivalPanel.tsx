'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GuestArrivalStatus, GuestRow, InvitationRow } from '@/lib/types';
import { useOnline } from '@/hooks/useOnline';
import { parseMembersFromNotes } from '@/lib/membersNotes';

// Remplace l'ancien compteur agrege "Personnes arrivees" (0..nombre_prevu,
// sans savoir QUI) par une case a cocher PAR PERSONNE, a trois etats.
// Demande de Gersom le 29/08/2026 sur un groupe de 5 : "on ne veut pas
// savoir le nombre de personnes, on veut savoir c'est qui". Reversible a
// tout moment en retapant le meme bouton -- contrairement a l'ancien
// panneau "Qui ne vient pas" (LiberationPlacesPanel, retire), aucune ligne
// n'est jamais supprimee ici : l'etat vit sur guests.arrival_status et sa
// coherence avec nombre_prevu/nombre_arrive est geree par la RPC
// set_guest_arrival_status (0029_guest_arrival_status.sql).
export function GuestArrivalPanel({
  invitation,
  onInvitationUpdate,
}: {
  invitation: InvitationRow;
  onInvitationUpdate: (inv: InvitationRow) => void;
}) {
  const online = useOnline();
  const [members, setMembers] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const { data: links } = await supabase
      .from('invitation_guests')
      .select('guest_id, guests(*)')
      .eq('invitation_id', invitation.id);
    const list = ((links || []) as any[])
      .map((l) => l.guests as GuestRow)
      .filter(Boolean)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    setMembers(list);
    setLoading(false);
    return list;
  }

  // Materialise la liste "Membres: ..." (texte libre importe) en lignes
  // reelles des l'ouverture, sans attendre une premiere action de l'agent --
  // c'est le seul moyen d'avoir des noms a cocher immediatement plutot que
  // de retomber sur un compteur anonyme.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await load();
      if (cancelled || list.length > 0) return;
      const draft = parseMembersFromNotes(invitation.notes);
      if (draft.length === 0) return;
      setInitializing(true);
      try {
        await fetch('/api/members/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invitation_id: invitation.id,
            members: draft.map((m) => ({ prenom: m.prenom.trim() || null, nom: m.nom.trim() || null })),
          }),
        });
        // already_initialized (409) possible si un autre agent vient de le
        // faire en meme temps -- pas une erreur, load() ci-dessous recupere
        // de toute facon la liste reelle dans les deux cas.
        if (!cancelled) await load();
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    const supabase = createClient();
    const channel = supabase
      .channel('guest-arrival-' + invitation.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitation_guests', filter: 'invitation_id=eq.' + invitation.id }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitation.id]);

  async function setStatus(guest: GuestRow, status: GuestArrivalStatus) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setError('CONNEXION REQUISE'); return; }
    const next = guest.arrival_status === status ? 'attendu' : status;
    setPending((current) => new Set(current).add(guest.id));
    setError(null);
    // Optimiste : l'agent doit voir la coche reagir instantanement, le
    // canal temps reel (ou le rechargement ci-dessous) corrige si besoin.
    setMembers((current) => current.map((m) => (m.id === guest.id ? { ...m, arrival_status: next } : m)));
    try {
      const res = await fetch('/api/members/set-arrival-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_id: guest.id, status: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Échec de la mise à jour");
        await load();
        return;
      }
      onInvitationUpdate(data.invitation as InvitationRow);
    } catch {
      setError('Erreur réseau — réessayez');
      await load();
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(guest.id);
        return next;
      });
    }
  }

  if (invitation.nombre_prevu <= 1) return null;
  if (loading) return <div className="card mb-4 text-center text-sm text-black/40 dark:text-[#f4f3f1]/40">Chargement des membres…</div>;

  return (
    <div className="card mb-4">
      <p className="mb-2 text-sm font-semibold">Qui est arrivé ?</p>
      <ul className="space-y-1.5">
        {members.map((guest) => {
          const busy = pending.has(guest.id) || initializing;
          const arrived = guest.arrival_status === 'arrive';
          const wontCome = guest.arrival_status === 'ne_viendra_pas';
          return (
            <li
              key={guest.id}
              className={
                'flex items-center gap-2 rounded-xl px-1.5 py-1.5 ' + (wontCome ? 'opacity-45' : '')
              }
            >
              <span className={'min-w-0 flex-1 truncate text-sm ' + (wontCome ? 'line-through' : '')}>
                {guest.nom_affichage}
              </span>
              <button
                type="button"
                aria-label={(arrived ? 'Annuler l’arrivée de ' : 'Marquer arrivé : ') + guest.nom_affichage}
                aria-pressed={arrived}
                disabled={busy || !online}
                onClick={() => setStatus(guest, 'arrive')}
                className={
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-base font-bold transition-transform active:scale-90 disabled:opacity-40 ' +
                  (arrived
                    ? 'border-status-complete bg-status-complete text-white'
                    : 'border-black/15 text-black/30 dark:border-white/15 dark:text-[#f4f3f1]/30')
                }
              >
                ✓
              </button>
              <button
                type="button"
                aria-label={(wontCome ? 'Annuler "ne viendra pas" pour ' : 'Ne viendra pas : ') + guest.nom_affichage}
                aria-pressed={wontCome}
                disabled={busy || !online}
                onClick={() => setStatus(guest, 'ne_viendra_pas')}
                className={
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-base font-bold transition-transform active:scale-90 disabled:opacity-40 ' +
                  (wontCome
                    ? 'border-status-over bg-status-over text-white'
                    : 'border-black/15 text-black/30 dark:border-white/15 dark:text-[#f4f3f1]/30')
                }
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-xs font-medium text-status-over">{error}</p>}
    </div>
  );
}

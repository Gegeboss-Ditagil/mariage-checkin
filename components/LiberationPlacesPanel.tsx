'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GuestRow, InvitationRow } from '@/lib/types';
import { useOnline } from '@/hooks/useOnline';
import { parseMembersFromNotes, type DraftMember } from '@/lib/membersNotes';

interface ReleasedMember {
  label: string;
  prenom: string | null;
  nom: string | null;
}

export function LiberationPlacesPanel({
  invitation,
  onInvitationUpdate,
  // Signale au parent si CE panneau (par-membre) affiche effectivement une
  // liste a decocher -- utilise pour ne proposer "Cet invite ne viendra
  // pas" (qui gere l'invitation entiere) que quand ce panneau n'offre rien
  // de mieux : invitation solo, ou groupe sans detail de membres connu.
  // N'est jamais rappele avec false explicitement au demontage : le parent
  // part deja de "pas cache" par defaut, aucun flash au premier affichage.
  onVisibilityChange,
}: {
  invitation: InvitationRow;
  onInvitationUpdate: (inv: InvitationRow) => void;
  onVisibilityChange?: (visible: boolean) => void;
}) {
  const online = useOnline();
  const [members, setMembers] = useState<GuestRow[]>([]);
  const [draft, setDraft] = useState<DraftMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dernieres personnes liberees depuis ce panneau, pour proposer un
  // "Annuler" -- avant cette version, une fois liberee une place ne
  // pouvait plus etre remise sans repasser par "Gerer les membres du
  // groupe" et retaper le nom a la main (signale par Gersom le 28/08/2026).
  const [lastReleased, setLastReleased] = useState<ReleasedMember[] | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const { data: links } = await supabase.from('invitation_guests').select('guest_id, guests(*)').eq('invitation_id', invitation.id);
    const list = ((links || []) as any[]).map((l) => l.guests as GuestRow).filter(Boolean).sort((a, b) => a.created_at.localeCompare(b.created_at));
    setMembers(list);
    setDraft(list.length === 0 ? parseMembersFromNotes(invitation.notes) : []);
    setSelected(new Set());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase.channel('liberation-' + invitation.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitation_guests', filter: 'invitation_id=eq.' + invitation.id }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitation.id]);

  // Reinitialise l'offre d'annulation en changeant de groupe -- jamais a
  // chaque `load()` (voir plus bas), sinon le rechargement temps reel
  // declenche par notre propre liberation effacerait "lastReleased" avant
  // meme que le bouton "Annuler" ait pu s'afficher.
  useEffect(() => {
    setLastReleased(null);
    setUndoError(null);
  }, [invitation.id]);

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleRelease() {
    if (selected.size === 0) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setError('CONNEXION REQUISE'); return; }
    setSubmitting(true);
    setError(null);
    try {
      let guestIds = Array.from(selected);
      // Capture prenom/nom AVANT la suppression (pas seulement le label
      // affiche) pour pouvoir les remettre exactement via /api/members/add
      // si l'agent annule juste apres.
      let released: ReleasedMember[] = members
        .filter((m) => selected.has(m.id))
        .map((m) => ({ label: m.nom_affichage || 'Sans nom', prenom: m.prenom, nom: m.nom }));
      if (members.length === 0) {
        const res = await fetch('/api/members/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invitation_id: invitation.id, members: draft.map((m) => ({ prenom: m.prenom.trim() || null, nom: m.nom.trim() || null })) }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Échec de l'enregistrement de la liste"); return; }
        const supabase = createClient();
        const { data: links } = await supabase.from('invitation_guests').select('guest_id, guests(*)').eq('invitation_id', invitation.id);
        const created = ((links || []) as any[]).map((link) => link.guests as GuestRow).filter(Boolean).sort((a, b) => a.created_at.localeCompare(b.created_at));
        guestIds = draft.map((member, index) => selected.has(member.key) ? created[index]?.id : null).filter((id): id is string => Boolean(id));
        released = draft
          .filter((m) => selected.has(m.key))
          .map((m) => ({ label: (m.prenom + ' ' + m.nom).trim() || 'Sans nom', prenom: m.prenom.trim() || null, nom: m.nom.trim() || null }));
      }
      let lastInvitation: InvitationRow | null = null;
      for (const guestId of guestIds) {
        const res = await fetch('/api/members/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guest_id: guestId }) });
        const data = await res.json();
        if (!res.ok && data.error !== 'member_not_found') { setError(data.error || 'Échec de la libération des places'); return; }
        if (res.ok) lastInvitation = data.invitation as InvitationRow;
      }
      if (lastInvitation) onInvitationUpdate(lastInvitation);
      setLastReleased(released);
      setUndoError(null);
      await load();
    } catch { setError('Erreur réseau — réessayez'); }
    finally { setSubmitting(false); }
  }

  async function handleUndo() {
    if (!lastReleased || lastReleased.length === 0) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setUndoError('CONNEXION REQUISE'); return; }
    setUndoing(true);
    setUndoError(null);
    try {
      let lastInvitation: InvitationRow | null = null;
      let failed = false;
      for (const member of lastReleased) {
        const res = await fetch('/api/members/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invitation_id: invitation.id, prenom: member.prenom, nom: member.nom }),
        });
        const data = await res.json();
        if (!res.ok) { failed = true; continue; }
        lastInvitation = data.invitation as InvitationRow;
      }
      if (lastInvitation) onInvitationUpdate(lastInvitation);
      if (failed) setUndoError("Certaines personnes n'ont pas pu être remises — vérifiez la liste des membres.");
      else setLastReleased(null);
      await load();
    } catch { setUndoError('Erreur réseau — réessayez'); }
    finally { setUndoing(false); }
  }

  const eligible = invitation.nombre_prevu > 1 && !loading;
  const rows = eligible
    ? members.length > 0
      ? members.map((g) => ({ key: g.id, label: g.nom_affichage || 'Sans nom' }))
      : draft.map((m) => ({ key: m.key, label: (m.prenom + ' ' + m.nom).trim() || 'Sans nom' }))
    : [];
  const visible = eligible && rows.length > 0;

  useEffect(() => {
    onVisibilityChange?.(visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="mb-4 rounded-xl2 border-2 border-gold-300/30 bg-white p-3">
      <p className="mb-2 text-sm font-semibold">🙅 Qui ne vient pas dans ce groupe ?</p>
      <ul className="mb-2 space-y-1.5">
        {rows.map((row) => <li key={row.key}><label className="flex items-center gap-2.5 rounded-xl px-1 py-1.5 text-sm active:bg-black/5"><input type="checkbox" className="h-4 w-4 shrink-0" checked={selected.has(row.key)} onChange={() => toggle(row.key)} /><span className="min-w-0 flex-1 truncate">{row.label}</span></label></li>)}
      </ul>
      <button type="button" className="btn-secondary w-full py-2 text-sm" disabled={selected.size === 0 || submitting || !online} onClick={handleRelease}>
        {submitting ? '…' : !online ? 'HORS LIGNE' : selected.size === 0 ? 'Sélectionner qui libère sa place' : 'Libérer ' + selected.size + ' place' + (selected.size > 1 ? 's' : '') + ' sélectionnée' + (selected.size > 1 ? 's' : '')}
      </button>
      {error && <p className="mt-2 text-xs font-medium text-status-over">{error}</p>}

      {lastReleased && lastReleased.length > 0 && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-black/5 px-2.5 py-2 text-xs">
          <span className="min-w-0 flex-1 truncate text-black/60">
            {lastReleased.map((m) => m.label).join(', ')} libéré{lastReleased.length > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            className="shrink-0 font-semibold text-gold-700 underline underline-offset-2 disabled:opacity-40"
            disabled={undoing || !online}
            onClick={handleUndo}
          >
            {undoing ? '…' : '↩️ Annuler'}
          </button>
        </div>
      )}
      {undoError && <p className="mt-1 text-xs font-medium text-status-over">{undoError}</p>}
    </div>
  );
}

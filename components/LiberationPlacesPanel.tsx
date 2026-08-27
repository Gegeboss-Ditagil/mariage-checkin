'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GuestRow, InvitationRow } from '@/lib/types';
import { useOnline } from '@/hooks/useOnline';
import { parseMembersFromNotes, type DraftMember } from '@/lib/membersNotes';

export function LiberationPlacesPanel({ invitation, onInvitationUpdate }: { invitation: InvitationRow; onInvitationUpdate: (inv: InvitationRow) => void }) {
  const online = useOnline();
  const [members, setMembers] = useState<GuestRow[]>([]);
  const [draft, setDraft] = useState<DraftMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      }
      let lastInvitation: InvitationRow | null = null;
      for (const guestId of guestIds) {
        const res = await fetch('/api/members/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guest_id: guestId }) });
        const data = await res.json();
        if (!res.ok && data.error !== 'member_not_found') { setError(data.error || 'Échec de la libération des places'); return; }
        if (res.ok) lastInvitation = data.invitation as InvitationRow;
      }
      if (lastInvitation) onInvitationUpdate(lastInvitation);
      await load();
    } catch { setError('Erreur réseau — réessayez'); }
    finally { setSubmitting(false); }
  }

  if (invitation.nombre_prevu <= 1 || loading) return null;
  const rows = members.length > 0
    ? members.map((g) => ({ key: g.id, label: g.nom_affichage || 'Sans nom' }))
    : draft.map((m) => ({ key: m.key, label: (m.prenom + ' ' + m.nom).trim() || 'Sans nom' }));
  if (rows.length === 0) return null;

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
    </div>
  );
}

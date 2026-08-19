'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GuestRow, InvitationRow } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { useOnline } from '@/hooks/useOnline';

interface DraftMember {
  key: string;
  prenom: string;
  nom: string;
}

let draftKeyCounter = 0;
function newDraftKey(): string {
  draftKeyCounter += 1;
  return 'd' + draftKeyCounter;
}

/** Extrait un depart raisonnable depuis le texte libre "Membres: A B, C D" des
 * imports existants -- juste une suggestion modifiable, pas une source de
 * verite (les donnees importees contiennent parfois des doublons ou des
 * comptes qui ne correspondent pas exactement au nombre prevu). */
function parseMembersFromNotes(notes: string | null): DraftMember[] {
  if (!notes) return [];
  const marker = 'Membres:';
  const idx = notes.indexOf(marker);
  if (idx === -1) return [];
  const after = notes.slice(idx + marker.length).trim();
  if (!after) return [];
  return after
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((full) => {
      const spaceIdx = full.indexOf(' ');
      if (spaceIdx === -1) return { key: newDraftKey(), prenom: full, nom: '' };
      return { key: newDraftKey(), prenom: full.slice(0, spaceIdx), nom: full.slice(spaceIdx + 1) };
    });
}

export default function MembresInvitationPage() {
  const { invitationId } = useParams<{ invitationId: string }>();
  const router = useRouter();
  const online = useOnline();

  const [invitation, setInvitation] = useState<InvitationRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [members, setMembers] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftMember[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrenom, setEditPrenom] = useState('');
  const [editNom, setEditNom] = useState('');

  const [addingNew, setAddingNew] = useState(false);
  const [newPrenom, setNewPrenom] = useState('');
  const [newNom, setNewNom] = useState('');

  async function load() {
    const supabase = createClient();
    const { data: inv } = await supabase.from('invitations').select('*').eq('id', invitationId).maybeSingle();

    if (!inv) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const typedInv = inv as InvitationRow;
    setInvitation(typedInv);

    const { data: links } = await supabase
      .from('invitation_guests')
      .select('guest_id, guests(*)')
      .eq('invitation_id', invitationId);

    const list = ((links || []) as any[])
      .map((l) => l.guests as GuestRow)
      .filter(Boolean)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    setMembers(list);

    if (list.length === 0) {
      setDraft(parseMembersFromNotes(typedInv.notes));
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel('members-' + invitationId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitation_guests', filter: 'invitation_id=eq.' + invitationId }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitationId]);

  function updateDraft(key: string, field: 'prenom' | 'nom', value: string) {
    setDraft((d) => d.map((m) => (m.key === key ? { ...m, [field]: value } : m)));
  }

  function removeDraftRow(key: string) {
    setDraft((d) => d.filter((m) => m.key !== key));
  }

  function addDraftRow() {
    setDraft((d) => [...d, { key: newDraftKey(), prenom: '', nom: '' }]);
  }

  async function handleSaveDraft() {
    if (!invitation) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('CONNEXION REQUISE');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = draft
        .map((m) => ({ prenom: m.prenom.trim() || null, nom: m.nom.trim() || null }))
        .filter((m) => m.prenom || m.nom);

      const res = await fetch('/api/members/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: invitation.id, members: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'already_initialized') {
          setError('Déjà enregistré par quelqu\'un d\'autre entre-temps — liste à jour ci-dessous.');
          await load();
          return;
        }
        setError(data.error || 'Échec de l\'enregistrement');
        return;
      }
      await load();
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddMember() {
    if (!invitation) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('CONNEXION REQUISE');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/members/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitation_id: invitation.id,
          prenom: newPrenom.trim() || null,
          nom: newNom.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Échec de l\'ajout');
        return;
      }
      setNewPrenom('');
      setNewNom('');
      setAddingNew(false);
      await load();
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveMember(guest: GuestRow) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('CONNEXION REQUISE');
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm('Retirer ' + guest.nom_affichage + ' de ce groupe ?')) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/members/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_id: guest.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'member_not_found') {
          setError('Déjà retiré par quelqu\'un d\'autre entre-temps.');
          await load();
          return;
        }
        setError(data.error || 'Échec du retrait');
        return;
      }
      await load();
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(guest: GuestRow) {
    setEditingId(guest.id);
    setEditPrenom(guest.prenom || '');
    setEditNom(guest.nom || '');
  }

  async function handleSaveEdit(guestId: string) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('CONNEXION REQUISE');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/members/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_id: guestId, prenom: editPrenom.trim() || null, nom: editNom.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Échec de la modification');
        return;
      }
      setEditingId(null);
      await load();
    } catch {
      setError('Erreur réseau — réessayez');
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-night-radial px-6 text-center">
        <p className="text-lg font-semibold text-cream/80">Invitation introuvable</p>
        <button className="btn-primary" onClick={() => router.push('/scan')}>
          Retour au scan
        </button>
      </div>
    );
  }

  if (loading || !invitation) {
    return <div className="flex min-h-dvh items-center justify-center bg-night-radial text-cream/50">Chargement…</div>;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-night-radial text-cream">
      <TopBar title="Membres du groupe" backHref={'/checkin/' + invitation.id} />

      <div className="flex-1 space-y-4 px-4 py-4">
        <div className="card-night">
          <p className="text-sm font-bold uppercase tracking-wide text-gold-300">{invitation.nom_affichage}</p>
          <p className="mt-1 text-cream/60">{invitation.nombre_prevu} personne{invitation.nombre_prevu > 1 ? 's' : ''} prévue{invitation.nombre_prevu > 1 ? 's' : ''}</p>
        </div>

        {members.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-cream/50">
              La liste détaillée des membres n'a pas encore été créée pour ce groupe. C'est optionnel — utile
              seulement si vous devez retirer ou nommer une personne précise plus tard.
            </p>
            {draft.length === 0 && (
              <p className="text-sm text-cream/40">Aucun membre détecté dans les notes importées.</p>
            )}
            <div className="space-y-2">
              {draft.map((m) => (
                <div key={m.key} className="flex items-center gap-2 rounded-xl2 border-2 border-gold-400/20 bg-night-800 p-3">
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-gold-400/20 bg-night-900 px-2 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-gold-400 focus:outline-none"
                    placeholder="Prénom"
                    value={m.prenom}
                    onChange={(e) => updateDraft(m.key, 'prenom', e.target.value)}
                  />
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-gold-400/20 bg-night-900 px-2 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-gold-400 focus:outline-none"
                    placeholder="Nom (optionnel)"
                    value={m.nom}
                    onChange={(e) => updateDraft(m.key, 'nom', e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label="Retirer cette ligne"
                    className="shrink-0 text-lg text-status-over"
                    onClick={() => removeDraftRow(m.key)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn-secondary w-full" onClick={addDraftRow}>
              + Ajouter une ligne
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((g) => {
              const sansNom = !g.prenom && !g.nom;
              const isEditing = editingId === g.id;
              return (
                <div key={g.id} className="rounded-xl2 border-2 border-gold-400/20 bg-night-800 p-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          className="min-w-0 flex-1 rounded-xl border border-gold-400/20 bg-night-900 px-2 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-gold-400 focus:outline-none"
                          placeholder="Prénom"
                          value={editPrenom}
                          onChange={(e) => setEditPrenom(e.target.value)}
                          autoFocus
                        />
                        <input
                          className="min-w-0 flex-1 rounded-xl border border-gold-400/20 bg-night-900 px-2 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-gold-400 focus:outline-none"
                          placeholder="Nom (optionnel)"
                          value={editNom}
                          onChange={(e) => setEditNom(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-primary flex-1 py-2 text-sm"
                          disabled={submitting || !online}
                          onClick={() => handleSaveEdit(g.id)}
                        >
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          className="btn-secondary flex-1 py-2 text-sm"
                          onClick={() => setEditingId(null)}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className={sansNom ? 'italic text-cream/40' : 'font-semibold text-cream'}>
                        {sansNom ? 'Sans nom — appuyer pour nommer' : g.nom_affichage}
                      </span>
                      <div className="flex shrink-0 items-center gap-3">
                        <button
                          type="button"
                          aria-label="Modifier"
                          className="text-base text-gold-300"
                          onClick={() => startEdit(g)}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          aria-label="Retirer"
                          className="text-lg text-status-over"
                          disabled={submitting || !online}
                          onClick={() => handleRemoveMember(g)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {addingNew ? (
              <div className="space-y-2 rounded-xl2 border-2 border-gold-400/30 bg-night-800 p-3">
                <div className="flex items-center gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-gold-400/20 bg-night-900 px-2 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-gold-400 focus:outline-none"
                    placeholder="Prénom (optionnel)"
                    value={newPrenom}
                    onChange={(e) => setNewPrenom(e.target.value)}
                    autoFocus
                  />
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-gold-400/20 bg-night-900 px-2 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-gold-400 focus:outline-none"
                    placeholder="Nom (optionnel)"
                    value={newNom}
                    onChange={(e) => setNewNom(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary flex-1 py-2 text-sm"
                    disabled={submitting || !online}
                    onClick={handleAddMember}
                  >
                    Ajouter
                  </button>
                  <button
                    type="button"
                    className="btn-secondary flex-1 py-2 text-sm"
                    onClick={() => {
                      setAddingNew(false);
                      setNewPrenom('');
                      setNewNom('');
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn-secondary w-full" onClick={() => setAddingNew(true)}>
                + Ajouter une personne
              </button>
            )}
          </div>
        )}

        {error && <p className="text-sm font-medium text-status-over">{error}</p>}
      </div>

      {members.length === 0 && (
        <div className="px-4 pb-6">
          <button
            type="button"
            className="btn-primary w-full"
            disabled={submitting || !online}
            onClick={handleSaveDraft}
          >
            {submitting ? '…' : !online ? 'HORS LIGNE' : 'ENREGISTRER LA LISTE'}
          </button>
        </div>
      )}
    </div>
  );
}

